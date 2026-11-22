import {readFileSync,existsSync} from 'node:fs';
import {resolve, dirname, basename} from 'node:path';
import {createPlayerServer} from './serve.mjs';
import {createContentService} from './content-service.mjs';
import {sha256Canonical} from '../dist/index.js';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path));
const status=json('project/status.json');
const index=json(status.coverageV2GalleryReceipt??'reports/coverage-v2-batches31-40-1795351528350.json');
const assets=new Map();
const games=Object.entries(index.batches).flatMap(([batch, entries])=>entries.map(entry=>{
    const game=json(entry.game);
    const suite=json(resolve(dirname(entry.game),'conformance.json'));
    const directory=dirname(entry.browserReceipt);
    const slug=basename(dirname(entry.game));
    const rows=json(entry.browserReceipt).results.filter(row=>row.dir===slug);
    if(rows.length!==2||!['air','three'].every(backend=>rows.some(row=>row.backend===backend)))
        throw Error('Missing engine evidence: '+entry.id);
    const scenarios=rows.flatMap(row=>{
        if(row.status!=='PASS'||row.gameSha!==sha256Canonical(game)||row.conformanceSha!==sha256Canonical(suite))
            throw Error('Invalid or stale evidence: '+entry.id);
        if(row.cases.length!==suite.cases.length||!suite.cases.every((item,i)=>row.cases[i].id===item.id))
            throw Error('Scenario mismatch: '+entry.id);
        return row.cases.map(item=>{
            const id=entry.id+'/'+row.backend+'/'+item.id;
            for(const [name,file,type] of [['image',item.screenshot,'image/png'],['trace',item.trace,'application/json']]){
                if(basename(file)!==file)throw Error('Invalid evidence filename');
                const path=directory+'/'+file;
                if(!existsSync(resolve(root,path)))throw Error('Missing evidence file: '+path);
                assets.set('/gallery-assets/'+id+'/'+name,{path,type});
            }
            const trace=json(directory+'/'+item.trace);
            if(trace.gameId!==game.id||trace.gameSha!==row.gameSha||trace.backend!==row.backend||trace.caseId!==item.id||trace.hash!==item.hash)
                throw Error('Trace mismatch: '+id);
            return {id:item.id,backend:row.backend,status:item.status,hash:item.hash,image:'/gallery-assets/'+id+'/image',trace:'/gallery-assets/'+id+'/trace'};
        });
    });
    if(!rows[0].cases.every((item,i)=>item.hash===rows[1].cases[i].hash))
        throw Error('Engine parity mismatch: '+entry.id);
    assets.set('/gallery-assets/'+entry.id+'/game',{path:entry.game,type:'application/json'});
    return {id:entry.id,batch,title:game.meta.title,description:game.meta.description,scenarios};
}));
if(games.length!==index.targets||games.flatMap(game=>game.scenarios).length!==index.browserCases)throw Error('Unexpected gallery count');

const server=createPlayerServer({contentService:createContentService({maxReleases:32})});
const [player]=server.listeners('request');
server.removeListener('request',player);
server.on('request',(req,res)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(!['GET','HEAD'].includes(req.method)||(!assets.has(path)&&path!=='/gallery-data.json'))return player(req,res);
    const host='127.0.0.1:'+server.address().port;
    if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!=='http://'+host)||req.headers['sec-fetch-site']==='cross-site'){
        res.writeHead(403).end();return;
    }
    const asset=assets.get(path);
    try{
        const body=asset?read(asset.path):JSON.stringify(games);
        res.writeHead(200,{'Content-Type':asset?.type??'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});
        res.end(req.method==='HEAD'?undefined:body);
    }catch{
        res.writeHead(404).end();
    }
});
server.listen(Number(process.env.A2GAME_GALLERY_PORT??0),'127.0.0.1',()=>{
    console.log('http://127.0.0.1:'+server.address().port+'/player/coverage-gallery.html');
});
