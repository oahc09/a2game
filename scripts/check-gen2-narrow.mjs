/** Real SDK visual checks for the host-authored presentation derivative. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {root,makeRegistry} from './registry.mjs';
import {previewGeneratedDirectory} from '../generator/index.mjs';
import {HeadlessRuntime} from '../dist/index.js';
const original=resolve(root,'output/gen2-terra-addc99af-70e3-4dda-a88e-a10f5fe1bbf3-release');
const refined=resolve(process.argv[2]??resolve(root,'output/gen2-terra-narrow-v1-20261030'));
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const id='gen2-narrow-'+randomUUID(),directory=resolve(root,'reports',id);mkdirSync(directory,{recursive:true});
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const rel=p=>relative(root,p).replaceAll('\\','/');
const parent=read(resolve(original,'game.json')),game=read(resolve(refined,'game.json')),report=read(resolve(refined,'generation-report.json'));
assert.equal(report.provenance,'HOST_PRESENTATION_DERIVATIVE');assert.equal(hash(resolve(refined,'game.json')),report.artifacts['game.json'].sha256);
const fingerprints=Object.fromEntries(['scripts/check-gen2-narrow.mjs','scripts/refine-gen2-presentation.mjs','project/gen2-terra-narrow-presentation.json','player/main.mjs','player/index.html','player/adapters/three-adapter.mjs','player/adapters/cocosairjs-adapter.mjs'].map(p=>[p,hash(resolve(root,p))]));save('fingerprints.json',fingerprints);save('recipe.json',read(resolve(root,'project/gen2-terra-narrow-presentation.json')));save('sdk-provenance.json',read(resolve(root,'player/vendor/sdk-provenance.json')));
const summary={format:'a2game-gen2-narrow-visual',version:1,status:'FAIL',scope:'Host presentation derivative; logical parity with original native model JSON. Not independent model output or human/physical acceptance.',derivedGame:rel(resolve(refined,'game.json')),gameSha256:hash(resolve(refined,'game.json')),parentGameSha256:hash(resolve(original,'game.json')),additionalModelCalls:0,G3:'NOT_RUN',humanReview:'NOT_RUN',physicalDevice:'NOT_RUN',cases:[]};
function replay(definition,ops){const rt=new HeadlessRuntime(definition,makeRegistry());rt.start();try{for(const o of ops){if(o.op==='action')rt.injectAction(o.input);else if(o.op==='raw')rt.injectRaw(o.input);else if(o.op==='step')rt.step(o.ticks);else rt[o.op]();}return rt.observe().exactHash;}finally{rt.dispose();}}
let browser;
try{
 browser=await chromium.launch({headless:true});summary.browser=browser.version();
 for(const backend of ['three','air'])for(const size of [{name:'small',width:320,height:568},{name:'mobile',width:390,height:844},{name:'desktop',width:1280,height:1050}]){
  let session,context;const row={backend,viewport:size,status:'FAIL',errors:[],consoleErrors:[],screenshots:{}};
  try{
   session=await previewGeneratedDirectory(refined,{backend});assert.equal(session.status,'READY');context=await browser.newContext({viewport:{width:size.width,height:size.height},hasTouch:size.name!=='desktop',deviceScaleFactor:size.name==='desktop'?1:2});
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   const url=new URL(session.url);url.searchParams.set('clock','manual');await page.goto(url.href);await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
   row.typography=await page.evaluate(parentScene=>{
    const rendered=JSON.parse(window.render_game_to_text()),frame=rendered.presentation,rect=document.getElementById('GameCanvas').getBoundingClientRect(),scale=Math.min(rect.width/frame.width,rect.height/frame.height),originalScale=Math.min(rect.width/parentScene.width,rect.height/parentScene.height);
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='700 64px system-ui';
    const text=frame.commands.filter(c=>c.kind==='text');
    return {canvas:{width:rect.width,height:rect.height},minCssPx:Math.min(...text.map(c=>c.fontSize*scale)),originalMinCssPx:Math.min(...parentScene.nodes.filter(c=>c.kind==='text').map(c=>c.fontSize*originalScale)),bounds:text.map(c=>({id:c.id,inside:Math.abs(c.at[0])+(ctx.measureText(c.text).width+16)/64*c.fontSize/2<=frame.width/2&&Math.abs(c.at[1])+c.fontSize*.75<=frame.height/2}))};
   },parent.presentation.scene2d);
   assert.ok(row.typography.minCssPx>=16);assert.ok(row.typography.bounds.every(b=>b.inside));assert.ok(row.typography.minCssPx>row.typography.originalMinCssPx*2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   row.buttons=await page.locator('button[data-action]').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden').map(e=>({action:e.dataset.action,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.ok(row.buttons.length===3&&row.buttons.every(b=>b.width>=44&&b.height>=44));
   const shot=async phase=>{const name=`${backend}-${size.name}-${phase}.png`;await page.screenshot({path:resolve(directory,name),fullPage:true});row.screenshots[phase]={path:rel(resolve(directory,name)),sha256:hash(resolve(directory,name))};};
   row.initial=await page.evaluate(()=>window.__a2game.getState());await shot('initial');
   const input=async(action,key)=>{if(size.name==='desktop')await page.keyboard.press(key);else await page.locator(`[data-action="${action}"]`).tap();await page.evaluate(()=>window.__a2game.step(1));};
   await input('left','a');await input('right','d');assert.equal(await page.evaluate(()=>window.__a2game.getState().flow.status),'playing');await shot('progress');
   await input('confirm','Enter');row.won=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.won.flow.status,'won');
   let ops=await page.evaluate(()=>window.__a2game.getOperations());assert.equal(replay(parent,ops),row.won.exactHash);assert.equal(replay(game,ops),row.won.exactHash);
   row.hud=await page.locator('#score').textContent();assert.match(row.hud,/剩余 3 次机会/);assert.doesNotMatch(row.hud,/chances|confirmed|true|false/);await shot('won');
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);
   for(let i=0;i<3;i++)await input('confirm','Enter');row.lost=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.lost.flow.status,'lost');assert.match(await page.locator('#score').textContent(),/剩余 0 次机会/);
   ops=await page.evaluate(()=>window.__a2game.getOperations());assert.equal(replay(parent,ops),row.lost.exactHash);await shot('lost');
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);
   await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.adapter.disposed,true);assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS_REFERENCE';
  }catch(e){row.failure=String(e);}
  finally{await context?.close();await session?.close?.();if(session?.url){await assert.rejects(fetch(session.url));row.listenerClosed=true;}save(backend+'-'+size.name+'.json',row);summary.cases.push(row);}
 }
 assert.equal(summary.cases.length,6);assert.ok(summary.cases.every(c=>c.status==='PASS_REFERENCE'));
 for(const size of ['small','mobile','desktop']){const rows=summary.cases.filter(c=>c.viewport.name===size);assert.equal(rows[0].won.exactHash,rows[1].won.exactHash);assert.equal(rows[0].lost.exactHash,rows[1].lost.exactHash);}
 summary.status='PASS_REFERENCE';summary.parity=true;
}catch(e){summary.failure=String(e);}
finally{await browser?.close();summary.browserClosed=true;summary.sourcesUnchanged=Object.entries(fingerprints).every(([p,h])=>hash(resolve(root,p))===h);if(!summary.sourcesUnchanged)summary.status='FAIL';save('summary.json',summary);console.log(JSON.stringify({status:summary.status,receipt:rel(resolve(directory,'summary.json')),failure:summary.failure}));}
if(summary.status!=='PASS_REFERENCE')process.exitCode=1;
