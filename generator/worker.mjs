import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {probeProvider,loadProviderConfig} from './providers.mjs';
import {createFixture} from './fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const save=(directory,name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
let directory;
try{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(Error(),{code:'A2G_GEN_WORKER_REQUEST'});chunks.push(chunk);}
 const {kind,payload}=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 if(!payload||typeof payload.directory!=='string'||!statSync(payload.directory).isDirectory())throw Object.assign(Error(),{code:'A2G_GEN_WORKER_DIRECTORY'});
 directory=resolve(payload.directory);
 if(kind==='generate'){
  const {providerId,configFile,request}=payload,probe=await probeProvider({id:providerId,configFile});if(probe.status!=='READY')throw Object.assign(Error(),{code:probe.code});
  const config=loadProviderConfig(providerId,configFile);let text,telemetry;const started=performance.now();
  if(providerId==='fixture'){
   if(config.fixtureMode==='stall')await new Promise(resolve=>setTimeout(resolve,120000));
   const output=createFixture();if(config.fixtureMode==='invalid-game')output.game.specVersion='0.9.0';text=config.fixtureMode==='invalid-json'?'not JSON':JSON.stringify(output);
   telemetry={providerId,model:'DEMO_FIXTURE',provenance:'fixture',cost:'NOT_APPLICABLE',usage:null};
  }else if(providerId==='codex'){
   const {generateCodex}=await import('../scripts/codex-generator.mjs');telemetry=await generateCodex(config,request,directory);text=readFileSync(resolve(directory,'output.raw.json'),'utf8');
  }else if(providerId==='model-http'){
   const {generateWithModel}=await import('../scripts/model-generator.mjs');const result=await generateWithModel(config,request);text=result.text;telemetry=result.telemetry;
  }else{
   const {requestGeneration}=await import('../scripts/http-generator.mjs');text=await requestGeneration(config,request);telemetry={providerId,requestedModel:null,returnedModel:null,identityStatus:'UNVERIFIED',usage:null,cost:'NOT_REPORTED'};
  }
  save(directory,'provider-call.json',{...telemetry,elapsedMs:performance.now()-started,outputSha256:createHash('sha256').update(text).digest('hex')});process.stdout.write(text);
 }else if(kind==='admission'){
  const {createContentService}=await import('../scripts/content-service.mjs');
  try{process.stdout.write(JSON.stringify({status:'PASS_REFERENCE',receipt:await createContentService().release(payload.text),G3:'NOT_RUN'}));}
  catch(e){process.stdout.write(JSON.stringify({status:'FAIL',code:e.code??'A2G_GEN_ADMISSION',G3:'NOT_RUN'}));}
 }else if(kind==='validate'){
  if(typeof payload.rawFile!=='string')throw Object.assign(Error(),{code:'A2G_GEN_WORKER_REQUEST'});
  const {runAgentWorkflow}=await import('../scripts/agent-workflow.mjs');
  const result=await runAgentWorkflow({prompt:payload.prompt,command:[process.execPath,resolve(root,'scripts/codex-generator.mjs'),'--read-output',resolve(payload.rawFile)],maxAttempts:1,timeoutMs:60000,directory:resolve(directory,'validation')});
  process.stdout.write(JSON.stringify({success:Boolean(result.success),validationDirectory:resolve(directory,'validation')}));
 }else throw Object.assign(Error(),{code:'A2G_GEN_WORKER_KIND'});
}catch(e){
 const code=typeof e.code==='string'&&/^A2G_[A-Z0-9_]+$/.test(e.code)?e.code:'A2G_GEN_WORKER_FAILURE';
 if(directory)try{save(directory,'worker-error.json',{code,classification:'INFRA',message:'生成器工作进程失败；未公开配置或服务正文。'});}catch{}
 process.exitCode=1;
}
