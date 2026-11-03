// Synthetic ledger fixtures only: these tests are not gameplay/SDK/author acceptance.
import {hostSourceFingerprint} from '../scripts/host-source-fingerprint.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkSimulatedHostAcceptance,simulatedHostProfile,simulatedHostProfileSha256} from '../scripts/simulated-host-acceptance.mjs';
import {initHostRun,captureHostCall,checkHostRun} from '../scripts/host-agent-run.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(p,v)=>writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));
function fixture(t,host='native-agent-simulated'){
 const workspace=mkdtempSync(join(tmpdir(),'a2game-host-run-'));t.after(()=>rmSync(workspace,{recursive:true,force:true}));
 for(const p of ['specs/v0.1/schemas','specs/v0.1/capabilities','docs','output/mcp','dist','player/adapters','player/vendor','integrations/skill/a2game/references'])mkdirSync(join(workspace,p),{recursive:true});
 write(join(workspace,'specs/v0.1/schemas/public.json'),{type:'object'});write(join(workspace,'docs/host-agent-pilot.md'),'Public task');write(join(workspace,'specs/v0.1/capabilities/public.capability.json'),{id:'a2game.test.public',version:'0.1.0'});
 for(const name of ['SKILL.md','references/workflow.md','references/troubleshooting.md'])write(join(workspace,'integrations/skill/a2game',name),'Public Skill '+name);
 write(join(workspace,'dist/index.js'),'export const stale = false;');
 for(const name of ['main.mjs','bootstrap.js','index.html','style.css','adapters/example.mjs'])write(join(workspace,'player',name),'original browser source '+name);
 write(join(workspace,'player/vendor/sdk-provenance.json'),{receipt:'original'});write(join(workspace,'player/vendor/three.module.js'),'downloaded SDK bound separately');
 write(join(workspace,'player/validated-games.json'),{generated:true});
 const {run,hostRunId}=initHostRun(host,workspace),sessionId=randomUUID(),artifactId=randomUUID();
 const output=join(workspace,'output/mcp',sessionId);mkdirSync(output);
 write(join(output,'session.json'),{format:'a2game-mcp-session',version:1,implementationSha256:hostSourceFingerprint(workspace),sessionId,hostRunId,state:'CLOSED',lastSequence:0,createdAt:new Date().toISOString()});
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
function scenario(t){
 const f=fixture(t);f.complete();
 const createdAt=JSON.parse(readFileSync(join(f.workspace,f.run,'run.json'))).createdAt;
 const batch={format:'a2game-simulated-host-acceptance-batch',version:1,scope:'SIMULATED_HOST_ACCEPTANCE',batchId:randomUUID(),startedAt:new Date(Date.parse(createdAt)-1000).toISOString(),endedAt:new Date().toISOString(),implementationSha256:hostSourceFingerprint(f.workspace),profileSha256:simulatedHostProfileSha256,cells:[]};
 const entry={cellId:'A:G01',group:'A',taskId:'G01',hostRunId:f.hostRunId,run:f.run};batch.cells.push(entry);
 const binding={format:'a2game-simulated-controller-binding',version:1,batchId:batch.batchId,cellId:entry.cellId,hostRunId:f.hostRunId,implementationSha256:batch.implementationSha256,profileSha256:batch.profileSha256,modelIdentity:'UNKNOWN',hostNativeUsage:'UNKNOWN',trust:'LOCAL_CONTROLLER_NOT_ATTESTED',authorId:'synthetic-author',controllerId:'synthetic-controller',createdAt};
 write(join(f.workspace,f.run,'controller-binding.json'),binding);
 entry.controllerBindingSha256=hash(readFileSync(join(f.workspace,f.run,'controller-binding.json')));
 const evidence=()=>{
  entry.controllerEvidence={};
  const requirements={...simulatedHostProfile.commonChecks,independentMechanics:simulatedHostProfile.mechanicsChecks.G01};
  for(const [category,ids]of Object.entries(requirements)){
   const report={...binding,format:'a2game-simulated-controller-evidence',category,artifactId:f.artifactId,scope:'Synthetic observations for checker regression only',limitations:['Not actual gameplay or SDK evidence'],observations:ids.map(checkId=>({checkId,result:'PASS_REFERENCE',...(category==='inputCoverage'?{applicability:{status:'APPLICABLE'}}:{}),observation:'Synthetic observation; does not prove semantics',evidence:[{path:'synthetic-observation.txt',sha256:hash('synthetic')}]}))};
   write(join(f.workspace,f.run,'synthetic-observation.txt'),'synthetic');
   const path=category+'.json';write(join(f.workspace,f.run,path),report);entry.controllerEvidence[category]={path,sha256:hash(readFileSync(join(f.workspace,f.run,path)))};
  }
 };
 return {...f,batch,entry,binding,evidence,check:()=>{batch.endedAt=new Date().toISOString();return checkSimulatedHostAcceptance(batch,f.workspace);}};
}
test('fixed neutral 15 cells remain separate; complete MCP alone is only partial',t=>{
 const f=scenario(t),r=f.check();assert.equal(r.counts.total,15);assert.equal(r.counts.attempted,1);assert.equal(r.counts.mcpLoopPassed,1);assert.equal(r.counts.partial,1);assert.equal(r.counts.notRun,14);assert.equal(r.counts.accepted,0);assert.equal(r.byGroup.A.total,5);assert.equal(r.byGroup.B.attempted,0);assert.equal(r.byTask.G01.total,3);assert.equal(r.realHostMatrix,'UNCHANGED_EXCLUDED_SIMULATION');assert.equal(r.modelIdentity,'UNKNOWN');assert.ok(Object.values(r.unverified).every(x=>x==='NOT_RUN'));
 assert.deepEqual(r.cells.map(x=>x.cellId),['A','B','C'].flatMap(g=>['G01','G03','G17','G21','H01'].map(t=>g+':'+t)));
 const original=JSON.parse(readFileSync(new URL('../project/host-first-tasks.json',import.meta.url)));assert.deepEqual(original.matrix.hosts,['qoder','workbuddy','trae']);assert.equal(original.matrix.total,15);
});
test('all bound local observations yield readiness only, never automated semantic acceptance',t=>{
 const f=scenario(t);f.evidence();const r=f.check();assert.equal(r.cells[0].status,'READY_FOR_CONTROLLER_ACCEPTANCE');assert.equal(r.counts.accepted,0);assert.equal(r.counts.readyForControllerAcceptance,1);assert.equal(r.status,'PARTIAL');
});
test('duplicate cell and reused physical run or hostRunId are refused',t=>{
 const f=scenario(t);f.batch.cells.push({...f.entry});assert.throws(f.check,/DUPLICATE_CELL/);f.batch.cells[1]={...f.entry,cellId:'B:G01',group:'B'};assert.throws(f.check,/DUPLICATE_RUN/);
});
test('unknown groups cannot be mapped to host brands',t=>{
 const f=scenario(t);f.entry.group='qoder';f.entry.cellId='qoder:G01';assert.throws(f.check,/UNKNOWN_CELL/);
});
test('mixed batch or run source fingerprints cannot count',t=>{
 const f=scenario(t);f.batch.implementationSha256='0'.repeat(64);assert.throws(f.check,/BATCH_SOURCE/);f.batch.implementationSha256=hostSourceFingerprint(f.workspace);
 const path=join(f.workspace,f.run,'run.json'),meta=JSON.parse(readFileSync(path));write(path,{...meta,implementationSha256:'0'.repeat(64)});assert.match(f.check().cells[0].reason,/RUN_SOURCE/);
});
test('old run, old canonical calls, and cross-batch bindings cannot be relabelled',t=>{
 const f=scenario(t),path=join(f.workspace,f.run,'run.json'),meta=JSON.parse(readFileSync(path));write(path,{...meta,createdAt:'2000-01-01T00:00:00Z'});assert.match(f.check().cells[0].reason,/RUN_OUTSIDE_BATCH/);write(path,meta);
 write(join(f.workspace,f.run,'controller-binding.json'),{...f.binding,batchId:'old-batch'});assert.match(f.check().cells[0].reason,/CONTROLLER_BINDING_SHA_MISMATCH/);write(join(f.workspace,f.run,'controller-binding.json'),f.binding);
 const id=f.add('list_capabilities',{}, {},{capture:false}),callPath=join(f.output,id+'.call.json'),call=JSON.parse(readFileSync(callPath));write(callPath,{...call,createdAt:'2000-01-01T00:00:00Z'});captureHostCall(f.run,id,f.workspace);assert.match(f.check().cells[0].reason,/CANONICAL_CALL_OUTSIDE_BATCH/);
});
test('uncaptured fourth validation is counted and refused',t=>{
 const f=scenario(t);for(let i=0;i<3;i++)f.add('validate_game',{}, {},{status:'FAIL',capture:false});assert.match(f.check().cells[0].reason,/BUDGET_EXCEEDED/);
});
test('native provenance cannot claim real host identity or known model usage',t=>{
 const f=scenario(t),path=join(f.workspace,f.run,'run.json'),meta=JSON.parse(readFileSync(path));write(path,{...meta,host:'qoder'});assert.match(f.check().cells[0].reason,/NATIVE_CANNOT_CLAIM_REAL_HOST/);write(path,meta);
 write(join(f.workspace,f.run,'controller-binding.json'),{...f.binding,modelIdentity:'self-reported-model'});assert.match(f.check().cells[0].reason,/CONTROLLER_BINDING_SHA_MISMATCH/);
});
test('self-reported PASS and missing or incomplete observations never imply acceptance',t=>{
 const f=scenario(t);f.entry.status='PASS';f.entry.independentMechanics='PASS';assert.equal(f.check().cells[0].status,'PARTIAL');f.evidence();
 const pointer=f.entry.controllerEvidence.independentMechanics,path=join(f.workspace,f.run,pointer.path),report=JSON.parse(readFileSync(path));report.observations.pop();write(path,report);pointer.sha256=hash(readFileSync(path));assert.equal(f.check().cells[0].status,'PARTIAL');
 report.observations[0].evidence=[];write(path,report);pointer.sha256=hash(readFileSync(path));assert.match(f.check().cells[0].reason,/CONTROLLER_FILES_REQUIRED/);
});
test('controller file mutations and same-author review are refused',t=>{
 const f=scenario(t);f.evidence();write(join(f.workspace,f.run,'synthetic-observation.txt'),'changed');assert.match(f.check().cells[0].reason,/FILE_SHA_MISMATCH/);
 write(join(f.workspace,f.run,'synthetic-observation.txt'),'synthetic');write(join(f.workspace,f.run,'controller-binding.json'),{...f.binding,controllerId:f.binding.authorId});assert.match(f.check().cells[0].reason,/CONTROLLER_BINDING_SHA_MISMATCH/);
});
test('missing canonical evidence cannot be replaced by complete controller reports',t=>{
 const f=scenario(t);f.evidence();rmSync(join(f.output,'session.json'));const r=f.check();assert.equal(r.cells[0].status,'PARTIAL');assert.equal(r.cells[0].mcpLoop,'PARTIAL');assert.equal(r.counts.accepted,0);
});
test('mixed canonical session source is refused, not hidden behind valid run source',t=>{
 const f=scenario(t),path=join(f.output,'session.json'),session=JSON.parse(readFileSync(path));write(path,{...session,implementationSha256:'1'.repeat(64)});assert.match(f.check().cells[0].reason,/SESSION_SOURCE_FINGERPRINT_MISMATCH/);
});
test('cross-batch controller report and old observations cannot qualify',t=>{
 const f=scenario(t);f.evidence();const pointer=f.entry.controllerEvidence.visualReference,path=join(f.workspace,f.run,pointer.path),report=JSON.parse(readFileSync(path));
 const rewrite=()=>{write(path,report);pointer.sha256=hash(readFileSync(path));};
 report.batchId='old-batch';rewrite();assert.match(f.check().cells[0].reason,/CONTROLLER_BINDING_MISMATCH:batchId/);
 report.batchId=f.batch.batchId;report.createdAt='2000-01-01T00:00:00Z';rewrite();assert.match(f.check().cells[0].reason,/CONTROLLER_OUTSIDE_BATCH/);
});
test('controller evidence cannot escape the run directory',t=>{
 const f=scenario(t);f.evidence();const pointer=f.entry.controllerEvidence.visualReference;pointer.path='../outside.json';write(join(f.workspace,f.run,'../outside.json'),'{}');assert.match(f.check().cells[0].reason,/EVIDENCE_PATH_ESCAPE/);
});
test('uncaptured Provider generation or unknown spend is forbidden',t=>{
 const f=scenario(t);f.add('generate_game',{}, {},{capture:false});assert.match(f.check().cells[0].reason,/PROVIDER_BUDGET_OR_GENERATION_FORBIDDEN/);
});
test('final inventory refuses a future batch end and any altered local binding bytes',t=>{
 const f=scenario(t);f.batch.endedAt=new Date(Date.now()+60000).toISOString();assert.throws(()=>checkSimulatedHostAcceptance(f.batch,f.workspace),/BATCH_NOT_ENDED/);
 write(join(f.workspace,f.run,'controller-binding.json'),{...f.binding,controllerId:'rewritten-controller'});assert.match(f.check().cells[0].reason,/CONTROLLER_BINDING_SHA_MISMATCH/);
});
test('binding digest is not an identity signature: even resealed same-author or known-model claims fail',t=>{
 const f=scenario(t),path=join(f.workspace,f.run,'controller-binding.json');
 write(path,{...f.binding,controllerId:f.binding.authorId});f.entry.controllerBindingSha256=hash(readFileSync(path));assert.match(f.check().cells[0].reason,/DISTINCT_CONTROLLER_REQUIRED/);
 write(path,{...f.binding,modelIdentity:'invented-model'});f.entry.controllerBindingSha256=hash(readFileSync(path));assert.match(f.check().cells[0].reason,/IDENTITY_NOT_ATTESTED/);
});
test('final inventory cannot accept still-running canonical calls',t=>{
 const f=scenario(t);f.add('validate_game',{}, {},{incomplete:true});assert.match(f.check().cells[0].reason,/BATCH_RUN_NOT_TERMINAL/);
});

test('final inventory requires canonical sessions to close, not merely completed calls',t=>{
 const f=scenario(t),path=join(f.output,'session.json'),session=JSON.parse(readFileSync(path));write(path,{...session,state:'OPEN'});assert.match(f.check().cells[0].reason,/BATCH_SESSION_NOT_CLOSED/);
});

test('failed unexported candidates retain canonical failures and controller rejection without fake export',t=>{
 const f=scenario(t);f.evidence();f.entry.reviewArtifactId=f.artifactId;
 const calls=readdirSync(f.output).filter(n=>n.endsWith('.call.json'));
 for(const file of calls){const path=join(f.output,file),call=JSON.parse(readFileSync(path));if(call.tool==='a2game.export_game'){
  call.tool='a2game.test_game';const receiptPath=join(f.output,call.runId+'.receipt.json'),response=JSON.parse(readFileSync(receiptPath));response.status='FAIL';response.diagnostics=[{code:'A2G_E_ASSERT',stage:'conformance',message:'synthetic failure'}];write(receiptPath,response);call.receiptSha256=hash(readFileSync(receiptPath));write(path,call);
  const captureDir=join(f.workspace,f.run,'calls',call.runId);rmSync(captureDir,{recursive:true,force:true});captureHostCall(f.run,call.runId,f.workspace);
 }}
 const pointer=f.entry.controllerEvidence.independentMechanics,path=join(f.workspace,f.run,pointer.path),report=JSON.parse(readFileSync(path));report.observations[0].result='FAIL';write(path,report);pointer.sha256=hash(readFileSync(path));
 const cell=f.check().cells[0];assert.equal(cell.status,'FAIL');assert.equal(cell.evidence.independentMechanics.status,'FAIL');assert.equal(cell.failures.length,1);assert.equal(cell.failures[0].codes[0],'A2G_E_ASSERT');
});
