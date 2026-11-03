import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime} from '../dist/index.js';
import {initialDefenseState,simulateDefense} from '../dist/modules/tower-defense.js';
import {makeRegistry} from '../scripts/registry.mjs';

// Synthetic mechanism fixture: no candidate definitions, traces or historical solutions.
const config=()=>({statePath:'/defense',width:2000,height:2000,cost:1,damage:1,
 range:1000,speed:1,cooldownTicks:3,maxTicks:100,
 cells:[{x:200,y:200},{x:300,y:200}],path:[{x:200,y:300},{x:1800,y:300}],
 waves:[{tick:90,hp:100,reward:0}],actions:[{action:'merge',kind:'merge',index:1}]});
const enemy=()=>({id:'enemy_2',x:200,y:300,hp:100,cursor:1,reward:0});
function state(nextFires=[0]){
 return {...initialDefenseState(),nextId:3,selected:0,
  towers:nextFires.map((_,i)=>({id:`tower_${i}`,cell:i,level:1,weaponId:`weapon_${i}`})),
  weapons:nextFires.map((nextFire,i)=>({id:`weapon_${i}`,owner:`tower_${i}`,nextFire})),enemies:[enemy()]};
}
function tick(s,n,merge=false){
 const result=simulateDefense({tickIndex:n,config:config(),world:{state:{defense:s}},
  inputs:merge?[{type:'input.action',action:'merge',edge:'press'}]:[]});
 return result.proposals[0].value;
}
function syntheticRuntime(){
 const capability=id=>({id,version:'0.1.0'});
 const game={format:'a2game',specVersion:'0.1.0',id:'org.a2game.test.cooldown-boundary',revision:1,
  meta:{title:'Synthetic cooldown boundary',genres:['strategy']},
  requires:{all:['a2game.core.state','a2game.core.flow','a2game.strategy.tower-defense',
   'a2game.input.keyboard.button'].map(capability)},
  world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:1,maxCatchUpTicks:5}},
  assets:{},prototypes:{},scenes:[{id:'main',entities:[{id:'controller',
   components:[{capability:capability('a2game.strategy.tower-defense'),config:config()}]}]}],entryScene:'main',
  state:{defense:{type:'object',initial:state([2])}},
  inputs:{actions:[{id:'merge',valueType:'button',policy:'first-ready',
   bindings:[{source:'keyboard.button',config:{code:'KeyM'}}]}],traceRecording:'disabled'},
  rules:[],outcomes:[],presentation:{hud:[],cues:[]},tests:[],extensions:{}};
 return new HeadlessRuntime(game,makeRegistry());
}

test('merge inherits equal or unequal cooldowns before, exactly at and after the executing tick',()=>{
 const n=4;
 for(const old of [[3,3],[4,4],[5,5],[1,3],[1,4],[1,5],[5,1]]){
  const inherited=Math.max(n,...old);
  const noTarget=state(old);noTarget.enemies=[];
  const merged=tick(noTarget,n,true);
  assert.equal(merged.weapons[0].nextFire,inherited,`inherited ${old}`);
  assert.deepEqual(merged.shots,[]);
  const fired=tick(state(old),n,true),due=inherited<=n;
  assert.equal(fired.towers.length,1);assert.equal(fired.weapons.length,1);
  assert.equal(fired.shots.length,due?1:0,`due ${old}`);
  assert.equal(fired.weapons[0].nextFire,due?n+config().cooldownTicks:inherited);
  if(due)assert.deepEqual(fired.shots[0],{owner:'tower_3',weapon:'weapon_3',target:'enemy_2',tick:n});
 }
});

test('no target does not consume an overdue cooldown; the next available target fires immediately',()=>{
 const s=state([2]);s.enemies=[];
 const waiting=tick(s,4);
 assert.equal(waiting.weapons[0].nextFire,2);assert.deepEqual(waiting.shots,[]);
 waiting.enemies=[enemy()];
 const fired=tick(waiting,5);
 assert.equal(fired.shots[0].tick,5);assert.equal(fired.weapons[0].nextFire,8);
});

test('post-step observation is n+1 while shots and cooldown use executing tick n',()=>{
 const r=syntheticRuntime();
 try{
  r.start();assert.equal(r.observe().tickIndex,0);
  r.step(2);assert.equal(r.observe().tickIndex,2);assert.deepEqual(r.observe().state.defense.shots,[]);
  const beforeDue=r.snapshot();
  r.pause();r.step(10);assert.equal(r.observe().tickIndex,2);r.resume();
  r.step();const due=r.observe();
  assert.equal(due.tickIndex,3);assert.equal(due.state.defense.shots[0].tick,2);
  assert.equal(due.state.defense.weapons[0].nextFire,5);
  r.restore(beforeDue);r.step();assert.equal(r.observe().exactHash,due.exactHash);
  r.step(2);assert.equal(r.observe().tickIndex,5);assert.deepEqual(r.observe().state.defense.shots,[]);
  r.step();assert.equal(r.observe().tickIndex,6);assert.equal(r.observe().state.defense.shots[0].tick,5);
  r.restart();assert.equal(r.observe().tickIndex,0);assert.deepEqual(r.observe().state.defense,state([2]));
 }finally{r.dispose();}
});
