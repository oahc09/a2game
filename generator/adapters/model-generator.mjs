/** Chat Completions transport only; generated game text remains untrusted. */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {requestGeneration} from './http-generator.mjs';
const fail=(code,message)=>Object.assign(Error(message),{code});
export async function generateWithModel(config,request,{fetchImpl=fetch}={}){
 if(typeof config.model!=='string'||!config.model.trim()||config.model.length>200)throw fail('A2G_E_PROVIDER_CONFIG','请填写实际模型名称。');
 const limit=config.maxCompletionTokens??16384;
 if(!Number.isInteger(limit)||limit<256||limit>65536)throw fail('A2G_E_PROVIDER_CONFIG','无效的模型输出 Token 预算。');
 // Vendor dialects need bounded extra fields (GLM thinking, Qwen enable_thinking). Extra fields may not
 // override the four contract keys; identity, non-streaming, JSON mode and messages stay authoritative.
 const extraBody=config.extraBody&&typeof config.extraBody==='object'&&!Array.isArray(config.extraBody)?config.extraBody:{};
 const body={...extraBody,model:config.model,stream:false,max_completion_tokens:limit,response_format:{type:'json_object'},messages:[
  {role:'system',content:'You generate engine-independent A2Game JSON. Return one JSON object matching outputContract, with game, conformance, provenance and a winning solution. No Markdown, scripts, tools or commands. Use only the supplied versioned capability contracts. provenance must truthfully identify this model; never claim acceptance. Include a meaningful positive and negative playthrough. All GameSpec fields and Conformance cases must satisfy the supplied schemas.'},
  {role:'user',content:JSON.stringify(request)}]};
 const raw=await requestGeneration(config,body,{fetchImpl});let response;
 try{response=JSON.parse(raw);}catch{throw fail('A2G_E_PROVIDER_JSON','模型接口未返回有效 JSON。');}
 const choice=response.choices?.[0];
 if(choice?.message?.refusal)throw fail('A2G_E_PROVIDER_REFUSAL','模型拒绝生成；未公开拒绝正文。');
 if(choice?.finish_reason!=='stop'||choice.message?.tool_calls?.length||typeof choice.message?.content!=='string'||!choice.message.content.trim())throw fail('A2G_E_PROVIDER_INCOMPLETE','模型未完整返回 JSON；请检查输出预算或接口格式。');
 // Preserve original content, including duplicate keys, for parse-agent-output.py.
 const usage={};for(const key of ['prompt_tokens','completion_tokens','total_tokens']){const value=response.usage?.[key];if(Number.isSafeInteger(value)&&value>=0)usage[key]=value;}
 return {text:choice.message.content,telemetry:{format:'a2game-model-call',version:1,requestedModel:config.model,returnedModel:typeof response.model==='string'?response.model.slice(0,200):null,requestId:typeof response.id==='string'?response.id.slice(0,200):null,settings:{stream:false,maxCompletionTokens:limit,responseFormat:'json_object',timeoutMs:config.timeoutMs??50000,extraBodyKeys:Object.keys(extraBody).sort()},usage:Object.keys(usage).length?usage:null,cost:'NOT_REPORTED',finishReason:choice.finish_reason}};
}
export async function runModelGeneratorCli(){
 try{const config=JSON.parse(readFileSync(process.argv[2],'utf8')),chunks=[];let bytes=0;for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>2*1024*1024)throw fail('A2G_E_PROVIDER_SIZE','生成请求超过 2 MiB。');chunks.push(chunk);}
  const request=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),result=await generateWithModel(config,request);
  // Only the trusted batch runner chooses this directory; never use a model-supplied path.
  if(process.env.A2GAME_G3_CALL_DIR&&Number.isInteger(request.attempt)&&request.attempt>=1&&request.attempt<=3)writeFileSync(resolve(process.env.A2GAME_G3_CALL_DIR,`model-call-${request.attempt}.json`),JSON.stringify(result.telemetry,null,2)+'\n',{flag:'wx'});
  process.stdout.write(result.text);
 }catch(e){const own=typeof e.code==='string'&&e.code.startsWith('A2G_');process.stderr.write((own?e.code:'A2G_E_PROVIDER_CONFIG')+'：'+(own?e.message:'无法读取模型配置或请求。')+'\n');process.exitCode=1;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runModelGeneratorCli();
