/** Production-clock survival + reload on actual SDKs. Synthetic input, not a sustained or physical lane. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname,basename} from 'node:path';
import {webkit} from 'playwright';
import {createPlayerServer} from './serve.mjs';
import {createContentService} from './content-service.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
const root=resolve(import.meta.dirname,'..'),slug='g59-neon-survival',out=join(root,'output','g59-survival-'+randomUUID());
mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),read=path=>JSON.parse(readFileSync(path,'utf8'));
const path=join(root,'specs/v0.1/games',slug+'.game.json'),bytes=readFileSync(path),game=JSON.parse(bytes);
const sdk=read(join(root,'player/vendor/sdk-provenance.json')),lock=read(join(root,'project/sdk-lock.json'));
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);assert.deepEqual(sdk.three,lock.three);
for(const item of sdk.files)assert.equal(sha(readFileSync(join(root,item.path))),item.sha256);
const pack=JSON.parse(execFileSync(process.execPath,[join(root,'scripts/package-player-sdk.mjs'),path],{cwd:root,encoding:'utf8',timeout:90000}));
assert.equal(pack.status,'PASS');assert.deepEqual(read(join(pack.output,'player/game.release.json')).definition,game);
const inventory=read(join(pack.output,'build-inventory.json')),expected=new Map(inventory.files.map(item=>['/'+item.file,item.sha256]));
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const catalogServer=createPlayerServer({contentService:createContentService()}),served=new Set();
const exportServer=createServer((req,res)=>{
 const route=(req.url??'').split('?')[0],digest=expected.get(route);
 if(req.method!=='GET'||!digest)return res.writeHead(404).end();
 const body=readFileSync(join(pack.output,route.slice(1)));if(sha(body)!==digest)return res.writeHead(500).end();
 served.add(route);res.writeHead(200,{'content-type':types[extname(route)]??'application/octet-stream','cache-control':'no-store'}).end(body);
});
const listen=async s=>{s.listen(0,'127.0.0.1');await once(s,'listening');return 'http://127.0.0.1:'+s.address().port;};
const close=async s=>{if(s.listening){s.closeAllConnections();await new Promise(ok=>s.close(ok));}};
const launch=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
const report={scope:'real player clocks, synthetic standard controller, per-origin reload, no device or soak',
 gameSha256:sha(bytes),packageDigest:pack.bundleDigest,inventoryFiles:expected.size,sdk,cases:[]};
let browser;
try{
 const origin=await listen(catalogServer),exportOrigin=await listen(exportServer);
 browser=await webkit.launch({...launch,timeout:20000});
 const {executablePath,...identity}=browserIdentity(browser,launch);
 report.browser={...identity,launcher:executablePath?basename(executablePath):null};
 for(const backend of ['three','cocosairjs'])for(const standalone of [false,true]){
  const context=await browser.newContext({viewport:{width:1024,height:900}});
  try{
   await context.addInitScript(()=>{
    window.aimRight=false;
    Object.defineProperty(navigator,'getGamepads',{value:()=>[{index:0,connected:true,mapping:'standard',buttons:[],axes:[0,0,Number(window.aimRight),0]}]});
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(16000);
   const row={backend,standalone,rounds:[]};report.cases.push(row);
   const selected=backend==='three'?'three':'air';
   const url=standalone?exportOrigin+'/player/index.html?backend='+backend:origin+'/player/index.html?backend='+selected+'&ready=1&game='+slug;
   const state=expected=>page.waitForFunction(({standalone,expected})=>
       (standalone?window.examplePlayer?.status():window.__a2game?.getState().flow.status)===expected,{standalone,expected});
   const best=()=>page.evaluate(standalone=>standalone?window.examplePlayer.getScoreSummary().best:
       Number(document.querySelector('#score').textContent.match(/本机最高：(\d+)/)?.[1]),standalone);
   const rounds=async({first=false,shoot})=>{
    if(!first){await page.locator('#restart').click();await state('playing');}else if(!standalone)await state('paused');
    if(shoot)await page.evaluate(()=>{window.aimRight=true;});
    await page.locator(standalone?'#enableGamepad':'#gamepadEnable').click();
    if(first)await page.locator(standalone?'#start':'#readyStart').click();
    if(shoot==='brief'){
     await page.evaluate(()=>{setTimeout(()=>{window.aimRight=false;},1350);});
    }
    await state('lost');
    const value=await page.evaluate(standalone=>standalone?window.examplePlayer.getScoreSummary().settlement?.score:
       window.__a2game.getState().state.world.score,standalone);
    const label=await page.locator(standalone?'#status':'#stageResultDetail').textContent();
    assert.match(label,/本局 \d+ 分/);assert.ok(Number.isSafeInteger(value));
    await page.evaluate(()=>{window.aimRight=false;});row.rounds.push({score:value,best:await best()});
    console.log(backend,standalone,row.rounds.at(-1));
   };
   try{
   await page.goto(url);await state(standalone?'ready':'paused');assert.equal(await best(),0);
   await rounds({first:true,shoot:'brief'});
   assert.deepEqual(row.rounds[0],{score:10,best:10});
   await rounds({shoot:false});assert.deepEqual(row.rounds[1],{score:0,best:10});
   await rounds({shoot:'all'});assert.ok(row.rounds[2].score>=30);assert.equal(row.rounds[2].score,row.rounds[2].best);
   const canvas=page.locator(standalone?'#game canvas':'#GameCanvas');
   const png=await canvas.screenshot({path:join(out,`${backend}-${standalone?'standalone':'ordinary'}.png`)});
   row.canvasSha256=sha(png);
   await page.reload();await state(standalone?'ready':'paused');
   row.reloadBest=await best();assert.equal(row.reloadBest,row.rounds[2].best);
   if(standalone){
    const cleanup=await page.evaluate(async()=>{await window.examplePlayer.dispose();return window.examplePlayer.status();});assert.equal(cleanup,'disposed');
    assert.ok(served.has('/player/vendor/'+(backend==='three'?'three.module.js':'cocosair.js')));
   }else await page.evaluate(()=>window.__a2game.dispose());
   assert.deepEqual(errors,[]);row.result='PASS';
   }catch(error){
    row.failure=await page.evaluate(standalone=>{
     const read=id=>document.getElementById(id)?.textContent;
     return {status:read('status'),hint:read('hint'),trace:read('trace'),errors:read('error'),
      ...(standalone?{diagnostics:window.examplePlayer?.diagnostics()}:{})};
    },standalone).catch(()=>null);
    row.pageErrors=errors;throw error;
   }
  }finally{await context.close();}
 }
 assert.equal(report.cases.length,4);
}finally{
 writeFileSync(join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(out);
 await browser?.close();await Promise.all([close(catalogServer),close(exportServer)]);
}
