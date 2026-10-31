/** Loopback workspace. Browser selects only host-configured providers; no paths/commands/configs from JSON. */
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createPlayerServer} from '../scripts/serve.mjs';
import {createContentService} from '../scripts/content-service.mjs';
import {generateGame,probeProvider} from './index.mjs';
import {exportGamePackage,importGamePackage} from './package.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const allowedFiles=new Set(['game.json','game-plan.json','conformance.json','solution.json','debug-bundle.json','generation-report.json','release-receipt.json']);
const error=(code,statusCode=400)=>Object.assign(Error('请求未完成，请检查输入、预算或本机配置后重试。'),{code,statusCode});
async function body(req,max=32*1024){
 if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw error('A2G_GEN_STUDIO_TYPE',415);
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw error('A2G_GEN_STUDIO_SIZE',413);chunks.push(chunk);}return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
}
export async function startGeneratorStudio({providerId='fixture',configFile,maxCalls=0,port=0,signal}={}){
 if(!Number.isInteger(maxCalls)||maxCalls<0||maxCalls>30||!Number.isInteger(port)||port<0||port>65535)throw error('A2G_GEN_STUDIO_CONFIG');
 const provider=await probeProvider({id:providerId,configFile});
 const contentService=createContentService(),server=createPlayerServer({contentService}),player=server.listeners('request')[0];server.removeAllListeners('request');
 const controller=new AbortController(),jobs=new Map(),tasks=new Set();let active=null,remainingCalls=maxCalls,closing=false;
 const publicJob=job=>({id:job.id,status:job.status,progress:job.progress,result:job.result,release:job.release??null,error:job.error??null});
 function launch(run){const task=Promise.resolve().then(run).catch(()=>{}).finally(()=>tasks.delete(task));tasks.add(task);return task;}
 const reserve=(id,attempts)=>{if(active||jobs.size>=16)throw error('A2G_GEN_STUDIO_BUSY',409);if(id!=='fixture'&&(provider.status!=='READY'||id!==providerId||remainingCalls<attempts))throw error('A2G_GEN_STUDIO_BUDGET',409);if(id!=='fixture')remainingCalls-=attempts;};
 const createJob=()=>{const job={id:randomUUID(),status:'running',progress:[],controller:new AbortController(),result:null};job.directory=join(root,'output/studio',job.id);jobs.set(job.id,job);active=job;return job;};
 async function finish(job,result){
  const {outputDirectory,...publicResult}=result;job.result=publicResult;
  if(result.status==='PASS_REFERENCE'&&!job.controller.signal.aborted){
   job.release=await contentService.release(readFileSync(join(job.directory,'game.json'),'utf8'));
   if(job.controller.signal.aborted){job.status='cancelled';return;}
  }
  job.status=result.status==='PASS_REFERENCE'?'completed':result.status==='CANCELLED'?'cancelled':'failed';
 }
 server.on('request',async(req,res)=>{
  const pathname=(req.url??'').split('?')[0];if(pathname!=='/studio'&&pathname!=='/studio/'&&!pathname.startsWith('/studio/api/')){void player(req,res);return;}
  const json=(status,value)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  try{
   const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);
   if(!['127.0.0.1','localhost'].includes(url.hostname)||Number(url.port)!==server.address()?.port||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw error('A2G_GEN_STUDIO_ORIGIN',403);
   if(!['GET','HEAD'].includes(req.method)&&req.headers['x-a2game-studio']!=='1')throw error('A2G_GEN_STUDIO_ORIGIN',403);
   if(closing)throw error('A2G_GEN_STUDIO_CLOSING',503);
   if(['/studio','/studio/'].includes(pathname)&&req.method==='GET'){
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(readFileSync(join(root,'generator/studio.html')));return;
   }
   if(pathname==='/studio/api/status'&&req.method==='GET'){json(200,{status:'READY',provider,providers:['fixture',...(providerId!=='fixture'?[providerId]:[])],remainingCalls,jobs:[...jobs.values()].map(publicJob),active:active?.id??null});return;}
   if(pathname==='/studio/api/jobs'&&req.method==='POST'){
    const input=JSON.parse(await body(req));
    if(!input||Object.keys(input).some(k=>!['prompt','mode','providerId','maxAttempts'].includes(k))||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>8000||!['direct-json','game-plan'].includes(input.mode)||!['fixture',providerId].includes(input.providerId)||!Number.isInteger(input.maxAttempts)||input.maxAttempts<1||input.maxAttempts>3)throw error('A2G_GEN_STUDIO_INPUT');
    reserve(input.providerId,input.maxAttempts);const job=createJob();json(202,publicJob(job));
    launch(async()=>{let result;
     try{result=await generateGame({prompt:input.prompt,mode:input.mode,providerId:input.providerId,configFile:input.providerId==='fixture'?undefined:configFile,maxAttempts:input.maxAttempts,timeoutMs:180000,outputDirectory:job.directory,signal:job.controller.signal,onProgress:p=>{if(job.progress.length<32)job.progress.push({...p,at:new Date().toISOString()});}});await finish(job,result);}
     catch(e){job.status=job.controller.signal.aborted?'cancelled':'failed';job.error={code:e.code??'A2G_GEN_STUDIO_JOB'};}
     finally{if(input.providerId!=='fixture')remainingCalls+=Math.max(0,input.maxAttempts-(result?.generationCalls??input.maxAttempts));if(active===job)active=null;}
    });return;
   }
   if(pathname==='/studio/api/import'&&req.method==='POST'){
    const text=await body(req,768*1024);reserve('fixture',0);const job=createJob();json(202,publicJob(job));
    launch(async()=>{try{job.progress.push({stage:'import',attempt:0});await finish(job,await importGamePackage(text,job.directory,{signal:job.controller.signal,timeoutMs:60000}));}catch(e){job.status=job.controller.signal.aborted?'cancelled':'failed';job.error={code:e.code??'A2G_GEN_STUDIO_IMPORT'};}finally{if(active===job)active=null;}});return;
   }
   const match=pathname.match(/^\/studio\/api\/jobs\/([a-f0-9-]{36})(?:\/(cancel|download|artifact)(?:\/([a-z-]+\.json))?)?$/),job=match&&jobs.get(match[1]);
   if(!job)throw error('A2G_GEN_STUDIO_NOT_FOUND',404);
   if(!match[2]&&req.method==='GET'){json(200,publicJob(job));return;}
   if(match[2]==='cancel'&&req.method==='POST'){if(job.status==='running')job.controller.abort();json(202,{status:'CANCELLING',id:job.id});return;}
   if(match[2]==='artifact'&&req.method==='GET'&&allowedFiles.has(match[3])&&job.status==='completed'){
    const path=join(job.directory,match[3]);if(!existsSync(path))throw error('A2G_GEN_STUDIO_NOT_FOUND',404);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(readFileSync(path));return;
   }
   if(match[2]==='download'&&req.method==='GET'&&job.status==='completed'){
    // Bound package validations and wait for them during shutdown as well.
    if(job.exporting)throw error('A2G_GEN_STUDIO_BUSY',409);job.exporting=true;
    try{const task=exportGamePackage(job.directory,{signal:controller.signal});tasks.add(task);let pack;try{pack=await task;}finally{tasks.delete(task);}res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="a2game-${job.id}.json"`});res.end(JSON.stringify(pack,null,2)+'\n');}finally{job.exporting=false;}return;
   }
   throw error('A2G_GEN_STUDIO_METHOD',405);
  }catch(e){req.resume();json(e.statusCode??400,{status:'FAIL',code:typeof e.code==='string'&&e.code.startsWith('A2G_')?e.code:'A2G_GEN_STUDIO_INPUT',message:'操作未完成，请查看错误码，检查输入或本机配置后重试。'});}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
 let closePromise;
 const close=()=>closePromise??=(async()=>{closing=true;controller.abort();for(const job of jobs.values())job.controller.abort();const closed=new Promise((ok,no)=>server.close(e=>e?no(e):ok()));server.closeAllConnections();await Promise.allSettled([...tasks]);await closed;})();
 const cancel=()=>{void close();};signal?.addEventListener('abort',cancel,{once:true});server.once('close',()=>signal?.removeEventListener('abort',cancel));
 if(signal?.aborted){await close();throw error('A2G_GEN_CANCELLED');}
 return {status:'READY',url:`http://127.0.0.1:${server.address().port}/studio/`,server,close};
}
