import test from 'node:test';import assert from 'node:assert/strict';import{measureTextReadability as measure}from'../player/text-readability.mjs';
const frame={width:320,height:440,commands:[{id:'help',kind:'text',fontSize:18,text:'Arrow keys',at:[10,20]}]};
const canvas=(w,h)=>({width:w*2,height:h*2,getBoundingClientRect:()=>({left:10,top:30,width:w,height:h})});
test('live CSS dimensions, centered letterbox and advisory reference; no mutation',()=>{
 const before=JSON.stringify(frame),small=measure(frame,canvas(298,272.64),{referenceCssPx:12}),large=measure(frame,canvas(368,375),{referenceCssPx:12});
 assert.equal(small.status,'DIAGNOSTIC_ONLY');assert.ok(small.texts[0].nominalTextCssPx<12);assert.deepEqual(small.warnings,['SMALL_TEXT']);assert.ok(large.texts[0].nominalTextCssPx>12);assert.deepEqual(large.warnings,[]);
 assert.equal(small.texts[0].centerCss[0],159+10*272.64/440);
 assert.deepEqual(measure(frame,canvas(298,272.64),{referenceCssPx:9}).warnings,[]);assert.equal(JSON.stringify(frame),before);
});
test('Air uses actual view/backing pixel ratios, not DPR guessing',()=>{
 const adapter={width:298,height:273,air:{view:{getScaleX:()=>2,getScaleY:()=>2,getViewportRect:()=>({x:0,y:0,width:596,height:546})}}};
 const c=canvas(298,272.64);c.height=546;const r=measure(frame,c,{backend:'air',adapter});
 assert.equal(r.status,'DIAGNOSTIC_ONLY');assert.ok(Math.abs(r.texts[0].nominalTextCssPx-18*272.64/440)<1e-10);
 assert.equal(r.projection.kind,'AIR_LIVE_VIEW_TO_CANVAS_CSS');
});
test('hidden/invalid geometry and unknown Air view cannot claim measured size',()=>{
 assert.equal(measure(frame,canvas(0,200)).status,'UNAVAILABLE');
 assert.equal(measure(frame,canvas(300,200),{backend:'air'}).status,'UNAVAILABLE');
 assert.equal(measure(frame,canvas(300,200),{backend:'unknown'}).status,'UNAVAILABLE');
 assert.throws(()=>measure(frame,canvas(300,200),{referenceCssPx:NaN}));
});
test('default 16 CSS recommendation is configurable and never a pass/fail gate',()=>{
 const result=measure(frame,canvas(368,375));
 assert.equal(result.referenceCssPx,16);assert.equal(result.status,'DIAGNOSTIC_ONLY');assert.deepEqual(result.warnings,['SMALL_TEXT']);
 assert.deepEqual(measure({...frame,commands:[]},canvas(368,375)).texts,[]);
 const hugeBacking=canvas(368,375);hugeBacking.width=4000;hugeBacking.height=4000;
 assert.equal(measure(frame,hugeBacking).texts[0].nominalTextCssPx,result.texts[0].nominalTextCssPx);
 assert.equal(measure(frame,{getBoundingClientRect:()=>({left:NaN,top:0,width:300,height:300})}).status,'UNAVAILABLE');
});
test('malformed coordinates and degenerate or overflowing Air projections never emit NaN measurements',()=>{
 for(const at of [[],[0],[0,0,0],[Infinity,0]]){
  const result=measure({...frame,commands:[{...frame.commands[0],at}]},canvas(300,300));
  assert.equal(result.texts.length,0);assert.deepEqual(result.warnings,['INVALID_TEXT_COMMAND']);
 }
 const adapter={width:300,height:300,air:{view:{getScaleX:()=>2,getScaleY:()=>2,getViewportRect:()=>({x:0,y:0,width:0,height:600})}}};
 assert.equal(measure(frame,canvas(300,300),{backend:'air',adapter}).status,'UNAVAILABLE');
 adapter.air.view.getViewportRect=()=>({x:0,y:0,width:600,height:600});adapter.air.view.getScaleY=()=>Number.MAX_VALUE;
 const c=canvas(300,300);c.height=Number.MIN_VALUE;
 assert.equal(measure(frame,c,{backend:'air',adapter}).status,'UNAVAILABLE');
});
