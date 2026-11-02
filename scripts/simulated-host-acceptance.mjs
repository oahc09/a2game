/** Read-only simulation inventory. No model calls, generic game oracle, or formal-host promotion. */
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkHostRun} from './host-agent-run.mjs';
import {readHostRunLedger} from './host-run-ledger.mjs';
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
const root=resolve(import.meta.dirname,'..');
const profileBytes=readFileSync(new URL('../project/simulated-host-acceptance-profile.json',import.meta.url));
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
export const simulatedHostProfile=deepFreeze(JSON.parse(profileBytes));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const simulatedHostProfileSha256=hash(profileBytes);
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};
function local(base,path){
 const b=realpathSync(base),p=realpathSync(resolve(base,path));
 requireValue(p.startsWith(b+sep),'EVIDENCE_PATH_ESCAPE');return p;
}
const time=value=>typeof value==='string'?Date.parse(value):NaN;
function inBatch(value,batch){const t=time(value);return Number.isFinite(t)&&t>=time(batch.startedAt)&&t<=time(batch.endedAt);}
const requiredFor=task=>({...simulatedHostProfile.commonChecks,independentMechanics:simulatedHostProfile.mechanicsChecks[task]});

function controllerEvidence(directory,entry,batch,selected,binding){
 const required=requiredFor(entry.taskId),result={};
 for(const [category,ids] of Object.entries(required)){
  const pointer=entry.controllerEvidence?.[category];
  if(!pointer){result[category]={status:'PARTIAL',missing:ids};continue;}
  const bytes=readFileSync(local(directory,pointer.path));requireValue(hash(bytes)===pointer.sha256,'CONTROLLER_REPORT_SHA_MISMATCH');
  const report=JSON.parse(bytes);
  requireValue(report.format==='a2game-simulated-controller-evidence'&&report.version===1,'CONTROLLER_REPORT_FORMAT');
  for(const [key,value]of Object.entries({batchId:batch.batchId,cellId:entry.cellId,hostRunId:entry.hostRunId,implementationSha256:batch.implementationSha256,profileSha256:batch.profileSha256,artifactId:selected?.artifactId,category}))requireValue(value&&report[key]===value,'CONTROLLER_BINDING_MISMATCH:'+key);
  requireValue(report.trust==='LOCAL_CONTROLLER_NOT_ATTESTED'&&report.controllerId===binding.controllerId&&report.controllerId!==binding.authorId,'CONTROLLER_IDENTITY_REQUIRED');
  requireValue(inBatch(report.createdAt,batch),'CONTROLLER_OUTSIDE_BATCH');
  requireValue(typeof report.scope==='string'&&report.scope.trim()&&Array.isArray(report.limitations)&&report.limitations.length&&report.limitations.every(x=>typeof x==='string'&&x.trim()),'CONTROLLER_SCOPE_LIMITATIONS_REQUIRED');
  requireValue(Array.isArray(report.observations),'CONTROLLER_OBSERVATIONS_REQUIRED');
  const seen=new Set();
  for(const observation of report.observations){
   requireValue(ids.includes(observation.checkId)&&!seen.has(observation.checkId),'CONTROLLER_CHECK_UNKNOWN_OR_DUPLICATE');seen.add(observation.checkId);
   requireValue(['PASS_REFERENCE','FAIL','PARTIAL'].includes(observation.result)&&typeof observation.observation==='string'&&observation.observation.trim(),'CONTROLLER_OBSERVATION_REQUIRED');
   requireValue(Array.isArray(observation.evidence)&&observation.evidence.length,'CONTROLLER_FILES_REQUIRED');
   for(const file of observation.evidence){const bytes=readFileSync(local(directory,file.path));requireValue(bytes.length>0&&hash(bytes)===file.sha256,'CONTROLLER_FILE_SHA_MISMATCH');}
  }
  const missing=ids.filter(id=>!seen.has(id));
  result[category]={status:report.observations.some(x=>x.result==='FAIL')?'FAIL':missing.length||report.observations.some(x=>x.result!=='PASS_REFERENCE')?'PARTIAL':'CONTROLLER_REVIEW_RECORDED',missing,trust:'LOCAL_CONTROLLER_NOT_ATTESTED'};
 }
 return result;
}

/** batch requires explicit frozen source/profile, time interval, unique run bindings and cells. */
export function checkSimulatedHostAcceptance(batch,workspace=root){
 const p=simulatedHostProfile;
 requireValue(batch?.format==='a2game-simulated-host-acceptance-batch'&&batch.version===1&&batch.scope===p.scope,'SIMULATION_BATCH_FORMAT');
 requireValue(typeof batch.batchId==='string'&&batch.batchId.trim(),'BATCH_ID_REQUIRED');
 requireValue(Number.isFinite(time(batch.startedAt))&&Number.isFinite(time(batch.endedAt))&&time(batch.startedAt)<=time(batch.endedAt),'BATCH_INTERVAL_REQUIRED');
 requireValue(time(batch.endedAt)<=Date.now(),'BATCH_NOT_ENDED');
 requireValue(batch.profileSha256===simulatedHostProfileSha256,'PROFILE_FINGERPRINT_MISMATCH');
 requireValue(batch.implementationSha256===hostSourceFingerprint(workspace),'BATCH_SOURCE_FINGERPRINT_MISMATCH');
 requireValue(Array.isArray(batch.cells),'CELLS_REQUIRED');
 const entries=new Map(),runs=new Set(),hostRuns=new Set(),canonicalIds=new Set();
 for(const entry of batch.cells){
  requireValue(entry&&p.groups.includes(entry.group)&&p.tasks.includes(entry.taskId)&&entry.cellId===entry.group+':'+entry.taskId,'UNKNOWN_CELL');
  requireValue(!entries.has(entry.cellId),'DUPLICATE_CELL');entries.set(entry.cellId,entry);
  requireValue(typeof entry.run==='string'&&entry.run&&typeof entry.hostRunId==='string'&&entry.hostRunId,'RUN_BINDING_REQUIRED');
  const directory=local(join(workspace,'reports/host-first-evaluations'),resolve(workspace,entry.run));
  requireValue(!runs.has(directory)&&!hostRuns.has(entry.hostRunId),'DUPLICATE_RUN');runs.add(directory);hostRuns.add(entry.hostRunId);
 }
 const cells=[];
 for(const group of p.groups)for(const taskId of p.tasks){
  const cellId=group+':'+taskId,entry=entries.get(cellId);
  if(!entry){cells.push({cellId,group,taskId,status:'NOT_RUN'});continue;}
  let checked;
  try{
   const directory=local(join(workspace,'reports/host-first-evaluations'),resolve(workspace,entry.run)),meta=read(local(directory,'run.json'));
   requireValue(meta.host===p.host&&meta.provenance===p.provenance,'NATIVE_CANNOT_CLAIM_REAL_HOST');
   requireValue(meta.hostRunId===entry.hostRunId,'RUN_BINDING_MISMATCH');
   requireValue(meta.implementationSha256===batch.implementationSha256,'RUN_SOURCE_FINGERPRINT_MISMATCH');
   requireValue(meta.maxValidationAttempts===3&&meta.mcpProviderBudget===0&&meta.hostNativeUsage==='UNKNOWN'&&meta.formalG3==='NOT_RUN','RUN_BUDGET_OR_SCOPE_MISMATCH');
   requireValue(inBatch(meta.createdAt,batch),'RUN_OUTSIDE_BATCH');
   const bindingBytes=readFileSync(local(directory,'controller-binding.json'));
   requireValue(hash(bindingBytes)===entry.controllerBindingSha256,'CONTROLLER_BINDING_SHA_MISMATCH');
   const binding=JSON.parse(bindingBytes);
   requireValue(binding.format==='a2game-simulated-controller-binding'&&binding.version===1,'LOCAL_BINDING_FORMAT');
   for(const [key,value]of Object.entries({batchId:batch.batchId,cellId,hostRunId:entry.hostRunId,implementationSha256:batch.implementationSha256,profileSha256:batch.profileSha256}))requireValue(binding[key]===value,'LOCAL_BINDING_MISMATCH:'+key);
   requireValue(binding.modelIdentity==='UNKNOWN'&&binding.hostNativeUsage==='UNKNOWN'&&binding.trust==='LOCAL_CONTROLLER_NOT_ATTESTED','IDENTITY_NOT_ATTESTED');
   requireValue(typeof binding.authorId==='string'&&binding.authorId.trim()&&typeof binding.controllerId==='string'&&binding.controllerId.trim()&&binding.authorId!==binding.controllerId,'DISTINCT_CONTROLLER_REQUIRED');
   requireValue(inBatch(binding.createdAt,batch),'BINDING_OUTSIDE_BATCH');
   checked=checkHostRun(entry.run,workspace);const ledger=readHostRunLedger(workspace,entry.hostRunId);
   requireValue(!ledger.problems.some(x=>x.startsWith('CANONICAL_CALL_INCOMPLETE:')),'BATCH_RUN_NOT_TERMINAL');
   requireValue(checked.validationAttempts<=3,'VALIDATION_ATTEMPT_BUDGET_EXCEEDED');
   requireValue(!ledger.problems.some(x=>x.startsWith('SESSION_IMPLEMENTATION_CHANGED_OR_UNBOUND:')),'SESSION_SOURCE_FINGERPRINT_MISMATCH');
   requireValue(!ledger.problems.some(x=>x.startsWith('CANONICAL_PROVIDER_BUDGET_UNKNOWN_OR_CONSUMED:')||x.startsWith('PROVIDER_GENERATION_FORBIDDEN:')),'PROVIDER_BUDGET_OR_GENERATION_FORBIDDEN');
   for(const {call}of ledger.calls){requireValue(inBatch(call.createdAt,batch),'CANONICAL_CALL_OUTSIDE_BATCH');requireValue(!canonicalIds.has(call.runId),'DUPLICATE_CANONICAL_RUN');canonicalIds.add(call.runId);}
   for(const sessionId of new Set(ledger.calls.map(x=>x.call.sessionId))){
    const session=read(local(join(workspace,'output/mcp'),sessionId+'/session.json'));
    requireValue(session.state==='CLOSED','BATCH_SESSION_NOT_CLOSED');
   }
   // A rejected candidate need not be exported merely to preserve its review.
   const reviewArtifact=checked.selected?.artifactId??entry.reviewArtifactId;
   if(!checked.selected&&reviewArtifact)requireValue(ledger.calls.some(x=>x.call.tool==='a2game.validate_game'&&x.response?.status==='PASS_REFERENCE'&&x.response.data?.artifactId===reviewArtifact),'REVIEW_ARTIFACT_NOT_IN_RUN');
   const evidence=controllerEvidence(directory,entry,batch,reviewArtifact?{artifactId:reviewArtifact}:null,binding);
   const failed=Object.values(evidence).some(x=>x.status==='FAIL');
   const ready=checked.mcpLoopStatus==='PASS_REFERENCE'&&!ledger.problems.length&&Object.values(evidence).every(x=>x.status==='CONTROLLER_REVIEW_RECORDED');
   cells.push({cellId,group,taskId,hostRunId:entry.hostRunId,status:failed?'FAIL':ready?'READY_FOR_CONTROLLER_ACCEPTANCE':'PARTIAL',mcpLoop:checked.mcpLoopStatus,validationAttempts:checked.validationAttempts,canonicalCalls:ledger.calls.length,missing:checked.missing,failures:checked.failures,evidence});
  }catch(error){cells.push({cellId,group,taskId,status:'FAIL',reason:error.message,failures:checked?.failures??[]});}
 }
 const count=status=>cells.filter(x=>x.status===status).length;
 const summarize=subset=>({total:subset.length,attempted:subset.filter(x=>x.status!=='NOT_RUN').length,mcpLoopPassed:subset.filter(x=>x.mcpLoop==='PASS_REFERENCE').length,readyForControllerAcceptance:subset.filter(x=>x.status==='READY_FOR_CONTROLLER_ACCEPTANCE').length,accepted:0});
 const byGroup=Object.fromEntries(p.groups.map(group=>[group,summarize(cells.filter(x=>x.group===group))]));
 const byTask=Object.fromEntries(p.tasks.map(task=>[task,summarize(cells.filter(x=>x.taskId===task))]));
 return {format:'a2game-simulated-host-acceptance-check',version:1,scope:p.scope,batchId:batch.batchId,implementationSha256:batch.implementationSha256,profileSha256:batch.profileSha256,status:count('FAIL')?'FAIL':count('READY_FOR_CONTROLLER_ACCEPTANCE')===15?'READY_FOR_CONTROLLER_ACCEPTANCE':'PARTIAL',counts:{total:15,attempted:entries.size,notRun:count('NOT_RUN'),partial:count('PARTIAL'),failed:count('FAIL'),readyForControllerAcceptance:count('READY_FOR_CONTROLLER_ACCEPTANCE'),accepted:0,mcpLoopPassed:cells.filter(x=>x.mcpLoop==='PASS_REFERENCE').length},byGroup,byTask,cells,modelIdentity:'UNKNOWN',hostNativeUsage:'UNKNOWN',realHostMatrix:'UNCHANGED_EXCLUDED_SIMULATION',evidenceTrust:p.evidenceTrust,unverified:Object.fromEntries(p.unverified.map(key=>[key,'NOT_RUN'])),limitations:p.limitations};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{requireValue(process.argv.length===3,'Usage: node scripts/simulated-host-acceptance.mjs <local-batch.json>');const result=checkSimulatedHostAcceptance(read(resolve(process.argv[2])));console.log(JSON.stringify(result,null,2));if(result.status!=='READY_FOR_CONTROLLER_ACCEPTANCE')process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=1;}
}
