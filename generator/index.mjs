/** Local product entry points. Existing admission and runtime remain authoritative. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,parse,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {probeProvider} from './providers.mjs';
import {runGeneratorWorker} from './process.mjs';
export {probeProvider} from './providers.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const fail=code=>Object.assign(Error('生成器操作未完成；请根据错误码检查输入或本机配置。'),{code});
function safePath(input){
 if(typeof input!=='string'||!input||input.includes('\0')||input.split(/[\\/]/).includes('..'))throw fail('A2G_GEN_PATH');
 const path=resolve(input);if(path===parse(path).root)throw fail('A2G_GEN_PATH');
 for(let at=path;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw fail('A2G_GEN_PATH');if(at===dirname(at))break;}
 return path;
}
function limited(file,max=768*1024){const b=readFileSync(safePath(file));if(b.length>max)throw fail('A2G_GEN_INPUT_SIZE');return new TextDecoder('utf-8',{fatal:true}).decode(b);}
function privateRun(){const id=randomUUID(),directory=join(root,'.a2game/generator',id);mkdirSync(directory,{recursive:true});return {id,directory};}
async function validateRaw(rawFile,prompt,directory,options){
 mkdirSync(directory,{recursive:true});
 const result=await runGeneratorWorker('validate',{rawFile,prompt,directory},options);
 const {validationDirectory}=JSON.parse(result.stdout);
 return {directory:validationDirectory,summary:read(join(validationDirectory,'summary.json')),attempt:read(join(validationDirectory,'attempt-1.json'))};
}
export async function generateGame({prompt,providerId='fixture',configFile,mode='direct-json',outputDirectory,maxAttempts=3,timeoutMs=60000,signal,onProgress=()=>{}}={}){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw fail('A2G_GEN_PROMPT');
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>600000)throw fail('A2G_GEN_BUDGET');
 if(mode!=='direct-json')return {status:'BLOCKED',code:'A2G_GEN_MODE_NOT_IMPLEMENTED',G3:'NOT_RUN'};
 const output=safePath(outputDirectory??join(root,'output/generator',randomUUID()));
 if(existsSync(output))throw fail('A2G_GEN_OUTPUT_EXISTS');
 const probe=await probeProvider({id:providerId,configFile});if(probe.status!=='READY')return {...probe,G3:'NOT_RUN'};
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 const job=privateRun(),deadline=Date.now()+timeoutMs;
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output);
 const report={format:'a2game-generation-report',version:1,status:'FAIL',runId:job.id,mode,provider:probe,provenance:providerId==='fixture'?'DEMO_FIXTURE':'UNVERIFIED_PROVIDER',promptSha256:hash(prompt),G3:'NOT_RUN',attempts:[],calls:[],artifacts:{},generationCalls:0,fixtureCalls:0,usage:null,cost:'NOT_REPORTED'};
 let previous;
 try{
  const {buildAgentRequest}=await import('../scripts/agent-workflow.mjs');
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   const remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw fail('A2G_GEN_TIMEOUT');return ms;};
   const directory=join(job.directory,`attempt-${attempt}`);mkdirSync(directory);
   const request=buildAgentRequest(prompt,attempt,previous);save(join(directory,'request.json'),request);
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
   report.attempts.push({attempt,status:result.summary.status,code:result.attempt.code??null,attribution:result.attempt.attribution??null});
   if(result.summary.status==='PASS_REFERENCE'){
    const source=read(join(result.directory,'output-1.json'));
    const files={'game.json':read(join(result.directory,'game.json')),'conformance.json':source.conformance,'solution.json':read(join(result.directory,'solution.json')),'debug-bundle.json':read(join(result.directory,'debug-bundle.json')),'release-receipt.json':read(join(result.directory,'playability.json'))};
    // Reuse the trusted admission receipt; do not spawn a second unbounded validator.
    files['release-receipt.json']=result.attempt.release;
    mkdirSync(join(output,'tests'));files['tests/conformance.json']=read(join(result.directory,'attempt-1.json'));files['tests/playability.json']=read(join(result.directory,'playability.json'));
    for(const [name,value] of Object.entries(files)){save(join(output,name),value);report.artifacts[name]={path:name,sha256:hash(readFileSync(join(output,name)))};}
    report.solutionSource=result.attempt.solver?'HOST_ASSISTED':'PROVIDER_SUPPLIED';
    report.status='PASS_REFERENCE';break;
   }
   if(result.attempt.attribution==='INFRA'){report.status='BLOCKED';break;}
   previous={code:result.attempt.code,message:result.attempt.message,diagnostics:result.attempt.diagnostics??[],output:response.stdout};
  }
 }catch(e){report.code=e.code??'A2G_GEN_FAILURE';report.status=report.code==='A2G_GEN_CANCELLED'?'CANCELLED':'FAIL';}
 report.oneShot=report.status==='PASS_REFERENCE'&&report.attempts.length===1;
 report.repairCount=Math.max(0,report.generationCalls+report.fixtureCalls-1);
 save(join(output,'generation-report.json'),report);
 return {...report,outputDirectory:output};
}
export async function validateGameFile(file,{signal,timeoutMs=60000}={}){
 const job=privateRun();
 const result=await runGeneratorWorker('admission',{directory:job.directory,text:limited(file,256*1024)},{signal,timeoutMs});
 return JSON.parse(result.stdout);
}
export async function testGeneratedDirectory(input,{signal,timeoutMs=60000}={}){
 const directory=safePath(input),job=privateRun();
 const fields=['game','conformance','solution'].map(name=>`"${name}":${limited(join(directory,name+'.json'))}`);
 const rawFile=join(job.directory,'retest.raw.json');writeFileSync(rawFile,'{"format":"a2game-generation-output","version":1,'+fields.join(',')+',"provenance":{"kind":"fixture","model":"local-retest-only"}}',{flag:'wx'});
 const result=await validateRaw(rawFile,'Validate the supplied game without any generation.',join(job.directory,'check'),{signal,timeoutMs});
 return {status:result.summary.status,code:result.attempt.code??null,G3:'NOT_RUN',runId:job.id};
}
export async function previewGeneratedDirectory(input,{backend='three',signal}={}){
 if(!['air','three'].includes(backend))throw fail('A2G_GEN_BACKEND');
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
 return {status:'READY',url:`http://127.0.0.1:${server.address()?.port}/player/index.html?backend=${backend}&release=${receipt.sha256Jcs}`,server,close:async()=>{signal?.removeEventListener('abort',cancel);await close();}};
}
