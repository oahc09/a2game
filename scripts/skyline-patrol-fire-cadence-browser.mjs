
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

const source='games/business-complete/skyline-patrol/muzzle.game.json';
const text=await readFile(source,'utf8'),game=JSON.parse(text);
const {cooldownTicks:cadence,projectileMuzzleOffset:muzzle,projectileSpeed:speed}=game.scenes[0].entities[0].components[0].config;
const fuselage=game.presentation.scene2d.bodyLayer.motifs.actor.find(node=>node.id==='fuselage');
assert.equal(muzzle,Math.round((fuselage.at[1]+fuselage.size[1]/2)*game.state.world.initial.bodies[0].hy));
const output='output/skyline-patrol-fire-cadence-'+Date.now();
await mkdir(output,{recursive:true});
const service=createContentService(),release=await service.release(text);
const server=createPlayerServer({contentService:service});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const report={status:'FAIL',caseId:'SHT-03',source,gameRelease:release.sha256Jcs,cadence,results:[]};
try{
 for(const backend of ['three','air'])for(const stride of [1,2]){
  const page=await browser.newPage({viewport:{width:950,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(stride=>{
    const native=window.requestAnimationFrame.bind(window);
    const pending=new Map();
    let sequence=0;
    window.requestAnimationFrame=callback=>{
     const id=++sequence;
     const schedule=(n)=>pending.set(id,native(time=>{
      if(n>1){schedule(n-1);return;}
      pending.delete(id);callback(time);
     }));
     schedule(stride);return id;
    };
    const cancel=window.cancelAnimationFrame.bind(window);
    window.cancelAnimationFrame=id=>{const request=pending.get(id);if(request!==undefined)cancel(request);pending.delete(id);};
   },stride);
   const read=()=>page.evaluate(()=>{
    const o=window.__a2game.getState();
    return {tick:o.tickIndex,status:o.flow.status,fired:o.events.filter(e=>e.type==='combat.fired').map(e=>e.tickIndex)};
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&release='+release.sha256Jcs);
   await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused');
   await page.locator('#readyStart').click();
   await page.waitForFunction(()=>window.__a2game.getState({recentEvents:0}).state.world.bodies.some(body=>body.id==='shot_0'));
   const first=await page.evaluate(()=>{
    const {tickIndex,state}=window.__a2game.getState({recentEvents:0});
    const actor=state.world.bodies.find(body=>body.id==='hero'),shot=state.world.bodies.find(body=>body.id==='shot_0');
    return {tick:tickIndex,x:shot.x-actor.x,y:shot.y-actor.y,vx:shot.vx,vy:shot.vy};
   });
   assert.deepEqual([first.x,first.y,first.vx,first.vy],[0,muzzle+speed*first.tick,0,speed]);
   await page.evaluate(()=>{window.frameSamples=[];let last;function sample(t){if(last!==undefined)window.frameSamples.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
   await page.waitForFunction(()=>window.__a2game.runtime.tickIndex>=15);
   await page.locator('#pause').click();
   const paused=await read();
   assert.equal(paused.status,'paused');
   await page.waitForTimeout(180);
   assert.deepEqual(await read(),paused);
   await page.locator('#pause').click();
   await page.waitForFunction(()=>window.__a2game.runtime.tickIndex>=45);
   const resumed=await read();
   assert.equal(resumed.status,'playing');
   const sequenceFor=tick=>Array.from({length:Math.ceil(tick/cadence)},(_,i)=>i*cadence);
   assert.deepEqual(paused.fired,sequenceFor(paused.tick));
   assert.deepEqual(resumed.fired,sequenceFor(resumed.tick));
   const samples=await page.evaluate(()=>window.frameSamples.slice(3).sort((a,b)=>a-b));
   const frameMedianMs=samples[Math.floor(samples.length/2)];
   assert.ok(stride===1?frameMedianMs>=12&&frameMedianMs<25:frameMedianMs>=26&&frameMedianMs<45);
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(async()=>{const a=window.__a2game;await a.dispose();return a.diagnostics().listenersActive;}),false);
   report.results.push({backend,stride,frameMedianMs,muzzle,first,paused,resumed});
   console.log(backend,stride,frameMedianMs,resumed.fired);
  }finally{await page.close();}
 }
 report.status='PASS';
}catch(e){report.error=e.stack;throw e;}
finally{
 await writeFile(output+'/receipt.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(output+'/receipt.json',report.status);
 await browser.close();await new Promise(r=>server.close(r));
}
