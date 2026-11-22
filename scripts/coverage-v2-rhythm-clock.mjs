import fs from 'node:fs';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createContentService} from '../scripts/content-service.mjs';
import {createPlayerServer} from '../scripts/serve.mjs';
const dir='reports/coverage-v2-rhythm-clock-'+Date.now();
fs.mkdirSync(dir,{recursive:true});
const game=JSON.parse(fs.readFileSync('games/coverage-v2/g161-neon-backbeat/game.json'));
const contentService=createContentService();
const receipt=await contentService.release(JSON.stringify(game));
const server=createPlayerServer({contentService});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const results=[];
let browser;
try{
 browser=await chromium.launch();
 for(const backend of ['three','air']){
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  const result={backend,errors:[]};
  results.push(result);
  page.on('pageerror',e=>result.errors.push(e.message));
  try{
   await page.addInitScript(()=>{
    window.nativeAudioStarts=[];
    const track=(source,kind,when)=>{
     const state=window.__a2game?.getState();
     if(!state?.state?.clock)return;
     window.nativeAudioStarts.push({kind,tick:state.tickIndex,timeMs:performance.now(),when,
      noteY:Array.from({length:8},(_,i)=>state.state['noteY'+i]),
      contextState:source.context?.state});
    };
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
     const result=Reflect.apply(start,this,args);track(this,'buffer',args[0]??0);return result;
    };
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
     return Reflect.apply(play,this,args).then(result=>{track(this,'media',0);return result;});
    };
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+backend+'&ready=1&release='+receipt.sha256Jcs);
   await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='paused');
   await page.locator('#readyStart').click();
   await page.waitForFunction(()=>window.__a2game.getState().tickIndex>=280,{},{timeout:15000});
   result.actual=await page.evaluate(()=>({
    native:window.nativeAudioStarts,
    notes:window.__a2game.getState().events.filter(e=>e.type.startsWith('rhythm.beat-')).map(e=>({tick:e.tickIndex+1,...e.payload})),
    audio:window.__a2game.diagnostics().adapter.stage.audio,
    flow:window.__a2game.getState().flow.status,
   }));
   assert.equal(result.actual.flow,'lost');
   assert.equal(result.actual.audio.played,8);
   assert.equal(result.actual.native.length,8);
   const beats=[60,90,120,150,180,210,240,270];
   assert.deepEqual(result.actual.notes.map(note=>note.tick),beats);
   result.drift=result.actual.native.map((start,index)=>({
    cue:beats[index],audioTick:start.tick,deltaTicks:start.tick-beats[index],y:start.noteY[index],timeMs:start.timeMs
   }));
   assert.ok(result.drift.every(({deltaTicks,y})=>deltaTicks>=0&&deltaTicks<=4&&Math.abs(y+220)<=60),JSON.stringify(result.drift));
   await page.screenshot({path:dir+'/'+backend+'.png'});
   assert.deepEqual(result.errors,[]);
   result.status='PASS';
  }catch(error){result.status='FAIL';result.error=error.message;}
  finally{await page.close();}
 }
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
 fs.writeFileSync(dir+'/summary.json',JSON.stringify({results},null,2)+'\n');
 console.log(dir+'/summary.json',results.map(({backend,status,error,drift})=>({backend,status,error,drift})));
}
if(results.length!==2||results.some(r=>r.status!=='PASS'))process.exitCode=1;
