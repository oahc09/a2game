/** Actual HTTP/SDK/DOM test, with explicitly virtual device inputs. Never physical-device evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {HeadlessRuntime,sha256Canonical,replayNormalizedInputTrace} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const runId=`mobile-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`,directory=resolve(root,'reports',runId);mkdirSync(directory);
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')),save=(name,data)=>writeFileSync(resolve(directory,name),JSON.stringify(data,null,2)+'\n');
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(dir+'/'+entry.name):[dir+'/'+entry.name]);
const hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const fingerprints=Object.fromEntries(['scripts/mobile-browser.mjs','scripts/registry.mjs','scripts/content-service.mjs','scripts/serve.mjs','scripts/turn-room-service.mjs','scripts/asset-policy.mjs','scripts/validate-content.py','project/sdk-lock.json','project/asset-policy.json','package-lock.json',...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/')),...files('specs/v0.1/schemas'),...files('specs/v0.1/samples/capabilities'),...files('specs/v0.1/samples/games')].map(p=>[p,hash(p)]));save('fingerprints.json',fingerprints);
let server,browser,origin,failure,version,physicalClose;const results=[];
async function ready(page){await page.waitForFunction(()=>window.__a2game||document.getElementById('error').textContent,{timeout:60000});assert.equal(await page.locator('#error').textContent(),'');}
try{
 const sdk=read('player/vendor/sdk-provenance.json');for(const item of sdk.files)assert.equal(hash(item.path),item.sha256);save('sdk-provenance.json',sdk);
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',runId,'releases')},stdio:['ignore','pipe','pipe'],windowsHide:true});
 origin=await new Promise((accept,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.once('error',reject);server.stdout.on('data',data=>{text+=String(data);const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);accept(match[0]);}});server.stderr.on('data',data=>appendFileSync(resolve(directory,'server.log'),data));});
 browser=await chromium.launch({headless:true});version=browser.version();
 const definition=read('specs/v0.1/samples/games/mobile-input-lab.game.json'),digest=sha256Canonical(definition);
 for(const backend of ['three','air']){
  const context=await browser.newContext({viewport:backend==='air'?{width:390,height:844}:{width:1280,height:1000},deviceScaleFactor:backend==='air'?2:1,hasTouch:true,acceptDownloads:true});
  await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage(),result={backend,status:'FAIL',errors:[],consoleErrors:[],inputProvenance:{pointer:'CDP virtual touchscreen',orientation:'CDP virtual device orientation',motion:'synthetic DOM DeviceMotionEvent',physicalDevice:'NOT_RUN'}};
  page.on('pageerror',error=>result.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  try{
   await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual`);await ready(page);
   const admitted=await context.request.post(`${origin}/api/releases`,{data:definition});assert.equal(admitted.status(),201,await admitted.text());result.release=await admitted.json();
   await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual&release=${digest}`);await ready(page);
   result.initial=await page.evaluate(()=>window.__a2game.getState());await page.locator('#traceStart').click();
   const cdp=await context.newCDPSession(page),step=ticks=>page.evaluate(t=>window.__a2game.step(t),ticks);
   const bounds=async()=>{await page.locator('#GameCanvas').scrollIntoViewIfNeeded();return page.locator('#GameCanvas').boundingBox();};
   let box=await bounds();
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,u,v])=>({id,x:box.x+box.width*u,y:box.y+box.height*v,radiusX:2,radiusY:2,force:1}))});
   await touch('touchStart',[[1,0.3,0.5],[2,0.7,0.5]]);await step(1);await touch('touchMove',[[1,0.3,0.5],[2,0.75,0.65]]);await step(1);await touch('touchEnd',[]);await step(1);
   result.pair=await page.evaluate(()=>window.__a2game.getState());assert.ok(result.pair.state.pinch>1);assert.ok(result.pair.state.rotate>0);
   await touch('touchStart',[[1,0.3,0.4],[2,0.7,0.4]]);await step(3);await touch('touchCancel',[]);await step(1);assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.multi,1);
   await touch('touchStart',[[1,0.3,0.3]]);await step(1);await touch('touchMove',[[1,0.7,0.7]]);await step(1);await touch('touchEnd',[]);await step(1);
   const dragged=await page.evaluate(()=>window.__a2game.getState());assert.ok(Math.abs(dragged.state.drag[0]-0.7)<0.01);assert.ok(dragged.state.path.points.length>=2);
   await touch('touchStart',[[1,0.5,0.5]]);await step(3);await touch('touchEnd',[]);await step(1);assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.hold,1);
   for(let i=0;i<2;i++){await touch('touchStart',[[1,0.5,0.5]]);await touch('touchEnd',[]);await step(1);}assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.double,1);
   await page.locator('#sensorEnable').click();await page.waitForFunction(()=>document.getElementById('sensorStatus').textContent.includes('未获准'),undefined,{timeout:5000});
   result.permissionDenied={status:await page.locator('#sensorStatus').textContent(),diagnostics:await page.evaluate(()=>window.__a2game.diagnostics().mobile)};assert.equal(result.permissionDenied.diagnostics.enabled,false);
   // Permission is granted only inside this temporary virtual browser context, never on a physical device.
   await context.grantPermissions(['accelerometer','gyroscope'],{origin});result.inputProvenance.permission='temporary virtual Chromium context permission; physical-device permission NOT_RUN';
   await page.locator('#sensorEnable').click();await cdp.send('DeviceOrientation.setDeviceOrientationOverride',{alpha:0,beta:0,gamma:0});
   await page.waitForFunction(()=>window.__a2game.diagnostics().mobile.nativeSamples>0,undefined,{timeout:5000});await page.locator('#sensorCalibrate').click();await step(1);
   const previous=await page.evaluate(()=>window.__a2game.diagnostics().mobile.nativeSamples);
   await cdp.send('DeviceOrientation.setDeviceOrientationOverride',{alpha:0,beta:20,gamma:30});await page.waitForFunction(value=>window.__a2game.diagnostics().mobile.nativeSamples>value,previous);await step(1);
   result.sensor=await page.evaluate(()=>({state:window.__a2game.getState(),diagnostics:window.__a2game.diagnostics().mobile}));assert.ok(result.sensor.state.state.tilt[0]>0.5);
   await page.evaluate(()=>window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:15,y:0,z:0},rotationRate:{alpha:0,beta:0,gamma:0},interval:16})));await step(1);assert.equal((await page.evaluate(()=>window.__a2game.getState())).state.shake,1);
   await page.locator('#sensorStop').click();await step(1);assert.equal((await page.evaluate(()=>window.__a2game.diagnostics())).mobile.listenersActive,false);
   await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__a2game.getState().tickIndex);await step(3);assert.equal(await page.evaluate(()=>window.__a2game.getState().tickIndex),paused);await page.locator('#pause').click();await step(1);
   await page.locator('#traceStop').click();await page.waitForFunction(()=>!window.__a2game.diagnostics().recording.recording);
   result.final=await page.evaluate(()=>window.__a2game.getState());const downloading=page.waitForEvent('download');await page.locator('#traceExport').click();const download=await downloading;
   result.trace=`reports/${runId}/${backend}.input-trace.json`;await download.saveAs(resolve(root,result.trace));const trace=read(result.trace);
   const node=new HeadlessRuntime(definition,makeRegistry());try{result.replay=replayNormalizedInputTrace(node,trace);assert.equal(result.replay.finalHash,result.final.exactHash);}finally{node.dispose();}
   result.browserReplay=await page.evaluate(async trace=>{const {HeadlessRuntime,replayNormalizedInputTrace}=await import('../dist/index.js'),{createBrowserRegistry}=await import('./browser-registry.mjs');const runtime=new HeadlessRuntime(window.__a2game.definition,await createBrowserRegistry());try{return replayNormalizedInputTrace(runtime,trace);}finally{runtime.dispose();}},trace);assert.equal(result.browserReplay.finalHash,result.final.exactHash);
   result.screenshot=`reports/${runId}/${backend}-mobile-final.png`;await page.screenshot({path:resolve(root,result.screenshot),fullPage:true});
   await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);result.restart='PASS';
   await page.evaluate(()=>window.__a2game.dispose());result.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(result.disposal.listenersActive,false);assert.equal(result.disposal.mobile.listenersActive,false);assert.equal(result.disposal.recording.count,0);assert.equal(result.disposal.resources.ownedResources,0);assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);result.status='PASS';
  }catch(error){result.failure=String(error);result.stack=error.stack;result.failureObservation=await page.evaluate(()=>({diagnostics:window.__a2game?.diagnostics(),sensorStatus:document.getElementById('sensorStatus')?.textContent,context:isSecureContext,orientationInterface:typeof DeviceOrientationEvent,motionInterface:typeof DeviceMotionEvent,permissionInterface:typeof DeviceOrientationEvent?.requestPermission})).catch(()=>null);}
  finally{await context.tracing.stop({path:resolve(directory,backend+'-trace.zip')});await context.close();save(backend+'.json',result);results.push(result);console.log(`${result.status} mobile ${backend}${result.failure?': '+result.failure:''}`);}
 }
}catch(error){failure=String(error);}
finally{try{await browser?.close();physicalClose='PASS';}catch(error){physicalClose='FAIL';failure??=String(error);}if(server)await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else{server.once('exit',done);server.kill();}});}
const unchanged=Object.entries(fingerprints).every(([path,digest])=>hash(path)===digest),status=!failure&&unchanged&&physicalClose==='PASS'&&results.length===2&&results.every(row=>row.status==='PASS')?'PASS':'FAIL';
save('summary.json',{format:'a2game-mobile-input-real-sdk',runId,status,browser:version,origin,physicalClose,unchanged,failure,physicalDevice:'NOT_RUN',scope:'Real SDKs and browser pipeline; Touch/Orientation virtualized and Motion synthetic. Not physical Touch/IMU permission/calibration evidence.',fingerprints:`reports/${runId}/fingerprints.json`,sdk:`reports/${runId}/sdk-provenance.json`,cases:results.map(row=>({backend:row.backend,status:row.status,receipt:`reports/${runId}/${row.backend}.json`,trace:row.trace,screenshot:row.screenshot}))});console.log(`${status} mobile reference: reports/${runId}/summary.json`);if(status!=='PASS')process.exitCode=1;
