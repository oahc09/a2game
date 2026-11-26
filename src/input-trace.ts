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
    const expectedSession = {
        gameId: def.id, gameRevision: def.revision, tickHz: def.world.clock.tickHz, seed: def.world.clock.seed,
        coordinateProfile: 'viewport-top-left-v1', inputNormalizerVersion: '0.1.0'
    };
    for (const [field, expected] of Object.entries(expectedSession)) {
        const actual = session[field];
        if (actual !== expected) fail('A2G_E_INPUT_RAW', `InputTrace session ${field} must be ${JSON.stringify(expected)}`, {
            jsonPointer: `/session/${field}`, expected, actual
        });
    }
    if(runtime.status!=='ready'||runtime.observe().tickIndex!==0)fail('A2G_E_FLOW','InputTrace replay requires an unstarted Session');
    if(raw.events.length>4096)fail('A2G_E_BUDGET_EXCEEDED','Trace event budget exceeded');
    let lastTick=0,lastSeq=-1;
    const inputs:NormalizedRawInput[]=[];
    for(const [index,event] of raw.events.entries()){
        if(!isRecord(event)||!safeInteger(event.tickIndex)||event.tickIndex<0||event.tickIndex>100000||
            !safeInteger(event.seq)||event.seq<0||!safeInteger(event.timeUs)||event.timeUs<0||
            !['pointer','keyboard','imu','gamepad','action','system'].includes(String(event.source))||typeof event.kind!=='string'||!isRecord(event.payload))
            fail('A2G_E_INPUT_RAW','Invalid InputTrace event');
        if(event.tickIndex<lastTick||(event.tickIndex===lastTick&&event.seq<=lastSeq))fail('A2G_E_INPUT_RAW','Trace tick/seq order must be strictly increasing');
        const minTimeUs = Math.ceil(event.tickIndex * 1000000 / def.world.clock.tickHz);
        const maxTimeUs = Math.ceil((event.tickIndex + 1) * 1000000 / def.world.clock.tickHz) - 1;
        if (event.timeUs < minTimeUs || event.timeUs > maxTimeUs) {
            fail('A2G_E_INPUT_RAW', `Trace event ${index} at tick ${event.tickIndex} requires timeUs in [${minTimeUs}, ${maxTimeUs}]; received ${event.timeUs}`, {
                jsonPointer: `/events/${index}/timeUs`, tickIndex: event.tickIndex,
                expected: { minTimeUs, maxTimeUs }, actual: event.timeUs
            });
        }
        lastTick=event.tickIndex;lastSeq=event.seq;
        if(event.source==='system'&&!['pause','resume','checkpoint'].includes(event.kind))fail('A2G_E_INPUT_RAW','Unknown trace system control');
        if(event.source==='pointer'){
            const {pointerId,u,v,viewportAspect}=event.payload;
            if(!['down','move','up','cancel'].includes(event.kind)||!safeInteger(pointerId)||!safeFinite(u)||!safeFinite(v))
                fail('A2G_E_INPUT_RAW','Pointer trace requires pointerId and normalized u/v coordinates',{jsonPointer:`/events/${index}/payload`});
            if(viewportAspect!==undefined&&(!safeFinite(viewportAspect)||viewportAspect<0.1||viewportAspect>10))
                fail('A2G_E_INPUT_RAW','Pointer trace viewportAspect must be 0.1–10',{jsonPointer:`/events/${index}/payload/viewportAspect`});
        }
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
