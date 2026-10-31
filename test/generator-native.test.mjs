import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildNativeContext,admitNativeGeneration} from '../generator/index.mjs';
test('native context keeps root format/version and an executable solution array explicit',async()=>{
 const request=await buildNativeContext('Generate a new keyboard puzzle.');
 assert.equal(request.outputContract.format,'a2game-generation-output');
 for(const key of ['format','version','game','conformance','solution','provenance'])assert.ok(request.outputContract.required.includes(key));
 assert.equal(request.outputContract.solutionSchema.type,'array');
 assert.deepEqual(request.outputContract.solutionSchema.items.required,['ticks']);
 assert.equal(request.outputContract.solutionSchema.items.additionalProperties,false);
 assert.match(request.outputContract.solution,/NOT Conformance/);
 assert.match(request.constraints.referenceHostConformance,/expectError/);
});
test('native import rejects altered bytes before creating an output or invoking validation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'a2game-native-binding-'));
 const contextFile=join(directory,'context.json'),rawFile=join(directory,'raw.json'),hostRecordFile=join(directory,'host.json'),outputDirectory=join(directory,'output');
 writeFileSync(contextFile,JSON.stringify({format:'a2game-generation-request',prompt:'Counter'}));writeFileSync(rawFile,'{}');
 writeFileSync(hostRecordFile,JSON.stringify({format:'a2game-native-host-export',version:1,contextSha256:'0'.repeat(64),replySha256:'0'.repeat(64)}));
 await assert.rejects(admitNativeGeneration({contextFile,rawFile,hostRecordFile,outputDirectory}),{code:'A2G_GEN_NATIVE_BINDING'});
 assert.equal(existsSync(outputDirectory),false);
});
