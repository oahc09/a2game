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
 assert.throws(()=>replayNormalizedInputTrace(rt,wrong),e=>e instanceof A2GameError&&e.code==='A2G_E_INPUT_RAW');
 assert.equal(rt.status,'ready');
 const order=trace();order.events.reverse();
 assert.throws(()=>replayNormalizedInputTrace(rt,order),e=>e.code==='A2G_E_INPUT_RAW');
 assert.equal(rt.status,'ready');
 const wrongTime=trace();wrongTime.events[1].timeUs=17000;
 assert.throws(()=>replayNormalizedInputTrace(rt,wrongTime),e=>e.code==='A2G_E_INPUT_RAW');
 assert.equal(rt.status,'ready');
});
