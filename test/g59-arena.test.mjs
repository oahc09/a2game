import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createContentService} from '../scripts/content-service.mjs';
const game=(mirror=false)=>JSON.parse(readFileSync(new URL('../specs/v0.1/games/g59-neon-arena'+(mirror?'-mirror':'')+'.game.json',import.meta.url)));
const pad=(rx,ry,mx=0,my=0,connected=true)=>({source:'gamepad',kind:'sample',payload:{index:0,connected,buttons:[],axes:connected?[mx,my,rx,ry]:[]}});
const touch=(kind,id,u,v,viewportAspect=640/360)=>({source:'pointer',kind,payload:{pointerId:id,u,v,viewportAspect,pointerType:'touch'}});
const view=r=>r.observe().state.world;
const body=(r,id)=>view(r).bodies.find(b=>b.id===id);
const events=(r,type)=>r.observe().events.filter(e=>e.type===type);
function run(def,fn){
 const r=new HeadlessRuntime(def,makeRegistry());
 try{r.start();return fn(r);}finally{r.dispose();}
}
test('both authored G59 layouts admit, score from repeated stick intent, freeze the result and reset cleanly',async()=>{
 for(const mirror of [false,true]){
  const def=game(mirror);
  const receipt=await createContentService().release(JSON.stringify(def));assert.equal(receipt.id,def.id);
  run(def,r=>{
   r.injectRaw(pad(mirror?-1:1,0));r.step(205);
   assert.equal(r.status,'won');assert.equal(view(r).score,30);
   assert.equal(events(r,'game.won').length,1);assert.equal(events(r,'game.lost').length,0);
   const hash=r.observe().exactHash;assert.equal(r.step(20).advanced,0);assert.equal(r.observe().exactHash,hash);
   r.restart();assert.deepEqual(view(r),def.state.world.initial);assert.equal(r.tickIndex,0);
   r.step(210);assert.equal(r.status,'lost');assert.equal(view(r).health,0);assert.equal(view(r).score,0);
  });
 }
});
test('touch and standard gamepad traces produce the same actual movement, independent aim, onscreen reticle and projectile velocity',()=>{
 let testVector;
 for(const demo of [false,true]){
  const hit=run(game(),r=>{
   const inject=rows=>rows.forEach(x=>r.injectRaw(x));
   if(demo)inject([touch('down',1,.25,.5),touch('down',2,.75,.5),touch('move',1,.25+32/640,.5-32/360),touch('move',2,.75-32/640,.5+32/360)]);
   else r.injectRaw(pad(-1,1,1,-1));
   r.step();
   const first=body(r,'pilot'),oldShot=body(r,'shot_0');
   assert.deepEqual([first.x,first.y,first.vx,first.vy],[3054,2254,54,54]);
   assert.deepEqual([oldShot.vx,oldShot.vy],[-91,-91]);
   const marker=()=>projectPresentation(game(),r.observe()).commands.find(c=>c.id.endsWith('.beamH')).at;
   const original=marker();assert.ok(original[0]<first.x/1000-3&&original[1]<first.y/1000-2.2);
   if(demo)r.injectRaw(touch('move',2,.75+32/640,.5-32/360));else r.injectRaw(pad(1,-1,1,-1));
   r.step(13);
   const moved=body(r,'pilot'),newShot=body(r,'shot_1'),reversed=marker();
   assert.equal(moved.vx,54);assert.equal(moved.vy,54);
   assert.deepEqual([newShot.vx,newShot.vy],[91,91]);
   assert.ok(reversed[0]>moved.x/1000-3&&reversed[1]>moved.y/1000-2.2);
   const score=view(r).score;
   if(demo)inject([touch('up',1,.3,.4),touch('up',2,.8,.4)]);else r.injectRaw(pad(0,0,0,0,false));
   r.step();assert.deepEqual([body(r,'pilot').vx,body(r,'pilot').vy],[0,0]);assert.deepEqual(view(r).crosshair,[]);
   return {original,reversed,score,first:[first.x,first.y],moved:[moved.x,moved.y],shot:[newShot.x,newShot.y]};
  });
  if(!demo)testVector=hit;else assert.deepEqual(hit,testVector);
 }
});

test('same-Tick lethal hit and quota keep the earned score but emit one loss; deadline-alone quota wins',()=>{
 for(const lethal of [false,true]){
  const g=game(),c=g.scenes[0].entities[0].components[0].config,w=g.state.world.initial;
  c.waves=[];c.maxTicks=1;c.seekSpeed=0;w.timeLeft=1;w.score=20;
  const pilot=w.bodies[0];pilot.hp=1;
  const target={...pilot,id:'target',kind:'target',x:4500,team:2,value:10,fixed:true};
  const shot={...pilot,id:'prior_shot',kind:'projectile',x:4300,vx:128,value:1,hx:42,hy:42,ttl:30,owner:pilot.id,hits:[]};
  w.bodies=[pilot,target,shot,...(lethal?[{...target,id:'contact',x:pilot.x,y:pilot.y,value:0}]:[])];
  run(g,r=>{
   r.step();assert.equal(view(r).score,30);assert.equal(view(r).won,true);assert.equal(view(r).lost,lethal);
   assert.equal(r.status,lethal?'lost':'won');
   assert.deepEqual(events(r,'combat.death').map(e=>e.payload.id).sort(),lethal?['pilot','target']:['target']);
   assert.equal(r.observe().events.filter(e=>e.channel==='outcome').length,1);
   const score=projectPresentation(g,r.observe()).commands.find(c=>c.id==='score');assert.equal(score.text,'30');
   r.restart();assert.deepEqual(view(r),w);assert.equal(events(r,'game.lost').length,0);
  });
 }
});
test('paused analog ownership does not drift or fire on resume; held keyboard remains a fallback',()=>{
 run(game(),r=>{
  r.injectRaw(pad(1,0,1,-1));r.step();
  r.pause();r.resume();const {x,y}=body(r,'pilot'),n=view(r).nextId;
  r.step(18);assert.deepEqual([body(r,'pilot').x,body(r,'pilot').y],[x,y]);assert.equal(view(r).nextId,n);
  const raw=(kind,code)=>r.injectRaw({source:'keyboard',kind,payload:{code}});
  raw('down','KeyW');raw('down','ArrowLeft');r.step(2);
  assert.equal(body(r,'pilot').vy,76);assert.equal(body(r,'shot_'+n).vx,-128);
  raw('up','ArrowLeft');r.step();assert.deepEqual(view(r).crosshair,[]);assert.equal(body(r,'pilot').vy,76);
 });
});
