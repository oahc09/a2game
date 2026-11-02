import test from 'node:test';
import assert from 'node:assert/strict';
import {runConformanceSuite} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {publicDiagnostics,repairFeedback} from '../generator/diagnostics.mjs';
import {readPublicResource} from '../integrations/mcp/resources.mjs';

const run=async steps=>{const f=createFixture();f.conformance.cases=[{id:'synthetic-error-contract',seed:42,steps}];return (await runConformanceSuite(f.conformance,f.game,makeRegistry)).cases[0];};
test('expectError missing code and ordering have precise bounded diagnostics without changing acceptance',async()=>{
 for(const [steps,id,pointer] of [
  [[{op:'start'},{op:'expectError'}],'conformance.expect-error-code','/cases/0/steps/1/code'],
  [[{op:'start'},{op:'expectError',code:'A2G_E_FLOW'},{op:'expectError',code:'A2G_E_FLOW'}],'conformance.expect-error-order','/cases/0/steps/2'],
  [[{op:'start'},{op:'expectError',code:'A2G_E_FLOW'}],'conformance.expect-error-order','/cases/0/steps/1']]){
  const result=await run(steps);assert.equal(result.status,'FAIL');assert.equal(result.code,'A2G_E_CONFORMANCE');
  assert.equal(result.diagnostics[0].ruleId,id);assert.equal(result.diagnostics[0].jsonPointer,pointer);
  const error={code:result.code,diagnostics:result.diagnostics};const d=publicDiagnostics(error)[0];assert.match(d.repairHint,/expectError/);assert.ok(repairFeedback(error,{}).hints.length);
 }
 const valid=await run([{op:'start'},{op:'pause'},{op:'expectError',code:'A2G_E_FLOW'},{op:'injectAction',action:'collect',phase:'press'},{op:'resume'},{op:'assert',path:'/flow/status',equals:'playing'}]);assert.equal(valid.status,'PASS');
 const falseClaim=await run([{op:'start'},{op:'expectError',code:'A2G_E_FLOW'},{op:'injectAction',action:'collect',phase:'press'}]);assert.equal(falseClaim.status,'FAIL');assert.equal(falseClaim.code,'A2G_E_ASSERT');
});

test('public operations and preview-binding guidance are static contracts, not trusted caller messages',()=>{
 const envelope=JSON.parse(readPublicResource('a2game://spec/0.1.0/host-profile.json').contents[0].text),profile=JSON.parse(envelope.content);
 assert.deepEqual(profile.conformance.operations.expectError.required,['code']);assert.match(profile.conformance.operations.expectError.semantics,/immediately/);assert.equal(profile.conformance.inputRejectionCode,'A2G_E_FLOW');
 assert.match(profile.inputs.rawKeyboard,/payload.*code/);
 for(const [code,ruleId]of [['A2G_E_CONFORMANCE','conformance.expect-error-code'],['A2G_E_CONFORMANCE','conformance.expect-error-order'],['A2G_MCP_READABILITY_BINDING',undefined]]){
  const d=publicDiagnostics({code,diagnostics:[{ruleId,message:'/private/source.js secret',repairHint:'/private/override',actual:'/private/private.json'}]})[0];
  assert.ok(!JSON.stringify(d).includes('/private'));assert.match(d.repairHint,code==='A2G_MCP_READABILITY_BINDING'?/active preview/:/expectError/);
 }
});

test('real no-provider MCP preserves missing-code guidance in top-level and data diagnostics',async()=>{
 const {createMcpService}=await import('../integrations/mcp/service.mjs');const service=createMcpService();
 try{const f=createFixture();f.conformance.cases.push({id:'missing-expected-code',seed:42,steps:[{op:'start'},{op:'expectError'},{op:'injectAction',action:'collect',phase:'press'}]});
  const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(f.game),conformanceJson:JSON.stringify(f.conformance),solutionJson:JSON.stringify(f.solution)});assert.equal(admitted.status,'PASS_REFERENCE');
  const result=await service.call('a2game.test_game',{artifactId:admitted.data.artifactId});assert.equal(result.status,'FAIL');assert.deepEqual(result.diagnostics,result.data.diagnostics);
  const d=result.diagnostics.find(x=>x.ruleId==='conformance.expect-error-code');assert.ok(d);assert.equal(d.jsonPointer,'/cases/2/steps/1/code');assert.equal(d.expected,'string');assert.equal(d.actual,null);assert.match(d.repairHint,/A2G_E_FLOW/);assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});
