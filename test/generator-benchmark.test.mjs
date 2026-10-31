import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareGeneratorBenchmark,runGeneratorBenchmark} from '../scripts/generator-benchmark.mjs';
import {createServer} from 'node:http';
import {createFixture} from '../generator/fixture.mjs';
test('benchmark preparation freezes ten comparable public contexts and cannot spend default/fixture budget',async()=>{
 const base=mkdtempSync(join(tmpdir(),'a2game-bench-')),result=await prepareGeneratorBenchmark({outputDirectory:join(base,'plan')});
 assert.equal(result.plan.cells.length,10);assert.equal(result.plan.generationCalls,0);assert.equal(result.plan.authorizedCalls,0);
 for(const id of ['G01','G03','G17','G21','H01']){
  const [direct,planned]=result.plan.cells.filter(c=>c.taskId===id);assert.equal(direct.promptSha256,planned.promptSha256);
  const a=JSON.parse(readFileSync(join(result.directory,direct.context),'utf8')),b=JSON.parse(readFileSync(join(result.directory,planned.context),'utf8'));
  assert.deepEqual(a.capabilities,b.capabilities);assert.equal(a.gamePlan,undefined);assert.equal(b.gamePlan.format,'a2game-game-plan');
  assert.equal('reference' in a,false);assert.equal('solution' in a,false);assert.equal('game' in a,false);
 }
 await assert.rejects(runGeneratorBenchmark({providerId:'codex',maxCalls:0}),{code:'A2G_GEN_BENCH_BUDGET'});
 await assert.rejects(runGeneratorBenchmark({providerId:'fixture',maxCalls:1}),{code:'A2G_GEN_BENCH_BUDGET'});
});
test('explicit one-call local HTTP mock budget leaves nine cells NOT_RUN and rejects mechanic substitution',async()=>{
 const base=mkdtempSync(join(tmpdir(),'a2game-bench-budget-'));let calls=0;
 const server=createServer(async(req,res)=>{for await(const _ of req){}calls++;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(createFixture()));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const configFile=join(base,'http.json');writeFileSync(configFile,JSON.stringify({endpoint:`http://127.0.0.1:${server.address().port}/mock`}));
  const report=await runGeneratorBenchmark({providerId:'http',configFile,maxCalls:1,maxAttempts:1,outputDirectory:join(base,'plan')});
  assert.equal(calls,1);assert.equal(report.generationCalls,1);assert.equal(report.budgetConsumed,1);assert.equal(report.engineeringPassed,0);assert.equal(report.status,'PARTIAL');
  assert.equal(report.cells[0].code,'A2G_GEN_PLAN_GAME');assert.equal(report.cells.filter(c=>c.status==='NOT_RUN').length,9);assert.equal(report.G3,'NOT_RUN');
  const resumeFile=join(base,'resume.json');writeFileSync(resumeFile,JSON.stringify({format:'a2game-benchmark-resume',version:1,cells:[{id:'G01-direct-json',generationCalls:3},{id:'G01-game-plan',generationCalls:3}]}));
  const resumed=await runGeneratorBenchmark({providerId:'http',configFile,maxCalls:6,resumeFile,outputDirectory:join(base,'resumed')});
  assert.equal(calls,1);assert.equal(resumed.generationCalls,6);assert.equal(resumed.budgetConsumed,6);assert.equal(resumed.cells.filter(c=>c.status==='NOT_RUN').length,8);
 }finally{await new Promise(ok=>server.close(ok));server.closeAllConnections();}
});
