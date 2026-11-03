import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {runAgentWorkflow,callJsonProcess} from '../scripts/agent-workflow.mjs';
import {solveButtons,playSolution} from '../scripts/agent-solver.mjs';
const fixture=[process.execPath,'test/fixtures/agent-provider.mjs'];
test('model-independent workflow repairs full-schema errors, verifies proposed cases and independently solves/replays fixture',async()=>{
 const priorEncoding=process.env.PYTHONIOENCODING,priorUtf8=process.env.PYTHONUTF8;process.env.PYTHONIOENCODING='ascii';process.env.PYTHONUTF8='0';
 const dir=await mkdtemp(join(tmpdir(),'a2game-agent-'));try{const {summary,success}=await runAgentWorkflow({prompt:'写一个点击三次获胜的独立计数游戏，负例点击两次仍在进行。',command:fixture,directory:join(dir,'run'),timeoutMs:8000});assert.equal(summary.status,'PASS_REFERENCE');assert.equal(summary.repairCount,1);assert.equal(summary.G3,'NOT_RUN');assert.equal(summary.provenance.kind,'fixture');assert.equal(success.playability.final.state.score,3);assert.equal(summary.attempts[0].code,'A2G_E_SCHEMA');assert.equal(success.conformance.status,'PASS');assert.equal(success.solution.length,3);assert.equal(success.game.meta.title,'生成链夹具：三次点击');assert.equal(JSON.parse(readFileSync(join(dir,'run','attempt-2.json'))).mechanics.status,'NOT_REQUESTED');}finally{if(priorEncoding===undefined)delete process.env.PYTHONIOENCODING;else process.env.PYTHONIOENCODING=priorEncoding;if(priorUtf8===undefined)delete process.env.PYTHONUTF8;else process.env.PYTHONUTF8=priorUtf8;await rm(dir,{recursive:true,force:true});}
});
test('invalid generation stops at budget, provider timeouts are infrastructure and solver exhaustion makes no impossibility claim',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'a2game-agent-budget-'));try{const {summary}=await runAgentWorkflow({prompt:'fixture invalid',command:[...fixture,'--always-invalid'],directory:join(dir,'invalid'),maxAttempts:2,timeoutMs:8000});assert.equal(summary.status,'FAIL');assert.equal(summary.attempts.length,2);await assert.rejects(callJsonProcess([...fixture,'--stall'],{attempt:1},{timeoutMs:100}),e=>e.code==='A2G_E_PROVIDER_TIMEOUT'&&e.attribution==='INFRA');const game=JSON.parse(readFileSync('specs/v0.1/games/tap-target.game.json'));assert.equal(solveButtons(game,{maxNodes:1,maxDepth:1}).status,'BUDGET_EXHAUSTED');assert.throws(()=>playSolution(game,[{action:'collect',ticks:1}]),/does not win/);assert.throws(()=>playSolution(game,[{action:'collect',ticks:12001}]),/budget/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('trusted optional mechanics policy cannot silently continue to solver or successful output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'a2game-agent-mechanics-'));
 try{
  const directory=join(dir,'run');
  const mechanicsDeclaration={format:'a2game-illegal-undo-check',version:1,profile:'unsupported-custom',sceneId:'main',entityId:'counter',componentIndex:0,coreStatePaths:[],legalPrefix:['collect'],illegalAction:'collect',illegalKind:'blocked-push',undoAction:'collect'};
  const {summary,success}=await runAgentWorkflow({prompt:'synthetic controller mechanics rejection',command:[...fixture,'--one-shot'],directory,maxAttempts:1,timeoutMs:8000,mechanicsDeclaration,mechanicsRequireBlockedPush:true});
  assert.equal(summary.status,'FAIL');assert.equal(success,undefined);assert.equal(summary.attempts[0].code,'A2G_E_AGENT_MECHANICS');
  const attempt=JSON.parse(readFileSync(join(directory,'attempt-1.json'))),receipt=JSON.parse(readFileSync(join(directory,'mechanics-1.json')));
  assert.equal(attempt.conformance.status,'PASS');assert.equal(attempt.mechanics.status,'UNSUPPORTED');assert.deepEqual(attempt.mechanics,receipt);
  assert.equal(attempt.solver,undefined);assert.equal(attempt.playability,undefined);assert.equal(existsSync(join(directory,'solution.json')),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
