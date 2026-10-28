/** Trusted, bounded Conformance operations, shared by Node and browser evidence. */
export function executeG3Case(testCase,api=globalThis.__a2game){
 const runtime=api.runtime,snapshots=new Map(),check=(ok,message)=>{if(!ok)throw Error('A2G_E_G3_REPLAY: '+message);};
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const pointer=(value,path)=>path===''?value:path.slice(1).split('/').reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],value);
 runtime.restart(testCase.seed);let expected,assertions=0;
 for(const [i,s] of testCase.steps.entries()){
  if(s.op==='expectError'){check(!expected,'nested expectError');expected=s;continue;}
  const wanted=expected;expected=undefined;let caught;
  try{switch(s.op){
   case 'start':if(i!==0)runtime.start();break;
   case 'injectAction':runtime.injectAction(s);break;
   case 'injectRaw':runtime.injectRaw(s.raw);break;
   case 'step':api.step(s.ticks);break;
   case 'pause':runtime.pause();break;
   case 'resume':runtime.resume();break;
   case 'restart':runtime.restart(s.seed);break;
   case 'snapshot':snapshots.set(s.id,runtime.snapshot());break;
   case 'restore':check(snapshots.has(s.id),'missing snapshot');runtime.restore(snapshots.get(s.id));break;
   case 'assert':{const actual=pointer(runtime.observe(),s.path);if(Object.hasOwn(s,'equals'))check(canonical(actual)===canonical(s.equals),'assert '+s.path);if(Object.hasOwn(s,'approximately'))check(typeof actual==='number'&&Math.abs(actual-s.approximately)<=Math.max(s.absTol,s.relTol*Math.abs(s.approximately)),'approximately '+s.path);if(Object.hasOwn(s,'matches'))check(typeof actual==='string'&&new RegExp(s.matches).test(actual),'matches '+s.path);assertions++;break;}
   case 'assertEvent':check(runtime.observe().events.filter(e=>e.type===s.eventType&&(s.sinceTick===undefined||e.tickIndex>=s.sinceTick)).length===s.count,'event '+s.eventType);assertions++;break;
   default:throw Error('Unsupported operation '+s.op);
  }}catch(e){caught=e;}
  if(wanted){check(caught?.code===wanted.code&&(!wanted.path||caught.info?.jsonPointer===wanted.path),'expected error '+wanted.code);assertions++;}else if(caught)throw caught;
 }
 check(!expected,'expectError without operation');const state=runtime.observe();return {id:testCase.id,status:'PASS',assertions,hash:state.exactHash,ticks:state.tickIndex,flow:state.flow.status};
}
export function checkG3SuiteBudget(suite){
 if(!Array.isArray(suite.cases)||suite.cases.length<2||suite.cases.length>16)throw Error('A2G_E_G3_BUDGET: 正反例数量必须为 2–16。');
 for(const c of suite.cases){let ticks=0;if(c.steps.length>2048||c.steps[0]?.op!=='start')throw Error('A2G_E_G3_BUDGET: 每例需以 start 开始，最多 2048 项。');for(const s of c.steps)if(s.op==='step'&&(!Number.isInteger(s.ticks)||s.ticks<1||(ticks+=s.ticks)>12000))throw Error('A2G_E_G3_BUDGET: 每例最多 12000 Tick。');if(ticks===0)throw Error('A2G_E_G3_CASES: 仅断言初态不能充当玩法正反例。');}
 const outcomes=suite.cases.map(c=>c.steps.findLast(s=>s.op==='assert'&&s.path==='/flow/status'&&Object.hasOwn(s,'equals'))?.equals);
 if(!outcomes.includes('won')||!outcomes.some(s=>s==='playing'||s==='lost'))throw Error('A2G_E_G3_CASES: 必须有独立的成功和未完成/失败用例，不能共用初态断言冒充负例。');
}
