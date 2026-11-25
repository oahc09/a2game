/** Browser/Node parity at the normal player entrypoint. No physical-device claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webkit} from 'playwright';
import {PNG} from 'pngjs';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry,readJson,spec} from './registry.mjs';
import {browserLaunchOptions} from './browser-launch.mjs';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

const root=resolve(import.meta.dirname,'..');
const sha=(data)=>createHash('sha256').update(data).digest('hex');
const lock=readJson(resolve(root,'project/sdk-lock.json')),sdk=readJson(resolve(root,'player/vendor/sdk-provenance.json'));
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);
assert.deepEqual(sdk.three,lock.three);
for(const file of sdk.files)assert.equal(sha(readFileSync(resolve(root,file.path))),file.sha256);
const server=createPlayerServer({contentService:createContentService()});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const run={scope:'SOFTWARE_BROWSER_REFERENCE_NOT_PHYSICAL',sdk:{cocosairjs:sdk.cocosairjs.commit,three:sdk.three.version,files:sdk.files},cases:[]};
let browser;
try{
 const browserConfig=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
 browser=await webkit.launch(browserConfig);run.webkit=browser.version();
 for(const slug of ['g41-snake','g41-snake-wide'])for(const backend of ['air','three']){
  const file=resolve(spec,'games',slug+'.game.json'),definition=readJson(file),r=new HeadlessRuntime(definition,makeRegistry());
  const c=definition.scenes[0].entities[0].components[0].config,context=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[],observed=new Set();
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('response',res=>{if(res.ok())observed.add(new URL(res.url()).pathname);});
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const check=async(status,body)=>{
   const obs=await page.evaluate(()=>window.__a2game.getState());
   const local=r.observe();assert.equal(obs.flow.status,status);assert.deepEqual(obs.state.snake.body,body);
   assert.equal(obs.exactHash,local.exactHash);assert.deepEqual(obs.state.snake,local.state.snake);
   checkpoints.push(obs.exactHash);return obs;
  };
  const advance=async(n)=>{await page.evaluate(n=>window.__a2game.step(n),n);r.step(n);};
  const checkpoints=[];r.start();
  try{
   await page.goto(origin+'/player/index.html?game='+slug+'&backend='+backend+'&clock=manual',{timeout:18000});
   await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing'||document.querySelector('#error')?.textContent?.trim());
   assert.equal((await page.locator('#error').textContent()).trim(),'');
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
   const canvas=page.locator('#GameCanvas');
   const before=PNG.sync.read(await canvas.screenshot());
   const start=await check('playing',[c.width+1,c.width]);
   const box=await canvas.boundingBox();assert.ok(box&&box.width>0&&box.height>0);
   const x=box.x+box.width*0.5,y=box.y+box.height*0.3;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+box.height*0.42);await page.mouse.up();
   await page.keyboard.press('ArrowLeft');
   const raw=await page.evaluate(()=>window.__a2game.getOperations());
   const swipe=raw.filter(e=>e.op==='raw'&&e.input.source==='pointer'),key=raw.find(e=>e.op==='action'&&e.input.action==='left');
   assert.ok(swipe.some(e=>e.input.kind==='down')&&swipe.some(e=>e.input.kind==='up')&&key);
   assert.equal(swipe.find(e=>e.input.kind==='up').input.timeUs,key.input.timeUs);
   for(const row of raw)if(row.op==='raw')r.injectRaw(row.input);else if(row.op==='action')r.injectAction(row.input);
   await advance(1);
   assert.deepEqual((await check('playing',[c.width+1,c.width])).state.snake.turns,['down','left']);
   await page.locator('#pause').click();r.pause();await advance(4);
   assert.equal((await check('paused',[c.width+1,c.width])).tickIndex,1);
   await page.locator('#pause').click();r.resume();await advance(c.stepTicks-1);
   await check('playing',[c.width*2+1,c.width+1]);await advance(c.stepTicks);
   await check('playing',[c.width*2,c.width*2+1]);
   const after=PNG.sync.read(await canvas.screenshot());
   assert.equal(after.width,before.width);assert.equal(after.height,before.height);
   let changed=0;
   for(let i=0;i<after.data.length;i+=4)if(!after.data.subarray(i,i+3).equals(before.data.subarray(i,i+3)))changed++;
   assert.ok(changed>100,'Expected a changed rendered board');
   await page.locator('#restart').click();r.restart();
   assert.equal((await check('playing',[c.width+1,c.width])).exactHash,start.exactHash);
   await advance(c.stepTicks);
   await check(c.goalLength===3?'won':'playing',[c.width+2,c.width+1,c.width]);
   if(c.goalLength!==3){await advance(c.stepTicks*2);assert.equal((await page.evaluate(()=>window.__a2game.getState())).flow.status,'lost');await check('lost',r.observe().state.snake.body);}
   await page.evaluate(()=>window.__a2game.dispose());
   const diagnostics=await page.evaluate(()=>window.__a2game.diagnostics());
   assert.equal(diagnostics.resources.ownedResources,0);
   assert.equal(diagnostics.listenersActive,false);assert.equal(diagnostics.adapter.disposed,true);
   assert.ok(observed.has(backend==='air'?'/player/vendor/cocosair.js':'/player/vendor/three.module.js'));
   assert.deepEqual(errors,[]);
   run.cases.push({slug,backend,specSha256:sha(readFileSync(file)),changedPixels:changed,checkpoints,inputSha256:sha256Canonical(raw),disposed:true});
  }finally{r.dispose();await context.close();}
 }
 assert.equal(run.cases.length,4);
 console.log(JSON.stringify(run,null,2));
}finally{
 await browser?.close();
 server.closeAllConnections();
 await new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));
}
