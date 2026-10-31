import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {auditModelEvidence} from '../scripts/audit-model-evidence.mjs';

const id='12345678-1234-1234-1234-123456789abc';
const report=calls=>({format:'a2game-generation-report',runId:id,provider:{id:'model-http',requestedModelId:'model-a'},generationCalls:calls.length,calls});
const usage={prompt_tokens:10,completion_tokens:3,total_tokens:13};
function evidence(root,n,returnedModel,raw='private-response'){
 const directory=join(root,id,'attempt-'+n);mkdirSync(directory,{recursive:true});
 writeFileSync(join(directory,'response.raw.json'),raw);
 writeFileSync(join(directory,'provider-call.json'),JSON.stringify({format:'a2game-model-call',requestedModel:'model-a',returnedModel,usage,requestId:'private-request-id',outputSha256:createHash('sha256').update(raw).digest('hex')}));
 return directory;
}

test('model evidence compares each provider-reported identity and preserves missing calls',()=>{
 const root=mkdtempSync(join(tmpdir(),'a2game-model-audit-'));evidence(root,1,'model-a');evidence(root,2,'model-b');
 const result=auditModelEvidence(report([{attempt:1,status:'RETURNED',usage},{attempt:2,status:'RETURNED',usage},{attempt:3,status:'DISPATCHED',usage:null}]),root);
 assert.equal(result.status,'PARTIAL');assert.deepEqual(result.calls.map(row=>row.identity),['PROVIDER_REPORTED_MATCH','PROVIDER_REPORTED_MISMATCH','NO_RETURN_RECORDED']);
 assert.equal(result.calls[0].responseIntegrity,'MATCH');assert.equal(result.calls[0].usageConsistent,true);
 assert.equal(auditModelEvidence(report([{attempt:2,status:'RETURNED',usage}]),root).status,'PARTIAL');
 assert.ok(!JSON.stringify(result).includes('private-response'));assert.ok(!JSON.stringify(result).includes('private-request-id'));assert.equal(result.modelCalls,0);
});

test('model evidence rejects altered response and unsafe run identifiers',()=>{
 const root=mkdtempSync(join(tmpdir(),'a2game-model-audit-')),directory=evidence(root,1,'model-a');
 writeFileSync(join(directory,'response.raw.json'),'changed');
 const result=auditModelEvidence(report([{attempt:1,status:'RETURNED',usage}]),root);
 assert.equal(result.status,'FAIL');assert.equal(result.calls[0].identity,'EVIDENCE_INCONSISTENT');assert.equal(result.calls[0].responseIntegrity,'MISMATCH');
 assert.throws(()=>auditModelEvidence({...report([]),runId:'../escape'},root),{code:'A2G_AUDIT_REPORT'});
});
