import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,projectPresentation,replayNormalizedInputTrace} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {verifyScoreSession} from '../scripts/score-session.mjs';
import {createScoreRecord} from '../player/score-record.mjs';
const game=name=>JSON.parse(readFileSync(`specs/v0.1/games/${name}.game.json`,'utf8'));
const start=d=>{const r=new HeadlessRuntime(d,makeRegistry());r.start();return r;};
const press=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step();};
const offscreenFile=name=>JSON.parse(readFileSync(`games/business-complete/skyline-patrol/${name}.json`,'utf8'));

test('SHT-09 completes the projectile substeps before opposing contact regardless of object order',()=>{
 const base=offscreenFile('offscreen.game');
 for(const [targetId,shotId,reverse] of [['a-target','z-shot',false],['z-target','a-shot',true]])for(const hp of [1,2]){
  const game=structuredClone(base);
  const config=game.scenes[0].entities[0].components[0].config;
  Object.assign(config,{autoFire:false,projectileBeforeContact:true});
  const bodies=game.state.world.initial.bodies,hero=bodies[0],targetY=hero.y+50;
  bodies.push({id:targetId,kind:'target',x:hero.x,y:targetY,vx:0,vy:0,hx:100,hy:100,hp,team:2,value:100,fixed:true},
   {id:shotId,kind:'projectile',x:hero.x,y:targetY-208,vx:0,vy:128,hx:38,hy:38,hp:1,team:1,value:1,fixed:false,owner:hero.id,ttl:3,hits:[]});
  if(reverse)bodies.reverse();
  const runtime=start(game);
  try{
   runtime.step(1);
   const result=runtime.observe();
   const deaths=result.events.filter(e=>e.type==='combat.death').map(e=>e.payload.id);
   assert.deepEqual([result.flow.status,result.state.world.score,deaths],hp===1?['playing',100,[targetId]]:['lost',0,[hero.id]]);
   assert.equal(result.events.filter(e=>e.type==='combat.hit'&&e.payload.id===hero.id).length,hp===1?0:1);
  }finally{runtime.dispose();}
 }
});

test('score-session host reports the authoritative settlement once and restores its best',()=>{
 const game=offscreenFile('offscreen.game');
 const values=new Map();
 const storage=()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
 const record=createScoreRecord(game,storage);
 const observe=(status,score)=>record.observe({flow:{status},state:{world:{score}}});
 assert.deepEqual(observe('lost',0).settlement,{score:0,newBest:false});
 assert.equal(observe('lost',0).settlement,null);
 observe('playing',0);
 assert.deepEqual(observe('lost',100).settlement,{score:100,newBest:true});
 assert.equal(createScoreRecord(game,storage).label(),'最高分 100');
 observe('playing',0);
 assert.deepEqual(observe('lost',5),{best:100,available:true,settlement:{score:5,newBest:false}});
 const denied=()=>({getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}});
 const fallback=createScoreRecord(game,denied);
 assert.deepEqual(fallback.observe({flow:{status:'lost'},state:{world:{score:80}}}),
  {best:80,available:false,settlement:{score:80,newBest:true}});
 assert.equal(fallback.label(),'最高分 80（本页）');
 assert.equal(createScoreRecord(game,denied).label(),'最高分 0');
});

test('SHT-03 revision 6 automatic fire cadence survives pause without catch-up shots',()=>{
 const definition=offscreenFile('offscreen.game');
 const r=start(definition);
 const fired=()=>r.observe().events.filter(e=>e.type==='combat.fired').map(e=>e.tickIndex);
 try{
  r.step(1);
  const {bodies}=r.observe().state.world;
  const hero=bodies.find(b=>b.id==='hero'),shot=bodies.find(b=>b.kind==='projectile');
  assert.deepEqual([shot.x,shot.y,shot.vx,shot.vy],[hero.x,hero.y+96,0,96]);
  r.step(14);
  r.pause();
  assert.equal(r.step(90).advanced,0);
  assert.deepEqual(fired(),[0,6,12]);
  r.resume();
  r.step(16);
  assert.deepEqual(fired(),[0,6,12,18,24,30]);
 }finally{r.dispose();}
});

test('SHT-11 revision 6 rejects post-death input and restarts with clean state',()=>{
 const definition=offscreenFile('offscreen.game'),trace=offscreenFile('offscreen-score-trace');
 const r=new HeadlessRuntime(definition,makeRegistry()),fresh=start(definition);
 try{
  assert.equal(replayNormalizedInputTrace(r,trace).finalStatus,'lost');
  const settled=r.observe();
  assert.equal(settled.events.filter(e=>e.type==='combat.death'&&e.payload.id==='hero').length,1);
  assert.throws(()=>r.injectAction({action:'bomb',phase:'press'}),{code:'A2G_E_FLOW'});
  assert.throws(()=>r.injectRaw(trace.events[0]),{code:'A2G_E_FLOW'});
  assert.equal(r.step(120).advanced,0);
  assert.equal(r.observe().exactHash,settled.exactHash);
  r.restart();
  assert.deepEqual([r.tickIndex,r.observe().exactHash],[0,fresh.observe().exactHash]);
  const {activePointers,inputQueue,rawQueue,pressedSources,events}=r.snapshot();
  assert.deepEqual([activePointers,inputQueue,rawQueue,pressedSources,events],[{},[],[],{},[]]);
 }finally{r.dispose();fresh.dispose();}
});

test('SHT-06 revision 6 awards each enemy score only on its lethal hit',()=>{
 const definition=offscreenFile('offscreen.game');
 const templates=definition.scenes[0].entities[0].components[0].config.waves;
 assert.deepEqual(templates.map(({body})=>[body.hp,body.value]),[[1,100],[4,400],[10,1000]]);
 for(const {body:template} of templates){
  const fixture=structuredClone(definition);
  fixture.scenes[0].entities[0].components[0].config.autoFire=false;
  const initial=fixture.state.world.initial;
  const target={...template,id:'fixture-target',x:2200,y:6000,vx:0,vy:0,fixed:true};
  initial.bodies.push(target);
  for(let i=0;i<target.hp;i++)initial.bodies.push({id:`fixture-shot-${i}`,kind:'projectile',x:target.x,
   y:target.y-target.hy-38-1-32*i,vx:0,vy:16,hx:38,hy:38,hp:1,team:1,value:1,fixed:false,owner:'hero',ttl:90,hits:[]});
  const r=start(fixture);
  try{
   for(let hit=1;hit<=target.hp;hit++){
    r.step(hit===1?1:2);
    const observation=r.observe(),world=observation.state.world;
    const live=world.bodies.find(b=>b.id===target.id);
    const lethal=hit===target.hp;
    assert.equal(live?.hp,lethal?undefined:target.hp-hit);
    assert.equal(world.score,lethal?target.value:0);
    assert.equal(observation.events.filter(e=>e.type==='combat.hit'&&e.payload.id===target.id).length,hit);
   }
   r.step(2);
   const result=r.observe();
   assert.equal(result.state.world.score,target.value);
   assert.equal(result.events.filter(e=>e.type==='combat.death'&&e.payload.id===target.id).length,1);
  }finally{r.dispose();}
 }
});

function simultaneousShots(){
 const d=game('g17-candidate'),cfg=d.scenes[0].entities[0].components[0].config;
 delete cfg.waves;
 delete cfg.goalScore;
 const target={id:'enemy',kind:'target',x:2500,y:4500,vx:0,vy:0,hx:300,hy:300,hp:3,team:2,value:100,fixed:true};
 const shot=(id,x)=>({...target,id,x,kind:'projectile',hx:16,hy:16,hp:1,team:1,value:1,fixed:false,owner:'hero',ttl:30,hits:[]});
 d.state.world.initial.bodies.push(target,shot('shot-left',2450),shot('shot-right',2550));
 return {d,cfg,target,shot};
}

test('SHT-08 scores independent same-owner projectile hits with stable owner attribution',()=>{
 for(const independent of [undefined,true]){
  const {d,cfg}=simultaneousShots();
  if(independent)cfg.independentProjectileHits=true;
  const runtime=start(d);
  try{
   runtime.step();
   const {state,events}=runtime.observe();
   assert.equal(state.world.bodies.find(body=>body.id==='enemy').hp,independent?1:2);
   assert.equal(state.world.bodies.filter(body=>body.kind==='projectile').length,0);
   assert.deepEqual(events.filter(e=>e.type==='combat.hit').map(e=>e.payload.source),independent?['hero','hero']:['hero']);
  }finally{runtime.dispose();}
 }
 const {d,cfg,target}=simultaneousShots();
 cfg.independentProjectileHits=true;
 target.hp=1;
 const runtime=start(d);
 try{
  runtime.step(2);
  const {state,events}=runtime.observe();
  assert.equal(state.world.score,100);
  assert.equal(events.filter(e=>e.type==='combat.death'&&e.payload.id==='enemy').length,1);
 }finally{runtime.dispose();}
});

test('score-session accepts actual death with correct score and checks restart isolation',()=>{
 const {d,cfg,target,shot}=simultaneousShots();
 cfg.independentProjectileHits=true;
 target.hp=2;
 d.state.world.initial.bodies.find(body=>body.id==='hero').value=0;
 d.state.world.initial.bodies.push({...shot('hostile-shot',4000),y:1000,team:2,owner:'enemy'});
 const trace={format:'a2game-input-trace',traceVersion:'0.1.0',session:{
  gameId:d.id,gameRevision:d.revision,tickHz:d.world.clock.tickHz,seed:d.world.clock.seed,
  coordinateProfile:'viewport-top-left-v1',inputNormalizerVersion:'0.1.0'
 },events:[]};
 const expected={scorePath:'/world/score',expectedScore:100,actorId:'hero'};
 const receipt=verifyScoreSession(d,trace,expected);
 assert.equal(receipt.finalStatus,'lost');
 assert.equal(receipt.score,100);
 assert.throws(()=>verifyScoreSession(d,trace,{...expected,expectedScore:99}),/A2G_E_SCORE_SESSION/);
 const timeout=structuredClone(d);
 timeout.state.world.initial.bodies.pop();
 timeout.scenes[0].entities[0].components[0].config.maxTicks=1;
 assert.throws(()=>verifyScoreSession(timeout,trace,expected),/death=false/);
});

test('shooter supply refreshes dual fire, then expires in active Ticks and resets on restart',()=>{
 const d=JSON.parse(readFileSync('games/business-complete/skyline-patrol/supplies.game.json','utf8'));
 const cfg=d.scenes[0].entities[0].components[0].config;
 delete cfg.wavePhases;
 cfg.waves=[];
 cfg.cooldownTicks=1;
 cfg.shooterSupplies.doubleShotTicks=3;
 const actor=d.state.world.initial.bodies[0];
 const pickup={...actor,id:'double-early',kind:'pickup',supply:'double',hx:30,hy:30,hp:1,team:0,value:0};
 d.state.world.initial.bodies.push(pickup);
 cfg.waves.push({tick:2,body:{...pickup,id:'double-refresh'}});
 const runtime=start(d);
 const world=()=>runtime.observe().state.world;
 try{
  runtime.step();
  assert.equal(world().nextId,1);
  assert.equal(world().doubleShotUntil,4);
  runtime.pause();runtime.step(90);assert.equal(runtime.observe().tickIndex,1);runtime.resume();
  runtime.step();
  assert.deepEqual(world().bodies.filter(b=>b.id==='shot_1'||b.id==='shot_2').map(b=>b.x),[actor.x-150,actor.x+150]);
  runtime.step();
  assert.equal(world().doubleShotUntil,6);
  runtime.step(3);
  assert.equal(world().nextId,11);
  runtime.step();
  assert.equal(world().nextId,12);
  runtime.restart();
  assert.equal(world().doubleShotUntil,0);
  assert.equal(world().nextId,0);
  assert.equal(world().bombs,1);
 }finally{runtime.dispose();}
});

test('platform landing reports its actual support, stops drift and resets combo off center',()=>{
 const r=start(game('g11-candidate'));
 try{
  r.step();r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'}});r.step(4);
  r.injectRaw({source:'keyboard',kind:'up',payload:{code:'Space'}});
  let landed;
  for(let i=0;i<60;i++){r.step();landed??=r.observe().events.find(e=>e.type==='realtime.landed'&&e.payload.surface==='platform_b');}
  assert.ok(landed);assert.ok(Math.abs(landed.payload.centerOffset)<=100);assert.equal(r.observe().state.jump.combo,1);
  const snap=r.snapshot(),at=r.observe().state.world.bodies.find(b=>b.id==='hero').x;r.step(10);assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').x,at);r.restore(snap);
  press(r,'charge');r.step(60);assert.equal(r.observe().flow.status,'won');assert.equal(r.observe().state.jump.combo,0);assert.equal(r.observe().state.jump.bestCombo,1);assert.equal(r.observe().state.jump.score,3);
  assert.throws(()=>r.injectAction({action:'charge',phase:'press'}),e=>e.code==='A2G_E_FLOW');
 }finally{r.dispose();}
 const bad=game('g11-candidate');bad.scenes[0].entities[0].components[0].config.platformLanding=1;assert.throws(()=>start(bad));
});

test('fixed-tick integer motion, pause/snapshot replay, constraints and pure body projection',()=>{
 const d=game('realtime-jump'),r=start(d);r.step();press(r,'jump');assert.equal(r.observe().state.world.bodies[0].vy,76);
 const snap=r.snapshot();r.step(12);const expected=r.observe();r.restore(snap);r.step(12);assert.equal(r.observe().exactHash,expected.exactHash);
 r.restore(snap);r.pause();r.step(12);assert.equal(r.observe().tickIndex,snap.tickIndex);r.resume();r.step(12);assert.deepEqual(r.observe().state,expected.state);
 const hash=r.observe().exactHash,frame=projectPresentation(d,r.observe());assert.ok(frame.commands.some(c=>c.id==='body:hero'));assert.equal(r.observe().exactHash,hash);r.dispose();
 const constrained=start(game('realtime-constraint'));constrained.step(20);assert.ok(constrained.observe().state.world.bodies[0].x<=2000);constrained.dispose();
});

test('optional body value sizes are bounded, preserve old projection and never alter H01 state',()=>{
 for(const name of ['h01-candidate','h01-reward-upgrade']){
  const current=game(name),legacy=structuredClone(current),layer=legacy.presentation.scene2d.bodyLayer;delete layer.minValueFontSize;delete layer.minValueBodySize;legacy.revision--;
  const r=start(current),old=start(legacy);
  try{
   press(r,'place0');press(old,'place0');const observed=r.observe();assert.equal(observed.exactHash,old.observe().exactHash);
   const frame=projectPresentation(current,observed),oldFrame=projectPresentation(legacy,old.observe()),label=frame.commands.find(c=>c.id.startsWith('body-label:'));
   assert.ok(label);assert.equal(label.fontSize,0.6);assert.ok(oldFrame.commands.find(c=>c.id===label.id).fontSize<0.6);
   const body=frame.commands.find(c=>c.id===label.id.replace('body-label:','body:'));assert.equal(body.kind,'circle');assert.ok(body.radius>=0.4);
   const zero=structuredClone(observed);zero.state.defense.bodies[0].value=0;const id='body:'+zero.state.defense.bodies[0].id;
   assert.deepEqual(projectPresentation(current,zero).commands.find(c=>c.id===id),projectPresentation(legacy,zero).commands.find(c=>c.id===id));
   assert.equal(r.observe().exactHash,observed.exactHash);
  }finally{r.dispose();old.dispose();}
 }
 const definition=game('h01-candidate');
 for(const [key,value] of [['minValueFontSize',0],['minValueBodySize',2.1],['showValues',false]]){const bad=structuredClone(definition);bad.presentation.scene2d.bodyLayer[key]=value;assert.throws(()=>start(bad),e=>e.code==='A2G_E_PRESENTATION');}
 const noCapability=structuredClone(definition);noCapability.requires.all=noCapability.requires.all.filter(ref=>ref.id!=='a2game.visual.body-style');assert.throws(()=>start(noCapability),e=>e.code==='A2G_E_CAP_DEPENDENCY');
});
test('contacts and damage deduplicate across substeps; pool saturation never overwrites; T5 rollback is atomic',()=>{
 const d=game('realtime-projectile'),r=start(d);press(r,'fire');assert.equal(r.observe().state.world.score,1);assert.equal(r.observe().events.filter(e=>e.type==='combat.hit').length,1);assert.equal(r.observe().events.filter(e=>e.type==='combat.death').length,1);r.dispose();
 const saturated=game('realtime-projectile');saturated.scenes[0].entities[0].components[0].config.maxObjects=2;const full=start(saturated);press(full,'fire');assert.equal(full.observe().state.world.nextId,0);assert.equal(full.observe().state.world.score,0);assert.equal(full.observe().events.filter(e=>e.type==='realtime.pool-full').length,1);full.dispose();
 const bad=game('realtime-jump');bad.requires.all.push({id:'a2game.rules.state-add',version:'0.1.0'});bad.state.guard={type:'int',initial:0,constraints:{max:0}};
 bad.rules=[{id:'rollback',on:{type:'realtime.landed'},do:[{op:'state.add',path:'/guard',value:1}]}];
 const transactional=start(bad),before=structuredClone(transactional.observe().state.world);
 assert.throws(()=>transactional.step(),error=>error.code==='A2G_E_TICK_COMMIT');assert.deepEqual(transactional.observe().state.world,before);assert.equal(transactional.observe().tickIndex,0);transactional.dispose();
 const invalid=game('realtime-jump');invalid.state.world.initial.bodies[0].vx=129;assert.throws(()=>start(invalid));
});

test('top-down movement is independent from aim/fire; release and cancel stop their own axis',()=>{
 const d=game('g18-candidate'),r=start(d);
 try{
  r.injectRaw({source:'keyboard',kind:'down',payload:{code:'KeyA'}});r.injectRaw({source:'keyboard',kind:'down',payload:{code:'KeyW'}});r.step(5);
  let hero=r.observe().state.world.bodies.find(b=>b.id==='hero');assert.equal(hero.x,3680);assert.equal(hero.y,2320);
  r.injectRaw({source:'keyboard',kind:'up',payload:{code:'KeyA'}});r.injectRaw({source:'keyboard',kind:'cancel',payload:{code:'KeyW'}});r.step(2);
  hero=r.observe().state.world.bodies.find(b=>b.id==='hero');assert.equal(hero.x,3680);assert.equal(hero.y,2320);assert.equal(hero.vx,0);assert.equal(hero.vy,0);
  r.injectAction({action:'aim',phase:'press',value:[0.5,0.3125]});r.injectAction({action:'aim',phase:'release'});r.step();
  press(r,'fire');assert.equal(r.observe().flow.status,'playing');assert.equal(r.observe().state.world.score,0);
  r.injectRaw({source:'keyboard',kind:'down',payload:{code:'KeyA'}});r.step(8);r.injectRaw({source:'keyboard',kind:'up',payload:{code:'KeyA'}});r.step();
  r.injectRaw({source:'keyboard',kind:'down',payload:{code:'KeyW'}});r.step(25);r.injectRaw({source:'keyboard',kind:'up',payload:{code:'KeyW'}});r.step();
  r.injectAction({action:'aim',phase:'press',value:[0.5,0.3125]});r.injectAction({action:'aim',phase:'release'});r.step();press(r,'fire');assert.equal(r.observe().flow.status,'won');assert.equal(r.observe().state.world.score,1);
  r.restart();r.injectRaw({source:'keyboard',kind:'down',payload:{code:'KeyS'}});r.step(100);hero=r.observe().state.world.bodies.find(b=>b.id==='hero');assert.equal(hero.y,hero.hy);
  r.pause();r.resume();r.step();assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').vy,0);
  r.restart();r.injectAction({action:'moveRight',phase:'press',sourceId:'ui-hold:moveRight:1'});r.step(5);assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').x,4320);
  r.injectAction({action:'moveRight',phase:'cancel',sourceId:'ui-hold:moveRight:1'});r.step(2);assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').x,4320);
 }finally{r.dispose();}
});

test('cancelling charge clears accumulated power without launching a jump',()=>{
 const r=start(game('g11-candidate'));
 try{r.step();r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'}});r.step(5);assert.equal(r.observe().state.world.charge,5);
  r.injectRaw({source:'keyboard',kind:'cancel',payload:{code:'Space'}});r.step();const w=r.observe().state.world;
  assert.equal(w.charge,0);assert.equal(w.bodies.find(b=>b.id==='hero').vx,0);assert.ok(w.bodies.find(b=>b.id==='hero').y<=1100);
  r.restart();r.step();r.injectAction({action:'charge',phase:'press',sourceId:'ui-hold:charge:1'});r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'}});r.step(3);assert.equal(r.observe().state.world.charge,3);
  r.injectAction({action:'charge',phase:'cancel',sourceId:'ui-hold:charge:1'});r.step();assert.equal(r.observe().state.world.charge,4);
  r.injectRaw({source:'keyboard',kind:'cancel',payload:{code:'Space'}});r.step();assert.equal(r.observe().state.world.charge,0);
 }finally{r.dispose();}
});

test('fixed lanes clamp indices and reject invalid layouts; runner projectiles hit/block and all temporary bodies recycle',()=>{
 const d=game('g13-candidate'),r=start(d);
 try{
  for(let i=0;i<3;i++)press(r,'left');assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').x,2000);
  for(let i=0;i<4;i++)press(r,'right');assert.equal(r.observe().state.world.bodies.find(b=>b.id==='hero').x,6000);
 }finally{r.dispose();}
 for(const centers of [[2000,2000,6000],[6000,4000,2000],[16,4000,6000],[2000,6000]]){
  const bad=structuredClone(d);bad.scenes[0].entities[0].components[0].config.laneCenters=centers;assert.throws(()=>start(bad));
 }
 const mixed=structuredClone(d);mixed.scenes[0].entities[0].components[0].config.heldMovement=true;assert.throws(()=>start(mixed));
 const oversized=game('h03-candidate');oversized.scenes[0].entities[0].components[0].config.projectileHalfSize=129;assert.throws(()=>start(oversized));
 const shooter=start(game('h03-candidate'));
 try{
  shooter.injectRaw({source:'pointer',kind:'down',payload:{pointerId:1,u:0.15,v:0.5,viewportAspect:1.25}});
  shooter.injectRaw({source:'pointer',kind:'down',payload:{pointerId:2,u:0.85,v:0.5,viewportAspect:1.25}});shooter.step();
  assert.equal(shooter.observe().state.world.nextId,0);assert.equal(shooter.observe().state.control.fireRequest,true);
  shooter.step();assert.equal(shooter.observe().state.world.bodies.find(b=>b.kind==='projectile').hx,64);
  shooter.step(108);assert.equal(shooter.observe().state.runner.kills,1);assert.equal(shooter.observe().state.runner.checkpoints,1);
  const atCheckpoint=shooter.observe();shooter.pause();shooter.step(5000);
  assert.equal(shooter.observe().tickIndex,atCheckpoint.tickIndex);assert.deepEqual(shooter.observe().state,atCheckpoint.state);shooter.resume();
  for(const action of ['right','fire']){shooter.injectAction({action,phase:'press'});shooter.injectAction({action,phase:'release'});}
  shooter.step(40);let w=shooter.observe().state.world;assert.equal(w.nextId,2);assert.ok(w.bodies.some(b=>b.id==='obstacle_c'));assert.equal(w.bodies.some(b=>b.kind==='projectile'),false);
  shooter.step(40);press(shooter,'right');shooter.step(69);w=shooter.observe().state.world;
  assert.equal(shooter.observe().flow.status,'won');assert.equal(shooter.observe().state.runner.checkpoints,2);assert.deepEqual(w.spawned,[0,1,2,3]);assert.deepEqual(w.bodies.map(b=>b.id),['hero']);
 }finally{shooter.dispose();}
});
