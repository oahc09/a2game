import { A2GameError, fail, type DiagnosticInfo } from './errors.js';
import { HeadlessRuntime } from './runtime.js';
import { CapabilityRegistry } from './registry.js';
import { equals, isRecord, readPointer, safeFinite, safeInteger } from './utils.js';
import type { ConformanceSuite, GameDefinition, Json, NormalizedAction, NormalizedRawInput, SessionSnapshot } from './types.js';

export interface CaseResult { id: string; status:'PASS'|'FAIL'; assertions:number; advancedTicks:number; error?:string; code?:string; diagnostics?: DiagnosticInfo[]; }
export interface SuiteReceipt {
    suiteId:string; subject:string; runner:'a2game-headless'; status:'PASS'|'FAIL'; cases:CaseResult[];
    pass:number; fail:number; /** Host adapters and Gameplay/Agent gates are explicitly out of scope. */
    gates:{G0:'PARTIAL';G1:'PARTIAL';G2:'NOT_RUN';G3:'NOT_RUN'};
}
export async function runConformanceSuite(
    suite: ConformanceSuite,
    definition: GameDefinition,
    makeRegistry: () => CapabilityRegistry,
):Promise<SuiteReceipt> {
    if (suite.format!=='a2game-conformance'||suite.specVersion!=='0.1.0'||suite.subject.id!==definition.id) fail('A2G_E_CONFORMANCE','Invalid suite/subject');
    const cases:CaseResult[]=[];
    for (const [caseIndex,testCase] of suite.cases.entries()) {
        const result:CaseResult={id:testCase.id,status:'PASS',assertions:0,advancedTicks:0};
        let runtime:HeadlessRuntime|undefined;
        let stepIndex=-1;
        const snapshots=new Map<string,SessionSnapshot>();
        let expectedError:{code:string;path?:string}|undefined;
        try {
            runtime=new HeadlessRuntime(definition,makeRegistry(),{seed:testCase.seed});
            for (const [idx,s] of testCase.steps.entries()) {
                stepIndex=idx;
                const op=s.op;
                if (typeof op!=='string') fail('A2G_E_CONFORMANCE','Step has no op');
                if (op==='expectError') {
                    if (expectedError) fail('A2G_E_CONFORMANCE','Nested expectError not allowed');
                    if (typeof s.code!=='string') fail('A2G_E_CONFORMANCE','Missing expected code');
                    expectedError={code:s.code,path:typeof s.path==='string'?s.path:undefined};
                    continue;
                }
                const expected=expectedError;
                expectedError=undefined;
                let thrown: unknown;
                try {
                    switch(op) {
                        case 'start': runtime.start();break;
                        case 'pause': runtime.pause();break;
                        case 'resume': runtime.resume();break;
                        case 'restart': runtime.restart(s.seed as number|undefined);break;
                        case 'injectAction': runtime.injectAction(s as unknown as NormalizedAction);break;
                        case 'injectRaw': runtime.injectRaw(s.raw as NormalizedRawInput);break;
                        case 'step': {
                            const ticks=s.ticks;
                            if (!safeInteger(ticks)) fail('A2G_E_CONFORMANCE','Bad ticks');
                            const report=runtime.step(ticks);
                            result.advancedTicks+=report.advanced;
                            break;
                        }
                        case 'snapshot': {
                            if (typeof s.id!=='string') fail('A2G_E_CONFORMANCE','Snapshot ID missing');
                            snapshots.set(s.id,runtime.snapshot());break;
                        }
                        case 'restore': {
                            const snap=snapshots.get(String(s.id));
                            if (!snap) fail('A2G_E_CONFORMANCE','Unknown snapshot');
                            runtime.restore(snap);break;
                        }
                        case 'assert': {
                            if (typeof s.path!=='string') fail('A2G_E_CONFORMANCE','Assertion path missing');
                            const actual=readPointer(runtime.observe(),s.path);
                            if (Object.hasOwn(s,'equals') && !equals(actual,s.equals as Json)) fail('A2G_E_ASSERT',`${s.path}: expected ${JSON.stringify(s.equals)}; actual ${JSON.stringify(actual)}`,{expected:s.equals,actual,...(s.path==='/flow/status'&&s.equals==='lost'?{ruleId:'conformance.loss-status-mismatch'}:{})});
                            if (Object.hasOwn(s,'approximately')) {
                                if (!safeFinite(actual)||!safeFinite(s.approximately)||!safeFinite(s.absTol)||!safeFinite(s.relTol)) fail('A2G_E_ASSERT','Approximate assertion requires numeric value and tolerances');
                                if (Math.abs(actual-s.approximately)>Math.max(s.absTol,s.relTol*Math.abs(s.approximately))) fail('A2G_E_ASSERT',`Approximately failed for ${s.path}`,{expected:s.approximately,actual});
                            }
                            if (Object.hasOwn(s,'matches') && (typeof actual!=='string'||!new RegExp(String(s.matches)).test(actual))) fail('A2G_E_ASSERT',`Regex failed for ${s.path}`);
                            result.assertions++;break;
                        }
                        case 'assertEvent': {
                            const events=runtime.observe().events;
                            if (typeof s.eventType!=='string'||!safeInteger(s.count)) fail('A2G_E_CONFORMANCE','Bad assertEvent arguments');
                            const count=events.filter(e=>e.type===s.eventType&&(s.sinceTick===undefined||e.tickIndex>=Number(s.sinceTick))).length;
                            if (count!==s.count) fail('A2G_E_ASSERT',`Event ${s.eventType}: expected ${s.count}, got ${count}`,{expected:s.count,actual:count});
                            result.assertions++;break;
                        }
                        default: fail('A2G_E_CONFORMANCE',`Unsupported test op ${op}`);
                    }
                } catch (err) { thrown=err; }
                if (expected) {
                    if (thrown instanceof A2GameError && thrown.code===expected.code && (!expected.path || thrown.info.jsonPointer===expected.path)) { result.assertions++; continue; }
                    if (thrown) throw thrown;
                    fail('A2G_E_ASSERT',`Expected ${expected.code}, but op ${op} succeeded`,{expected:expected.code,actual:"NO_ERROR"});
                }
                if (thrown) throw thrown;
            }
            if (expectedError) fail('A2G_E_CONFORMANCE','expectError without following operation');
        } catch (err) {
            result.status='FAIL';
            result.code=err instanceof A2GameError ? err.code : 'A2G_E_RUNTIME';
            result.diagnostics=[{jsonPointer:`/cases/${caseIndex}`+(stepIndex>=0?`/steps/${stepIndex}`:''),...(err instanceof A2GameError?err.info:{}),caseId:testCase.id}];
            for (const diagnostic of runtime?.getInputDiagnostics()??[]) result.diagnostics.push({...diagnostic,caseId:testCase.id});
            result.error=`${testCase.id}: ${err instanceof Error?err.message:String(err)}`;
        } finally { runtime?.dispose(); }
        cases.push(result);
    }
    const pass=cases.filter(c=>c.status==='PASS').length;
    return {
        suiteId:suite.suiteId,subject:suite.subject.id,runner:'a2game-headless',status:pass===cases.length?'PASS':'FAIL',cases,pass,fail:cases.length-pass,
        gates:{G0:'PARTIAL',G1:'PARTIAL',G2:'NOT_RUN',G3:'NOT_RUN'},
    };
}
