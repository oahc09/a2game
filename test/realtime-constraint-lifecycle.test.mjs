// Synthetic definitions only. No host experiment games, author outputs or solutions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime} from '../dist/index.js';
import {validateIntegerWorld,simulateIntegerWorld} from '../dist/modules/realtime.js';
import {makeRegistry} from '../scripts/registry.mjs';
const ref=id=>({id,version:'0.1.0'}),capError=e=>e.code==='A2G_E_CAP_CONFIG';
const body=(id,kind,team=kind==='actor'?1:2,extra={})=>({id,kind,x:500,y:500,vx:0,vy:0,hx:20,hy:20,hp:1,team,value:0,fixed:true,...extra});
const world=bodies=>({bodies,score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false});
const config=id=>({statePath:'/world',width:1000,height:1000,gravity:0,actions:{},constraints:[{body:id,minX:100,maxX:800,minY:100,maxY:800}]});
function definition(bodies,c=config(bodies[0].id)){
 return {format:'a2game',specVersion:'0.1.0',id:'org.a2game.synthetic.constraint-lifecycle',revision:1,meta:{title:'Synthetic constraint lifetime'},requires:{all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.realtime.world'].map(ref)},world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:7}},assets:{},prototypes:{},scenes:[{id:'main',entities:[{id:'engine',components:[{capability:ref('a2game.realtime.world'),config:c}]}]}],entryScene:'main',state:{world:{type:'object',initial:world(bodies)}},inputs:{actions:[]},rules:[],outcomes:[{id:'lost',status:'lost',when:{state:'/world/lost'}}],presentation:{hud:[],cues:[]}};
}
function runtime(t,g){const r=new HeadlessRuntime(g,makeRegistry());t.after(()=>r.dispose());r.start();return r;}
const state=r=>r.observe().state.world;
const deaths=(r,id)=>r.observe().events.filter(e=>e.type==='combat.death'&&e.payload.id===id);

test('admitted constrained actor contact death commits lost and restarts instead of throwing configuration error',t=>{
 const r=runtime(t,definition([body('actor','actor'),body('enemy','target')]));
 r.step();assert.equal(r.status,'lost');assert.equal(state(r).lost,true);assert.deepEqual(state(r).bodies.map(b=>b.id),['enemy']);assert.equal(deaths(r,'actor').length,1);
 r.restart();assert.equal(r.status,'playing');assert.equal(r.tickIndex,0);assert.equal(state(r).bodies.length,2);r.step();assert.equal(r.status,'lost');assert.equal(deaths(r,'actor').length,1);
});
test('admitted constrained actor enemy-projectile death commits lost and removes both bodies',t=>{
 const r=runtime(t,definition([body('actor','actor'),body('shot','projectile',2,{value:1})]));r.step();assert.equal(r.status,'lost');assert.deepEqual(state(r).bodies,[]);assert.equal(deaths(r,'actor').length,1);
});
test('nonactor retirement by combat keeps running on subsequent ticks without duplicate reward',t=>{
 const r=runtime(t,definition([body('target','target',2,{value:7}),body('shot','projectile',1,{value:1})]));r.step(3);
 assert.equal(r.status,'playing');assert.equal(state(r).lost,false);assert.deepEqual(state(r).bodies,[]);assert.equal(state(r).score,7);assert.equal(deaths(r,'target').length,1);
});
test('TTL retirement survives next ticks and a same-generation snapshot replay without hidden mutable caches',t=>{
 const r=runtime(t,definition([body('target','target',2,{ttl:1})]));r.step();assert.deepEqual(state(r).bodies,[]);const snapshot=r.snapshot();
 r.step(2);const expected=r.observe();r.restore(snapshot);r.step(2);assert.deepEqual(r.observe(),expected);
 r.restart();assert.equal(state(r).bodies[0].ttl,1);r.step(3);assert.equal(r.status,'playing');assert.deepEqual(state(r).bodies,[]);
});
test('a future wave may reuse a retired live ID and its original constraint applies again',t=>{
 const c=config('target');c.waves=[{tick:2,body:body('target','target',2,{x:950})}];
 const r=runtime(t,definition([body('target','target',2,{ttl:1})],c));r.step(2);assert.deepEqual(state(r).bodies,[]);r.step();assert.equal(state(r).bodies[0].x,780);assert.deepEqual(state(r).spawned,[0]);r.step();assert.equal(state(r).bodies.length,1);assert.equal(r.observe().events.filter(e=>e.type==='realtime.spawned').length,1);
});
test('admission still rejects missing initial or future-only targets and invalid constraint bounds',()=>{
 for(const mutate of [g=>{g.state.world.initial.bodies=[];},g=>{g.scenes[0].entities[0].components[0].config.constraints[0].body='unknown';},g=>{g.scenes[0].entities[0].components[0].config.constraints[0].minX=900;},g=>{g.scenes[0].entities[0].components[0].config.constraints[0].maxY=1001;}]){
  const g=definition([body('target','target')]);g.scenes[0].entities[0].components[0].config.waves=[{tick:2,body:body('unknown','target')}];mutate(g);assert.throws(()=>new HeadlessRuntime(g,makeRegistry()),capError);
 }
});
test('unbound module contexts stay strict at every tick and JSON-shaped provenance grants no authority',()=>{
 const w=world([]),c=config('missing');assert.throws(()=>validateIntegerWorld(w,c),capError);
 for(const tickIndex of [0,1,99])for(const binding of [undefined,[],{targets:['missing']},{statePath:'/world',allowedConstraintTargets:['missing']}]){
  const ctx={config:c,world:{state:{world:w}},inputs:[],tickIndex,...(binding===undefined?{}:{resolveRealtimeConstraintTargets:binding})};assert.throws(()=>simulateIntegerWorld(ctx),capError);
 }
});
test('retired target permission does not waive config identity or bounds after snapshot restore',t=>{
 for(const mutate of [c=>{c.width=1100;},c=>{c.statePath='/other';},c=>{c.constraints[0].body='unknown';},c=>{c.constraints[0].minX=900;},c=>{c.constraints[0].maxY=1001;}]){
  const r=runtime(t,definition([body('target','target',2,{ttl:1})]));r.step();const snapshot=r.snapshot();mutate(snapshot.entities.engine.components[0].config);r.restore(snapshot);assert.throws(()=>r.step(),capError);
 }
});
test('even live-world config mutation cannot acquire declaration provenance merely by remaining numerically valid',t=>{
 const r=runtime(t,definition([body('target','target')]));const snapshot=r.snapshot();snapshot.entities.engine.components[0].config.width=1100;r.restore(snapshot);assert.throws(()=>r.step(),capError);
});
test('per-runtime declaration bindings cannot leak across different definitions',t=>{
 const a=runtime(t,definition([body('first','target',2,{ttl:1})])),b=runtime(t,definition([body('second','target',2,{ttl:1})]));a.step();b.step();assert.deepEqual(state(a).bodies,[]);assert.deepEqual(state(b).bodies,[]);
 // Same-generation snapshots carry no new provenance; B cannot use A's different config.
 b.restore(a.snapshot());assert.throws(()=>b.step(),capError);a.step();assert.equal(a.status,'playing');
});
test('binding is captured after admission, not reread from the publicly exposed mutable plan',t=>{
 const g=definition([body('target','target',2,{ttl:1})]),r=runtime(t,g);g.state.world.initial.bodies=[];r.plan.definition.state.world.initial.bodies=[];r.plan.definition.scenes[0].entities[0].components[0].config.constraints[0].body='changed-after-admission';
 r.step(2);assert.equal(r.status,'playing');assert.deepEqual(state(r).bodies,[]);
});
test('same admitted prototype declaration supports inherited and dynamically spawned instances',t=>{
 const g=definition([body('target','target',2,{ttl:1})]),component=g.scenes[0].entities[0].components[0];
 g.prototypes.worker={components:[component]};g.scenes[0].entities=[{id:'engine',prototype:'worker'}];g.requires.all.push(ref('a2game.rules.entity-spawn'),ref('a2game.input.keyboard.button'));
 g.inputs.actions=[{id:'spawn',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'KeyS'}}]}];g.rules=[{id:'spawn-worker',on:{type:'input.action',action:'spawn',edge:'press'},do:[{op:'entity.spawn',prototype:'worker',id:'second-worker'}]}];
 const r=runtime(t,g);r.step();assert.deepEqual(state(r).bodies,[]);r.injectAction({action:'spawn',phase:'press'});r.step();assert.ok(r.observe().entities['second-worker']);r.step();assert.equal(r.status,'playing');assert.deepEqual(state(r).bodies,[]);
});
test('live-ID collisions remain rejected and ordinary live-body clamp/hash semantics remain unchanged',t=>{
 const c=config('target');c.waves=[{tick:0,body:body('target','target')}];const duplicate=runtime(t,definition([body('target','target')],c));assert.throws(()=>duplicate.step(),capError);
 const bounded=runtime(t,definition([body('actor','actor',1,{x:790,vx:40,fixed:false})]));bounded.step();assert.equal(state(bounded).bodies[0].x,780);
 const constrained=definition([body('target','target')]),plain=structuredClone(constrained);delete plain.scenes[0].entities[0].components[0].config.constraints;
 const a=runtime(t,constrained),b=runtime(t,plain);a.step(3);b.step(3);assert.equal(a.observe().exactHash,b.observe().exactHash);
});
test('actual Runtime resolver is frozen and rejects mismatched config even when called by a trusted module',t=>{
 const registry=makeRegistry(),implementation=registry.implementation.bind(registry);let captured;
 // Local trusted test instrumentation; no JSON can install this JavaScript implementation.
 registry.implementation=ref=>{const impl=implementation(ref);return ref.id==='a2game.realtime.world'?{...impl,simulate(ctx){captured=ctx;return impl.simulate(ctx);}}:impl;};
 const r=new HeadlessRuntime(definition([body('target','target',2,{ttl:1})]),registry);t.after(()=>r.dispose());r.start();r.step();
 const resolver=captured.resolveRealtimeConstraintTargets;assert.equal(typeof resolver,'function');assert.equal(Object.isFrozen(resolver),true);const targets=resolver(captured.config);assert.deepEqual(targets,['target']);assert.equal(Object.isFrozen(targets),true);assert.throws(()=>targets.push('unknown'),TypeError);
 const changed={...captured.config,width:1100};assert.throws(()=>resolver(changed),capError);assert.throws(()=>simulateIntegerWorld({...captured,config:changed}),capError);
 // Membership in the admitted set, not elapsed time or missingness alone, is the permission.
 assert.throws(()=>simulateIntegerWorld({...captured,resolveRealtimeConstraintTargets:()=>['target']}),capError);
});
test('admitted retirement never skips validation of remaining bodies or world bookkeeping',t=>{
 for(const mutate of [w=>{w.score=-1;},w=>{w.contacts=[42];},w=>{w.bodies.push(body('bad','target',2,{hx:0}));}]){
  const r=runtime(t,definition([body('target','target',2,{ttl:1})]));r.step();const snapshot=r.snapshot();mutate(snapshot.state.world);r.restore(snapshot);assert.throws(()=>r.step(),capError);
 }
});
test('definition-authorized removal of an admitted body has the same dormant constraint semantics',t=>{
 const g=definition([body('target','target')]);g.requires.all.push(ref('a2game.rules.state-set'),ref('a2game.input.keyboard.button'));
 g.inputs.actions=[{id:'remove',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'KeyR'}}]}];g.rules=[{id:'remove-body',on:{type:'input.action',action:'remove',edge:'press'},do:[{op:'state.set',path:'/world/bodies',value:{const:[]}}]}];
 const r=runtime(t,g);r.injectAction({action:'remove',phase:'press'});r.step();assert.deepEqual(state(r).bodies,[]);r.step();assert.equal(r.status,'playing');
});
test('strict admission also covers uninstantiated prototypes and non-entry scenes',()=>{
 for(const location of ['prototype','other-scene']){
  const g=definition([body('target','target')]),bad={capability:ref('a2game.realtime.world'),config:config('never-present')};
  if(location==='prototype')g.prototypes.unused={components:[bad]};else g.scenes.push({id:'other',entities:[{id:'unused-engine',components:[bad]}]});
  assert.throws(()=>new HeadlessRuntime(g,makeRegistry()),capError);
 }
});
test('capability version mismatches cannot reuse the admitted resolver binding',t=>{
 const r=runtime(t,definition([body('target','target',2,{ttl:1})]));r.step();const snapshot=r.snapshot();snapshot.entities.engine.components[0].capability.version='9.9.9';r.restore(snapshot);assert.throws(()=>r.step(),e=>e.code==='A2G_E_CAP_VERSION');
});
