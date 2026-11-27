import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {simulateSnake} from '../dist/modules/snake.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';

const game=(slug='g41-snake')=>readJson(spec+'/games/'+slug+'.game.json');
const config=d=>d.scenes[0].entities[0].components[0].config;
const start=d=>{const r=new HeadlessRuntime(d,makeRegistry());r.start();return r;};
const swipe=(r,id)=>{for(const [kind,v,seq,timeUs] of [['down',0.25,1,1],['up',0.75,7,10]])r.injectRaw({source:'pointer',kind,seq,timeUs,tickIndex:r.tickIndex,payload:{pointerId:id,u:0.5,v,pointerType:'touch'}});};
const press=(r,action,seq=8)=>r.injectAction({action,phase:'press',timeUs:10,seq});
const board=(body,direction,food,turns=[])=>({body,direction,food,turns,nextMoveTick:0,eaten:0,status:'playing'});
const event=(action)=>({type:'input.action',edge:'press',action});
function transition(c,b,inputs=[],randomInt=()=>assert.fail('movement/terminal must not draw RNG')){
 return simulateSnake({tickIndex:0,config:c,inputs,world:{state:{snake:b}},rng:{randomInt}});
}

test('same-time swipe edges preserve raw order against later semantic turn; press precedes release',()=>{
 const r=start(game());
 try{
  swipe(r,1);press(r,'left');r.step();
  assert.deepEqual(r.observe().events.filter(e=>e.type==='input.action').map(e=>[e.action,e.edge]),[
   ['down','press'],['down','release'],['left','press']
  ]);
  assert.deepEqual(r.observe().state.snake.turns,['down','left']);
  r.step(11);assert.deepEqual(r.observe().state.snake.body,[9,5]);
  r.step(12);assert.deepEqual(r.observe().state.snake.body,[8,9]);
 }finally{r.dispose();}
});

test('pause clears undrained queues and held sources, retains committed FIFO, RNG and due Tick',()=>{
 const r=start(game());
 try{
  swipe(r,1);press(r,'left');r.step();const committed=r.snapshot();
  r.injectRaw({source:'pointer',kind:'down',payload:{pointerId:3,u:0.7,v:0.7}});
  r.injectAction({action:'up',phase:'press'});
  r.pause();assert.equal(r.step(100).advanced,0);
  const paused=r.snapshot();assert.equal(paused.tickIndex,committed.tickIndex);
  assert.deepEqual(paused.state,committed.state);assert.deepEqual(paused.rng,committed.rng);
  for(const k of ['rawQueue','inputQueue'])assert.deepEqual(paused[k],[]);
  for(const k of ['activePointers','pressedSources'])assert.deepEqual(paused[k],{});
  assert.throws(()=>press(r,'up'),{code:'A2G_E_FLOW'});
  r.resume();r.step(11);assert.deepEqual(r.observe().state.snake.body,[9,5]);
  r.step(12);assert.deepEqual(r.observe().state.snake.body,[8,9]);
 }finally{r.dispose();}
});

test('vacating tail allowed; wall/body collision leaves body, food and RNG untouched',()=>{
 const c={...config(game()),goalLength:10};
 const cases=[
  [board([5,6,10,9],'left',[2],['down']),[9,5,6,10],null],
  [board([5,6,10,9,8],'left',[2],['down']),[5,6,10,9,8],'body'],
  [board([4,5],'left',[2]),[4,5],'wall']
 ];
 for(const [before,body,reason] of cases){
  const out=transition(c,before),after=out.proposals[0].value;
  assert.deepEqual(after.body,body);
  assert.deepEqual(after.food,before.food);
  assert.equal(after.status,reason?'lost':'playing');
  assert.deepEqual(out.events,reason?[{type:'snake.lost',payload:{reason}}]:[]);
 }
});

test('growth chooses one row-major free cell; full-board win terminates with no draw',()=>{
 const c={...config(game()),width:3,height:3,goalLength:9};
 const grew=transition(c,board([0,3],'up',[1]),[event('right')],(...args)=>{
  assert.deepEqual(args,[0,5]);return 2;
 });
 assert.deepEqual(grew.proposals[0].value,{body:[1,0,3],direction:'right',food:[5],turns:[],nextMoveTick:12,eaten:1,status:'playing'});
 const win=transition(c,board([1,2,5,8,7,6,3,4],'left',[0]));
 assert.deepEqual(win.proposals[0].value.body,[0,1,2,5,8,7,6,3,4]);
 assert.deepEqual(win.proposals[0].value.food,[]);
 assert.deepEqual(win.events,[{type:'snake.won',payload:{length:9}}]);
});

test('turns reject duplicates, reversal and overflow; snapshot / restart reproduces movement and RNG',()=>{
 const d=game(),c={...config(d),goalLength:6};
 const out=transition(c,{...board([5,4],'right',[6]),nextMoveTick:5},['left','right','down','up','left','up'].map(event));
 assert.deepEqual(out.proposals[0].value.turns,['down','left']);
 const r=start(d);
 try{
  const init=r.snapshot();
  r.step(12);const first=r.snapshot();
  assert.notDeepEqual(first.rng,init.rng);
  r.restore(init);r.step(12);assert.deepEqual(r.snapshot().state,first.state);assert.deepEqual(r.snapshot().rng,first.rng);
  r.restart();r.step(12);assert.deepEqual(r.snapshot().state,first.state);assert.deepEqual(r.snapshot().rng,first.rng);
 }finally{r.dispose();}
});

test('two admitted layouts project pure shared geometry and reject invalid definitions',()=>{
 for(const slug of ['g41-snake','g41-snake-wide']){
  const d=game(slug),r=start(d),c=config(d),frame=projectPresentation(d,r.observe());
  assert.equal(frame.commands.filter(x=>x.id.startsWith('floor[')).length,c.width*c.height);
  assert.equal(frame.commands.filter(x=>x.id.startsWith('body[')).length,2);
  assert.equal(frame.commands.filter(x=>x.id.startsWith('food[')).length,1);r.dispose();
 }
 for(const [mutate,code] of [
  [d=>{config(d).actions.down='left';},'A2G_E_CAP_CONFIG'],
  [d=>{config(d).actions.down='missing';},'A2G_E_CAP_CONFIG'],
  [d=>{d.state.snake.initial.body=[5,0];},'A2G_E_STATE_TYPE'],
  [d=>{d.state.snake.initial.food=[5];},'A2G_E_STATE_TYPE'],
  [d=>{d.state.snake.initial.nextMoveTick=0;},'A2G_E_STATE_TYPE'],
  [d=>{const e=d.scenes[0].entities[0];d.scenes[0].entities.push({...e,id:'duplicate'});},'A2G_E_CAP_CONFIG']
 ]){const d=game();mutate(d);assert.throws(()=>start(d),{code});}
});
