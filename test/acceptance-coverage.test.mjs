// Synthetic structural coverage only; no model, SDK or gameplay acceptance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {checkControllerObservations,checkSimulatedHostAcceptance,simulatedHostProfile,simulatedHostProfileSha256} from '../scripts/simulated-host-acceptance.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t,category){
 const directory=mkdtempSync(join(tmpdir(),'a2game-coverage-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 writeFileSync(join(directory,'evidence.txt'),'synthetic only');
 const observations=simulatedHostProfile.commonChecks[category].map(checkId=>({checkId,result:'PASS_REFERENCE',observation:'Synthetic structural fixture, not actual runtime observations',...(category==='inputCoverage'?{applicability:{status:'APPLICABLE'}}:{}),evidence:[{path:'evidence.txt',sha256:hash('synthetic only')}]}));
 return {observations,check:(task='G01')=>checkControllerObservations(category,observations,directory,task)};
}
function absent(observation){observation.result='NOT_APPLICABLE';observation.applicability={status:'NOT_DECLARED',reason:'Selected synthetic artifact has no contract for '+observation.checkId};}
test('profile v2 explicitly requires replay, input clearing, errors and measured performance',()=>{
 assert.equal(simulatedHostProfile.version,2);
 assert.deepEqual(simulatedHostProfile.commonChecks.replay,['second-independent-session-replay']);
 assert.deepEqual(simulatedHostProfile.commonChecks.runtimeObservations,['console-errors','page-errors','performance-measurement']);
 assert.ok(simulatedHostProfile.commonChecks.inputCoverage.includes('blur-input-clear'));
 assert.ok(simulatedHostProfile.commonChecks.inputCoverage.includes('restart-input-clear'));
 assert.ok(simulatedHostProfile.commonChecks.lifecycle.includes('restart-replay'));
 assert.ok(simulatedHostProfile.commonChecks.lifecycle.includes('pause-freeze'));
 // Immutable profile v1 SHA from the pre-change source; never upgrade its evidence.
 const version1Sha='9e3c90b2fd664e6acb93371d0539d2744967260ab4e58e37dea55798f7ec3113';
 assert.notEqual(simulatedHostProfileSha256,version1Sha);
 const old={format:'a2game-simulated-host-acceptance-batch',version:1,scope:simulatedHostProfile.scope,batchId:'old-profile',startedAt:'2026-01-01T00:00:00Z',endedAt:'2026-01-01T00:00:01Z',profileSha256:version1Sha};
 assert.throws(()=>checkSimulatedHostAcceptance(old),/PROFILE_FINGERPRINT_MISMATCH/);
});
for(const category of ['replay','inputCoverage','runtimeObservations'])test('missing '+category+' checks remain partial',t=>{
 const f=fixture(t,category);assert.equal(f.check().status,'CONTROLLER_REVIEW_RECORDED');
 const removed=f.observations.pop();assert.equal(f.check().status,'PARTIAL');assert.deepEqual(f.check().missing,[removed.checkId]);
 f.observations.length=0;assert.equal(f.check().status,'PARTIAL');
});
test('optional absent contracts are recorded as not applicable, never tested passes',t=>{
 const f=fixture(t,'inputCoverage');for(const o of f.observations.slice(0,3))absent(o);
 assert.deepEqual(f.check().notApplicable,['keyboard-hold','pointer-drag','pointer-cancel']);
 assert.equal(f.check().status,'CONTROLLER_REVIEW_RECORDED');
 assert.throws(()=>f.check('G17'),/CONTINUOUS_INPUT_REQUIRED/);
});
test('declared drag requires cancellation coverage',t=>{
 const f=fixture(t,'inputCoverage');absent(f.observations.find(x=>x.checkId==='pointer-cancel'));
 assert.throws(()=>f.check(),/POINTER_CANCEL_REQUIRED/);
});
test('no N/A without explicit absent-contract reason and bound evidence',t=>{
 const f=fixture(t,'inputCoverage'),o=f.observations[0];absent(o);
 delete o.applicability.reason;assert.throws(()=>f.check(),/NOT_DECLARED_REASON_REQUIRED/);
 absent(o);o.applicability.reason=' ';assert.throws(()=>f.check(),/NOT_DECLARED_REASON_REQUIRED/);
 absent(o);o.applicability.status='UNSUPPORTED';assert.throws(()=>f.check(),/NOT_DECLARED_REASON_REQUIRED/);
 absent(o);o.evidence=[];assert.throws(()=>f.check(),/FILES_REQUIRED/);
 o.evidence=[{path:'evidence.txt',sha256:'0'.repeat(64)}];assert.throws(()=>f.check(),/FILE_SHA_MISMATCH/);
});
test('applicable inputs require explicit declarations and failures remain visible',t=>{
 const f=fixture(t,'inputCoverage'),o=f.observations[0];delete o.applicability;assert.throws(()=>f.check(),/INPUT_APPLICABILITY_REQUIRED/);
 o.applicability={status:'APPLICABLE'};o.result='PARTIAL';assert.equal(f.check().status,'PARTIAL');
 o.result='FAIL';assert.equal(f.check().status,'FAIL');
});
for(const category of ['lifecycle','backendHash','visualReference','replay','runtimeObservations'])test(category+' cannot waive mandatory evidence via N/A',t=>{
 const f=fixture(t,category);absent(f.observations[0]);assert.throws(()=>f.check(),/MANDATORY_CHECK_NOT_APPLICABLE/);
});
for(const checkId of ['blur-input-clear','restart-input-clear'])test(checkId+' is never optional',t=>{
 const f=fixture(t,'inputCoverage');absent(f.observations.find(x=>x.checkId===checkId));assert.throws(()=>f.check(),/MANDATORY_CHECK_NOT_APPLICABLE/);
});
test('G17 supports either declared hold or declared drag without claiming the absent modality was tested',t=>{
 const drag=fixture(t,'inputCoverage');absent(drag.observations.find(x=>x.checkId==='keyboard-hold'));
 assert.equal(drag.check('G17').status,'CONTROLLER_REVIEW_RECORDED');
 const hold=fixture(t,'inputCoverage');for(const id of ['pointer-drag','pointer-cancel'])absent(hold.observations.find(x=>x.checkId===id));
 assert.equal(hold.check('G17').status,'CONTROLLER_REVIEW_RECORDED');
 hold.observations.find(x=>x.checkId==='keyboard-hold').result='PARTIAL';assert.equal(hold.check('G17').status,'PARTIAL');
});
