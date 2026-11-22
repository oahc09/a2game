import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWithModel} from '../generator/adapters/model-generator.mjs';

/** Offline dialect conformance for the model-http adapter against the four vendor families named in the
 * multi-model compatibility plan (docs/generator-multi-model.md). Mock fetch only: no network, no credentials,
 * not a real-vendor test — real endpoints stay NOT_RUN until budget and keys are authorized.
 */
const CONFIG={endpoint:'http://127.0.0.1:9/v1/chat/completions',model:'dialect-mock'};
const REQUEST={attempt:1,outputContract:{}};
const json=payload=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
const chat=(content,{finish='stop',refusal=null,toolCalls=null,reasoning=null,model='dialect-mock-returned',usage={prompt_tokens:10,completion_tokens:20,total_tokens:30}}={})=>json({id:'chatcmpl-dialect-mock',object:'chat.completion',model,usage,choices:[{index:0,finish_reason:finish,message:{role:'assistant',content,refusal,...(reasoning!==null?{reasoning_content:reasoning}:{}),...(toolCalls?{tool_calls:toolCalls}:{})}}]});
const encoding=new TextEncoder();
const sseBody=()=>encoding.encode('data: {}\n\n');

test('strict OpenAI-compatible dialect (MiniMax-M2/M3, DeepSeek-chat, GLM-4.x happy path) passes with mapped telemetry',async()=>{
 let captured;
 const {text,telemetry}=await generateWithModel(CONFIG,REQUEST,{fetchImpl:async(url,init)=>{
  captured={url,init,body:JSON.parse(init.body)};
  return chat('{"format":"a2game-generation-output","version":1}');
 }});
 assert.equal(text,'{"format":"a2game-generation-output","version":1}');
 assert.equal(String(captured.url),CONFIG.endpoint);
 // The exact wire dialect every vendor must accept: non-streaming, bounded completion tokens, JSON mode.
 assert.deepEqual(captured.body,{model:'dialect-mock',stream:false,max_completion_tokens:16384,response_format:{type:'json_object'},messages:[
  {role:'system',content:captured.body.messages[0].content},{role:'user',content:JSON.stringify(REQUEST)}]});
 assert.ok(captured.body.messages[0].content.includes('JSON'));
 assert.equal(telemetry.requestedModel,'dialect-mock');
 assert.equal(telemetry.returnedModel,'dialect-mock-returned');
 assert.equal(telemetry.requestId,'chatcmpl-dialect-mock');
 assert.deepEqual(telemetry.usage,{prompt_tokens:10,completion_tokens:20,total_tokens:30});
 assert.equal(telemetry.finishReason,'stop');
 assert.equal(telemetry.cost,'NOT_REPORTED');
 assert.equal(telemetry.settings.responseFormat,'json_object');
});

test('DeepSeek reasoning_content stays out of content; reasoning models parse downstream',async()=>{
 const {text,telemetry}=await generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('{"ok":true}',{reasoning:'让我想想：输出一个游戏 JSON。'})});
 assert.equal(text,'{"ok":true}');
 assert.ok(!text.includes('让我想想'));
 assert.equal(telemetry.finishReason,'stop');
});

test('Qwen thinking-mode errors map to A2G_E_PROVIDER_HTTP; markdown-wrapped content passes through for the bounded repair chain',async()=>{
 await assert.rejects(generateWithModel({...CONFIG},REQUEST,{fetchImpl:async()=>new Response(JSON.stringify({error:{code:'invalid_parameter',message:'<think> requires streaming output'}}),{status:400,headers:{'content-type':'application/json'}})}),{code:'A2G_E_PROVIDER_HTTP'});
 // Non-streaming JSON mode with default thinking may wrap/emit invalid JSON; adapter preserves original bytes.
 const wrapped=await generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('这是思考内容。\n```json\n{"format":"a2game-generation-output","version":1,"dup":1,"dup":2}\n```')});
 assert.match(wrapped.text,/```json/);
 assert.equal(wrapped.text.match(/"dup"/g).length,2);
});

test('truncation, refusal, tool calls and empty content are distinct bounded failures',async()=>{
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('{"partial"',{finish:'length'})}),{code:'A2G_E_PROVIDER_INCOMPLETE'});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('好的，我来帮你。',{refusal:'无法完成该请求'})}),{code:'A2G_E_PROVIDER_REFUSAL'});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat(null,{toolCalls:[{id:'t',type:'function',function:{name:'f',arguments:'{}'}}]})}),{code:'A2G_E_PROVIDER_INCOMPLETE'});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('   ')}),{code:'A2G_E_PROVIDER_INCOMPLETE'});
});

test('HTTP errors, non-JSON envelopes and missing usage map without leaking bodies',async()=>{
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>new Response('{"error":"rate limited"}',{status:429,headers:{'content-type':'application/json'}})}),{code:'A2G_E_PROVIDER_HTTP'});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>new Response('<html>gateway</html>',{status:200,headers:{'content-type':'text/html'}})}),{code:'A2G_E_PROVIDER_TYPE'});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>new Response('not json',{status:200,headers:{'content-type':'application/json'}})}),{code:'A2G_E_PROVIDER_JSON'});
 const noUsage=await generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>json({id:'chatcmpl-2',model:'m2',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{"x":1}'}}]})});
 assert.equal(noUsage.telemetry.usage,null);
});

test('Bearer auth uses one named environment variable and never logs its value',async()=>{
 await assert.rejects(generateWithModel({...CONFIG,bearerTokenEnv:'A2G_TEST_MISSING_BEARER'},REQUEST,{fetchImpl:async()=>chat('{}')}),{code:'A2G_E_PROVIDER_AUTH'});
 process.env.A2G_TEST_DIALECT_BEARER='secret-dialect-token';
 try{
  let authHeader=null;
  const result=await generateWithModel({...CONFIG,bearerTokenEnv:'A2G_TEST_DIALECT_BEARER'},REQUEST,{fetchImpl:async(url,init)=>{authHeader=init.headers.authorization;return chat('{"ok":1}');}});
  assert.equal(authHeader,'Bearer secret-dialect-token');
  assert.equal(result.telemetry.requestId,'chatcmpl-dialect-mock');
  assert.ok(!JSON.stringify(result.telemetry).includes('secret-dialect-token'));
 }finally{delete process.env.A2G_TEST_DIALECT_BEARER;}
});

test('SSE-style streaming responses are rejected rather than mis-parsed (adapter is non-streaming by contract)',async()=>{
 const stream=new Response(sseBody(),{status:200,headers:{'content-type':'text/event-stream'}});
 await assert.rejects(generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>stream}),{code:'A2G_E_PROVIDER_TYPE'});
});

test('bounded extraBody adds vendor fields (GLM thinking / Qwen enable_thinking) but cannot override contract keys',async()=>{
 let captured;
 await generateWithModel({...CONFIG,extraBody:{thinking:{type:'disabled'},model:'evil-model',stream:true,response_format:{type:'text'},messages:[]}},REQUEST,{fetchImpl:async(url,init)=>{
  captured=JSON.parse(init.body);
  return chat('{"ok":1}');
 }});
 assert.deepEqual(captured.thinking,{type:'disabled'});
 assert.equal(captured.model,'dialect-mock');
 assert.equal(captured.stream,false);
 assert.deepEqual(captured.response_format,{type:'json_object'});
 assert.equal(Array.isArray(captured.messages)&&captured.messages.length,2);
 const {telemetry}=await generateWithModel({...CONFIG,extraBody:{enable_thinking:false}},REQUEST,{fetchImpl:async()=>chat('{"ok":2}')});
 assert.deepEqual(telemetry.settings.extraBodyKeys,['enable_thinking']);
 const none=await generateWithModel(CONFIG,REQUEST,{fetchImpl:async()=>chat('{"ok":3}')});
 assert.deepEqual(none.telemetry.settings.extraBodyKeys,[]);
});

test('provider config validation rejects malformed extraBody shapes',async()=>{
 const {probeProvider}=await import('../generator/providers.mjs');
 const {writeFileSync,rmSync,mkdtempSync}=await import('node:fs');
 const {join}=await import('node:path');
 const {tmpdir}=await import('node:os');
 const directory=mkdtempSync(join(tmpdir(),'a2game-dialect-probe-'));
 const path=join(directory,'dialect-probe.json');
 try{
 for(const extra of ['not-an-object',[],{'bad key!':1},{['x'.repeat(5000)]:1}]){
  writeFileSync(path,JSON.stringify({endpoint:'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',model:'glm-5.3-flash',extraBody:extra}));
  const probe=await probeProvider({id:'model-http',configFile:path});
  assert.equal(probe.status,'BLOCKED');assert.equal(probe.code,'A2G_GEN_CONFIG');
 }
 writeFileSync(path,JSON.stringify({endpoint:'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',model:'glm-5.3-flash',extraBody:{thinking:{type:'disabled'}}}));
 const ok=await probeProvider({id:'model-http',configFile:path});
 assert.equal(ok.status,'READY');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
