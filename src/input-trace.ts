import { fail } from './errors.js';
import type { HeadlessRuntime } from './runtime.js';
import type { JsonRecord, NormalizedRawInput } from './types.js';
import { isRecord, safeInteger, safeFinite, validateJsonTree } from './utils.js';

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
            !['pointer','keyboard','imu','gamepad','action','system'].includes(String(event.source))||typeof event.kind!=='string'||!isRecord(event.payload))
            fail('A2G_E_INPUT_RAW','Invalid InputTrace event');
        if(event.tickIndex<lastTick||(event.tickIndex===lastTick&&event.seq<=lastSeq))fail('A2G_E_INPUT_RAW','Trace tick/seq order must be strictly increasing');
        const beginUs=event.tickIndex*1000000/def.world.clock.tickHz, endUs=(event.tickIndex+1)*1000000/def.world.clock.tickHz;
        if(event.timeUs<beginUs || event.timeUs>=endUs)fail('A2G_E_INPUT_RAW','Trace event timeUs lies outside its assigned tick');
        lastTick=event.tickIndex;lastSeq=event.seq;
        if(event.source==='system'&&!['pause','resume','checkpoint'].includes(event.kind))fail('A2G_E_INPUT_RAW','Unknown trace system control');
        if(event.source==='action'){
            const payload=event.payload,action=def.inputs.actions.find(action=>action.id===payload.action);
            if(event.kind!=='input'||!action||!['press','hold','release','cancel'].includes(String(event.payload.phase))||action.valueType!=='button'&&['press','hold'].includes(String(event.payload.phase))&&event.payload.value===undefined)fail('A2G_E_INPUT_RAW','Malformed semantic trace action');
            if(event.payload.seq!==undefined&&(!safeInteger(event.payload.seq)||event.payload.seq<0)||event.payload.sourceId!==undefined&&typeof event.payload.sourceId!=='string')fail('A2G_E_INPUT_RAW','Malformed trace action identity');
            if(payload.viewportAspect!==undefined&&(!safeFinite(payload.viewportAspect)||payload.viewportAspect<0.1||payload.viewportAspect>10))fail('A2G_E_INPUT_RAW','Malformed trace viewport aspect');
        }
        inputs.push({source:event.source as string,kind:event.kind,tickIndex:event.tickIndex,seq:event.seq,timeUs:event.timeUs,payload:event.payload as JsonRecord});
    }
    // All format and game binding checks complete before any Runtime mutation.
    runtime.start();
    if(inputs.some(input=>input.source==='system'||input.source==='action')){
        let advanced=0,groupTick=-1,hadInput=false;
        const advanceTo=(tick:number)=>{while(runtime.observe().tickIndex<tick&&runtime.status==='playing'){const result=runtime.step(Math.min(100000,tick-runtime.observe().tickIndex));advanced+=result.advanced;if(!result.advanced)break;}};
        for(const input of inputs){
            if(input.tickIndex!==groupTick){if(hadInput)advanceTo(groupTick+1);advanceTo(input.tickIndex!);groupTick=input.tickIndex!;hadInput=false;}
            if(input.source==='system'){
                if(input.kind==='pause')runtime.pause();else if(input.kind==='resume')runtime.resume();
            }else if(input.source==='action'){
                const p=input.payload;runtime.injectAction({action:String(p.action),phase:p.phase as 'press'|'hold'|'release'|'cancel',...(p.value!==undefined?{value:p.value}:{}),...(typeof p.sourceId==='string'?{sourceId:p.sourceId}:{}),...(typeof p.viewportAspect==='number'?{viewportAspect:p.viewportAspect}:{}),tickIndex:input.tickIndex,timeUs:input.timeUs,seq:typeof p.seq==='number'?p.seq:input.seq});hadInput=true;
            }else {runtime.injectRaw(input);hadInput=true;}
        }
        if(hadInput)advanceTo(groupTick+1);
        const obs=runtime.observe();return {advanced,finalHash:obs.exactHash,finalStatus:obs.flow.status,consumed:inputs.length};
    }
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
