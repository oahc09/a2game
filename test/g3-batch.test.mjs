import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildG3Plan,validateG3Config,inspectGeneratedTask} from '../scripts/g3-batch.mjs';
import {generateWithModel} from '../scripts/model-generator.mjs';
import {checkG3SuiteBudget,executeG3Case} from '../scripts/g3-playthrough.mjs';
import {HeadlessRuntime,runConformanceSuite} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
test('37 fixed NL tasks exclude authored definitions/solutions and require explicit invocation budgets; fixture cannot become G3',()=>{
 const plan=buildG3Plan();assert.equal(plan.tasks.length,37);assert.equal(plan.tasks.filter(t=>t.id.startsWith('G')).length,32);assert.equal(plan.G3,'NOT_RUN');
 for(const t of plan.tasks){assert.ok(t.prompt.includes(t.title)&&t.prompt.includes('必需玩法'));assert.equal(t.G3,'NOT_RUN');assert.ok(!t.prompt.includes('"solution":[')&&!t.prompt.includes('"format":"a2game"'));}
 const config={provider:{id:'test-only',model:'test-only'},command:['node','test/fixtures/agent-provider.mjs'],maxAttempts:3,timeoutMs:8000,maxTasks:1,maxCalls:3};validateG3Config(config,1);assert.throws(()=>validateG3Config(config,37),/任务预算/);assert.throws(()=>validateG3Config({...config,maxCalls:0},1),/maxCalls/);
 assert.throws(()=>inspectGeneratedTask(plan.tasks[0],{provenance:{kind:'fixture'}}),/A2G_E_G3_FIXTURE/);
});
test('model transport preserves raw generated JSON, records only observed usage and rejects refusals/truncation',async()=>{
 const text='{"duplicate":1,"duplicate":2}',config={endpoint:'http://127.0.0.1/v1/chat/completions',model:'test-model',maxCompletionTokens:4096};
 const fetchImpl=async(url,init)=>{const body=JSON.parse(init.body);assert.equal(body.stream,false);assert.equal(body.max_completion_tokens,4096);assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(JSON.parse(body.messages[1].content).previous.code,'REPAIR');return new Response(JSON.stringify({id:'test-call',model:'test-model-revision',choices:[{finish_reason:'stop',message:{content:text}}],usage:{prompt_tokens:12,completion_tokens:8,total_tokens:20}}),{headers:{'content-type':'application/json'}});};
 const result=await generateWithModel(config,{previous:{code:'REPAIR'}},{fetchImpl});assert.equal(result.text,text);assert.deepEqual(result.telemetry.usage,{prompt_tokens:12,completion_tokens:8,total_tokens:20});assert.equal(result.telemetry.cost,'NOT_REPORTED');
 for(const [choice,code] of [[{finish_reason:'length',message:{content:'{"unfinished":'}},'A2G_E_PROVIDER_INCOMPLETE'],[{finish_reason:'stop',message:{refusal:'private text'}},'A2G_E_PROVIDER_REFUSAL']])await assert.rejects(generateWithModel(config,{}, {fetchImpl:async()=>new Response(JSON.stringify({choices:[choice]}),{headers:{'content-type':'application/json'}})}),e=>e.code===code&&!e.message.includes('private text'));
});
test('shared generated-case replay matches Conformance including snapshot/restore; oversized traces are rejected',async()=>{
 const game=JSON.parse(readFileSync('specs/v0.1/samples/games/tap-target.game.json')),click=[{op:'injectAction',action:'collect',phase:'press'},{op:'injectAction',action:'collect',phase:'release'},{op:'step',ticks:1}];
 const suite={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'bounded-generated',subject:{type:'game',id:game.id,file:'unused'},cases:[{id:'positive',seed:42,steps:[{op:'start'},...click,{op:'snapshot',id:'one'},...click,{op:'assert',path:'/flow/status',equals:'won'},{op:'restore',id:'one'},...click,{op:'assert',path:'/flow/status',equals:'won'}]},{id:'negative',seed:42,steps:[{op:'start'},...click,{op:'assert',path:'/flow/status',equals:'playing'}]}]};
 checkG3SuiteBudget(suite);assert.equal((await runConformanceSuite(suite,game,makeRegistry)).status,'PASS');
 for(const c of suite.cases){const runtime=new HeadlessRuntime(game,makeRegistry());try{const result=executeG3Case(c,{runtime,step:n=>runtime.step(n)});assert.equal(result.status,'PASS');assert.equal(result.flow,c.id==='positive'?'won':'playing');}finally{runtime.dispose();}}
 assert.throws(()=>checkG3SuiteBudget({...suite,cases:[{steps:[{op:'start'},{op:'step',ticks:12001}]},suite.cases[1]]}),/A2G_E_G3_BUDGET/);
 assert.throws(()=>checkG3SuiteBudget({...suite,cases:[suite.cases[0],{steps:[{op:'start'},{op:'assert',path:'/flow/status',equals:'playing'}]}]}),/A2G_E_G3_CASES/);
});
