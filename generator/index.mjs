import {isPythonRuntimeError,requirePython} from '../scripts/python-runtime.mjs';
/** Local product entry points. Existing admission and runtime remain authoritative. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,parse,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {probeProvider} from './providers.mjs';
import {runGeneratorWorker} from './process.mjs';
import {buildGamePlan,validateGamePlan,scopeRequest,checkPlanGame,checkReferenceInputProfile} from './game-plan.mjs';
import {selectCapabilities,digest} from './catalog.mjs';
import {classifyFailure,repairFeedback,publicDiagnostics} from './diagnostics.mjs';
export {buildGamePlan,validateGamePlan} from './game-plan.mjs';
export {startGeneratorStudio} from './studio.mjs';
export {exportGamePackage,importGamePackage} from './package.mjs';
export {probeProvider} from './providers.mjs';
export {admitNativeGeneration} from './native-host.mjs';
export {buildNativeContext} from './native-context.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const fail=code=>Object.assign(Error('生成器操作未完成；请根据错误码检查输入或本机配置。'),{code});
export function safePath(input){
 if(typeof input!=='string'||!input||input.includes('\0')||input.split(/[\\/]/).includes('..'))throw fail('A2G_GEN_PATH');
 const path=resolve(input);if(path===parse(path).root)throw fail('A2G_GEN_PATH');
 for(let at=path;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw fail('A2G_GEN_PATH');if(at===dirname(at))break;}
 return path;
}
function limited(file,max=768*1024){const b=readFileSync(safePath(file));if(b.length>max)throw fail('A2G_GEN_INPUT_SIZE');return new TextDecoder('utf-8',{fatal:true}).decode(b);}
// Bounded raw-bytes read: evidence must bind the file exactly as it is on disk
// (BOM included, invalid UTF-8 included), so decode happens separately and later.
function boundedBytes(file,max=768*1024){const b=readFileSync(safePath(file));if(b.length>max)throw fail('A2G_GEN_INPUT_SIZE');return b;}
const decodeUtf8=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
function privateRun(){const id=randomUUID(),directory=join(root,'.a2game/generator',id);mkdirSync(directory,{recursive:true});return {id,directory};}
// Opt-in retention of exact input bytes: write-once copies plus a SHA manifest are
// created BEFORE admission runs, so failed attempts keep bindable originals too.
function keepInputs(evidenceDir,files,runId){
 if(evidenceDir===undefined)return null;
 if(typeof evidenceDir!=='string'||!evidenceDir.trim())throw fail('A2G_GEN_EVIDENCE');
 const target=resolve(evidenceDir,`inputs-${Date.now()}-${runId}`),saved={};
 try{
  mkdirSync(target,{recursive:true});
  for(const [name,content] of Object.entries(files)){
   const bytes=Buffer.isBuffer(content)?content:Buffer.from(content,'utf8');
   writeFileSync(resolve(target,name),bytes,{flag:'wx'});
   saved[name]={sha256:hash(bytes),bytes:bytes.length};
  }
  writeFileSync(resolve(target,'evidence-manifest.json'),JSON.stringify({format:'a2game-input-evidence',version:1,runId,files:saved},null,2)+'\n',{flag:'wx'});
 }catch(cause){throw Object.assign(fail('A2G_GEN_EVIDENCE'),{cause});}
 return {directory:target,files:saved};
}
const withEvidence=(result,evidence)=>evidence?{...result,evidence}:result;
// Decode failures must stay locatable: the snapshot already exists, so the thrown
// error carries the evidence descriptor.
const decodeWithEvidence=(bytes,evidence)=>{try{return decodeUtf8(bytes);}catch(cause){throw Object.assign(cause,{evidence});}};
async function validateRaw(rawFile,prompt,directory,options){
 mkdirSync(directory,{recursive:true});
 const result=await runGeneratorWorker('validate',{rawFile,prompt,directory},options);
 const {validationDirectory}=JSON.parse(result.stdout);
 return {directory:validationDirectory,summary:read(join(validationDirectory,'summary.json')),attempt:read(join(validationDirectory,'attempt-1.json'))};
}
export async function generateGame({prompt,providerId='fixture',configFile,mode='direct-json',gamePlan,outputDirectory,maxAttempts=3,attemptOffset=0,maxTotalAttempts=3,initialPrevious,timeoutMs=60000,signal,onProgress=()=>{}}={}){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw fail('A2G_GEN_PROMPT');
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>600000)throw fail('A2G_GEN_BUDGET');
 if(!Number.isInteger(attemptOffset)||attemptOffset<0||!Number.isInteger(maxTotalAttempts)||maxTotalAttempts<1||maxTotalAttempts>30||attemptOffset+maxAttempts>maxTotalAttempts||attemptOffset>0&&!initialPrevious)throw fail('A2G_GEN_BUDGET');
 if(initialPrevious!==undefined){
  if(!initialPrevious||typeof initialPrevious!=='object'||Array.isArray(initialPrevious)||typeof initialPrevious.output!=='string'||Buffer.byteLength(JSON.stringify(initialPrevious))>900*1024||initialPrevious.history!==undefined&&(!Array.isArray(initialPrevious.history)||initialPrevious.history.length>3))throw fail('A2G_GEN_REPAIR_CONTEXT');
 }
 if(!['direct-json','game-plan'].includes(mode))return {status:'BLOCKED',code:'A2G_GEN_MODE',category:'INPUT_SPEC',G3:'NOT_RUN'};
 if(mode==='direct-json'&&gamePlan!==undefined)throw fail('A2G_GEN_PLAN_MODE');
 const output=safePath(outputDirectory??join(root,'output/generator',randomUUID()));
 if(existsSync(output))throw fail('A2G_GEN_OUTPUT_EXISTS');
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 try{requirePython(undefined,{schema:true});}
 catch(e){if(!isPythonRuntimeError(e))throw e;return {status:'BLOCKED',code:e.code,category:classifyFailure(e.code,e.attribution),message:e.message,generationCalls:0,fixtureCalls:0,G3:'NOT_RUN'};}
 const probe=await probeProvider({id:providerId,configFile});if(probe.status!=='READY')return {...probe,G3:'NOT_RUN'};
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 const deadline=Date.now()+timeoutMs;
 const remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw fail('A2G_GEN_TIMEOUT');return ms;};
 let selection,plan;
 try{
  if(mode==='game-plan'){
   onProgress({stage:'plan',attempt:0});
   if(gamePlan!==undefined){plan=await validateGamePlan(gamePlan,{signal,timeoutMs:remaining()});selection={capabilities:plan.capabilities,selectionPolicy:'EXPLICIT_PLAN'};}
   else{const built=await buildGamePlan(providerId==='fixture'?'counter':prompt,{signal,timeoutMs:remaining()});plan=built.plan;selection=built.selection;}
  }else selection=selectCapabilities(providerId==='fixture'?'counter':prompt);
 }catch(e){if(e.code==='A2G_GEN_CANCELLED'||e.code==='A2G_GEN_TIMEOUT')throw e;return {status:'BLOCKED',code:e.code??'A2G_GEN_PLAN',category:classifyFailure(e.code),diagnostics:e.diagnostics??[],generationCalls:0,fixtureCalls:0,G3:'NOT_RUN'};}
 const job=privateRun();
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output);
 const report={format:'a2game-generation-report',version:1,status:'FAIL',runId:job.id,mode,provider:probe,provenance:providerId==='fixture'?'DEMO_FIXTURE':'UNVERIFIED_PROVIDER',promptSha256:hash(prompt),G3:'NOT_RUN',attempts:[],calls:[],artifacts:{},generationCalls:0,fixtureCalls:0,usage:null,cost:'NOT_REPORTED'};
 report.planner=plan?{source:gamePlan!==undefined?'EXPLICIT_PLAN':'HOST_KEYWORD_DRAFT',modelCalls:0,sha256:digest(plan),semanticReview:'NOT_RUN'}:null;
 report.contexts=[];report.hosts='NOT_RUN';report.humanReview='NOT_RUN';
 report.attemptOffset=attemptOffset;report.maxTotalAttempts=maxTotalAttempts;report.priorAttempts=attemptOffset;report.repairContextSha256=initialPrevious?digest(initialPrevious):null;
 if(plan){save(join(output,'game-plan.json'),plan);report.artifacts['game-plan.json']={path:'game-plan.json',sha256:hash(readFileSync(join(output,'game-plan.json')))};}
 let previous=initialPrevious?structuredClone(initialPrevious):undefined;
 try{
  const {buildAgentRequest}=await import('../scripts/agent-workflow.mjs');
  for(let localAttempt=1;localAttempt<=maxAttempts;localAttempt++){
   const attempt=attemptOffset+localAttempt;
   const directory=join(job.directory,`attempt-${attempt}`);mkdirSync(directory);
   const scoped=scopeRequest(buildAgentRequest(prompt,attempt,previous),selection,plan),request=scoped.request;
   request.outputContract.required=['format','version','game','conformance','provenance'];
   request.outputContract.solution='Optional array <=256 {action?,value?,raw?,ticks:integer>=1}, total ticks<=12000; NOT Conformance {seed,steps}. Omission uses a separately reported bounded host solver.';
   save(join(directory,'request.json'),request);report.contexts.push({attempt,...scoped.measurement,requestSha256:digest(request)});
   onProgress({stage:'generate',attempt});
   report[providerId==='fixture'?'fixtureCalls':'generationCalls']++;
   const call={attempt,status:'DISPATCHED',usage:null,cost:'NOT_REPORTED'};report.calls.push(call);
   const response=await runGeneratorWorker('generate',{providerId,configFile:configFile?resolve(configFile):undefined,request,directory},{signal,timeoutMs:remaining()});
   const telemetry=read(join(directory,'provider-call.json'));
   call.status='RETURNED';
   const usage=Object.fromEntries(Object.entries(telemetry.usage??{}).filter(([key,value])=>/^[a-z_]{1,64}$/.test(key)&&typeof value==='number'&&Number.isFinite(value)&&value>=0));
   call.usage=Object.keys(usage).length?usage:null;
   report.usage=report.calls.every(item=>item.usage)?{status:'REPORTED_PER_CALL'}:null;
   const rawFile=join(directory,'response.raw.json');writeFileSync(rawFile,response.stdout,{flag:'wx'});
   onProgress({stage:'validate',attempt});
   const result=await validateRaw(rawFile,prompt,join(directory,'check'),{signal,timeoutMs:remaining()});
   if(result.summary.status==='PASS_REFERENCE')try{
    const source=read(join(result.directory,'output-1.json'));
    // Direct mode also must preserve selected mechanisms instead of silently returning a counter.
    const intentPlan=plan??{mechanisms:selection.mechanisms,capabilities:selection.capabilities,controls:selection.inputSources.map(source=>({source})),stateModel:[],entities:[],concept:{dimension:source.game.world.dimension}};
    report.mechanismCheck=checkPlanGame(intentPlan,source.game);
   }catch(e){result.summary.status='FAIL';Object.assign(result.attempt,{code:e.code,message:e.message,diagnostics:e.diagnostics,attribution:'AGENT_STRATEGY'});}
   report.attempts.push({attempt,status:result.summary.status,code:result.attempt.code??null,category:result.summary.status==='PASS_REFERENCE'?null:classifyFailure(result.attempt.code,result.attempt.attribution,result.attempt.message),diagnostics:(result.attempt.diagnostics??[]).slice(0,20),attribution:result.attempt.attribution??null});
   if(result.summary.status==='PASS_REFERENCE'){
    const source=read(join(result.directory,'output-1.json'));
    const files={'game.json':read(join(result.directory,'game.json')),'conformance.json':source.conformance,'solution.json':read(join(result.directory,'solution.json')),'debug-bundle.json':read(join(result.directory,'debug-bundle.json')),'release-receipt.json':read(join(result.directory,'playability.json'))};
    // Reuse the trusted admission receipt; do not spawn a second unbounded validator.
    files['release-receipt.json']=result.attempt.release;
    mkdirSync(join(output,'tests'));files['tests/conformance.json']=read(join(result.directory,'attempt-1.json'));files['tests/playability.json']=read(join(result.directory,'playability.json'));files['tests/lifecycle.json']=read(join(result.directory,'lifecycle.json'));
    for(const [name,value] of Object.entries(files)){save(join(output,name),value);report.artifacts[name]={path:name,sha256:hash(readFileSync(join(output,name)))};}
    report.solutionSource=result.attempt.solver?'HOST_ASSISTED':'PROVIDER_SUPPLIED';
    report.status='PASS_REFERENCE';break;
   }
   if(result.attempt.attribution==='INFRA'){report.status='BLOCKED';break;}
   if(classifyFailure(result.attempt.code,result.attempt.attribution)==='SECURITY_POLICY')break;
   previous={...repairFeedback(result.attempt,response.stdout),history:[...(initialPrevious?.history??[]),...report.attempts].slice(-3).map(a=>({attempt:a.attempt,code:a.code,category:a.category,diagnostics:a.diagnostics??[]}))};
  }
 }catch(e){report.code=e.code??'A2G_GEN_FAILURE';report.category=classifyFailure(report.code);report.status=report.code==='A2G_GEN_CANCELLED'?'CANCELLED':report.category==='PROVIDER_INFRA'?'BLOCKED':'FAIL';}
 if(['FAIL','BLOCKED'].includes(report.status)&&!report.code){const last=report.attempts.at(-1);report.code=last?.code;report.category=last?.category;}
 report.oneShot=attemptOffset===0&&!initialPrevious&&report.status==='PASS_REFERENCE'&&report.attempts.length===1;
 report.totalAttemptsObserved=attemptOffset+report.generationCalls+report.fixtureCalls;
 report.repairCount=Math.max(0,report.totalAttemptsObserved-1);
 save(join(output,'generation-report.json'),report);
 return {...report,outputDirectory:output};
}
export async function validateGameFile(file,{signal,timeoutMs=60000,evidenceDir}={}){
 const job=privateRun();
 const raw=boundedBytes(file,256*1024);
 const evidence=keepInputs(evidenceDir,{'game.json':raw},job.id);
 try{
  const result=await runGeneratorWorker('admission',{directory:job.directory,text:decodeWithEvidence(raw,evidence)},{signal,timeoutMs});
  return withEvidence(JSON.parse(result.stdout),evidence);
 }catch(cause){throw Object.assign(cause,{evidence});}
}
export async function testGeneratedDirectory(input,{signal,timeoutMs=60000,evidenceDir}={}){
 const directory=safePath(input),job=privateRun(),deadline=Date.now()+timeoutMs;
 const sources={};for(const name of ['game','conformance','solution'])sources[name+'.json']=boundedBytes(join(directory,name+'.json'));
 if(existsSync(join(directory,'game-plan.json')))sources['game-plan.json']=boundedBytes(join(directory,'game-plan.json'),64*1024);
 const evidence=keepInputs(evidenceDir,sources,job.id);
 try{
  let texts;try{texts=Object.fromEntries(Object.entries(sources).map(([name,bytes])=>[name,decodeUtf8(bytes)]));}catch(cause){throw Object.assign(cause,{evidence});}
  const fields=Object.entries(texts).filter(([name])=>name!=='game-plan.json').map(([name,content])=>`"${name.slice(0,-5)}":${content}`);
  const rawFile=join(job.directory,'retest.raw.json');writeFileSync(rawFile,'{"format":"a2game-generation-output","version":1,'+fields.join(',')+',"provenance":{"kind":"fixture","model":"local-retest-only"}}',{flag:'wx'});
  const result=await validateRaw(rawFile,'Validate the supplied game without any generation.',join(job.directory,'check'),{signal,timeoutMs});
  if(result.summary.status==='PASS_REFERENCE')try{
   const game=read(join(result.directory,'game.json'));checkReferenceInputProfile(game);
   if(texts['game-plan.json']!==undefined){const remaining=deadline-Date.now();if(remaining<=0)throw fail('A2G_GEN_TIMEOUT');
    const plan=await validateGamePlan(texts['game-plan.json'],{signal,timeoutMs:remaining});checkPlanGame(plan,game);}
  }catch(e){if(e.code==='A2G_GEN_CANCELLED')throw Object.assign(e,{evidence});return withEvidence({status:'FAIL',code:e.code??'A2G_GEN_PLAN_GAME',category:classifyFailure(e.code),diagnostics:publicDiagnostics(e),G3:'NOT_RUN',runId:job.id},evidence);}
  return withEvidence({status:result.summary.status,code:result.attempt.code??null,diagnostics:result.summary.status==='PASS_REFERENCE'?[]:publicDiagnostics(result.attempt),G3:'NOT_RUN',runId:job.id},evidence);
 }catch(cause){throw Object.assign(cause,{evidence});}
}
export async function previewGeneratedDirectory(input,{backend='three',ready=false,signal}={}){
 if(!['air','three'].includes(backend))throw fail('A2G_GEN_BACKEND');
 if(typeof ready!=='boolean')throw fail('A2G_GEN_ARGUMENT');
 const directory=safePath(input),game=limited(join(directory,'game.json'),256*1024);
 try{
  const provenance=read(join(root,'player/vendor/sdk-provenance.json'));
  for(const f of provenance.files){if(!/^player\/vendor\/[\w.-]+\.js$/.test(f.path)||hash(readFileSync(join(root,f.path)))!==f.sha256)throw Error();}
 }catch{return {status:'BLOCKED',code:'A2G_GEN_SDK_REQUIRED',nextStep:'运行 npm run sdk:prepare 后重试；不会回退为 Canvas2D。'};}
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 const {createContentService}=await import('../scripts/content-service.mjs');
 const {createPlayerServer}=await import('../scripts/serve.mjs');
 const contentService=createContentService(),receipt=await contentService.release(game);
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 const server=createPlayerServer({contentService});
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 let closing;
 const close=()=>closing??=new Promise((ok,no)=>{server.close(e=>e?no(e):ok());server.closeAllConnections();});
 const cancel=()=>{void close();};signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted){await close();throw fail('A2G_GEN_CANCELLED');}
 return {status:'READY',url:`http://127.0.0.1:${server.address()?.port}/player/index.html?backend=${backend}&release=${receipt.sha256Jcs}${ready?'&ready=1':''}`,server,close:async()=>{signal?.removeEventListener('abort',cancel);await close();}};
}
