import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solveGrid} from '../scripts/solve-grid-playthrough.mjs';
import {playSolution} from '../scripts/agent-solver.mjs';
const game=()=>{const g=JSON.parse(readFileSync(new URL('../specs/v0.1/samples/games/g02-candidate.game.json',import.meta.url),'utf8'));g.state.board.initial=Array(16).fill(0);g.state.board.initial[0]=g.state.board.initial[1]=2;g.state.best.initial=2;g.state.goal.initial=4;return g;};
test('bounded host grid search uses Runtime transitions, returns a replayable move and preserves the definition',()=>{
 const g=game(),before=JSON.stringify(g),result=solveGrid(g,{maxMoves:2,maxNodes:64,depth:1});assert.equal(result.status,'SOLVED');assert.equal(JSON.stringify(g),before);const replay=playSolution(g,result.actions.map(action=>({action,ticks:1})));assert.equal(replay.final.exactHash,result.final.exactHash);assert.ok(result.scope.includes('not model self-solve'));
});
test('host search rejects invalid limits and stops at its expansion budget',()=>{
 assert.throws(()=>solveGrid(game(),{maxMoves:2049}));const result=solveGrid(game(),{maxNodes:1,depth:2});assert.equal(result.status,'BUDGET_EXHAUSTED');assert.match(result.failure,/搜索预算耗尽/);assert.equal(result.actions.length,0);assert.equal(result.final.flow.status,'playing');
});
