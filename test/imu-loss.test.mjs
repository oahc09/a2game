import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {HeadlessRuntime} from '../dist/index.js';import {makeRegistry} from '../scripts/registry.mjs';
const game=id=>JSON.parse(readFileSync('specs/v0.1/games/'+id+'-candidate.game.json','utf8'));
const raw=(kind,orientationRad=[0,0,0],available=true)=>({source:'imu',kind,payload:{reference:'device-euler-rad-v1',screenAngle:0,orientationRad,angularVelocityRadps:[0,0,0],linearAccelerationMps2:[0,0,0],available:{orientation:available,linearAcceleration:true,angularVelocity:true}}});
test('opted-in IMU controllers clear cached force/aim on recalibration, unavailable samples and reset; restored traces agree',()=>{
 const bad=game('g27');bad.inputs.actions.find(a=>a.id==='tilt').bindings[0].config.trackSample='yes';assert.throws(()=>new HeadlessRuntime(bad,makeRegistry()),e=>e.code==='A2G_E_CAP_CONFIG');
 const badControl=game('g30');badControl.scenes[0].entities.flatMap(e=>e.components).find(c=>c.capability.id==='a2game.realtime.input-control').config.cancelClearsPower='yes';assert.throws(()=>new HeadlessRuntime(badControl,makeRegistry()),e=>e.code==='A2G_E_CAP_CONFIG');
 const untracked=game('g31');untracked.inputs.actions.find(a=>a.id==='orientation').bindings[0].config.trackSample=false;assert.throws(()=>new HeadlessRuntime(untracked,makeRegistry()),e=>e.code==='A2G_E_CAP_CONFIG');
 for(const id of ['g27','h04','g31']){
  const r=new HeadlessRuntime(game(id),makeRegistry()),input=sample=>{r.injectRaw(sample);r.step();};r.start();try{
   input(raw('calibrate'));input(raw('sample',[0,0,id==='g31'?Math.PI/2:.7]));let s=r.observe().state;if(id==='g31')assert.ok(s.control.aim[1]>.99);else assert.ok(s.control.axis[0]>.2);
   const velocity=s.world.bodies.map(b=>b.vx);input(raw('calibrate'));s=r.observe().state;if(id==='g31')assert.deepEqual(s.control.aim,[0,0]);else assert.deepEqual(s.control.axis,[0,0]);if(id==='h04')assert.deepEqual(s.world.bodies.map(b=>b.vx),velocity);
   input(raw('sample',[0,0,.7]));input(raw('sample',[0,0,.7],false));s=r.observe().state;assert.deepEqual(id==='g31'?s.control.aim:s.control.axis,[0,0]);
   input(raw('sample',[0,0,.7]));assert.deepEqual(id==='g31'?r.observe().state.control.aim:r.observe().state.control.axis,[0,0]);
   input(raw('calibrate'));input(raw('sample',[0,0,.7]));const saved=r.snapshot();input({source:'imu',kind:'reset',payload:{}});const hash=r.observe().exactHash;r.restore(saved);input({source:'imu',kind:'reset',payload:{}});assert.equal(r.observe().exactHash,hash);
  }finally{r.dispose();}
 }
 const rigid=new HeadlessRuntime(game('g28'),makeRegistry());rigid.start();try{for(const sample of [raw('calibrate'),raw('sample',[0,0,.7])]){rigid.injectRaw(sample);rigid.step();}assert.ok(rigid.observe().state.rigid.axis[0]>.2);rigid.injectRaw(raw('calibrate'));rigid.step();assert.deepEqual(rigid.observe().state.rigid.axis,[0,0]);}finally{rigid.dispose();}
});
