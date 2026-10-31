import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {generateGame,validateGameFile} from '../generator/index.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {runGeneratorWorker} from '../generator/process.mjs';
const temp=()=>mkdtempSync(join(tmpdir(),'a2game-repair-'));
const read=file=>JSON.parse(readFileSync(file,'utf8'));

test('format repair preserves the first raw bytes and sends only same-run output/diagnostics',async()=>{
 const base=temp(),configFile=join(base,'fixture.json');writeFileSync(configFile,JSON.stringify({fixtureMode:'repair-json'}));
 const result=await generateGame({prompt:'counter',configFile,outputDirectory:join(base,'out'),maxAttempts:2});
 assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));assert.equal(result.oneShot,false);assert.equal(result.repairCount,1);assert.equal(result.fixtureCalls,2);assert.equal(result.generationCalls,0);
 assert.equal(result.attempts[0].category,'GENERATION_FORMAT');
 const directory=resolve('.a2game/generator',result.runId),raw=readFileSync(join(directory,'attempt-1/response.raw.json'),'utf8');
 assert.equal(raw,'not JSON');
 const retry=read(join(directory,'attempt-2/request.json'));
 assert.equal(retry.previous.output,raw);assert.equal(retry.previous.category,'GENERATION_FORMAT');
 assert.equal(retry.previous.hints,undefined);
 assert.equal(retry.previous.history[0].code,'A2G_E_PROVIDER_JSON');
 assert.equal('authorGame' in retry,false);assert.equal(retry.previous.diagnostics.length<=20,true);
});

test('inactive-input failure sends actionable guidance and the provider repairs its own conformance',async()=>{
 const base=temp(),configFile=join(base,'http.json'),requests=[],original=createFixture();
 original.conformance.cases[0].steps.push({op:'injectAction',action:'collect',phase:'press'});
 const originalText=JSON.stringify(original),corrected=structuredClone(original);
 corrected.conformance.cases[0].steps.splice(-1,0,{op:'expectError',code:'A2G_E_FLOW'});
 const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);requests.push(JSON.parse(Buffer.concat(chunks)));res.writeHead(200,{'Content-Type':'application/json'});res.end(requests.length===1?originalText:JSON.stringify(corrected));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  writeFileSync(configFile,JSON.stringify({endpoint:`http://127.0.0.1:${server.address().port}/generate`}));
  const result=await generateGame({prompt:'counter',providerId:'http',configFile,outputDirectory:join(base,'out'),maxAttempts:2});
  assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));
  assert.equal(result.attempts[0].code,'A2G_E_AGENT_CONFORMANCE');assert.equal(requests.length,2);
  assert.equal(requests[1].previous.output,originalText);
  assert.match(requests[1].previous.diagnostics[0].message,/A2G_E_FLOW/);
  assert.match(requests[1].previous.hints[0],/expectError/);
  assert.deepEqual(read(join(base,'out/conformance.json')),corrected.conformance);
  assert.equal(result.oneShot,false);assert.equal(result.G3,'NOT_RUN');
 }finally{await new Promise(ok=>server.close(ok));server.closeAllConnections();}
});
test('repair continuation requires an explicit total ceiling, retains attempt numbering and cannot claim one-shot',async()=>{
 const base=temp(),initialPrevious={code:'A2G_E_PROVIDER_JSON',message:'Recorded same-provider failure',output:'not JSON',history:[{attempt:3,code:'A2G_E_PROVIDER_JSON'}]};
 await assert.rejects(generateGame({prompt:'counter',attemptOffset:3,maxAttempts:1,initialPrevious,outputDirectory:join(base,'blocked')}),{code:'A2G_GEN_BUDGET'});
 const r=await generateGame({prompt:'counter',attemptOffset:3,maxAttempts:1,maxTotalAttempts:4,initialPrevious,outputDirectory:join(base,'repair')});
 assert.equal(r.status,'PASS_REFERENCE');assert.equal(r.fixtureCalls,1);assert.equal(r.generationCalls,0);assert.equal(r.priorAttempts,3);assert.equal(r.totalAttemptsObserved,4);assert.equal(r.attempts[0].attempt,4);assert.equal(r.oneShot,false);assert.equal(r.repairCount,3);
});

test('full admission rejects undeclared capability, wrong version, scripts and forged acceptance',async()=>{
 const base=temp(),game=createFixture().game;
 const cases=[g=>g.requires.all.push({id:'a2game.future.teleport',version:'0.1.0'}),g=>{g.requires.all[0].version='99.0.0';},g=>{g.rules[0].do[0]={op:'eval',script:'return true;'};},g=>{g.PASS=true;}];
 for(const [i,mutate] of cases.entries()){
  const changed=structuredClone(game);mutate(changed);const file=join(base,`${i}.json`);writeFileSync(file,JSON.stringify(changed));
  assert.equal((await validateGameFile(file)).status,'FAIL');
 }
 // Provider-level forged PASS cannot substitute for executed conformance assertions.
 const output=createFixture();output.status='PASS';output.conformance.cases[0].steps.at(-1).equals='lost';
 const rawFile=join(base,'raw.json');writeFileSync(rawFile,JSON.stringify(output));
 const directory=join(base,'check');const {mkdirSync}=await import('node:fs');mkdirSync(directory);
 const result=await runGeneratorWorker('validate',{rawFile,directory,prompt:'counter'});
 const validation=JSON.parse(result.stdout).validationDirectory;
 assert.equal(read(join(validation,'summary.json')).status,'FAIL');
 assert.equal(read(join(validation,'attempt-1.json')).code,'A2G_E_AGENT_CONFORMANCE');
});

test('HTTP mock cannot silently replace a requested mechanic with a valid counter',async()=>{
 const base=temp(),configFile=join(base,'http.json'),response=JSON.stringify(createFixture());let calls=0;
 const server=createServer(async(req,res)=>{for await(const _ of req){}calls++;res.writeHead(200,{'Content-Type':'application/json'});res.end(response);});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  writeFileSync(configFile,JSON.stringify({endpoint:`http://127.0.0.1:${server.address().port}/generate`}));
  const outputDirectory=join(base,'out'),result=await generateGame({prompt:'推箱子',providerId:'http',configFile,outputDirectory,maxAttempts:1});
  assert.equal(result.status,'FAIL');assert.equal(result.code,'A2G_GEN_PLAN_GAME');assert.equal(result.category,'CAPABILITY_SEMANTICS');assert.equal(calls,1);
  assert.equal(existsSync(join(outputDirectory,'game.json')),false);assert.equal(result.G3,'NOT_RUN');
  // Dispatch accounting is retained even though this HTTP endpoint is a local test fixture.
  assert.equal(result.generationCalls,1);assert.match(createHash('sha256').update(response).digest('hex'),/^[a-f0-9]{64}$/);
 }finally{await new Promise(ok=>server.close(ok));server.closeAllConnections();}
});
