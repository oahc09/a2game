/** Real HTTP/Chromium SDK gate. Retains every attempt; never substitutes Canvas2D or mocks. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {HeadlessRuntime,sha256Canonical,projectPresentation} from '../dist/index.js';
import {makeRegistry,readJson,spec,root} from './registry.mjs';

const runId=`g2-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`;
const directory=resolve(root,'reports',runId);mkdirSync(directory);
const pathOf=path=>relative(root,path).replaceAll('\\','/');
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n');
const hash=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const sourceFiles=directory=>readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>
  entry.isDirectory()?sourceFiles(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);
const codeFiles=['package-lock.json','project/sdk-lock.json','player/main.mjs','player/index.html','player/browser-registry.mjs',
  ...sourceFiles('player/adapters'),'scripts/g2-real.mjs',
  'scripts/prepare-sdks.mjs','scripts/serve.mjs','scripts/content-service.mjs','scripts/validate-content.py','scripts/asset-policy.mjs','project/asset-policy.json','player/content-loader.mjs','player/resources.mjs',...sourceFiles('assets'),
  'scripts/registry.mjs',...sourceFiles('src'),...sourceFiles('specs/v0.1/samples/games'),...sourceFiles('specs/v0.1/samples/capabilities'),...sourceFiles('specs/v0.1/schemas'),
  ...readdirSync(resolve(root,'dist')).filter(name=>name.endsWith('.js')).map(name=>`dist/${name}`),
  ...readdirSync(resolve(root,'dist/modules')).filter(name=>name.endsWith('.js')).map(name=>`dist/modules/${name}`)];
const fingerprints=Object.fromEntries(codeFiles.map(path=>[path,hash(path)]));
const games=['tap-target','grid-merge','grid-merge-spawn','grid-push'];
const profiles=[{id:'desktop-dpr1',viewport:{width:1230,height:920},deviceScaleFactor:1},
  {id:'mobile-dpr2',viewport:{width:390,height:844},deviceScaleFactor:2}];
const reports=[];let browser,server,url,browserVersion,infrastructureError,physicalClose;

async function startServer(){
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0'},stdio:['ignore','pipe','pipe']});
  return new Promise((accept,reject)=>{
    const timeout=setTimeout(()=>reject(Error('HTTP server startup timed out')),10000);
    server.once('error',error=>{clearTimeout(timeout);reject(error);});
    server.once('exit',code=>{clearTimeout(timeout);reject(Error(`HTTP server exited: ${code}`));});
    server.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);accept(match[0]);}});
  });
}
async function ready(page){
  await page.waitForFunction(()=>window.__a2game||document.getElementById('error')?.textContent,{timeout:60000});
  const error=await page.locator('#error').textContent();assert.equal(error,'',`Player initialization failed: ${error}`);
}
const step=page=>page.evaluate(()=>window.__a2game.step(1));
async function observation(page){return page.evaluate(()=>window.__a2game.getState());}
async function parity(page,definition){
  const operations=await page.evaluate(()=>window.__a2game.getOperations());
  const rt=new HeadlessRuntime(definition,makeRegistry());rt.start();
  try{
    for(const operation of operations){
      if(operation.op==='raw')rt.injectRaw(operation.input);
      else if(operation.op==='action')rt.injectAction(operation.input);
      else if(operation.op==='step')rt.step(operation.ticks);
      else if(['pause','resume','restart'].includes(operation.op))rt[operation.op]();
      else throw Error(`Unknown recorded operation: ${operation.op}`);
    }
    const actual=await observation(page),expected=rt.observe();
    assert.equal(actual.exactHash,expected.exactHash,'Node/Host exactHash mismatch');
    assert.equal(actual.tickIndex,expected.tickIndex);assert.deepEqual(actual.state,expected.state);assert.deepEqual(actual.flow,expected.flow);
    return {status:'PASS',observation:actual,node:{exactHash:expected.exactHash,tickIndex:expected.tickIndex,state:expected.state,flow:expected.flow},operations};
  }finally{rt.dispose();}
}
async function swipe(page,direction){
  const box=await page.locator('#GameCanvas').boundingBox();assert.ok(box);
  const x=box.x+box.width*.5,y=box.y+box.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+(direction==='right'?box.width*.3:0),y-(direction==='up'?box.height*.3:0),{steps:4});
  await page.mouse.up();
}
async function capture(page,name,definition){
  // A compositor screenshot, rather than readPixels or a generated replacement image.
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const path=resolve(directory,`${name}.png`);
  const image=PNG.sync.read(await page.locator('#GameCanvas').screenshot({path}));
  const obs=await observation(page),frame=projectPresentation(definition,obs);
  const scale=Math.min(image.width/frame.width,image.height/frame.height),checks=[];
  for(const candidate of frame.commands.filter(cmd=>cmd.kind!=='text')){
    const x=candidate.at[0]+(candidate.kind==='circle'?candidate.radius*.45:0),y=candidate.at[1];
    if(frame.commands.some(cmd=>cmd.kind==='text'&&Math.abs(y-cmd.at[1])<cmd.fontSize&&Math.abs(x-cmd.at[0])<cmd.text.length*cmd.fontSize*.4))continue;
    let expected=frame.background;
    for(const cmd of frame.commands){
      if(cmd.kind==='rect'&&Math.abs(x-cmd.at[0])<cmd.size[0]/2&&Math.abs(y-cmd.at[1])<cmd.size[1]/2)expected=cmd.fill;
      if(cmd.kind==='circle'&&Math.hypot(x-cmd.at[0],y-cmd.at[1])<cmd.radius)expected=cmd.fill;
    }
    const px=Math.round(image.width/2+x*scale),py=Math.round(image.height/2-y*scale);
    if(px<0||px>=image.width||py<0||py>=image.height)continue;
    const index=(py*image.width+px)*4,actual=Array.from(image.data.subarray(index,index+3));
    const rgb=[1,3,5].map(i=>parseInt(expected.slice(i,i+2),16));
    checks.push({id:candidate.id,x:px,y:py,expected:rgb,actual});
    assert.ok(actual.every((v,i)=>Math.abs(v-rgb[i])<=12),`${name}: pixel ${candidate.id}: ${actual} != ${rgb}`);
  }
  assert.ok(checks.length>=1,`${name}: no visual probes`);
  return {screenshot:pathOf(path),width:image.width,height:image.height,checks};
}
async function scenario(backend,profile,game){
  const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor});
  await context.tracing.start({screenshots:true,snapshots:true});
  const page=await context.newPage(),messages=[],errors=[],responses=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',msg=>{if(['warning','error'].includes(msg.type()))messages.push({type:msg.type(),text:msg.text()});});
  page.on('response',response=>{if(response.url().includes('/vendor/'))responses.push({url:response.url(),status:response.status()});});
  const id=`${backend}-${profile.id}-${game}`,result={id,game,profile:profile.id,status:'FAIL',messages,errors,responses};
  try{
    const definition=readJson(resolve(spec,`samples/games/${game}.game.json`));
    result.gameSha256Jcs=sha256Canonical(definition);result.gameRevision=definition.revision;
    result.url=`${url}/player/index.html?backend=${backend}&game=${game}&clock=manual`;
    await page.goto(result.url,{waitUntil:'load'});await ready(page);
    result.initial=await parity(page,definition);
    result.renderer=await page.locator('#GameCanvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {version:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    });
    const pause=page.locator('#pause');await pause.click();
    const frozen=await observation(page);await page.keyboard.press(game==='tap-target'?'Space':'ArrowRight');
    await page.evaluate(()=>window.advanceTime(1000));assert.deepEqual(await observation(page),frozen);
    await pause.click();result.pauseResume=await parity(page,definition);

    await page.keyboard.press(game==='tap-target'?'Space':game==='grid-push'?'ArrowRight':'ArrowLeft');await step(page);
    result.keyboard=await parity(page,definition);
    if(game==='tap-target'){
      assert.equal(result.keyboard.observation.state.score,1);await page.locator('#GameCanvas').click();
    }else{
      if(game==='grid-push')assert.equal(result.keyboard.observation.state.player,17);
      else assert.equal(result.keyboard.observation.state.board[0],4);
      await swipe(page,game==='grid-push'?'up':'right');
    }
    await step(page);result.pointer=await parity(page,definition);
    if(['tap-target','grid-push'].includes(game))assert.equal(result.pointer.observation.flow.status,'won');
    result.visual=await capture(page,id,definition);
    result.drawingBuffer=await page.locator('#GameCanvas').evaluate(canvas=>({width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:devicePixelRatio}));
    assert.ok(result.drawingBuffer.width>=result.drawingBuffer.cssWidth*profile.deviceScaleFactor-2);

    await page.locator('#restart').click();result.restart=await parity(page,definition);
    assert.deepEqual(result.restart.observation.state,result.initial.observation.state);assert.equal(result.restart.observation.tickIndex,0);
    await page.setViewportSize({width:profile.viewport.height,height:profile.viewport.width});
    result.resized=await capture(page,`${id}-resized`,definition);
    assert.equal((await observation(page)).exactHash,result.restart.observation.exactHash,'Resize changed logical state');

    if(backend==='three'){
      result.rebuild=[];
      for(let i=0;i<3;i++){
        await page.evaluate(()=>window.__a2game.recreateAdapter());
        const diagnostic=await page.evaluate(()=>window.__a2game.diagnostics());
        result.rebuild.push(diagnostic);assert.ok(diagnostic.adapter.ownedMeshes>0);
      }
      const first=result.rebuild[0].adapter.gpu,last=result.rebuild.at(-1).adapter.gpu;
      assert.deepEqual(last,first,'Resources increased across renderer reconstruction');
      result.rebuiltVisual=await capture(page,`${id}-rebuilt`,definition);
    }
    result.beforeDispose=await page.evaluate(()=>window.__a2game.diagnostics());
    await page.evaluate(async()=>{await window.__a2game.dispose();await window.__a2game.dispose();});
    result.disposed=await page.evaluate(()=>window.__a2game.diagnostics());
    assert.equal(result.disposed.listenersActive,false);assert.equal(result.disposed.adapter.disposed,true);
    assert.equal(result.disposed.adapter[backend==='three'?'ownedMeshes':'ownedNodes'],0);
    result.disposedRuntime=await page.evaluate(()=>{try{window.__a2game.runtime.step(1);return 'no error';}catch(error){return error.code;}});
    assert.equal(result.disposedRuntime,'A2G_E_DISPOSED');
    if(backend==='three')assert.deepEqual(result.disposed.adapter.gpu,{geometries:0,textures:0});
    else{
      assert.equal(result.disposed.adapter.release.status,'released');assert.equal(result.disposed.adapter.sceneAlive,false);
      assert.deepEqual(result.disposed.adapter.release.pending,[]);assert.deepEqual(result.disposed.adapter.release.failures,[]);
      result.sameDocumentReinit=await page.evaluate(async()=>{try{await window.__a2game.recreateAdapter();return 'unexpected success';}catch(error){return String(error);}});
      assert.match(result.sameDocumentReinit,/AIR_E_APP_CLOSED/);
    }
    assert.deepEqual(errors,[],'Unexpected page error');
    assert.deepEqual(messages.filter(message=>message.type==='error'),[],'Unexpected console error');
    assert.ok(responses.some(response=>response.status===200&&response.url.endsWith(backend==='three'?'three.module.js':'cocosair.js')));
    assert.ok(responses.every(response=>response.status===200));result.status='PASS';
  }catch(error){
    result.failure={category:'ADAPTER_OR_ENGINE',message:String(error),stack:error.stack};
    await page.screenshot({path:resolve(directory,`${id}-failure.png`),fullPage:true}).catch(()=>{});
  }finally{
    await context.tracing.stop({path:resolve(directory,`${id}-trace.zip`)});
    await context.close();save(`${id}.json`,result);
  }
  console.log(`${result.status} ${id}${result.failure?`: ${result.failure.message}`:''}`);return result;
}

async function nativeAndContext(backend){
  const context=await browser.newContext({viewport:{width:1230,height:920}}),page=await context.newPage();
  const result={id:`${backend}-native-context`,status:'FAIL',errors:[],messages:[]};
  page.on('pageerror',error=>result.errors.push(String(error)));
  page.on('console',msg=>{if(['warning','error'].includes(msg.type()))result.messages.push({type:msg.type(),text:msg.text()});});
  try{
    await page.goto(`${url}/player/index.html?backend=${backend}&game=grid-push`);await ready(page);
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.__a2game.getState().state.moves===1);
    await swipe(page,'up');await page.waitForFunction(()=>window.__a2game.getState().flow.status==='won');
    result.native=await observation(page);assert.equal(result.native.state.solved,true);
    await page.locator('#restart').click();await page.locator('#pause').click();
    const frozen=await observation(page);await page.waitForTimeout(200);assert.deepEqual(await observation(page),frozen);
    await page.locator('#pause').click();await page.waitForFunction(t=>window.__a2game.getState().tickIndex>t,frozen.tickIndex);
    result.nativePauseResume='PASS';
    await page.evaluate(()=>{window.__g2loss=document.getElementById('GameCanvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.__g2loss.loseContext();});
    await page.waitForFunction(()=>window.__a2game.diagnostics().contextState==='lost');
    const lost=await observation(page);assert.equal(lost.flow.status,'paused');
    await page.waitForTimeout(100);assert.deepEqual(await observation(page),lost);
    await page.evaluate(()=>window.__g2loss.restoreContext());
    await page.waitForFunction(()=>window.__a2game.diagnostics().contextState!=='lost');
    result.context=await page.evaluate(()=>window.__a2game.diagnostics());
    assert.equal((await observation(page)).exactHash,lost.exactHash);
    if(backend==='air'){
      assert.equal(result.context.contextState,'reload-required');assert.equal(result.context.adapter.context.state,'failed');
      await Promise.all([page.waitForNavigation(),page.locator('#pause').click()]);await ready(page);
      result.recovery='controlled reload; new session';
    }else{
      assert.equal(result.context.contextState,'healthy');await page.locator('#pause').click();result.recovery='restored; explicit resume';
    }
    const definition=readJson(resolve(spec,'samples/games/grid-push.game.json'));
    result.visual=await capture(page,`${backend}-context-recovered`,definition);
    await page.evaluate(()=>window.__a2game.dispose());assert.deepEqual(result.errors,[]);
    assert.ok(!result.messages.some(message=>/INVALID_OPERATION/.test(message.text)),'WebGL cleanup emitted INVALID_OPERATION');
    result.status='PASS';
  }catch(error){result.failure={category:'ADAPTER_OR_ENGINE',message:String(error),stack:error.stack};}
  finally{await context.close();save(`${result.id}.json`,result);}
  console.log(`${result.status} ${result.id}${result.failure?`: ${result.failure.message}`:''}`);return result;
}

try{
  const sdk=readJson(resolve(root,'player/vendor/sdk-provenance.json'));
  for(const file of sdk.files)assert.equal(hash(file.path),file.sha256,'SDK bytes differ from provenance');
  save('sdk-provenance.json',sdk);save('fingerprints.json',fingerprints);
  url=await startServer();browser=await chromium.launch({headless:true});browserVersion=browser.version();
  for(const backend of ['three','air']){
    const result={format:'a2game-g2-real-sdk',runId,backend,browser:browserVersion,platform:process.platform,
      baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      scope:'scene2d reference subset: four allowlisted JSON games; real WebGL2 SDKs; no physical device/IMU claims',
      traceProfile:'explicit-tick-dom-operations-v1; DOM Pointer/Keyboard capture, public Node runtime replay',
      fingerprints:pathOf(resolve(directory,'fingerprints.json')),sdk:pathOf(resolve(directory,'sdk-provenance.json')),cases:[]};
    for(const profile of profiles)for(const game of games)result.cases.push(await scenario(backend,profile,game));
    result.nativeContext=await nativeAndContext(backend);
    result.status=result.cases.every(c=>c.status==='PASS')&&result.nativeContext.status==='PASS'?'PASS':'FAIL';
    reports.push(result);
  }
}catch(error){infrastructureError=String(error);console.error(infrastructureError);}
finally{
  try{
    const start=Date.now();await browser?.close();physicalClose={status:'PASS',elapsedMs:Date.now()-start};
  }catch(error){physicalClose={status:'FAIL',error:String(error)};}
  if(server){server.kill();await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else server.once('exit',done);});}
}
// Fingerprint again after the run: concurrent edits invalidate the attempt.
const unchanged=Object.entries(fingerprints).every(([path,expected])=>hash(path)===expected);
const crossEngineParity=[];
if(reports.length===2){
  for(const left of reports[0].cases){
    const right=reports[1].cases.find(item=>item.game===left.game&&item.profile===left.profile);
    const checks=['initial','keyboard','pointer','restart'];
    const matched=right&&left.gameSha256Jcs===right.gameSha256Jcs&&checks.every(key=>
      left[key]?.observation?.exactHash&&left[key].observation.exactHash===right[key]?.observation?.exactHash);
    crossEngineParity.push({game:left.game,profile:left.profile,status:matched?'PASS':'FAIL',
      threeHash:left.pointer?.observation?.exactHash,airHash:right?.pointer?.observation?.exactHash});
  }
  if(crossEngineParity.some(item=>item.status!=='PASS'))for(const report of reports)report.status='FAIL';
}
for(const report of reports){
  report.physicalClose=physicalClose;report.fingerprintsUnchanged=unchanged;
  report.crossEngineParity=crossEngineParity;
  if(!unchanged||physicalClose.status!=='PASS')report.status='FAIL';
  save(`${report.backend}-receipt.json`,report);
  const name=report.backend==='air'?'cocosairjs':'threejs';
  writeFileSync(resolve(root,`reports/g2-${name}-real.json`),JSON.stringify({status:report.status,runId,
    receipt:pathOf(resolve(directory,`${report.backend}-receipt.json`)),scope:report.scope},null,2)+'\n');
}
const status=!infrastructureError&&reports.length===2&&reports.every(report=>report.status==='PASS')?'PASS':infrastructureError?'BLOCKED':'FAIL';
save('summary.json',{status,runId,url,browser:browserVersion,physicalClose,unchanged,infrastructureError,crossEngineParity,
  reports:reports.map(report=>({backend:report.backend,status:report.status,cases:report.cases.length}))});
console.log(`${status} real SDK G2: ${pathOf(directory)}`);
if(status!=='PASS')process.exitCode=1;
