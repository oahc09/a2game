import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createMcpService} from '../integrations/mcp/service.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {publicDiagnostics} from '../generator/diagnostics.mjs';
import {publicResources,readPublicResource} from '../integrations/mcp/resources.mjs';
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
const root=resolve(import.meta.dirname,'..'),hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));

test('versioned resources enumerate exact white-listed bounded contracts, not author games or solutions',async()=>{
 assert.equal(publicResources.length,5);
 for(const resource of publicResources){
  const result=readPublicResource(resource.uri),body=JSON.parse(result.contents[0].text);
  assert.equal(body.specVersion,'0.1.0');assert.equal(body.uri,resource.uri);
  assert.equal(body.bytes,Buffer.byteLength(body.content));assert.equal(body.sha256,hash(body.content));
  assert.ok(body.bytes<=256*1024);JSON.parse(body.content);
 }
 for(const uri of ['file:///etc/passwd','a2game://spec/0.1.0/../../games/G01.json',publicResources[0].uri+'?path=private','a2game://spec/0.2.0/game.schema.json'])assert.throws(()=>readPublicResource(uri),{code:'A2G_MCP_RESOURCE'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs')],stderr:'pipe'}),client=new Client({name:'resource-contract-test',version:'1.0.0'});
 try{await client.connect(transport);assert.equal((await client.listTools()).tools.length,9);assert.equal((await client.listResources()).resources.length,5);
  const response=await client.readResource({uri:publicResources[0].uri});assert.equal(JSON.parse(response.contents[0].text).sha256,JSON.parse(readPublicResource(publicResources[0].uri).contents[0].text).sha256);
  await assert.rejects(client.readResource({uri:'file:///etc/passwd'}));
 }finally{await client.close();await transport.close();}
});

test('diagnostics safely retain typed locations and bounds, without raw messages or arbitrary objects',()=>{
 const d=publicDiagnostics({code:'A2G_E_SCHEMA',message:'SECRET_TOKEN=private',stack:'private-stack',diagnostics:[{pointer:'/rules/0',ruleId:'count',expected:{token:'private'},actual:'PRIVATE_SENTINEL',message:'PRIVATE_SENTINEL'},{pointer:'/state',expected:3,actual:2}]});
 assert.equal(d[0].jsonPointer,'/rules/0');assert.equal(d[0].ruleId,'count');assert.equal(d[1].expected,3);assert.equal(d[1].actual,2);
 assert.ok(!JSON.stringify(d).includes('private'));assert.ok(!JSON.stringify(d).includes('PRIVATE_SENTINEL'));assert.equal(d[0].expected,undefined);
 assert.equal(publicDiagnostics({code:'A2G_E_SCHEMA',diagnostics:Array.from({length:30},()=>({pointer:'/'+'x'.repeat(300),actual:'x'.repeat(500)}))}).length,20);
});

test('MCP and CLI preserve actionable parse/schema/semantic/conformance diagnostics without provider calls',async()=>{
 const service=createMcpService();
 try{
  const duplicate=await service.call('a2game.validate_game',{gameJson:'{"format":"a2game","format":"duplicate"}'});
  assert.equal(duplicate.status,'FAIL');assert.equal(duplicate.diagnostics[0].stage,'parse');
  const game=createFixture().game;game.specVersion='9.9.9';
  const bad=await service.call('a2game.validate_game',{gameJson:JSON.stringify(game)});
  assert.equal(bad.status,'FAIL');assert.deepEqual(bad.data.diagnostics,bad.diagnostics);assert.equal(bad.diagnostics[0].jsonPointer,'/specVersion');assert.equal(bad.diagnostics[0].expected,'0.1.0');assert.equal(bad.diagnostics[0].actual,'9.9.9');assert.ok(bad.diagnostics[0].repairHint);
  mkdirSync(join(root,'output'),{recursive:true});const directory=mkdtempSync(join(root,'output/diagnostics-test-')),file=join(directory,'bad.json');writeFileSync(file,JSON.stringify(game));
  const cli=spawnSync(process.execPath,['generator/cli.mjs','validate',file,'--json'],{cwd:root,encoding:'utf8'});assert.equal(cli.status,1,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout).diagnostics,bad.diagnostics);
  const missing=createFixture().game;delete missing.requires;
  const required=await service.call('a2game.validate_game',{gameJson:JSON.stringify(missing)});assert.ok(required.diagnostics.some(d=>d.jsonPointer==='/requires'));
  const semantic=createFixture().game;semantic.rules[0].do[0].path='/missing';
  const wrongRule=await service.call('a2game.validate_game',{gameJson:JSON.stringify(semantic)});assert.equal(wrongRule.diagnostics[0].stage,'semantic');assert.equal(wrongRule.diagnostics[0].ruleId,'count');assert.equal(wrongRule.diagnostics[0].jsonPointer,'/rules/0/do/0/path');
  const unknown=createFixture().game;unknown.requires.all.push({id:'a2game.core.unknown',version:'0.1.0'});
  const cap=await service.call('a2game.validate_game',{gameJson:JSON.stringify(unknown)});assert.equal(cap.diagnostics[0].capabilityId,'a2game.core.unknown');
  const fixture=createFixture();fixture.conformance.cases[1].steps.find(s=>s.op==='assert'&&s.path==='/state/score').equals=999;
  const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(fixture.game),conformanceJson:JSON.stringify(fixture.conformance),solutionJson:JSON.stringify(fixture.solution)});assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));
  const negative=await service.call('a2game.test_game',{artifactId:admitted.data.artifactId});assert.equal(negative.status,'FAIL');const detail=negative.diagnostics[0];assert.equal(detail.stage,'conformance');assert.equal(detail.caseId,'two-clicks-not-enough');assert.equal(detail.expected,999);assert.equal(detail.actual,2);assert.match(detail.jsonPointer,/^\/cases\/1\/steps\//);
  const budget=await service.call('a2game.generate_game',{prompt:'counter',provider:'codex'});assert.equal(budget.diagnostics[0].stage,'budget');
  const injected=await service.call('a2game.list_capabilities',{path:'private'});assert.equal(injected.diagnostics[0].stage,'arguments');assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});

test('session-bound ledger accounts for every call including rejected input, and export names its real format',async()=>{
 const hostRunId=randomUUID(),service=createMcpService({hostRunId});
 try{
  assert.equal(read(join(service.directory,'session.json')).hostRunId,hostRunId);assert.match(read(join(service.directory,'session.json')).implementationSha256,/^[0-9a-f]{64}$/);
  const good=await service.call('a2game.list_capabilities',{}),bad=await service.call('a2game.list_capabilities',{hostRunId:randomUUID()});
  for(const [index,r]of [good,bad].entries()){
   const meta=read(join(service.directory,r.runId+'.call.json'));assert.equal(meta.hostRunId,hostRunId);assert.equal(meta.sequence,index+1);assert.equal(meta.state,'COMPLETED');assert.equal(meta.receiptSha256,hash(readFileSync(join(service.directory,r.runId+'.receipt.json'))));
  }
  const fixture=createFixture(),pending=service.call('a2game.validate_game',{gameJson:JSON.stringify(fixture.game),conformanceJson:JSON.stringify(fixture.conformance),solutionJson:JSON.stringify(fixture.solution)});
  const started=readdirSync(service.directory).filter(n=>n.endsWith('.call.json')).map(n=>read(join(service.directory,n))).find(m=>m.sequence===3);assert.equal(started.state,'STARTED');assert.equal(existsSync(join(service.directory,started.runId+'.receipt.json')),false);
  const admitted=await pending;
  assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));const artifactId=admitted.data.artifactId;
  const tested=await service.call('a2game.test_game',{artifactId});assert.equal(tested.status,'PASS_REFERENCE',JSON.stringify(tested));
  const exported=await service.call('a2game.export_game',{artifactId});assert.equal(exported.status,'PASS_REFERENCE',JSON.stringify(exported));assert.equal(exported.data.format,read(join(root,exported.data.path)).format);assert.equal(exported.data.format,'a2game-generator-package');
  assert.equal(read(join(service.directory,'session.json')).lastSequence,5);
 }finally{await service.close();}
 assert.equal(read(join(service.directory,'session.json')).state,'CLOSED');
 assert.throws(()=>createMcpService({hostRunId:'not-uuid'}),{code:'A2G_MCP_CONFIG'});
});
