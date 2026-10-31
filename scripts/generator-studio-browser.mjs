/** Actual Studio clicks + fresh generation, two SDKs, package download/import and cancellation. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startGeneratorStudio} from '../generator/index.mjs';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const directory=resolve(root,'reports/generator-studio-'+randomUUID());mkdirSync(directory,{recursive:true});
const rel=p=>relative(root,p).replaceAll('\\','/'),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const sourcePaths=[...files('generator'),...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/')),'scripts/generator-studio-browser.mjs','scripts/serve.mjs','scripts/content-service.mjs'];
const fingerprints=Object.fromEntries(sourcePaths.map(path=>[path,hash(resolve(root,path))]));save('fingerprints.json',fingerprints);
const summary={format:'a2game-generator-studio-browser',version:1,status:'FAIL',scope:'Fresh fixed fixture via visible Studio workflow, actual SDK rendering and input. No real model semantic/human/physical acceptance.',realModelCalls:0,G3:'NOT_RUN',humanReview:'NOT_RUN',physicalDevices:'NOT_RUN',cases:[],errors:[]};
let studio,browser;
function replay(game,operations){const rt=new HeadlessRuntime(game,makeRegistry());rt.start();try{for(const row of operations){if(row.op==='action')rt.injectAction(row.input);else if(row.op==='raw')rt.injectRaw(row.input);else if(row.op==='step')rt.step(row.ticks);else rt[row.op]();}return rt.observe();}finally{rt.dispose();}}
try{
 studio=await startGeneratorStudio();browser=await chromium.launch({headless:true});summary.browser=browser.version();
 const sdk=JSON.parse(readFileSync(resolve(root,'player/vendor/sdk-provenance.json'),'utf8'));for(const entry of sdk.files)assert.equal(hash(resolve(root,entry.path)),entry.sha256);save('sdk-provenance.json',sdk);
 for(const viewport of [{name:'desktop',width:1280,height:1050},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',e=>summary.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')summary.errors.push(m.text());});
  try{
   await page.goto(studio.url+'?clock=manual');await page.locator('#prompt').fill('Fixture engineering: three clicks win.');
   await page.locator('#mode').selectOption(viewport.name==='desktop'?'direct-json':'game-plan');
   await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#export').disabled===false,null,{timeout:180000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const backend of ['three','air']){
    const row={viewport:viewport.name,backend,status:'FAIL',screenshots:{}};
    if(backend==='air'){
     await page.evaluate(()=>{window.__prior= document.querySelector('#player').contentWindow.__a2game;});
     await page.locator('#backend').selectOption('air');
     await page.waitForFunction(()=>window.__prior?.diagnostics().adapter.disposed===true&&window.__prior?.diagnostics().resources.ownedResources===0);
     row.previousHostDisposed=true;
    }
    await page.waitForFunction(b=>document.querySelector('#player').contentWindow.__a2game?.backend===b&&document.querySelector('#player').contentWindow.__a2game?.getState().flow.status==='playing',backend,{timeout:60000});
    const frame=page.frames().find(f=>f.url().includes('/player/index.html'));
    const game=await frame.evaluate(()=>window.__a2game.definition);
    const shot=async phase=>{const file=`${backend}-${viewport.name}-${phase}.png`;await page.screenshot({path:resolve(directory,file),fullPage:true});row.screenshots[phase]={path:rel(resolve(directory,file)),sha256:hash(resolve(directory,file))};};
    row.initial=await frame.evaluate(()=>window.__a2game.getState());await shot('initial');
    await frame.locator('#pause').click();const paused=await frame.evaluate(()=>window.__a2game.getHash());await frame.evaluate(()=>window.__a2game.step(3));assert.equal(await frame.evaluate(()=>window.__a2game.getHash()),paused);await frame.locator('#pause').click();await frame.locator('#restart').click();
    const click=async()=>{if(viewport.name==='desktop'){await frame.locator('#GameCanvas').click({position:{x:10,y:10}});await page.keyboard.press('Space');}else await frame.locator('[data-action="collect"]').click();await frame.evaluate(()=>window.__a2game.step(1));};
    await click();await click();row.progress=await frame.evaluate(()=>window.__a2game.getState());assert.equal(row.progress.flow.status,'playing');await shot('progress');
    await click();row.final=await frame.evaluate(()=>window.__a2game.getState());assert.equal(row.final.flow.status,'won');await shot('won');
    const operations=await frame.evaluate(()=>window.__a2game.getOperations());assert.equal(replay(game,operations).exactHash,row.final.exactHash);row.operations=operations;
    await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#state-text').textContent.includes('ownedResources'));assert.match(await page.locator('#state-text').textContent(),new RegExp(row.final.exactHash));await page.locator('[data-tab="play"]').click();
    await frame.locator('#restart').click();assert.equal(await frame.evaluate(()=>window.__a2game.getHash()),row.initial.exactHash);row.restart='PASS';
    row.status='PASS_REFERENCE';save(`${backend}-${viewport.name}.json`,row);summary.cases.push(row);
   }
   if(viewport.name==='mobile'){
    await page.locator('[data-tab="plan"]').click();assert.match(await page.locator('#plan-text').textContent(),/a2game-game-plan/);await page.locator('[data-tab="play"]').click();
    const downloaded=page.waitForEvent('download',{timeout:60000});await page.locator('#export').click();const download=await downloaded,file=resolve(directory,'downloaded-game-package.json');await download.saveAs(file);
    summary.download={path:rel(file),sha256:hash(file),format:JSON.parse(readFileSync(file,'utf8')).format};
    await page.locator('#import').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('工程验证通过'),null,{timeout:180000});
    await page.waitForFunction(()=>document.querySelector('#player').contentWindow.__a2game?.getState().flow.status==='playing',null,{timeout:60000});summary.reimport='PASS_REFERENCE';
    // Cancellation is a separate job, so it cannot hide completed game or package results.
    await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#cancel').disabled);await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#message').textContent==='任务已取消。',null,{timeout:60000});summary.cancel='PASS';
   }
   await page.evaluate(()=>document.querySelector('#player').contentWindow.__a2game?.dispose());
   const diagnostics=await page.evaluate(()=>document.querySelector('#player').contentWindow.__a2game?.diagnostics());assert.equal(diagnostics.resources.ownedResources,0);assert.equal(diagnostics.listenersActive,false);
  }finally{await context.close();}
 }
 assert.equal(summary.cases.length,4);assert.deepEqual(summary.errors,[]);summary.status='PASS_REFERENCE';
}catch(e){summary.code=e.code??'A2G_GEN_STUDIO_BROWSER';summary.failure=String(e.message);}
finally{await browser?.close();await studio?.close();if(studio?.url){await assert.rejects(fetch(studio.url));summary.listenerClosed=true;}summary.sourcesUnchanged=Object.entries(fingerprints).every(([p,d])=>hash(resolve(root,p))===d);if(!summary.sourcesUnchanged)summary.status='FAIL';save('summary.json',summary);console.log(JSON.stringify({status:summary.status,receipt:rel(resolve(directory,'summary.json')),failure:summary.failure}));}
if(summary.status!=='PASS_REFERENCE')process.exitCode=1;
