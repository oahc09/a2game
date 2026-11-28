
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {HeadlessRuntime} from '../dist/index.js';
import {createContentService} from './content-service.mjs';
import {makeRegistry} from './registry.mjs';
import {createPlayerServer} from './serve.mjs';

const source='games/business-complete/skyline-patrol/contact-order.game.json';
const base=JSON.parse(await readFile(source,'utf8'));
const service=createContentService();
const cases=[];
const observe=o=>({status:o.flow.status,tick:o.tickIndex,score:o.state.world.score,hash:o.exactHash,
  events:o.events.filter(e=>['combat.hit','combat.death'].includes(e.type)).map(e=>({type:e.type,payload:e.payload}))});
for(const [targetId,shotId,reverse] of [['a-target','z-shot',false],['z-target','a-shot',true]])for(const hp of [1,2]){
 const game=structuredClone(base);
 game.scenes[0].entities[0].components[0].config.autoFire=false;
 const bodies=game.state.world.initial.bodies,hero=bodies[0],targetY=hero.y+50;
 bodies.push({id:targetId,kind:'target',x:hero.x,y:targetY,vx:0,vy:0,hx:100,hy:100,hp,team:2,value:100,fixed:true},
  {id:shotId,kind:'projectile',x:hero.x,y:targetY-208,vx:0,vy:128,hx:38,hy:38,hp:1,team:1,value:1,fixed:false,owner:hero.id,ttl:3,hits:[]});
 if(reverse)bodies.reverse();
 const runtime=new HeadlessRuntime(game,makeRegistry());
 let expected;
 try{runtime.start();runtime.step();expected=observe(runtime.observe());}
 finally{runtime.dispose();}
 assert.deepEqual([expected.status,expected.score,expected.events.filter(e=>e.type==='combat.death').map(e=>e.payload.id)],
  hp===1?['playing',100,[targetId]]:['lost',0,['hero']]);
 const release=await service.release(JSON.stringify(game));
 cases.push({id:targetId+'-'+hp,release:release.sha256Jcs,expected});
}
const output='output/skyline-patrol-contact-order-'+Date.now();
await mkdir(output,{recursive:true});
const server=createPlayerServer({contentService:service});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const result={status:'FAIL',caseId:'SHT-09',source,cases,results:[]};
try{
 for(const backend of ['three','air'])for(const {id,release,expected} of cases){
  const page=await browser.newPage({viewport:{width:950,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const manual=expected.status!=='lost';
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&release='+release+(manual?'&clock=manual':''));
   await page.waitForFunction(()=>window.__a2game?.runtime.status==='paused');
   await page.locator('#readyStart').click();
   if(manual)await page.evaluate(()=>window.__a2game.step(1));
   else await page.waitForFunction(()=>window.__a2game.runtime.status==='lost');
   const observation=await page.evaluate(()=>window.__a2game.getState());
   const actual=observe(observation);
   assert.deepEqual(actual,expected);
   if(expected.status==='lost')await page.waitForFunction(score=>{
    const result=document.querySelector('#stageResult');
    return !result.hidden&&document.querySelector('#stageResultDetail').textContent.startsWith('本局 '+score+' 分');
   },expected.score);
   await page.screenshot({path:output+'/'+backend+'-'+id+'.png'});
   assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__a2game.dispose());
   result.results.push({backend,id,clock:manual?'manual':'normal',...actual});
  }finally{await page.close();}
 }
 result.status='PASS';
}catch(error){result.error=error.stack;throw error;}
finally{
 await writeFile(output+'/receipt.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(output+'/receipt.json',result.status,result.results.length);
 await browser.close();await new Promise(r=>server.close(r));
}
