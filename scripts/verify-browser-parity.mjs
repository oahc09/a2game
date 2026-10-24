import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {HeadlessRuntime,replayNormalizedInputTrace} from '../dist/index.js';
import {makeRegistry,readJson,root,spec} from './registry.mjs';
const report=readJson(resolve(root,'reports/browser-core-smoke.json'));
const results=[];
for(const cas of report.cases){
 const game=readJson(resolve(spec,`samples/games/${cas.game}.game.json`));
 const runtime=new HeadlessRuntime(game,makeRegistry());
 if(cas.inputMode==='trace-replay'){
  const trace=readJson(resolve(spec,'samples/tests/grid-push-swipe.input-trace.json'));
  replayNormalizedInputTrace(runtime,trace);
 }else{
  runtime.start();
  for(const action of cas.game==='tap-target'?['collect','collect']:cas.game==='grid-push'?['moveRight','moveUp']:['moveLeft']){
   runtime.injectAction({action,phase:'press',sourceId:`test:${action}`});
   runtime.injectAction({action,phase:'release',sourceId:`test:${action}`});
   runtime.step(1);
  }
 }
 const nodeHash=runtime.observe().exactHash;
 const pass=nodeHash===cas.observation.finalHash;
 results.push({game:cas.game,scenario:cas.scenario ?? cas.game,inputMode:cas.inputMode,status:pass?'PASS':'FAIL',nodeHash,browserHash:cas.observation.finalHash});
 runtime.dispose();
}
const result={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',scope:'Node ↔ Chromium Headless exact state hash parity for 4 bundled games and 5 scenarios (including Touch trace)',cases:results};
writeFileSync(resolve(root,'reports/browser-node-parity.json'),JSON.stringify(result,null,2)+'\n');
for(const e of results)console.log(e.status,e.scenario,e.nodeHash);
if(result.status!=='PASS')process.exitCode=1;
