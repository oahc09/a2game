/** Shared P0 checks beside the existing per-game flows. Not human/G3/device acceptance. */
import assert from 'node:assert/strict';
export async function inspectPlayerQuality({page,game,screenshot}){
 const result={status:'FAIL',scope:'AI/browser usability reference; full human quality approval NOT_RUN',viewports:[]};
 assert.ok((await page.locator('#instructions').textContent()).trim(),'Missing playable instructions');
 const imu=game.requires.all.some(c=>c.id.startsWith('a2game.input.imu.'));
 assert.equal(await page.locator('#sensorControls').isVisible(),imu,'Unrelated sensor controls');
 assert.equal(await page.locator('#recordingControls').isVisible(),game.inputs.traceRecording==='user-opt-in','Undeclared recording controls');
 assert.equal(await page.locator('.diagnostics').getAttribute('open'),null,'Diagnostics should not occupy the initial play surface');
 result.actions=await page.locator('[data-action]').evaluateAll(buttons=>buttons.filter(b=>getComputedStyle(b).visibility!=='hidden'&&b.getClientRects().length).map(b=>({id:b.dataset.action,label:b.textContent.trim(),keyboardHint:b.title})));
 assert.ok(result.actions.every(a=>a.label&&a.label!==a.id),'Action identifiers must have readable labels');
 try{for(const width of [1100,390,320]){
  await page.setViewportSize({width,height:width===1100?1000:844});await page.evaluate(()=>scrollTo(0,0));
  const layout=await page.evaluate(()=>{
   const visible=e=>getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length;
   const buttons=[...document.querySelectorAll('button')].filter(visible),canvas=document.getElementById('GameCanvas').getBoundingClientRect();
   const controls=document.querySelector('.play-controls'),actions=[...controls.querySelectorAll('[data-action]')].filter(visible);
   return {width:innerWidth,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},targets:buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent.trim(),width:r.width,height:r.height,x:r.x,right:r.right,clipped:b.scrollWidth>b.clientWidth};}),controlsGap:actions.length?controls.getBoundingClientRect().top-canvas.bottom:null,instructionFont:parseFloat(getComputedStyle(document.getElementById('instructions')).fontSize)};
  });
  assert.ok(layout.noHorizontalOverflow&&layout.canvas.x>=0&&layout.canvas.x+layout.canvas.width<=width,'Horizontal clipping');
  assert.ok(layout.targets.every(t=>t.width>=44&&t.height>=44&&t.x>=0&&t.right<=width&&!t.clipped),'Clipped/small control');
  assert.ok(layout.instructionFont>=15,'Instructions must remain readable');
  if(layout.controlsGap!==null)assert.ok(layout.controlsGap<180,'Controls too far from the playfield');
  result.viewports.push({...layout,screenshot:await screenshot('quality-'+width)});
 }}finally{await page.setViewportSize({width:1100,height:1000});await page.evaluate(()=>scrollTo(0,0));}
 result.status='PASS_REFERENCE';return result;
}
