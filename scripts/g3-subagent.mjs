/** Native sub-agent ingestion: the host records raw replies, this process only validates them. No model call happens here. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
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

const read=(p)=>JSON.parse(readFileSync(resolve(p),'utf8'));
const save=(p,v)=>{mkdirSync(resolve(p,'..'),{recursive:true});writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const rel=(p)=>relative(root,p).replaceAll('\\','/');
const hash=(p)=>createHash('sha256').update(readFileSync(resolve(p))).digest('hex');
const PACK_VERSION='public-task-pack-v1';
const SOURCE_FILES=['scripts/g3-subagent.mjs','scripts/g3-batch.mjs','scripts/g3-browser.mjs','scripts/g3-playthrough.mjs','scripts/agent-workflow.mjs','scripts/agent-solver.mjs','scripts/codex-generator.mjs','scripts/parse-agent-output.py','scripts/validate-agent-suite.py','project/g3-tasks.json','project/gameplay-acceptance.json','project/acceptance-baseline.json'];

function loadConfig(configPath){
 const config=read(configPath);
 assert.ok(typeof config.runId==='string'&&/^\d{8}T\d{6}-[0-9a-f-]{36}$/.test(config.runId),'A2G_E_G3_RUN_ID: runId 必须是 UTC 时间加 UUID。');
 assert.ok(typeof config.runDir==='string'&&config.runDir.startsWith('reports/g3-evaluations/'),'A2G_E_G3_RUN_DIR: runDir 必须位于 reports/g3-evaluations/ 下。');
 assert.ok(typeof config.model==='string'&&config.model.trim()&&config.model.length<=200,'A2G_E_G3_MODEL: 请记录宿主可见的实际模型标识。');
 assert.ok(Number.isInteger(config.maxAttempts)&&config.maxAttempts>=1&&config.maxAttempts<=3,'A2G_E_G3_BUDGET: maxAttempts 必须为 1–3。');
 assert.ok(Number.isInteger(config.maxCalls)&&config.maxCalls>=1&&config.maxCalls<=3,'A2G_E_G3_BUDGET: 本轮 maxCalls 必须为 1–3。');
 assert.ok(Array.isArray(config.selected)&&config.selected.join(',')==='G01','A2G_E_G3_SCOPE: 本轮仅执行 G01。');
 assert.ok(!('sourceCommit'in config)||typeof config.sourceCommit==='string','A2G_E_G3_CONFIG: sourceCommit 需为字符串。');
 return config;
}

/** Public pack only: versioned task text, protocol request, capability ABI and approved generic library. No author level, solution, test or prior trajectory. */
export function buildSubagentPack(gameId,attempt,previous){
 const plan=buildG3Plan(),task=plan.tasks.find(t=>t.id===gameId);
 assert.ok(task,'A2G_E_G3_IDS: 未知任务。');
 assert.ok(attempt>=1&&attempt<=3,'A2G_E_G3_BUDGET: 单次评测单元最多 3 次生成。');
 const request=withCodexHostProfile(buildAgentRequest(task.prompt,attempt,previous));
 return {plan,task,request,
  pack:{format:'a2game-g3-public-task-pack',version:PACK_VERSION,entry:'native-subagent',gameId,attempt,
   taskSha256:task.promptSha256,contextSha256:sha256Canonical(request),capabilityDigest:request.capabilityDigest,
   library:{path:Object.keys(request.hostProfile.publicLibrary).sort(),digests:Object.fromEntries(Object.entries(request.hostProfile.publicLibrary).map(([p,v])=>[p,v.sha256]))},
   exclusions:['authorGameJson','authoredVariant','authorSolution','preplayedTrace','otherModelOutput','testExpectations']}};
}

export function prepareAttempt(configPath,gameId,attempt,previousDiagnostic){
 const config=loadConfig(configPath),runDir=resolve(root,config.runDir);
 mkdirSync(runDir,{recursive:true});
 const {task,request,pack}=buildSubagentPack(gameId,attempt,previousDiagnostic);
 const attemptDir=resolve(runDir,gameId,'attempt-'+attempt);
 assert.ok(!existsSync(resolve(attemptDir,'output.raw.json')),'A2G_E_G3_OUTPUT_EXISTS: 原始输出必须只写一次，修复请使用新的 attempt 目录。');
 mkdirSync(attemptDir,{recursive:true});
 save(resolve(attemptDir,'context.json'),request);
 save(resolve(attemptDir,'pack.json'),{...pack,fingerprints:Object.fromEntries(SOURCE_FILES.map(p=>[p,hash(p)]))});
 writeFileSync(resolve(attemptDir,'prompt.txt'),task.prompt+'\n');
 return {config,gameId,attempt,attemptDir:rel(attemptDir),task,pack,request};
}

/** Validation consumes only the host-recorded reply bytes; the read-output transport never reaches a model. */
export async function validateAttempt(configPath,gameId,attempt){
 const config=loadConfig(configPath),runDir=resolve(root,config.runDir);
 const attemptDir=resolve(runDir,gameId,'attempt-'+attempt),rawPath=resolve(attemptDir,'output.raw.json');
 assert.ok(existsSync(rawPath),'A2G_E_G3_NO_RAW_OUTPUT: 宿主尚未记录子 Agent 原始回复。');
 const rawBytes=readFileSync(rawPath);
 assert.ok(rawBytes.length<=768*1024,'A2G_E_G3_SIZE: 原始输出超出字节预算。');
 const task=buildG3Plan().tasks.find(t=>t.id===gameId);
 assert.ok(task,'A2G_E_G3_IDS: 未知任务。');
 const pack=read(resolve(attemptDir,'pack.json'));
 assert.equal(pack.attempt,attempt,'A2G_E_G3_PACK_ATTEMPT: 任务包记录与 attempt 不一致。');
 assert.equal(sha256Canonical(read(resolve(attemptDir,'context.json'))),pack.contextSha256,'A2G_E_G3_CONTEXT: 任务包与本 attempt 记录的上下文不一致。');
 assert.equal(task.promptSha256,pack.taskSha256,'A2G_E_G3_TASK: 自然语言任务与本 attempt 记录的任务 SHA 不一致。');
 assert.equal(pack.capabilityDigest,buildAgentRequest(task.prompt,attempt).capabilityDigest,'A2G_E_G3_ABI: 能力摘要与当前 Manifest 不一致。');
 assert.ok(existsSync(resolve(attemptDir,'generation.json')),'A2G_E_G3_NO_GENERATION_RECORD: 缺少子 Agent 执行记录，来源不可核验。');
 const generation=read(resolve(attemptDir,'generation.json'));

 const row={gameId,attempt,pack,status:'FAIL',directory:rel(attemptDir),rawOutput:rel(rawPath),rawOutputSha256:hash(rawPath),
  generation:{host:generation.host??null,workerSession:generation.workerSession??null,modelEvidence:generation.modelEvidence??'UNVERIFIED',toolRecord:generation.toolRecord??null,isolation:generation.isolation??'UNVERIFIED'},
  attempts:[],G3:'NOT_RUN'};
 let outcome;
 try{
  const workflow=resolve(attemptDir,'validation');
  assert.ok(!existsSync(workflow),'A2G_E_G3_WORKFLOW_EXISTS: 验证目录必须新建，保留旧回执。');
  const result=await runAgentWorkflow({prompt:task.prompt,command:[process.execPath,'scripts/codex-generator.mjs','--read-output',rawPath],
   maxAttempts:1,timeoutMs:config.timeoutMs??60000,directory:workflow});
  row.validation=rel(resolve(workflow,'summary.json'));
  const validationSummary=read(resolve(workflow,'summary.json'));
  row.attempts.push(...validationSummary.attempts.map(a=>({...a,stage:'validation'})));
  if(!result.success){
   const error=read(resolve(workflow,'attempt-1.json'));
   row.code=error.code??'A2G_E_G3_VALIDATION';row.message=String(error.message).slice(0,600);row.attribution=error.attribution??'AGENT_STRATEGY';
   row.diagnostics=(error.diagnostics??[]).slice(0,20);
   row.repairDiagnostic={code:row.code,message:row.message,diagnostics:row.diagnostics};
   outcome={row,repairNeeded:true};
  }else{
   const output=read(resolve(workflow,`output-${validationSummary.attempts.at(-1).attempt}.json`));
   checkG3SuiteBudget(output.conformance);
   row.definitionSha256=sha256Canonical(output.game);
   row.inspect=inspectGeneratedTask(task,result.success);
   row.provenance=output.provenance;row.conformance=result.success.conformance;row.playability=result.success.playability;
   row.releaseReceipt=result.success.receipt;
   const browserDir=resolve(attemptDir,'browser');
   assert.ok(!existsSync(browserDir),'A2G_E_G3_BROWSER_EXISTS: 双 SDK 报告目录必须新建。');
   const browser=await verifyGeneratedBrowser(workflow,browserDir);
   row.browser={status:browser.status,receipt:rel(resolve(browserDir,'summary.json')),sdk:rel(resolve(browserDir,'sdk-provenance.json')),browser:browser.browser,
    parity:browser.parity,cases:browser.cases.map(c=>({backend:c.backend,status:c.status,receipt:rel(resolve(browserDir,c.backend+'.json')),screenshots:['initial','won','mobile'].map(s=>rel(resolve(browserDir,`${c.backend}-${s}.png`)))}))};
   if(browser.status!=='PASS'){row.code='A2G_E_G3_BROWSER';row.message='双 SDK 回放未通过。';row.attribution='ENGINE_OR_HOST_UNRESOLVED';outcome={row,repairNeeded:false};}
   else{row.status='PASS_REFERENCE';row.engineeringStatus='PASS_REFERENCE';outcome={row,repairNeeded:false};}
  }
 }catch(e){
  row.code=e.code??'A2G_E_G3_SUBAGENT';row.message=String(e.message).slice(0,600);row.attribution=e.attribution??'INFRA';outcome={row,repairNeeded:false};
 }
 return outcome;
}

/** Append-only per-run ledger; keeps failed attempts and never touches shared indexes. */
function checkpoint(config,rows){
 const runDir=resolve(root,config.runDir);
 const generationCalls=rows.length;
 const summary={format:'a2game-g3-subagent-batch',version:1,runId:config.runId,provider:'native-host-subagent',
  model:config.model,modelIdentityStatus:'HOST_RECORD_PENDING_REVIEW',executionMode:'native-subagent',
  selected:config.selected,sourceCommit:config.sourceCommit??null,limits:{maxTasks:1,maxCalls:config.maxCalls,maxAttempts:config.maxAttempts},
  generationCalls,engineeringPassed:rows.filter(r=>r.status==='PASS_REFERENCE').length,independentG3Passed:0,G3:'NOT_RUN',
  independenceReview:'AWAITING_REVIEW',qualityReview:'AWAITING_REVIEW',formalG3Signoff:'NOT_IMPLEMENTED',
  fingerprints:Object.fromEntries(SOURCE_FILES.map(p=>[p,hash(p)])),cases:rows,
  note:'Engineering PASS_REFERENCE and model self-report do not establish formal G3 acceptance.'};
 save(resolve(runDir,'batch-summary.json'),summary);return summary;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [configPath,cmd,...rest]=process.argv.slice(2);
 try{
  if(cmd==='prepare'){
   const gameId=rest[0],attempt=Number(rest[1]);
   const previousDiagnostic=rest[2]?read(resolve(rest[2])):undefined;
   const out=prepareAttempt(configPath,gameId,attempt,previousDiagnostic);
   console.log(JSON.stringify({gameId,attempt,attemptDir:out.attemptDir,taskSha256:out.pack.taskSha256,contextSha256:out.pack.contextSha256,capabilityDigest:out.pack.capabilityDigest},null,2));
  }else if(cmd==='validate'){
   const gameId=rest[0],attempt=Number(rest[1]);
   const config=loadConfig(configPath),runDir=resolve(root,config.runDir);
   const rows=existsSync(resolve(runDir,'batch-summary.json'))?read(resolve(runDir,'batch-summary.json')).cases:[];
   const {row,repairNeeded}=await validateAttempt(configPath,gameId,attempt);
   const index=rows.findIndex(r=>r.gameId===gameId&&r.attempt===attempt);
   if(index>=0)rows[index]=row;else rows.push(row);
   checkpoint(config,rows);
   console.log(JSON.stringify({attempt:row.attempt,status:row.status,code:row.code??null,attribution:row.attribution??null,
    definitionSha256:row.definitionSha256??null,repairNeeded,batchSummary:rel(resolve(runDir,'batch-summary.json'))},null,2));
   if(row.status!=='PASS_REFERENCE')process.exitCode=1;
  }else throw Error('用法：g3-subagent.mjs <config.json> prepare|validate <GAME_ID> <ATTEMPT> [diagnostic.json]');
 }catch(e){console.error((e.code??'A2G_E_G3_SUBAGENT')+'：'+e.message);process.exitCode=1;}
}
