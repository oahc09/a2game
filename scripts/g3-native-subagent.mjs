/** Native-subagent G3 ingestion: host records a fresh isolated subagent's verbatim reply, then the unchanged strict validator consumes it. No model-selected commands, no edits to raw output. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sha256Canonical} from '../dist/index.js';
import {root} from './registry.mjs';
import {buildG3Plan,inspectGeneratedTask} from './g3-batch.mjs';
import {buildAgentRequest,runAgentWorkflow} from './agent-workflow.mjs';
import {withCodexHostProfile} from './codex-generator.mjs';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
import {withNativeDelivery,workerInstructions,archiveNativeSources,classifyNativeFailure,pendingNativeReviews,nativeProtectedSources} from './g3-native-contract.mjs';
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const rel=p=>relative(root,p).replaceAll('\\','/'),hashBytes=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),hash=p=>hashBytes(resolve(root,p));
const SOURCE_PATHS=['scripts/g3-native-subagent.mjs','scripts/g3-native-contract.mjs','scripts/agent-workflow.mjs','scripts/g3-batch.mjs','scripts/g3-browser.mjs','scripts/g3-playthrough.mjs','scripts/codex-generator.mjs','generator/adapters/codex-generator.mjs','scripts/parse-agent-output.py','scripts/validate-agent-suite.py','project/g3-tasks.json'];
const safe=id=>id.replaceAll(/[^A-Za-z0-9._-]/g,'_');
function packManifest(packDir){const files={};const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);for(const f of walk(packDir))files[relative(packDir,f).replaceAll('\\','/')]=hashBytes(f);return {files,fileManifestSha256:sha256Canonical(files),contextSha256:sha256Canonical(read(resolve(packDir,'context.json')))};}
export function prepareNativeBatch({taskIds,model,approvedCalls=3,label}){
 assertBudget(approvedCalls);
 const plan=buildG3Plan(),tasks=plan.tasks.filter(t=>taskIds.includes(t.id));
 if(tasks.length!==taskIds.length||new Set(taskIds).size!==taskIds.length)throw Error('A2G_E_G3_NATIVE_TASK: 未知或重复任务。');
  if(taskIds.length!==1)throw Error('A2G_E_G3_NATIVE_TASK: 原生批次每次只派发一款。');
 const directory=resolve(root,'reports',(label?'g3-native-subagent-'+label+'-':'g3-native-subagent-')+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);
 if(existsSync(directory))throw Error('A2G_E_G3_NATIVE_DIR: 回执目录必须为新目录。');mkdirSync(directory,{recursive:true});
 const protectedPaths=nativeProtectedSources(root,SOURCE_PATHS),fingerprints=Object.fromEntries(protectedPaths.map(p=>[p,hash(p)]));save(resolve(directory,'fingerprints.json'),fingerprints);
 save(resolve(directory,'plan.json'),plan);
 const baselineIndex=read(resolve(root,'project/independent-g3-run.json')),baseline=read(resolve(root,baselineIndex.summary));
 if(hash(baselineIndex.summary)!==baselineIndex.sha256)throw Error('A2G_E_G3_BASELINE: 历史索引 SHA 不匹配。');
 save(resolve(directory,'budget.json'),{format:'a2game-g3-native-budget',version:1,baselineIndex:'project/independent-g3-run.json',baselineSummarySha256:baselineIndex.sha256,baselineGenerationCalls:baseline.calls,baselineProbes:baseline.probeCalls,approvedAdditionalCalls:approvedCalls,unitMaxAttempts:3,newGenerationCalls:0});
 const pack=resolve(directory,'pack');for(const sub of ['capabilities','library'])mkdirSync(resolve(pack,sub),{recursive:true});
 const request=withNativeDelivery(withCodexHostProfile(buildAgentRequest(tasks[0].prompt,1)));
 save(resolve(pack,'context.json'),request);
 writeFileSync(resolve(pack,'worker.txt'),workerInstructions('context.json','../_incoming/'+tasks[0].id+'-attempt-1.raw.json'),{flag:'wx'});
 for(const m of request.capabilities){const file='capabilities/'+safe(m.id)+'.json';save(resolve(pack,file),m);}
 const capabilityIndex={count:request.capabilities.length,files:Object.fromEntries(request.capabilities.map(m=>[m.id,{version:m.version,file:'capabilities/'+safe(m.id)+'.json',sha256:hashBytes(resolve(pack,'capabilities/'+safe(m.id)+'.json'))}]))};
 save(resolve(pack,'capability-index.json'),capabilityIndex);
 const {hostProfile}=request,library={};for(const [path,entry] of Object.entries(hostProfile.publicLibrary)){const file='library/'+path.split('/').pop();writeFileSync(resolve(pack,file),entry.source);library[path]={sha256:entry.sha256,file};}
 const profile={version:hostProfile.version,libraryBoundary:hostProfile.libraryBoundary,libraryIndex:library,publicPresentationContract:hostProfile.publicPresentationContract,inputBindingSources:hostProfile.inputBindingSources,bindingRule:hostProfile.bindingRule,observation:hostProfile.observation,buttons:hostProfile.buttons,hostLimits:hostProfile.hostLimits,cases:hostProfile.cases};
 save(resolve(pack,'host-profile.json'),profile);
 writeFileSync(resolve(pack,'game.schema.json'),readFileSync(resolve(root,'specs/v0.1/schemas/game.schema.json')));
 writeFileSync(resolve(pack,'test-suite.schema.json'),readFileSync(resolve(root,'specs/v0.1/schemas/test-suite.schema.json')));
 save(resolve(pack,'output-contract.json'),{format:'a2game-native-output-contract',version:1,outputContract:request.outputContract,constraints:request.constraints,specVersion:request.specVersion,capabilityDigest:request.capabilityDigest});
 const required=[...tasks[0].requirements.all,...(tasks[0].requirements.anyOf??[]).flat()].map(c=>capabilityIndex.files[c.id]?.file).filter(Boolean);
 writeTask(pack,tasks[0],1,null,required);
 save(resolve(directory,'request-attempt-1.json'),request);
 const manifest=packManifest(pack),skillSha256=sha256Canonical({hostProfile:request.hostProfile,nativeDelivery:request.nativeDelivery});
 archiveNativeSources(directory,root,protectedPaths);
 const summary={format:'a2game-g3-native-batch',version:1,status:'PARTIAL',mode:'native-subagent',...(label?{label}:{}),selected:taskIds,provider:{route:'zcode-agent-tool',requestedGenerator:model,observedGenerator:null,identityStatus:'HOST_ROUTED_PENDING_EVIDENCE_FILE'},host:{name:'zcode-desktop-agent-tool',isolation:'INSTRUCTION_LEVEL_NOT_ENFORCED',subagentType:'general-purpose'},budget:read(resolve(directory,'budget.json')),engineeringPassed:0,independentG3Passed:0,G3:'NOT_RUN',independenceReview:'NOT_RUN',qualityReview:'NOT_RUN',unchanged:true,fingerprints:rel(resolve(directory,'fingerprints.json')),pack:{directory:rel(pack),taskSha256:tasks[0].promptSha256,initialContextSha256:manifest.contextSha256,skillVersion:'a2game-g3-public-abi@'+hostProfile.version+'+native-delivery-v2',skillSha256},cases:tasks.map(t=>({id:t.id,status:'NOT_RUN',G3:'NOT_RUN',reason:'Awaiting isolated subagent generation',attempts:[]}))};
 summary.review=pendingNativeReviews();save(resolve(directory,'summary.json'),summary);
 return {batch:rel(directory),pack:rel(pack),taskSha256:tasks[0].promptSha256,initialContextSha256:manifest.contextSha256,skillVersion:summary.pack.skillVersion,skillSha256,prompt:tasks[0].prompt};
}
function writeTask(pack,task,attempt,previous,required){save(resolve(pack,'task.json'),{format:'a2game-native-task',version:1,gameId:task.id,attempt,prompt:task.prompt,requirements:task.requirements,requiredCapabilityFiles:[...new Set(required)],...(previous?{previous}:{})});}
function assertBudget(approved){if(!Number.isInteger(approved)||approved<1||approved>3)throw Error('A2G_E_G3_NATIVE_BUDGET: 本轮新增生成预算必须为 1–3。');}
export async function ingestNativeReply({batch,taskId,rawFile,record,generationCall=true}){
 batch=resolve(root,batch);const summaryPath=resolve(batch,'summary.json');if(!existsSync(summaryPath))throw Error('A2G_E_G3_NATIVE_BATCH: 未找到批次。');
 const summary=read(summaryPath),budget=read(resolve(batch,'budget.json')),task=read(resolve(batch,'plan.json')).tasks.find(t=>t.id===taskId),row=summary.cases.find(c=>c.id===taskId);
 if(!task||!row)throw Error('A2G_E_G3_NATIVE_TASK: 批次不含该任务。');
 const attempt=row.attempts.length+1;assertBudget(budget.approvedAdditionalCalls);
 if(attempt>budget.approvedAdditionalCalls)throw Error('A2G_E_G3_NATIVE_BUDGET: 已达本轮新增生成预算，停止派发。');
 if(!generationCall)throw Error('A2G_E_G3_NATIVE_BUDGET: 新回复必须计入生成次数；INFRA 复测应重放原字节，不能创建免计费尝试。');
 const attemptDir=resolve(batch,taskId,'attempt-'+attempt);if(existsSync(attemptDir))throw Error('A2G_E_G3_NATIVE_DIR: 尝试目录必须为新目录。');mkdirSync(attemptDir,{recursive:true});delete row.reason;
 budget.newGenerationCalls++;save(resolve(batch,'budget.json'),budget);summary.budget.newGenerationCalls=budget.newGenerationCalls;
 const rawAbs=rawFile?resolve(root,rawFile):null,hasRaw=!!rawAbs&&existsSync(rawAbs);
 if(hasRaw)writeFileSync(resolve(attemptDir,'output.raw.json'),readFileSync(rawAbs),{flag:'wx'});
 const call={format:'a2game-native-subagent-call',version:1,attempt,generationCall,route:'zcode-agent-tool',requestedGenerator:summary.provider.requestedGenerator,rawBytes:hasRaw?readFileSync(rawAbs).length:0,rawSha256:hasRaw?hashBytes(rawAbs):null,usage:record?.usage??'NOT_REPORTED',isolation:summary.host.isolation};save(resolve(attemptDir,'call.json'),call);
 if(record)save(resolve(attemptDir,'subagent.json'),{format:'a2game-native-subagent-record',version:1,...record});
 const item={attempt,status:'FAIL',generationCall,directory:rel(attemptDir),review:pendingNativeReviews()};
 let failure=null;
 try{
  if(!Object.entries(read(resolve(batch,'fingerprints.json'))).every(([p,h])=>hash(p)===h))throw Object.assign(Error('A2G_E_G3_STALE_SOURCE: 源码与准备时不同；保留快照及旧结果。'),{code:'A2G_E_G3_STALE_SOURCE',attribution:'INFRA'});
  if(!hasRaw||readFileSync(rawAbs).length===0)throw Object.assign(Error('A2G_E_G3_NO_RAW_OUTPUT: 子 Agent 未交付原始 JSON；已记账。'),{code:'A2G_E_G3_NO_RAW_OUTPUT',attribution:['NO_OUTPUT','NO_REPLY_RECORDED'].includes(record?.status)?'MODEL_OUTPUT_PROTOCOL':'UNRESOLVED_HOST_OR_MODEL'});
  if(readFileSync(rawAbs).length>768*1024)throw Object.assign(Error('A2G_E_G3_NATIVE_RAW: 原始回复超出字节预算。'),{code:'A2G_E_G3_NATIVE_RAW',attribution:'MODEL_OUTPUT_PROTOCOL'});
  const validation=await runAgentWorkflow({prompt:task.prompt,command:[process.execPath,'scripts/g3-native-subagent.mjs','--read-output',resolve(attemptDir,'output.raw.json')],maxAttempts:1,timeoutMs:60000,directory:resolve(attemptDir,'validation')});
  item.validation=rel(resolve(attemptDir,'validation/summary.json'));
  if(!validation.success){const error=read(resolve(attemptDir,'validation/attempt-1.json'));failure={code:error.code,message:error.message,diagnostics:error.diagnostics??[]};item.attribution=error.attribution;}
  else{
   const output=read(resolve(attemptDir,'validation/output-1.json'));checkG3SuiteBudget(output.conformance);item.content=inspectGeneratedTask(task,validation.success);
   const browser=await verifyGeneratedBrowser(resolve(attemptDir,'validation'),resolve(attemptDir,'browser'));item.browser=rel(resolve(attemptDir,'browser/summary.json'));
   if(browser.status!=='PASS'){failure={code:'A2G_E_G3_BROWSER',message:'双 SDK 回放未通过。',diagnostics:browser.cases.map(c=>({backend:c.backend,status:c.status}))};item.attribution='ENGINE_OR_HOST_UNRESOLVED';}
   else{item.status='PASS_REFERENCE';row.status='PASS_REFERENCE';row.oneShot=attempt===1;delete row.reason;}
  }
 }catch(e){failure={code:e.code??String(e.message).match(/A2G_E_[A-Z0-9_]+/)?.[0]??'A2G_E_G3_NATIVE_RUN',message:String(e.message).slice(0,600),diagnostics:e.diagnostics??[]};item.attribution=classifyNativeFailure(e);}
 if(failure){item.code=failure.code;item.message=failure.message;row.status='FAIL';save(resolve(attemptDir,'diagnostics.json'),{...failure,...(hasRaw?{output:{raw:readFileSync(resolve(attemptDir,'output.raw.json'),'utf8')}}:{})});}
 row.attempts.push(item);summary.engineeringPassed=summary.cases.filter(c=>c.status==='PASS_REFERENCE').length;
 const unchanged=Object.entries(read(resolve(batch,'fingerprints.json'))).every(([p,h])=>hash(p)===h);
 summary.unchanged=unchanged;summary.status=!unchanged||summary.cases.some(c=>c.status==='FAIL')?'FAIL':summary.engineeringPassed===summary.selected.length?'PASS_REFERENCE':'PARTIAL';
 if(existsSync(resolve(batch,'host-identity.json'))){summary.provider.identityStatus='HOST_EXPORT_PENDING_INDEPENDENT_REVIEW';summary.host.identityEvidence=rel(resolve(batch,'host-identity.json'));}else summary.provider.identityStatus='HOST_DECLARED_NO_EVIDENCE_FILE';
 save(summaryPath,summary);
 return {attempt:item.attempt,status:item.status,code:item.code??null,attribution:item.attribution??null,directory:rel(attemptDir),batch:rel(batch),newGenerationCalls:budget.newGenerationCalls,diagnostics:failure?rel(resolve(attemptDir,'diagnostics.json')):null};
}
export function prepareNativeRepair({batch,taskId}){
 batch=resolve(root,batch);const summaryPath=resolve(batch,'summary.json'),summary=read(summaryPath),budget=read(resolve(batch,'budget.json')),task=read(resolve(batch,'plan.json')).tasks.find(t=>t.id===taskId),row=summary.cases.find(c=>c.id===taskId);
 const attempt=row.attempts.length+1;assertBudget(budget.approvedAdditionalCalls);
 if(attempt>budget.approvedAdditionalCalls)throw Error('A2G_E_G3_NATIVE_BUDGET: 无剩余预算用于修复。');
 if(row.status==='PASS_REFERENCE')throw Error('A2G_E_G3_NATIVE_TASK: 已通过，无需修复。');
 const previousPath=resolve(batch,taskId,'attempt-'+(attempt-1),'diagnostics.json');if(!existsSync(previousPath))throw Error('A2G_E_G3_NATIVE_TASK: 上一轮无诊断记录。');
 const pack=resolve(batch,'pack'),previous=read(previousPath);
 copyFileSync(resolve(pack,'task.json'),resolve(pack,'task.attempt-'+(attempt-1)+'.json'));
 const capabilityIndex=read(resolve(pack,'capability-index.json')),required=[...task.requirements.all,...(task.requirements.anyOf??[]).flat()].map(c=>capabilityIndex.files[c.id]?.file).filter(Boolean);
 writeTask(pack,task,attempt,previous,required);
 const request=withNativeDelivery(withCodexHostProfile(buildAgentRequest(task.prompt,attempt,previous)));save(resolve(batch,'request-attempt-'+attempt+'.json'),request);
 save(resolve(pack,'context.json'),request);
 writeFileSync(resolve(pack,'worker.txt'),workerInstructions('context.json','../_incoming/'+taskId+'-attempt-'+attempt+'.raw.json'));
 const manifest=packManifest(pack);save(summaryPath,{...summary,pack:{...summary.pack,contextSha256:manifest.contextSha256}});
 return {attempt,pack:rel(pack),taskFile:rel(resolve(pack,'task.json')),contextSha256:manifest.contextSha256,previousFrom:rel(previousPath)};
}
export function writeNativeHandoff({batch,taskId,orchestrator,reviewer,parentSession,commit,exitCode}){
 batch=resolve(root,batch);const summaryPath=resolve(batch,'summary.json'),summary=read(summaryPath),budget=read(resolve(batch,'budget.json')),task=read(resolve(batch,'plan.json')).tasks.find(t=>t.id===taskId),row=summary.cases.find(c=>c.id===taskId);
 const attemptEntries=row.attempts.map(item=>{const dir=resolve(root,item.directory),rawPath=resolve(dir,'output.raw.json'),entry={attempt:item.attempt,status:item.status,generationCall:item.generationCall,directory:item.directory,call:rel(resolve(dir,'call.json')),raw:existsSync(rawPath)?{path:rel(rawPath),sha256:hashBytes(rawPath),bytes:readFileSync(rawPath).length}:null,request:existsSync(resolve(batch,'request-attempt-'+item.attempt+'.json'))?{path:rel(resolve(batch,'request-attempt-'+item.attempt+'.json')),sha256:hashBytes(resolve(batch,'request-attempt-'+item.attempt+'.json'))}:null};
  if(existsSync(resolve(dir,'subagent.json')))entry.subagent=read(resolve(dir,'subagent.json'));
  if(item.validation)entry.validation={path:item.validation,sha256:hashBytes(resolve(root,item.validation)),status:read(resolve(root,item.validation)).status};
  if(item.browser)entry.browser={path:item.browser,sha256:hashBytes(resolve(root,item.browser)),status:read(resolve(root,item.browser)).status};
  if(item.content)entry.content=item.content;
  if(item.code){entry.code=item.code;entry.attribution=item.attribution;entry.diagnostics=rel(resolve(dir,'diagnostics.json'));}
  return entry;});
 const identity=existsSync(resolve(batch,'host-identity.json'))?read(resolve(batch,'host-identity.json')):null;
 const handoff={format:'a2game-g3-subagent-handoff',version:1,gameId:taskId,sourceCommit:commit,experiment:{id:'native-'+summary.provider.requestedGenerator+'-'+taskId+'-r1',variantId:'variant-round-1',mode:'native-subagent',taskSha256:summary.pack.taskSha256,contextSha256:summary.pack.initialContextSha256,skillVersion:summary.pack.skillVersion,skillSha256:summary.pack.skillSha256},models:{orchestrator,requestedGenerator:summary.provider.requestedGenerator,observedGenerator:identity?.observedGenerator??null,identityEvidence:identity,reviewer},host:{name:summary.host.name,parentSession,workerSessions:attemptEntries.map(e=>e.subagent?.agentId??'not-exposed-by-host').join(',')||'none',toolRecord:{isolation:summary.host.isolation,subagentType:summary.host.subagentType,identityStatus:summary.provider.identityStatus}},budget:{baselineSummary:'project/independent-g3-run.json',baselineSummarySha256:hash('project/independent-g3-run.json'),baselineGenerationCalls:budget.baselineGenerationCalls,approvedAdditionalCalls:budget.approvedAdditionalCalls,roundCallsBefore:0,taskCallsBefore:0,newGenerationCalls:budget.newGenerationCalls},batchSummary:rel(summaryPath),batchSummarySha256:hashBytes(summaryPath),commandExitCode:exitCode,attempts:attemptEntries,engineeringStatus:row.status==='PASS_REFERENCE'?'PASS_REFERENCE':'NOT_PASSED',reviewStatus:'AWAITING_REVIEW',formalG3:'NOT_RUN'};
 save(resolve(batch,'handoff.json'),handoff);return {handoff:rel(resolve(batch,'handoff.json')),engineeringStatus:handoff.engineeringStatus,newGenerationCalls:budget.newGenerationCalls};
}
// The shim only replays a host-recorded verbatim reply; generation lifetime belongs to the subagent session, validation stays bounded.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const args=process.argv.slice(2);
 if(args[0]==='--read-output'){let bytes=0;for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>2*1024*1024)throw Error('请求超出预算。');}const raw=readFileSync(resolve(root,args[1]));if(raw.length>768*1024)throw Error('输出超出预算。');process.stdout.write(raw);}
 else if(args[0]==='prepare'){const arg=n=>args.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);const result=prepareNativeBatch({taskIds:arg('ids')?.split(',')??['G01'],model:arg('model')??'UNSPECIFIED',approvedCalls:parseInt(arg('calls')??'3',10),label:arg('label')});console.log(JSON.stringify(result,null,2));}
 else if(args[0]==='ingest'){const arg=n=>args.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);if(!arg('batch'))throw Error('用法：ingest --batch <dir> --raw <file> [--ids=G01] [--record=<file>]');const result=await ingestNativeReply({batch:arg('batch'),taskId:arg('ids')??'G01',rawFile:arg('raw'),...(arg('record')?{record:read(resolve(root,arg('record')))}:{}),generationCall:!args.includes('--no-generation-call')});console.log(JSON.stringify(result,null,2));if(result.status==='FAIL')process.exitCode=1;}
 else if(args[0]==='repair'){const arg=n=>args.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);if(!arg('batch'))throw Error('用法：repair --batch <dir> [--ids=G01]');console.log(JSON.stringify(prepareNativeRepair({batch:arg('batch'),taskId:arg('ids')??'G01'}),null,2));}
 else if(args[0]==='handoff'){const arg=n=>args.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);if(!arg('batch')||!arg('commit'))throw Error('用法：handoff --batch <dir> --commit <sha> [--ids=G01] [--orchestrator=] [--reviewer=] [--parent-session=] [--exit-code=0]');console.log(JSON.stringify(writeNativeHandoff({batch:arg('batch'),taskId:arg('ids')??'G01',orchestrator:arg('orchestrator')??'unknown',reviewer:arg('reviewer')??'external-session-review-agent',parentSession:arg('parent-session')??'not-exposed-by-host',commit:arg('commit'),exitCode:parseInt(arg('exit-code')??'0',10)}),null,2));}
 else throw Error('用法：g3-native-subagent.mjs prepare|ingest|repair|handoff ...');
}catch(e){console.error('A2G_E_G3_NATIVE：'+e.message);process.exitCode=1;}
