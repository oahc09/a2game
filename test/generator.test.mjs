import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateGame,validateGameFile,testGeneratedDirectory,probeProvider} from '../generator/index.mjs';
import {runGeneratorWorker} from '../generator/process.mjs';
const temp=()=>mkdtempSync(join(tmpdir(),'a2game-generator-test-'));
test('fixture completes existing gates, exports no prompts and independently retests',async()=>{
 const base=temp(),outputDirectory=join(base,'game');
 const result=await generateGame({prompt:'A deterministic three-click counter.',providerId:'fixture',outputDirectory});
 assert.equal(result.status,'PASS_REFERENCE');assert.equal(result.provenance,'DEMO_FIXTURE');assert.equal(result.generationCalls,0);assert.equal(result.fixtureCalls,1);assert.equal(result.G3,'NOT_RUN');
 assert.equal((await validateGameFile(join(outputDirectory,'game.json'))).status,'PASS_REFERENCE');
 assert.equal((await testGeneratedDirectory(outputDirectory)).status,'PASS_REFERENCE');
 assert.equal(existsSync(join(outputDirectory,'request.json')),false);
 await assert.rejects(generateGame({prompt:'Counter',outputDirectory}),{code:'A2G_GEN_OUTPUT_EXISTS'});
 await assert.rejects(generateGame({prompt:'Counter',outputDirectory:base+'/bad/../escape'}),{code:'A2G_GEN_PATH'});
 // Duplicate keys must survive retest composition and be rejected by the strict parser.
 const file=join(outputDirectory,'game.json');writeFileSync(file,readFileSync(file,'utf8').replace('{','{"id":"duplicate",'));
 assert.equal((await testGeneratedDirectory(outputDirectory)).status,'FAIL');
});
test('invalid replies exhaust explicit attempts; provider configuration never falls back',async()=>{
 const base=temp(),configFile=join(base,'fixture.json');writeFileSync(configFile,JSON.stringify({fixtureMode:'invalid-json'}));
 const result=await generateGame({prompt:'Counter',configFile,outputDirectory:join(base,'output'),maxAttempts:2});
 assert.equal(result.status,'FAIL');assert.equal(result.fixtureCalls,2);assert.equal(result.repairCount,1);
 assert.equal((await probeProvider({id:'model-http'})).status,'BLOCKED');
 writeFileSync(configFile,JSON.stringify({token:'never-log-this'}));
 const probe=await probeProvider({id:'http',configFile});assert.equal(probe.code,'A2G_GEN_INLINE_CREDENTIAL');assert.equal(JSON.stringify(probe).includes('never-log-this'),false);
});
test('owned workers stop on cancellation and deadline',async()=>{
 const base=temp(),configFile=join(base,'stall.json');writeFileSync(configFile,JSON.stringify({fixtureMode:'stall'}));
 const payload={providerId:'fixture',configFile,request:{},directory:base};
 await assert.rejects(runGeneratorWorker('generate',payload,{timeoutMs:100}),{code:'A2G_GEN_TIMEOUT'});
 const controller=new AbortController(),pending=runGeneratorWorker('generate',payload,{signal:controller.signal});setTimeout(()=>controller.abort(),100);
 await assert.rejects(pending,{code:'A2G_GEN_CANCELLED'});
});
