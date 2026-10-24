/** Real SDK browser proof for unlisted JSON admission, rejection, replay and backend switching. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PNG} from 'pngjs';
import {chromium} from 'playwright';
import {HeadlessRuntime,sha256Canonical,CONTENT_PROFILE} from '../dist/index.js';
import {makeRegistry,readJson,spec,root} from './registry.mjs';
import {resolve} from 'node:path';

const visualStage=process.argv.includes('--stage');
const orthographic=process.argv.includes('--orthographic');
const runId=`${visualStage?'visual-stage':'content'}-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`;
const directory=resolve(root,'reports',runId);mkdirSync(directory);
const storageDirectory=resolve(root,'.tools',runId,'releases');
const save=(name,data)=>writeFileSync(resolve(directory,name),JSON.stringify(data,null,2)+'\n');
const files=directory=>readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(`${directory}/${item.name}`):[`${directory}/${item.name}`]);
const code=['scripts/content-browser.mjs','scripts/content-service.mjs','scripts/validate-content.py','scripts/serve.mjs',
  'scripts/registry.mjs','scripts/asset-policy.mjs','project/asset-policy.json','player/resources.mjs','player/content-loader.mjs','player/main.mjs','player/mobile-host.mjs','player/index.html','player/browser-registry.mjs','player/capability-index.json',...files('assets'),
  ...files('player/adapters'),...files('src'),...files('dist').filter(path=>path.endsWith('.js')),...files('specs/v0.1/schemas'),...files('specs/v0.1/samples/capabilities')];
const hash=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const fingerprints=Object.fromEntries(code.map(path=>[path,hash(path)]));save('fingerprints.json',fingerprints);
const game=readJson(resolve(spec,`samples/games/${visualStage?'visual-stage':'tap-target'}.game.json`));
game.id=visualStage?'org.a2game.imported.visual-stage':'org.a2game.imported.three-taps';game.revision=1;game.meta.title=visualStage?'通用 3D Stage · 三次点击获胜':'动态导入 · 三次点击获胜';
game.state.goal.initial=3;game.presentation.scene2d.nodes.find(node=>node.id==='title').text.literal=visualStage?'A2Game / Shared 3D Stage':'Imported / Three taps';
if(visualStage&&orthographic){game.presentation.stage.camera.projection='orthographic';game.presentation.stage.camera.at=[0,0,8];game.presentation.stage.camera.orthoHeight=8;game.world.dimension='2d';}
if(!visualStage)game.assets=Object.fromEntries(readJson(resolve(root,'project/asset-policy.json')).entries.map((entry,index)=>[`fixture${index}`,{uri:entry.uri,type:entry.type,integrity:entry.integrity}]));
save('input.game.json',game);
const payload=value=>({name:'imported.game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
const cases=[];let browser,server,origin,browserVersion,failure,physicalClose;
const serverStops=[];
async function startServer(port=0){
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:String(port),A2GAME_CONTENT_DIR:storageDirectory},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const child=server;let output='';
  return new Promise((accept,reject)=>{
    const timeout=setTimeout(()=>reject(Error('HTTP server startup timed out')),10000);
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',code=>{clearTimeout(timeout);reject(Error(`HTTP server exited: ${code}`));});
    child.stderr.on('data',data=>appendFileSync(resolve(directory,'server-output.log'),data));
    child.stdout.on('data',data=>{output+=String(data);const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);accept(match[0]);}});
  });
}
async function stopServer(){
  if(!server)return;
  const child=server;
  await new Promise(done=>{if(child.exitCode!==null||child.signalCode!==null)done();else{child.once('exit',done);child.kill();}});
  const result={pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode};serverStops.push(result);server=undefined;return result;
}
async function ready(page){
  await page.waitForFunction(()=>window.__a2game||document.getElementById('error').textContent,{timeout:60000});
  assert.equal(await page.locator('#error').textContent(),'');
}
async function upload(page,definition){
  const [response]=await Promise.all([page.waitForResponse(response=>response.url()===`${origin}/api/releases`&&response.request().method()==='POST'),page.locator('#importGame').setInputFiles(payload(definition))]);
  assert.equal(response.status(),201,response.status()===201?'':await response.text());
  await page.waitForURL(url=>url.searchParams.has('release'));
  await ready(page);
}
try{
  const sdk=readJson(resolve(root,'player/vendor/sdk-provenance.json'));
  for(const file of sdk.files)assert.equal(hash(file.path),file.sha256);save('sdk-provenance.json',sdk);
  origin=await startServer();
  browser=await chromium.launch({headless:true});browserVersion=browser.version();
  for(const backend of ['three','air']){
    const context=await browser.newContext({viewport:backend==='air'?{width:390,height:844}:{width:1230,height:920},deviceScaleFactor:backend==='air'?2:1});
    await context.tracing.start({screenshots:true,snapshots:true});
    const page=await context.newPage(),result={backend,status:'FAIL',errors:[],messages:[],warnings:[]};
    if(visualStage)await page.addInitScript(()=>{
      const Native=window.AudioContext??window.webkitAudioContext;window.__nativeAudio=[];
      if(Native){const Wrapped=class extends Native{constructor(...args){super(...args);const evidence={context:this,starts:0};window.__nativeAudio.push(evidence);const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{evidence.starts++;return start(...args);};return source;};}};window.AudioContext=Wrapped;if(window.webkitAudioContext)window.webkitAudioContext=Wrapped;}
    });
    page.on('pageerror',error=>result.errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')result.messages.push(message.text());});
    page.on('console',message=>{if(message.type()==='warning')result.warnings.push(message.text());});
    try{
      await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual`);await ready(page);
      await upload(page,game);
      result.release=await (await context.request.get(`${origin}/api/releases/${sha256Canonical(game)}`)).json();
      assert.equal(result.release.receipt.status,'PASS');assert.deepEqual(result.release.definition,game);
      result.resources=await page.evaluate(()=>window.__a2game.diagnostics().resources);assert.equal(result.resources.ownedResources,2);assert.equal(result.resources.decodedImages,1);
      assert.equal(await page.locator('#game').inputValue(),'imported');
      assert.match(await page.locator('#importStatus').textContent(),/已校验并加载/);
      result.initial=await page.evaluate(()=>window.__a2game.getState());
      if(visualStage){
        const canvas=page.locator('#GameCanvas'),before=PNG.sync.read(await canvas.screenshot());
        await page.evaluate(()=>window.__a2game.step(15));await page.waitForTimeout(100);
        const after=PNG.sync.read(await canvas.screenshot());let changed=0;for(let i=0;i<before.data.length;i+=4)if(Math.abs(before.data[i]-after.data[i])+Math.abs(before.data[i+1]-after.data[i+1])+Math.abs(before.data[i+2]-after.data[i+2])>30)changed++;
        assert.ok(changed>100,'Tick-projected 3D animation must change real pixels');
        const depth=Math.hypot(1.5,8),scale=orthographic?after.height/game.presentation.stage.camera.orthoHeight:after.height/(2*depth*Math.tan(45*Math.PI/360));
        const probes=[-1.2,1.2].map(x=>{const px=Math.round(after.width/2+x*scale),py=Math.round(after.height/2),index=(py*after.width+px)*4;const rgb=Array.from(after.data.subarray(index,index+3));return {x:px,y:py,rgb,visible:Math.abs(rgb[0]-13)+Math.abs(rgb[1]-23)+Math.abs(rgb[2]-41)>40};});
        assert.ok(probes.every(probe=>probe.visible),'Mesh and textured sprite must both be visible');
        result.visualStage={status:'PASS',changedPixels:changed,probes};
      }
      await page.keyboard.press('Space');await page.evaluate(()=>window.__a2game.step(1));
      for(let index=0;index<2;index++){await page.locator('#GameCanvas').click();await page.evaluate(()=>window.__a2game.step(1));}
      result.operations=await page.evaluate(()=>window.__a2game.getOperations());
      result.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(result.final.flow.status,'won');assert.equal(result.final.state.score,3);
      if(visualStage){
        await page.waitForTimeout(150);
        result.audio=await page.evaluate(()=>({sdk:window.__a2game.diagnostics().adapter.stage.audio,native:window.__nativeAudio.map(row=>({state:row.context.state,time:row.context.currentTime,starts:row.starts}))}));
        assert.ok(result.audio.native.some(row=>row.starts>0&&row.state==='running'&&row.time>0),'Real SDK audio must start a native AudioBufferSourceNode with an advancing context');
      }
      const node=new HeadlessRuntime(game,makeRegistry());node.start();
      try{
        for(const op of result.operations){if(op.op==='action')node.injectAction(op.input);else if(op.op==='raw')node.injectRaw(op.input);else if(op.op==='step')node.step(op.ticks);else node[op.op]();}
        result.node=node.observe();assert.equal(result.final.exactHash,result.node.exactHash);
      }finally{node.dispose();}
      const path=resolve(directory,`${backend}-imported.png`);await page.screenshot({path,fullPage:true});result.screenshot=`reports/${runId}/${backend}-imported.png`;
      if(visualStage){
        const previous=page.viewportSize();await page.setViewportSize({width:backend==='air'?844:900,height:backend==='air'?390:700});await page.waitForTimeout(150);
        result.visualStage.resizedScreenshot=`reports/${runId}/${backend}-resized.png`;await page.screenshot({path:resolve(directory,`${backend}-resized.png`),fullPage:true});
        assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.final.exactHash);await page.setViewportSize(previous);await page.waitForTimeout(100);
      }
      const downloadPromise=page.waitForEvent('download');await page.locator('#exportGame').click();const download=await downloadPromise;
      const bundle=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(bundle.sha256Jcs,sha256Canonical(game));
      save(`${backend}.bundle.json`,bundle);
      await Promise.all([page.waitForNavigation(),page.locator('#importGame').setInputFiles(payload(bundle))]);await ready(page);
      assert.equal((await page.evaluate(()=>window.__a2game.getState())).exactHash,result.initial.exactHash);
      // Re-establish the final hash before checking that rejected content leaves the running game intact.
      for(let i=0;i<3;i++){await page.keyboard.press('Space');await page.evaluate(()=>window.__a2game.step(1));}
      const beforeRejection=await page.evaluate(()=>window.__a2game.getHash());
      result.bundleTransfer={status:'PASS',sha256Jcs:bundle.sha256Jcs,resources:bundle.resources.length};
      result.rejections=[];
      for(const [expected,change] of [
        ['A2G_E_SCHEMA',invalid=>{invalid.presentation.hud[0].arbitrary=true;}],
        ['A2G_E_CAP_UNKNOWN',invalid=>{invalid.requires.all.push({id:'org.example.unimplemented',version:'0.1.0'});}]
      ]){
        const invalid=structuredClone(game);change(invalid);
        await page.locator('#importGame').setInputFiles(payload(invalid));
        await page.waitForFunction(code=>document.getElementById('importStatus').textContent.includes(code),expected);
        assert.equal(await page.evaluate(()=>window.__a2game.getHash()),beforeRejection);
        result.rejections.push({code:expected,feedback:await page.locator('#importStatus').textContent()});
      }
      // A failed import must leave the picker usable; admitting the original content works again.
      await Promise.all([page.waitForNavigation(),page.locator('#importGame').setInputFiles(payload(game))]);await ready(page);
      assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.score,0);
      const other=backend==='three'?'air':'three';
      await Promise.all([page.waitForNavigation(),page.locator('#backend').selectOption(other)]);await ready(page);
      result.backendSwitch=await page.evaluate(()=>({backend:window.__a2game.backend,id:window.__a2game.definition.id,state:window.__a2game.getState()}));
      assert.equal(result.backendSwitch.backend,other);assert.equal(result.backendSwitch.id,game.id);
      assert.equal(result.backendSwitch.state.exactHash,result.initial.exactHash);
      const previousPid=server.pid,port=Number(new URL(origin).port),stopped=await stopServer();
      assert.equal(await startServer(port),origin);assert.notEqual(server.pid,previousPid);
      await page.reload();await ready(page);
      const afterRestart=await page.evaluate(()=>window.__a2game.getState());
      const restored=await (await context.request.get(`${origin}/api/releases/${sha256Canonical(game)}`)).json();
      assert.deepEqual(restored,result.release);assert.equal(afterRestart.exactHash,result.initial.exactHash);
      await page.keyboard.press('Space');await page.evaluate(()=>window.__a2game.step(1));
      assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.score,1);
      result.persistentRestart={status:'PASS',previousPid,pid:server.pid,stopped,receiptUnchanged:true,initialHash:afterRestart.exactHash,inputAfterRestart:'PASS'};
      if(visualStage){
        const beforeLoss=await page.evaluate(()=>window.__a2game.runtime.snapshot());
        const reference=new HeadlessRuntime(game,makeRegistry());reference.restore(beforeLoss);reference.pause();reference.resume();const expectedAfterResume=reference.observe().exactHash;reference.dispose();
        await page.evaluate(()=>{const gl=document.getElementById('GameCanvas').getContext('webgl2');window.__loseStageContext=gl.getExtension('WEBGL_lose_context');window.__loseStageContext.loseContext();});
        await page.waitForFunction(()=>['lost','reload-required'].includes(window.__a2game.diagnostics().contextState));await page.waitForTimeout(100);
        await page.evaluate(()=>window.__loseStageContext.restoreContext());
        await page.waitForFunction(()=>['healthy','reload-required'].includes(window.__a2game.diagnostics().contextState));
        if(other==='air'){await Promise.all([page.waitForNavigation(),page.locator('#pause').click()]);await ready(page);assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);}
        else{await page.locator('#pause').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),expectedAfterResume);}
        result.contextLoss={status:'PASS',backend:other,recovery:other==='air'?'controlled reload':'restored resources and explicit resume',expectedHash:other==='air'?result.initial.exactHash:expectedAfterResume,actualHash:await page.evaluate(()=>window.__a2game.getHash())};
      }
      await page.evaluate(()=>window.__a2game.dispose());result.resourceRelease=await page.evaluate(()=>window.__a2game.diagnostics().resources);assert.equal(result.resourceRelease.ownedResources,0);assert.equal(result.resourceRelease.disposed,true);assert.deepEqual(result.errors,[]);
      if(visualStage){result.stageRelease=await page.evaluate(()=>window.__a2game.diagnostics().adapter.stage);assert.equal(result.stageRelease.ownedMeshes,0);assert.equal(result.stageRelease.audio.ownedSources,0);}
      assert.ok(result.messages.every(message=>/status of 422/.test(message)),'Unexpected console error');
      assert.ok(!result.warnings.some(message=>/INVALID_OPERATION/.test(message)),'WebGL cleanup warning');
      result.status='PASS';
    }catch(error){result.failure=String(error);result.stack=error.stack;}
    finally{await context.tracing.stop({path:resolve(directory,`${backend}-trace.zip`)});await context.close();save(`${backend}.json`,result);}
    cases.push(result);console.log(`${result.status} dynamic import ${backend}${result.failure?`: ${result.failure}`:''}`);
  }
}catch(error){failure=String(error);}
finally{
  try{await browser?.close();physicalClose='PASS';}catch(error){physicalClose='FAIL';failure??=String(error);}
  await stopServer();
}
const unchanged=Object.entries(fingerprints).every(([path,digest])=>hash(path)===digest);
const parity=cases.length===2&&cases[0].final?.exactHash&&cases[0].final.exactHash===cases[1].final?.exactHash;
const persistentRestart=cases.length===2&&cases.every(item=>item.persistentRestart?.status==='PASS');
const status=!failure&&unchanged&&parity&&persistentRestart&&physicalClose==='PASS'&&cases.every(item=>item.status==='PASS')?'PASS':'FAIL';
save('summary.json',{format:'a2game-content-admission-browser',runId,status,profile:CONTENT_PROFILE,visualStage,projection:visualStage?(orthographic?'orthographic':'perspective'):undefined,browser:browserVersion,
  unchanged,physicalClose,nodeThreeAirParity:parity,persistentRestart,serverStops,sha256Jcs:sha256Canonical(game),failure,
  fingerprints:`reports/${runId}/fingerprints.json`,sdk:`reports/${runId}/sdk-provenance.json`,
  cases:cases.map(item=>({backend:item.backend,status:item.status,receipt:`reports/${runId}/${item.backend}.json`,screenshot:item.screenshot}))});
console.log(`${status} content admission: reports/${runId}/summary.json`);
if(status!=='PASS')process.exitCode=1;
