import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createMcpService} from '../integrations/mcp/service.mjs';
import {syncBuiltinESMExports} from 'node:module';
import {createFixture} from '../generator/fixture.mjs';
import {publicDiagnostics} from '../generator/diagnostics.mjs';
import {publicResources,readPublicResource} from '../integrations/mcp/resources.mjs';
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
const root=resolve(import.meta.dirname,'..'),hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));

test('versioned resources enumerate exact white-listed bounded contracts, not author games or solutions',async()=>{
 assert.equal(publicResources.length,6);
 for(const resource of publicResources){
  const result=readPublicResource(resource.uri),body=JSON.parse(result.contents[0].text);
  assert.equal(body.specVersion,'0.1.0');assert.equal(body.uri,resource.uri);
  assert.equal(body.bytes,Buffer.byteLength(body.content));assert.equal(body.sha256,hash(body.content));
  assert.ok(body.bytes<=256*1024);JSON.parse(body.content);
 }
 for(const uri of ['file:///etc/passwd','a2game://spec/0.1.0/../../games/G01.json',publicResources[0].uri+'?path=private','a2game://spec/0.2.0/game.schema.json'])assert.throws(()=>readPublicResource(uri),{code:'A2G_MCP_RESOURCE'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs')],stderr:'pipe'}),client=new Client({name:'resource-contract-test',version:'1.0.0'});
 try{await client.connect(transport);assert.equal((await client.listTools()).tools.length,9);assert.equal((await client.listResources()).resources.length,6);
  const response=await client.readResource({uri:publicResources[0].uri});assert.equal(JSON.parse(response.contents[0].text).sha256,JSON.parse(readPublicResource(publicResources[0].uri).contents[0].text).sha256);
  const library=await client.readResource({uri:'a2game://spec/0.1.0/creation-library.json'});
  assert.equal(JSON.parse(JSON.parse(library.contents[0].text).content).entries[0].id,'warm-workshop');
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
  // Synchronous handshake: observe the STARTED ledger phase while the call is in flight.
  // If the call completed synchronously (a prefix error), fail with that receipt's own
  // error instead of mislabeling it as a state-machine violation.
  const readCall=sequence=>readdirSync(service.directory).filter(n=>n.endsWith('.call.json')).map(n=>read(join(service.directory,n))).find(m=>m.sequence===sequence);
  let started=readCall(3);
  for(let attempt=0;attempt<100&&(!started||started.state!=='STARTED');attempt++){
   if(started&&started.state==='COMPLETED'&&existsSync(join(service.directory,started.runId+'.receipt.json'))){
    const receipt=read(join(service.directory,started.runId+'.receipt.json'));
    assert.fail(`call completed synchronously before STARTED could be observed: ${receipt.status} ${receipt.diagnostics?.map(d=>d.code+':'+d.message).join('; ')}`);
   }
   await new Promise(ok=>setTimeout(ok,10));started=readCall(3);
  }
  assert.ok(started,'call metadata never appeared');assert.equal(started.state,'STARTED');assert.equal(existsSync(join(service.directory,started.runId+'.receipt.json')),false);
  const admitted=await pending;
  assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));const artifactId=admitted.data.artifactId;
  const tested=await service.call('a2game.test_game',{artifactId});assert.equal(tested.status,'PASS_REFERENCE',JSON.stringify(tested));
  const exported=await service.call('a2game.export_game',{artifactId});assert.equal(exported.status,'PASS_REFERENCE',JSON.stringify(exported));assert.equal(exported.data.format,read(join(root,exported.data.path)).format);assert.equal(exported.data.format,'a2game-generator-package');
  assert.equal(read(join(service.directory,'session.json')).lastSequence,5);
 }finally{await service.close();}
 assert.equal(read(join(service.directory,'session.json')).state,'CLOSED');
 assert.throws(()=>createMcpService({hostRunId:'not-uuid'}),{code:'A2G_MCP_CONFIG'});
});


test('missing conformance coverage reports controlled rule IDs at /cases before execution',async()=>{
 const service=createMcpService();
 try{
  const variants=[
   ['one-case',f=>{f.conformance.cases=f.conformance.cases.slice(0,1);},['conformance.minimum-cases','conformance.negative-assertion']],
   ['missing-win',f=>{f.conformance.cases[0].steps=f.conformance.cases[0].steps.filter(s=>!(s.op==='assert'&&s.path==='/flow/status'));},['conformance.win-assertion']],
   ['missing-negative',f=>{f.conformance.cases[1].steps=f.conformance.cases[1].steps.filter(s=>!(s.op==='assert'&&s.path==='/flow/status'));},['conformance.negative-assertion']],
   ['wrong-observation-path',f=>{for(const c of f.conformance.cases)for(const s of c.steps)if(s.op==='assert'&&s.path==='/flow/status')s.path='/status';},['conformance.win-assertion','conformance.negative-assertion']]
  ];
  for(const [label,mutate,expectedRules]of variants){
   const f=createFixture();mutate(f);
   const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(f.game),conformanceJson:JSON.stringify(f.conformance),solutionJson:JSON.stringify(f.solution)});
   assert.equal(admitted.status,'PASS_REFERENCE',label+JSON.stringify(admitted));
   const result=await service.call('a2game.test_game',{artifactId:admitted.data.artifactId});
   assert.equal(result.status,'FAIL',label);assert.deepEqual(result.diagnostics.map(d=>d.ruleId),expectedRules,label);
   for(const d of result.diagnostics){assert.equal(d.code,'A2G_E_AGENT_CONFORMANCE');assert.equal(d.stage,'conformance');assert.equal(d.jsonPointer,'/cases');assert.equal(d.caseId,undefined);assert.equal(typeof d.expected,'number');assert.equal(typeof d.actual,'number');assert.ok(d.repairHint.length<=500);}
   if(label==='wrong-observation-path')assert.ok(result.diagnostics.every(d=>d.repairHint.includes('/flow/status')));
  }
  assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
 const [safe]=publicDiagnostics({code:'A2G_E_AGENT_CONFORMANCE',diagnostics:[{ruleId:'conformance.win-assertion',jsonPointer:'/cases',message:'PRIVATE_SENTINEL',repairHint:'PRIVATE_SENTINEL'}]});
 assert.ok(safe.repairHint.includes('/flow/status'));assert.ok(!JSON.stringify(safe).includes('PRIVATE_SENTINEL'));
});

test('public HostProfile states solution input edges and conformance observation/coverage contracts',()=>{
 const envelope=JSON.parse(readPublicResource('a2game://spec/0.1.0/host-profile.json').contents[0].text),profile=JSON.parse(envelope.content);
 assert.match(profile.solution.actionSemantics,/press.*release/);assert.match(profile.solution.actionSemantics,/not a held press/);assert.equal(profile.solution.ticksMinimum,1);
 assert.equal(profile.conformance.minimumCases,2);assert.equal(profile.conformance.observationPaths.flowStatus,'/flow/status');assert.equal(profile.conformance.observationPaths.gameState,'/state/<field>');
 assert.deepEqual(profile.conformance.requiredStatusAssertions,{success:['won'],negative:['playing','lost']});
 assert.equal(envelope.sha256,hash(envelope.content));
});


test('public HostProfile exposes existing scene2d coordinates without repairing layouts or revealing levels',()=>{
 const envelope=JSON.parse(readPublicResource('a2game://spec/0.1.0/host-profile.json').contents[0].text),profile=JSON.parse(envelope.content),scene=profile.presentation.scene2d;
 assert.equal(scene.coordinateSystem,'CENTER_ORIGIN_Y_UP');assert.match(scene.dimensions,/logical.*not physical/);
 assert.deepEqual(scene.visibleBounds,{x:['-width/2','width/2'],y:['-height/2','height/2']});
 assert.equal(scene.repeatCell.x,'originX+(cell % columns)*stepX');assert.equal(scene.repeatCell.y,'originY-floor(cell/columns)*stepY');
 assert.match(scene.layout,/not the top-left/);assert.match(scene.review,/not automatic layout correction/);
 assert.equal(scene.nodes,undefined);assert.equal(scene.repeat,undefined);assert.equal(scene.solution,undefined);assert.equal(envelope.sha256,hash(envelope.content));
});
test('ledger writes retry one transient EPERM at service startup and fail safely on permanent errors',async()=>{
 const realWrite=fs.writeFileSync;
 const failWith=code=>{const error=new Error('injected '+code);error.code=code;return error;};
 // One-shot EPERM on the very first session.json write: startup must recover via retry.
 let injected=0;
 fs.writeFileSync=function once(path,...rest){if(injected===0&&String(path).endsWith('session.json')){injected++;throw failWith('EPERM');}return realWrite(path,...rest);};
 syncBuiltinESMExports();
 let service;
 try{
  service=createMcpService();
  assert.equal(injected,1,'EPERM injection never fired');
  const capabilities=await service.call('a2game.list_capabilities',{});
  assert.equal(capabilities.status,'PASS_REFERENCE');
  assert.equal(JSON.parse(fs.readFileSync(join(service.directory,'session.json'),'utf8')).state,'OPEN');
 }finally{fs.writeFileSync=realWrite;syncBuiltinESMExports();}
 await service.close();
 // Permanent failure: EACCES on every write fails safely with the real code, never a TDZ ReferenceError.
 let permanent=0;
 fs.writeFileSync=function always(path,...rest){if(String(path).endsWith('session.json')){permanent++;throw failWith('EACCES');}return realWrite(path,...rest);};
 syncBuiltinESMExports();
 try{
  assert.throws(()=>createMcpService(),error=>{assert.equal(error.code,'EACCES');assert.ok(!(error instanceof ReferenceError));return true;});
  assert.ok(permanent>=2,'retry attempts never ran');
 }finally{fs.writeFileSync=realWrite;syncBuiltinESMExports();}
});
