import assert from 'node:assert/strict';
import test from 'node:test';
import {HeadlessRuntime,createReplaySave,openReplaySave} from '../dist/index.js';
import {validateMobileBindings} from '../dist/mobile-input.js';
import {createPointerHost} from '../player/pointer-host.mjs';
import {makeRegistry} from '../scripts/registry.mjs';
import {createContentService} from '../scripts/content-service.mjs';
import {pairedProfile} from './fixtures/g59-mapping-profile.mjs';
const half=.7071;
function rig(w,h){
 const game=pairedProfile(),r=new HeadlessRuntime(game,makeRegistry()),rows=[];
 r.start();
 const add=(kind,pointerId,u,v,aspect=w/h)=>{
  const tickIndex=r.tickIndex,row={source:'pointer',kind,payload:{pointerId,u,v,viewportAspect:aspect},tickIndex,timeUs:Math.ceil(tickIndex*1e6/60),seq:rows.length};
  rows.push(row);r.injectRaw(row);
 };
 const sticks=()=>{const {axis,rightStick}=r.observe().state;return [axis,rightStick];};
 return {r,rows,game,add,sticks};
}
test('world-up two-stick vectors match device input at portrait, landscape, square and preserve pointer ownership',()=>{
 for(const [width,height] of [[640,360],[360,640],[360,360]]){
  const {r,rows,game,add,sticks}=rig(width,height);
  try{
   add('down',7,.25,.5);add('down',9,.75,.5);r.step();assert.deepEqual(sticks(),[[0,0],[0,0]]);
   add('move',7,.25+3/width,.5-3/height);r.step();assert.deepEqual(sticks()[0],[0,0]);
   add('move',7,.25+10/width,.5-10/height);r.step();
   const [x,y]=sticks()[0];assert.equal(x,y);assert.ok(x>.21&&x<.23);
   add('move',7,.25+30/width,.5-30/height);add('move',9,.75-30/width,.5+30/height);
   r.step();assert.deepEqual(sticks(),[[half,half],[-half,-half]]);
   add('move',9,.75+30/width,.5-30/height);add('down',22,.32,.8);add('move',22,.31,.9);
   r.step();assert.deepEqual(sticks(),[[half,half],[half,half]]);
   add('up',9,.8,.4);r.step();assert.deepEqual(sticks(),[[half,half],[0,0]]);
   add('cancel',7,.5,.2);add('move',22,.4,.5);r.step();assert.deepEqual(sticks(),[[0,0],[0,0]]);
   const trace={format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:game.id,gameRevision:game.revision,tickHz:60,seed:game.world.clock.seed,inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1'},events:[...rows,{source:'system',kind:'checkpoint',tickIndex:r.tickIndex,timeUs:Math.ceil(r.tickIndex*1e6/60),seq:rows.length,payload:{}}]};
   const save=createReplaySave(game,makeRegistry,trace),opened=openReplaySave(game,makeRegistry,save);
   try{assert.equal(opened.runtime.observe().exactHash,r.observe().exactHash);}finally{opened.runtime.dispose();}
  }finally{r.dispose();}
 }
});
test('changed aspect releases only the affected pointer; pause never synthesizes a held stick',()=>{
 const {r,add,sticks}=rig(640,360);
 try{
  add('down',1,.25,.5);add('down',2,.75,.5);add('move',1,.31,.4);add('move',2,.70,.63);r.step();
  add('move',1,.34,.3,1);r.step();
  assert.deepEqual(sticks()[0],[0,0]);assert.notDeepEqual(sticks()[1],[0,0]);
  add('move',1,.4,.7);r.step();assert.deepEqual(sticks()[0],[0,0]);
  const resumedAt=r.tickIndex;r.pause();r.resume();r.step();assert.deepEqual(Object.keys(r.snapshot().activePointers),[]);
  assert.ok(!r.observe().events.some(e=>e.tickIndex>=resumedAt&&e.sourceId?.startsWith('touch-stick:')));
 }finally{r.dispose();}
});
test('same-aspect viewport shrink cancels both browser owners before a stationary move can be normalized again',()=>{
 const c=new EventTarget(),signal=new AbortController(),rows=[],capture=new Set();
 let rect={width:640,height:360,left:0,top:0};
 Object.assign(c,{getBoundingClientRect:()=>rect,setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)});
 const host=createPointerHost({canvas:c,getRuntime:()=>({status:'playing'}),inject:e=>rows.push(e),signal:signal.signal,geometrySensitive:true});
 const send=(kind,id,x,y)=>{const e=new Event('pointer'+kind);Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType:'touch'});c.dispatchEvent(e);};
 send('down',4,160,180);send('down',5,480,180);
 rect={width:480,height:270,left:0,top:0};host.checkGeometry();send('move',4,160,180);
 assert.deepEqual(rows.map(r=>r.kind),['down','down','cancel','cancel']);
 assert.deepEqual(rows.slice(2).map(r=>r.payload.u),[.25,.75]);assert.equal(host.diagnostics().activePointers,0);
 send('move',5,480,180);assert.equal(rows.length,4);
 send('down',4,160,180);assert.equal(rows.at(-1).payload.u,1/3);
 signal.abort();
});
test('full admission recognizes bounded stick declarations and validation refuses shared zones or out of range configs',async()=>{
 const game=pairedProfile();
 assert.equal((await createContentService().release(JSON.stringify(game))).id,game.id);
 const stick=(g,id)=>g.inputs.actions.find(a=>a.id===id).bindings.at(-1).config;
 for(const mutate of [g=>stick(g,'look').stick.zone='right',g=>stick(g,'aim').stick.radius=0,g=>stick(g,'look').stick.deadZone=.99,g=>stick(g,'look').minDistanceNorm=.1]){
  const bad=pairedProfile();mutate(bad);assert.throws(()=>validateMobileBindings(bad),e=>e.code==='A2G_E_CAP_CONFIG');
 }
});
