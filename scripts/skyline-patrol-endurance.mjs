import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {arch,cpus,platform,release as osRelease} from 'node:os';
import {chromium} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {verifyScoreSession} from './score-session.mjs';

const backend=process.argv[2];
assert.ok(['air','three'].includes(backend),'Choose air or three');
const smoke=process.argv[3]==='--smoke';
const seconds=smoke?60:backend==='air'?1800:600;
const targetTicks=seconds*60;
const dir='games/business-complete/skyline-patrol/';
const source=await readFile(dir+'delivery.game.json','utf8'),game=JSON.parse(source);
const scorePath='/world/score';
const routes=await Promise.all([['long-score-trace.json',14900],['delivery-score-trace.json',100]].map(async([file,score])=>{
  const bytes=await readFile(dir+file,'utf8'),trace=JSON.parse(bytes);
  const verified=verifyScoreSession(game,trace,{scorePath,expectedScore:score,actorId:'hero'});
  return {file,score,hash:verified.finalHash,ticks:verified.advanced,
    events:trace.events.filter(event=>event.source==='pointer'),sha256:createHash('sha256').update(bytes).digest('hex')};
}));
const service=createContentService(),published=await service.release(source);
const server=createPlayerServer({contentService:service});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const output=`output/skyline-patrol-endurance-${backend}-${Date.now()}`;
await mkdir(output,{recursive:true});
const receipt={status:'IN_PROGRESS',backend,smoke,targetSeconds:seconds,gameRelease:published.sha256Jcs,
  routeSequence:'long, ten short restarts, then repeated long runs',
  routes:routes.map(({events,...route})=>route),
  environment:{platform:platform(),os:osRelease(),arch:arch(),cpu:cpus()[0]?.model,viewport:{width:950,height:900},dpr:1},
  budget:{objects:128,p95FrameMs:25,p99FrameMs:50,warmupSeconds:20,windowSeconds:60},
  windows:[],runs:[],errors:[]};
const write=()=>writeFile(output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
const percentile=(values,p)=>values[Math.max(0,Math.ceil(p*values.length)-1)];
let browser;

try{
  browser=await chromium.launch();
  receipt.environment.browser=browser.version();
  const page=await browser.newPage({viewport:receipt.environment.viewport,deviceScaleFactor:1});
  page.on('pageerror',error=>receipt.errors.push(error.message));
  await page.goto(`${origin}/player/index.html?backend=${backend}&release=${published.sha256Jcs}&ready=1&feedback=1`);
  await page.waitForFunction(()=>window.__a2game?.getState({recentEvents:0}).flow.status==='paused');
  await page.evaluate(()=>{
    const api=window.__a2game;
    let prior,frames=[],interruptedFrame;
    window.__enduranceFrames=()=>{
      const samples={times:frames,interruptedFrame};
      frames=[];interruptedFrame=undefined;
      return samples;
    };
    function sample(time){
      if(api.runtime.status==='playing'){
        if(prior!==undefined)frames.push(time-prior);
        prior=time;
      }else{
        if(prior!==undefined)interruptedFrame=time-prior;
        prior=undefined;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  async function start(button,route){
    await page.evaluate(({button,events})=>{
      document.getElementById(button).addEventListener('click',()=>{
        const runtime=window.__a2game.runtime;
        for(const event of events)runtime.injectRaw(event);
      },{once:true});
    },{button,events:route.events});
    await page.locator('#'+button).click();
  }
  const observe=()=>page.evaluate(()=>{
    const api=window.__a2game,o=api.getState({recentEvents:128});
    return {tick:o.tickIndex,status:o.flow.status,hash:o.exactHash,score:o.state.world.score,objects:o.state.world.bodies.length,
      poolFull:o.events.some(event=>event.type==='realtime.pool-full'),
      heap:performance.memory?.usedJSHeapSize,...window.__enduranceFrames(),
      hint:document.getElementById('hint').textContent};
  });
  let completedTicks=0,activeTicks=0,nextWindow=4800,peak=0,samples=[],restartCount=0;
  let route=routes[0];
  await start('readyStart',route);
  const started=Date.now();
  while(activeTicks<targetTicks){
    const sample=await observe();
    activeTicks=completedTicks+sample.tick;
    if(sample.poolFull)throw Error(`Object pool full at active Tick ${activeTicks}`);
    peak=Math.max(peak,sample.objects);
    if(activeTicks>=1200)samples.push(...sample.times);
    if(activeTicks>=nextWindow&&samples.length){
      samples.sort((a,b)=>a-b);
      receipt.windows.push({activeTicks,elapsedMs:Date.now()-started,samples:samples.length,
        p95:percentile(samples,.95),p99:percentile(samples,.99),peakObjects:peak,usedJSHeapBytes:sample.heap});
      await write();
      console.log(backend,JSON.stringify(receipt.windows.at(-1)));
      nextWindow+=3600;samples=[];
    }
    if(sample.status==='lost'){
      assert.equal(sample.tick,route.ticks);assert.equal(sample.score,route.score);assert.equal(sample.hash,route.hash);
      const outcome=await page.evaluate(()=>{const api=window.__a2game;return {poolFull:api.getState().events.some(e=>e.type==='realtime.pool-full'),diagnostics:api.diagnostics()};});
      assert.equal(outcome.poolFull,false);
      completedTicks+=sample.tick;
      receipt.runs.push({trace:route.file,ticks:sample.tick,score:sample.score,hash:sample.hash,diagnostics:outcome.diagnostics});
      await write();
      if(completedTicks>=targetTicks)break;
      route=receipt.runs.length<=10?routes[1]:routes[0];
      restartCount++;
      await start('restart',route);
    }else if(sample.status!=='playing'){
      receipt.interruption={activeTicks,localTick:sample.tick,state:sample.status,hint:sample.hint,
        lastFrameMs:sample.interruptedFrame,peakObjects:peak,elapsedMs:Date.now()-started};
      await page.screenshot({path:output+'/interrupted.png'});
      throw Error(`Active Tick ${activeTicks}: ${sample.hint}`);
    }
    if(receipt.errors.length)throw Error(receipt.errors.join('\n'));
    await page.waitForTimeout(1000);
  }
  receipt.activeTicks=activeTicks;
  receipt.wallMs=Date.now()-started;
  receipt.peakObjects=peak;
  receipt.restartCount=restartCount;
  if(samples.length){
    samples.sort((a,b)=>a-b);
    receipt.partialWindow={activeTicks,samples:samples.length,p95:percentile(samples,.95),p99:percentile(samples,.99)};
  }
  if((await observe()).status==='playing')await page.locator('#pause').click();
  const final=await page.evaluate(async()=>{
    const api=window.__a2game;
    const poolFull=api.getState().events.some(event=>event.type==='realtime.pool-full');
    await api.dispose();
    return {poolFull,diagnostics:api.diagnostics()};
  });
  assert.equal(final.poolFull,false);
  receipt.disposal=final.diagnostics;
  assert.equal(receipt.disposal.listenersActive,false);
  assert.ok(peak<=receipt.budget.objects);
  assert.ok(receipt.wallMs>=seconds*1000-1000);
  if(!smoke){
    assert.ok(receipt.runs.some(run=>run.trace===routes[0].file));
    assert.ok(restartCount>=10);
    assert.ok(receipt.windows.every(window=>window.p95<=25&&window.p99<=50),'Frame budget exceeded');
  }
  receipt.status=smoke?'PASS_SMOKE':'PASS';
  await write();console.log(output);
}catch(error){
  receipt.status='FAIL';
  receipt.errors.push(String(error.message??error));
  await write();
  console.error(output);
  throw error;
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
