/** Arbitrary generated solution + all bounded cases; no three-click fixture assumption. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
import {checkG3SuiteBudget,executeG3Case} from './g3-playthrough.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const files=p=>readdirSync(resolve(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]);
export async function verifyGeneratedBrowser(workflow,directory){
 workflow=resolve(workflow);directory??=resolve(root,'reports','g3-browser-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);assert.ok(!existsSync(directory));mkdirSync(directory,{recursive:true});
 const summary=read(resolve(workflow,'summary.json'));assert.equal(summary.status,'PASS_REFERENCE');
 const output=read(resolve(workflow,`output-${summary.attempts.at(-1).attempt}.json`)),bundle=read(resolve(workflow,'debug-bundle.json'));assert.deepEqual(output.game,bundle.game);checkG3SuiteBudget(output.conformance);
 const fingerprints=Object.fromEntries(['scripts/g3-browser.mjs','scripts/g3-playthrough.mjs','generator/adapters/model-generator.mjs','generator/adapters/http-generator.mjs','scripts/agent-workflow.mjs','scripts/agent-solver.mjs','scripts/parse-agent-output.py','scripts/validate-agent-suite.py','scripts/registry.mjs','scripts/content-service.mjs','scripts/validate-content.py','scripts/serve.mjs','scripts/asset-policy.mjs','scripts/turn-room-service.mjs','project/asset-policy.json','project/sdk-lock.json',...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/')),...files('specs/v0.1/schemas'),...files('specs/v0.1/capabilities')].map(p=>[p,hash(p)]));save(resolve(directory,'fingerprints.json'),fingerprints);
 const cases=[];let server,browser,version,origin,failure,closed=false;
 try{
  const sdk=read(resolve(root,'player/vendor/sdk-provenance.json'));for(const f of sdk.files)assert.equal(hash(f.path),f.sha256);save(resolve(directory,'sdk-provenance.json'),sdk);
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',relative(root,directory),'releases')},stdio:['ignore','pipe','pipe'],windowsHide:true});
  origin=await new Promise((accept,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('HTTP 服务启动超时。')),10000);server.once('error',e=>{clearTimeout(timer);reject(e);});server.once('exit',()=>{clearTimeout(timer);reject(Error('HTTP 服务提前退出。'));});server.stderr.on('data',()=>{});server.stdout.on('data',s=>{out+=s;const match=out.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);accept(match[0]);}});});
  browser=await chromium.launch({headless:true});version=browser.version();
  for(const backend of ['three','air']){
   const context=await browser.newContext({viewport:{width:1100,height:1000}}),page=await context.newPage(),row={backend,status:'FAIL',errors:[],consoleErrors:[]};
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   try{
    await page.goto(origin+'/player/inspect.html');await page.selectOption('#backend',backend);await page.locator('#bundle').setInputFiles(resolve(workflow,'debug-bundle.json'));
    await page.waitForFunction(()=>!window.__a2gameInspector.state().busy&&/^[a-f0-9]{64}$/.test(window.__a2gameInspector.state().hash),null,{timeout:60000});const frame=page.frames().find(f=>f.url().includes('/player/index.html'));assert.ok(frame);
    row.initial=await frame.evaluate(()=>window.__a2game.getState());assert.equal(row.initial.flow.status,'playing');
    await frame.locator('#pause').click();const paused=await frame.evaluate(()=>window.__a2game.getState());await frame.evaluate(()=>window.__a2game.step(3));assert.equal((await frame.evaluate(()=>window.__a2game.getState())).exactHash,paused.exactHash);await frame.locator('#pause').click();await frame.locator('#restart').click();assert.equal((await frame.evaluate(()=>window.__a2game.getState())).exactHash,row.initial.exactHash);row.pause='PASS';
    const initialPath=resolve(directory,backend+'-initial.png');await frame.locator('#GameCanvas').screenshot({path:initialPath});const png=PNG.sync.read(readFileSync(initialPath)),colors=new Set();for(let i=0;i<png.data.length;i+=4)colors.add((png.data[i]>>4)*256+(png.data[i+1]>>4)*16+(png.data[i+2]>>4));assert.ok(colors.size>4,'画布缺少有效内容。');row.visibleColors=colors.size;
    await page.evaluate(n=>window.__a2gameInspector.seek(n),bundle.solution.length);row.final=await frame.evaluate(()=>window.__a2game.getState());assert.equal(row.final.flow.status,'won');assert.equal(row.final.exactHash,read(resolve(workflow,'playability.json')).final.exactHash);
    await frame.locator('#GameCanvas').screenshot({path:resolve(directory,backend+'-won.png')});
    await page.evaluate(()=>window.__a2gameInspector.seek(0));assert.equal((await frame.evaluate(()=>window.__a2game.getState())).exactHash,row.initial.exactHash);row.rewind='PASS';
    row.conformance=[];
    for(const c of output.conformance.cases){await frame.locator('#restart').click();const actual=await frame.evaluate(executeG3Case,c),runtime=new HeadlessRuntime(bundle.game,makeRegistry());try{const expected=executeG3Case(c,{runtime,step:n=>runtime.step(n)});assert.deepEqual(actual,expected);}finally{runtime.dispose();}row.conformance.push(actual);}
    await frame.locator('#restart').click();await frame.evaluate(()=>window.__a2game.step(1));
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(directory,backend+'-mobile.png'),fullPage:true});
    await frame.evaluate(()=>window.__a2game.dispose());row.disposal=await frame.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.adapter.disposed,true);assert.equal(row.disposal.listenersActive,false);assert.equal(row.disposal.resources.ownedResources,0);assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS';
   }catch(e){row.failure=String(e);row.stack=e.stack;}finally{save(resolve(directory,backend+'.json'),row);await context.close();}cases.push(row);console.log(row.status,backend,row.failure??'');
  }
 }catch(e){failure=String(e);}finally{try{await browser?.close();closed=true;}catch(e){failure??=String(e);}if(server)await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else{server.once('exit',done);server.kill();}});}
 const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h),parity=cases.length===2&&cases.every(c=>c.status==='PASS')&&cases[0].final.exactHash===cases[1].final.exactHash;
 const artifact=p=>relative(root,resolve(directory,p)).replaceAll('\\','/');
 const result={format:'a2game-g3-browser',version:1,status:!failure&&closed&&unchanged&&parity?'PASS':'FAIL',browser:version,origin,workflow:relative(root,workflow).replaceAll('\\','/'),provenance:summary.provenance,scope:'Generated solution and positive/negative Conformance replay with real SDKs; semantic/human/independence/physical approval remains separate.',G3:'NOT_RUN',unchanged,closed,parity,failure,fingerprints:artifact('fingerprints.json'),sdk:artifact('sdk-provenance.json'),cases:cases.map(c=>({backend:c.backend,status:c.status,receipt:artifact(c.backend+'.json'),screenshots:['initial','won','mobile'].map(s=>artifact(c.backend+'-'+s+'.png'))}))};save(resolve(directory,'summary.json'),result);return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const result=await verifyGeneratedBrowser(process.argv[2]);console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;}catch(e){console.error('A2G_E_G3_BROWSER：'+e.message);process.exitCode=1;}
