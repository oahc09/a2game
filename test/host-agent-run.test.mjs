import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initHostRun,captureHostCall,checkHostRun} from '../scripts/host-agent-run.mjs';

test('host run captures canonical bytes, verifies a same-artifact/session loop and detects rewritten evidence',()=>{
 const workspace=mkdtempSync(join(tmpdir(),'a2game-host-run-'));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const write=(p,v)=>writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));
 try{
  for(const p of ['specs/v0.1/schemas','docs','output/mcp'])mkdirSync(join(workspace,p),{recursive:true});
  write(join(workspace,'specs/v0.1/schemas/public.json'),{type:'object'});
  write(join(workspace,'docs/host-agent-pilot.md'),'Public task');
  const run=initHostRun('workbuddy',workspace).run;
  const sessionId=randomUUID(),artifactId=randomUUID(),air=randomUUID(),three=randomUUID();
  const output=join(workspace,'output/mcp',sessionId);mkdirSync(output);
  const packagePath='output/mcp/'+sessionId+'/package.json';write(join(workspace,packagePath),'{}');
  const lifecyclePath='output/mcp/'+sessionId+'/air.lifecycle.json';
  write(join(workspace,lifecyclePath),{format:'a2game-preview-lifecycle',version:1,sessionId,artifactId,previewId:air,closed:true,closeReason:'explicit'});
  const rows=[
   ['list_capabilities',{},{}],['get_capability',{},{}],
   ['validate_game',{}, {artifactId}],['test_game',{artifactId},{artifactId}],['inspect_game',{artifactId},{artifactId}],
   ['preview_game',{artifactId,backend:'air',action:'open'},{backend:'air',previewId:air}],
   ['preview_game',{previewId:air,action:'close'},{closed:true,previewId:air,closeReason:'explicit',lifecyclePath}],
   ['preview_game',{artifactId,backend:'three',action:'open'},{backend:'three',previewId:three}],
   ['preview_game',{previewId:three,action:'close'},{closed:true,previewId:three}],
   ['export_game',{artifactId},{artifactId,path:packagePath,sha256:hash('{}')}]
  ];
  let first;
  for(const [tool,parameters,data] of rows){
   const runId=randomUUID(),response={mcpToolContractVersion:1,runId,status:'PASS_REFERENCE',diagnostics:[],data:{...data,modelCalls:0}};
   write(join(output,runId+'.receipt.json'),response);
   write(join(output,runId+'.call.json'),{format:'a2game-mcp-call',version:1,sessionId,runId,tool:'a2game.'+tool,parameters,budgetConsumed:0,unknownCalls:0});
   captureHostCall(run,runId,workspace);first??=runId;
  }
  const result=checkHostRun(run,workspace);
  assert.equal(result.mcpLoopStatus,'PASS_REFERENCE');assert.equal(result.selected.artifactId,artifactId);
  assert.equal(result.browserInputAndVisual,'NOT_RUN');
  const absent=randomUUID();write(join(workspace,run,'receipt.json'),{mcpCalls:[{runId:absent}]});
  assert.deepEqual(checkHostRun(run,workspace).missingCaptures,[absent]);
  assert.equal(checkHostRun(run,workspace).mcpLoopStatus,'PARTIAL');
  write(join(workspace,run,'receipt.json'),{});
  const extraPreview=randomUUID();
  for(const [parameters,data]of [
   [{artifactId,backend:'air',action:'open'},{backend:'air',previewId:extraPreview}],
   [{previewId:extraPreview,action:'close'},{previewId:extraPreview,closed:true,closeReason:'expired',alreadyClosed:true}]
  ]){
   const runId=randomUUID();
   write(join(output,runId+'.receipt.json'),{mcpToolContractVersion:1,runId,status:'PASS_REFERENCE',diagnostics:[],data:{...data,modelCalls:0}});
   write(join(output,runId+'.call.json'),{format:'a2game-mcp-call',version:1,sessionId,runId,tool:'a2game.preview_game',parameters,budgetConsumed:0,unknownCalls:0});
   captureHostCall(run,runId,workspace);
  }
  const expired=checkHostRun(run,workspace);
  assert.equal(expired.mcpLoopStatus,'PARTIAL');
  assert.ok(expired.missing.includes('PREVIEW_EXPLICIT_CLOSE_MISSING:'+extraPreview));
  // An uncaptured call on this artifact must be discovered even if omitted from the host inventory.
  const unreported=randomUUID();
  write(join(output,unreported+'.call.json'),{format:'a2game-mcp-call',version:1,sessionId,runId:unreported,tool:'a2game.test_game',createdAt:new Date().toISOString(),parameters:{artifactId},budgetConsumed:0,unknownCalls:0});
  write(join(output,unreported+'.receipt.json'),{mcpToolContractVersion:1,runId:unreported,status:'PASS_REFERENCE',diagnostics:[],data:{artifactId,modelCalls:0}});
  assert.ok(checkHostRun(run,workspace).missingCaptures.includes(unreported));
  const unfinished=randomUUID();mkdirSync(join(workspace,run,'calls',unfinished));
  assert.ok(checkHostRun(run,workspace).incompleteCaptures.includes(unfinished));
  const different=readFileSync(join(workspace,run,'calls',first,'server-response.json'),'utf8').replace('PASS_REFERENCE','NOT_RUN');
  write(join(workspace,run,'calls',first,'server-response.json'),different);
  assert.throws(()=>checkHostRun(run,workspace),/SHA mismatch/);
  assert.throws(()=>captureHostCall(run,'../../private',workspace),/UUID/);
  const other=initHostRun('trae',workspace).run;
  assert.equal(checkHostRun(other,workspace).mcpLoopStatus,'PARTIAL');
 }finally{
  assert.ok(resolve(workspace).startsWith(resolve(tmpdir(),'a2game-host-run-')));
  rmSync(workspace,{recursive:true,force:true});
 }
});
