import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {contracts} from '../integrations/mcp/contract.mjs';
import {auditHostReview} from '../scripts/audit-host-first.mjs';

test('host audit binds response ID and bytes; a direct probe cannot fill missing host evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'a2game-host-audit-'));
 mkdirSync(join(root,'reports'));
 const save=(name,data)=>{
  const text=JSON.stringify(data),file='reports/'+name;
  writeFileSync(join(root,file),text);
  return {file,sha256:createHash('sha256').update(text).digest('hex')};
 };
 try{
  const tools=save('tools.json',{tools:Object.keys(contracts).map(name=>'mcp__a2game__'+name.replaceAll('.','_'))});
  const runId='11111111-1111-4111-8111-111111111111';
  const original={mcpToolContractVersion:1,runId,status:'PASS_REFERENCE',diagnostics:[],data:{modelCalls:0}};
  const response=save('host.json',original);
  const host={host:'fixture',status:'PARTIAL',references:[],hostRunId:runId,toolEvidence:{...tools,pointer:'/tools'},hostResponse:{...response,pointer:''},serverReceipt:response};
  const review={status:'PARTIAL',hosts:[host]};
  assert.equal(auditHostReview(review,root).hosts[0].hostResponse,'ARCHIVED_RESPONSE_MATCHES');
  host.hostRunId='different-call';
  assert.throws(()=>auditHostReview(review,root),/Host response runId mismatch/);
  host.hostRunId=runId;
  host.hostResponse={...save('rewritten.json',{...original,data:{},modelCalls:0}),pointer:''};
  const rewritten=auditHostReview(review,root);
  assert.equal(rewritten.responseConsistency,'FAIL');
  assert.equal(rewritten.hosts[0].hostResponseSchema,'FAIL');
  assert.equal(rewritten.hosts[0].serverComparison,'DIFFERENT');
  host.hostResponse=null;
  host.hostRunId='different-call';
  host.probeResponse={...response,runId,channel:'DIRECT_STDIO'};
  const result=auditHostReview(review,root);
  assert.equal(result.acceptance,'PARTIAL');
  assert.equal(result.hosts[0].hostResponse,'NOT_PRESERVED');
  assert.equal(result.hosts[0].directProbe.relation,'DIFFERENT_FROM_HOST_CLAIM');
  writeFileSync(join(root,tools.file),'{}');
  assert.throws(()=>auditHostReview(review,root),/Evidence SHA mismatch/);
 }finally{
  assert.ok(root.startsWith(join(tmpdir(),'a2game-host-audit-')),'Cleanup must stay in the test temp prefix');
  rmSync(root,{recursive:true,force:true});
 }
});
