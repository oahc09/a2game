import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationStatus} from '../scripts/verify-workspace.mjs';

test('failed full verification does not promote earlier schema or conformance receipts',()=>{
 const previous={status:'PASS',log:'old.log',conformanceReceipt:'old-conformance.json',schema:{documents:360},conformance:{pass:203}};
 const failed=verificationStatus(previous,{exitCode:1,log:'ℹ tests 156\nℹ pass 155',logPath:'failed.log'});
 assert.equal(failed.status,'FAIL');
 assert.deepEqual(failed.nodeTests,{pass:155,total:156});
 assert.deepEqual(failed.schema,{status:'NOT_CONFIRMED'});
 assert.deepEqual(failed.conformance,{status:'NOT_CONFIRMED'});
 assert.equal(failed.conformanceReceipt,undefined);
 const passed=verificationStatus(previous,{exitCode:0,log:'ℹ tests 156\nℹ pass 156',logPath:'passed.log',conformancePath:'new-conformance.json',schema:{schemas:7,documents:360},conformance:{suites:[{pass:2,cases:[{},{}]}]}});
 assert.equal(passed.status,'PASS');
 assert.equal(passed.conformanceReceipt,'new-conformance.json');
 assert.deepEqual(passed.conformance,{pass:2,total:2,suites:1});
});
