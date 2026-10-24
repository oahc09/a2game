/** Real pointer controls and Node replay for the shared puzzle library; never dispatches gameplay by game name. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const suite=process.argv.find(a=>a.startsWith('--suite='))?.slice(8)??'realtime';if(!/^[a-z-]+$/.test(suite))throw Error('Invalid mechanism suite');
const runId=`${suite}-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`,directory=resolve(root,'reports',runId);mkdirSync(directory);
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8')),save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n');
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(dir+'/'+item.name):[dir+'/'+item.name]);
const hash=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const fingerprints=Object.fromEntries(['scripts/mechanism-browser.mjs','scripts/registry.mjs','scripts/content-service.mjs','scripts/asset-policy.mjs','scripts/serve.mjs','scripts/turn-room-service.mjs','scripts/validate-content.py',`project/${suite}-reference-cases.json`,'project/asset-policy.json','project/sdk-lock.json','package-lock.json',...files('src'),...files('dist').filter(path=>path.endsWith('.js')),...files('player').filter(path=>!path.startsWith('player/vendor/')),...files('specs/v0.1/schemas'),...files('specs/v0.1/samples/capabilities'),...files('specs/v0.1/samples/games')].map(path=>[path,hash(path)]));save('fingerprints.json',fingerprints);
const recipes=read(`project/${suite}-reference-cases.json`).cases,results=[];let browser,server,origin,version,failure,physicalClose;
async function startServer(){
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',runId,'releases')},stdio:['ignore','pipe','pipe'],windowsHide:true});
  return new Promise((accept,reject)=>{let output='';const timeout=setTimeout(()=>reject(Error('HTTP startup timed out')),10000);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));server.stderr.on('data',data=>appendFileSync(resolve(directory,'server.log'),data));server.stdout.on('data',data=>{output+=String(data);const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);accept(match[0]);}});});
}
async function ready(page){await page.waitForFunction(()=>window.__a2game||document.getElementById('error').textContent,{timeout:60000});assert.equal(await page.locator('#error').textContent(),'');}
try{
  const sdk=read('player/vendor/sdk-provenance.json');for(const file of sdk.files)assert.equal(hash(file.path),file.sha256);save('sdk-provenance.json',sdk);
  origin=await startServer();browser=await chromium.launch({headless:true});version=browser.version();
  for(const backend of ['three','air']){
    const context=await browser.newContext({viewport:backend==='air'?{width:390,height:844}:{width:1230,height:1000},deviceScaleFactor:backend==='air'?2:1});
    await context.tracing.start({screenshots:true,snapshots:true});
    try{for(const recipe of recipes){
      const result={backend,name:recipe.name,status:'FAIL',errors:[],messages:[]},page=await context.newPage();
      page.on('pageerror',error=>result.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')result.messages.push(message.text());});
      try{
        const game=read(`specs/v0.1/samples/games/${recipe.name}.game.json`);result.sha256Jcs=sha256Canonical(game);
        await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual`);await ready(page);
        const response=await context.request.post(`${origin}/api/releases`,{data:game});assert.equal(response.status(),201,await response.text());result.release=await response.json();
        await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual&release=${result.sha256Jcs}`);await ready(page);
        result.initial=await page.evaluate(()=>window.__a2game.getState());result.initialScreenshot=`reports/${runId}/${backend}-${recipe.name}-initial.png`;
        await page.screenshot({path:resolve(root,result.initialScreenshot),fullPage:true});
        await page.locator('#pause').click();await page.evaluate(()=>window.__a2game.step(3));assert.equal((await page.evaluate(()=>window.__a2game.getState())).tickIndex,0);await page.locator('#pause').click();
        for(const row of recipe.steps){if(row.action)await page.locator(`[data-action="${row.action}"]`).click();await page.evaluate(ticks=>window.__a2game.step(ticks),row.ticks);}
        result.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(result.final.flow.status,recipe.expected);for(const check of recipe.checks??[]){const value=check.path.split('/').slice(1).reduce((obj,key)=>obj[key],result.final.state);assert.deepEqual(value,check.equals,check.path);}
        result.operations=await page.evaluate(()=>window.__a2game.getOperations());
        const node=new HeadlessRuntime(game,makeRegistry());node.start();try{
          for(const operation of result.operations){if(operation.op==='action')node.injectAction(operation.input);else if(operation.op==='raw')node.injectRaw(operation.input);else if(operation.op==='step')node.step(operation.ticks);else node[operation.op]();}
          result.node=node.observe();assert.equal(result.final.exactHash,result.node.exactHash);
        }finally{node.dispose();}
        result.screenshot=`reports/${runId}/${backend}-${recipe.name}-final.png`;await page.screenshot({path:resolve(root,result.screenshot),fullPage:true});
        await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);result.restart='PASS';
        await page.evaluate(()=>window.__a2game.dispose());result.disposal=await page.evaluate(()=>window.__a2game.diagnostics());
        assert.equal(result.disposal.listenersActive,false);assert.equal(result.disposal.resources.ownedResources,0);assert.equal(result.disposal.adapter.disposed,true);
        assert.equal(backend==='three'?result.disposal.adapter.ownedMeshes:result.disposal.adapter.ownedNodes,0);
        assert.deepEqual(result.errors,[]);assert.deepEqual(result.messages,[]);result.status='PASS';
      }catch(error){result.failure=String(error);result.stack=error.stack;}
      finally{await page.close();save(`${backend}-${recipe.name}.json`,result);}
      results.push(result);console.log(`${result.status} ${backend} ${recipe.name}${result.failure?': '+result.failure:''}`);
    }}finally{await context.tracing.stop({path:resolve(directory,`${backend}-trace.zip`)});await context.close();}
  }
}catch(error){failure=String(error);}
finally{
  try{await browser?.close();physicalClose='PASS';}catch(error){physicalClose='FAIL';failure??=String(error);}
  if(server){await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else{server.once('exit',done);server.kill();}});}
}
const parity=recipes.map(recipe=>{const a=results.find(item=>item.backend==='three'&&item.name===recipe.name),b=results.find(item=>item.backend==='air'&&item.name===recipe.name);return {name:recipe.name,status:a?.status==='PASS'&&b?.status==='PASS'&&a.final.exactHash===b.final.exactHash?'PASS':'FAIL'};});
const unchanged=Object.entries(fingerprints).every(([path,digest])=>hash(path)===digest),status=!failure&&unchanged&&physicalClose==='PASS'&&results.length===recipes.length*2&&results.every(item=>item.status==='PASS')&&parity.every(item=>item.status==='PASS')?'PASS':'FAIL';
save('summary.json',{format:'a2game-mechanism-real-sdk',runId,suite,status,browser:version,origin,unchanged,physicalClose,failure,fingerprints:`reports/${runId}/fingerprints.json`,sdk:`reports/${runId}/sdk-provenance.json`,scope:'Shared fixed-tick mechanism references; not complete Gxx/Hxx/Agent or real-device Touch/IMU coverage',parity,cases:results.map(item=>({backend:item.backend,name:item.name,status:item.status,receipt:`reports/${runId}/${item.backend}-${item.name}.json`,screenshot:item.screenshot}))});
console.log(`${status} ${suite} mechanisms: reports/${runId}/summary.json`);if(status!=='PASS')process.exitCode=1;
