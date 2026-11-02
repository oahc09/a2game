import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createMcpService} from '../integrations/mcp/service.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {createHash} from 'node:crypto';

test('MCP saves tool identity and argument digest with exact successful and failed receipts, without argument bodies',async()=>{
 const service=createMcpService();
 try{
  const good=await service.call('a2game.list_capabilities',{limit:5,offset:0});
  const bad=await service.call('a2game.validate_game',{gameJson:'not-json-PRIVATE_SENTINEL'});
  for(const result of [good,bad]){
   const saved=JSON.parse(readFileSync(join(service.directory,result.runId+'.receipt.json'),'utf8'));
   assert.deepEqual(saved,result);
   const meta=JSON.parse(readFileSync(join(service.directory,result.runId+'.call.json'),'utf8'));
   assert.equal(meta.sessionId,service.sessionId);assert.equal(meta.runId,result.runId);assert.equal(meta.budgetConsumed,0);
   assert.ok(!JSON.stringify(meta).includes('PRIVATE_SENTINEL'));
   assert.match(meta.argumentsSha256,/^[0-9a-f]{64}$/);
  }
  const meta=JSON.parse(readFileSync(join(service.directory,good.runId+'.call.json'),'utf8'));
  assert.equal(meta.tool,'a2game.list_capabilities');
  assert.equal(meta.argumentsSha256,createHash('sha256').update(JSON.stringify({offset:0,limit:5})).digest('hex'));
  assert.equal(bad.status,'FAIL');
 }finally{await service.close();}
});

test('MCP session rejects path/command/config injection, tampered artifact, implicit generation and concurrent work',async()=>{
 const service=createMcpService(),game=JSON.stringify(createFixture().game);
 try{
  for(const [name,args,code]of [
   ['a2game.list_capabilities',{path:'../../private'},'A2G_MCP_ARGUMENTS'],
   ['a2game.inspect_game',{artifactId:'../../private'},'A2G_MCP_ARGUMENTS'],
   ['a2game.generate_game',{prompt:'counter',provider:'codex'},'A2G_MCP_BUDGET'],
   ['a2game.generate_game',{prompt:'counter',provider:'codex',configFile:'private'},'A2G_MCP_ARGUMENTS'],
   ['execute_shell',{command:'untrusted'},'A2G_MCP_TOOL']
  ])assert.equal((await service.call(name,args)).diagnostics[0].code,code);
  const pending=service.call('a2game.validate_game',{gameJson:game});
  assert.equal((await service.call('a2game.list_capabilities',{})).diagnostics[0].code,'A2G_MCP_BUSY');
  const result=await pending;assert.equal(result.status,'PASS_REFERENCE');
  const a=result.data;const artifactFile=join(service.directory,a.artifactId,'game.json');const old=readFileSync(artifactFile);writeFileSync(artifactFile,'{}');
  assert.equal((await service.call('a2game.inspect_game',{artifactId:a.artifactId})).diagnostics[0].code,'A2G_MCP_INTEGRITY');writeFileSync(artifactFile,old);
  assert.equal((await service.call('a2game.export_game',{artifactId:a.artifactId})).diagnostics[0].code,'A2G_MCP_TEST_REQUIRED');
  assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
 assert.equal(service.stats().closed,true);assert.equal((await service.call('a2game.list_capabilities',{})).status,'BLOCKED');
});

test('MCP cancellation and timeout stop bounded validation workers without model calls',async()=>{
 const service=createMcpService({timeoutMs:100}),controller=new AbortController();
 try{
  const pending=service.call('a2game.validate_game',{gameJson:JSON.stringify(createFixture().game)},{signal:controller.signal});controller.abort();
  assert.equal((await pending).status,'FAIL');assert.equal(service.stats().active,false);
  const timed=await service.call('a2game.validate_game',{gameJson:JSON.stringify(createFixture().game)});assert.equal(timed.status,'FAIL');assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});

test('MCP explicit fixture route creates sealed artifacts and exports without a real provider',async()=>{
 const service=createMcpService({provider:'fixture',maxCalls:1});
 try{
  const generated=await service.call('a2game.generate_game',{prompt:'DEMO_FIXTURE counter exercise',provider:'fixture',maxAttempts:1});
  assert.equal(generated.status,'PASS_REFERENCE',JSON.stringify(generated));assert.equal(generated.data.generationCalls,0);
  assert.ok(generated.data.files['tests/lifecycle.json']);
  const exported=await service.call('a2game.export_game',{artifactId:generated.data.artifactId});assert.equal(exported.status,'PASS_REFERENCE',JSON.stringify(exported));
 }finally{await service.close();}
});
