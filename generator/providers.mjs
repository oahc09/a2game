/** Local readiness checks only; no provider calls or credential reads. */
import {readFileSync,statSync} from 'node:fs';
const ids=new Set(['fixture','codex','claude','model-http','http']);
const fault=code=>Object.assign(Error('生成器本机配置不可用。'),{code});
export function loadProviderConfig(id,configFile){
 if(!ids.has(id))throw fault('A2G_GEN_PROVIDER');
 if(id==='fixture'&&!configFile)return {};
 if(typeof configFile!=='string'||!configFile)throw fault('A2G_GEN_CONFIG_REQUIRED');
 let config;try{const bytes=readFileSync(configFile);if(bytes.length>64*1024)throw Error();config=JSON.parse(bytes.toString('utf8'));}catch{throw fault('A2G_GEN_CONFIG');}
 if(!config||typeof config!=='object'||Array.isArray(config))throw fault('A2G_GEN_CONFIG');
 const check=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(/^(?:api[-_]?key|token|access[-_]?token|authorization|password|secret|bearerToken)$/i.test(key))throw fault('A2G_GEN_INLINE_CREDENTIAL');check(item);}};check(config);
 if(config.bearerTokenEnv!==undefined&&(typeof config.bearerTokenEnv!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(config.bearerTokenEnv)))throw fault('A2G_GEN_CONFIG');
 return config;
}
export async function probeProvider({id,configFile}={}){
 const result={id:id??null,status:'BLOCKED',requestedModelId:id==='fixture'?'DEMO_FIXTURE':id==='codex'?'inherited-cli-default':null,reportedModelId:null,identityStatus:id==='fixture'?'FIXTURE':'UNVERIFIED',supportsJsonMode:id==='fixture'||id==='model-http',contextLimit:null,timeoutMs:60000,costReporting:id==='fixture'?'NOT_APPLICABLE':'NOT_REPORTED'};
 try{
  const config=loadProviderConfig(id,configFile);
  if(id==='fixture'){
   if(config.fixtureMode!==undefined&&!['invalid-json','invalid-game','repair-json','stall','valid'].includes(config.fixtureMode))throw fault('A2G_GEN_CONFIG');
  }else if(id==='codex'){
   if(typeof config.executable!=='string'||!statSync(config.executable).isFile()||!Number.isInteger(config.generationTimeoutMs)||config.generationTimeoutMs<1000||config.generationTimeoutMs>600000)throw fault('A2G_GEN_CONFIG');
   result.timeoutMs=config.generationTimeoutMs;
  }else if(id==='claude'){
   if(typeof config.executable!=='string'||!statSync(config.executable).isFile()||typeof config.model!=='string'||!config.model.trim()||config.model.length>200||!Number.isInteger(config.generationTimeoutMs)||config.generationTimeoutMs<1000||config.generationTimeoutMs>600000)throw fault('A2G_GEN_CONFIG');
   result.timeoutMs=config.generationTimeoutMs;result.requestedModelId=config.model;
  }else{
   let endpoint;try{endpoint=new URL(config.endpoint);}catch{throw fault('A2G_GEN_CONFIG');}
   if(endpoint.username||endpoint.password||endpoint.hash||endpoint.search||!['https:','http:'].includes(endpoint.protocol)||endpoint.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))throw fault('A2G_GEN_CONFIG');
   const timeout=config.timeoutMs??50000,limit=config.maxResponseBytes??768*1024;
   if(!Number.isInteger(timeout)||timeout<50||timeout>300000||!Number.isInteger(limit)||limit<256||limit>768*1024)throw fault('A2G_GEN_CONFIG');
   result.timeoutMs=timeout;
   if(id==='model-http'){
    if(typeof config.model!=='string'||!config.model.trim()||config.model.length>200)throw fault('A2G_GEN_CONFIG');
    const tokens=config.maxCompletionTokens??16384;if(!Number.isInteger(tokens)||tokens<256||tokens>65536)throw fault('A2G_GEN_CONFIG');
    result.requestedModelId=config.model;
    if(config.extraBody!==undefined){
     if(!config.extraBody||typeof config.extraBody!=='object'||Array.isArray(config.extraBody))throw fault('A2G_GEN_CONFIG');
     if(Buffer.byteLength(JSON.stringify(config.extraBody))>4096)throw fault('A2G_GEN_CONFIG');
     for(const key of Object.keys(config.extraBody))if(!/^[a-z_][a-z0-9_]{0,63}$/i.test(key))throw fault('A2G_GEN_CONFIG');
    }
   }
  }
  result.status='READY';
 }catch(e){result.code=typeof e.code==='string'&&e.code.startsWith('A2G_GEN_')?e.code:'A2G_GEN_CONFIG';}
 return result;
}
