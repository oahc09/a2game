import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
const game=()=>JSON.parse(readFileSync(new URL('../specs/v0.1/games/g59-neon-survival.game.json',import.meta.url)));
const config=g=>g.scenes[0].entities[0].components[0].config;
const view=r=>r.observe().state.world;
const aim={source:'gamepad',kind:'sample',payload:{index:0,connected:true,buttons:[],axes:[0,0,1,0]}};
const neutral={...aim,payload:{...aim.payload,axes:[0,0,0,0]}};
function run(g,fn){
 const r=new HeadlessRuntime(g,makeRegistry());
 try{r.start();return fn(r);}finally{r.dispose();}
}
test('survival awards points before a single loss and freezes until restart',()=>{
 run(game(),r=>{
  r.injectRaw(aim);r.step(90);
  assert.ok(view(r).score>0);assert.equal(r.status,'playing');
  r.injectRaw(neutral);r.step(1000);
  assert.equal(r.status,'lost');assert.equal(view(r).health,0);
  assert.equal(r.observe().events.filter(e=>e.type==='game.lost').length,1);
  const hash=r.observe().exactHash,score=view(r).score;
  assert.ok(score>0);assert.equal(r.step(500).advanced,0);assert.equal(r.observe().exactHash,hash);
  r.restart();assert.equal(view(r).score,0);assert.equal(view(r).elapsedTicks,0);
  r.step(1000);assert.equal(r.status,'lost');assert.equal(view(r).score,0);
 });
});
test('repeating wave has more than 64 unique spawns, bounded slots, no debt and deterministic pause/checkpoint replay',()=>{
 const g=game(),c=config(g);
 c.seekSpeed=0;c.maxObjects=5;c.survival={...c.survival,startTick:0,intervalTicks:1,maxActive:1};
 c.survival.templates=c.survival.templates.slice(0,2).map(b=>({...b,ttl:3}));
 run(g,r=>{
  const ids=[];
  const play=(n,record=true)=>{for(let i=0;i<n;i++){
   r.step();const w=view(r);assert.ok(w.bodies.length<=4);assert.deepEqual(w.spawned,[]);
   if(record)ids.push(...r.observe().events.filter(e=>e.tickIndex===r.tickIndex-1&&e.type==='realtime.spawned').map(e=>e.payload.id));
  }};
  play(90);
  const checkpoint=r.snapshot();
  r.pause();assert.equal(r.step(20).advanced,0);assert.equal(view(r).elapsedTicks,90);r.resume();
  play(150);assert.equal(ids.length,80);assert.deepEqual(ids,Array.from({length:80},(_,i)=>'survival_'+i*3));
  assert.equal(r.status,'playing');assert.equal(view(r).elapsedTicks,240);assert.equal('timeLeft'in view(r),false);
  const hash=r.observe().exactHash;
  r.restore(checkpoint);r.pause();r.resume();play(150,false);assert.equal(r.observe().exactHash,hash);
 });
});
test('invalid survival configurations fail admission; old timed profile still needs its deadline',()=>{
 for(const edit of [
  c=>c.maxTicks=1,c=>c.goalScore=30,c=>c.waves=[],c=>delete c.stickActions,
  c=>c.survival.intervalTicks=0,c=>c.survival.maxActive=c.maxObjects,c=>c.survival.templates=[],
  c=>c.survival.templates[0].ttl=0,c=>c.survival.templates[0].kind='actor',
  c=>c.survival.templates[0].team=1,c=>c.survival.templates[0].value=0,
  (c,w)=>w.bodies[0].id='survival_0',(c,w)=>w.elapsedTicks=4,
  (c,w)=>{delete c.survival;delete w.elapsedTicks;}
 ]){
  const g=game();edit(config(g),g.state.world.initial);
  assert.throws(()=>new HeadlessRuntime(g,makeRegistry()),/A2G_E_CAP_CONFIG/);
 }
});

test('actual death settles the maximum once per round; lower scores, reload, content identity and denied storage',async()=>{
 const {createSurvivalScore}=await import('../player/survival-score.mjs');
 const g=game(),rows=new Map();let writes=0;
 const storage=()=>({getItem:k=>rows.get(k)??null,setItem:(k,v)=>{writes++;rows.set(k,v);}});
 const tracker=createSurvivalScore(g,{storage});
 run(g,r=>{
  const round=(n,score,best,newBest)=>{
   tracker.update(r.observe());
   if(n){r.injectRaw(aim);r.step(n);r.injectRaw(neutral);}
   r.step(1000);
   const expected={best,available:true,settlement:{score,newBest}};
   assert.deepEqual(tracker.update(r.observe()),expected);
   assert.deepEqual(tracker.update(r.observe()),expected);
   r.restart();
  };
  round(90,10,10,true);
  assert.equal(createSurvivalScore(g,{storage}).summary().best,10);
  round(0,0,10,false);round(230,40,40,true);
  assert.equal(writes,2);assert.equal(rows.size,1);
  const other=game();other.revision++;
  assert.equal(createSurvivalScore(other,{storage}).summary().best,0);
  const unavailable=createSurvivalScore(g,{storage:()=>{throw Error('blocked');}});
  unavailable.update(r.observe());r.injectRaw(aim);r.step(90);r.injectRaw(neutral);r.step(1000);
  assert.deepEqual(unavailable.update(r.observe()),{best:10,available:false,settlement:{score:10,newBest:true}});
  r.restart();assert.deepEqual(unavailable.update(r.observe()),{best:10,available:false,settlement:null});
  const deniedWrite=createSurvivalScore(g,{storage:()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}})});
  deniedWrite.update(r.observe());r.injectRaw(aim);r.step(90);r.injectRaw(neutral);r.step(1000);
  assert.equal(deniedWrite.update(r.observe()).available,false);
  const fake=r.observe();fake.events=[];fake.state.world.score=99;
  r.restart();deniedWrite.update(r.observe());r.step(1000);
  assert.deepEqual(deniedWrite.update(r.observe()),{best:10,available:false,settlement:{score:0,newBest:false}});
  r.restart();tracker.update(r.observe());
  assert.equal(tracker.update(fake).settlement,null);assert.equal(writes,2);
 });
});

test('survival trims old event telemetry without changing logical state or bypassing explicit host budgets',()=>{
 const g=game(),c=config(g);
 c.seekSpeed=0;c.survival.startTick=0;c.survival.intervalTicks=1;
 c.survival.templates=c.survival.templates.slice(0,1).map(b=>({...b,ttl:1}));
 const retained=new HeadlessRuntime(g,makeRegistry());
 const full=new HeadlessRuntime(g,makeRegistry(),{maxRecordedEvents:2000});
 const hard=new HeadlessRuntime(g,makeRegistry(),{maxRecordedEvents:1});
 try{
  for(const r of [retained,full,hard])r.start();
  for(const r of [retained,full])r.step(1000);
  assert.equal(retained.observe().events.length,128);
  assert.equal(full.observe().events.length,1000);
  assert.deepEqual(retained.observe().events,full.observe().events.slice(-128));
  assert.equal(retained.observe().exactHash,full.observe().exactHash);
  assert.throws(()=>hard.step(2),/A2G_E_BUDGET_EXCEEDED/);
  assert.equal(hard.tickIndex,1);
 }finally{for(const r of [retained,full,hard])r.dispose();}
});
