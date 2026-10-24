import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,rotatePolyomino,clearLines,connectedCells} from '../dist/index.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';
const game=name=>readJson(`${spec}/samples/games/puzzle-${name}.game.json`);
const runtime=definition=>{const r=new HeadlessRuntime(definition,makeRegistry());r.start();return r;};
const act=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step(1);};
test('match rejects illegal swaps without RNG use and undo restores board, counters and RNG before identical refill',()=>{
  const def=game('match');def.scenes[0].entities[0].components[0].config.targetScore=1000;
  const r=runtime(def),initial=r.snapshot();act(r,'cell0');act(r,'cell2');assert.deepEqual(r.snapshot().rng,initial.rng);assert.deepEqual(r.observe().state.puzzle.board,initial.state.puzzle.board);
  act(r,'cell1');act(r,'cell4');const first=r.snapshot();assert.equal(first.state.puzzle.score,3);assert.notDeepEqual(first.rng,initial.rng);
  act(r,'undo');assert.deepEqual(r.observe().state.puzzle.board,initial.state.puzzle.board);assert.deepEqual(r.snapshot().rng,initial.rng);assert.equal(r.observe().state.puzzle.moves,0);
  act(r,'cell1');act(r,'cell4');assert.deepEqual(r.observe().state.puzzle.board,first.state.puzzle.board);assert.deepEqual(r.snapshot().rng,first.rng);r.dispose();
  const slide=runtime(game('slide-undo')),before=slide.snapshot();act(slide,'moveLeft');const moved=slide.snapshot();act(slide,'undo');assert.deepEqual(slide.snapshot().rng,before.rng);act(slide,'moveLeft');assert.deepEqual(slide.observe().state.board,moved.state.board);slide.dispose();
});
test('occlusion and tray capacity are enforced; memory closes on logical ticks and undo preserves a revealed card',()=>{
  const def=game('tray');def.scenes[0].entities[0].components[0].config.capacity=2;const tray=runtime(def);act(tray,'cell0');assert.equal(tray.observe().state.puzzle.moves,0);act(tray,'cell2');act(tray,'cell4');assert.equal(tray.status,'lost');assert.equal(tray.observe().state.puzzle.tray.length,2);tray.dispose();
  const memory=runtime(game('memory'));act(memory,'cell0');act(memory,'cell1');act(memory,'cell2');assert.deepEqual(memory.observe().state.puzzle.selected,[0,1]);memory.step(1);assert.deepEqual(memory.observe().state.puzzle.selected,[]);
  act(memory,'cell0');act(memory,'cell2');assert.equal(memory.observe().state.puzzle.score,2);act(memory,'undo');assert.deepEqual(memory.observe().state.puzzle.selected,[0]);assert.equal(memory.observe().state.puzzle.score,0);memory.dispose();
});
test('polyomino rotation/line clearing is bounded, illegal placement is atomic, and falling pieces freeze while paused',()=>{
  const shape=[[0,0],[0,1],[1,1]];assert.deepEqual(rotatePolyomino(shape,4),shape);assert.equal(new Set(rotatePolyomino(shape,1).map(String)).size,3);
  assert.deepEqual(clearLines([1,1,1,0],2,2),{board:[0,0,0,0],lines:2});assert.deepEqual(connectedCells([1,2,1,1],0,2,2),[0,2,3]);
  const poly=runtime(game('polyomino'));act(poly,'cell1');assert.equal(poly.observe().state.puzzle.history.length,0);assert.deepEqual(poly.observe().state.puzzle.board,[0,0,0,0]);poly.dispose();
  const falling=runtime(game('falling')),anchor=falling.observe().state.puzzle.anchor;falling.pause();falling.step(100);assert.equal(falling.observe().tickIndex,0);falling.resume();falling.step(30);assert.equal(falling.observe().state.puzzle.anchor,anchor+4);falling.dispose();
});
test('sorting conserves tile mass and invalid colors/occlusion cycles fail without partial mutation',()=>{
  const sort=runtime(game('sort')),initial=sort.observe().state.puzzle.tubes.flat().sort();act(sort,'cell0');act(sort,'cell1');assert.equal(sort.observe().state.puzzle.moves,0);
  for(const action of ['cell0','cell2','cell1','cell3','cell0','cell3','cell1','cell2']){act(sort,action);assert.deepEqual(sort.observe().state.puzzle.tubes.flat().sort(),initial);}assert.equal(sort.status,'won');sort.dispose();
  const invalid=game('tray');invalid.scenes[0].entities[0].components[0].config.blockers=[[1],[0],[],[],[],[]];assert.throws(()=>new HeadlessRuntime(invalid,makeRegistry()),{code:'A2G_E_CAP_CONFIG'});
  const composite=game('match');composite.scenes[0].entities[0].components.push(structuredClone(composite.scenes[0].entities[0].components[0]));assert.throws(()=>new HeadlessRuntime(composite,makeRegistry()),{code:'A2G_E_CAP_CONFIG'});
});
