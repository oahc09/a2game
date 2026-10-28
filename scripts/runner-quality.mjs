/** Native keyboard + the production clock. No manual step or gameplay mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),runId='runner-quality-'+new Date().toISOString().replace(/[:.]/g,'-'),directory='reports/'+runId;
fs.mkdirSync(directory);const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n'),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fingerprints=Object.fromEntries(['player/main.mjs','player/index.html','scripts/runner-quality.mjs'].map(p=>[p,hash(p)]));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,A2GAME_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});let output='';
const origin=await new Promise((ok,no)=>{server.stdout.on('data',d=>{output+=d;const m=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(m)ok(m[0]);});server.once('error',no);server.once('exit',c=>no(Error('HTTP '+c)));});
const cases=[];let browser;
try{browser=await chromium.launch({headless:true});for(const backend of ['three','air'])for(const id of ['G13','H03']){
 const page=await browser.newPage({viewport:{width:1100,height:1000}}),row={id,backend,status:'FAIL',errors:[]};page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
 const state=()=>page.evaluate(()=>window.__a2game.getState());
 const until=async tick=>{await page.waitForFunction(t=>{const o=window.__a2game.getState();return o.tickIndex>=t||o.flow.status!=='playing';},tick,{timeout:15000});assert.equal((await state()).flow.status,'playing');};
 try{
  await page.goto(origin+'/player/index.html?backend='+backend+'&game='+id.toLowerCase()+'-candidate');await page.waitForFunction(()=>window.__a2game||document.getElementById('error').textContent,{timeout:60000});assert.equal(await page.locator('#error').textContent(),'');
  assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).clock,'realtime');
  await page.keyboard.press('ArrowLeft');if(id==='H03')await page.keyboard.press('Space');await until(110);
  assert.equal((await state()).state.runner.checkpoints,1);await page.locator('#pause').click();const paused=await state();assert.equal(paused.flow.status,'paused');
  await page.waitForTimeout(200);assert.equal((await state()).exactHash,paused.exactHash);assert.ok((await page.locator('#resultMessage').textContent()).includes('继续'));row.pause={status:'PASS',tick:paused.tickIndex};
  await page.locator('#pause').click();await page.keyboard.press('ArrowRight');if(id==='H03')await page.keyboard.press('Space');await until(190);await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.__a2game.getState().flow.status!=='playing',{timeout:15000});row.final=await state();assert.equal(row.final.flow.status,'won');assert.equal(row.final.state.runner.checkpoints,2);if(id==='H03')assert.equal(row.final.state.runner.kills,1);
  assert.ok((await page.locator('#resultMessage').textContent()).includes('重新开始'));row.screenshot=directory+'/'+backend+'-'+id+'-production.png';await page.screenshot({path:row.screenshot,fullPage:true});
  await page.locator('#restart').click();assert.equal((await state()).state.runner.checkpoints,0);row.retry='PASS';await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.listenersActive,false);assert.equal(row.disposal.adapter.disposed,true);assert.deepEqual(row.errors,[]);row.status='PASS';
 }catch(e){row.failure=String(e);}finally{await page.close();cases.push(row);save(directory+'/'+backend+'-'+id+'.json',row);console.log(row.status,backend,id,row.failure??'');}
}}finally{await browser?.close();server.kill();const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h),status=unchanged&&cases.length===4&&cases.every(c=>c.status==='PASS')?'PASS':'FAIL';save(directory+'/summary.json',{format:'a2game-runner-production-quality',status,scope:'Actual desktop keyboard, production RAF/Tick, pause/resume and retry. No manual stepping. Not human/device/G3 approval.',unchanged,fingerprints,cases:cases.map(c=>({id:c.id,backend:c.backend,status:c.status,receipt:directory+'/'+c.backend+'-'+c.id+'.json',screenshot:c.screenshot}))});console.log(status,directory+'/summary.json');if(status!=='PASS')process.exitCode=1;}
