import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {readJson,spec,makeRegistry} from '../scripts/registry.mjs';
const game=()=>readJson(`${spec}/games/visual-stage.game.json`);
test('visual-stage projects bindings, animation, bounded particles and event audio without changing exact state',()=>{
  const definition=game();definition.presentation.stage.camera.projection='orthographic';definition.presentation.stage.camera.fitSize=[10,8];const runtime=new HeadlessRuntime(definition,makeRegistry());runtime.start();
  const initial=runtime.observe(),first=projectPresentation(definition,initial);assert.equal(first.stage.nodes.length,15);assert.deepEqual(first.stage.camera.fitSize,[10,8]);
  assert.equal(first.stage.nodes.find(node=>node.id==='cube').asset,'checker');assert.equal(runtime.observe().exactHash,initial.exactHash);
  runtime.step(15);const second=projectPresentation(definition,runtime.observe());assert.notDeepEqual(first.stage.nodes[0].rotation,second.stage.nodes[0].rotation);
  runtime.pause();runtime.step(60);assert.deepEqual(projectPresentation(definition,runtime.observe()),second);
  runtime.resume();runtime.injectAction({action:'collect',phase:'press'});runtime.step(1);const frame=projectPresentation(definition,runtime.observe());
  assert.equal(frame.stage.nodes.find(node=>node.id==='scoreOrb').at[0],1);assert.ok(frame.stage.audio.length>0);
  runtime.step(1);assert.deepEqual(projectPresentation(definition,runtime.observe()).stage.audio,frame.stage.audio,'historical events keep stable playback keys across Tick changes');
  runtime.restart();assert.deepEqual(projectPresentation(definition,runtime.observe()).stage.nodes,first.stage.nodes);runtime.dispose();
});
test('visual-stage rejects missing capability, unsupported material, bad resource and particle budget before execution',()=>{
  for(const change of [g=>{g.presentation.stage.camera.fitSize=[0,8];},g=>{g.presentation.stage.camera.fitSize=[10,8];},g=>{g.requires.all=g.requires.all.filter(ref=>ref.id!=='a2game.visual.stage');},g=>{g.presentation.stage.nodes[0].material='eval';},g=>{g.presentation.stage.nodes[1].asset='missing';},g=>{g.presentation.stage.particles[0].count=129;},g=>{g.presentation.stage.nodes[0].at[0]={state:'score'};}]){
    const invalid=game();change(invalid);assert.throws(()=>new HeadlessRuntime(invalid,makeRegistry()),error=>['A2G_E_PRESENTATION','A2G_E_CAP_DEPENDENCY'].includes(error.code));
  }
});
