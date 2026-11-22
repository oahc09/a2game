import {conformanceInputGuidance} from './diagnostics.mjs';
/** Public context only. Keep envelope and solution types explicit across native overlays. */
export async function buildNativeContext(prompt,attempt=1,previous){
 const [{buildAgentRequest},{withCodexHostProfile},{withNativeDelivery}]=await Promise.all([
  import('../scripts/agent-workflow.mjs'),import('./adapters/codex-generator.mjs'),import('../scripts/g3-native-contract.mjs')
 ]);
 const base=buildAgentRequest(prompt,attempt,previous),request=withNativeDelivery(withCodexHostProfile(base));
 request.constraints={...request.constraints,referenceHostConformance:conformanceInputGuidance};
 request.outputContract.required=['format','version','game','conformance','provenance','solution'];
 request.outputContract.solution='Required array of at most 256 {action?,value?,raw?,ticks} rows; ticks is an integer >=1, total <=12000. The executor starts the game and translates action into press+release, then advances ticks. This is NOT Conformance {seed,steps}; no start/injectAction/step op objects here. The model must propose the winning actions; no implicit host solver.';
 request.outputContract.solutionSchema={type:'array',maxItems:256,items:{type:'object',additionalProperties:false,required:['ticks'],properties:{action:{type:'string'},value:{},raw:{type:'array',maxItems:64},ticks:{type:'integer',minimum:1,maximum:12000}}}};
 return request;
}
