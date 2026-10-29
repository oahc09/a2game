import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {withNativeDelivery,captureNativeReply,archiveNativeSources,classifyNativeFailure,pendingNativeReviews} from '../scripts/g3-native-contract.mjs';
import {buildSubagentPack,validateAttempt} from '../scripts/g3-subagent.mjs';
import {ingestNativeReply} from '../scripts/g3-native-subagent.mjs';
import {root} from '../scripts/registry.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function temp(run){const dir=mkdtempSync(resolve(tmpdir(),'a2game-native-contract-'));try{return run(dir);}finally{assert.ok(dir.startsWith(resolve(tmpdir(),'a2game-native-contract-')));rmSync(dir,{recursive:true,force:true});}}
test('native pack requires same-turn strict output and solution without changing gameplay task or enabling tools',()=>{
 const {request,pack,task}=buildSubagentPack('G01',1);
 assert.equal(pack.version,'public-task-pack-v2');assert.equal(request.prompt,task.prompt);assert.ok(request.outputContract.required.includes('solution'));
 assert.match(request.nativeDelivery.output,/Write/);assert.match(request.nativeDelivery.tools,/Do not run shell/);
 assert.deepEqual(withNativeDelivery(request),request);assert.equal(pendingNativeReviews().formalG3,'NOT_RUN');
});
test('host capture preserves even invalid model bytes and rejects transcription, SHA mismatch or overwrite',()=>temp(dir=>{
 const bytes=Buffer.from('explanation\n```json\n{"x":1}\n```\n'),reply=resolve(dir,'reply.bin');writeFileSync(reply,bytes);
 const model=Buffer.from('{"model":"routing-alias"}');writeFileSync(resolve(dir,'model.json'),model);
 const record=resolve(dir,'host.json');writeFileSync(record,JSON.stringify({format:'a2game-native-host-export',version:1,replySha256:sha(bytes),files:[{role:'model-config',path:'model.json',sha256:sha(model)}]}));
 const attemptDir=resolve(dir,'attempt');const result=captureNativeReply({attemptDir,replyFile:reply,recordFile:record});
 assert.ok(readFileSync(resolve(attemptDir,'output.raw.json')).equals(bytes));assert.equal(result.cost,'UNKNOWN');assert.equal(result.hostEvidence.status,'PACKAGED_HOST_EXPORT_PENDING_REVIEW');
 assert.throws(()=>captureNativeReply({attemptDir,replyFile:reply}),/已有执行记录/);
 const changed=resolve(dir,'changed');mkdirSync(changed);writeFileSync(resolve(changed,'output.raw.json'),'{}');
 assert.throws(()=>captureNativeReply({attemptDir:changed,replyFile:reply}),/禁止覆盖/);assert.equal(readFileSync(resolve(changed,'output.raw.json'),'utf8'),'{}');
 writeFileSync(record,JSON.stringify({format:'a2game-native-host-export',version:1,replySha256:'0'.repeat(64)}));assert.throws(()=>captureNativeReply({attemptDir:resolve(dir,'bad'),replyFile:reply,recordFile:record}),/SHA/);
}));
test('source snapshots retain historical bytes and infrastructure errors never default to model failure',()=>temp(dir=>{
 const source=resolve(dir,'source'),archive=resolve(dir,'archive');mkdirSync(source);writeFileSync(resolve(source,'importer.mjs'),'old');
 archiveNativeSources(archive,source,['importer.mjs']);writeFileSync(resolve(source,'importer.mjs'),'new');assert.equal(readFileSync(resolve(archive,'source-snapshot/importer.mjs'),'utf8'),'old');
 assert.equal(classifyNativeFailure(Error('A2G_E_G3_CONTEXT: broken importer')),'INFRA');assert.equal(classifyNativeFailure(Error('unexpected assertion')),'INFRA');
 assert.equal(classifyNativeFailure({code:'A2G_E_AGENT_CONFORMANCE'}),'AGENT_STRATEGY');assert.equal(classifyNativeFailure({attribution:'ENGINE_OR_HOST_UNRESOLVED'}),'ENGINE_OR_HOST_UNRESOLVED');
}));
test('native no-output and context failures remain accountable without free generation or model blame',async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'a2game-native-contract-'));
 try{
  const save=(p,v)=>writeFileSync(resolve(dir,p),JSON.stringify(v));
  save('summary.json',{cases:[{id:'G01',attempts:[]}],selected:['G01'],budget:{newGenerationCalls:0},provider:{requestedGenerator:'fixture-only'},host:{isolation:'FIXTURE'}});
  save('budget.json',{approvedAdditionalCalls:3,newGenerationCalls:0});save('plan.json',{tasks:[{id:'G01'}]});save('fingerprints.json',{});
  const result=await ingestNativeReply({batch:dir,taskId:'G01',record:{status:'NO_OUTPUT'}});
  assert.equal(result.status,'FAIL');assert.equal(result.code,'A2G_E_G3_NO_RAW_OUTPUT');assert.equal(result.newGenerationCalls,1);
  const summary=JSON.parse(readFileSync(resolve(dir,'summary.json')));assert.equal(summary.cases[0].attempts.length,1);
  await assert.rejects(ingestNativeReply({batch:dir,taskId:'G01',generationCall:false}),/新回复必须计入/);
  assert.equal(JSON.parse(readFileSync(resolve(dir,'budget.json'))).newGenerationCalls,1);
 }finally{assert.ok(dir.startsWith(resolve(tmpdir(),'a2game-native-contract-')));rmSync(dir,{recursive:true,force:true});}
 const parent=resolve(root,'reports/g3-evaluations');mkdirSync(parent,{recursive:true});
 const fixture=mkdtempSync(resolve(parent,'a2game-native-contract-'));
 try{
  const attempt=resolve(fixture,'G01/attempt-1');mkdirSync(attempt,{recursive:true});
  writeFileSync(resolve(attempt,'pack.json'),JSON.stringify({attempt:1,contextSha256:'0'.repeat(64),fixtureOnly:true}));
  writeFileSync(resolve(attempt,'context.json'),'{}');writeFileSync(resolve(attempt,'output.raw.json'),'{}');
  const config=resolve(fixture,'config.json');writeFileSync(config,JSON.stringify({runId:'20261028T000000-00000000-0000-0000-0000-000000000000',runDir:relative(root,fixture).replaceAll('\\','/'),model:'fixture-no-model-call',maxAttempts:1,maxCalls:1,selected:['G01']}));
  const result=await validateAttempt(config,'G01',1);assert.equal(result.row.code,'A2G_E_G3_CONTEXT');assert.equal(result.row.attribution,'INFRA');assert.equal(result.repairNeeded,false);
 }finally{assert.ok(fixture.startsWith(resolve(parent,'a2game-native-contract-')));rmSync(fixture,{recursive:true,force:true});}
});
