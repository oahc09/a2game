
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {verifyScoreSession} from './score-session.mjs';

const root='games/business-complete/skyline-patrol/';
const source=root+'muzzle.game.json',text=await readFile(source,'utf8');
const trace=JSON.parse(await readFile(root+'muzzle-score-trace.json','utf8'));
const game=JSON.parse(text);
const legacy=JSON.parse(await readFile('specs/v0.1/games/g17-candidate.game.json','utf8')).scenes[0].entities[0].components[0].config;
const expected=verifyScoreSession(game,trace,{scorePath:'/world/score',expectedScore:100,actorId:'hero'});
const output='output/skyline-patrol-terminal-'+Date.now();
await mkdir(output,{recursive:true});
const service=createContentService(),release=await service.release(text);
const server=createPlayerServer({contentService:service});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const report={status:'FAIL',caseIds:['SHT-10','SHT-11'],source,gameRelease:release.sha256Jcs,results:[]};
try{
 for(const backend of ['three','air']){
  const page=await browser.newPage({viewport:{width:950,height:900},reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(()=>{
    window.feedbackStarts=[];
    const original=OscillatorNode.prototype.start;
    OscillatorNode.prototype.start=function(...args){window.feedbackStarts.push(this.frequency.value);return original.apply(this,args);};
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&feedback=1&release='+release.sha256Jcs);
   await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused');
   await page.locator('#effectsSound').click();
   await page.waitForFunction(()=>window.__a2game.diagnostics().feedback.audio.contextState==='running');
   await page.evaluate(events=>{
    const result=document.querySelector('#stageResult');
    window.settlements=0;
    new MutationObserver(rows=>{if(!result.hidden)window.settlements+=rows.filter(row=>row.oldValue!==null).length;}).observe(result,{attributeFilter:['hidden'],attributeOldValue:true});
    document.querySelector('#readyStart').addEventListener('click',()=>{
     for(const event of events)window.__a2game.runtime.injectRaw(event);
    },{once:true});
   },trace.events.filter(e=>e.source==='pointer'));
   await page.locator('#readyStart').click();
   await page.waitForFunction(tick=>window.__a2game.runtime.tickIndex>tick,legacy.maxTicks);
   const beyondLegacy=await page.evaluate(()=>{
    const o=window.__a2game.getState({recentEvents:0});
    return {tick:o.tickIndex,score:o.state.world.score,status:o.flow.status};
   });
   assert.ok(beyondLegacy.score>legacy.goalScore&&beyondLegacy.status==='playing');
   await page.waitForFunction(()=>window.__a2game.runtime.status==='lost');
   const snapshot=()=>page.evaluate(()=>{
    const a=window.__a2game,o=a.getState();
    return {tick:o.tickIndex,hash:o.exactHash,score:o.state.world.score,heroDeaths:o.events.filter(e=>e.type==='combat.death'&&e.payload.id==='hero').length,
     totalDeaths:o.events.filter(e=>e.type==='combat.death').length,blastStarts:window.feedbackStarts.filter(x=>x===190).length,settlements:window.settlements,effects:a.diagnostics().feedback.effects};
   });
   const terminal=await snapshot();
   assert.deepEqual([terminal.tick,terminal.hash,terminal.score,terminal.heroDeaths,terminal.settlements],[expected.advanced,expected.finalHash,100,1,1]);
   assert.match(await page.locator('#stageResultDetail').innerText(),/本局 100 分/);
   assert.equal(terminal.blastStarts,terminal.totalDeaths);
   assert.ok(terminal.effects>0);
   await page.locator('#GameCanvas').focus();
   await page.keyboard.press('b');
   await page.locator('#GameCanvas').click();
   await page.waitForTimeout(400);
   const after=await snapshot();
   assert.deepEqual(after,{...terminal,effects:0});
   await page.screenshot({path:output+'/'+backend+'-terminal.png'});
   const reset=await page.evaluate(()=>{
    const api=window.__a2game;
    document.querySelector('#restart').click();
    const r=api.runtime.snapshot();
    return {status:api.runtime.status,tick:api.runtime.tickIndex,hash:api.getHash(),inputs:r.inputQueue.length+r.rawQueue.length,pressed:r.pressedSources,effects:api.diagnostics().feedback.effects};
   });
   assert.deepEqual(reset,{status:'playing',tick:0,hash:expected.restartHash,inputs:0,pressed:{},effects:0});
   assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__a2game.dispose());
   report.results.push({backend,beyondLegacy,terminal,after,reset});
   console.log(backend,terminal.heroDeaths,terminal.blastStarts,terminal.settlements);
  }finally{await page.close();}
 }
 report.status='PASS';
}catch(e){report.error=e.stack;throw e;}
finally{
 await writeFile(output+'/receipt.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(output+'/receipt.json',report.status);
 await browser.close();await new Promise(r=>server.close(r));
}
