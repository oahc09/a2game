/** Additional headless lifecycle evidence; not a browser/resource or human quality gate. */
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {playSolution} from '../scripts/agent-solver.mjs';
const assert=(condition,label)=>{if(!condition)throw Object.assign(Error(`生命周期检查失败：${label}`),{code:'A2G_GEN_LIFECYCLE'});};
export function checkLifecycle(game,solution){
 const runtime=new HeadlessRuntime(game,makeRegistry()),checks={};
 const execute=()=>{for(const row of solution){if(row.action){runtime.injectAction({action:row.action,phase:'press',...(row.value!==undefined?{value:row.value}:{})});runtime.injectAction({action:row.action,phase:'release'});}for(const raw of row.raw??[])runtime.injectRaw(raw);runtime.step(row.ticks);}return runtime.observe();};
 try{
  runtime.start();const initial=runtime.observe();runtime.pause();const paused=runtime.observe();runtime.step(3);
  assert(runtime.observe().exactHash===paused.exactHash,'pause freeze');checks.pause='PASS';runtime.resume();
  runtime.restart();assert(runtime.observe().exactHash===initial.exactHash,'restart initial');checks.restart='PASS';
  const won=execute();assert(won.flow.status==='won','solution wins after restart');
  for(const action of game.inputs.actions.filter(a=>a.valueType==='button')){
   let rejected=false;try{runtime.injectAction({action:action.id,phase:'press'});}catch(e){rejected=e.code==='A2G_E_FLOW';}
   assert(rejected,'terminal input rejected');
  }
  runtime.step(3);assert(runtime.observe().exactHash===won.exactHash,'terminal input/tick freeze');checks.terminalFreeze='PASS';
  runtime.restart();const repeated=execute();assert(repeated.exactHash===won.exactHash,'restart replay');checks.replay='PASS';
  assert(playSolution(game,solution).final.exactHash===won.exactHash,'separate session');checks.separateSession='PASS';
  runtime.dispose();runtime.dispose();
  let rejected=false;try{runtime.step(1);}catch(e){rejected=e.code==='A2G_E_DISPOSED';}
  assert(rejected,'disposed session rejects execution');checks.dispose='PASS';
  return {status:'PASS_REFERENCE',scope:'HEADLESS_ONLY',seed:game.world.clock.seed,checks,finalHash:won.exactHash,hostResources:'NOT_RUN',humanReview:'NOT_RUN',G3:'NOT_RUN'};
 }finally{runtime.dispose();}
}
