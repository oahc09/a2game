import { fail } from './errors.js';
import type { HeadlessRuntime } from './runtime.js';
import type { JsonRecord, NormalizedRawInput } from './types.js';
import { isRecord, safeInteger, validateJsonTree } from './utils.js';

/** Replay already-normalized samples. Does not access device sensors or request permissions. */
export interface InputTraceReceipt {
    advanced: number;
    finalHash: string;
    finalStatus: string;
    consumed: number;
}
export function replayNormalizedInputTrace(runtime:HeadlessRuntime, raw:unknown):InputTraceReceipt {
    validateJsonTree(raw);
    if(!isRecord(raw)||raw.format!=='a2game-input-trace'||raw.traceVersion!=='0.1.0'||!isRecord(raw.session)||!Array.isArray(raw.events))
        fail('A2G_E_INPUT_RAW','Invalid InputTrace envelope');
    const def=runtime.plan.definition,session=raw.session;
    if(session.gameId!==def.id||session.gameRevision!==def.revision||session.tickHz!==def.world.clock.tickHz||session.seed!==def.world.clock.seed||session.coordinateProfile!=='viewport-top-left-v1')
        fail('A2G_E_INPUT_RAW','InputTrace does not match GameSpec snapshot/profile');
    if(!['0.1.0'].includes(String(session.inputNormalizerVersion)))fail('A2G_E_INPUT_RAW','Unsupported input normalizer version');
    if(runtime.status!=='ready'||runtime.observe().tickIndex!==0)fail('A2G_E_FLOW','InputTrace replay requires an unstarted Session');
    if(raw.events.length>4096)fail('A2G_E_BUDGET_EXCEEDED','Trace event budget exceeded');
    let lastTick=0,lastSeq=-1;
    const inputs:NormalizedRawInput[]=[];
    for(const event of raw.events){
        if(!isRecord(event)||!safeInteger(event.tickIndex)||event.tickIndex<0||event.tickIndex>100000||
            !safeInteger(event.seq)||event.seq<0||!safeInteger(event.timeUs)||event.timeUs<0||
            !['pointer','keyboard','imu'].includes(String(event.source))||typeof event.kind!=='string'||!isRecord(event.payload))
            fail('A2G_E_INPUT_RAW','Invalid InputTrace event');
        if(event.tickIndex<lastTick||(event.tickIndex===lastTick&&event.seq<=lastSeq))fail('A2G_E_INPUT_RAW','Trace tick/seq order must be strictly increasing');
        const beginUs=event.tickIndex*1000000/def.world.clock.tickHz, endUs=(event.tickIndex+1)*1000000/def.world.clock.tickHz;
        if(event.timeUs<beginUs || event.timeUs>=endUs)fail('A2G_E_INPUT_RAW','Trace event timeUs lies outside its assigned tick');
        lastTick=event.tickIndex;lastSeq=event.seq;
        inputs.push({source:event.source as string,kind:event.kind,tickIndex:event.tickIndex,seq:event.seq,timeUs:event.timeUs,payload:event.payload as JsonRecord});
    }
    // All format and game binding checks complete before any Runtime mutation.
    runtime.start();
    for(const input of inputs)runtime.injectRaw(input);
    const requested=inputs.length ? Math.min(100001,lastTick+1):1;
    let advanced=0;
    while(advanced<requested){
        const report=runtime.step(Math.min(100000,requested-advanced));
        advanced+=report.advanced;
        if(report.advanced===0)break;
    }
    const obs=runtime.observe();
    return {advanced,finalHash:obs.exactHash,finalStatus:obs.flow.status,consumed:inputs.length};
}
