/** Fresh constructed fixture -> public Generator preview -> real SDK input; never model evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {generateGame,previewGeneratedDirectory} from '../generator/index.mjs';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const id='generator-browser-'+randomUUID(),directory=resolve(root,'reports',id);
const mode=process.argv.find(arg=>arg.startsWith('--mode='))?.slice(7)??'direct-json';
if(!['direct-json','game-plan'].includes(mode))throw Error('Use --mode=direct-json|game-plan');
mkdirSync(directory,{recursive:true});
const rel=p=>relative(root,p).replaceAll('\\','/');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(dir+'/'+entry.name):[dir+'/'+entry.name]);
const sources=['scripts/generator-browser.mjs','scripts/registry.mjs','scripts/serve.mjs','scripts/content-service.mjs',...files('generator'),...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/')),...files('specs/v0.1/schemas'),...files('specs/v0.1/capabilities')];
const fingerprints=Object.fromEntries(sources.map(path=>[path,hash(resolve(root,path))]));save('fingerprints.json',fingerprints);
const summary={format:'a2game-generator-browser',version:1,status:'FAIL',id,mode,G3:'NOT_RUN',humanReview:'NOT_RUN',physicalDevice:'NOT_RUN',modelCalls:0,provenance:'DEMO_FIXTURE',cases:[],scope:'Fresh constructed fixture through Generator API and preview; real SDK engineering only, no natural-language/model/game-quality acceptance.'};
let browser;
function replay(game,operations){
 const runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();
 try{for(const row of operations){if(row.op==='action')runtime.injectAction(row.input);else if(row.op==='raw')runtime.injectRaw(row.input);else if(row.op==='step')runtime.step(row.ticks);else runtime[row.op]();}return runtime.observe();}
 finally{runtime.dispose();}
}
try{
 const generated=await generateGame({prompt:'DEMO_FIXTURE browser engineering validation.',mode,providerId:'fixture',outputDirectory:resolve(root,'output',id),maxAttempts:1});
 assert.equal(generated.status,'PASS_REFERENCE');assert.equal(generated.generationCalls,0);
 summary.generatedDirectory=rel(generated.outputDirectory);summary.generationReportSha256=hash(resolve(generated.outputDirectory,'generation-report.json'));
 const gamePath=resolve(generated.outputDirectory,'game.json'),game=JSON.parse(readFileSync(gamePath));summary.gameSha256=hash(gamePath);
 try{
  const sdkPath=resolve(root,'player/vendor/sdk-provenance.json'),sdk=JSON.parse(readFileSync(sdkPath));
  for(const file of sdk.files){assert.match(file.path,/^player\/vendor\/[\w.-]+\.js$/);assert.equal(hash(resolve(root,file.path)),file.sha256);}
  save('sdk-provenance.json',sdk);summary.sdkProvenance={path:rel(resolve(directory,'sdk-provenance.json')),sha256:hash(sdkPath)};
 }catch{summary.status='BLOCKED';throw Object.assign(Error('真实 SDK 或 SHA 回执不可用，请运行 npm run sdk:prepare 后重试。'),{code:'A2G_GEN_SDK_REQUIRED'});}
 browser=await chromium.launch({headless:true});summary.browser=browser.version();
 for(const backend of ['three','air'])for(const viewport of [{name:'desktop',width:1280,height:1050},{name:'mobile',width:390,height:844}]){
  const result={backend,viewport:viewport.name,status:'FAIL',errors:[],consoleErrors:[],screenshots:{}};
  let context,session;
  try{
   session=await previewGeneratedDirectory(generated.outputDirectory,{backend});
   if(session.status==='BLOCKED'){summary.status='BLOCKED';throw Object.assign(Error(session.nextStep),{code:session.code});}
   context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});const page=await context.newPage();
   page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
   const url=new URL(session.url);url.searchParams.set('clock','manual');await page.goto(url.href);
   await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
   result.initial=await page.evaluate(()=>window.__a2game.getState());
   const screenshot=async phase=>{const name=`${backend}-${viewport.name}-${phase}.png`;await page.screenshot({path:resolve(directory,name),fullPage:true});result.screenshots[phase]={path:rel(resolve(directory,name)),sha256:hash(resolve(directory,name))};};
   await screenshot('initial');
   const canvas=PNG.sync.read(await page.locator('#GameCanvas').screenshot()),colors=new Set();
   for(let i=0;i<canvas.data.length;i+=4)colors.add(`${canvas.data[i]>>4},${canvas.data[i+1]>>4},${canvas.data[i+2]>>4}`);
   assert.ok(colors.size>2,'实际 SDK 画布没有足够的可见内容。');result.canvasColors=colors.size;
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__a2game.getHash());
   await page.evaluate(()=>window.__a2game.step(3));assert.equal(await page.evaluate(()=>window.__a2game.getHash()),paused);
   await page.locator('#pause').click();await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);
   const input=async()=>{
    if(viewport.name==='desktop')await page.keyboard.press('Space');else await page.locator('[data-action="collect"]').click();
    await page.evaluate(()=>window.__a2game.step(1));
   };
   await input();await input();result.negative=await page.evaluate(()=>window.__a2game.getState());
   assert.equal(result.negative.flow.status,'playing');assert.equal(result.negative.state.score,2);await screenshot('progress');
   await input();result.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(result.final.flow.status,'won');assert.equal(result.final.state.score,3);
   result.operations=await page.evaluate(()=>window.__a2game.getOperations());result.node=replay(game,result.operations);assert.equal(result.final.exactHash,result.node.exactHash);
   await screenshot('won');
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);result.restart='PASS';
   await page.evaluate(()=>window.__a2game.dispose());result.disposal=await page.evaluate(()=>window.__a2game.diagnostics());
   assert.equal(result.disposal.listenersActive,false);assert.equal(result.disposal.adapter.disposed,true);assert.equal(result.disposal.resources.ownedResources,0);
   assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);result.status='PASS_REFERENCE';
  }catch(e){result.code=e.code??'A2G_GEN_BROWSER';result.failure=String(e.message);}
  finally{
   await context?.close();await session?.close?.();
   if(session?.url){await assert.rejects(fetch(session.url));result.listenerClosed=true;}
   save(`${backend}-${viewport.name}.json`,result);summary.cases.push(result);
  }
 }
 assert.equal(summary.cases.length,4);assert.ok(summary.cases.every(c=>c.status==='PASS_REFERENCE'));
 for(const name of ['desktop','mobile']){const rows=summary.cases.filter(c=>c.viewport===name);assert.equal(rows[0].initial.exactHash,rows[1].initial.exactHash);assert.equal(rows[0].final.exactHash,rows[1].final.exactHash);}
 assert.equal(hash(gamePath),summary.gameSha256);assert.equal(hash(resolve(root,'player/vendor/sdk-provenance.json')),summary.sdkProvenance.sha256);
 const sdk=JSON.parse(readFileSync(resolve(directory,'sdk-provenance.json')));for(const file of sdk.files)assert.equal(hash(resolve(root,file.path)),file.sha256);
 summary.status='PASS_REFERENCE';summary.parity=true;
}catch(e){summary.code=e.code??'A2G_GEN_BROWSER';summary.failure=String(e.message);}
finally{await browser?.close();summary.browserClosed=true;summary.sourcesUnchanged=Object.entries(fingerprints).every(([path,digest])=>hash(resolve(root,path))===digest);if(!summary.sourcesUnchanged)summary.status='FAIL';save('summary.json',summary);console.log(JSON.stringify({status:summary.status,receipt:rel(resolve(directory,'summary.json')),failure:summary.failure}));}
if(summary.status!=='PASS_REFERENCE')process.exitCode=summary.status==='BLOCKED'?3:1;
