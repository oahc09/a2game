/** GEN-7 preparation and explicit-budget execution. Default plan never calls a model. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {generateGame,buildGamePlan,probeProvider,testGeneratedDirectory,safePath} from '../generator/index.mjs';
import {selectCapabilities,digest} from '../generator/catalog.mjs';
import {scopeRequest} from '../generator/game-plan.mjs';
import {runGeneratorWorker} from '../generator/process.mjs';
import {buildAgentRequest} from './agent-workflow.mjs';
import {root} from './registry.mjs';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/');
const save=(p,value)=>writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const fail=code=>Object.assign(Error('Benchmark 尚未完成，请检查预算、Provider 或运行回执。'),{code});
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
function fingerprints(){return Object.fromEntries(['project/generator-benchmark-tasks.json','scripts/generator-benchmark.mjs','scripts/agent-workflow.mjs','scripts/registry.mjs',...files('generator'),...files('src'),...files('specs/v0.1/schemas'),...files('specs/v0.1/capabilities')].map(path=>[path,hash(resolve(root,path))]));}
export async function prepareGeneratorBenchmark({outputDirectory}={}){
 const tasks=JSON.parse(readFileSync(resolve(root,'project/generator-benchmark-tasks.json'),'utf8'));
 if(tasks.format!=='a2game-generator-benchmark-tasks'||tasks.version!==1||JSON.stringify(tasks.tasks.map(t=>t.id))!==JSON.stringify(['G01','G03','G17','G21','H01'])||JSON.stringify(tasks.modes)!==JSON.stringify(['direct-json','game-plan']))throw fail('A2G_GEN_BENCH_TASKS');
 const {safePath}=await import('../generator/index.mjs');
 const directory=safePath(outputDirectory??resolve(root,'reports/generator-benchmark-'+randomUUID()));if(existsSync(directory))throw fail('A2G_GEN_OUTPUT_EXISTS');mkdirSync(directory,{recursive:true});
 const cells=[];
 for(const task of tasks.tasks){
  const prompt=`独立设计「${task.title}」小游戏。必需行为：${task.mechanics}\n固定 world.clock.seed=${tasks.seed}。使用已注册可信机制，不能以任意按钮计数替代真实玩法。提供新布局与规则参数，不读取作者关卡或旧模型结果。提供可读目标、操作说明、进度及胜负反馈；桌面和390px窄屏可操作。输出完整GameSpec、至少一项成功和不同输入的未完成/失败Conformance、一条实际获胜solution；不得自报验收通过。`;
  const selection=selectCapabilities(prompt),{plan}=await buildGamePlan(prompt);
  for(const mode of tasks.modes){
   const id=task.id+'-'+mode,context=scopeRequest(buildAgentRequest(prompt,1),selection,mode==='game-plan'?plan:undefined).request;
   context.outputContract.required=['format','version','game','conformance','provenance'];context.outputContract.solution='Optional array <=256 {action?,value?,raw?,ticks:integer>=1}, total ticks<=12000; NOT Conformance {seed,steps}. Omission uses a separately reported bounded host solver.';
   const file=id+'.context.json';save(join(directory,file),context);cells.push({id,taskId:task.id,title:task.title,mode,prompt,promptSha256:digest(prompt),context:file,contextSha256:hash(join(directory,file)),contextDigest:digest(context),status:'NOT_RUN',realModel:'NOT_RUN',browser:'NOT_RUN',visual:'NOT_RUN',humanReview:'NOT_RUN',G3:'NOT_RUN'});
  }
 }
 const source=fingerprints();save(join(directory,'fingerprints.json'),source);
 const plan={format:'a2game-generator-benchmark-plan',version:1,runId:randomUUID(),status:'PREPARED_NOT_RUN',profile:tasks.profile,seed:tasks.seed,plannedCells:10,taskIds:tasks.tasks.map(t=>t.id),modes:tasks.modes,authorizedCalls:0,generationCalls:0,maxAttemptsPerCell:3,sourceSha256:digest(source),G3:'NOT_RUN',contextScope:'Pre-provider request only. Existing adapters may add their public HostProfile; actual request/CLI telemetry stays in each private generation run. Same provider/config is required for comparisons.',cells};save(join(directory,'plan.json'),plan);return {directory,plan,source};
}
export async function runGeneratorBenchmark({providerId,configFile,maxCalls=0,maxAttempts=3,timeoutMs=180000,outputDirectory,resumeFile,signal}={}){
 if(!providerId||providerId==='fixture'||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>30||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw fail('A2G_GEN_BENCH_BUDGET');
 const provider=await probeProvider({id:providerId,configFile});if(provider.status!=='READY')return {status:'BLOCKED',code:provider.code,provider,generationCalls:0,G3:'NOT_RUN'};
 const {directory,plan,source}=await prepareGeneratorBenchmark({outputDirectory});
 const report={format:'a2game-generator-benchmark',version:1,status:'PARTIAL',plannedCells:10,executedCells:0,generationCalls:0,knownGenerationCalls:0,unknownCallCounts:0,budgetConsumed:0,maxCalls,provider,configurationSha256:configFile?hash(configFile):null,cells:[],humanReview:'NOT_RUN',visualReview:'NOT_RUN',G3:'NOT_RUN',identityReview:'NOT_RUN',usage:null,cost:'UNKNOWN'};
 let prior=new Map();
 if(resumeFile){
  const bytes=readFileSync(safePath(resumeFile));if(bytes.length>128*1024)throw fail('A2G_GEN_BENCH_RESUME');const resume=JSON.parse(bytes);
  if(resume.format!=='a2game-benchmark-resume'||resume.version!==1||!Array.isArray(resume.cells)||resume.cells.length>10||new Set(resume.cells.map(c=>c.id)).size!==resume.cells.length||resume.cells.some(c=>!plan.cells.some(p=>p.id===c.id)||!Number.isInteger(c.generationCalls)||c.generationCalls<1||c.generationCalls>3))throw fail('A2G_GEN_BENCH_RESUME');
  prior=new Map(resume.cells.map(c=>[c.id,c]));const consumed=resume.cells.reduce((sum,c)=>sum+c.generationCalls,0);if(consumed>maxCalls)throw fail('A2G_GEN_BENCH_BUDGET');
  report.knownGenerationCalls=consumed;report.budgetConsumed=consumed;report.executedCells=prior.size;
  report.resume={path:rel(resolve(resumeFile)),sha256:hash(resumeFile),priorGenerationCalls:consumed,comparisonStatus:'MIXED_HOST_REPAIR_PROFILES; no homogeneous one-shot rate',reason:resume.reason??'Explicit host-ledger resume'};
 }
 for(const cell of plan.cells){
  const previous=prior.get(cell.id);
  if(previous?.generationCalls===3){
   const row={...cell,status:'BLOCKED',code:previous.code??'A2G_GEN_BENCH_PRIOR_LIMIT',generationCalls:3,oneShot:false,repairCount:2,browser:'NOT_RUN',priorEvidence:previous.evidence??null};
   if(previous.resultFile&&hash(safePath(previous.resultFile))===previous.resultSha256){
    const reused=JSON.parse(readFileSync(previous.resultFile,'utf8'));
    if(reused.status==='PASS_REFERENCE'&&previous.contextDigest===cell.contextDigest&&reused.generationCalls===3){
     const tested=await testGeneratedDirectory(safePath(reused.output),{signal,timeoutMs:60000});
     if(tested.status==='PASS_REFERENCE'){
      Object.assign(row,{status:'PASS_REFERENCE',code:null,output:reused.output,revalidated:true,solutionSource:reused.solutionSource??'PROVIDER_SUPPLIED'});
      try{const target=join(directory,cell.id+'-browser'),proof=JSON.parse((await runGeneratorWorker('browser',{directory,workflow:safePath(previous.validationWorkflow),browserDirectory:target},{signal,timeoutMs:600000,maxBytes:2*1024*1024})).stdout);row.browser=proof.status;row.browserEvidence=rel(join(target,'summary.json'));if(proof.status!=='PASS'){row.status='FAIL';row.code='A2G_GEN_BENCH_HOST';}}
      catch(e){row.status='BLOCKED';row.code=e.code??'A2G_GEN_BENCH_HOST';}
     }
    }
   }
   report.cells.push(row);save(join(directory,cell.id+'.result.json'),row);continue;
  }
  if(signal?.aborted||report.budgetConsumed>=maxCalls){report.cells.push({...cell,status:'NOT_RUN',reason:signal?.aborted?'CANCELLED':'BUDGET_EXHAUSTED'});continue;}
  const output=resolve(root,'output/generator-benchmark',plan.runId,cell.id);
  const oldCalls=previous?.generationCalls??0,limit=Math.min(maxAttempts,3-oldCalls,maxCalls-report.budgetConsumed);let result;
  if(!previous)report.executedCells++;report.budgetConsumed+=limit;
  try{result=await generateGame({prompt:cell.prompt,providerId,configFile,mode:cell.mode,outputDirectory:output,maxAttempts:limit,timeoutMs,signal});report.knownGenerationCalls+=result.generationCalls??0;report.budgetConsumed-=limit-(result.generationCalls??0);}
  catch(e){report.unknownCallCounts++;report.cells.push({...cell,status:'BLOCKED',code:e.code??'A2G_GEN_BENCH_INFRA',generationCalls:null,reservedUpperBound:limit});continue;}
  const row={...cell,status:result.status,realModel:result.generationCalls>0?'PROVIDER_DISPATCH_IDENTITY_REVIEW_PENDING':'NOT_RUN',code:result.code??null,output:rel(output),generationReportSha256:existsSync(join(output,'generation-report.json'))?hash(join(output,'generation-report.json')):null,generationCalls:oldCalls+(result.generationCalls??0),repairCount:Math.max(0,oldCalls+(result.generationCalls??0)-1),oneShot:oldCalls===0&&(result.oneShot??false),solutionSource:result.solutionSource??null,calls:result.calls??[],browser:'NOT_RUN'};
  if(result.status==='PASS_REFERENCE'){
   const game=JSON.parse(readFileSync(join(output,'game.json'),'utf8'));
   if(result.contexts?.[0]?.requestSha256!==cell.contextDigest){row.status='FAIL';row.code='A2G_GEN_BENCH_CONTEXT';}
   else if(game.world.clock.seed!==plan.seed){row.status='FAIL';row.code='A2G_GEN_BENCH_SEED';}
   else try{
    const attempt=result.attempts.at(-1).attempt,validation=resolve(root,'.a2game/generator',result.runId,`attempt-${attempt}/check/validation`);
    const browserDirectory=join(directory,cell.id+'-browser');
    const proof=JSON.parse((await runGeneratorWorker('browser',{directory,workflow:validation,browserDirectory},{signal,timeoutMs:600000,maxBytes:2*1024*1024})).stdout);row.browser=proof.status;row.browserEvidence=rel(join(browserDirectory,'summary.json'));
    if(proof.status!=='PASS'){row.status='FAIL';row.code='A2G_GEN_BENCH_HOST';}
   }catch(e){row.status='BLOCKED';row.code=e.code??'A2G_GEN_BENCH_HOST';}
  }
  report.cells.push(row);save(join(directory,cell.id+'.result.json'),row);
 }
 report.sourcesUnchanged=Object.entries(source).every(([path,sha])=>hash(resolve(root,path))===sha);
 report.generationCalls=report.unknownCallCounts?null:report.knownGenerationCalls;
 report.generatedCellsKnown=report.cells.filter(c=>c.generationCalls>0).length;
 report.engineeringPassed=report.cells.filter(c=>c.status==='PASS_REFERENCE'&&c.browser==='PASS').length;
 report.oneShotPassed=report.cells.filter(c=>c.oneShot&&c.status==='PASS_REFERENCE'&&c.browser==='PASS').length;
 report.independentSolutionPassed=report.cells.filter(c=>c.status==='PASS_REFERENCE'&&c.solutionSource==='PROVIDER_SUPPLIED').length;
 report.hostAssistedPassed=report.cells.filter(c=>c.status==='PASS_REFERENCE'&&c.solutionSource==='HOST_ASSISTED').length;
 report.status=!report.sourcesUnchanged?'FAIL':report.engineeringPassed===10?'PASS_REFERENCE':'PARTIAL';save(join(directory,'summary.json'),report);return {...report,directory:rel(directory)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
 try{const {positionals,values}=parseArgs({allowPositionals:true,options:{provider:{type:'string'},config:{type:'string'},output:{type:'string'},resume:{type:'string'},'max-calls':{type:'string'},'max-attempts':{type:'string'},'timeout-ms':{type:'string'}}});
  if((positionals[0]??'plan')==='plan'){const result=await prepareGeneratorBenchmark({outputDirectory:values.output});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',directory:rel(result.directory),plannedCells:10,generationCalls:0}));}
  else if(positionals[0]==='run'){const result=await runGeneratorBenchmark({providerId:values.provider,configFile:values.config,outputDirectory:values.output,resumeFile:values.resume,maxCalls:Number(values['max-calls']??0),maxAttempts:Number(values['max-attempts']??3),timeoutMs:Number(values['timeout-ms']??180000),signal:controller.signal});console.log(JSON.stringify(result));if(result.status!=='PASS_REFERENCE')process.exitCode=3;}
  else throw fail('A2G_GEN_BENCH_ARGUMENT');
 }catch(e){console.log(JSON.stringify({status:'BLOCKED',code:e.code??'A2G_GEN_BENCH_FAILURE',message:'Benchmark 未执行完成；请检查参数、本机配置和显式调用预算后重试。',generationCalls:e.code==='A2G_GEN_BENCH_BUDGET'?0:null}));process.exitCode=3;}
}
