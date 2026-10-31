/** Optional host-configured HTTP transport for the model-independent generation contract. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const failure=(code,message)=>Object.assign(Error(message),{code});
export async function requestGeneration(config,request,{fetchImpl=fetch}={}){
 let endpoint;try{endpoint=new URL(config?.endpoint);}catch{throw failure('A2G_E_PROVIDER_CONFIG','生成器 endpoint 必须为有效 URL。');}
 if(endpoint.username||endpoint.password||endpoint.hash||!['http:','https:'].includes(endpoint.protocol)||endpoint.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))throw failure('A2G_E_PROVIDER_CONFIG','生成器只允许 HTTPS 或本机 HTTP；URL 不得包含凭据或片段。');
 const timeoutMs=config.timeoutMs??50000,maxBytes=config.maxResponseBytes??768*1024;
 if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>300000||!Number.isInteger(maxBytes)||maxBytes<256||maxBytes>768*1024)throw failure('A2G_E_PROVIDER_CONFIG','无效的生成器 HTTP 预算。');
 const body=JSON.stringify(request);if(Buffer.byteLength(body)>2*1024*1024)throw failure('A2G_E_PROVIDER_SIZE','生成请求超出 2 MiB。');
 const headers={'content-type':'application/json','accept':'application/json'};
 // The caller opts into a single named environment variable. Its value never enters receipts.
 if(config.bearerTokenEnv!==undefined){if(typeof config.bearerTokenEnv!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(config.bearerTokenEnv))throw failure('A2G_E_PROVIDER_CONFIG','无效的授权环境变量名称。');const token=process.env[config.bearerTokenEnv];if(!token||/[\r\n]/.test(token))throw failure('A2G_E_PROVIDER_AUTH','调用方尚未提供生成器授权。');headers.authorization='Bearer '+token;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let reader,response;
 try{
  response=await fetchImpl(endpoint,{method:'POST',headers,body,redirect:'error',signal:controller.signal});
  if(!response.ok)throw failure('A2G_E_PROVIDER_HTTP',`生成器返回 HTTP ${response.status}。`);
  if(!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw failure('A2G_E_PROVIDER_TYPE','生成器必须返回 application/json。');
  if(Number(response.headers.get('content-length')??0)>maxBytes)throw failure('A2G_E_PROVIDER_SIZE','生成器响应超出字节预算。');
  if(!response.body)throw failure('A2G_E_PROVIDER_EMPTY','生成器返回空响应。');reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw failure('A2G_E_PROVIDER_SIZE','生成器响应超出字节预算。');}chunks.push(Buffer.from(value));}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw failure('A2G_E_PROVIDER_JSON','生成器响应必须为有效 UTF-8。');}
  if(!text.trim())throw failure('A2G_E_PROVIDER_EMPTY','生成器返回空响应。');return text;
 }catch(e){if(typeof e.code==='string'&&e.code.startsWith('A2G_'))throw e;throw failure(controller.signal.aborted?'A2G_E_PROVIDER_TIMEOUT':'A2G_E_PROVIDER_NETWORK',controller.signal.aborted?'生成器请求超时。':'生成器网络请求失败；请检查配置和服务。');}
 finally{clearTimeout(timer);if(reader)await reader.cancel().catch(()=>{});else await response?.body?.cancel().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const config=JSON.parse(readFileSync(process.argv[2],'utf8')),chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>2*1024*1024)throw failure('A2G_E_PROVIDER_SIZE','生成请求超出 2 MiB。');chunks.push(chunk);}const request=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));process.stdout.write(await requestGeneration(config,request));}
 catch(e){const own=typeof e.code==='string'&&e.code.startsWith('A2G_');process.stderr.write((own?e.code:'A2G_E_PROVIDER_CONFIG')+'：'+(own?e.message:'无法读取生成器配置或请求。')+'\n');process.exitCode=1;}
}
