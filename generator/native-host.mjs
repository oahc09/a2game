/** Admit original host-captured output. This operation never invokes a model or approves identity. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,parse,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {runGeneratorWorker} from './process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fail=code=>Object.assign(Error('原生交付未通过绑定或完整准入，请检查本次回执。'),{code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function safe(path){
 if(typeof path!=='string'||!path||path.includes('\0')||path.split(/[\\/]/).includes('..'))throw fail('A2G_GEN_PATH');
 const p=resolve(path);if(p===parse(p).root)throw fail('A2G_GEN_PATH');
 for(let at=p;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw fail('A2G_GEN_PATH');if(at===dirname(at))break;}return p;
}
const bytes=(path,max)=>{const b=readFileSync(safe(path));if(b.length>max)throw fail('A2G_GEN_INPUT_SIZE');return b;};
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
export async function admitNativeGeneration({contextFile,rawFile,hostRecordFile,outputDirectory,signal,timeoutMs=60000}={}){
 const contextBytes=bytes(contextFile,2*1024*1024),raw=bytes(rawFile,768*1024),recordBytes=bytes(hostRecordFile,64*1024),context=json(contextBytes),record=json(recordBytes);
 if(record.format!=='a2game-native-host-export'||record.version!==1||record.contextSha256!==hash(contextBytes)||record.replySha256!==hash(raw))throw fail('A2G_GEN_NATIVE_BINDING');
 if(context.format!=='a2game-generation-request'||typeof context.prompt!=='string'||!context.prompt.trim()||context.prompt.length>8000||!Number.isInteger(record.generationCalls)||record.generationCalls<1||record.generationCalls>3||!Array.isArray(record.attempts)||record.attempts.length!==record.generationCalls)throw fail('A2G_GEN_NATIVE_RECORD');
 if(record.attempts.some((item,index)=>item.attempt!==index+1)||record.attempts.at(-1).rawSha256!==hash(raw))throw fail('A2G_GEN_NATIVE_BINDING');
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw fail('A2G_GEN_BUDGET');
 const output=safe(outputDirectory);if(existsSync(output))throw fail('A2G_GEN_OUTPUT_EXISTS');
 if(signal?.aborted)throw fail('A2G_GEN_CANCELLED');
 const runId=randomUUID(),privateDirectory=join(root,'.a2game/generator',runId);mkdirSync(privateDirectory,{recursive:true});
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output);
 const text=value=>typeof value==='string'?value.slice(0,200):null;
 const attempts=record.attempts.map(item=>({attempt:item.attempt,status:['PASS','FAIL','BLOCKED','CANCELLED'].includes(item.status)?item.status:'UNKNOWN',code:typeof item.code==='string'&&/^[A-Z0-9_]{1,128}$/.test(item.code)?item.code:null,rawSha256:typeof item.rawSha256==='string'&&/^[a-f0-9]{64}$/.test(item.rawSha256)?item.rawSha256:null}));
 const usage=Object.fromEntries(Object.entries(record.usage??{}).filter(([key,value])=>/^[a-z_]{1,64}$/.test(key)&&typeof value==='number'&&Number.isFinite(value)&&value>=0));
 const report={format:'a2game-generation-report',version:1,runId,status:'FAIL',mode:'direct-json',provider:{id:'native-subagent',requestedModelId:text(record.requestedModel),reportedModelId:text(record.actualServerModelId),reasoningEffort:['low','medium','high','xhigh','max','ultra'].includes(record.reasoningEffort)?record.reasoningEffort:null,identityStatus:'HOST_RECORDED_REQUEST_NOT_SERVER_ATTESTATION',hostRecordSha256:hash(recordBytes)},contextSha256:hash(contextBytes),rawSha256:hash(raw),generationCalls:record.generationCalls,importModelCalls:0,repairCount:record.generationCalls-1,oneShot:false,attempts,usage:Object.keys(usage).length?usage:null,cost:typeof record.cost==='number'&&Number.isFinite(record.cost)&&record.cost>=0?record.cost:'UNKNOWN',G3:'NOT_RUN',artifacts:{}};
 try{
  const {captureNativeReply}=await import('../scripts/g3-native-contract.mjs');
  captureNativeReply({attemptDir:join(privateDirectory,'capture'),replyFile:safe(rawFile),recordFile:safe(hostRecordFile)});
  writeFileSync(join(privateDirectory,'capture/context.json'),contextBytes,{flag:'wx'});
  const check=join(privateDirectory,'check');mkdirSync(check);
  const worker=await runGeneratorWorker('validate',{directory:check,rawFile:join(privateDirectory,'capture/output.raw.json'),prompt:context.prompt},{signal,timeoutMs});
  const workflow=JSON.parse(worker.stdout).validationDirectory,read=name=>json(readFileSync(join(workflow,name)));
  const summary=read('summary.json'),attempt=read('attempt-1.json');save(join(privateDirectory,'validation-pointer.json'),{workflow});
  report.validation={status:summary.status,code:attempt.code??null,attribution:attempt.attribution??null};
  if(summary.status==='PASS_REFERENCE'){
   const parsed=read('output-1.json');
   if(parsed.provenance?.kind!=='independent-model'||attempt.solver)throw fail('A2G_GEN_NATIVE_SOLUTION_REQUIRED');
   mkdirSync(join(output,'tests'));
   const artifacts={'game.json':read('game.json'),'solution.json':read('solution.json'),'conformance.json':parsed.conformance,'release-receipt.json':attempt.release,'debug-bundle.json':read('debug-bundle.json'),'tests/conformance.json':attempt.conformance,'tests/playability.json':read('playability.json'),'tests/lifecycle.json':read('lifecycle.json')};
   for(const [path,value]of Object.entries(artifacts)){save(join(output,path),value);report.artifacts[path]={path,sha256:hash(readFileSync(join(output,path)))};}
   report.status='PASS_REFERENCE';report.solutionSource='PROVIDER_SUPPLIED';report.oneShot=record.generationCalls===1;
  }
 }catch(e){report.code=e.code??'A2G_GEN_NATIVE_IMPORT';report.status=report.code==='A2G_GEN_CANCELLED'?'CANCELLED':'FAIL';}
 save(join(output,'generation-report.json'),report);
 return {...report,outputDirectory:output};
}
