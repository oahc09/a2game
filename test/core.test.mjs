import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { HeadlessRuntime, GameRng, A2GameError, compileGame, CapabilityRegistry, addReferenceRuleOps, runConformanceSuite } from '../dist/index.js';
import {makeRegistry, spec, readJson} from '../scripts/registry.mjs';
const clone = value => structuredClone(value);
const sample = () => readJson(resolve(spec,'games/tap-target.game.json'));
const CAP='a2game.rules.';
const additional = {
  'state.set':'state-set','state.clamp':'state-clamp','entity.state.set':'entity-state-set','entity.spawn':'entity-spawn',
  'entity.despawn':'entity-despawn','event.emit':'event-emit','feedback.emit':'feedback-emit','flow.pause':'flow-pause','timer.schedule':'timer-schedule'
};
function addOps(game,...ops) {
  for(const op of ops) {
    const id = CAP + additional[op];
    assert.ok(id && !id.endsWith('undefined'),`Unknown fixture op ${op}`);
    if(!game.requires.all.some(x=>x.id===id)) game.requires.all.push({id,version:'0.1.0'});
  }
  return game;
}
function rule(id,on,actions,priority=0,condition) {
  return {id,priority,on,...(condition?{if:condition}:{}),do:actions};
}
const press=rt=>{rt.injectAction({action:'collect',phase:'press'});rt.injectAction({action:'collect',phase:'release'});};
function errCode(fn, code) {
  assert.throws(fn,e=>e instanceof A2GameError && e.code===code,`expected ${code}`);
}

test('RNG golden vectors preserve both uint32 state and sequence',()=>{
  const {vectors} = readJson(resolve(spec,'tests/rng-vectors.json'));
  for(const {seed,initialState,firstU32} of vectors) {
    const rng = new GameRng(seed);
    assert.deepEqual(rng.state(), initialState);
    assert.deepEqual(Array.from({length:6},()=>rng.nextU32()),firstU32);
  }
});
test('RNG state restore and bounded unbiased sampling API',()=>{
  const rng = new GameRng(42), saved=rng.state();
  const draws=Array.from({length:100},()=>rng.randomInt(1,6));
  assert.ok(draws.every(n=>n>=1&&n<=6));
  rng.restore(saved);
  assert.deepEqual(draws,Array.from({length:100},()=>rng.randomInt(1,6)));
  errCode(()=>rng.randomInt(0,2**32),'A2G_E_RNG_RANGE');
});

test('original supplied conformance suites execute without modifying fixtures', async()=>{
  for(const name of ['tap-target.conformance.json','runtime-order.conformance.json']) {
    const suite=readJson(resolve(spec,'tests',name));
    const receipt=await runConformanceSuite(suite,sample(),makeRegistry);
    assert.equal(receipt.status,'PASS',JSON.stringify(receipt));
    assert.ok(receipt.cases.every(c=>c.status==='PASS'));
    assert.equal(receipt.gates.G2,'NOT_RUN');
  }
});

test('all seven original negative fixtures produce expected error codes',()=>{
  const cases=readJson(resolve(spec,'tests/negative-fixtures.json')).cases;
  const mutations={
    'unsupported-protocol':g=>{g.specVersion='2.0.0'},
    'unknown-root':g=>{g.nonExistingField=1},
    'missing-scene':g=>{g.entryScene='does-not-exist'},
    'unknown-capability':g=>{g.requires.all.push({id:'a2game.foo.bar',version:'0.1.0'})},
    'illegal-rule-op':g=>{g.rules[0].do[0].op='host.eval'},
    'script-url':g=>{g.assets={bad:{uri:'javascript:alert(1)',type:'image'}}},
    'bad-state-initial':g=>{g.state.score.initial='not-an-int'},
  };
  for(const {case:name,expectedCode} of cases) {
    const g=sample();mutations[name](g);
    errCode(()=>new HeadlessRuntime(g,makeRegistry()),expectedCode);
  }
});

test('input action, rule, scene and entity IDs reject invalid references / duplicates',()=>{
  let g=sample();g.inputs.actions[0].id='other';errCode(()=>compileGame(g,makeRegistry()),'A2G_E_INPUT_ACTION');
  g=sample();g.rules.push(clone(g.rules[0]));errCode(()=>compileGame(g,makeRegistry()),'A2G_E_DUPLICATE_ID');
  g=sample();g.scenes.push(clone(g.scenes[0]));errCode(()=>compileGame(g,makeRegistry()),'A2G_E_DUPLICATE_ID');
  g=sample();g.scenes[0].entities=[{id:'a'},{id:'a'}];errCode(()=>compileGame(g,makeRegistry()),'A2G_E_DUPLICATE_ID');
});

test('manifest-only without trusted runtime implementation is rejected',()=>{
  const r=makeRegistry(); const m=r.get({id:'a2game.core.state',version:'0.1.0'});
  m.id='a2game.test.manifest-only'; r.register(m);
  const g=sample();g.requires.all.push({id:m.id,version:m.version});
  errCode(()=>compileGame(g,r),'A2G_E_CAP_NOT_IMPLEMENTED');
});
test('capability dependency closure rejects cycles and unsupported versions',()=>{
  const r=makeRegistry(); const orig=r.get({id:'a2game.core.state',version:'0.1.0'});
  const a={...clone(orig),id:'a2game.test.alpha',dependencies:[{id:'a2game.test.beta',version:'0.1.0'}]};
  const b={...clone(orig),id:'a2game.test.beta',dependencies:[{id:'a2game.test.alpha',version:'0.1.0'}]};
  r.register(a,{role:'builtin'});r.register(b,{role:'builtin'});
  const g=sample();g.requires.all.push({id:a.id,version:'0.1.0'});
  errCode(()=>compileGame(g,r),'A2G_E_CAP_DEPENDENCY');
  const v=sample();v.requires.all[0].version='9.9.9';errCode(()=>compileGame(v,makeRegistry()),'A2G_E_CAP_VERSION');
});

test('same S_sim predicates see pre-commit state and additive effects accumulate',()=>{
  const g=sample();g.rules.push(rule('another-collector',g.rules[0].on,[{op:'state.add',path:'/score',value:1}],0,g.rules[0].if));
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();
  assert.equal(rt.observe().state.score,2);
  assert.equal(rt.status,'won');
});

test('rule conflict ordering is eventIndex, priority ascending, ID ascending, effect index',()=>{
  const g=addOps(sample(),'state.set');g.state.goal.initial=100;
  g.rules=[
    rule('b-set',{type:'input.action',action:'collect',edge:'press'},[{op:'state.set',path:'/score',value:10}],1),
    rule('a-add',{type:'input.action',action:'collect',edge:'press'},[{op:'state.add',path:'/score',value:1}],0),
  ];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);press(rt);rt.step();
  assert.equal(rt.observe().state.score,10);
  assert.deepEqual(rt.observe().events.map(x=>x.edge),['press','release','press','release']);
});

test('event.emit queues next tick without recursive same-tick effects',()=>{
  const g=addOps(sample(),'event.emit');g.state.goal.initial=99;
  g.rules=[rule('ping',{type:'input.action',action:'collect',edge:'press'},[{op:'event.emit',eventType:'custom.pong',payload:{x:1}}]),
           rule('score',{type:'custom.pong'},[{op:'state.add',path:'/score',value:2}])];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();
  assert.equal(rt.observe().state.score,0);
  assert.equal(rt.observe().events.filter(x=>x.type==='custom.pong').length,0);
  rt.step();assert.equal(rt.observe().state.score,2);
  assert.equal(rt.observe().events.find(x=>x.type==='custom.pong').tickIndex,1);
});

test('cross-tick deferred event loop fails with bounded error, without partial commit',()=>{
  const g=addOps(sample(),'event.emit');g.state.goal.initial=99;
  g.rules=[rule('start',{type:'input.action',action:'collect',edge:'press'},[{op:'event.emit',eventType:'A'}]),
           rule('loop-a',{type:'A'},[{op:'event.emit',eventType:'B'}]),
           rule('loop-b',{type:'B'},[{op:'event.emit',eventType:'A'}])];
  const rt=new HeadlessRuntime(g,makeRegistry(),{maxDeferredPerSession:2});rt.start();press(rt);rt.step();rt.step();
  errCode(()=>rt.step(),'A2G_E_TICK_COMMIT');
  assert.equal(rt.observe().tickIndex,2);
  assert.equal(rt.observe().flow.status,'error');
});

test('timer schedules integer-tick delay; paused time does not drain it',()=>{
  const g=addOps(sample(),'timer.schedule');g.state.goal.initial=99;
  g.rules=[rule('clock',{type:'input.action',action:'collect',edge:'press'},[{op:'timer.schedule',id:'reward',delayTicks:2,eventType:'reward.elapsed'}]),
           rule('reward',{type:'reward.elapsed'},[{op:'state.add',path:'/score',value:1}])];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();
  assert.equal(rt.observe().state.score,0);
  rt.pause();assert.equal(rt.step(100).advanced,0);rt.resume();
  rt.step();assert.equal(rt.observe().state.score,0);
  rt.step();assert.equal(rt.observe().state.score,1);
  assert.equal(rt.observe().events.find(x=>x.type==='reward.elapsed').tickIndex,2);
});

test('repeating timers use stable dueTick increments, not host wall clock',()=>{
  const g=addOps(sample(),'timer.schedule');g.state.goal.initial=99;
  g.rules=[rule('clock',{type:'input.action',action:'collect',edge:'press'},[{op:'timer.schedule',id:'pulse',delayTicks:1,periodTicks:2,eventType:'timer.pulse'}]),
           rule('reward',{type:'timer.pulse'},[{op:'state.add',path:'/score',value:1}])];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step(6);
  assert.equal(rt.observe().state.score,3); // due at t=1,3,5
});

test('snapshot and restore reproduce pending timer, deferred queue and RNG state',()=>{
  const g=addOps(sample(),'event.emit','timer.schedule');g.state.goal.initial=99;
  g.rules=[rule('start',{type:'input.action',action:'collect',edge:'press'},[
    {op:'event.emit',eventType:'queued'}, {op:'timer.schedule',id:'t',delayTicks:2,eventType:'timer.finished'}]),
    rule('on-queued',{type:'queued'},[{op:'state.add',path:'/score',value:1}]),
    rule('on-timer',{type:'timer.finished'},[{op:'state.add',path:'/score',value:1}])];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();
  const snapshot=rt.snapshot();const roll=rt.debugRng();rt.step(2);const original=rt.observe();
  rt.restore(snapshot);assert.equal(rt.debugRng(),roll);rt.step(2);
  assert.deepEqual(rt.observe(),original);
});

test('invalid effect rolls back all prior effects and marks error',()=>{
  const g=sample();g.state.goal.initial=99;g.state.score.constraints={max:2};
  g.rules[0].do=[{op:'state.add',path:'/score',value:1},{op:'state.add',path:'/score',value:2}];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);
  errCode(()=>rt.step(),'A2G_E_TICK_COMMIT');
  assert.equal(rt.observe().state.score,0);
  assert.equal(rt.observe().tickIndex,0);
  assert.equal(rt.observe().flow.status,'error');
  assert.equal(rt.observe().diagnostics[0].code,'A2G_E_TICK_COMMIT');
});

test('simultaneous winning and losing outcomes use ascending priority then UTF-8 ID',()=>{
  const g=sample();g.outcomes.push({id:'failure',status:'lost',priority:-1,when:clone(g.outcomes[0].when)});
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();press(rt);rt.step();
  assert.equal(rt.status,'lost');
  assert.equal(rt.observe().events.filter(x=>x.type==='game.lost').length,1);
  assert.equal(rt.step(10).advanced,0);
});

test('spawn ID is deterministic and spawn/despawn notifications are deferred',()=>{
  const g=addOps(sample(),'entity.spawn','entity.despawn');g.state.goal.initial=99;
  g.prototypes={orb:{id:'orb',state:{hp:1},tags:['collectible']}};
  g.rules=[rule('spawn',{type:'input.action',action:'collect',edge:'press'},[{op:'entity.spawn',prototype:'orb'}]),
    rule('despawn',{type:'entity.spawned'},[{op:'entity.despawn',entity:'spawn:orb:0:0'},{op:'entity.despawn',entity:'spawn:orb:0:0'}]),
    rule('destroyed',{type:'entity.despawned'},[{op:'state.add',path:'/score',value:1}])];
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();press(rt);rt.step();
  assert.ok(rt.observe().entities['spawn:orb:0:0']);
  rt.step();assert.equal(rt.observe().entities['spawn:orb:0:0'],undefined);
  rt.step();assert.equal(rt.observe().state.score,1);
  assert.equal(rt.observe().events.filter(e=>e.type==='entity.despawned').length,1);
});

test('module simulation proposals occur before rule snapshot; configured module is trusted',()=>{
  const r=makeRegistry();const template=r.get({id:'a2game.core.state',version:'0.1.0'});
  const m={...template,id:'a2game.test.pulse',kind:'behavior',phase:'simulate',contract:{...template.contract,
    configSchema:{type:'object',properties:{amount:{type:'integer',minimum:1}},required:['amount'],additionalProperties:false},
    commands:[],events:[{name:'module.pulse',payloadSchema:{type:'object'}}]}};
  r.register(m,{role:'module',simulate:ctx=>({proposals:[{kind:'state.add',path:'/score',value:ctx.config.amount}],events:[{type:'module.pulse'}]})});
  const g=sample();g.requires.all.push({id:m.id,version:m.version});g.state.goal.initial=99;
  g.scenes[0].entities=[{id:'mod',components:[{capability:{id:m.id,version:m.version},config:{amount:2}}]}];
  g.rules=[rule('from-module',{type:'module.pulse'},[{op:'state.add',path:'/score',value:3}])];
  const rt=new HeadlessRuntime(g,r);rt.start();rt.step();
  assert.equal(rt.observe().state.score,5);
});

test('module config rejects unknown options and invalid numeric constraints',()=>{
  const r=makeRegistry();const template=r.get({id:'a2game.core.state',version:'0.1.0'});
  const m={...template,id:'a2game.test.module',kind:'behavior',phase:'simulate',contract:{...template.contract,
    configSchema:{type:'object',properties:{amount:{type:'integer',minimum:1}},required:['amount'],additionalProperties:false}}};
  r.register(m,{role:'module',simulate:()=>({})});
  const g=sample();g.requires.all.push({id:m.id,version:m.version});
  g.scenes[0].entities=[{id:'mod',components:[{capability:{id:m.id,version:m.version},config:{amount:0}}]}];
  errCode(()=>new HeadlessRuntime(g,r),'A2G_E_CAP_CONFIG');
});

test('action OR source semantics, no duplicate press, no synthetic release',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  rt.injectAction({action:'collect',phase:'press',sourceId:'keyboard:Space'});
  rt.injectAction({action:'collect',phase:'press',sourceId:'touch:7'});
  rt.injectAction({action:'collect',phase:'release',sourceId:'touch:7'});
  rt.injectAction({action:'collect',phase:'release',sourceId:'keyboard:Space'});
  rt.step();assert.equal(rt.observe().state.score,1);
  assert.deepEqual(rt.observe().events.filter(x=>x.type==='input.action').map(x=>x.edge),['press','release']);
});

test('raw touch down/up recognizes a tap; cancel does not trigger successful action',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  rt.injectRaw({source:'pointer',kind:'down',seq:0,timeUs:1000,payload:{pointerId:7,u:0.2,v:0.3,pointerType:'touch',pressure:null}});
  rt.injectRaw({source:'pointer',kind:'up',seq:1,timeUs:4000,payload:{pointerId:7,u:0.2,v:0.3,pointerType:'touch',pressure:null}});
  rt.injectRaw({source:'pointer',kind:'down',seq:2,timeUs:5000,payload:{pointerId:8,u:0.4,v:0.3,pointerType:'touch'}});
  rt.injectRaw({source:'pointer',kind:'cancel',seq:3,timeUs:7000,payload:{pointerId:8,u:0.4,v:0.3,pointerType:'touch'}});
  rt.step();assert.equal(rt.observe().state.score,1);
});

test('two touch points can each independently produce a tap',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  for(const [seq,id,kind] of [[0,7,'down'],[1,8,'down'],[2,7,'up'],[3,8,'up']])
    rt.injectRaw({source:'pointer',kind,seq,tickIndex:0,timeUs:1000+seq*1000,payload:{pointerId:id,u:0.4,v:0.5,pointerType:'touch'}});
  rt.step();assert.equal(rt.observe().state.score,2);
  assert.equal(rt.status,'won');
});

test('raw InputTrace tick-boundary mapping uses half-open interval',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  for(const [seq,kind] of [[0,'down'],[1,'up']])
    rt.injectRaw({source:'pointer',kind,seq,timeUs:16667+seq*10,payload:{pointerId:1,u:0.2,v:0.5,pointerType:'touch'}});
  rt.step();assert.equal(rt.observe().state.score,0);
  rt.step();assert.equal(rt.observe().state.score,1);
});

test('normalized IMU sample is validated and does not falsely claim tilt recognition',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  const trace=readJson(resolve(spec,'examples/input-traces/touch-imu.input-trace.json'));
  for(const sample of trace.events) rt.injectRaw({...sample,payload:clone(sample.payload)});
  rt.step(2);
  assert.equal(rt.observe().state.score,1);
  assert.equal(rt.observe().events.filter(x=>x.type==='imu.tilt').length,0);
});

test('budget exhaustion is a controlled failure with no gameplay state commit',()=>{
  const g=sample();g.state.goal.initial=99;g.rules[0].do.push({op:'state.add',path:'/score',value:1});
  const rt=new HeadlessRuntime(g,makeRegistry(),{maxEffectsPerTick:1});rt.start();press(rt);
  errCode(()=>rt.step(),'A2G_E_BUDGET_EXCEEDED');
  assert.equal(rt.observe().state.score,0);
  assert.equal(rt.observe().flow.status,'error');
});

test('snapshots, observations and compiled game do not leak mutable references',()=>{
  const original=sample(),rt=new HeadlessRuntime(original,makeRegistry());
  original.state.goal.initial=100;
  assert.equal(rt.observe().state.goal,2);
  const obs=rt.observe();obs.state.goal=50;assert.equal(rt.observe().state.goal,2);
  const snap=rt.snapshot();snap.state.score=999;assert.equal(rt.observe().state.score,0);
  rt.dispose();rt.dispose();errCode(()=>rt.start(),'A2G_E_DISPOSED');
});

test('new grid-merge fixture suites run through public Conformance runner',async()=>{
  for(const [name,gameName] of [['grid-merge.conformance.json','grid-merge.game.json'],['grid-merge-spawn.conformance.json','grid-merge-spawn.game.json']]) {
    const suite=readJson(resolve(spec,'tests',name));
    const receipt=await runConformanceSuite(suite,readJson(resolve(spec,'games',gameName)),makeRegistry);
    assert.equal(receipt.status,'PASS',JSON.stringify(receipt));
  }
});

test('grid-slide-merge handles single-step 2+2+2+2 without double merging',()=>{
  const g=readJson(resolve(spec,'games/grid-merge.game.json'));
  const rt=new HeadlessRuntime(g,makeRegistry());rt.start();
  rt.injectAction({action:'moveLeft',phase:'press'});
  rt.injectAction({action:'moveLeft',phase:'release'});rt.step();
  assert.deepEqual(rt.observe().state.board.slice(0,4),[4,4,0,0]);
  assert.equal(rt.observe().state.best,4);
});

test('spawned entities participate in trusted module simulation on following tick',()=>{
  const r=makeRegistry();const template=r.get({id:'a2game.core.state',version:'0.1.0'});
  const m={...template,id:'a2game.test.spawn-module',kind:'behavior',phase:'simulate'};
  r.register(m,{role:'module',simulate:()=>({proposals:[{kind:'state.add',path:'/score',value:1}]})});
  const g=addOps(sample(),'entity.spawn');g.state.goal.initial=99;
  g.requires.all.push({id:m.id,version:m.version});
  g.prototypes={orb:{id:'orb',components:[{capability:{id:m.id,version:m.version},config:{}}]}};
  g.rules=[rule('spawn',{type:'input.action',action:'collect',edge:'press'},[{op:'entity.spawn',prototype:'orb'}])];
  const rt=new HeadlessRuntime(g,r);rt.start();press(rt);rt.step();
  assert.equal(rt.observe().state.score,0);
  rt.step();assert.equal(rt.observe().state.score,1);
  rt.step();assert.equal(rt.observe().state.score,2);
});

test('RNG consumed by a failing module is rolled back with tick state',()=>{
  const r=makeRegistry();const template=r.get({id:'a2game.core.state',version:'0.1.0'});
  const m={...template,id:'a2game.test.rng-module',kind:'behavior',phase:'simulate'};
  r.register(m,{role:'module',simulate:ctx=>({proposals:[{kind:'state.set',path:'/score',value:'bad-type'}],events:[{type:'rolled'}],
    ignore:ctx.rng.nextU32()})});
  const g=sample();g.requires.all.push({id:m.id,version:m.version});g.scenes[0].entities=[{id:'e',components:[{capability:{id:m.id,version:m.version},config:{}}]}];
  const rt=new HeadlessRuntime(g,r);rt.start();const initial=rt.snapshot().rng;
  errCode(()=>rt.step(),'A2G_E_STATE_TYPE');
  assert.deepEqual(rt.snapshot().rng,initial);
  assert.equal(rt.observe().state.score,0);
});

test('Conformance expectError must reject when next operation succeeds',async()=>{
  const g=sample();const suite={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'expect-error-negative',
    subject:{type:'game',id:g.id,file:'../games/tap-target.game.json'},
    cases:[{id:'expected-but-not-raised',steps:[{op:'start'},{op:'expectError',code:'A2G_E_ASSERT'},{op:'step',ticks:1}]}]};
  const receipt=await runConformanceSuite(suite,g,makeRegistry);
  assert.equal(receipt.status,'FAIL');
  assert.equal(receipt.cases[0].code,'A2G_E_ASSERT');
});

test('HEADLESS current capability set chooses first available input profile',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());
  assert.deepEqual(rt.effectiveCapabilities.selectedFallbacks,[{id:'a2game.input.touch.tap',version:'0.1.0'}]);
});

test('first-ready falls back to keyboard when touch recognizer is unavailable',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry({disabledIds:['a2game.input.touch.tap']}));
  assert.deepEqual(rt.effectiveCapabilities.selectedFallbacks,[{id:'a2game.input.keyboard.button',version:'0.1.0'}]);
  rt.start();
  rt.injectRaw({source:'keyboard',kind:'down',timeUs:1000,seq:1,payload:{code:'Space'}});
  rt.injectRaw({source:'keyboard',kind:'up',timeUs:2000,seq:2,payload:{code:'Space'}});
  rt.step();assert.equal(rt.observe().state.score,1);
});

test('raw input duplicate down is rejected without publishing gameplay changes',()=>{
  const rt=new HeadlessRuntime(sample(),makeRegistry());rt.start();
  const down=(seq)=>({source:'pointer',kind:'down',tickIndex:0,timeUs:seq*1000,seq,payload:{pointerId:5,u:0.5,v:0.5}});
  rt.injectRaw(down(0));rt.injectRaw(down(1));
  errCode(()=>rt.step(),'A2G_E_INPUT_RAW');
  assert.equal(rt.observe().tickIndex,0);
  assert.equal(rt.observe().state.score,0);
});

test('max recorded events also uses explicit controlled error path',()=>{
  const g=sample();g.state.goal.initial=99;
  const rt=new HeadlessRuntime(g,makeRegistry(),{maxRecordedEvents:1});rt.start();press(rt);
  errCode(()=>rt.step(),'A2G_E_BUDGET_EXCEEDED');
  assert.equal(rt.observe().state.score,0);
  assert.equal(rt.observe().tickIndex,0);
});

test('recent observation preserves the committed event history and a failed Tick appends nothing',()=>{
  const g=sample();g.state.goal.initial=99;
  const rt=new HeadlessRuntime(g,makeRegistry(),{maxRecordedEvents:2});
  try {
    rt.start();press(rt);rt.step();
    const committed=rt.observe();
    assert.equal(committed.events.length,2);
    const recent=rt.observe({recentEvents:1});
    assert.deepEqual(recent.events,committed.events.slice(-1));
    assert.equal(recent.exactHash,committed.exactHash);
    recent.events[0].payload.action='mutated';
    assert.deepEqual(rt.observe({recentEvents:0}).events,[]);
    press(rt);
    errCode(()=>rt.step(),'A2G_E_BUDGET_EXCEEDED');
    assert.deepEqual(rt.observe().events,committed.events);
    assert.deepEqual(rt.snapshot().events,committed.events);
    assert.equal(rt.tickIndex,1);
  }finally{rt.dispose();}
});

test('grid slide-merge property: tile mass conserved without spawning across 4 directions',()=>{
  const game=readJson(resolve(spec,'games/grid-merge.game.json'));
  const generator=new GameRng(20261024);
  for(let caseNo=0;caseNo<48;caseNo++) {
    const initial=Array.from({length:16},()=>[0,2,4,8][generator.randomInt(0,3)]);
    for(const direction of ['Left','Right','Up','Down']) {
      const g=clone(game);
      g.state.board.initial=initial;
      g.state.best.initial=Math.max(...initial);
      g.state.goal.initial=1024;
      const rt=new HeadlessRuntime(g,makeRegistry());rt.start();
      rt.injectAction({action:'move'+direction,phase:'press'});
      rt.injectAction({action:'move'+direction,phase:'release'});
      rt.step();
      const after=rt.observe().state.board;
      assert.equal(after.reduce((a,b)=>a+b,0),initial.reduce((a,b)=>a+b,0),`mass ${caseNo}/${direction}`);
      assert.equal(after.length,16);
      assert.ok(after.every(x=>Number.isSafeInteger(x)&&x>=0));
      rt.dispose();
    }
  }
});
