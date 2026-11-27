/** Replay the same tick-stamped raw Gamepad trace in Node and both actual ordinary player backends. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {once} from 'node:events';
import {basename,join,resolve} from 'node:path';
import {webkit} from 'playwright';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry} from './registry.mjs';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {browserLaunchOptions} from './browser-launch.mjs';
import {makeController} from './g59-soak-policy.mjs';

const root=resolve(import.meta.dirname,'..'),slug='g59-neon-survival';
const ticks=Number(process.argv[2]??36000),chunkTicks=300,decisionTicks=6;
assert.ok(Number.isSafeInteger(ticks)&&ticks>=chunkTicks&&ticks<=36000&&ticks%chunkTicks===0);
const out=join(root,'output','g59-survival-trace-'+randomUUID());mkdirSync(out,{recursive:true});
const file=join(root,'specs/v0.1/games',slug+'.game.json'),gameBytes=readFileSync(file),game=JSON.parse(gameBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
const sdk=json('player/vendor/sdk-provenance.json'),lock=json('project/sdk-lock.json');
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);assert.deepEqual(sdk.three,lock.three);
for(const item of sdk.files)assert.equal(sha(readFileSync(join(root,item.path))),item.sha256);
const project=o=>({
 tick:o.tickIndex,status:o.flow.status,hash:o.exactHash,score:o.state.world.score,hull:o.state.world.health,
 terminal:o.events.filter(e=>e.channel==='outcome').map(({type,tickIndex,payload})=>({type,tickIndex,payload}))
});
const control=makeController(),batches=[];
const runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();
let seq=0;
const raw=(tick,axes)=>({source:'gamepad',kind:'sample',tickIndex:tick,timeUs:Math.ceil(tick*1e6/game.world.clock.tickHz),seq:seq++,
 payload:{index:0,connected:true,buttons:[],axes}});
try{
 for(let base=0;base<ticks;base+=chunkTicks){
  const inputs=[];
  for(let tick=base;tick<base+chunkTicks;tick+=decisionTicks){
   assert.equal(runtime.tickIndex,tick);assert.equal(runtime.status,'playing');
   const sample=raw(tick,control(runtime.observe().state.world));inputs.push(sample);
   runtime.injectRaw(sample);runtime.step(decisionTicks);
  }
  batches.push({steps:chunkTicks,inputs,expected:project(runtime.observe())});
 }
 const neutral=raw(ticks,[0,0,0,0]);runtime.injectRaw(neutral);
 const end=runtime.step(1800),expected=project(runtime.observe());
 assert.equal(expected.status,'lost');assert.equal(expected.terminal.length,1);assert.ok(expected.score>0);
 batches.push({steps:end.advanced,inputs:[neutral],expected});
}finally{runtime.dispose();}
const trace={format:'a2game-fixed-gamepad-trace',version:1,gameSha256:sha(gameBytes),
 batches:batches.map(({steps,inputs})=>({steps,inputs}))};
writeFileSync(join(out,'trace.json'),JSON.stringify(trace)+'\n');
const launch=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
const report={format:'a2game-g59-trace-parity',version:1,isRealTime:false,
 scope:'exact raw Gamepad inputs, ordinary players and Node under a manual clock',
 traceSha256Jcs:sha256Canonical(trace),gameSha256:trace.gameSha256,inputSamples:seq,checkpoints:batches.length,
 requestedPlayingTicks:ticks,sdk,lanes:[],node:{checkpoints:batches.map(b=>b.expected)}};
const server=createPlayerServer({contentService:createContentService()});
let browser;
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 browser=await webkit.launch({...launch,timeout:20000});
 report.browser={version:browser.version(),launcher:launch.executablePath?basename(launch.executablePath):null};
 for(const backend of ['three','air']){
  const page=await browser.newPage({viewport:{width:1024,height:900}});
  const errors=[],lane={backend,checkpoints:0};report.lanes.push(lane);
  try{
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&clock=manual&game='+slug);
   await page.waitForFunction(()=>window.__a2game?.runtime.status==='playing',{},{timeout:20000});
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
   for(const {steps,inputs,expected} of batches){
    const observed=await page.evaluate(({steps,inputs})=>{
     const h=window.__a2game;
     for(const input of inputs)h.runtime.injectRaw(input);
     h.step(steps);
     const o=h.getState();
     return {tick:o.tickIndex,status:o.flow.status,hash:o.exactHash,score:o.state.world.score,hull:o.state.world.health,
      terminal:o.events.filter(e=>e.channel==='outcome').map(({type,tickIndex,payload})=>({type,tickIndex,payload}))};
    },{steps,inputs});
    assert.deepEqual(observed,expected,backend+' divergence at tick '+expected.tick);
    lane.checkpoints++;
   }
   assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__a2game.dispose());lane.result='PASS';
  }finally{await page.close();}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.message??error);throw error;}
finally{
 writeFileSync(join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(out);
 await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
}
