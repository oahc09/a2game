import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIntegerWorld,validateRealtimeDefinition,simulateIntegerWorld} from '../dist/modules/realtime.js';

// Synthetic module fixtures only: no experiment games or author solutions.
const body=(id,kind,x=500,y=500)=>({id,kind,x,y,vx:0,vy:0,hx:20,hy:20,hp:1,team:kind==='actor'?1:2,value:0,fixed:false});
function fixture(){
 const world={bodies:[body('anchor','actor',300,300)],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false};
 const config={statePath:'/world',width:1000,height:1000,maxObjects:4,gravity:0,actions:{},constraints:[{body:'anchor',minX:100,maxX:800,minY:100,maxY:800}],waves:[{tick:0,body:body('arrival','target',700,700)}]};
 return {world,config};
}
const definition=({world,config})=>({state:{world:{type:'object',initial:world}},scenes:[{id:'scene',entities:[{id:'engine',components:[{capability:{id:'a2game.realtime.world',version:'0.1.0'},config}]}]}],inputs:{actions:[]}});
const simulate=f=>simulateIntegerWorld({config:f.config,world:{state:{world:f.world}},inputs:[],tickIndex:0});
const state=result=>result.proposals.find(p=>p.path==='/world').value;
const capError=e=>e.code==='A2G_E_CAP_CONFIG';

test('wave admission keeps constraints scoped to the complete initial world',()=>{
 const f=fixture();assert.doesNotThrow(()=>validateIntegerWorld(f.world,f.config));
 assert.doesNotThrow(()=>validateRealtimeDefinition(definition(f)));
 assert.deepEqual(f.world.bodies.map(b=>b.id),['anchor']);
});
test('distinct wave spawns while existing actor constraints remain enforced',()=>{
 const f=fixture();f.world.bodies[0].x=790;f.world.bodies[0].vx=40;
 const result=simulate(f),next=state(result);
 assert.deepEqual(next.bodies.map(b=>b.id),['anchor','arrival']);
 assert.equal(next.bodies.find(b=>b.id==='anchor').x,780);
 assert.deepEqual(next.spawned,[0]);assert.equal(result.events.filter(e=>e.type==='realtime.spawned').length,1);
 assert.equal(f.world.bodies.length,1);assert.equal(f.world.bodies[0].x,790);
});
test('true missing constraint target and invalid constraint bounds remain rejected',()=>{
 for(const edit of [f=>f.config.constraints[0].body='missing',f=>f.config.constraints[0].minX=900,f=>f.config.constraints[0].maxY=1001]){
  const f=fixture();edit(f);
  assert.throws(()=>validateRealtimeDefinition(definition(f)),capError);
  assert.throws(()=>simulate(f),capError);
 }
});
test('invalid incoming body remains rejected at admission and spawn, including full pool',()=>{
 for(const edit of [b=>b.x=0,b=>b.vx=129,b=>b.hx=15,b=>b.ttl=-1,b=>b.hits=[42],b=>b.kind='unknown']){
  for(const full of [false,true]){const f=fixture();edit(f.config.waves[0].body);if(full)f.config.maxObjects=1;
   assert.throws(()=>validateRealtimeDefinition(definition(f)),capError);
   assert.throws(()=>simulate(f),capError);
  }
 }
});
test('spawn still rejects a duplicate live body ID without overwriting objects',()=>{
 const f=fixture();f.config.waves[0].body.id='anchor';const before=structuredClone(f.world);
 assert.throws(()=>simulate(f),e=>capError(e)&&/Spawn ID already alive/.test(e.message));
 assert.deepEqual(f.world,before);
});
test('full object pool rejects valid wave spawn without marking it spawned or overwriting',()=>{
 const f=fixture();f.config.maxObjects=1;const result=simulate(f),next=state(result);
 assert.deepEqual(next.bodies,f.world.bodies);assert.deepEqual(next.spawned,[]);
 assert.equal(result.events.filter(e=>e.type==='realtime.pool-full').length,1);
 assert.equal(result.events.filter(e=>e.type==='realtime.spawned').length,0);
});
test('existing no-wave constraint and unconstrained wave fixtures retain their state semantics',()=>{
 const constrained=fixture();constrained.config.waves=[];
 assert.doesNotThrow(()=>validateRealtimeDefinition(definition(constrained)));
 assert.deepEqual(state(simulate(constrained)),constrained.world);
 const unconstrained=fixture();delete unconstrained.config.constraints;
 assert.doesNotThrow(()=>validateRealtimeDefinition(definition(unconstrained)));
 const next=state(simulate(unconstrained));assert.deepEqual(next.spawned,[0]);
 assert.deepEqual(next.bodies,[...unconstrained.world.bodies,unconstrained.config.waves[0].body]);
});

test('phased waves switch cadence and weighted descending templates at the declared Tick',()=>{
 const f=fixture();
 f.config.waves=[
  {tick:0,body:{...body('scout','target',700,700),vy:-10}},
  {tick:0,body:{...body('heavy','target',700,700),vy:-8,hp:4}}
 ];
 f.config.wavePhases=[
  {startTick:0,intervalTicks:6,speedPermille:1000,weights:[1,0]},
  {startTick:10,intervalTicks:3,speedPermille:1500,weights:[0,1]}
 ];
 assert.doesNotThrow(()=>validateRealtimeDefinition(definition(f)));
 const at=tickIndex=>simulateIntegerWorld({config:f.config,world:{state:{world:f.world}},inputs:[],tickIndex,rng:{randomInt:min=>min}});
 for(const tick of [0,6]){
  const spawned=state(at(tick)).bodies.find(b=>b.id.startsWith('scout'));
  assert.deepEqual([spawned.id,spawned.x,spawned.vy,spawned.ttl],[`scout--0-${tick}`,20,-10,67]);
 }
 assert.equal(state(at(9)).bodies.length,1);
 for(const tick of [10,13]){
  const spawned=state(at(tick)).bodies.find(b=>b.id.startsWith('heavy'));
  assert.deepEqual([spawned.id,spawned.vy,spawned.hp,spawned.ttl],[`heavy--1-${tick}`,-12,4,56]);
 }
 assert.deepEqual(state(at(10)).spawned,[]);
 for(const edit of [p=>p.startTick=0,p=>p.weights=[0,0],p=>p.weights=[1]]){
  const broken=structuredClone(f);edit(broken.config.wavePhases[1]);
  assert.throws(()=>validateRealtimeDefinition(definition(broken)),capError);
 }
});
