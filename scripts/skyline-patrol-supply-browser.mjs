import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

const gameFile='games/business-complete/skyline-patrol/delivery.game.json';
const game=await readFile(gameFile,'utf8');
const contentService=createContentService();
const release=await contentService.release(game);
const server=createPlayerServer({contentService});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const output=`output/skyline-patrol-live-supply-${Date.now()}`;
const backends=process.argv.slice(2);
const results=[];
let browser;
await mkdir(output,{recursive:true});

// Keep clear of targets projected to enter the flight path. Move under visible
// pickups when safe. Browser mouse input follows the same path as a player.
function chooseX(world,previous){
  const hero=world.bodies.find(body=>body.id==='hero');
  const nearby=world.bodies.filter(body=>body.kind==='target'&&
    body.y>=1200-body.hy-290&&body.y<=1200+body.hy+290-body.vy*62);
  const safe=x=>nearby.every(body=>Math.abs(x-body.x)>body.hx+hero.hx+200);
  const closest=(a,b)=>Math.abs(a-hero.x)-Math.abs(b-hero.x);
  const reachable=world.bodies.filter(body=>body.kind==='pickup'&&
    body.y>940&&body.y<2150&&safe(body.x));
  reachable.sort((a,b)=>Number(b.supply==='double')-Number(a.supply==='double')||closest(a.x,b.x));
  if(reachable.length)return reachable[0].x;
  if(safe(previous))return previous;
  return [230,9770,...Array.from({length:24},(_,i)=>(i+1)*400)].filter(safe).sort(closest)[0]??previous;
}

try{
  browser=await chromium.launch();
  for(const backend of backends.length?backends:['three','air']){
    assert.ok(['three','air'].includes(backend));
    const page=await browser.newPage({viewport:{width:950,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/player/index.html?backend=${backend}&release=${release.sha256Jcs}&ready=1`);
    await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='paused');
    const canvas=page.locator('#GameCanvas');
    await page.locator('#readyStart').click();
    await canvas.scrollIntoViewIfNeeded();
    const at=async(x,y)=>{
      const box=await canvas.boundingBox(),scale=Math.min(box.width/10,box.height/16);
      return [box.x+box.width/2+(x/1000-5)*scale,box.y+box.height/2+(8-y/1000)*scale];
    };
    await page.mouse.move(...await at(5000,1600));
    await page.mouse.down();
    await page.mouse.move(...await at(5000,1200));
    await page.waitForFunction(()=>{
      const state=window.__a2game.getState({recentEvents:0}).state;
      return state.control.hasTarget&&Math.abs(state.world.bodies.find(body=>body.id==='hero').y-1200)<40;
    },null,{timeout:5000});
    const started=Date.now(),moves=[{x:5000,y:1200,tick:0}],pickups=new Map(),clockStalls=[];
    let destination=5000,observation,pair,expired,paused;
    const getState=()=>page.evaluate(()=>window.__a2game.getState({recentEvents:128}));
    async function resumeDrag(){
      await page.locator('#pause').click();
      await canvas.scrollIntoViewIfNeeded();
      const hero=(await getState()).state.world.bodies.find(body=>body.id==='hero');
      await page.mouse.move(...await at(hero.x,hero.y));
      await page.mouse.down();
      await page.mouse.move(...await at(destination,1200));
    }
    while(Date.now()-started<230000){
      observation=await getState();
      const {tickIndex,flow,state,events}=observation,world=state.world;
      if(flow.status==='paused'){
        const hint=await page.locator('#hint').textContent();
        assert.match(hint,/运行追帧超限/);
        clockStalls.push({tick:tickIndex,hint});
        console.log(backend,`clock stall at Tick ${tickIndex}; resuming pickup check`);
        await page.mouse.up();
        await resumeDrag();
        continue;
      }
      assert.equal(flow.status,'playing',`${backend} at Tick ${tickIndex}: ${JSON.stringify({moves,control:state.control})}`);
      assert.ok(!events.some(event=>event.type==='realtime.pool-full'),`${backend}: object pool full`);
      for(const event of events.filter(event=>event.type==='combat.supply-collected')){
        if(!pickups.has(event.payload.id))console.log(backend,`picked up ${event.payload.supply} at Tick ${event.tickIndex}`);
        pickups.set(event.payload.id,event);
      }
      const double=[...pickups.values()].findLast(event=>event.payload.supply==='double');
      if(double&&!pair){
        const fired=events.find(event=>event.type==='combat.fired'&&event.tickIndex>double.tickIndex);
        if(fired){
          const shots=events.filter(event=>event.tickIndex===fired.tickIndex&&event.type==='realtime.spawned'&&event.payload.id.startsWith('shot_'));
          assert.equal(shots.length,2);
          assert.equal(new Set(shots.map(shot=>shot.payload.id)).size,2);
          assert.equal(world.doubleShotUntil,double.tickIndex+721);
          pair={tick:fired.tickIndex,projectiles:shots.map(shot=>shot.payload.id),until:world.doubleShotUntil};
          await page.screenshot({path:`${output}/${backend}-double-shot.png`});
          await page.mouse.up();
          await page.locator('#pause').click();
          const frozen=await getState();
          await page.waitForTimeout(200);
          const later=await getState();
          assert.equal(frozen.flow.status,'paused');
          assert.equal(later.tickIndex,frozen.tickIndex);
          assert.equal(later.state.world.doubleShotUntil,frozen.state.world.doubleShotUntil);
          paused={tick:frozen.tickIndex,remaining:frozen.state.world.doubleShotUntil-frozen.tickIndex};
          await resumeDrag();
        }
      }
      if(pair&&tickIndex>pair.until+6){
        const normal=events.find(event=>event.type==='combat.fired'&&event.tickIndex>=pair.until);
        if(normal){
          const shots=events.filter(event=>event.tickIndex===normal.tickIndex&&event.type==='realtime.spawned'&&event.payload.id.startsWith('shot_'));
          assert.equal(shots.length,1);
          expired={tick:normal.tickIndex,projectile:shots[0].payload.id};
          break;
        }
      }
      const x=chooseX(world,destination);
      if(x!==destination){destination=x;await page.mouse.move(...await at(x,1200));moves.push({x,y:1200,tick:tickIndex});}
      await page.waitForTimeout(50);
    }
    assert.ok(pair&&expired&&paused,`${backend}: no complete pickup/expiry sequence`);
    await page.mouse.up();
    assert.deepEqual(errors,[]);
    const diagnostics=await page.evaluate(async()=>{await window.__a2game.dispose();return window.__a2game.diagnostics();});
    assert.equal(diagnostics.listenersActive,false);
    results.push({backend,status:'PASS',tick:observation.tickIndex,moves,pickups:[...pickups.values()],pair,paused,expired,clockStalls,diagnostics});
    console.log(backend,`two shots at Tick ${pair.tick}, one shot at Tick ${expired.tick}`);
    await page.close();
  }
  await writeFile(`${output}/receipt.json`,JSON.stringify({status:'PASS',browser:browser.version(),release:release.sha256Jcs,gameSha256:createHash('sha256').update(game).digest('hex'),results},null,2)+'\n');
  console.log(output);
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
