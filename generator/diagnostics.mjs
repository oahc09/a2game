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
 const diagnostics=(attempt.diagnostics??[]).slice(0,20).map(d=>({...d,pointer:String(d.jsonPointer??d.pointer??'').slice(0,200),message:String(d.message??'').slice(0,400)}));
 const inactiveInput=attempt.code==='A2G_E_AGENT_CONFORMANCE'&&diagnostics.some(d=>d.code==='A2G_E_FLOW'||/A2G_E_FLOW: (?:Raw )?gameplay input rejected while inactive/i.test(d.message));
 const selectedHints=[...(inactiveInput?[conformanceInputGuidance]:[]),...new Set(diagnostics.filter(d=>['input.hold-without-press','conformance.loss-status-mismatch','conformance.expect-error-code','conformance.expect-error-order'].includes(d.ruleId)).map(d=>mechanismHints[d.ruleId]))];
 return {code:attempt.code??'A2G_GEN_FAILURE',category:classifyFailure(attempt.code,attempt.attribution,attempt.message),message:String(attempt.message??'').slice(0,600),diagnostics,...(selectedHints.length?{hints:selectedHints}:{}),output};
}

// Public diagnostics never echo exception stacks, provider bodies, credentials or arbitrary objects.
// Only local validators produce these fields; CLI and MCP use this same projection.
const safeCode=value=>typeof value==='string'&&(/^A2G_[A-Z0-9_]{1,80}$/.test(value)||value==='ENOENT')?value:'A2G_GEN_FAILURE';
const stages=new Set(['parse','schema','semantic','conformance','solution','lifecycle','policy','integrity','infra','arguments','budget','preview']);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(value)?value:undefined;
const publicValues=new Set(['null','boolean','number','integer','string','array','object','playing','won','lost','stopped','error','paused','running','idle','NO_ERROR','2d','3d','rh-y-up','meter','button','axis1','vec2','vec3','pose','press','release','a2game','a2game-conformance']);
const scalar=value=>value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.length<=80&&(publicValues.has(value)||/^\d+\.\d+\.\d+$/.test(value)||/^A2G_[A-Z0-9_]+$/.test(value))?value:undefined;
export function diagnosticStage(code,stage){
 if(stages.has(stage))return stage;
 if(/JSON|PARSE/.test(code))return 'parse';if(/SCHEMA/.test(code))return 'schema';
 if(/CONFORMANCE|ASSERT/.test(code))return 'conformance';if(/SOLUTION|SOLVER|PLAYABILITY/.test(code))return 'solution';
 if(/LIFECYCLE/.test(code))return 'lifecycle';if(/INTEGRITY/.test(code))return 'integrity';
 if(/PATH|ASSET|RESOURCE|SECURITY/.test(code))return 'policy';if(/BUDGET/.test(code))return 'budget';
 if(/ARGUMENT|CONFIG/.test(code))return 'arguments';if(/SDK|PREVIEW/.test(code))return 'preview';
 if(/WORKER|PROVIDER|TIMEOUT|CANCEL|UNAVAILABLE|RELEASE_STORE|ENOENT/.test(code))return 'infra';return 'semantic';
}
const hints={parse:'Provide one UTF-8 JSON value without duplicate keys or non-finite numbers.',schema:'Read the versioned Schema resource and correct the field at jsonPointer; preserve protocol 0.1.0.',semantic:'Check the referenced capability, state path and rule against the registered contract.',conformance:'Fix the named case/step; retain a real success and a meaningful negative case. Use expectError immediately before each intentional rejected input.',solution:'Supply a bounded winning input trace for this exact game; do not replace the game or use a reference answer.',lifecycle:'Check pause, restart, terminal-input rejection and deterministic replay without weakening assertions.',policy:'Use only approved content resources and session-issued identifiers; do not supply paths or commands.',integrity:'Revalidate the original unchanged content to create a new artifact.',infra:'Check the local runtime, Python/SDK setup or timeout; do not change models or claim validation passed.',arguments:'Use the listed tool schema and supported launch options; do not pass paths or credentials.',budget:'Generation requires separate explicit authorization and a configured budget; author JSON in the host for the no-provider path.',preview:'Prepare the locked SDKs and inspect the local preview lifecycle; a URL is not gameplay evidence.'};
// Exact allowlisted coverage IDs select static guidance, never caller/provider repair text.
const coverageHints={
 'conformance.minimum-cases':'Provide at least two Conformance cases, including real success and negative-state assertions; do not weaken gameplay checks.',
 'conformance.win-assertion':'Include an explicit assert at observation path /flow/status with equals won after a real winning playthrough. /status is not the Runtime observation path.',
 'conformance.negative-assertion':'Include an explicit assert at observation path /flow/status with equals playing or lost in a meaningful negative case. Game state observations use /state/<field>.'
};
// Mechanism guidance is selected by exact trusted rule ID, never exception text.
const codeHints={A2G_MCP_READABILITY_BINDING:'Use an active preview from this same service session and artifact, matching backend and exact raw game SHA. Reopen closed/expired previews; a revised candidate requires its own preview and fresh real viewport measurement. Do not relabel old observations or treat caller-reported values as visual acceptance.'};
const mechanismHints={
 'conformance.expect-error-code':'The expectError step requires a string code for the error expected from the immediately following operation. Paused or terminal gameplay input is rejected with A2G_E_FLOW. Use the correct public error contract; never remove the negative check just to pass.',
 'conformance.expect-error-order':'Put one expectError with its code immediately before each intentionally rejected operation. Do not nest expectError steps or leave one at the end without an operation. An operation that succeeds when an error was expected must still fail the test.',
 'input.hold-without-press':'A hold was ignored because its action/sourceId had no active press when consumed. Send press first with the same sourceId, then hold on later ticks, then release/cancel. Raw held keyboard input should use down/up with config.hold:true. Do not replace a needed press with hold.',
 'conformance.loss-status-mismatch':'This case explicitly asserted /flow/status equals lost, but execution reached a different status. Check the loss trigger, outcome condition/priority and input timing; preserve the intended losing scenario. A playing negative case is valid for games without a loss condition; do not invent a loss requirement for every game.',
 'puzzle.selected-array':'Use a selected array of at most two nonnegative integer cell indices in the configured puzzle state; an empty selection is []. Preserve the puzzle rules.',
 'puzzle.board-dimensions':'Provide the configured puzzle state board as an array of nonnegative integer tiles. For grid puzzles its length must equal config.width * config.height; check the dimensions and statePath together.',
 'defense.required-state':'Provide the complete tower-defense initial state at config.statePath: wallet, score, lives, nextId, selected, waveCursor, towers, weapons, enemies, bodies, shots, won and lost. Match the required integer, array and boolean types; preserve ownership and bounds.',
 'defense.action-index':'Set each tower-defense action index to an integer from zero through cells.length - 1, referencing an existing placement cell. Do not weaken the cell bounds.',
 'presentation.scene2d-dependency':'Declare a2game.visual.scene2d at version 0.1.0 in requires.all when using presentation.scene2d. Keep the scene and its registered dependency consistent.',
 'presentation.body-style-dependency':'Declare a2game.visual.body-style at version 0.1.0 in requires.all when using bodyLayer circleKinds, valuePalette or showValues; retain the registered visual dependency.'
};
export function publicDiagnostics(error={},fallbackStage){
 const code=safeCode(error.code),stage=diagnosticStage(code,error.stage??fallbackStage);
 const source=Array.isArray(error.diagnostics)&&error.diagnostics.length?error.diagnostics.slice(0,20):[error.info??{}];
 return source.map(item=>{
  const row=item&&typeof item==='object'?item:{},rowCode=safeCode(row.code??code),rowStage=diagnosticStage(rowCode,row.stage??stage);
  const out={code:rowCode,stage:rowStage,message:`${rowCode}: ${rowStage} validation did not complete.`,repairHint:Object.hasOwn(codeHints,rowCode)?codeHints[rowCode]:Object.hasOwn(mechanismHints,row.ruleId)?mechanismHints[row.ruleId]:rowStage==='conformance'&&Object.hasOwn(coverageHints,row.ruleId)?coverageHints[row.ruleId]:hints[rowStage]};
  const pointer=row.jsonPointer??row.pointer;
  if(typeof pointer==='string'&&pointer.length<=256&&(pointer===''||pointer.startsWith('/'))&&!/[\u0000-\u001f]/.test(pointer))out.jsonPointer=pointer;
  for(const key of ['capabilityId','ruleId','caseId']){const value=identifier(row[key]);if(value!==undefined)out[key]=value;}
  for(const key of ['expected','actual'])if(Object.hasOwn(row,key)){const value=scalar(row[key]);if(value!==undefined)out[key]=value;}
  return out;
 });
}
