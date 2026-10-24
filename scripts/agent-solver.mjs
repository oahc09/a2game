import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry} from './registry.mjs';
/** Strategy/tooling only. It never implements gameplay and never labels search exhaustion as unsolvable. */
export function solveButtons(game,{maxNodes=256,maxDepth=8,actions}={}){
 if(!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>1024||!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>16)throw Error('Invalid solver budget');
 const choices=actions??game.inputs.actions.filter(a=>a.valueType==='button').map(a=>a.id);if(choices.length>64||choices.some(id=>!game.inputs.actions.some(a=>a.id===id&&a.valueType==='button')))throw Error('Invalid solver action set');
 const started=performance.now(),runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();const queue=[{snapshot:runtime.snapshot(),solution:[]}],seen=new Set();let expanded=0,rejected=0;
 try{for(let cursor=0;cursor<queue.length&&expanded<maxNodes;cursor++){
  const node=queue[cursor];runtime.restore(node.snapshot);if(runtime.status==='won')return {status:'SOLVED',solution:node.solution,expanded,rejected,elapsedMs:performance.now()-started,depth:node.solution.length};
  if(node.solution.length>=maxDepth||runtime.status!=='playing')continue;expanded++;
  for(const action of choices){runtime.restore(node.snapshot);try{runtime.injectAction({action,phase:'press'});runtime.injectAction({action,phase:'release'});runtime.step(1);const observation=runtime.observe();if(observation.flow.status==='won')return {status:'SOLVED',solution:[...node.solution,{action,ticks:1}],expanded,rejected,elapsedMs:performance.now()-started,depth:node.solution.length+1};if(observation.flow.status!=='playing')continue;const snap=runtime.snapshot(),key=sha256Canonical({state:snap.state,entities:snap.entities,rng:snap.rng,timers:snap.timers,deferred:snap.deferred,activePointers:snap.activePointers,pressedSources:snap.pressedSources,tickIndex:snap.tickIndex});if(seen.has(key))continue;seen.add(key);if(queue.length<maxNodes)queue.push({snapshot:snap,solution:[...node.solution,{action,ticks:1}]});}catch{rejected++;}}
 }return {status:'BUDGET_EXHAUSTED',solution:null,expanded,rejected,elapsedMs:performance.now()-started,depth:maxDepth};}finally{runtime.dispose();}
}
/** Provider-proposed playthrough goes through public Runtime APIs, with a fixed total Tick budget. */
export function playSolution(game,solution,{maxTicks=12000}={}){
 if(!Array.isArray(solution)||solution.length>256)throw Error('A2G_E_AGENT_SOLUTION: Expected at most 256 steps');
 const runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();const trace=[];let ticks=0;
 try{for(const [index,row] of solution.entries()){
  if(!row||typeof row!=='object'||Object.keys(row).some(key=>!['action','value','raw','ticks'].includes(key))||!Number.isInteger(row.ticks)||row.ticks<1||(ticks+=row.ticks)>maxTicks)throw Error('A2G_E_AGENT_SOLUTION: Invalid playthrough budget');
  if(row.action){runtime.injectAction({action:row.action,phase:'press',...(row.value!==undefined?{value:row.value}:{})});runtime.injectAction({action:row.action,phase:'release'});}
  if(row.raw){if(!Array.isArray(row.raw)||row.raw.length>64)throw Error('Invalid raw batch');for(const input of row.raw)runtime.injectRaw(input);}
  runtime.step(row.ticks);const state=runtime.observe();trace.push({index,tickIndex:state.tickIndex,status:state.flow.status,hash:state.exactHash});
 }const final=runtime.observe();if(final.flow.status!=='won')throw Error('A2G_E_AGENT_PLAYABILITY: Proposed solution does not win');return {status:'PASS',final,trace,requestedTicks:ticks,actionCount:solution.filter(row=>row.action).length};
 }finally{runtime.dispose();}
}
