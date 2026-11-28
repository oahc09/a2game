
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from './registry.mjs';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

const source='games/business-complete/skyline-patrol/muzzle.game.json';
const base=JSON.parse(await readFile(source,'utf8'));
const service=createContentService(),fixtures=[];
for(const [index,hp] of [1,3,5].entries()){
 const game=structuredClone(base),cfg=game.scenes[0].entities[0].components[0].config;
 cfg.autoFire=false;
 const {body:template}=cfg.waves[index];
 const target={...template,id:'fixture-target',x:2200,y:6000,vx:0,vy:0,hp,value:hp*100,fixed:true};
 const bodies=game.state.world.initial.bodies;
 bodies.push(target);
 for(let i=0;i<=hp;i++)bodies.push({id:'fixture-shot-'+i,kind:'projectile',x:target.x,y:target.y-target.hy-39-32*i,
  vx:0,vy:16,hx:38,hy:38,hp:1,team:1,value:1,fixed:false,owner:'hero',ttl:90,hits:[]});
 const capture=o=>({tick:o.tickIndex,hash:o.exactHash,hp:o.state.world.bodies.find(b=>b.id===target.id)?.hp??null,
  score:o.state.world.score,hits:o.events.filter(e=>e.type==='combat.hit'&&e.payload.id===target.id).length,
  deaths:o.events.filter(e=>e.type==='combat.death'&&e.payload.id===target.id).length});
 const expected=[];
 const runtime=new HeadlessRuntime(game,makeRegistry());
 try{
  runtime.start();
  for(let i=1;i<=hp+1;i++){
   runtime.step(i===1?1:2);
   const row=capture(runtime.observe()),lethal=i>=hp;
   assert.deepEqual([row.hp,row.score,row.hits,row.deaths],[lethal?null:hp-i,lethal?hp*100:0,Math.min(i,hp),lethal?1:0]);
   expected.push(row);
  }
 }finally{runtime.dispose();}
 const admitted=await service.release(JSON.stringify(game));
 fixtures.push({name:template.id,hp,release:admitted.sha256Jcs,capture,expected});
}
const output='output/skyline-patrol-damage-'+Date.now();
await mkdir(output,{recursive:true});
const server=createPlayerServer({contentService:service});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const report={status:'FAIL',caseId:'SHT-06',source,results:[]};
try{
 for(const backend of ['three','air'])for(const {name,hp,release,capture,expected} of fixtures){
  const page=await browser.newPage({viewport:{width:950,height:900},reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&clock=manual&feedback=1&release='+release);
   await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused');
   await page.locator('#readyStart').click();
   await page.screenshot({path:output+'/'+backend+'-'+name+'-before.png'});
   const observed=[];
   for(let i=0;i<expected.length;i++){
    const o=await page.evaluate(t=>{const a=window.__a2game;a.step(t);return a.getState();},i===0?1:2);
    observed.push(capture(o));
    if(i===hp-1){
     assert.ok(await page.evaluate(()=>window.__a2game.diagnostics().feedback.effects)>=2);
     await page.screenshot({path:output+'/'+backend+'-'+name+'-lethal.png'});
    }
   }
   assert.deepEqual(observed,expected);assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__a2game.dispose());
   report.results.push({backend,name,hp,release,observed});
  }finally{await page.close();}
 }
 report.status='PASS';
}catch(error){report.error=error.stack;throw error;}
finally{
 await writeFile(output+'/receipt.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(output+'/receipt.json',report.status,report.results.length);
 await browser.close();await new Promise(r=>server.close(r));
}
