import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,compileGame} from '../dist/index.js';
import {simulateIntegerWorld,validateRealtimeDefinition} from '../dist/modules/realtime.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {getPublicCapability} from '../generator/catalog.mjs';

// Synthetic mechanism-only fixtures. No experiment artifacts, levels or authored routes.
const ref=id=>({id,version:'0.1.0'});
function requirements(ids){const seen=new Map();function add(id){if(seen.has(id))return;const m=getPublicCapability(ref(id));seen.set(id,ref(id));for(const d of m.dependencies??[])add(d.id);}ids.forEach(add);return [...seen.values()];}
const body=(id,kind,x,y)=>({id,kind,x,y,vx:0,vy:0,hx:20,hy:20,hp:3,team:kind==='actor'?1:2,value:0,fixed:true});
function fixture(){return {config:{statePath:'/world',width:1000,height:1000,maxObjects:8,gravity:0,weapon:'hitscan',weaponRange:1000,cooldownTicks:1,damage:1,aimPath:'/aim',actions:{fire:'fire'},maxTicks:100},world:{bodies:[body('actor','actor',200,200),body('target','target',700,200)],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false}};}
function game(){const f=fixture();return {format:'a2game',specVersion:'0.1.0',id:'org.a2game.synthetic.public-operations',revision:1,meta:{title:'Synthetic operation contracts',genres:['test']},requires:{all:requirements(['a2game.realtime.world','a2game.rules.state-set','a2game.input.keyboard.button','a2game.core.flow'])},world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:1,maxCatchUpTicks:5}},assets:{},prototypes:{},scenes:[{id:'main',entities:[{id:'engine',components:[{capability:ref('a2game.realtime.world'),config:f.config}]}]}],entryScene:'main',state:{world:{type:'object',initial:f.world},aim:{type:'array',initial:[1,0]},record:{type:'object',initial:{slot:0}}},inputs:{actions:['fire','reaim'].map((id,i)=>({id,valueType:'button',policy:'first-ready',bindings:[{source:'keyboard.button',config:{code:i?'KeyA':'KeyF'}}]})),traceRecording:'disabled'},rules:[{id:'change-aim',on:{type:'input.action',action:'reaim',edge:'press'},do:[{op:'state.set',path:'/aim',value:[0,1]}]}],outcomes:[],presentation:{hud:[],cues:[]},tests:[],extensions:{}};}
const press=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});};
const resultWorld=x=>x.proposals.find(p=>p.path==='/world').value;

test('public operation semantics are exposed unchanged through capability discovery',()=>{
 for(const id of ['a2game.realtime.world','a2game.rules.state-set']){const m=getPublicCapability(ref(id)),disk=JSON.parse(readFileSync(new URL('../specs/v0.1/capabilities/'+id+'.capability.json',import.meta.url)));assert.deepEqual(m,disk);assert.equal(m.version,'0.1.0');assert.equal(m.extensions.publicSemantics.scope,'PUBLIC_MECHANISM_CONTRACT_NOT_LEVEL_OR_SOLUTION');}
 const rt=getPublicCapability(ref('a2game.realtime.world'));assert.match(rt.extensions.publicSemantics.aim,/direction vector/);assert.match(rt.extensions.publicSemantics.aim,/L1 normalization/);assert.match(rt.extensions.publicSemantics.constraints,/provenance/);
 const set=getPublicCapability(ref('a2game.rules.state-set'));assert.match(set.extensions.publicSemantics.effect,/top-level effect fields/);assert.match(set.extensions.publicSemantics.timing,/T8/);
});
test('aimPath is a bounded direction vector; L1 normalization and zero fallback retain existing semantics',()=>{
 const f=fixture(),run=aim=>simulateIntegerWorld({config:f.config,world:{state:{world:f.world,aim}},inputs:[{type:'input.action',action:'fire',edge:'press'}],tickIndex:0});
 assert.equal(resultWorld(run([32000,0])).bodies.find(b=>b.id==='target').hp,2);
 assert.equal(resultWorld(run([0,0])).bodies.find(b=>b.id==='target').hp,2);
 const diagonal={...f.config,weapon:'projectile',projectileSpeed:120};const shot=resultWorld(simulateIntegerWorld({config:diagonal,world:{state:{world:f.world,aim:[3,1]}},inputs:[{type:'input.action',action:'fire',edge:'press'}],tickIndex:0})).bodies.find(b=>b.kind==='projectile');assert.equal(shot.vx,90);assert.equal(shot.vy,30);
 for(const aim of [[],[1],[1,0,0],['1',0],[32001,0],[NaN,0]]){const g=game();g.state.aim.initial=aim;assert.throws(()=>validateRealtimeDefinition(g),e=>e.code==='A2G_E_CAP_CONFIG');assert.throws(()=>run(aim),e=>e.code==='A2G_E_CAP_CONFIG');}
});
test('state.set aim commits after physics and never changes an already simulated same-Tick shot',()=>{
 const r=new HeadlessRuntime(game(),makeRegistry());r.start();try{press(r,'reaim');press(r,'fire');r.step(1);let s=r.observe().state;assert.deepEqual(s.aim,[0,1]);assert.equal(s.world.bodies.find(b=>b.id==='target').hp,2);press(r,'fire');r.step(1);s=r.observe().state;assert.equal(s.world.bodies.find(b=>b.id==='target').hp,2);assert.deepEqual(s.aim,[0,1]);}finally{r.dispose();}
});
test('state.set top-level path/value and existing-state type gates are not relaxed by documentation',()=>{
 for(const effect of [{op:'state.set',payload:{path:'/aim',value:[0,1]}},{op:'state.set',path:'/missing',value:1},{op:'state.set',path:'/aim',value:[0,1],extra:true},{op:'state.set',path:'/aim'}]){const g=game();g.rules[0].do=[effect];assert.throws(()=>compileGame(g,makeRegistry()));}
 for(const effect of [{op:'state.set',path:'/record/missing',value:1},{op:'state.set',path:'/aim',value:7}]){const g=game();g.rules[0].do=[effect];const r=new HeadlessRuntime(g,makeRegistry());r.start();try{const before=r.observe().state;press(r,'reaim');assert.throws(()=>r.step(1),e=>e.code==='A2G_E_TICK_COMMIT');assert.deepEqual(r.observe().state,before);}finally{r.dispose();}}
});
test('state.set supports explicit constant objects and JSON null without interpreting literal keys',()=>{
 for(const [effect,expected] of [[{op:'state.set',path:'/record',value:{const:{op:'literal-data',state:'not-a-pointer'}}},{op:'literal-data',state:'not-a-pointer'}],[{op:'state.set',path:'/record/slot',value:null},{slot:null}]]){const g=game();g.rules[0].do=[effect];const r=new HeadlessRuntime(g,makeRegistry());r.start();try{press(r,'reaim');r.step(1);assert.deepEqual(r.observe().state.record,expected);}finally{r.dispose();}}
});

function shotWorld(def={},aim=[1,0],targets=[],ticks=1){
 const world=fixture().world;
 world.bodies=[body('actor','actor',1600,1600),...targets.map(([id,dx,dy])=>body(id,'target',1600+dx,1600+dy))];
 const config={...fixture().config,width:4000,height:4000,weapon:'projectile',projectileSpeed:128,...def};
 let next=world;
 for(let tickIndex=0;tickIndex<ticks;tickIndex++)next=resultWorld(simulateIntegerWorld({config,world:{state:{world:next,aim}},inputs:tickIndex?[]:[{type:'input.action',action:'fire',edge:'press'}],tickIndex}));
 return next;
}
const velocity=w=>w.bodies.filter(b=>b.kind==='projectile').map(({vx,vy})=>[vx,vy])[0];

test('circular projectile speed is opt-in, symmetric, nonzero at low speed and insensitive to aim magnitude',()=>{
 const c={aimMetric:'euclidean'},p=(aim,speed)=>velocity(shotWorld({...c,projectileSpeed:speed},aim));
 assert.deepEqual(p([1,0],128),[128,0]);
 assert.deepEqual(p([1,1],128),[91,91]);
 assert.deepEqual(p([0.7071,0.7071],128),p([180,180],128));
 assert.deepEqual(p([-1,1],128),[-91,91]);
 assert.deepEqual(p([-1,-1],1),[-1,-1]);
 assert.deepEqual(p([Number.MIN_VALUE,Number.MIN_VALUE],1),[1,1]);
 assert.deepEqual(p([0,0],128),[128,0]);
 assert.deepEqual(velocity(shotWorld({},[1,1])),[64,64]);
 assert.deepEqual(velocity(shotWorld({aimMetric:'manhattan',projectileSpeed:1},[1,1])),[0,0]);
 const straight=shotWorld(c,[1,0],[['target',900,0]],7);
 const diagonal=shotWorld(c,[1,1],[['target',636,636]],7);
 assert.equal(straight.bodies.find(b=>b.id==='target').hp,2);
 assert.equal(diagonal.bodies.find(b=>b.id==='target').hp,2);
 assert.equal(shotWorld({},[1,1],[['target',636,636]],7).bodies.find(b=>b.id==='target').hp,3);
});

test('circular hitscan keeps range admission, ray endpoint, occlusion and target order coherent',()=>{
 const c={aimMetric:'euclidean',weapon:'hitscan',weaponRange:1000};
 const hp=(config,aim,x,y)=>shotWorld(config,aim,[['target',x,y]]).bodies.find(b=>b.id==='target').hp;
 assert.equal(hp(c,[1,0],1000,0),2);
 assert.equal(hp(c,[3,4],600,800),2); // exact equal distance via Pythagorean triple
 assert.equal(hp(c,[1,1],707,707),2);
 assert.equal(hp(c,[1,1],708,708),3); // center lies outside even though the box intersects
 assert.equal(hp({...c,aimMetric:'manhattan'},[1,1],707,707),3);
 const spec={...c,aimPath:undefined,autoTarget:true};
 const rows=[['far',950,0],['near',600,600]];
 assert.equal(shotWorld(spec,[0,0],rows).bodies.find(b=>b.id==='near').hp,2);
 assert.equal(shotWorld({...spec,aimMetric:'manhattan'},[0,0],rows).bodies.find(b=>b.id==='far').hp,2);
 const state=fixture().world;
 state.bodies.push({...body('wall','solid',450,200),team:0});
 const result=resultWorld(simulateIntegerWorld({config:{...fixture().config,...c},world:{state:{world:state,aim:[1,0]}},inputs:[{type:'input.action',action:'fire',edge:'press'}],tickIndex:0}));
 assert.equal(result.bodies.find(b=>b.id==='target').hp,3);
});

test('circular aim config rejects unsupported metrics and malformed ranges',()=>{
 const m=getPublicCapability(ref('a2game.realtime.world'));
 assert.deepEqual(m.contract.configSchema.properties.aimMetric.enum,['manhattan','euclidean']);
 for(const options of [{aimMetric:'l2'},{aimMetric:null},...[0,-1,1.5,32001,'1000'].map(weaponRange=>({aimMetric:'euclidean',weaponRange}))]){
  const g=game();
  Object.assign(g.scenes[0].entities[0].components[0].config,options);
  assert.throws(()=>validateRealtimeDefinition(g),e=>e.code==='A2G_E_CAP_CONFIG');
  assert.throws(()=>shotWorld(options),e=>e.code==='A2G_E_CAP_CONFIG');
 }
});
