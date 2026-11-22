import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadlessRuntime,runConformanceSuite} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {publicDiagnostics,repairFeedback} from '../generator/diagnostics.mjs';
const game=()=>{const g=createFixture().game;g.rules[0].on.edge='hold';g.state.goal.initial=100;g.inputs.actions[0].bindings[0].config.hold=true;return g;};
const runtime=()=>{const r=new HeadlessRuntime(game(),makeRegistry());r.start();return r;};
const action=(r,phase,sourceId='test',extra={})=>r.injectAction({action:'collect',phase,sourceId,...extra});

test('ignored hold is advisory, bounded and outside deterministic state',()=>{
 const r=runtime(),clean=runtime();
 try{
  for(let i=0;i<30;i++){action(r,'hold');action(clean,'release');}r.step();clean.step();
  assert.equal(r.observe().state.score,0);assert.equal(r.status,'playing');
  assert.equal(r.getInputDiagnostics().length,20);
  assert.equal(r.getInputDiagnostics()[0].ruleId,'input.hold-without-press');
  assert.deepEqual(r.snapshot(),clean.snapshot());assert.equal(r.observe().exactHash,clean.observe().exactHash);
  const copied=r.getInputDiagnostics();copied.length=0;assert.equal(r.getInputDiagnostics().length,20);
  r.restart();assert.deepEqual(r.getInputDiagnostics(),[]);
  const snap=r.snapshot();action(r,'hold');r.step();r.restore(snap);assert.deepEqual(r.getInputDiagnostics(),[]);
  action(r,'hold');r.step();r.dispose();assert.deepEqual(r.getInputDiagnostics(),[]);
 }finally{r.dispose();clean.dispose();}
});

test('valid direct/raw holds use actual source/order ledger, not injection-time guesses',()=>{
 for(const raw of [false,true]){
  const r=runtime();try{
   if(raw)r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'},timeUs:0,seq:0});
   else action(r,'press','test',{timeUs:0,seq:0});
   action(r,'hold',raw?'keyboard:Space':'test',{timeUs:0,seq:1});r.step();r.step(2);
   assert.ok(r.observe().state.score>=1);assert.deepEqual(r.getInputDiagnostics(),[]);
   if(raw)r.injectRaw({source:'keyboard',kind:'up',payload:{code:'Space'}});else action(r,'release');
   r.step();assert.deepEqual(r.getInputDiagnostics(),[]);
  }finally{r.dispose();}
 }
 const r=runtime();try{action(r,'press','other');action(r,'hold','test');r.step();assert.equal(r.getInputDiagnostics().length,1);}finally{r.dispose();}
});

test('conformance surfaces ignored hold and explicitly declared loss mismatch without requiring loss',async()=>{
 const g=game(),suite=createFixture().conformance;suite.cases=[{id:'bad-hold',steps:[{op:'start'},{op:'injectAction',action:'collect',phase:'hold'},{op:'step',ticks:1},{op:'assert',path:'/state/score',equals:1}]},{id:'declared-loss',steps:[{op:'start'},{op:'step',ticks:1},{op:'assert',path:'/flow/status',equals:'lost'}]},{id:'valid-playing-negative',steps:[{op:'start'},{op:'step',ticks:1},{op:'assert',path:'/flow/status',equals:'playing'}]}];
 const result=await runConformanceSuite(suite,g,makeRegistry);
 assert.equal(result.cases[0].status,'FAIL');assert.equal(result.cases[1].status,'FAIL');assert.equal(result.cases[2].status,'PASS');
 const hold=result.cases[0].diagnostics.find(d=>d.ruleId==='input.hold-without-press');assert.ok(hold);
 const loss=result.cases[1].diagnostics[0];assert.equal(loss.ruleId,'conformance.loss-status-mismatch');assert.equal(loss.expected,'lost');assert.equal(loss.actual,'playing');
 for(const d of [hold,loss]){
  const error={code:'A2G_E_AGENT_CONFORMANCE',diagnostics:[d]};
  assert.equal(repairFeedback(error,{}).hints.length,1);
  assert.match(publicDiagnostics(error)[0].repairHint,d===hold?/same sourceId/:/explicitly asserted/);
 }
 const clean=createFixture();assert.equal((await runConformanceSuite(clean.conformance,clean.game,makeRegistry)).status,'PASS');
});


test('lost terminal state rejects raw/direct input and stays frozen independently of winning lifecycle',()=>{
 const g=game();g.outcomes=[{id:'failure',status:'lost',priority:0,when:{op:'gte',args:[{state:'/score'},{const:0}]}}];
 const r=new HeadlessRuntime(g,makeRegistry());try{
  r.start();r.step();assert.equal(r.status,'lost');const hash=r.observe().exactHash;
  assert.throws(()=>action(r,'press'),{code:'A2G_E_FLOW'});
  assert.throws(()=>r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'}}),{code:'A2G_E_FLOW'});
  assert.equal(r.step(5).advanced,0);assert.equal(r.observe().exactHash,hash);assert.deepEqual(r.getInputDiagnostics(),[]);
 }finally{r.dispose();}
});

test('start is idempotent and pause/resume clears held sources without erasing diagnostics',()=>{
 const r=new HeadlessRuntime(game(),makeRegistry());try{
  assert.deepEqual(r.getInputDiagnostics(),[]);assert.equal(r.status,'ready');r.start();assert.deepEqual(r.getInputDiagnostics(),[]);
  action(r,'hold');r.step();const warnings=r.getInputDiagnostics(),before=r.observe().exactHash;
  r.start();r.start();assert.equal(r.observe().exactHash,before);assert.deepEqual(r.getInputDiagnostics(),warnings);
  r.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'}});r.step();assert.deepEqual(r.snapshot().pressedSources.collect,['keyboard:Space']);
  r.pause();assert.deepEqual(r.snapshot().pressedSources,{});assert.deepEqual(r.getInputDiagnostics(),warnings);
  r.resume();r.step();assert.deepEqual(r.getInputDiagnostics(),warnings);
  r.restart();assert.deepEqual(r.getInputDiagnostics(),[]);r.dispose();r.dispose();assert.deepEqual(r.getInputDiagnostics(),[]);
 }finally{r.dispose();}
});

test('no-provider MCP test preserves hold/loss diagnostics in both safe envelope locations',async()=>{
 const {createMcpService}=await import('../integrations/mcp/mcp.mjs');
 const service=createMcpService();try{
  const fixture=createFixture();
  fixture.conformance.cases.push(
   {id:'hold-mismatch',seed:42,steps:[{op:'start'},{op:'injectAction',action:'collect',phase:'hold'},{op:'step',ticks:1},{op:'assert',path:'/state/score',equals:1}]},
   {id:'loss-mismatch',seed:42,steps:[{op:'start'},{op:'step',ticks:1},{op:'assert',path:'/flow/status',equals:'lost'}]});
  const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(fixture.game),conformanceJson:JSON.stringify(fixture.conformance),solutionJson:JSON.stringify(fixture.solution)});
  assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));
  const result=await service.call('a2game.test_game',{artifactId:admitted.data.artifactId});
  assert.equal(result.status,'FAIL');assert.deepEqual(result.data.diagnostics,result.diagnostics);
  const hold=result.diagnostics.find(d=>d.ruleId==='input.hold-without-press'),loss=result.diagnostics.find(d=>d.ruleId==='conformance.loss-status-mismatch');
  assert.ok(hold,JSON.stringify(result));assert.ok(loss,JSON.stringify(result));
  assert.equal(hold.caseId,'hold-mismatch');assert.match(hold.repairHint,/same sourceId/);
  assert.equal(loss.caseId,'loss-mismatch');assert.equal(loss.expected,'lost');assert.equal(loss.actual,'playing');assert.equal(loss.jsonPointer,'/cases/3/steps/2');assert.match(loss.repairHint,/explicitly asserted/);
  assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});
