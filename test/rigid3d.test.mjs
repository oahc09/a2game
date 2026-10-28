import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {HeadlessRuntime,rigid3dDiagnostics} from '../dist/index.js';import {makeRegistry} from '../scripts/registry.mjs';
const load=id=>JSON.parse(fs.readFileSync('specs/v0.1/samples/games/'+id+'-candidate.game.json'));
test('locked rigid3d integration gives real contact torque, exact snapshot replay and no retained native worlds',()=>{
 const d=load('g28'),r=new HeadlessRuntime(d,makeRegistry());r.start();
 try{for(const [action,value]of [['drag',[0.75,0.5]],['drop',undefined]]){r.injectAction({action,phase:'press',...(value?{value}: {})});r.injectAction({action,phase:'release'});r.step();}
  r.step(40);const snap=r.snapshot();r.step(200);const failed=r.observe();assert.equal(failed.flow.status,'lost');assert.ok(Math.abs(failed.state.rigid.bodies[1].w[2])>100000);assert.ok(Math.abs(failed.state.rigid.bodies[1].e[2])>100000);
  r.restore(snap);r.step(200);assert.equal(r.observe().exactHash,failed.exactHash);assert.equal(rigid3dDiagnostics().activeWorlds,0);
 }finally{r.dispose();}assert.equal(rigid3dDiagnostics().activeWorlds,0);
 const ball=new HeadlessRuntime(load('g15'),makeRegistry());ball.start();const contacts=new Set();
 try{ball.injectAction({action:'kick',phase:'press'});ball.injectAction({action:'kick',phase:'release'});ball.step();ball.injectAction({action:'kick',phase:'press'});ball.injectAction({action:'kick',phase:'release'});
  for(let i=0;i<180&&ball.status==='playing';i++){ball.step();const body=ball.observe().state.rigid.bodies[1];assert.ok(Math.abs(body.p[0])<2000000);assert.ok(Math.hypot(...body.v)/1000000<9);for(const c of ball.observe().state.rigid.contacts)contacts.add(c);}
  assert.equal(ball.status,'won');assert.ok(contacts.has('back|ball'));assert.equal(rigid3dDiagnostics().activeWorlds,0);
 }finally{ball.dispose();}
 const invalid=load('g15');invalid.scenes[0].entities[0].components[0].config.bodies[1].size[1]=1;assert.throws(()=>new HeadlessRuntime(invalid,makeRegistry()));
 const unknown=load('g28');unknown.scenes[0].entities[0].components[0].config.requiredBodies=16;assert.throws(()=>new HeadlessRuntime(unknown,makeRegistry()));
});
