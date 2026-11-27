import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,createReplaySave,openReplaySave} from '../dist/index.js';
import {validateGamepadBindings} from '../dist/gamepad-input.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createContentService} from '../scripts/content-service.mjs';
import {createGamepadHost} from '../player/gamepad-host.mjs';

import {lab,joy,pos,profile} from './fixtures/g59-mapping-profile.mjs';

test('standard admission happens in Browser Host without changing the normalized packet or legacy intake',()=>{
 const rows=[],status=[];let pads=[pos({mapping:''})];
 const g=profile(),host=createGamepadHost({definition:g,inject:r=>rows.push(r),getPads:()=>pads,onStatus:s=>status.push(s)});
 host.enable();host.poll();host.poll();
 assert.equal(rows.length,0);assert.equal(host.diagnostics().incompatibleDevices,1);assert.equal(status.length,2);
 pads=[pos({axes:[0,-1]})];host.poll();assert.equal(rows.length,0);
 pads=[pos()];host.poll();host.poll();assert.equal(rows.length,1);
 assert.deepEqual(rows[0].payload,{index:0,connected:true,buttons:[false],axes:[1,-1,-1,1]});
 host.enable();pads=[pos({mapping:''})];host.poll();host.poll();assert.equal(rows.length,2);
 assert.deepEqual(rows[1].payload,{index:0,connected:false,buttons:[],axes:[]});
 pads=[pos()];host.poll();pads=undefined;host.poll();host.poll();assert.equal(rows.length,4);assert.equal(rows.at(-1).payload.connected,false);
 assert.equal(host.diagnostics().trackedDevices,0);
 const legacy=[],compat=createGamepadHost({definition:lab,inject:r=>legacy.push(r),getPads:()=>[pos({mapping:''})]});
 compat.enable();compat.poll();assert.deepEqual(legacy[0].payload,rows[0].payload);
 assert.equal('incompatibleDevices' in compat.diagnostics(),false);
});
test('asymmetric two-stick world vectors, reverse aim only, neutralize on remap and replay exact bytes',()=>{
 const g=profile(),r=new HeadlessRuntime(g,makeRegistry()),traceRows=[];
 let pads=[pos({mapping:''})];
 const host=createGamepadHost({definition:g,getPads:()=>pads,inject(sample){
  const tickIndex=r.tickIndex,event={...sample,tickIndex,timeUs:Math.ceil(tickIndex*1e6/60),seq:traceRows.length};
  traceRows.push(event);r.injectRaw(event);
 }});
 const vectors=()=>{const {axis,rightStick}=r.observe().state;return [axis,rightStick];};
 r.start();host.enable();
 try{
  host.poll();r.step(1);assert.deepEqual(vectors(),[[0,0],[0,0]]);
  pads=[pos()];host.poll();r.step(1);assert.deepEqual(vectors(),[[.7071,.7071],[-.7071,-.7071]]);
  pads=[pos({axes:[1,-1,1,-1]})];host.poll();r.step(1);assert.deepEqual(vectors(),[[.7071,.7071],[.7071,.7071]]);
  pads=[pos({mapping:''})];host.poll();r.step(1);assert.deepEqual(vectors(),[[0,0],[0,0]]);
  assert.deepEqual(Object.keys(r.snapshot().activePointers),[]);
  const trace={format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:g.id,gameRevision:g.revision,tickHz:60,seed:g.world.clock.seed,inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1'},events:[...traceRows,{source:'system',kind:'checkpoint',tickIndex:r.tickIndex,timeUs:Math.ceil(r.tickIndex*1e6/60),seq:traceRows.length,payload:{}}]};
  const save=createReplaySave(g,makeRegistry,trace),opened=openReplaySave(g,makeRegistry,save);
  try{assert.equal(opened.runtime.observe().exactHash,r.observe().exactHash);}finally{opened.runtime.dispose();}
 }finally{host.dispose();r.dispose();}
});
test('strict device-wide admission cannot mix policies or mislabel standard axis pairs',async()=>{
 const g=profile();assert.doesNotThrow(()=>validateGamepadBindings(g));
 for(const mutate of [x=>delete joy(x,'collect').mapping,x=>joy(x,'look').yAxis=3,x=>joy(x,'look').mapping='auto',x=>joy(x,'look').invertY='true',x=>joy(x,'collect').button=17,x=>joy(x,'collect').invertY=true]){
  const bad=profile();mutate(bad);
  assert.throws(()=>validateGamepadBindings(bad),e=>e.code==='A2G_E_INPUT_ACTION');
 }
 assert.doesNotThrow(()=>{const separate=profile();joy(separate,'collect').index=1;delete joy(separate,'collect').mapping;validateGamepadBindings(separate);});
 const svc=createContentService();
 assert.equal((await svc.release(JSON.stringify(g))).id,g.id);
});
