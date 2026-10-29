import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {HeadlessRuntime,projectPresentation,compileGame,A2GameError} from '../dist/index.js';
import {makeRegistry,spec} from '../scripts/registry.mjs';
const def=name=>JSON.parse(readFileSync(resolve(spec,'games',name+'.game.json'),'utf8'));
const act=(rt,name)=>{rt.injectAction({action:name,phase:'press',sourceId:'test:'+name});rt.injectAction({action:name,phase:'release',sourceId:'test:'+name});rt.step(1);};
test('all game definitions generate bounded generic presentation primitives, without mutating state',()=>{
 for(const name of ['tap-target','grid-merge','grid-merge-spawn','grid-push']){
  const d=def(name),rt=new HeadlessRuntime(d,makeRegistry());rt.start();
  const before=rt.observe().exactHash,frame=projectPresentation(d,rt.observe());
  assert.ok(frame.commands.length>0&&frame.commands.length<=640);
  assert.ok(frame.commands.every(x=>['text','rect','circle'].includes(x.kind)));
  assert.equal(before,rt.observe().exactHash);
  assert.equal(frame.width,d.presentation.scene2d.width);
  rt.dispose();
 }
});
test('grid-push presents one player, boxes and goals, and updates strictly from logical state',()=>{
 const d=def('grid-push'),rt=new HeadlessRuntime(d,makeRegistry());rt.start();
 let frame=projectPresentation(d,rt.observe());
 assert.deepEqual(frame.commands.filter(x=>x.id.startsWith('player')).map(x=>x.at),[[-1,-1]]);
 act(rt,'moveRight');frame=projectPresentation(d,rt.observe());
 assert.deepEqual(frame.commands.filter(x=>x.id.startsWith('player')).map(x=>x.at),[[0,-1]]);
 act(rt,'moveUp');frame=projectPresentation(d,rt.observe());
 assert.equal(rt.status,'won');
 assert.deepEqual(frame.commands.filter(x=>x.id.startsWith('boxes')).map(x=>x.at),[[0,1]]);
 assert.deepEqual(frame.commands.filter(x=>x.id.startsWith('player')).map(x=>x.at),[[0,0]]);
});
test('presentation rejects arbitrary scripts, invalid bindings, excessive repeat values and missing capability',()=>{
 const d=def('grid-merge');
 const unauthorized=structuredClone(d);unauthorized.presentation.scene2d.nodes[0].onClick="alert('x')";
 assert.throws(()=>compileGame(unauthorized,makeRegistry()),e=>e instanceof A2GameError&&e.code==='A2G_E_PRESENTATION');
 const badBinding=structuredClone(d);badBinding.presentation.scene2d.nodes[0].fill={from:{state:'/secret'},map:{},fallback:'#ffffff'};
 assert.throws(()=>compileGame(badBinding,makeRegistry()),e=>e instanceof A2GameError&&e.code==='A2G_E_PRESENTATION');
 const missing=structuredClone(d);missing.requires.all=missing.requires.all.filter(x=>x.id!=='a2game.visual.scene2d');
 assert.throws(()=>compileGame(missing,makeRegistry()),e=>e instanceof A2GameError&&e.code==='A2G_E_CAP_DEPENDENCY');
 const rt=new HeadlessRuntime(d,makeRegistry());rt.start();
 const big=structuredClone(d);big.presentation.scene2d.repeat[0].source={literal:Array.from({length:257},(_,i)=>i)};
 assert.throws(()=>projectPresentation(big,rt.observe()),e=>e.code==='A2G_E_BUDGET_EXCEEDED');
});
test('grid-push illegal moves are no-ops and do not drift RNG or hash',()=>{
 const d=def('grid-push'),rt=new HeadlessRuntime(d,makeRegistry());rt.start();
 const rng=rt.snapshot().rng;
 act(rt,'moveLeft');assert.equal(rt.observe().state.player,16);assert.equal(rt.observe().state.moves,0);
 assert.deepEqual(rt.snapshot().rng,rng);
 act(rt,'moveRight');assert.equal(rt.observe().state.player,17);
 act(rt,'moveUp');assert.deepEqual(rt.observe().state.boxes,[7]);assert.equal(rt.status,'won');
 assert.equal(rt.observe().events.filter(x=>x.type==='grid.box-pushed').length,1);
 rt.restart();assert.equal(rt.observe().state.player,16);assert.deepEqual(rt.observe().state.boxes,[12]);
});
test('grid-push rejects invalid overlapping layout at tick boundary without partial state commit',()=>{
 const d=def('grid-push');d.state.boxes.initial=[0];
 const rt=new HeadlessRuntime(d,makeRegistry());rt.start();
 assert.throws(()=>rt.step(1),e=>e.code==='A2G_E_STATE_TYPE');
 assert.equal(rt.observe().tickIndex,0);assert.deepEqual(rt.observe().state.boxes,[0]);assert.equal(rt.status,'error');
});
