/** Public runtime contract; guidance does not change validation or repair generated output. */
export const conformanceInputGuidance='Gameplay input (injectAction/injectRaw) is rejected with A2G_E_FLOW while paused or terminal (won/lost/stopped/error). For an intentional rejection test, put {op:"expectError",code:"A2G_E_FLOW"} immediately before EACH input operation expected to fail. A terminal step does not advance; assert the state/status remains unchanged. Do not inject gameplay input after the terminal state unless explicitly testing rejection.';

/** Fixed failure categories; never relay arbitrary provider bodies as public diagnostics. */
export function classifyFailure(code='',attribution,message=''){
 if(code==='A2G_GEN_CANCELLED')return 'PROVIDER_INFRA';
 if(/PATH|OUTPUT_EXISTS|INLINE_CREDENTIAL|SECURITY|ASSET|RESOURCE|INTEGRITY/.test(code))return 'SECURITY_POLICY';
 if(/PLAN_SCHEMA|PROMPT|MODE|UNSUPPORTED|PLAN_REFERENCE|PLAN_DEPENDENCY/.test(code))return 'INPUT_SPEC';
 if(attribution==='INFRA'||/WORKER|TIMEOUT|CODEX_|PROVIDER_(?:CONFIG|START|TIMEOUT|EXIT|HTTP|SIZE|INCOMPLETE|REFUSAL)/.test(code))return 'PROVIDER_INFRA';
 if(/PROVIDER_JSON|ENVELOPE|SCHEMA|SPEC_VERSION/.test(code))return 'GENERATION_FORMAT';
 if(/CAP_|PLAN_GAME|RULE|STATE_PATH|EXPR/.test(code))return 'CAPABILITY_SEMANTICS';
 if(/CONFORMANCE|PLAYABILITY|DETERMINISM|SOLUTION|SOLVER|LIFECYCLE/.test(code)||/A2G_E_AGENT_(?:SOLUTION|PLAYABILITY)/.test(message))return 'GAMEPLAY_CONFORMANCE';
 return 'CAPABILITY_SEMANTICS';
}
export function repairFeedback(attempt,output){
 const diagnostics=(attempt.diagnostics??[]).slice(0,20).map(d=>({pointer:String(d.pointer??'').slice(0,200),message:String(d.message??'').slice(0,400)}));
 const inactiveInput=attempt.code==='A2G_E_AGENT_CONFORMANCE'&&diagnostics.some(d=>/A2G_E_FLOW: (?:Raw )?gameplay input rejected while inactive/i.test(d.message));
 return {code:attempt.code??'A2G_GEN_FAILURE',category:classifyFailure(attempt.code,attempt.attribution,attempt.message),message:String(attempt.message??'').slice(0,600),diagnostics,...(inactiveInput?{hints:[conformanceInputGuidance]}:{}),output};
}
