/** Targeted 320px real-SDK checks for a G17 host presentation derivative. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {root,makeRegistry} from './registry.mjs';
import {previewGeneratedDirectory,safePath} from '../generator/index.mjs';
import {playSolution} from './agent-solver.mjs';
import {HeadlessRuntime} from '../dist/index.js';

const original=resolve(root,'output/generator-benchmark-followup/2fb28428-443d-408e-86d5-df8d969dcbab/G17-game-plan');
const refined=safePath(process.argv[2]);
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const rel=p=>relative(root,p).replaceAll('\\','/');
const directory=resolve(root,'reports','g17-visual-'+randomUUID());mkdirSync(directory,{recursive:true});
const save=(name,data)=>writeFileSync(resolve(directory,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const parent=read(resolve(original,'game.json')),game=read(resolve(refined,'game.json')),solution=read(resolve(refined,'solution.json')),derivation=read(resolve(refined,'generation-report.json'));
assert.equal(derivation.provenance,'HOST_PRESENTATION_DERIVATIVE');
assert.equal(hash(resolve(original,'game.json')),derivation.parent['game.json']);
assert.equal(hash(resolve(refined,'game.json')),derivation.artifacts['game.json'].sha256);
const play=playSolution(game,solution);assert.deepEqual(play,playSolution(parent,solution));
const sources=['scripts/check-g17-presentation.mjs','scripts/refine-g17-presentation.mjs','player/index.html','player/main.mjs','player/vendor/sdk-provenance.json'];
const fingerprints=Object.fromEntries(sources.map(path=>[path,hash(resolve(root,path))]));save('fingerprints.json',fingerprints);save('sdk-provenance.json',read(resolve(root,'player/vendor/sdk-provenance.json')));
function idle(def){const rt=new HeadlessRuntime(def,makeRegistry());try{rt.start();rt.step(241);return rt.observe();}finally{rt.dispose();}}
const idleExpected=idle(game);assert.deepEqual(idleExpected,idle(parent));assert.equal(idleExpected.flow.status,'lost');
const summary={format:'a2game-g17-host-visual-review',version:1,status:'FAIL',scope:'Host derivative, simulated browser inputs; not independent model, physical device or human quality acceptance.',game:rel(resolve(refined,'game.json')),parentSha256:derivation.parent['game.json'],gameSha256:hash(resolve(refined,'game.json')),modelCalls:0,G3:'NOT_RUN',humanReview:'NOT_RUN',physicalDevice:'NOT_RUN',cases:[]};
let browser;
try{
 browser=await chromium.launch({headless:true});summary.browser=browser.version();
 for(const backend of ['three','air']){
  let session,context;const row={backend,viewport:{width:320,height:568},status:'FAIL',errors:[],screenshots:{}};
  try{
   session=await previewGeneratedDirectory(refined,{backend});assert.equal(session.status,'READY');
   context=await browser.newContext({viewport:row.viewport,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
   const url=new URL(session.url);url.searchParams.set('clock','manual');await page.goto(url.href);await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
   const shot=async phase=>{const name=`${backend}-${phase}.png`;await page.screenshot({path:resolve(directory,name),fullPage:true});row.screenshots[phase]={path:rel(resolve(directory,name)),sha256:hash(resolve(directory,name))};};
   const noOverlay=async()=>assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).presentation.commands.some(c=>['result','failure'].includes(c.id))),false);
   const terminal=async(status,title,detail)=>{
    assert.equal(await page.locator('#stageResult').isVisible(),true);
    assert.equal(await page.locator('#stageResultTitle').textContent(),title);
    assert.equal(await page.locator('#stageResultDetail').textContent(),detail);
    assert.equal(await page.locator('#hint').textContent(),'');
    const layout=await page.locator('#stageResult').evaluate(el=>{const r=el.getBoundingClientRect(),stage=el.closest('.stage').getBoundingClientRect(),button=el.querySelector('button').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,stageTop:stage.top,stageBottom:stage.bottom,width:innerWidth,height:innerHeight,buttonWidth:button.width,buttonHeight:button.height};});
    assert.ok(layout.top>=0&&layout.bottom<=layout.height&&layout.left>=0&&layout.right<=layout.width,'Terminal feedback must be visible without scrolling: '+JSON.stringify(layout));
    assert.ok(layout.buttonWidth>=44&&layout.buttonHeight>=44,'Terminal retry target must remain accessible');
    const name=`${backend}-${status}-viewport.png`;await page.screenshot({path:resolve(directory,name)});row.screenshots[status+'Viewport']={path:rel(resolve(directory,name)),sha256:hash(resolve(directory,name))};
    return layout;
   };
   assert.equal(await page.locator('#stageResult').isVisible(),false);
   row.initial=await page.evaluate(()=>window.__a2game.getState());await noOverlay();await shot('initial');
   row.typography=await page.evaluate(()=>{const frame=JSON.parse(window.render_game_to_text()).presentation,rect=document.getElementById('GameCanvas').getBoundingClientRect(),scale=Math.min(rect.width/frame.width,rect.height/frame.height),ctx=document.createElement('canvas').getContext('2d');ctx.font='700 64px system-ui';const text=frame.commands.filter(c=>c.kind==='text');return {minCssTextPx:Math.min(...text.map(c=>c.fontSize*scale)),bounds:text.map(c=>({id:c.id,inside:Math.abs(c.at[0])+(ctx.measureText(c.text).width+16)/64*c.fontSize/2<=frame.width/2&&Math.abs(c.at[1])+c.fontSize*.75<=frame.height/2}))};});
   assert.ok(row.typography.minCssTextPx>=16);assert.ok(row.typography.bounds.every(b=>b.inside));
   row.buttons=await page.locator('button[data-action]').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width>0).map(e=>({id:e.dataset.action,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.ok(row.buttons.length>=5&&row.buttons.every(b=>b.width>=44&&b.height>=44));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#pause').click();assert.equal(await page.locator('#stageResult').isVisible(),false);const paused=await page.evaluate(()=>window.__a2game.getHash());await page.evaluate(()=>window.__a2game.step(3));assert.equal(await page.evaluate(()=>window.__a2game.getHash()),paused);await page.locator('#pause').click();
   row.movement=[];
   for(const [action,axis,sign] of [['left','x',-1],['right','x',1],['up','y',1],['down','y',-1]]){
    await page.locator('#restart').click();const button=page.locator(`[data-action="${action}"]`);await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();
    const before=await page.evaluate(()=>window.__a2game.getState().state.flight.bodies.find(b=>b.kind==='actor'));
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.evaluate(()=>window.__a2game.step(3));
    const after=await page.evaluate(()=>window.__a2game.getState().state.flight.bodies.find(b=>b.kind==='actor'));await page.mouse.up();await page.evaluate(()=>window.__a2game.step(1));
    assert.ok((after[axis]-before[axis])*sign>0,action+' must move');row.movement.push({action,delta:after[axis]-before[axis]});
   }
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);
   for(const [index,step] of solution.entries()){
    if(step.action&&step.value!==false)await page.locator(`[data-action="${step.action}"]`).tap();
    await page.evaluate(ticks=>window.__a2game.step(ticks),step.ticks);
    assert.equal(await page.evaluate(()=>window.__a2game.getHash()),play.trace[index].hash);
    if(index===1){await noOverlay();await shot('progress');}
   }
   row.won=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.won.flow.status,'won');assert.match(await page.locator('#status').textContent(),/已通关/);assert.match(await page.locator('#resultMessage').textContent(),/目标已完成/);await noOverlay();row.wonFeedback=await terminal('won','已通关','目标已完成');await shot('won');
   await page.locator('#stageRestart').tap();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);assert.equal(await page.locator('#stageResult').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'GameCanvas');
   await page.locator('[data-action="fire"]').scrollIntoViewIfNeeded();await page.evaluate(()=>window.__a2game.step(241));
   row.lost=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.lost.exactHash,idleExpected.exactHash);assert.equal(row.lost.flow.status,'lost');assert.match(await page.locator('#status').textContent(),/本局结束/);assert.match(await page.locator('#resultMessage').textContent(),/未完成目标/);await noOverlay();row.lostFeedback=await terminal('lost','本局结束','目标未完成');await shot('lost');
   await page.locator('#stageRestart').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);assert.equal(await page.locator('#stageResult').isVisible(),false);
   await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);assert.equal(row.disposal.adapter.disposed,true);
   assert.deepEqual(row.errors,[]);row.status='PASS_REFERENCE';
  }catch(error){row.failure=String(error);}
  finally{await context?.close();await session?.close?.();if(session?.url){await assert.rejects(fetch(session.url));row.listenerClosed=true;}save(backend+'.json',row);summary.cases.push(row);}
 }
 assert.equal(summary.cases.length,2);assert.ok(summary.cases.every(row=>row.status==='PASS_REFERENCE'));
 assert.equal(summary.cases[0].won.exactHash,summary.cases[1].won.exactHash);assert.equal(summary.cases[0].lost.exactHash,summary.cases[1].lost.exactHash);summary.status='PASS_REFERENCE';
}catch(error){summary.failure=String(error);}
finally{await browser?.close();summary.originalUnchanged=hash(resolve(original,'game.json'))===derivation.parent['game.json'];summary.sourcesUnchanged=Object.entries(fingerprints).every(([path,value])=>hash(resolve(root,path))===value);if(!summary.originalUnchanged||!summary.sourcesUnchanged)summary.status='FAIL';save('summary.json',summary);console.log(JSON.stringify({status:summary.status,receipt:rel(resolve(directory,'summary.json')),failure:summary.failure}));}
if(summary.status!=='PASS_REFERENCE')process.exitCode=1;
