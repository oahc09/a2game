import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {pendingGates,archivePath} from '../scripts/final-acceptance-audit.mjs';
const root=resolve(import.meta.dirname,'..');
test('P2 archives all frozen identities while reference/fixture or edited PASS flags cannot count as formal acceptance',()=>{
 const entries=JSON.parse(readFileSync(resolve(root,'project/gameplay-acceptance.json'))).cases;
 assert.equal(entries.length,37);assert.equal(entries.filter(p=>p.id.startsWith('G')).length,32);assert.equal(entries.filter(p=>p.id.startsWith('H')).length,5);
 assert.ok(entries.every(p=>pendingGates(p).includes('HUMAN_QUALITY_NOT_RUN')&&pendingGates(p).includes('INDEPENDENT_G3_NOT_RUN')));
 assert.equal(entries.filter(p=>pendingGates(p).includes('PHYSICAL_INPUT_DEFERRED')).length,10);
 assert.deepEqual(pendingGates({physical:'DEFERRED_BY_USER',humanApproval:'PASS',G3:'PASS',provenance:{kind:'independent-model'}}),['HUMAN_QUALITY_NOT_RUN','INDEPENDENT_G3_NOT_RUN','PHYSICAL_INPUT_DEFERRED']);
 for(const path of ['../project/status.json','C:/Windows/win.ini','reports/../project/status.json','https://example.com/receipt.json'])assert.throws(()=>archivePath(root,path),/A2G_E_ACCEPTANCE_PATH/);
});
