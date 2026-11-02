import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {contracts,resultSchema} from '../integrations/mcp/contract.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {setTimeout as delay} from 'node:timers/promises';
const root=resolve(import.meta.dirname,'..'),read=p=>JSON.parse(readFileSync(p,'utf8'));

test('real stdio preserves schema-rejected and unknown tools in the complete canonical run ledger',async()=>{
 const hostRunId=randomUUID(),client=new Client({name:'transport-ledger-regression',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs'),'--host-run-id',hostRunId],cwd:root,stderr:'pipe'});
 const results=[];
 try{
  await client.connect(transport);
  const listed=await client.listTools();assert.deepEqual(listed.tools.map(t=>t.name).sort(),Object.keys(contracts).sort());
  const validate=listed.tools.find(t=>t.name==='a2game.validate_game');
  assert.equal(validate.inputSchema.properties.gameJson.type,'string');assert.equal(validate.inputSchema.additionalProperties,false);
  const cases=[
   ['a2game.list_capabilities',{},null],
   ['a2game.validate_game',{gameJson:42},'A2G_MCP_ARGUMENTS'],
   ['a2game.validate_game',{gameJson:'x'.repeat(256*1024+1)},'A2G_MCP_ARGUMENTS'],
   ['a2game.list_capabilities',{path:'PRIVATE_TRANSPORT_SENTINEL'},'A2G_MCP_ARGUMENTS'],
   ['a2game.unknown_PRIVATE_TRANSPORT_SENTINEL',{},'A2G_MCP_TOOL'],
   ['a2game.list_capabilities',{extra:Array(10001).fill(0)},'A2G_MCP_SIZE'],
   ['a2game.list_capabilities',{},null]
  ];
  for(const [name,args,code]of cases){
   const response=await client.callTool({name,arguments:args}),result=resultSchema.parse(response.structuredContent);
   assert.deepEqual(JSON.parse(response.content[0].text),result);assert.equal(response.isError,!!code);
   assert.equal(result.status,code?'FAIL':'PASS_REFERENCE');if(code)assert.equal(result.diagnostics[0].code,code);
   assert.ok(!JSON.stringify(response).includes('PRIVATE_TRANSPORT_SENTINEL'));results.push(result);
  }
  // Unsupported task augmentation is rejected by the SDK capability boundary before dispatch.
  // It is not a supported tool call or a game candidate and must not execute a tool.
  await assert.rejects(client.callTool({name:'a2game.list_capabilities',arguments:{},task:{ttl:1000}}),error=>{
   assert.equal(error.code,-32603);assert.match(error.message,/does not support task creation/);return true;
  });
 }finally{await client.close();await transport.close();}
 const output=join(root,'output/mcp');
 const sessions=readdirSync(output).map(n=>join(output,n)).filter(p=>{try{return read(join(p,'session.json')).hostRunId===hostRunId;}catch{return false;}});
 assert.equal(sessions.length,1);const directory=sessions[0],session=read(join(directory,'session.json'));
 assert.equal(session.state,'CLOSED');assert.equal(session.lastSequence,results.length);
 const calls=readdirSync(directory).filter(n=>n.endsWith('.call.json')).map(n=>read(join(directory,n))).sort((a,b)=>a.sequence-b.sequence);
 assert.equal(calls.length,results.length);
 for(const [i,call]of calls.entries()){
  assert.equal(call.sequence,i+1);assert.equal(call.runId,results[i].runId);assert.equal(call.hostRunId,hostRunId);assert.equal(call.state,'COMPLETED');
  const bytes=readFileSync(join(directory,call.runId+'.receipt.json')),response=resultSchema.parse(JSON.parse(bytes));
  assert.equal(call.receiptSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(call.budgetConsumed,0);assert.equal(call.unknownCalls,0);assert.equal(response.runId,call.runId);
  assert.ok(!JSON.stringify(call).includes('PRIVATE_TRANSPORT_SENTINEL'));
 }
 assert.equal(calls[4].tool,null);assert.equal(calls.filter(c=>c.tool==='a2game.validate_game').length,2,'rejected validation calls remain budget-visible');
});

test('real stdio SIGTERM drains an in-flight preview and seals its failure receipt before process exit',{
 skip:process.platform==='win32'?'POSIX signal lifecycle regression':!existsSync(join(root,'player/vendor/sdk-provenance.json'))&&'Requires locked SDK preparation; no rendering claimed'
},async()=>{
 const hostRunId=randomUUID(),client=new Client({name:'transport-shutdown-regression',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs'),'--host-run-id',hostRunId],cwd:root,stderr:'pipe'});
 try{
  await client.connect(transport);
  const admitted=(await client.callTool({name:'a2game.validate_game',arguments:{gameJson:JSON.stringify(createFixture().game)}})).structuredContent;
  assert.equal(admitted.status,'PASS_REFERENCE');
  const directory=readdirSync(join(root,'output/mcp')).map(n=>join(root,'output/mcp',n)).find(p=>{try{return read(join(p,'session.json')).hostRunId===hostRunId;}catch{return false;}});
  assert.ok(directory);
  const pending=client.callTool({name:'a2game.preview_game',arguments:{action:'open',artifactId:admitted.data.artifactId,backend:'three'}}).catch(error=>({transportError:error.code}));
  let started;
  for(let i=0;i<100&&!started;i++){started=readdirSync(directory).filter(n=>n.endsWith('.call.json')).map(n=>read(join(directory,n))).find(c=>c.tool==='a2game.preview_game');if(!started)await delay(10);}
  assert.ok(started);assert.equal(started.state,'STARTED','signal must interrupt an active preview, not a finished call');
  const pid=transport.pid;assert.ok(pid);process.kill(pid,'SIGTERM');
  const alive=()=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
  for(let i=0;i<150&&alive();i++)await delay(100);
  assert.equal(alive(),false,'existing bounded workers must settle before shutdown completes');await pending;
  const call=read(join(directory,started.runId+'.call.json')),receipt=resultSchema.parse(read(join(directory,started.runId+'.receipt.json')));
  assert.equal(call.state,'COMPLETED');assert.equal(receipt.status,'FAIL');assert.equal(read(join(directory,'session.json')).state,'CLOSED');
  assert.equal(call.receiptSha256,createHash('sha256').update(readFileSync(join(directory,started.runId+'.receipt.json'))).digest('hex'));
  assert.equal(readdirSync(directory).filter(n=>n.includes('.lifecycle.')).length,0,'cancelled admission must not leave an opened preview');
 }finally{await client.close();await transport.close();}
});
