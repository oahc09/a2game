import {hostSourceFingerprint} from '../scripts/host-source-fingerprint.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {initHostRun,captureHostCall,checkHostRun} from '../scripts/host-agent-run.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(p,v)=>writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));
function fixture(t){
 const workspace=mkdtempSync(join(tmpdir(),'a2game-host-run-'));t.after(()=>rmSync(workspace,{recursive:true,force:true}));
 for(const p of ['specs/v0.1/schemas','specs/v0.1/capabilities','docs','output/mcp','dist'])mkdirSync(join(workspace,p),{recursive:true});
 write(join(workspace,'specs/v0.1/schemas/public.json'),{type:'object'});write(join(workspace,'docs/host-agent-pilot.md'),'Public task');write(join(workspace,'specs/v0.1/capabilities/public.capability.json'),{id:'a2game.test.public',version:'0.1.0'});
 write(join(workspace,'dist/index.js'),'export const stale = false;');
 const {run,hostRunId}=initHostRun('workbuddy',workspace),sessionId=randomUUID(),artifactId=randomUUID();
 const output=join(workspace,'output/mcp',sessionId);mkdirSync(output);
 write(join(output,'session.json'),{format:'a2game-mcp-session',version:1,implementationSha256:hostSourceFingerprint(workspace),sessionId,hostRunId,lastSequence:0,createdAt:new Date().toISOString()});
 let sequence=0;
 const add=(tool,parameters={},data={},options={})=>{
  const runId=randomUUID(),status=options.status??'PASS_REFERENCE';
  const response={mcpToolContractVersion:1,runId,status,diagnostics:status==='PASS_REFERENCE'?[]:[{code:'A2G_INVALID',stage:'schema',message:'invalid'}],data:{...data,modelCalls:0}};
  const bytes=JSON.stringify(response);
  const call={format:'a2game-mcp-call',version:1,sessionId,hostRunId,runId,sequence:++sequence,state:options.incomplete?'STARTED':'COMPLETED',createdAt:new Date().toISOString(),tool:'a2game.'+tool,parameters,budgetConsumed:0,unknownCalls:0,receiptSha256:options.incomplete?null:hash(bytes)};
  write(join(output,runId+'.call.json'),call);
  const session=JSON.parse(readFileSync(join(output,'session.json')));session.lastSequence=sequence;write(join(output,'session.json'),session);
  if(!options.incomplete)write(join(output,runId+'.receipt.json'),bytes);
  if(options.capture!==false&&!options.incomplete)captureHostCall(run,runId,workspace);
  return runId;
 };
 const complete=()=>{
  add('list_capabilities');add('get_capability');add('validate_game',{}, {artifactId});add('test_game',{artifactId},{artifactId});add('inspect_game',{artifactId},{artifactId});
  for(const backend of ['air','three']){
   const previewId=randomUUID(),lifecyclePath='output/mcp/'+sessionId+'/'+previewId+'.lifecycle.json';
   write(join(workspace,lifecyclePath),{format:'a2game-preview-lifecycle',version:1,sessionId,artifactId,previewId,closed:true,closeReason:'explicit'});
   add('preview_game',{artifactId,backend,action:'open'},{backend,previewId});
   add('preview_game',{previewId,action:'close'},{closed:true,previewId,closeReason:'explicit',lifecyclePath});
  }
  const packagePath='output/mcp/'+sessionId+'/package.json';write(join(workspace,packagePath),'{}');
  add('export_game',{artifactId},{artifactId,path:packagePath,sha256:hash('{}')});
 };
 return {workspace,run,hostRunId,sessionId,artifactId,output,add,complete,check:()=>checkHostRun(run,workspace)};
}
test('complete bound canonical loop passes; browser/identity acceptance remains unclaimed',t=>{
 const f=fixture(t);f.complete();const result=f.check();assert.equal(result.mcpLoopStatus,'PASS_REFERENCE');assert.equal(result.validationAttempts,1);assert.equal(result.browserInputAndVisual,'NOT_RUN');
 const absent=randomUUID();write(join(f.workspace,f.run,'receipt.json'),{mcpCalls:[{runId:absent}]});assert.ok(f.check().missingCaptures.includes(absent));
 assert.throws(()=>captureHostCall(f.run,'../../private',f.workspace),/UUID/);
});
test('uncaptured failed candidates are counted even without artifact ids',t=>{
 const f=fixture(t);f.complete();const failed=[];for(let i=0;i<3;i++)failed.push(f.add('validate_game',{}, {},{status:'FAIL',capture:false}));
 const result=f.check();assert.equal(result.mcpLoopStatus,'PARTIAL');assert.equal(result.validationAttempts,4);assert.equal(result.failures.length,3);assert.ok(result.missing.includes('VALIDATION_ATTEMPT_BUDGET_EXCEEDED'));assert.deepEqual(result.missingCaptures.sort(),failed.sort());
});
test('three total candidates pass only after every failure is captured; fourth is refused',t=>{
 const f=fixture(t);f.add('validate_game',{}, {},{status:'FAIL'});f.add('validate_game',{}, {},{status:'FAIL'});f.complete();assert.equal(f.check().mcpLoopStatus,'PASS_REFERENCE');assert.equal(f.check().validationAttempts,3);
 f.add('validate_game',{}, {},{status:'FAIL'});assert.equal(f.check().mcpLoopStatus,'PARTIAL');
});
test('binding excludes other runs and rejects cross-run capture rather than borrowing a session',t=>{
 const f=fixture(t);f.complete();const other=initHostRun('trae',f.workspace);const id=f.add('list_capabilities');assert.throws(()=>captureHostCall(other.run,id,f.workspace),/another host run/);
 const unrelated=join(f.workspace,'output/mcp',randomUUID());mkdirSync(unrelated);write(join(unrelated,'session.json'),{hostRunId:other.hostRunId});write(join(unrelated,'bad.call.json'),'not json');assert.equal(f.check().mcpLoopStatus,'PASS_REFERENCE');
 const session=JSON.parse(readFileSync(join(f.output,'session.json')));session.hostRunId=other.hostRunId;write(join(f.output,'session.json'),session);assert.equal(f.check().mcpLoopStatus,'PARTIAL');
});
test('incomplete canonical calls, missing canonical files and sequence gaps cannot pass',t=>{
 const f=fixture(t);f.complete();const unfinished=f.add('validate_game',{}, {},{incomplete:true});let result=f.check();assert.ok(result.missing.includes('CANONICAL_CALL_INCOMPLETE:'+unfinished));assert.equal(result.validationAttempts,2);
 rmSync(join(f.output,unfinished+'.call.json'));const id=f.add('list_capabilities');result=f.check();assert.ok(result.missing.some(x=>x.startsWith('CANONICAL_SEQUENCE_GAP:')));
 rmSync(join(f.output,id+'.receipt.json'));assert.throws(()=>f.check(),/canonical ledger/);
});
test('canonical mutation after capture and altered capture bytes are rejected',t=>{
 const f=fixture(t);f.complete();const id=f.add('list_capabilities');const path=join(f.output,id+'.call.json');const original=readFileSync(path,'utf8');write(path,original.replace('COMPLETED','STARTED'));assert.throws(()=>f.check(),/canonical ledger/);write(path,original);
 write(join(f.workspace,f.run,'calls',id,'server-response.json'),'{}');assert.throws(()=>f.check(),/SHA mismatch/);
});
test('unbound legacy evidence remains readable but never qualifies for strict PASS',t=>{
 const f=fixture(t);f.complete();rmSync(join(f.output,'session.json'));assert.equal(f.check().mcpLoopStatus,'PARTIAL');assert.ok(f.check().missing.includes('BOUND_CANONICAL_SESSION_MISSING'));
});
test('expired preview cannot substitute for explicit cleanup',t=>{
 const f=fixture(t);f.complete();const previewId=randomUUID();f.add('preview_game',{artifactId:f.artifactId,backend:'air',action:'open'},{backend:'air',previewId});f.add('preview_game',{previewId,action:'close'},{previewId,closed:true,closeReason:'expired'});assert.ok(f.check().missing.includes('PREVIEW_EXPLICIT_CLOSE_MISSING:'+previewId));
});
test('all sessions with the fixed host-run id contribute failures and budget',t=>{
 const f=fixture(t);f.complete();const sessionId=randomUUID(),runId=randomUUID(),output=join(f.workspace,'output/mcp',sessionId);mkdirSync(output);
 write(join(output,'session.json'),{format:'a2game-mcp-session',version:1,implementationSha256:hostSourceFingerprint(f.workspace),sessionId,hostRunId:f.hostRunId,lastSequence:1});
 const response={mcpToolContractVersion:1,runId,status:'FAIL',diagnostics:[{code:'INVALID',stage:'schema',message:'invalid'}]};const bytes=JSON.stringify(response);write(join(output,runId+'.receipt.json'),bytes);
 write(join(output,runId+'.call.json'),{format:'a2game-mcp-call',version:1,sessionId,hostRunId:f.hostRunId,runId,sequence:1,state:'COMPLETED',tool:'a2game.validate_game',parameters:{},budgetConsumed:0,unknownCalls:0,receiptSha256:hash(bytes)});
 assert.equal(f.check().validationAttempts,2);assert.ok(f.check().missingCaptures.includes(runId));captureHostCall(f.run,runId,f.workspace);assert.equal(f.check().mcpLoopStatus,'PASS_REFERENCE');
});
test('an unfinished capture and an actual mismatched host response cannot be hidden by summary fields',t=>{
 const f=fixture(t);f.complete();const unfinished=randomUUID();mkdirSync(join(f.workspace,f.run,'calls',unfinished));assert.ok(f.check().incompleteCaptures.includes(unfinished));rmSync(join(f.workspace,f.run,'calls',unfinished),{recursive:true});
 const id=f.add('list_capabilities',{}, {},{capture:false});const name='host-response.txt';write(join(f.workspace,f.run,name),{wrong:true});captureHostCall(f.run,id,f.workspace,name);assert.ok(f.check().hostResponseMismatches.includes(id));
 const capturePath=join(f.workspace,f.run,'calls',id,'capture.json'),capture=JSON.parse(readFileSync(capturePath));capture.hostResponseComparison='MATCH';write(capturePath,capture);assert.ok(f.check().hostResponseMismatches.includes(id));
});
test('real no-model service persists every rejected call and monotonic run binding',async()=>{
 const {createMcpService}=await import('../integrations/mcp/service.mjs');
 const {readHostRunLedger}=await import('../scripts/host-run-ledger.mjs');
 const hostRunId=randomUUID(),service=createMcpService({hostRunId});
 try{
  for(let i=0;i<4;i++)assert.equal((await service.call('a2game.validate_game',{})).status,'FAIL');
  const result=readHostRunLedger(fileURLToPath(new URL('..',import.meta.url)),hostRunId);
  assert.deepEqual(result.problems,[]);assert.equal(result.calls.length,4);assert.equal(result.calls.filter(e=>e.call.tool==='a2game.validate_game').length,4);
  assert.deepEqual(result.calls.map(e=>e.call.sequence).sort((a,b)=>a-b),[1,2,3,4]);assert.ok(result.calls.every(e=>e.call.hostRunId===hostRunId&&e.call.state==='COMPLETED'));
 }finally{await service.close();rmSync(service.directory,{recursive:true,force:true});}
});
test('real run capture still detects uncaptured service failures and exceeded candidate budget',async()=>{
 const {createMcpService}=await import('../integrations/mcp/service.mjs');
 const workspace=fileURLToPath(new URL('..',import.meta.url));
 const {run,hostRunId}=initHostRun('workbuddy',workspace),service=createMcpService({hostRunId});
 try{
  const responses=[];for(let i=0;i<4;i++)responses.push(await service.call('a2game.validate_game',{}));
  captureHostCall(run,responses[3].runId,workspace);
  const checked=checkHostRun(run,workspace);assert.equal(checked.validationAttempts,4);assert.equal(checked.missingCaptures.length,3);assert.ok(checked.missing.includes('VALIDATION_ATTEMPT_BUDGET_EXCEEDED'));assert.equal(checked.independentAuthoring,'NOT_VERIFIED');
 }finally{await service.close();rmSync(service.directory,{recursive:true,force:true});rmSync(join(workspace,run),{recursive:true,force:true});}
});

test('old source receipts cannot count as current implementation acceptance',t=>{
 const f=fixture(t);f.complete();assert.equal(f.check().mcpLoopStatus,'PASS_REFERENCE');
 write(join(f.workspace,'docs/host-agent-pilot.md'),'Changed contract');const result=f.check();assert.equal(result.mcpLoopStatus,'PARTIAL');assert.ok(result.missing.includes('RUN_IMPLEMENTATION_CHANGED_OR_UNBOUND'));assert.ok(result.missing.some(x=>x.startsWith('SESSION_IMPLEMENTATION_CHANGED_OR_UNBOUND:')));
});

test('actual dist execution bytes are bound even when source is unchanged',t=>{
 const f=fixture(t);f.complete();assert.equal(f.check().mcpLoopStatus,'PASS_REFERENCE');
 write(join(f.workspace,'dist/index.js'),'export const stale = true;');const result=f.check();assert.equal(result.mcpLoopStatus,'PARTIAL');assert.ok(result.missing.includes('RUN_IMPLEMENTATION_CHANGED_OR_UNBOUND'));assert.ok(result.missing.some(x=>x.startsWith('SESSION_IMPLEMENTATION_CHANGED_OR_UNBOUND:')));
});
