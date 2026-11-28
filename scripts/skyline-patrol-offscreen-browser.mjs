
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {HeadlessRuntime,runConformanceSuite} from '../dist/index.js';
import {createContentService} from './content-service.mjs';
import {makeRegistry} from './registry.mjs';
import {verifyScoreSession} from './score-session.mjs';
import {createPlayerServer} from './serve.mjs';

const dir='games/business-complete/skyline-patrol/';
const longRoute=process.argv.includes('--long');
const stem=process.argv.includes('--muzzle')?'muzzle':process.argv.includes('--contact-order')?'contact-order':'offscreen';
const source=await readFile(dir+stem+'.game.json','utf8');
const game=JSON.parse(source);
const traceFile=stem+(longRoute?'-long':'')+'-score-trace.json';
const traceSource=await readFile(dir+traceFile,'utf8');
const trace=JSON.parse(traceSource);
const suite=JSON.parse(await readFile(dir+stem+'.conformance.json','utf8'));
const conformance=await runConformanceSuite(suite,game,makeRegistry);
assert.equal(conformance.status,'PASS');
const score=verifyScoreSession(game,trace,{scorePath:'/world/score',expectedScore:longRoute?5300:100,actorId:'hero'});
const shotGoneTick=stem==='muzzle'?237:240;
const marks=[1,33,34,44,60,73,shotGoneTick-1,shotGoneTick,1275,1348,1349];
const edgeInputs=[
 {source:'pointer',kind:'down',tickIndex:0,seq:0,timeUs:0,payload:{pointerId:1,u:.5,v:.9,viewportAspect:.625}},
 {source:'pointer',kind:'move',tickIndex:0,seq:1,timeUs:0,payload:{pointerId:1,u:-.2,v:1.2,viewportAspect:.625}}
];
const first='scout--0-0',recycled='scout--0-72',shot='shot_10';
const at=(state,id)=>state.state.world.bodies.find(b=>b.id===id);
const low=1400,high=17400;
function verifyBoundary(samples){
 assert.equal(at(samples[1],first).y-at(samples[1],first).hy>high,true);
 assert.equal(at(samples[33],first).y-at(samples[33],first).hy>high,true);
 assert.equal(at(samples[34],first).y-at(samples[34],first).hy<high,true);
 assert.equal(at(samples[60],first).y+at(samples[60],first).hy<high,true);
 for(const tick of [44,1349]){
  const hero=at(samples[tick],'hero');
  assert.deepEqual([hero.x-hero.hx,hero.y-hero.hy],[0,low]);
 }
 assert.equal(at(samples[73],recycled).y-at(samples[73],recycled).hy>high,true);
 const beforeRecycle=samples[shotGoneTick-1],afterRecycle=samples[shotGoneTick];
 assert.ok(at(beforeRecycle,shot).y-at(beforeRecycle,shot).hy>high);
 assert.equal(at(afterRecycle,shot),undefined);
 assert.equal(beforeRecycle.state.world.score,afterRecycle.state.world.score);
 for(const tick of [1275,1348]){
  const enemy=at(samples[tick],recycled);
  assert.ok(enemy.y+enemy.hy<low&&enemy.vy<0);
 }
 assert.equal(at(samples[1349],recycled),undefined);
 assert.equal(samples[1348].state.world.score,samples[1349].state.world.score);
 assert.ok(!samples[1349].events.some(e=>e.type==='combat.death'&&e.payload.id===recycled));
}
const hashes=samples=>Object.fromEntries(marks.map(tick=>[tick,samples[tick].exactHash]));
const reference={};
if(!longRoute){
 const runtime=new HeadlessRuntime(game,makeRegistry());
 try{
  runtime.start();
  for(const event of edgeInputs)runtime.injectRaw(event);
  let prev=0;
  for(const tick of marks){
   runtime.step(tick-prev);prev=tick;
   reference[tick]=runtime.observe();
  }
  verifyBoundary(reference);
 }finally{runtime.dispose();}
}
const output='output/skyline-patrol-offscreen-'+Date.now();
await mkdir(output,{recursive:true});
const service=createContentService();
const release=await service.release(source);
const server=createPlayerServer({contentService:service});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const summary={status:'FAIL',caseId:'SHT-05',gameRelease:release.sha256Jcs,sourceSha256:createHash('sha256').update(source).digest('hex'),traceFile,traceSha256:createHash('sha256').update(traceSource).digest('hex'),caseClock:longRoute?'manual-clock three-phase route':'manual-clock at fixed boundary marks and normal-clock score route',score,conformance,results:[]};
if(!longRoute)Object.assign(summary,{marks,edgeInputs,headlessHashes:hashes(reference)});
try{
 for(const backend of ['three','air']){
  const url='http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&release='+release.sha256Jcs;
  const row={backend};summary.results.push(row);
  for(const manual of longRoute?[true]:[true,false]){
   const page=await browser.newPage({viewport:{width:950,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(url+(manual?'&clock=manual':''));
    await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused');
    await page.evaluate(events=>{
     document.querySelector('#readyStart').addEventListener('click',()=>{
      for(const event of events)window.__a2game.runtime.injectRaw(event);
     },{once:true});
    },manual&&!longRoute?edgeInputs:trace.events.filter(e=>e.source==='pointer'));
    await page.locator('#readyStart').click();
    if(manual&&!longRoute){
     const samples={};let prev=0;
     for(const tick of marks){
      samples[tick]=await page.evaluate(delta=>{const a=window.__a2game;a.step(delta);return a.getState();},tick-prev);
      prev=tick;
      if([1,60,1349].includes(tick))await page.screenshot({path:output+'/'+backend+'-tick-'+tick+'.png'});
     }
     verifyBoundary(samples);
     row.boundaryHashes=hashes(samples);
     assert.deepEqual(row.boundaryHashes,summary.headlessHashes);
    }else{
     if(longRoute){
      let tick=0;
      row.phaseWaves=[];
      const {wavePhases,waves}=game.scenes[0].entities[0].components[0].config;
      for(const phase of wavePhases){
       const {startTick,weights,speedPermille}=phase;
       const before=startTick===0?[]:await page.evaluate(delta=>{
        const a=window.__a2game;a.step(delta);
        return a.getState({recentEvents:0}).state.world.bodies;
       },startTick-tick);
       tick=startTick;
       const sample=await page.evaluate(delta=>{
        const a=window.__a2game;a.step(delta);
        const o=a.getState({recentEvents:8});return {tick:o.tickIndex,status:o.flow.status,bodies:o.state.world.bodies};
       },startTick+1-tick);
       assert.equal(sample.status,'playing');
       tick=sample.tick;
       const wave=sample.bodies.find(body=>body.kind==='target'&&body.id.endsWith('-'+startTick));
       assert.ok(wave&&wave.y-wave.hy>high);
       const template=waves.findIndex(({body},i)=>wave.id===body.id+'--'+i+'-'+startTick);
       assert.ok(template>=0&&weights[template]>0);
       assert.equal(wave.vy,Math.trunc(waves[template].body.vy*speedPermille/1000));
       const carry=sample.bodies.filter(body=>body.kind==='target'&&before.some(old=>old.id===body.id));
       if(startTick!==0)assert.ok(carry.length);
       for(const body of carry)assert.equal(body.vy,before.find(old=>old.id===body.id).vy);
       row.phaseWaves.push({tick:startTick,id:wave.id,y:wave.y,vy:wave.vy,existingTargetsUnchanged:carry.length});
      }
      await page.evaluate(delta=>window.__a2game.step(delta),score.advanced-tick);
     }
     await page.waitForFunction(()=>window.__a2game.runtime.status==='lost',null,{timeout:15000});
     const o=await page.evaluate(()=>window.__a2game.getState());
     if(longRoute){
      const sequence=o.events.filter(e=>e.type==='realtime.spawned'&&/--\d+-\d+$/.test(e.payload.id)).map(e=>({tick:e.tickIndex,id:e.payload.id}));
      const phases=game.scenes[0].entities[0].components[0].config.wavePhases;
      const expected=phases.flatMap(({startTick,intervalTicks},i)=>Array.from({length:Math.ceil(((phases[i+1]?.startTick??o.tickIndex)-startTick)/intervalTicks)},(_,j)=>startTick+j*intervalTicks));
      assert.deepEqual(sequence.map(w=>w.tick),expected);
      assert.ok(sequence.length>64);
      row.waveCount=sequence.length;
      row.waveSequenceSha256=createHash('sha256').update(JSON.stringify(sequence)).digest('hex');
     }
     assert.deepEqual([o.tickIndex,o.state.world.score,o.exactHash],[score.advanced,score.score,score.finalHash]);
     await page.locator('#restart').click();
     await page.waitForFunction(()=>window.__a2game.runtime.status==='playing');
     row.score={tick:o.tickIndex,score:o.state.world.score,hash:o.exactHash,restart:true};
    }
    assert.equal(await page.evaluate(async()=>{await window.__a2game.dispose();return window.__a2game.diagnostics().listenersActive;}),false);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
  console.log(backend,JSON.stringify(row.score));
 }
 if(longRoute){
  assert.deepEqual(summary.results[0].phaseWaves,summary.results[1].phaseWaves);
  assert.equal(summary.results[0].waveSequenceSha256,summary.results[1].waveSequenceSha256);
 }
 summary.status='PASS';
}catch(e){summary.error=e.stack;throw e;}
finally{
 await writeFile(output+'/receipt.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 console.log(output+'/receipt.json',summary.status);
 await browser.close();await new Promise(r=>server.close(r));
}
