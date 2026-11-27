import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {simulateMinesweeper} from '../dist/modules/minesweeper.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';

const game=(id='g35-minesweeper')=>readJson(`${spec}/games/${id}.game.json`);
const configOf=d=>d.scenes.flatMap(s=>s.entities).flatMap(e=>e.components??[]).find(c=>c.capability.id==='a2game.puzzle.minesweeper').config;
const runtime=d=>{const r=new HeadlessRuntime(d,makeRegistry());r.start();return r;};
const act=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step();};
const initial=(area,count)=>({mines:[],cells:Array(area).fill(-2),flagMode:false,remainingSafe:area-count,status:'playing'});
const cells=['cell0','cell1','cell2','cell3','cell4','cell5','cell6','cell7','cell8','cell9','cell10','cell11','cell12','cell13','cell14','cell15'];

test('independent 4x4 oracle: zero flood, numbered boundary, final safe cell and separate mine loss',()=>{
 const config={width:4,height:4,mineCount:3,statePath:'/minefield',cellActions:cells,flagModeAction:'flagMode'};
 const noRng=()=>assert.fail('already-generated rule state must not draw RNG');
 const step=(board,action)=>simulateMinesweeper({
  config,world:{state:{minefield:board}},rng:{randomInt:noRng},inputs:[{type:'input.action',edge:'press',action}]
 });
 // Rule-only fixed vector, intentionally not accepted as an authored initial state.
 const open=step({...initial(16,3),mines:[3,7,15]},'cell0').proposals[0].value;
 assert.deepEqual(open.cells,[0,0,2,-2,0,0,2,-2,0,0,2,-2,0,0,1,-2]);
 assert.equal(open.remainingSafe,1);
 const won=step(open,'cell11');
 assert.equal(won.proposals[0].value.cells[11],2);
 assert.equal(won.proposals[0].value.status,'won');
 assert.deepEqual(won.events,[{type:'minesweeper.won',payload:{cell:11}}]);
 const lost=step(open,'cell3');
 assert.equal(lost.proposals[0].value.cells[3],9);
 assert.equal(lost.proposals[0].value.remainingSafe,1);
 assert.equal(lost.proposals[0].value.status,'lost');
 assert.deepEqual(lost.events,[{type:'minesweeper.lost',payload:{cell:3}}]);
 const flagged=[...Array(16).fill(-2)];flagged[5]=-1;
 const withFlag=step({...initial(16,3),cells:flagged,mines:[3,7,15]},'cell0').proposals[0].value;
 assert.equal(withFlag.cells[5],-1,'zero flood must not reveal a flagged safe cell');
 assert.equal(withFlag.remainingSafe,2);
});

test('generated layouts make every candidate first cell safe and restart reproduces exact board and RNG',()=>{
 for (const id of ['g35-minesweeper','g35-minesweeper-wide']) {
  const d=game(id),c=configOf(d),r=runtime(d),before=r.snapshot().rng;
  try{
   for (const [index,action] of c.cellActions.entries()) {
    r.restart();act(r,action);
    const first=r.snapshot(),s=first.state.minefield;
    assert.equal(s.mines.length,c.mineCount);assert.equal(new Set(s.mines).size,c.mineCount);
    assert(!s.mines.includes(index));assert(s.cells[index]>=0&&s.cells[index]<=8);
    assert.notDeepEqual(first.rng,before);
    r.restart();assert.deepEqual(r.snapshot().rng,before);
    act(r,action);const duplicate=r.snapshot();
    assert.deepEqual(duplicate.state,first.state);assert.deepEqual(duplicate.rng,first.rng);
   }
  }finally{r.dispose();}
 }
});

test('flagging does not consume RNG, flagged reveals are inert, and frame excludes hidden layout',()=>{
 const d=game(),c=configOf(d),r=runtime(d),first=r.snapshot();
 const [cell]=c.cellActions;
 try {
  act(r,c.flagModeAction);act(r,cell);
  const flagged=r.observe().state.minefield;
  assert.equal(flagged.cells[0],-1);
  act(r,c.flagModeAction);act(r,cell);
  const rejected=r.snapshot();
  assert.deepEqual(rejected.rng,first.rng);assert.deepEqual(rejected.state.minefield.mines,[]);
  assert.equal(rejected.state.minefield.cells[0],-1);
  act(r,c.flagModeAction);act(r,cell);
  assert.equal(r.observe().state.minefield.cells[0],-2);
  const left=structuredClone(r.observe()),right=structuredClone(left);
  // A synthetic presentation-only observation pair: two distinct, well-formed
  // mine-location lists with identical public cells, counts and flow.
  left.state.minefield.mines=[3,7,15];
  right.state.minefield.mines=[0,5,13];
  assert.deepEqual(projectPresentation(d,left),projectPresentation(d,right));
 }finally{r.dispose();}
});

test('admission rejects unsafe authored layouts, duplicate actions, missing buttons and impossible mine counts',()=>{
 for(const [mutate,code] of [
  [(_c,s)=>{s.mines=[3,7,15];},'A2G_E_STATE_TYPE'],
  [(c)=>{c.cellActions[1]=c.cellActions[0];},'A2G_E_CAP_CONFIG'],
  [(c)=>{c.cellActions[0]='undefinedButton';},'A2G_E_CAP_CONFIG'],
  [(c)=>{c.mineCount=c.width*c.height;},'A2G_E_CAP_CONFIG'],
 ]){
  const d=game();mutate(configOf(d),d.state.minefield.initial);
  assert.throws(()=>runtime(d),{code});
 }
});
