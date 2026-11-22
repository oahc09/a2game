/** Host-side first-variant benchmark. Neither model identity nor gameplay quality is self-certified. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
import {runAgentWorkflow} from './agent-workflow.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const rel=p=>relative(root,p).replaceAll('\\','/');
export function buildG3Plan(){
 const tasks=read('project/g3-tasks.json'),contract=read('project/gameplay-acceptance.json'),baseline=read('project/acceptance-baseline.json'),registry=read('specs/v0.1/coverage/games.json');
 assert.equal(tasks.format,'a2game-g3-tasks');assert.equal(tasks.version,1);assert.deepEqual(tasks.tasks.map(t=>t.id).sort(),baseline.ids);assert.equal(new Set(tasks.tasks.map(t=>t.id)).size,37);
 return {format:'a2game-g3-plan',version:1,plannedGames:32,plannedHybrids:5,variantRound:1,G3:'NOT_RUN',tasks:tasks.tasks.map(t=>{
  const entry=contract.cases.find(c=>c.id===t.id),game=read(entry.game),requirements=registry.games.find(c=>c.id===t.id)?.requiredCapabilities??game.requires;
  assert.ok(t.variation.length>15&&entry);
  const prompt=`独立设计 ${t.id}「${entry.title}」的新规则/关卡变体。\n必需玩法：${entry.completion}。\n本次变化：${t.variation}\n只用随请求提供的已实现 Capability，不能按游戏名实现脚本，不能用一次任意按钮直接判胜代替玩法。初始状态必须 playing，目标需通过真实机制达成；保留失败或未达成路径。\n必需能力（精确版本，all 全部满足、anyOf 每组至少一个）：${JSON.stringify(requirements)}\n输出完整 GameSpec、至少两例 Conformance（成功、不同输入的未完成或失败；都以 start 开始，包含交互和 step）、一条规范输入获胜 solution。每例最多 12000 Tick、2048 项；最多 16 例。solution 最多 256 项、12000 Tick，可用 action/value/raw/ticks。不得提供脚本、命令或外部资源。需有可读操作说明、场景和进度/结果反馈。provenance 如实说明来源，不得自报 G3 PASS。`;
  return {id:t.id,title:entry.title,prompt,promptSha256:sha256Canonical(prompt),requirements,physical:entry.physical,reference:{baseSha256:sha256Canonical(game),authoredVariantSha256:sha256Canonical(read(entry.variant))},status:'NOT_RUN',independenceReview:'NOT_RUN',qualityReview:'NOT_RUN',G3:'NOT_RUN'};
 })};
}
export function validateG3Config(config,selected){
 assert.ok(config&&typeof config.provider?.id==='string'&&config.provider.id.trim()&&config.provider.id.length<=200,'A2G_E_G3_CONFIG: 请提供供应者名称。');
 assert.ok(typeof config.provider.model==='string'&&config.provider.model.trim()&&config.provider.model.length<=200,'A2G_E_G3_CONFIG: 请提供模型名称。');
 assert.ok(Array.isArray(config.command)&&config.command.length>0&&config.command.every(a=>typeof a==='string'&&!a.includes('\0')),'A2G_E_G3_CONFIG: 需使用宿主指定 argv。');
 assert.ok(Number.isInteger(config.maxAttempts)&&config.maxAttempts>=1&&config.maxAttempts<=3,'A2G_E_G3_CONFIG: maxAttempts 必须为 1–3。');
 assert.ok(Number.isInteger(config.maxTasks)&&config.maxTasks>=selected&&config.maxTasks<=37,'A2G_E_G3_CONFIG: 超出本轮任务预算。');
 assert.ok(Number.isInteger(config.maxCalls)&&config.maxCalls>=selected&&config.maxCalls<=111,'A2G_E_G3_CONFIG: 需明确 maxCalls，范围为任务数至 111。');
 assert.ok(Number.isInteger(config.timeoutMs)&&config.timeoutMs>=100&&config.timeoutMs<=60000,'A2G_E_G3_CONFIG: timeoutMs 范围 100–60000。');
}
export function inspectGeneratedTask(task,success){
 assert.equal(success.provenance.kind,'independent-model','A2G_E_G3_FIXTURE: 夹具不得进入独立候选。');
 const digest=sha256Canonical(success.game);assert.ok(!Object.values(task.reference).includes(digest),'A2G_E_G3_AUTHORED: 不能复用作者定义。');
 assert.ok(success.solution.some(s=>s.action||s.raw?.length),'A2G_E_G3_INTERACTION: 解法必须含交互。');
 const runtime=new HeadlessRuntime(success.game,makeRegistry());
 try{runtime.start();assert.equal(runtime.status,'playing','A2G_E_G3_INITIAL: 初态不得已经获胜。');const supports=c=>runtime.effectiveCapabilities.capabilities.some(e=>e.id===c.id&&e.version===c.version);assert.ok(task.requirements.all.every(supports)&&(task.requirements.anyOf??[]).every(g=>g.some(supports)),'A2G_E_G3_CAPABILITIES: 未满足该款必需能力。');}finally{runtime.dispose();}
 // This verifies declared prerequisites, not that a mechanism is used meaningfully. Human semantic review remains required.
 return {status:'PASS_REFERENCE',definitionSha256:digest,semanticReview:'NOT_RUN',independenceReview:'NOT_RUN',G3:'NOT_RUN'};
}
export async function runG3Batch(config,ids){
 const plan=buildG3Plan(),wanted=ids??plan.tasks.map(t=>t.id);assert.equal(new Set(wanted).size,wanted.length);assert.ok(wanted.length>0&&wanted.every(id=>plan.tasks.some(t=>t.id===id)),'A2G_E_G3_IDS: 未知或空任务。');validateG3Config(config,wanted.length);
 const directory=resolve(root,'reports','g3-batch-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);mkdirSync(directory);save(resolve(directory,'plan.json'),plan);
 const sourcePaths=['scripts/g3-batch.mjs','scripts/g3-browser.mjs','scripts/g3-playthrough.mjs','scripts/model-generator.mjs','generator/adapters/model-generator.mjs','scripts/http-generator.mjs','generator/adapters/http-generator.mjs','scripts/agent-workflow.mjs','scripts/agent-solver.mjs','scripts/parse-agent-output.py','scripts/validate-agent-suite.py','project/g3-tasks.json','project/gameplay-acceptance.json','project/acceptance-baseline.json'];
 const fingerprints=Object.fromEntries(sourcePaths.map(p=>[p,hash(p)]));save(resolve(directory,'fingerprints.json'),fingerprints);
 const rows=plan.tasks.map(t=>({id:t.id,status:'NOT_RUN',G3:'NOT_RUN',reason:wanted.includes(t.id)?'Awaiting scheduled provider call':'Not selected in this batch'}));let calls=0,stop=false;
 const checkpoint=()=>{const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h),result={format:'a2game-g3-batch',version:1,status:!unchanged||rows.some(r=>r.status==='FAIL')?'FAIL':rows.filter(r=>r.status==='PASS_REFERENCE').length===37?'PASS_REFERENCE':'PARTIAL',provider:{id:config.provider.id,model:config.provider.model,identityStatus:'HOST_CONFIGURED_UNVERIFIED',commandDigest:sha256Canonical(config.command)},plannedGames:32,plannedHybrids:5,variantRound:1,selected:wanted,limits:{maxTasks:config.maxTasks,maxCalls:config.maxCalls,maxAttempts:config.maxAttempts,timeoutMs:config.timeoutMs},calls,engineeringPassed:rows.filter(r=>r.status==='PASS_REFERENCE').length,independentG3Passed:0,independenceReview:'NOT_RUN',qualityReview:'NOT_RUN',G3:'NOT_RUN',unchanged,fingerprints:rel(resolve(directory,'fingerprints.json')),cases:rows};save(resolve(directory,'summary.json'),result);return result;};checkpoint();
 for(const id of wanted){const row=rows.find(r=>r.id===id),task=plan.tasks.find(t=>t.id===id);if(stop||calls>=config.maxCalls){row.reason='Call budget exhausted or infrastructure unavailable';continue;}
  delete row.reason;const workflowDir=resolve(directory,id);mkdirSync(workflowDir);const previousDir=process.env.A2GAME_G3_CALL_DIR;process.env.A2GAME_G3_CALL_DIR=workflowDir;
  try{
   const result=await runAgentWorkflow({prompt:task.prompt,command:config.command,maxAttempts:Math.min(config.maxAttempts,config.maxCalls-calls),timeoutMs:config.timeoutMs,solverBudget:config.solverBudget,directory:resolve(workflowDir,'generation')});calls+=result.summary.attempts.length;row.workflow=rel(resolve(workflowDir,'generation/summary.json'));row.oneShot=result.summary.oneShot;row.repairs=result.summary.repairCount;row.elapsedMs=result.summary.attempts.reduce((n,a)=>n+a.elapsedMs,0);
   row.modelCalls=readdirSync(workflowDir).filter(p=>/^model-call-[1-3]\.json$/.test(p)).map(p=>rel(resolve(workflowDir,p)));row.cost=row.modelCalls.length?'TOKEN_USAGE_WHEN_REPORTED_NO_PRICE_ESTIMATE':'NOT_REPORTED';
   if(!result.success){row.status='FAIL';row.attribution=result.summary.attempts.at(-1)?.attribution;row.code=result.summary.attempts.at(-1)?.code;stop=row.attribution==='INFRA';continue;}
   const output=read(rel(resolve(workflowDir,`generation/output-${result.summary.attempts.at(-1).attempt}.json`)));checkG3SuiteBudget(output.conformance);row.content=inspectGeneratedTask(task,result.success);
   const browser=await verifyGeneratedBrowser(resolve(workflowDir,'generation'),resolve(workflowDir,'browser'));row.browser=rel(resolve(workflowDir,'browser/summary.json'));assert.equal(browser.status,'PASS','A2G_E_G3_BROWSER: 双 SDK 验证未通过。');row.status='PASS_REFERENCE';delete row.reason;
  }catch(e){row.status='FAIL';row.code=String(e.message).match(/A2G_E_[A-Z0-9_]+/)?.[0]??'A2G_E_G3_RUN';row.message=String(e.message).slice(0,500);row.attribution=row.code==='A2G_E_G3_BROWSER'?'ENGINE_OR_HOST_UNRESOLVED':'AGENT_STRATEGY';}
  finally{if(previousDir===undefined)delete process.env.A2GAME_G3_CALL_DIR;else process.env.A2GAME_G3_CALL_DIR=previousDir;checkpoint();}console.log(id,row.status,row.code??'');
 }
 return {directory:rel(directory),summary:checkpoint()};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const command=process.argv[2]??'plan';assert.ok(['plan','run'].includes(command),'用法：g3-batch.mjs plan | run <本机配置> [--ids=G01,H03]');
 if(command==='plan'){const plan=buildG3Plan(),directory=resolve(root,'reports','g3-plan-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);assert.ok(!existsSync(directory));mkdirSync(directory);save(resolve(directory,'plan.json'),plan);console.log(JSON.stringify({status:'PREPARED',tasks:plan.tasks.length,G3:'NOT_RUN',plan:rel(resolve(directory,'plan.json'))},null,2));}
 else{assert.ok(process.argv[3],'请提供本机生成器配置。');const ids=process.argv.find(v=>v.startsWith('--ids='))?.slice(6).split(',');const result=await runG3Batch(read(process.argv[3]),ids);console.log(JSON.stringify({directory:result.directory,status:result.summary.status,engineeringPassed:result.summary.engineeringPassed,independentG3Passed:0,calls:result.summary.calls},null,2));if(result.summary.status==='FAIL')process.exitCode=1;}
}catch(e){console.error('A2G_E_G3：'+e.message);process.exitCode=1;}
