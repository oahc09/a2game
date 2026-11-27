/** Full score-quota and no-input loss routes on real players. Physical input and extended soak are separate. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {webkit} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
const root=resolve(import.meta.dirname,'..');
const out=join(root,'output','g59-arena-browser-'+randomUUID());mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const sdk=read(join(root,'player/vendor/sdk-provenance.json')),lock=read(join(root,'project/sdk-lock.json'));
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);assert.deepEqual(sdk.three,lock.three);
for(const item of sdk.files)assert.equal(sha(readFileSync(join(root,item.path))),item.sha256);
const service=createContentService(),host=createPlayerServer({contentService:service}),servers=[host],results=[];
const report={scope:'ordinary/standalone with real rendering and synthetic touch/gamepad input; finite authored score-quota only',sdk,cases:results};
const listen=async s=>{s.listen(0,'127.0.0.1');await once(s,'listening');return 'http://127.0.0.1:'+s.address().port;};
const close=async s=>{if(s.listening){s.closeAllConnections();await new Promise(ok=>s.close(ok));}};
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const launch=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
let browser;
try{
 const origin=await listen(host);
 browser=await webkit.launch({...launch,timeout:20000});report.browser=browserIdentity(browser,launch);
 for(const [slug,side] of [['g59-neon-arena',1],['g59-neon-arena-mirror',-1]]){
  const path=join(root,'specs/v0.1/games',slug+'.game.json'),bytes=readFileSync(path),game=JSON.parse(bytes);
  const receipt=await service.release(bytes.toString('utf8'));
  const pack=JSON.parse(execFileSync(process.execPath,[join(root,'scripts/package-player-sdk.mjs'),path],{cwd:root,encoding:'utf8',timeout:60000}));
  assert.equal(pack.status,'PASS');assert.deepEqual(read(join(pack.output,'player/game.release.json')).definition,game);
  const inventory=read(join(pack.output,'build-inventory.json')),expected=new Map(inventory.files.map(item=>['/'+item.file,item.sha256]));
  const observed=new Set();
  const exported=createServer((req,res)=>{
   const route=(req.url??'').split('?')[0],digest=expected.get(route);
   if(req.method!=='GET'||!digest)return res.writeHead(404).end();
   const bytes=readFileSync(join(pack.output,route.slice(1)));if(sha(bytes)!==digest)return res.writeHead(500).end();
   observed.add(route);res.writeHead(200,{'content-type':types[extname(route)]??'application/octet-stream','cache-control':'no-store'}).end(bytes);
  });servers.push(exported);
  const exportOrigin=await listen(exported);
  for(const backend of ['three','cocosairjs'])for(const standalone of [false,true]){
   const context=await browser.newContext({viewport:{width:1024,height:900}});
   try {
    await context.addInitScript(()=>{
     window.arenaPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.arenaPads});
     // Input contacts are synthetic. The OS has no capture-table entry for them.
     const saved=Element.prototype.setPointerCapture;
     Element.prototype.setPointerCapture=function(id){if(!(this instanceof HTMLCanvasElement)||id<101)return saved.call(this,id);};
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
    const canvas=page.locator(standalone?'#game canvas':'#GameCanvas');
    const tag=[slug,backend,standalone?'standalone':'ordinary'].join('-');
    const shot=async label=>{const file=tag+'-'+label+'.png';const png=await canvas.screenshot({path:join(out,file)});return {file,sha256:sha(png)};};
    const wait=(state,options)=>page.waitForFunction(({standalone,state})=>
      (standalone?window.examplePlayer?.status():window.__a2game?.getState().flow.status)===state,{standalone,state},options);
    const step=n=>page.evaluate(n=>window.__a2game.step(n),n);
    const state=()=>page.evaluate(()=>window.__a2game.getState());
    const backendId=backend==='cocosairjs'?'air':'three';
    await page.goto(standalone?exportOrigin+'/player/index.html?backend='+backend:origin+'/player/index.html?backend='+backendId+'&clock=manual&release='+receipt.sha256Jcs);
    if(standalone){await wait('ready',{timeout:30000});assert.equal(await page.evaluate(()=>window.examplePlayer.getInfo().id),game.id);}
    else{await wait('playing',{timeout:30000});assert.equal(await page.evaluate(()=>window.__a2game.backend),backendId);}
    const initial=await shot('opening');
    let active,won,lost;
    if(standalone){
     await page.locator('#start').click();await page.locator('#enableGamepad').click();
     await page.evaluate(side=>{window.arenaPads=[{index:0,mapping:'standard',connected:true,buttons:[],axes:[0,0,side,0]}];},side);
     await wait('won');won=await shot('score30');
     assert.ok(observed.has('/player/vendor/'+(backend==='three'?'three.module.js':'cocosair.js')));
     await page.evaluate(()=>{window.arenaPads=[];});
     await page.locator('#restart').click();await wait('lost');lost=await shot('loss');
     await page.evaluate(()=>window.examplePlayer.dispose());
    } else {
     await canvas.evaluate((canvas,side)=>{
      const box=canvas.getBoundingClientRect(),y=box.top+box.height*.5,xL=box.left+box.width*.25,xR=box.left+box.width*.75;
      const send=(type,id,x)=>canvas.dispatchEvent(new PointerEvent('pointer'+type,{pointerType:'touch',pointerId:id,clientX:x,clientY:y,buttons:1,bubbles:true}));
      send('down',101,xL);send('down',102,xR);send('move',102,xR+side*Math.min(box.width,box.height)*.2);
     },side);
     await step(6);const s=await state();assert.equal(s.state.world.bodies.find(b=>b.id==='shot_0').vx,128*side);
     assert.equal(s.state.world.crosshair.length,1);
     await step(25);assert.ok((await state()).state.world.bodies.some(b=>b.kind==='target'));
     active=await shot('firing');
     await step(205);assert.equal((await state()).flow.status,'won');assert.equal((await state()).state.world.score,30);
     won=await shot('score30');
     await page.locator('#restart').click();assert.equal((await state()).state.world.score,0);
     await step(300);assert.equal((await state()).flow.status,'lost');assert.equal((await state()).state.world.health,0);
     lost=await shot('loss');
     await page.evaluate(()=>window.__a2game.dispose());
    }
    assert.notEqual(initial.sha256,won.sha256);
    assert.notEqual(initial.sha256,lost.sha256);
    assert.deepEqual(errors,[]);
    results.push({slug,backend,standalone,gameSha256:sha(bytes),packageDigest:pack.bundleDigest,initial,active,won,lost,result:'SCORE30_RESTART_LOST'});
   }finally{observed.clear();await context.close();}
  }
 }
 assert.equal(results.length,8);
}finally{
 try{await browser?.close();}finally{await Promise.all(servers.map(close));writeFileSync(join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
}
console.log(out);
