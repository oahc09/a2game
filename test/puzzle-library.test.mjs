import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,replayNormalizedInputTrace,rotatePolyomino,clearLines,connectedCells,findMatches} from '../dist/index.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';
import {solveButtons} from '../scripts/agent-solver.mjs';
import {scoreStars,starThresholds} from '../player/score-record.mjs';
import {createPuzzleSave} from '../player/tray-save.mjs';
import {collectibleFace,dropSpecialColumn,dropSpecialPath,planSpecialCombo,planSpecials,resolveSpecialHits,specialRuns} from '../dist/modules/match-specials.js';
const game=name=>readJson(`${spec}/games/puzzle-${name}.game.json`);
const runtime=definition=>{const r=new HeadlessRuntime(definition,makeRegistry());r.start();return r;};
const act=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step(1);};
test('puzzle version changes keep the previous journal and wait for an explicit restart',()=>{
 const registry=makeRegistry();
 for(const [folder,gameFile,traceFile,events] of [
  ['pattern-harbor','resume.game.json','challenge-win-trace.json',2],
  ['tideglass-match','m12.game.json','m12-win-trace.json',3],
 ]){
  const dir=`games/business-complete/${folder}/`;
  const game=readJson(dir+gameFile),trace=readJson(dir+traceFile);
  trace.session.gameRevision=game.revision;
  trace.events=trace.events.slice(0,events);
  const entries=new Map();
  const storage={
   get length(){return entries.size;},key:index=>[...entries.keys()][index]??null,
   getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key),
  };
  const save=definition=>createPuzzleSave(definition,registry,()=>storage);
  const previous=new HeadlessRuntime(game,registry);
  try{
   replayNormalizedInputTrace(previous,trace);
   assert.equal(previous.observe().state.puzzle.moves,1);
   save(game).observe(previous,previous.observe());
   const [[previousKey,previousValue]]=entries;
   const updated=structuredClone(game);
   updated.revision++;updated.world.clock.seed++;
   const current=save(updated);
   assert.equal(current.restore(),null);
   assert.equal(current.needsRestart(),true);
   assert.match(current.status(),/旧版局中存档与当前版本不兼容/);
   current.reset();
   assert.equal(current.needsRestart(),false);
   const reopened=save(updated);
   assert.equal(reopened.restore(),null);
   assert.equal(reopened.needsRestart(),false);
   assert.equal(entries.get(previousKey),previousValue);
   const restored=save(game).restore();
   assert.ok(restored);
   try{assert.deepEqual(restored.observe().state.puzzle.board,previous.observe().state.puzzle.board);}
   finally{restored.dispose();}
  }finally{previous.dispose();}
 }
});
test('dead board shuffle preserves pieces and ends an impossible board after 64 attempts',()=>{
 const read=id=>readJson(`games/business-complete/tideglass-match/${id}.game.json`);
 const available=read('m01'),p=available.state.puzzle.initial;
 available.scenes[0].entities[0].components[0].config.deadboardShuffle=true;
 p.board=Array.from({length:25},(_,cell)=>(cell%5+Math.floor(cell/5))%5+1);p.display=[...p.board];
 const first=runtime(available),again=runtime(available);
 try{
  first.step(1);again.step(1);
  const observation=first.observe(),shuffled=observation.state.puzzle;
  assert.equal(observation.flow.status,'playing');
  assert.equal(observation.events.find(event=>event.type==='puzzle.deadboard').payload.recovered,true);
  assert.deepEqual(first.snapshot().rng,again.snapshot().rng);
  assert.deepEqual(shuffled,again.observe().state.puzzle);
  assert.deepEqual([...shuffled.board].sort(),[...p.board].sort());
  assert.deepEqual(findMatches(shuffled.board,5,5),[]);
  assert.deepEqual([shuffled.moves,shuffled.score,shuffled.goalRemaining],[0,0,p.goalRemaining]);
 }finally{first.dispose();again.dispose();}
 const impossible=read('m08'),initial=impossible.state.puzzle.initial;
 impossible.scenes[0].entities[0].components[0].config.outletLayout.paths=[[0,5],[1,6]];
 impossible.scenes[0].entities[0].components[0].config.outletLayout.outlets=[5];
 initial.board=Array.from({length:25},(_,i)=>({0:collectibleFace,1:1,5:2,6:3})[i]??0);
 initial.pieceIds=initial.board.map((face,i)=>face?i:-1);
 initial.display=initial.board.map(face=>face===collectibleFace?24:face||-1);
 const failed=runtime(impossible);
 try{
  failed.step(1);
  const outcome=failed.observe();
  assert.equal(outcome.flow.status,'lost');
  assert.deepEqual(outcome.events.find(event=>event.type==='puzzle.deadboard').payload,{recovered:false,attempts:64});
  assert.deepEqual(outcome.state.puzzle.board,initial.board);
  assert.equal(outcome.state.puzzle.collectionRemaining,1);
 }finally{failed.dispose();}
});
test('a completed level earns stars at the exact published thresholds',()=>{
 assert.deepEqual(starThresholds(101),[101,152,202]);
 assert.deepEqual([100,101,151,152,201,202].map(score=>scoreStars('won',score,101)),[1,1,1,2,2,3]);
 assert.equal(scoreStars('lost',202,101),0);
 assert.equal(scoreStars('playing',202,101),0);
});
test('a surviving box separates gravity segments and only the upper segment refills',()=>{
 const board=[1,0,2,0,0,3],specials=Array(6).fill('none'),ids=[1,-1,2,-1,-1,3],boxes=[0,0,0,1,0,0];
 let id=10;
 dropSpecialColumn(board,specials,ids,boxes,1,6,0,()=>({face:4,id:id++}));
 assert.deepEqual(board,[4,1,2,0,0,3]);assert.deepEqual(ids,[10,1,2,-1,-1,3]);
 boxes[3]=0;
 dropSpecialColumn(board,specials,ids,boxes,1,6,0,()=>({face:5,id:id++}));
 assert.deepEqual(board,[5,5,4,1,2,3]);assert.deepEqual(ids,[12,11,10,1,2,3]);
});
test('cargo survives special hits and drains only through a declared outlet',()=>{
 const board=[collectibleFace,0,0,0,collectibleFace,0],specials=Array(6).fill('none'),ids=[1,-1,-1,-1,2,-1];
 const create=()=>({face:3,id:3});
 assert.deepEqual(resolveSpecialHits(board,specials,1,6,[0,4],new Set()).cleared,[]);
 assert.deepEqual(dropSpecialPath(board,specials,ids,[],[0,1],false,true,create),[1]);
 assert.deepEqual(dropSpecialPath(board,specials,ids,[],[4,5],false,false,create),[]);
 assert.deepEqual(board,[0,0,0,0,0,collectibleFace]);
 assert.deepEqual(ids,[-1,-1,-1,-1,-1,2]);
 assert.deepEqual(dropSpecialPath(board,specials,ids,[],[0,1],false,true,create),[]);
});
test('special blocks resolve overlapping run priority and deduplicate protected chain hits',()=>{
 const board=Array(25).fill(0),kinds=Array(25).fill('none');
 for(const cell of [10,11,12,13,14,7,17])board[cell]=1;
 kinds[12]='row';
 const plan=planSpecials(specialRuns(board,5,5),kinds,[12,13]);
 assert.deepEqual(plan,[{cell:13,kind:'color'}]);
 kinds[7]='column';
 const result=resolveSpecialHits(board,kinds,5,5,[12,7,12],new Set([13]));
 assert.deepEqual(result.activated,[7,12]);
 assert.deepEqual(result.cleared,[7,10,11,12,14,17]);
});
test('six combinations use destination geometry and skip separate activation of the pair',()=>{
 const source=23,target=24,ids=Array.from({length:49},(_,i)=>48-i);
 for(const [a,b,kind,size] of [
  ['row','column','line+line',13],['column','burst','burst+line',33],
  ['burst','burst','burst+burst',25],['color','color','color+color',49],
  ['color','column','color+line',2],['burst','color','burst+color',2]
 ]){
  const board=Array(49).fill(1),specials=Array(49).fill('none');
  specials[source]=a;specials[target]=b;
  board[source]=a==='color'?13:2;board[target]=b==='color'?13:2;
  board[3]=2;board[45]=2;
  const combo=planSpecialCombo(board,specials,ids,7,7,source,target);
  assert.equal(combo.kind,kind);assert.equal(combo.footprint.length,size);
  if(combo.converted.length){
   assert.deepEqual(combo.converted,[45,3]);
   assert(specials[45]==='column'||specials[45]==='burst');
  }
  const result=resolveSpecialHits(board,specials,7,7,combo.footprint,new Set(),undefined,combo);
  assert(result.cleared.includes(source)&&result.cleared.includes(target));
  assert(!result.activated.includes(source)&&!result.activated.includes(target));
  assert.equal(new Set(result.cleared).size,result.cleared.length);
  if(combo.converted.length)assert.deepEqual(result.activated,[45,3]);
 }
});
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
function trayBoundary(board,width,blockers=board.map(()=>[])){
 const definition=game('tray');
 const config=definition.scenes[0].entities[0].components[0].config;
 const action=definition.inputs.actions[0];
 const actions=board.map((_,i)=>({...structuredClone(action),id:`cell${i}`,bindings:[{source:'keyboard.button',config:{code:`Key${String.fromCharCode(65+i)}`}}]}));
 definition.inputs.actions=[...actions,definition.inputs.actions.find(a=>a.id==='undo')];
 Object.assign(config,{width,height:board.length/width,capacity:7,blockers,selectActions:actions.map(a=>a.id)});
 Object.assign(definition.state.puzzle.initial,{board,display:board.map((face,i)=>blockers[i].length?0:face)});
 return definition;
}
test('SHEEP-02 two independent blockers must both be removed before a lift can commit',()=>{
 const definition=trayBoundary([1,2,3],3,[[1,2],[],[]]);
 const r=runtime(definition);
 try{
  const initial=r.observe().state.puzzle;
  act(r,'cell0');act(r,'cell0');
  assert.deepEqual(r.observe().state.puzzle,initial);
  act(r,'cell1');
  const oneBlocker=r.observe().state.puzzle;
  act(r,'cell0');
  assert.deepEqual(r.observe().state.puzzle,oneBlocker);
  act(r,'cell2');act(r,'cell0');
  assert.deepEqual(r.observe().state.puzzle.tray,[2,3,1]);
  assert.equal(r.observe().state.puzzle.moves,3);
  const cycle=trayBoundary([1,2,3],3,[[1],[2],[0]]);
  assert.throws(()=>new HeadlessRuntime(cycle,makeRegistry()),/Cyclic occlusion graph at blockers\[0\]: 0 -> 1 -> 2 -> 0/);
  const selfCycle=trayBoundary([1,2,3],3,[[],[1],[]]);
  assert.throws(()=>new HeadlessRuntime(selfCycle,makeRegistry()),/Cyclic occlusion graph at blockers\[1\]: 1 -> 1/);
 }finally{r.dispose();}
});
test('SHEEP-04 clears the seventh card before evaluating capacity and ignores a repeat',()=>{
 const r=runtime(trayBoundary([1,1,2,3,4,5,1,6],8));
 try{
  for(let i=0;i<6;i++)act(r,`cell${i}`);
  assert.deepEqual(r.observe().state.puzzle.tray,[1,1,2,3,4,5]);
  act(r,'cell6');act(r,'cell6');
  const result=r.observe();
  assert.equal(result.flow.status,'playing');
  assert.deepEqual(result.state.puzzle.tray,[2,3,4,5]);
  assert.equal(result.state.puzzle.score,3);
  assert.equal(result.state.puzzle.moves,7);
  assert.equal(result.events.filter(e=>e.type==='puzzle.changed'&&e.payload.moves===7).length,1);
 }finally{r.dispose();}
});
test('SHEEP-05 a full unmatched tray rejects input and restores the published initial state',()=>{
 const directory='games/business-complete/pattern-harbor/';
 const definition=readJson(directory+'resume.game.json');
 const failure=readJson(directory+'resume.conformance.json').cases.find(c=>c.id==='seven-distinct-tiles-fill-tray');
 const r=runtime(definition);
 try{
  const initial=r.observe(),rng=r.snapshot().rng;
  for(const step of failure.steps.slice(1)){
   if(step.op==='assert')break;
   if(step.op==='injectRaw')r.injectRaw(step.raw);
   else if(step.op==='step')r.step(step.ticks);
  }
  const lost=r.observe();
  assert.equal(lost.flow.status,'lost');
  assert.equal(new Set(lost.state.puzzle.tray).size,7);
  assert.equal(lost.state.puzzle.score,0);
  assert.throws(()=>r.injectRaw(failure.steps.find(step=>step.op==='injectRaw').raw),{code:'A2G_E_FLOW'});
  assert.equal(r.step(1).advanced,0);
  assert.equal(r.observe().exactHash,lost.exactHash);
  r.restart();
  assert.equal(r.observe().exactHash,initial.exactHash);
  assert.deepEqual(r.snapshot().rng,rng);
  const p=r.observe().state.puzzle;
  assert.deepEqual([p.tray,p.trayTools.reserveIds,p.trayTools.moveOutRemaining,p.trayTools.undoRemaining,p.trayTools.shuffleRemaining],[[],[],1,1,1]);
 }finally{r.dispose();}
});
test('SHEEP-09 a forced stack can be unsolvable even with complete triples',()=>{
 const board=Array.from({length:21},(_,i)=>i%7+1);
 const blockers=board.map((_,i)=>i+1<board.length?[i+1]:[]);
 for(let face=1;face<=7;face++)assert.equal(board.filter(x=>x===face).length,3);
 const definition=trayBoundary(board,7,blockers);
 assert.equal(solveButtons(definition,{maxNodes:1,maxDepth:1}).status,'BUDGET_EXHAUSTED');
 const r=runtime(definition);
 try{
  for(let i=20;i>=14;i--){
   const current=r.observe().state.puzzle.board;
   assert.deepEqual(current.flatMap((face,j)=>face&&blockers[j].every(k=>!current[k])?[j]:[]),[i]);
   act(r,`cell${i}`);
  }
  const result=r.observe();
  assert.equal(result.flow.status,'lost');
  assert.equal(new Set(result.state.puzzle.tray).size,7);
  assert.equal(result.state.puzzle.score,0);
 }finally{r.dispose();}
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

test('a blocked falling-piece spawn tops out during lock before later movement can rescue it',()=>{
 for(const mode of ['drop','gravity','initial']){
  const def=game('falling'),c=def.scenes[0].entities[0].components[0].config,p=def.state.puzzle.initial;
  c.pieces=[[[0,0]],[[0,0]]];c.targetScore=99;c.fallTicks=1;
  p.board=Array(16).fill(0);p.board[mode==='initial'?2:6]=1;p.anchor=2;
  const r=runtime(def);
  try{
   if(mode==='drop'){r.injectAction({action:'drop',phase:'press'});r.injectAction({action:'drop',phase:'release'});}
   if(mode!=='gravity')r.injectAction({action:'left',phase:'press'});
   r.step();const result=r.observe();assert.equal(result.flow.status,'lost',mode);assert.equal(result.state.puzzle.anchor,2,mode);
   assert.equal(result.state.puzzle.moves,mode==='initial'?0:1);assert.equal(result.state.puzzle.score,0);
  }finally{r.dispose();}
 }
});
