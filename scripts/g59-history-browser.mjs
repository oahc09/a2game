/** Real WPE page cache navigation without Playwright's disabled BFCache. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';

import {once} from 'node:events';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,extname,isAbsolute,join,resolve} from 'node:path';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
const root=resolve(import.meta.dirname,'..'),slug='g59-neon-survival';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const [mode='fixed',...extra]=process.argv.slice(2);
assert.ok(['baseline','fixed'].includes(mode)&&!extra.length);
const wpe=process.env.A2GAME_WPE_NATIVE_EXECUTABLE;
assert.ok(wpe&&isAbsolute(wpe),'set A2GAME_WPE_NATIVE_EXECUTABLE to the local WPE MiniBrowser or its wrapper');
const out=join(root,'output','g59-history-'+randomUUID());mkdirSync(out,{recursive:true});
const sdk=read(join(root,'player/vendor/sdk-provenance.json')),lock=read(join(root,'project/sdk-lock.json'));
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);assert.deepEqual(sdk.three,lock.three);
for(const item of sdk.files)assert.equal(sha(readFileSync(join(root,item.path))),item.sha256);
const gamePath=join(root,'specs/v0.1/games',slug+'.game.json');
const pack=process.env.A2GAME_HISTORY_PACKAGE
 ? {status:'PASS',output:resolve(process.env.A2GAME_HISTORY_PACKAGE)}
 : JSON.parse(execFileSync(process.execPath,[join(root,'scripts/package-player-sdk.mjs'),gamePath],{cwd:root,encoding:'utf8',timeout:90000}));
assert.equal(pack.status,'PASS');
const {files:listed}=read(join(pack.output,'build-inventory.json')),entries=new Map(listed.map(item=>['/'+item.file,item.sha256]));
assert.equal(entries.size,listed.length);
const html=path=>readFileSync(path,'utf8');
const catalog=createPlayerServer({contentService:createContentService()}),delegate=catalog.listeners('request')[0];
const report={mode,scope:'native headless WPE oracles, actual Navigation history and GL draws; scripted game input, not device, deployed service, or soak',wpe:execFileSync(wpe,['--version'],{encoding:'utf8'}).trim(),
 sdk:{cocosairjs:sdk.cocosairjs.commit,three:sdk.three.version},gameSha256:sha(readFileSync(gamePath)),inventory:entries.size,
 fingerprints:{probe:sha(readFileSync(import.meta.filename)),ordinary:sha(readFileSync(join(root,'player/main.mjs'))),standalone:entries.get('/player/example.mjs')},lanes:[]};
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let lane,received;
const endpoint='/__g59_history_result';
const neutral='/__g59_history_away';
function probe({standalone,generation}) {
 const s=sessionStorage,entry='navEpoch',state='navState';
 const epoch=Number(s[entry]??0)+1;s[entry]=epoch;
 const read=()=>JSON.parse(s[state]??'{}'), save=x=>{s[state]=JSON.stringify(x);};
 const by=id=>document.getElementById(id);
 const p=()=>standalone?window.examplePlayer:window.__a2game;
 const status=()=>standalone?p()?.status():p()?.runtime.status;
 const best=()=>standalone?p()?.getScoreSummary().best:Number(by('score').textContent.match(/本机最高：(\d+)/)?.[1]);
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(fn,label,timeout=12000)=>{
  const stop=performance.now()+timeout;
  for(;;){if(fn())return;if(performance.now()>stop)throw Error(label+' (status '+status()+')');await sleep(35);}
 };
 const send=(x)=>fetch('/__g59_history_result',{method:'POST',body:JSON.stringify({generation,...x})});
 let draws=0;const errors=[];
 window.addEventListener('error',e=>errors.push(e.message));
 window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const observedDraws=['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'];
 for(const type of observedDraws){
  const prototype=WebGL2RenderingContext.prototype,draw=prototype[type];
  if(typeof draw==='function')prototype[type]=function(...args){const result=draw.apply(this,args);draws++;return result;};
 }
 window.aim=false;
 Object.defineProperty(navigator,'getGamepads',{value:()=>[{index:0,connected:true,mapping:'standard',buttons:[],axes:[0,0,Number(window.aim),0]}]});
 const diag=()=>p()?.diagnostics?.()??{};
 const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code==='KeyD'?'d':'a',bubbles:true}));
 const canResume=()=>!by('pause').disabled;
 const held=()=>standalone?diag().heldSources:Object.keys(p().runtime.snapshot().pressedSources).length;
 const reset=()=>standalone?by('restart').click():by('stageRestart').click();
 let firstCanvas;
 addEventListener('pagehide',event=>{
  const x=read();if(x.phase==='away'||x.phase==='away-again')x.hide={persisted:event.persisted,epoch,status:status()};
  else if(x.phase==='reload')x.reloadHide={persisted:event.persisted,epoch};
  else return;
  save(x);
 });
 addEventListener('pageshow',event=>{
  const shown=event.persisted;
  void (async()=>{
   let x=read();
   if(!x.phase){
    await wait(()=>status()===(standalone?'ready':'paused'),'initial readiness');
    if(best()!==0)throw Error('profile did not start empty');
    window.aim=true;by(standalone?'enableGamepad':'gamepadEnable').click();
    by(standalone?'start':'readyStart').click();
    await wait(()=>status()==='lost','first normal loss',20000);
    const saved=best();if(saved<=0)throw Error('first round had no positive local best');
    reset();await wait(()=>status()==='playing','restart before leaving');
    firstCanvas=document.querySelector(standalone?'#game canvas':'#GameCanvas');
    const prior=draws;
    key('keydown','KeyD');
    await wait(()=>draws>prior,'playing native GL draw');
    await wait(()=>held()>0,'live held input before leaving');
    save({phase:'away',saved,epoch,held:held(),preErrors:errors.slice()});
    location.assign('/__g59_history_away');
    return;
   }
   if(x.phase==='away'||x.phase==='away-again'){
    // Native history may restore the original document, or load a fresh one.
    const cached=shown&&x.epoch===epoch;
    await wait(()=>['ready','playing','paused','disposed'].includes(status())&&(!standalone||status()==='disposed'||!by('start').disabled||status()!=='ready'),'Back readiness');
    const before={epoch,persisted:shown,nav:performance.getEntriesByType('navigation')[0]?.type??null,status:status(),canvas:document.querySelectorAll(standalone?'#game canvas':'#GameCanvas').length,
      sameCanvas:cached&&firstCanvas===document.querySelector(standalone?'#game canvas':'#GameCanvas'),best:status()==='disposed'?null:best(),
      held:diag().adapter?.disposed&&!standalone?null:held(),resumeControl:canResume(),disposed:diag().disposed??diag().adapter?.disposed??null};
    let resumed=false,visibleFrame=false,neutral=false,hadLiveGameBeforeReload=false;
    if(cached&&status()==='paused'&&canResume()){
     const oldDraws=draws;
     // Explicit resume only. There is deliberately no new key press or gamepad enable.
     by('pause').click();await wait(()=>status()==='playing','manual resume');
     resumed=true;
     await wait(()=>draws>oldDraws,'first real GL draw after restore');
     visibleFrame=true;
     neutral=standalone?diag().heldSources===0&&diag().gamepad.enabled===false:Object.keys(p().runtime.snapshot().pressedSources).length===0&&diag().gamepad.enabled===false;
     hadLiveGameBeforeReload=true;
    }
    const cycle={hide:x.hide,back:before,resumed,visibleFrame,neutral,live:hadLiveGameBeforeReload};
    (x.cycles??=[]).push(cycle);
    if(x.phase==='away'&&resumed){
      key('keydown','KeyD');
      await wait(()=>held()>0,'new held key before second navigation');
      x.phase='away-again';save(x);location.assign('/__g59_history_away');return;
    }
    x.backErrors=errors.slice();x.phase='reload';save(x);
    location.reload();return;
   }
   if(x.phase==='reload'){
    await wait(()=>status()===(standalone?'ready':'paused')&&(!standalone||!by('start').disabled),'fresh-reload readiness');
    const reload={epoch,persisted:shown,nav:performance.getEntriesByType('navigation')[0]?.type,best:best(),status:status(),
      canvas:document.querySelectorAll(standalone?'#game canvas':'#GameCanvas').length};
    let cleanup=false,parentCleanup=null;
    if(standalone){
     by('dispose').click();await wait(()=>status()==='disposed','explicit disposal');
     cleanup=diag().disposed&&document.querySelectorAll('#game canvas').length===0;
     const frame=document.createElement('iframe');frame.src=location.pathname+location.search+'&parentTest=1';document.body.append(frame);
     const child=frame.contentWindow;
     await wait(()=>child.examplePlayer?.status()==='ready','embedded child ready');
     let ack=false;
     const onAck=event=>{if(event.source===child&&event.origin===location.origin&&event.data?.type==='disposed'&&event.data?.requestId==='history-dispose')ack=true;};
     addEventListener('message',onAck);
     child.postMessage({format:'a2game-embed-control',action:'dispose',requestId:'history-dispose'},location.origin);
     await wait(()=>ack,'parent dispose acknowledgement');
     parentCleanup=child.examplePlayer.status()==='disposed'&&child.document.querySelectorAll('#game canvas').length===0;
     removeEventListener('message',onAck);frame.remove();
    }else{
     await p().dispose();cleanup=!diag().listenersActive&&diag().adapter?.disposed===true;
    }
    await send({...x,reload,cleanup,parentCleanup,errors:[...x.preErrors,...x.backErrors,...errors]});
   }
  })().catch(error=>void send({error:String(error.message??error),state:read(),errors}));
 });
}
const server=catalog;
server.removeListener('request',delegate);
server.on('request',(req,res)=>{
 const url=new URL(req.url,'http://localhost'),route=url.pathname;
 if(!lane)return res.writeHead(404).end();
 if(route===endpoint&&req.method==='POST'){
  let body='';req.setEncoding('utf8');req.on('data',s=>{body+=s;if(body.length>16384)req.destroy();});
  req.on('end',()=>{try{const result=JSON.parse(body);if(result.generation===lane.generation)received=result;res.end();}catch{res.writeHead(400).end();}});return;
 }
 if(route===neutral)return res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'private, max-age=0'}).end('<!doctype html><title>History control</title><p>Neutral page</p><script>setTimeout(()=>history.back(),200)</script>');
 if(route==='/player/index.html'&&!url.searchParams.has('parentTest')){
  const index=lane.standalone?join(pack.output,'player/index.html'):join(root,'player/index.html');
  const script='<script>('+probe.toString()+')('+JSON.stringify(lane)+')</script>';
  return res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'private, max-age=0'}).end(html(index).replace('<head>','<head>'+script));
 }
 if(!lane.standalone)return delegate(req,res);
 if(req.method!=='GET'||!entries.has(route))return res.writeHead(404).end();
 const bytes=readFileSync(join(pack.output,route.slice(1)));
 if(sha(bytes)!==entries.get(route))return res.writeHead(500).end();
 res.writeHead(200,{'content-type':mime[extname(route)]??'application/octet-stream','cache-control':'private, max-age=0'}).end(bytes);
});
function validate(row){
 assert.equal(row.error,undefined,JSON.stringify(row));
 const {cycles,reload,saved,cleanup,parentCleanup}=row;
 assert.equal(cycles.length,mode==='baseline'?1:2);
 for(const {hide,back,resumed,visibleFrame,neutral} of cycles){
  assert.equal(hide.persisted,true,'native pagehide never put the game into BFCache');
  assert.equal(back.persisted,true,'native history did not restore the game from BFCache');
  assert.equal(back.epoch,row.epoch);
  if(mode==='baseline'){
   if(row.standalone){assert.equal(back.status,'disposed');assert.equal(back.canvas,0);}
   else assert.equal(back.disposed,true);
  }else{
   assert.equal(back.disposed,false);
   assert.equal(back.status,'paused');assert.equal(back.canvas,1);assert.equal(back.sameCanvas,true);assert.equal(back.best,saved);assert.equal(back.held,0);
   assert.equal(resumed,true);assert.equal(visibleFrame,true);assert.equal(neutral,true);
  }
 }
 assert.equal(row.reloadHide.persisted,false);
 assert.equal(reload.persisted,false);assert.equal(reload.nav,'reload');assert.ok(reload.epoch>row.epoch);
 assert.equal(reload.best,saved);assert.equal(reload.canvas,1);
 assert.deepEqual(row.errors,[]);assert.equal(cleanup,true);
 if(row.standalone)assert.equal(parentCleanup,true);
}
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 for(const standalone of [true,false])for(const backend of ['three','cocosairjs']){
  lane={standalone,backend,generation:randomUUID()};received=undefined;
  const profile=mkdtempSync(join(tmpdir(),'a2game-wpe-history-'));
  const url='http://127.0.0.1:'+server.address().port+'/player/index.html?backend='+(backend==='cocosairjs'&&!standalone?'air':backend)+(standalone?'':'&game='+slug+'&ready=1');
  const child=spawn(wpe,['--headless','--profile-dir='+profile,'--features=+UsesBackForwardCache',url],
   {env:{...process.env,XDG_CACHE_HOME:profile,XDG_RUNTIME_DIR:profile},stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8000);});
  try{
   for(let i=0;i<600&&!received&&child.exitCode===null;i++)await delay(100);
   if(!received)throw Error('native WPE did not report: '+stderr);
   const {generation,...observed}=received;
   const row={standalone,backend,...observed};report.lanes.push(row);
   console.log(JSON.stringify(row));
   validate(row);
  }finally{
   if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit');}
   rmSync(profile,{recursive:true,force:true});
  }
 }
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message??error);throw error;}
finally{writeFileSync(join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(out);server.closeAllConnections();await new Promise(ok=>server.close(ok));}
