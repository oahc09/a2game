/** Real SDKs, unchanged JSON, bounded release batches, positive/negative outcomes and Node replay. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {inputGameplayBrowser} from './input-gameplay-browser.mjs';
import {inspectPlayerQuality} from './player-quality.mjs';
import {fullGameplayBrowser} from './full-gameplay-browser.mjs';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8')),hash=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const variants=process.argv.includes('--variants'),recipeFile=variants?'project/rule-variants.json':'project/game-candidates.json';
const runId=`${variants?'variants':'candidates'}-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`,directory=resolve(root,'reports',runId);mkdirSync(directory);
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n');
const files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(dir+'/'+item.name):[dir+'/'+item.name]);
const fingerprints=Object.fromEntries(['scripts/player-quality.mjs','scripts/input-gameplay-browser.mjs','project/input-gameplay-profiles.json','scripts/full-gameplay-browser.mjs','scripts/candidates-browser.mjs','scripts/registry.mjs','scripts/content-service.mjs','scripts/asset-policy.mjs','scripts/serve.mjs','scripts/turn-room-service.mjs','scripts/validate-content.py','project/game-candidates.json','project/gameplay-acceptance.json','project/asset-policy.json','project/sdk-lock.json','package-lock.json',...files('src'),...files('dist').filter(p=>p.endsWith('.js')),...files('player').filter(p=>!p.startsWith('player/vendor/')),...files('specs/v0.1/schemas'),...files('specs/v0.1/capabilities'),...files('specs/v0.1/games')].map(p=>[p,hash(p)]));save('fingerprints.json',fingerprints);
if(variants){fingerprints[recipeFile]=hash(recipeFile);save('fingerprints.json',fingerprints);}
const requested=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(','),allRecipes=read(recipeFile).cases;
if(requested)assert.ok(requested.length>0&&new Set(requested).size===requested.length&&requested.every(id=>allRecipes.some(r=>r.id===id)),'Unknown or duplicate focused game id');
const recipes=requested?allRecipes.filter(r=>requested.includes(r.id)):allRecipes,results=[],batchSize=12;let browser,server,origin,failure,physicalClose,version;
async function startServer(batch){server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',runId,'batch-'+batch)},stdio:['ignore','pipe','pipe'],windowsHide:true});return new Promise((accept,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('HTTP startup timed out')),10000);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));server.stderr.on('data',data=>appendFileSync(resolve(directory,'server.log'),data));server.stdout.on('data',data=>{text+=data;const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);accept(match[0]);}});});}
async function stopServer(){if(server)await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else{server.once('exit',done);server.kill();}});server=undefined;}
async function ready(page){await page.waitForFunction(()=>window.__a2game||document.getElementById('error').textContent,{timeout:60000});assert.equal(await page.locator('#error').textContent(),'');}
// A restart has the initial exact hash; earlier completed sessions cannot affect its suffix.
const replayCache=new Map();let nodeReplayExecutions=0,nodeReplayCacheHits=0;
function replay(game,operations){operations=operations.slice(operations.findLastIndex(op=>op.op==='restart')+1);const key=sha256Canonical({game,operations});if(replayCache.has(key)){nodeReplayCacheHits++;return structuredClone(replayCache.get(key));}const r=new HeadlessRuntime(game,makeRegistry());r.start();try{for(const op of operations){if(op.op==='action')r.injectAction(op.input);else if(op.op==='raw')r.injectRaw(op.input);else if(op.op==='step')r.step(op.ticks);else r[op.op]();}const observation=r.observe();nodeReplayExecutions++;if(replayCache.size>=512)replayCache.delete(replayCache.keys().next().value);replayCache.set(key,observation);return structuredClone(observation);}finally{r.dispose();}}

async function execute(page,rows,prefix){
 const checkpoints=[];
 for(const row of rows){
  if(row.pause)await page.locator('#pause').click();
  if(row.action){if(row.value!==undefined)await page.evaluate(row=>{window.__a2game.injectAction({action:row.action,phase:'press',value:row.value});window.__a2game.injectAction({action:row.action,phase:'release'});},row);else await page.locator('[data-action="'+row.action+'"]').click();}
  for(const action of row.actions??[])await page.evaluate(input=>window.__a2game.injectAction(input),action);
  for(const raw of row.raw??[])await page.evaluate(input=>window.__a2game.injectRaw(input),raw);
  await page.evaluate(ticks=>window.__a2game.step(ticks),row.ticks??1);
  if(row.resume)await page.locator('#pause').click();
  const state=await page.evaluate(()=>{const o=window.__a2game.getState();return {tickIndex:o.tickIndex,flow:o.flow,exactHash:o.exactHash,state:o.state};});checks(state,state.flow.status,row.checks??[]);
  const hud=row.hudIncludes?await page.locator('#score').textContent():undefined;for(const expected of row.hudIncludes??[])assert.ok(hud.includes(expected),'HUD missing '+expected);
  let screenshot;if(row.capture){assert.match(row.capture,/^[a-z0-9-]{1,64}$/);screenshot='reports/'+runId+'/'+prefix+'-'+row.capture+'.png';await page.screenshot({path:resolve(root,screenshot),fullPage:true});}
  checkpoints.push({tick:state.tickIndex,hash:state.exactHash,assertions:row.checks??[],...(row.hudIncludes?{hud}:{}),...(screenshot?{screenshot}:{})});
 }
 return checkpoints;
}
async function visual(page,name){
 const png=PNG.sync.read(await page.locator('#GameCanvas').screenshot({path:resolve(directory,name)})),colors=new Set();let opaque=0;
 for(let i=0;i<png.data.length;i+=4){if(png.data[i+3]>200)opaque++;colors.add(png.data[i]>>4|((png.data[i+1]>>4)<<4)|((png.data[i+2]>>4)<<8));}
 assert.ok(colors.size>=3,'Canvas must contain visible gameplay/text colors');assert.ok(opaque>=png.width*png.height/2,'Canvas must be visible');
 return {status:'PASS',canvas:'reports/'+runId+'/'+name,width:png.width,height:png.height,colorBuckets:colors.size,scope:'Nonblank canvas check; visual/manual quality reviewed separately'};
}
function checks(state,expected,rows){assert.equal(state.flow.status,expected);for(const check of rows){const value=check.path.split('/').slice(1).reduce((o,key)=>o[key],state.state);assert.deepEqual(value,check.equals,check.path);}}
async function terminalFeedback(page,status){const title={won:'已通关',lost:'本局结束',stopped:'对局已结束'}[status];assert.equal(await page.locator('#stageResult').isVisible(),!!title);if(title)assert.equal(await page.locator('#stageResultTitle').textContent(),title);}
try{
 const sdk=read('player/vendor/sdk-provenance.json');for(const file of sdk.files)assert.equal(hash(file.path),file.sha256);save('sdk-provenance.json',sdk);browser=await chromium.launch({headless:true});version=browser.version();
 for(let offset=0;offset<recipes.length;offset+=batchSize){const batch=recipes.slice(offset,offset+batchSize);origin=await startServer(offset/batchSize);
  try{const catalog=read('player/validated-games.json');for(const recipe of batch){const path='/specs/v0.1/games/'+recipe.name+'.game.json',game=read(path.slice(1));assert.equal(catalog.content[path]?.sha256Jcs,sha256Canonical(game),'Build the full-schema validated catalog before G2');}
   for(const backend of ['three','air']){const context=await browser.newContext({viewport:{width:1100,height:1000},deviceScaleFactor:1});const longReplay=batch.some(r=>r.steps.length>256||r.negative.length>256);await context.tracing.start({screenshots:!longReplay,snapshots:!longReplay});try{for(const recipe of batch){const game=read(`specs/v0.1/games/${recipe.name}.game.json`),page=await context.newPage(),result={id:recipe.id,backend,traceProfile:longReplay?'Complete input/hash checkpoints and explicit screenshots; no redundant DOM snapshots':'Full Playwright DOM/screenshot diagnostics',status:'FAIL',admission:'full-schema-validated-builtin-catalog',catalogEntry:catalog.content['/specs/v0.1/games/'+recipe.name+'.game.json'],sha256Jcs:sha256Canonical(game),errors:[],messages:[]};page.on('pageerror',e=>result.errors.push(e.stack??String(e)));page.on('console',m=>{if(m.type()==='error')result.messages.push(m.text());});try{
    await page.goto(`${origin}/player/index.html?backend=${backend}&clock=manual&game=${recipe.name}`);await ready(page);
    if(recipe.id==='G21'&&!variants){const count=await page.locator('#game optgroup option').count();assert.equal(count,read('project/status.json').coverage.referenceDemoGames);await Promise.all([page.waitForNavigation(),page.locator('#game').selectOption(recipe.name)]);await ready(page);assert.equal(await page.evaluate(()=>window.__a2game.definition.id),game.id);assert.equal(new URL(page.url()).searchParams.get('game'),recipe.name);result.catalogNavigation={status:'PASS',entries:count,game:recipe.name};}
    result.initial=await page.evaluate(()=>window.__a2game.getState());
    result.quality=await inspectPlayerQuality({page,game,screenshot:async name=>{const path='reports/'+runId+'/'+backend+'-'+recipe.id+'-'+name+'.png';await page.screenshot({path:resolve(root,path),fullPage:true});return path;}});
    result.visual=await visual(page,backend+'-'+recipe.id+'-initial-canvas.png');result.initialHud=await page.locator('#score').textContent();assert.ok(result.initialHud.trim().length>0,'HUD must show the declared goal/state');
    await page.locator('#pause').click();await page.evaluate(()=>window.__a2game.step(3));assert.equal((await page.evaluate(()=>window.__a2game.getState())).tickIndex,0);await page.locator('#pause').click();
    result.checkpoints=await execute(page,recipe.steps,backend+'-'+recipe.id+'-positive');result.final=await page.evaluate(()=>window.__a2game.getState());checks(result.final,recipe.expected,recipe.checks);result.operations=await page.evaluate(()=>window.__a2game.getOperations());result.node=replay(game,result.operations);assert.equal(result.final.exactHash,result.node.exactHash);
    await terminalFeedback(page,result.final.flow.status);
    result.quality.positiveFeedback=await page.locator('#resultMessage').textContent();if(['won','lost','stopped'].includes(result.final.flow.status))assert.ok(result.quality.positiveFeedback.includes('重新开始'));
    result.screenshot=`reports/${runId}/${backend}-${recipe.id}-positive.png`;await page.screenshot({path:resolve(root,result.screenshot),fullPage:true});
    {await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('[data-action]').evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth)),true);result.mobileScreenshot=`reports/${runId}/${backend}-${recipe.id}-390px.png`;await page.screenshot({path:resolve(root,result.mobileScreenshot),fullPage:true});await page.setViewportSize({width:1100,height:1000});}
    await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);result.restart='PASS';
    result.negativeCheckpoints=await execute(page,recipe.negative,backend+'-'+recipe.id+'-negative');result.negative=await page.evaluate(()=>window.__a2game.getState());checks(result.negative,recipe.negativeExpected,recipe.negativeChecks);result.negativeOperations=await page.evaluate(()=>window.__a2game.getOperations());result.negativeNode=replay(game,result.negativeOperations);assert.equal(result.negative.exactHash,result.negativeNode.exactHash);
    await terminalFeedback(page,result.negative.flow.status);
    result.quality.negativeFeedback=await page.locator('#resultMessage').textContent();if(['won','lost','stopped'].includes(result.negative.flow.status))assert.ok(result.quality.negativeFeedback.includes('重新开始'));
    result.negativeScreenshot=`reports/${runId}/${backend}-${recipe.id}-negative.png`;await page.screenshot({path:resolve(root,result.negativeScreenshot),fullPage:true});
    const heldSpace=game.inputs.actions.some(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code==='Space'&&b.config?.hold===true));
    if(heldSpace&&['won','lost','stopped'].includes(result.negative.flow.status)){await page.locator('#stageRestart').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#stageResult').isVisible(),false);result.terminalKeyboardRestart='PASS';}
    else await page.locator('#restart').click();
    assert.equal(await page.evaluate(()=>window.__a2game.getHash()),result.initial.exactHash);result.retryAfterNegative='PASS';
    if(!variants){
     const boundary=read('project/gameplay-acceptance.json').cases.find(r=>r.id===recipe.id).boundary;
     result.boundaryCheckpoints=await execute(page,boundary.steps,backend+'-'+recipe.id+'-boundary');result.boundary=await page.evaluate(()=>window.__a2game.getState());checks(result.boundary,boundary.expected,boundary.checks);
     result.boundaryOperations=await page.evaluate(()=>window.__a2game.getOperations());result.boundaryNode=replay(game,result.boundaryOperations);assert.equal(result.boundary.exactHash,result.boundaryNode.exactHash);
     result.boundaryScreenshot='reports/'+runId+'/'+backend+'-'+recipe.id+'-boundary.png';await page.screenshot({path:resolve(root,result.boundaryScreenshot),fullPage:true});
     result.additionalScenarios=[];
     for(const scenario of read('project/gameplay-acceptance.json').cases.find(r=>r.id===recipe.id).additionalScenarios??[]){
      await page.locator('#restart').click();const checkpoints=await execute(page,scenario.steps,backend+'-'+recipe.id+'-'+scenario.name),state=await page.evaluate(()=>window.__a2game.getState());checks(state,scenario.expected,scenario.checks);
      await terminalFeedback(page,state.flow.status);
      const hud=await page.locator('#score').textContent();for(const text of scenario.hudIncludes??[])assert.ok(hud.includes(text));
      const operations=await page.evaluate(()=>window.__a2game.getOperations()),node=replay(game,operations);assert.equal(state.exactHash,node.exactHash);
      const rejection=await page.evaluate(action=>{try{window.__a2game.injectAction({action,phase:'press'});return 'ACCEPTED';}catch(e){return e.code;}},game.inputs.actions[0].id);assert.equal(rejection,'A2G_E_FLOW');await page.evaluate(()=>window.__a2game.step(10));assert.equal(await page.evaluate(()=>window.__a2game.getHash()),state.exactHash);
      const screenshot='reports/'+runId+'/'+backend+'-'+recipe.id+'-'+scenario.name+'.png';await page.screenshot({path:resolve(root,screenshot),fullPage:true});result.additionalScenarios.push({name:scenario.name,state,node,operations,checkpoints,screenshot,hud,terminalInput:rejection,terminalFreeze:'PASS'});
     }
    }
    if(recipe.id==='H03'){
     await page.locator('#restart').click();const cdp=await context.newCDPSession(page);
     try{
      await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});const box=await page.locator('#GameCanvas').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:box.x+box.width*0.15,y:box.y+box.height*0.5},{id:2,x:box.x+box.width*0.85,y:box.y+box.height*0.5}]});
      await page.evaluate(ticks=>window.__a2game.step(ticks),recipe.steps[0].ticks);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await execute(page,recipe.steps.slice(1),backend+'-'+recipe.id+'-dom-touch');const state=await page.evaluate(()=>window.__a2game.getState());checks(state,recipe.expected,recipe.checks);assert.equal(state.exactHash,replay(game,await page.evaluate(()=>window.__a2game.getOperations())).exactHash);
      const screenshot='reports/'+runId+'/'+backend+'-'+recipe.id+'-dom-touch.png';await page.screenshot({path:resolve(root,screenshot),fullPage:true});result.nativeTouch={status:'PASS',profile:'CDP virtual two-touch -> DOM PointerEvent, not physical mobile',hash:state.exactHash,screenshot};
     }finally{await cdp.detach();}
    }
    if(recipe.id==='G18'){
     await page.locator('#restart').click();await page.locator('#GameCanvas').click();await page.keyboard.down('KeyA');await page.keyboard.down('KeyW');await page.evaluate(()=>window.__a2game.step(5));await page.keyboard.up('KeyA');await page.keyboard.up('KeyW');await page.evaluate(()=>window.__a2game.step(1));
     const state=await page.evaluate(()=>window.__a2game.getState()),hero=state.state.world.bodies.find(b=>b.id==='hero');assert.equal(hero.x,3680);assert.equal(hero.y,2320);assert.equal(hero.vx,0);assert.equal(hero.vy,0);assert.equal(state.exactHash,replay(game,await page.evaluate(()=>window.__a2game.getOperations())).exactHash);result.nativeKeyboard={status:'PASS',hash:state.exactHash,profile:'Desktop actual KeyboardEvent; not physical Touch/TwinStick'};
     await page.locator('#restart').click();const button=await page.locator('[data-action="moveRight"]').boundingBox();await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();await page.evaluate(()=>window.__a2game.step(5));await page.mouse.up();await page.evaluate(()=>window.__a2game.step(1));
     const held=await page.evaluate(()=>window.__a2game.getState());assert.equal(held.state.world.bodies.find(b=>b.id==='hero').x,4320);assert.equal(held.state.world.bodies.find(b=>b.id==='hero').vx,0);assert.equal(held.exactHash,replay(game,await page.evaluate(()=>window.__a2game.getOperations())).exactHash);result.nativeHeldButton={status:'PASS',hash:held.exactHash,scope:'DOM pointer press/release on the declared held action button'};

    }
    // Actual browser mouse -> DOM PointerEvent -> shared hit-test on a fresh G03 session.
    if(recipe.id==='G03'){await page.locator('#restart').click();for(const index of [1,4]){const target=game.inputs.actions.find(a=>a.id==='cell'+index).bindings.find(b=>b.source==='touch.select').config,box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/target.sceneWidth,box.height/target.sceneHeight);await page.mouse.click(box.x+box.width/2+target.x*scale,box.y+box.height/2-target.y*scale);await page.evaluate(()=>window.__a2game.step(1));}const state=await page.evaluate(()=>window.__a2game.getState());assert.equal(state.flow.status,'won');const node=replay(game,await page.evaluate(()=>window.__a2game.getOperations()));assert.equal(state.exactHash,node.exactHash);result.nativePointer={status:'PASS',profile:'desktop DOM PointerEvent; not physical mobile',hash:state.exactHash};}
    if(recipe.nativePointerActions){await page.locator('#restart').click();for(const action of recipe.nativePointerActions){const target=game.inputs.actions.find(a=>a.id===action).bindings.find(b=>b.source==='touch.select').config,box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/target.sceneWidth,box.height/target.sceneHeight);await page.mouse.click(box.x+box.width/2+target.x*scale,box.y+box.height/2-target.y*scale);await page.evaluate(()=>window.__a2game.step(1));}if(recipe.nativePointerWait)await page.evaluate(ticks=>window.__a2game.step(ticks),recipe.nativePointerWait);const state=await page.evaluate(()=>window.__a2game.getState());checks(state,recipe.expected,recipe.checks);assert.equal(state.exactHash,replay(game,await page.evaluate(()=>window.__a2game.getOperations())).exactHash);result.nativePointer={status:'PASS',profile:'desktop DOM PointerEvent; not physical mobile',hash:state.exactHash};}
    if(['G15','G28'].includes(recipe.id)){
     result.sharedPhysics=await page.evaluate(async()=>{const bytes=await(await fetch('/player/physics/cannon-es.js')).arrayBuffer(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');const module=await import('/dist/modules/rigid3d.js');return {sha256,...module.rigid3dDiagnostics()};});assert.equal(result.sharedPhysics.sha256,read('project/sdk-lock.json').sharedPhysics.sha256);assert.equal(result.sharedPhysics.activeWorlds,0);
     if(recipe.id==='G28')assert.ok(Math.abs(result.negative.state.rigid.bodies[1].e[2])>100000,'Off-support body must physically rotate');
    }
    await fullGameplayBrowser({page,recipe,game,result,ready,replay,screenshot:async name=>{const path='reports/'+runId+'/'+backend+'-'+recipe.id+'-'+name+'.png';await page.screenshot({path:resolve(root,path),fullPage:true});return path;}});
    await inputGameplayBrowser({page,context,recipe,game,result,replay,screenshot:async name=>{const path='reports/'+runId+'/'+backend+'-'+recipe.id+'-'+name+'.png';await page.screenshot({path:resolve(root,path),fullPage:true});return path;}});
    await page.evaluate(()=>window.__a2game.dispose());result.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(result.disposal.listenersActive,false);if(result.nativeInput)assert.equal(result.disposal.mobile.listenersActive,false);assert.equal(result.disposal.resources.ownedResources,0);assert.equal(result.disposal.adapter.disposed,true);assert.equal(backend==='three'?result.disposal.adapter.ownedMeshes:result.disposal.adapter.ownedNodes,0);assert.deepEqual(result.errors,[]);assert.deepEqual(result.messages,[]);result.status='PASS';
   }catch(e){result.failure=String(e);result.stack=e.stack;}finally{await page.close();save(`${backend}-${recipe.id}.json`,result);}results.push(result);console.log(`${result.status} ${backend} ${recipe.id}${result.failure?': '+result.failure:''}`);}}finally{await context.tracing.stop({path:resolve(directory,`${backend}-batch-${offset/batchSize}-trace.zip`)});await context.close();}}
  }finally{await stopServer();}
 }
}catch(e){failure=String(e);}
finally{try{await browser?.close();physicalClose='PASS';}catch(e){physicalClose='FAIL';failure??=String(e);}await stopServer();}
const parity=recipes.map(r=>{const a=results.find(i=>i.id===r.id&&i.backend==='three'),b=results.find(i=>i.id===r.id&&i.backend==='air');return {id:r.id,status:a?.status==='PASS'&&b?.status==='PASS'&&a.final.exactHash===b.final.exactHash&&a.negative.exactHash===b.negative.exactHash&&(variants||a.boundary.exactHash===b.boundary.exactHash)&&JSON.stringify((a.additionalScenarios??[]).map(s=>[s.name,s.state.exactHash]))===JSON.stringify((b.additionalScenarios??[]).map(s=>[s.name,s.state.exactHash]))?'PASS':'FAIL'};});
const unchanged=Object.entries(fingerprints).every(([path,digest])=>hash(path)===digest),status=!failure&&unchanged&&physicalClose==='PASS'&&results.length===recipes.length*2&&results.every(r=>r.status==='PASS')&&parity.every(r=>r.status==='PASS')?'PASS':'FAIL';save('summary.json',{format:requested?'a2game-gameplay-focused-real-sdk':variants?'a2game-rule-variants-real-sdk':'a2game-candidates-real-sdk',runId,status,browser:version,unchanged,physicalClose,failure,batchSize,nodeReplayExecutions,nodeReplayCacheHits,nodeReplayPolicy:'Exact game/operation digest cache; suffix only after a proven full restart',scope:variants?'Authored level/rule variants, positive/negative Node and dual real SDK replay; independent G3 and physical devices NOT_RUN':'32 individual bounded Gxx + 5 Hxx, positive/negative logical outcomes and identical normalized input across real SDKs; G3 and physical Touch/IMU NOT_RUN',fingerprints:`reports/${runId}/fingerprints.json`,sdk:`reports/${runId}/sdk-provenance.json`,parity,cases:results.map(r=>({id:r.id,backend:r.backend,status:r.status,receipt:`reports/${runId}/${r.backend}-${r.id}.json`,screenshot:r.screenshot}))});console.log(`${status}: reports/${runId}/summary.json`);if(status!=='PASS')process.exitCode=1;
