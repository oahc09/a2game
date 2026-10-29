/** Real SDK smoke for canonical spec URLs. Existing gameplay/SDK acceptance remains separately scoped. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
import {createPlayerServer} from './serve.mjs';
import {createContentService} from './content-service.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p))),hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const directory=resolve(root,'reports','spec-layout-browser-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);mkdirSync(directory);
const paths=['scripts/spec-layout-browser.mjs','scripts/serve.mjs','player/browser-registry.mjs','player/content-loader.mjs','player/validated-games.json','player/capability-index.json','specs/v0.1/games/grid-push.game.json'];
const fingerprints=Object.fromEntries(paths.map(p=>[p,hash(p)])),sdk=read('player/vendor/sdk-provenance.json');for(const f of sdk.files)assert.equal(hash(f.path),f.sha256);
const server=createPlayerServer({contentService:createContentService()}),cases=[];let browser,failure,closed=false;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});
 for(const backend of ['three','air']){
  const context=await browser.newContext({viewport:{width:1100,height:900}}),page=await context.newPage(),row={backend,status:'FAIL',errors:[],consoleErrors:[],assetResponses:[]};
  page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});page.on('response',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/specs/'))row.assetResponses.push({path:p,status:r.status()});});
  try{
   await page.goto(origin+'/player/index.html?game=grid-push&backend='+backend+'&clock=manual');await page.waitForFunction(()=>window.__a2game,null,{timeout:60000});
   row.initial=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.initial.flow.status,'playing');
   for(const key of ['ArrowRight','ArrowUp']){await page.keyboard.press(key);await page.evaluate(()=>window.__a2game.step(1));}
   row.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.final.flow.status,'won');row.operations=await page.evaluate(()=>window.__a2game.getOperations());
   const runtime=new HeadlessRuntime(read('specs/v0.1/games/grid-push.game.json'),makeRegistry());runtime.start();
   try{for(const op of row.operations){if(op.op==='raw')runtime.injectRaw(op.input);else if(op.op==='action')runtime.injectAction(op.input);else if(op.op==='step')runtime.step(op.ticks);else throw Error('Unexpected operation '+op.op);}row.nodeHash=runtime.observe().exactHash;assert.equal(row.nodeHash,row.final.exactHash);}finally{runtime.dispose();}
   row.wonScreenshot=relative(root,resolve(directory,backend+'-won.png')).replaceAll('\\','/');await page.screenshot({path:resolve(root,row.wonScreenshot),fullPage:true});
   await page.locator('#restart').click();assert.equal((await page.evaluate(()=>window.__a2game.getState())).exactHash,row.initial.exactHash);
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   row.mobileScreenshot=relative(root,resolve(directory,backend+'-mobile.png')).replaceAll('\\','/');await page.screenshot({path:resolve(root,row.mobileScreenshot),fullPage:true});
   assert.ok(row.assetResponses.some(r=>r.path.startsWith('/specs/v0.1/games/')));assert.equal(row.assetResponses.filter(r=>r.path.startsWith('/specs/v0.1/capabilities/')).length,127);assert.ok(row.assetResponses.every(r=>r.status===200&&!r.path.includes('/samples/')));
   await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);assert.equal(row.disposal.adapter.disposed,true);assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS';
  }catch(e){row.failure=String(e);}finally{await context.close();}cases.push(row);console.log(backend,row.status,row.failure??'');
 }
}catch(e){failure=String(e);}finally{await browser?.close();if(server.listening)await new Promise(ok=>server.close(ok));closed=true;}
const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h),summary={format:'a2game-spec-layout-browser',version:1,status:!failure&&closed&&unchanged&&cases.length===2&&cases.every(c=>c.status==='PASS')?'PASS':'FAIL',scope:'Canonical built-in game URL, 127 capability fetches per SDK, actual keyboard, Node hash, restart, 390px layout and owned resource disposal. No formal G3 or physical-device approval.',closed,unchanged,fingerprints,sdk,cases,failure:failure??null};
writeFileSync(resolve(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(relative(root,resolve(directory,'summary.json')).replaceAll('\\','/'));if(summary.status!=='PASS')process.exitCode=1;
