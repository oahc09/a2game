/** Run focused per-game contracts; full DoD/G3/device acceptance is deliberately separate. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry} from './registry.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const contract=read('project/gameplay-acceptance.json'),candidates=read('project/game-candidates.json').cases,variants=read('project/rule-variants.json').cases;
const runId='gameplay-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory='reports/'+runId;
mkdirSync(directory);const results=[];
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const fingerprints=Object.fromEntries(['scripts/gameplay-acceptance.mjs','scripts/registry.mjs','project/gameplay-acceptance.json','project/game-candidates.json','project/rule-variants.json',...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('specs/v0.1/games'),...files('specs/v0.1/capabilities'),...files('specs/v0.1/schemas')].map(p=>[p,hash(p)]));
writeFileSync(directory+'/fingerprints.json',JSON.stringify(fingerprints,null,2)+'\n');
function checkState(observation,expected,checks=[]){
 assert.equal(observation.flow.status,expected);
 for(const c of checks){const value=c.path.split('/').slice(1).reduce((o,key)=>o?.[key],observation.state);assert.deepEqual(value,c.equals,c.path);}
}
function execute(r,rows){
 const hashes=[];
 for(const row of rows){
  if(row.pause)r.pause();
  if(row.action){r.injectAction({action:row.action,phase:'press',...(row.value===undefined?{}:{value:row.value})});r.injectAction({action:row.action,phase:'release'});}
  for(const action of row.actions??[])r.injectAction(action);
  for(const raw of row.raw??[])r.injectRaw(raw);
  r.step(row.ticks??1);
  if(row.resume)r.resume();
  const observation=r.observe();for(const check of row.checks??[])checkState(observation,observation.flow.status,[check]);hashes.push(observation.exactHash);
 }
 return {hashes,final:r.observe()};
}
for(const entry of contract.cases){
 const recipe=candidates.find(r=>r.id===entry.id),variant=variants.find(r=>r.id===entry.id);
 const result={id:entry.id,status:'FAIL',definitionSha256:sha256Canonical(read(entry.game)),variantSha256:sha256Canonical(read(entry.variant)),boundarySha256:sha256Canonical(entry.boundary),scenarios:[]};
 try{
  for(const [name,file,rows,expected,checks] of [
   ['positive',entry.game,recipe.steps,recipe.expected,recipe.checks],['negative',entry.game,recipe.negative,recipe.negativeExpected,recipe.negativeChecks],
   ['boundary',entry.game,entry.boundary.steps,entry.boundary.expected,entry.boundary.checks],
   ['variant-positive',entry.variant,variant.steps,variant.expected,variant.checks],['variant-negative',entry.variant,variant.negative,variant.negativeExpected,variant.negativeChecks],
   ...(entry.additionalScenarios??[]).map(s=>[s.name,entry.game,s.steps,s.expected,s.checks])
  ]){
   const r=new HeadlessRuntime(read(file),makeRegistry());r.start();
   try{
    const initial=r.observe();r.pause();r.step(10);assert.equal(r.observe().tickIndex,initial.tickIndex);assert.deepEqual(r.observe().state,initial.state);
    assert.throws(()=>r.injectAction({action:read(file).inputs.actions[0].id,phase:'press'}),e=>e.code==='A2G_E_FLOW');r.resume();
    const first=execute(r,rows);checkState(first.final,expected,checks);
    if(expected!=='playing')assert.throws(()=>r.injectAction({action:read(file).inputs.actions[0].id,phase:'press'}),e=>e.code==='A2G_E_FLOW');
    const saved=r.snapshot();r.step(10);if(expected!=='playing')assert.equal(r.observe().exactHash,first.final.exactHash);r.restore(saved);assert.equal(r.observe().exactHash,first.final.exactHash);
    r.restart();assert.equal(r.observe().exactHash,initial.exactHash);const replay=execute(r,rows);assert.deepEqual(replay.hashes,first.hashes);
    result.scenarios.push({name,status:'PASS',checkpoints:first.hashes,final:first.final,pausedInput:'REJECTED',snapshotRestore:'PASS',restartReplay:'PASS',terminalFreeze:expected==='playing'?'NOT_APPLICABLE':'PASS'});
   }finally{r.dispose();}
  }
  result.status='PASS';
 }catch(e){result.error=String(e);result.stack=e.stack;}
 results.push(result);console.log(result.status,entry.id,result.error??'');
 writeFileSync(directory+'/'+entry.id+'.json',JSON.stringify(result,null,2)+'\n');
}
const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h);
const status=unchanged&&results.length===37&&results.every(r=>r.status==='PASS')?'PASS':'FAIL';
writeFileSync(directory+'/summary.json',JSON.stringify({format:'a2game-per-game-headless',runId,status,unchanged,fingerprints:directory+'/fingerprints.json',scope:contract.scope,contractSha256:sha256Canonical(contract),runnerSha256:createHash('sha256').update(readFileSync('scripts/gameplay-acceptance.mjs')).digest('hex'),cases:results.map(r=>({id:r.id,status:r.status,receipt:directory+'/'+r.id+'.json'})),scenarioCount:results.reduce((s,r)=>s+r.scenarios.length,0),fullAcceptance:'PARTIAL',independentG3:'NOT_RUN',physical:'DEFERRED_BY_USER'},null,2)+'\n');
console.log(status,directory+'/summary.json');if(status!=='PASS')process.exitCode=1;
