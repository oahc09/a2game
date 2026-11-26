import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {HeadlessRuntime,replayNormalizedInputTrace,A2GameError} from '../dist/index.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';
const game=()=>readJson(resolve(spec,'games/grid-push.game.json'));
const trace=()=>readJson(resolve(spec,'tests/grid-push-swipe.input-trace.json'));
const input=(rt,id,kind,u,v,timeUs,seq)=>rt.injectRaw({source:'pointer',kind,tickIndex:rt.observe().tickIndex,timeUs,seq,payload:{pointerId:id,pointerType:'touch',u,v}});
test('single-pointer swipe follows declared direction and moves box to goal',()=>{
 const rt=new HeadlessRuntime(game(),makeRegistry());rt.start();
 input(rt,1,'down',.5,.75,1000,0);rt.step(10);input(rt,1,'up',.7,.75,180000,1);rt.step();
 assert.equal(rt.observe().state.player,17);
 rt.step(7);input(rt,2,'down',.6,.7,300000,2);rt.step(9);input(rt,2,'up',.6,.35,450000,3);rt.step();
 assert.equal(rt.observe().flow.status,'won');assert.deepEqual(rt.observe().state.boxes,[7]);
});
test('trace replay is reproducible and matches manually normalized Touch samples',()=>{
 const a=new HeadlessRuntime(game(),makeRegistry()),b=new HeadlessRuntime(game(),makeRegistry());
 const out=replayNormalizedInputTrace(a,trace());
 assert.equal(out.advanced,28);assert.equal(out.consumed,4);assert.equal(out.finalStatus,'won');
 b.start();input(b,1,'down',.5,.75,1000,0);b.step(10);input(b,1,'up',.7,.75,180000,1);b.step();
 b.step(7);input(b,2,'down',.6,.7,300000,2);b.step(9);input(b,2,'up',.6,.35,450000,3);b.step();
 assert.equal(out.finalHash,b.observe().exactHash);
});
test('pointer cancellation, short displacement and multi-touch identity do not fabricate game actions',()=>{
 const rt=new HeadlessRuntime(game(),makeRegistry());rt.start();
 input(rt,1,'down',.5,.6,100,0);input(rt,2,'down',.4,.3,110,1);
 input(rt,1,'cancel',.9,.6,150,2);input(rt,2,'up',.42,.3,200,3);
 rt.step();assert.equal(rt.observe().state.moves,0);assert.deepEqual(rt.snapshot().activePointers,{});
});
test('invalid trace identity and out-of-order events fail before runtime start',()=>{
 const rt=new HeadlessRuntime(game(),makeRegistry());
 const wrong=trace();wrong.session.gameRevision=99;
 assert.throws(()=>replayNormalizedInputTrace(rt,wrong),e=>e instanceof A2GameError&&e.code==='A2G_E_INPUT_RAW'&&e.info.jsonPointer==='/session/gameRevision');
 const wrongProfile=trace();wrongProfile.session.coordinateProfile='scene2d-contain-v1';
 assert.throws(()=>replayNormalizedInputTrace(rt,wrongProfile),e=>e.code==='A2G_E_INPUT_RAW'&&
  e.info.jsonPointer==='/session/coordinateProfile'&&e.info.expected==='viewport-top-left-v1'&&e.info.actual==='scene2d-contain-v1');
 assert.equal(rt.status,'ready');
 const order=trace();order.events.reverse();
 assert.throws(()=>replayNormalizedInputTrace(rt,order),e=>e.code==='A2G_E_INPUT_RAW');
 assert.equal(rt.status,'ready');
 const wrongTime=trace();wrongTime.events[1].timeUs=17000;
 assert.throws(()=>replayNormalizedInputTrace(rt,wrongTime),e=>e.code==='A2G_E_INPUT_RAW');
 assert.equal(rt.status,'ready');
 const boundary=trace();boundary.events=[{source:'system',kind:'checkpoint',tickIndex:14,seq:0,timeUs:233333,payload:{}}];
 assert.equal(boundary.session.tickHz,60);
 assert.throws(()=>replayNormalizedInputTrace(rt,boundary),e=>e.code==='A2G_E_INPUT_RAW'&&
  e.info.jsonPointer==='/events/0/timeUs'&&e.info.expected.minTimeUs===233334&&e.info.actual===233333);
 assert.equal(rt.status,'ready');
 const wrongPointer=trace();
 wrongPointer.events[0].payload={pointerId:1,x:0.5,y:0.75};
 assert.throws(()=>replayNormalizedInputTrace(rt,wrongPointer),
  e=>e.code==='A2G_E_INPUT_RAW'&&e.info.jsonPointer==='/events/0/payload'&&/u\/v/.test(e.message));
 assert.equal(rt.status,'ready');
 boundary.events[0].timeUs=233334;
 assert.equal(replayNormalizedInputTrace(rt,boundary).advanced,14);
});
