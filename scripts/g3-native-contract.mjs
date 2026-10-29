/** Shared native delivery/evidence contract. No model invocation or automatic identity approval. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sha256Canonical} from '../dist/index.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,value)=>writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const fail=(code,message)=>{throw Object.assign(Error(message),{code,attribution:'INFRA'});};
export const NATIVE_CONTRACT_VERSION='native-delivery-v2';
export function nativeProtectedSources(root,entryPaths){
 const walk=p=>readdirSync(resolve(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?(p+'/'+e.name==='player/vendor'?[]:walk(p+'/'+e.name)):[p+'/'+e.name]);
 return [...new Set([...entryPaths,'scripts/registry.mjs','scripts/content-service.mjs','scripts/validate-content.py','scripts/asset-policy.mjs','scripts/serve.mjs','scripts/turn-room-service.mjs','project/sdk-lock.json',...walk('src'),...walk('dist').filter(p=>p.endsWith('.js')),...walk('player'),...walk('specs/v0.1/schemas'),...walk('specs/v0.1/capabilities')])].sort();
}
export function withNativeDelivery(request){
 return {...request,outputContract:{...request.outputContract,required:[...new Set([...request.outputContract.required,'solution'])],solution:'Required model-proposed winning playthrough; no implicit host solver assistance.'},nativeDelivery:{
  version:NATIVE_CONTRACT_VERSION,
  output:'Produce one complete UTF-8 JSON object only: no Markdown fences, explanations, placeholders, or promise to write later. In file-capable hosts, Write the designated output.raw.json in this turn, then return only its path and SHA. Otherwise return only the exact JSON for host byte capture; never manually transcribe it.',
  tools:'Read only the supplied public context/task pack and Write only the designated raw output. Do not run shell/validators, inspect the repository, use other models, or read author games, solutions, tests or reports.',
  selfCheck:'Before final output, check declared state paths and types against the public ABI, simulate each proposed input in order, and derive assertions from that trace. Check undo/restart and negative paths. Do not weaken required assertions to hide uncertainty; report a limitation if it cannot be resolved.',
  quality:'Use readable player-facing instructions and progress/result feedback. Do not rely only on a color change. Keep the complete board and text readable on small screens; do not leak hidden state.',
  evidence:'Model provenance is self-report only. The host separately exports observed routing, session/tool records and the original reply. Missing model version, usage or cost stays UNKNOWN.',
  acceptance:'Engineering, variant semantics, browser source input, visual quality, identity/isolation and formal G3 are separate. Do not self-approve G3.'
 }};
}
export function workerInstructions(contextFile,rawFile){
 return `只读取 ${contextFile}；遵循其中 nativeDelivery 与完整输出合同。\n本回合同步完成 JSON 并 Write 到 ${rawFile}，写入后只回复路径和 SHA，不回复“稍后生成”。\n若宿主没有文件写入工具，只返回完整 JSON，由宿主直接捕获原始字节；不要让主 Agent 转写或修正。\n不得读取作者关卡/旧报告、执行命令、调用其他模型或修改源码。模型请求与实际路由、工具记录由宿主另行导出。\n`;
}
export function archiveNativeSources(directory,root,paths){
 const target=resolve(directory,'source-snapshot');mkdirSync(target,{recursive:true});const files={};
 for(const p of paths){const bytes=readFileSync(resolve(root,p)),dest=resolve(target,p);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,bytes,{flag:'wx'});files[p]=hash(bytes);}
 const manifest={format:'a2game-native-source-snapshot',version:1,files};save(resolve(target,'manifest.json'),manifest);return {directory:'source-snapshot',manifestSha256:sha256Canonical(manifest),files};
}
/** Copy explicit host exports only. Never discover or scan conversation histories. */
export function captureNativeReply({attemptDir,replyFile,recordFile}){
 attemptDir=resolve(attemptDir);const raw=readFileSync(resolve(replyFile));
 if(raw.length>768*1024)fail('A2G_E_G3_SIZE','原始回复超过 768 KiB。');
 const record=recordFile?read(resolve(recordFile)):null;
 if(record&&(record.format!=='a2game-native-host-export'||record.version!==1))fail('A2G_E_G3_HOST_RECORD','宿主导出格式应为 a2game-native-host-export@1。');
 if(record?.replySha256&&record.replySha256!==hash(raw))fail('A2G_E_G3_REPLY_INTEGRITY','宿主回复 SHA 与原始字节不一致；保留失败记录，不修正模型 JSON。');
 const sources=[];
 for(const entry of record?.files??[]){
  if(!['model-config','session-events'].includes(entry.role)||typeof entry.path!=='string'||isAbsolute(entry.path)||relative('.',entry.path).startsWith('..'))fail('A2G_E_G3_HOST_RECORD','证据路径必须为导出目录内的相对文件。');
  const bytes=readFileSync(resolve(resolve(recordFile,'..'),entry.path));
  if(hash(bytes)!==entry.sha256)fail('A2G_E_G3_HOST_RECORD','宿主证据文件 SHA 不匹配。');sources.push({...entry,bytes});
 }
 mkdirSync(attemptDir,{recursive:true});const rawPath=resolve(attemptDir,'output.raw.json'),generationPath=resolve(attemptDir,'generation.json');
 if(existsSync(generationPath)||existsSync(resolve(attemptDir,'host-evidence')))fail('A2G_E_G3_OUTPUT_EXISTS','此尝试已有执行记录；请保留，不覆盖。');
 if(existsSync(rawPath)&&!readFileSync(rawPath).equals(raw))fail('A2G_E_G3_REPLY_INTEGRITY','已有 raw 与宿主原始回复不一致；禁止覆盖。');
 const evidence=resolve(attemptDir,'host-evidence');mkdirSync(evidence);
 if(!existsSync(rawPath))writeFileSync(rawPath,raw,{flag:'wx'});
 writeFileSync(resolve(evidence,'reply.bin'),raw,{flag:'wx'});
 if(recordFile)writeFileSync(resolve(evidence,'host-export.json'),readFileSync(resolve(recordFile)),{flag:'wx'});
 const files=[{role:'assistant-reply',path:'reply.bin',sha256:hash(raw)}];
 for(const [i,entry]of sources.entries()){const name=entry.role+'-'+i+'.json';writeFileSync(resolve(evidence,name),entry.bytes,{flag:'wx'});files.push({role:entry.role,path:name,sha256:entry.sha256});}
 save(resolve(evidence,'manifest.json'),{format:'a2game-native-host-evidence',version:1,files,review:'PENDING_INDEPENDENT_REVIEW'});
 const generation={format:'a2game-g3-subagent-generation-record',version:1,host:record?.host??'UNKNOWN',workerSession:record?.workerSession??'UNKNOWN',parentSession:record?.parentSession??'UNKNOWN',status:raw.length?'REPLY_RECORDED':'NO_OUTPUT',modelEvidence:record?.modelEvidence??'UNVERIFIED',isolation:record?.isolation??'UNVERIFIED',rawOutput:{path:'output.raw.json',sha256:hash(raw),bytes:raw.length},hostEvidence:{directory:'host-evidence',status:record?'PACKAGED_HOST_EXPORT_PENDING_REVIEW':'RAW_ONLY_UNVERIFIED'},usage:record?.usage??'NOT_REPORTED',cost:record?.cost??'UNKNOWN'};
 save(generationPath,generation);return generation;
}
export function classifyNativeFailure(error){
 if(error.attribution)return error.attribution;
 const code=String(error.message).match(/A2G_E_[A-Z0-9_]+/)?.[0]??error.code??'UNKNOWN';
 if(code==='A2G_E_G3_SIZE')return 'MODEL_OUTPUT_PROTOCOL';
 if(/A2G_E_(PROVIDER_JSON|AGENT_(ENVELOPE|CONFORMANCE|SOLUTION|PLAYABILITY|SOLVER_BUDGET))/.test(code))return 'AGENT_STRATEGY';
 return 'INFRA';
}
export const pendingNativeReviews=()=>({identityAndIsolation:'AWAITING_HOST_EVIDENCE_REVIEW',variantSemantics:'AWAITING_REVIEW',sourceInput:'NOT_RUN',visualQuality:'AWAITING_REVIEW',formalG3:'NOT_RUN'});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const args=process.argv.slice(2),arg=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 if(args[0]!=='capture'||!arg('attempt-dir')||!arg('reply'))throw Error('用法：g3-native-contract.mjs capture --attempt-dir=<dir> --reply=<宿主原始回复文件> [--record=<宿主导出.json>]');
 console.log(JSON.stringify(captureNativeReply({attemptDir:arg('attempt-dir'),replyFile:arg('reply'),recordFile:arg('record')}),null,2));
}catch(e){console.error((e.code??'A2G_E_G3_CAPTURE')+'：'+e.message);process.exitCode=1;}
