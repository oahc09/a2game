/** A single owned worker tree; untrusted output never selects executable/argv. */
import {spawn,execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const worker=fileURLToPath(new URL('./worker.mjs',import.meta.url));
const failure=code=>Object.assign(Error('生成器工作进程未完成；请查看本次安全回执。'),{code});
export function runGeneratorWorker(kind,payload,{signal,timeoutMs=60000,maxBytes=768*1024}={}){
 if(!['generate','validate','admission'].includes(kind)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>660000||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>2*1024*1024)return Promise.reject(failure('A2G_GEN_WORKER_CONFIG'));
 let request;try{request=JSON.stringify({kind,payload});if(Buffer.byteLength(request)>2*1024*1024)throw Error();}catch{return Promise.reject(failure('A2G_GEN_WORKER_REQUEST'));}
 if(signal?.aborted)return Promise.reject(failure('A2G_GEN_CANCELLED'));
 return new Promise((accept,reject)=>{
  const child=spawn(process.execPath,[worker],{shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
  let size=0,stderrBytes=0,settled=false,stopping=false,closed=false,cleanupDone=false,stopCode=null,timer;const chunks=[];
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):accept(result);};
  const killTree=async()=>{
   if(!child.pid)return;
   if(process.platform==='win32')await new Promise(resolve=>execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,shell:false},()=>resolve()));
   else{try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}}
  };
  const stop=async code=>{if(stopping||settled)return;stopping=true;stopCode=code;try{await killTree();}catch{stopCode='A2G_GEN_WORKER_CLEANUP';}cleanupDone=true;if(closed)finish(failure(stopCode));};
  const cancel=()=>{void stop('A2G_GEN_CANCELLED');};
  child.once('error',()=>{closed=true;finish(failure('A2G_GEN_WORKER_START'));});
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)void stop('A2G_GEN_WORKER_SIZE');else chunks.push(chunk);});
  child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;});child.stdin.on('error',()=>{});
  child.once('close',code=>{closed=true;if(stopping){if(cleanupDone)finish(failure(stopCode));return;}if(code!==0){finish(failure('A2G_GEN_WORKER_EXIT'));return;}try{finish(null,{stdout:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),exitCode:code});}catch{finish(failure('A2G_GEN_WORKER_ENCODING'));}});
  timer=setTimeout(()=>{void stop('A2G_GEN_TIMEOUT');},timeoutMs);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();child.stdin.end(request);
 });
}
