import assert from 'node:assert/strict';
import {readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {resolve,join,basename} from 'node:path';
import {webkit} from 'playwright';
import {createPlayerServer} from './serve.mjs';
import {createContentService} from './content-service.mjs';
import {browserLaunchOptions} from './browser-launch.mjs';
const root=resolve(import.meta.dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
const [lane='air',seconds=lane==='air'?'1800':'600',mode='single']=process.argv.slice(2),limit=Number(seconds)*1000;
assert.ok(['three','air'].includes(lane));assert.ok(['single','rounds'].includes(mode));assert.ok(Number.isSafeInteger(limit)&&limit>=10000&&limit<=1800000);
const out=join(root,'output','g59-survival-soak-'+lane+'-'+randomUUID());
mkdirSync(out,{recursive:true});const log=join(out,'receipt.jsonl');
const sdk=read('player/vendor/sdk-provenance.json'),lock=read('project/sdk-lock.json');
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);assert.deepEqual(sdk.three,lock.three);
for(const item of sdk.files)assert.equal(digest(readFileSync(join(root,item.path))),item.sha256);
const report=(row)=>{const line=JSON.stringify(row);console.log(line);appendFileSync(log,line+'\n');};
const service=createContentService(),server=createPlayerServer({contentService:service});
const slug='g59-neon-survival',launch=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
let browser;
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 browser=await webkit.launch({...launch,timeout:20000});
 report({lane,seconds:Number(seconds),mode,browser:browser.version(),
  launcher:launch.executablePath?basename(launch.executablePath):null,clock:'actual-rAF',
  gameSha256:digest(readFileSync(join(root,'specs/v0.1/games',slug+'.game.json'))),
  sdk:{air:sdk.cocosairjs.commit,three:sdk.three.version,files:sdk.files},
  input:'synthetic-standard-gamepad',startedAt:new Date().toISOString()});
 const page=await browser.newPage({viewport:{width:1024,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(`
  const makePolicy=(()=>{${readFileSync(join(import.meta.dirname,'g59-soak-policy.mjs'),'utf8').replace('export function','function')};return makeController;})();
  let policy=makePolicy();
  window.soakReset=()=>{policy=makePolicy();window.soak.active=true;window.soak.nextTick=0;window.soak.last=0;window.soak.axes=[0,0,0,0];};
  window.soak={active:true,axes:[0,0,0,0],nextTick:0,peakBodies:0,peakEvents:0,frames:0,first:0,last:0,maxFrameMs:0};
  Object.defineProperty(navigator,'getGamepads',{value:()=>[{index:0,connected:true,mapping:'standard',buttons:[],axes:window.soak.axes}]});
  const sample=now=>{
   requestAnimationFrame(sample);
   const driver=window.__a2game, stats=window.soak;
   if(!stats.active||!driver||driver.runtime.status!=='playing')return;
   if(!stats.first)stats.first=now;
   if(stats.last)stats.maxFrameMs=Math.max(stats.maxFrameMs,now-stats.last);
   stats.last=now;stats.frames++;
   if(driver.runtime.tickIndex<stats.nextTick)return;
   const obs=driver.getState(),world=obs.state.world;
   stats.axes=policy(world);stats.peakBodies=Math.max(stats.peakBodies,world.bodies.length);stats.peakEvents=Math.max(stats.peakEvents,obs.events.length);
   stats.nextTick=driver.runtime.tickIndex+6;
  };
  requestAnimationFrame(sample);
 `);
 await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+lane+'&game='+slug+'&ready=1');
 await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused',{},{timeout:20000});
 await page.locator('#gamepadEnable').click();await page.locator('#readyStart').click();
 const start=performance.now();
 let final,settlement,bestScore=0,priorTicks=0,roundCount=0,lastReported=-30000;
 const getSettlement=()=>page.evaluate(()=>{
  const o=window.__a2game.getState();
  return {tick:o.tickIndex,score:o.state.world.score,lossEvents:o.events.filter(e=>e.type==='game.lost').length};
 });
 for(;;){
  const elapsedMs=Math.round(performance.now()-start);
  const data=await page.evaluate(()=>{
   const o=window.__a2game.getState(),{axes,...driver}=window.soak;
   return {status:o.flow.status,ticks:o.tickIndex,score:o.state.world.score,hp:o.state.world.health,...driver,hint:document.querySelector('#hint').textContent};
  });
  final={elapsedMs,...data,totalTicks:priorTicks+data.ticks,errors:[...errors]};
  if(elapsedMs-lastReported>=30000||elapsedMs>=limit||data.status!=='playing'){
   report(final);lastReported=elapsedMs;
  }
  assert.equal(errors.length,0);
  assert.ok(data.peakBodies<=48);assert.ok(data.peakEvents<=128);
  if(mode==='rounds'&&data.status==='lost'){
   settlement=await getSettlement();
   assert.equal(settlement.lossEvents,1);assert.ok(settlement.tick===data.ticks);
   priorTicks+=settlement.tick;bestScore=Math.max(bestScore,settlement.score);roundCount++;
   report({round:roundCount,settlement,bestScore,totalTicks:priorTicks});
   if(elapsedMs>=limit)break;
   await page.evaluate(()=>window.soakReset());
   await page.locator('#stageRestart').click();
   await page.locator('#gamepadEnable').click();
   continue;
  }
  assert.equal(data.status,'playing');
  if(elapsedMs>=limit)break;
  await new Promise(r=>setTimeout(r,Math.min(mode==='rounds'?1000:30000,limit-elapsedMs)));
 }
 assert.ok(final.totalTicks>=Number(seconds)*59);
 if(final.status==='playing'){
  await page.evaluate(()=>{window.soak.active=false;window.soak.axes=[0,0,0,0];});
  await page.waitForFunction(()=>window.__a2game?.runtime.status==='lost',{},{timeout:25000});
  settlement=await getSettlement();
  assert.ok(settlement.score>=final.score);assert.equal(settlement.lossEvents,1);
  bestScore=Math.max(bestScore,settlement.score);roundCount++;
 }
 assert.ok(bestScore>0);
 await page.reload();
 await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused',{},{timeout:20000});
 const best=await page.locator('#score').textContent();
 assert.match(best,new RegExp('本机最高：'+bestScore+'(?:\\D|$)'));
 await page.evaluate(()=>window.__a2game.dispose());report({result:'PASS',lane,mode,settlement,roundCount,bestScore});

}catch(error){
 report({result:'FAIL',lane,message:String(error.message??error).replaceAll(root,'<checkout>')});
 throw error;
}finally{
 console.log(log);
 await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
}
