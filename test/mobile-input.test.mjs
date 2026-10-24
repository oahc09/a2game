import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,replayNormalizedInputTrace} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createTraceRecorder} from '../player/mobile-host.mjs';
const game=()=>JSON.parse(readFileSync('specs/v0.1/samples/games/mobile-input-lab.game.json'));
const start=()=>{const r=new HeadlessRuntime(game(),makeRegistry());r.start();return r;};
const pointer=(r,kind,id,u,v)=>r.injectRaw({source:'pointer',kind,payload:{pointerId:id,u,v},timeUs:Math.ceil(r.observe().tickIndex*1000000/60)});
const imu=(r,kind,orientationRad,extra={})=>r.injectRaw({source:'imu',kind,payload:{reference:'device-euler-rad-v1',screenAngle:0,orientationRad,angularVelocityRadps:[0,0,0],linearAccelerationMps2:[0,0,0],...extra}});
test('multi-pointer identities, pinch/rotate and held actions arbitrate and cancel without fabricated taps',()=>{
 const r=start();pointer(r,'down',1,0.25,0.5);pointer(r,'down',2,0.75,0.5);r.step();pointer(r,'move',2,0.75,0.75);r.step(2);
 assert.equal(r.observe().state.pinch,1.118);assert.equal(r.observe().state.rotate,0.4636);assert.equal(r.observe().state.multi,0); // moving exceeded multi-hold travel budget
 pointer(r,'cancel',1,0.25,0.5);pointer(r,'up',2,0.75,0.75);r.step();assert.equal(r.observe().state.hold,0);assert.equal(r.observe().state.double,0);
 pointer(r,'down',3,0.3,0.3);r.step(3);assert.equal(r.observe().state.hold,1);pointer(r,'cancel',3,0.3,0.3);r.step();assert.deepEqual(r.snapshot().pressedSources.hold,[]);
 pointer(r,'down',4,0.2,0.2);pointer(r,'down',5,0.8,0.2);r.step(3);assert.equal(r.observe().state.multi,1);pointer(r,'cancel',4,0.2,0.2);r.step();assert.deepEqual(r.snapshot().pressedSources.multi,[]);r.dispose();
 const bad=game();bad.inputs.actions.find(action=>action.id==='drag').valueType='button';assert.throws(()=>new HeadlessRuntime(bad,makeRegistry()),error=>error.code==='A2G_E_INPUT_ACTION');
 const bounded=start(),initial=bounded.observe().state;for(let i=0;i<11;i++)pointer(bounded,'down',i,0.5,0.5);assert.throws(()=>bounded.step(),error=>error.code==='A2G_E_INPUT_RAW');assert.deepEqual(bounded.observe().state,initial);assert.deepEqual(bounded.snapshot().activePointers,{});bounded.dispose();
});
test('IMU tilt requires calibration, unavailable channels never fabricate samples, screen changes invalidate calibration',()=>{
 const r=start();imu(r,'sample',[0,0.35,0.7]);r.step();assert.deepEqual(r.observe().state.tilt,[0,0]);imu(r,'calibrate',[0,0,0]);r.step();
 imu(r,'sample',[0,0.35,0.7],{linearAccelerationMps2:[20,0,0],available:{linearAcceleration:false,angularVelocity:false}});r.step();assert.deepEqual(r.observe().state.tilt,[1,0.5]);assert.equal(r.observe().state.shake,0);
 const snap=r.snapshot();imu(r,'sample',[0,0.1,0.2]);r.step();const hash=r.observe().exactHash;r.restore(snap);imu(r,'sample',[0,0.1,0.2]);r.step();assert.equal(r.observe().exactHash,hash);
 imu(r,'sample',[0,0.35,0.7],{screenAngle:90});r.step();assert.equal(r.snapshot().activePointers['~imu'],undefined);r.pause();r.resume();assert.deepEqual(r.snapshot().activePointers,{});r.dispose();
});
test('opt-in raw/action/control recording replays pause, cancellation and the final tick boundary exactly',()=>{
 const d=game(),r=new HeadlessRuntime(d,makeRegistry());r.start();let seq=0;const recorder=createTraceRecorder(d,()=>seq++);recorder.start();
 const raw=(kind)=>{const input={source:'pointer',kind,tickIndex:r.observe().tickIndex,seq:seq++,timeUs:Math.ceil(r.observe().tickIndex*1000000/60),payload:{pointerId:1,u:0.5,v:0.5}};r.injectRaw(input);recorder.raw(input);};
 raw('down');r.step(3);recorder.control('pause',3);r.pause();recorder.control('resume',3);r.resume();raw('up');r.step();
 for(const phase of ['press','release']){const input={action:'shake',phase,sourceId:'ui:shake',seq:seq++,tickIndex:4,timeUs:Math.ceil(4*1000000/60)};r.injectAction(input);recorder.action(input,4,input.timeUs);}r.step(2);recorder.stop(6);
 const trace=recorder.export(),replayed=new HeadlessRuntime(d,makeRegistry());const receipt=replayNormalizedInputTrace(replayed,trace);assert.equal(receipt.finalHash,r.observe().exactHash);assert.equal(receipt.advanced,6);
 const bad=structuredClone(trace);bad.events[0]={...bad.events[0],source:'system',kind:'execute'};const rejected=new HeadlessRuntime(d,makeRegistry());assert.throws(()=>replayNormalizedInputTrace(rejected,bad));assert.equal(rejected.status,'ready');rejected.dispose();recorder.dispose();assert.equal(recorder.diagnostics().count,0);r.dispose();replayed.dispose();
});
