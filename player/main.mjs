import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {createBrowserRegistry} from './browser-registry.mjs';
import {CanvasPreviewAdapter} from './adapters/canvas-preview.mjs';
import {ThreeAdapter} from './adapters/three-adapter.mjs';
import {CocosAirAdapter} from './adapters/cocosairjs-adapter.mjs';
import {loadBuiltinGame,loadReleasedGame,importGameFile} from './content-loader.mjs';
import {ResourceScope} from './resources.mjs';

const dom=Object.fromEntries(['game','backend','restart','pause','GameCanvas','engineLabel','score','status','hash','trace','error','hint'].map(x=>[x,document.getElementById(x)]));
const params=new URLSearchParams(location.search);
const gameName=['tap-target','grid-merge','grid-merge-spawn','grid-push'].includes(params.get('game'))?params.get('game'):'tap-target';
const backendName=['preview','air','three'].includes(params.get('backend'))?params.get('backend'):'preview';
const releaseId=params.get('release');
// Explicit automation mode replaces the production clock; both use the same runtime.
const manualClock=params.get('clock')==='manual';
const operations=[];
const record=(op,payload)=>{if(manualClock)operations.push({op,...payload});};
const listeners=new AbortController();
const listen=(target,type,callback)=>target.addEventListener(type,callback,{signal:listeners.signal});
dom.game.value=gameName;dom.backend.value=backendName;
dom.engineLabel.textContent=backendName==='air'?'A2Game + CocosAirJS':backendName==='three'?'A2Game + Three.js':'A2Game + Canvas2D Preview';
let runtime,adapter,definition,resources,raf,ts=0,carry=0,errorMessage='',contextState='healthy',disposal;
const showError=e=>{errorMessage=`无法运行游戏：${e instanceof Error?e.message:String(e)}`;dom.error.textContent=errorMessage;dom.error.style.display='block';dom.status.textContent='ERROR';dom.status.className='error';console.error(e);};
async function createAdapter(mode){
 const canvas=dom.GameCanvas;
 if(mode==='preview') return new CanvasPreviewAdapter(canvas);
 if(mode==='three'){
   let three;
   try { three=await import('three'); }catch(e){throw Error('Three.js SDK missing. Provide player/vendor/three.module.js (official ESM build).');}
   const result=new ThreeAdapter(three,canvas,resources);try{await result.prepare(definition);return result;}catch(error){await result.dispose();throw error;}
 }
 let air;
 try {air=await import('cocosair.js');}catch(e){throw Error('CocosAirJS SDK missing. Provide player/vendor/cocosair.js (official ESM build).');}
 const result=await CocosAirAdapter.create(air,canvas);try{await result.prepare(definition,resources);return result;}catch(error){await result.dispose();throw error;}
}
function observation(){return runtime?.observe();}
function updateInfo(obs){
 dom.status.textContent=obs.flow.status.toUpperCase();dom.status.className=['won','playing'].includes(obs.flow.status)?'':obs.flow.status==='paused'?'warn':'error';
 dom.hash.textContent=obs.exactHash;
 const boundText=definition.presentation.hud?.find(x=>x.kind==='text')?.bind?.text;
 if(boundText?.template&&Array.isArray(boundText.args)){
   const args=boundText.args.map(x=>x.state?obs.state[x.state.slice(1)]:'?');
   dom.score.textContent=boundText.template.replace(/\{(\d+)\}/g,(all,index)=>index<args.length?String(args[index]):all);
 }else dom.score.textContent=Object.entries(obs.state).filter(([k,v])=>typeof v==='number'||typeof v==='boolean').map(([k,v])=>`${k}: ${v}`).join(' · ');
 const last=obs.events.slice(-3).map(e=>`${e.tickIndex} ${e.type} ${e.action||''}`).join('\n');
 dom.trace.textContent=`tick ${obs.tickIndex} · ${definition.world.clock.tickHz} Hz\n${last}`;
 dom.pause.textContent=obs.flow.status==='paused'?'继续':'暂停';
 for(const el of document.querySelectorAll('[data-action]')){
   el.disabled=!(definition.inputs.actions.some(x=>x.id===el.dataset.action)) || obs.flow.status!=='playing';
 }
}
function render(){if(!runtime||!adapter||adapter.disposed||disposal)return;const o=observation();adapter.draw(projectPresentation(definition,o));updateInfo(o);}
function sendAction(action){
 adapter?.unlockAudio?.();
 if(!runtime||runtime.status!=='playing'||!definition.inputs.actions.some(x=>x.id===action))return;
 const sourceId=`ui:${action}:${runtime.observe().tickIndex}`;
 runtime.injectAction({action,phase:'press',sourceId});runtime.injectAction({action,phase:'release',sourceId});
 record('action',{input:{action,phase:'press',sourceId}});record('action',{input:{action,phase:'release',sourceId}});
 // The animation-frame accumulator is the single production Tick driver.
 // Never advance simulation from DOM input callbacks.
}
function animate(now){
 if(disposal)return;
 try{
 if(!ts)ts=now;
 const dt=Math.max(0,(now-ts)/1000);ts=now;
 if(!manualClock&&runtime.status==='playing'){
   carry+=dt;const hz=definition.world.clock.tickHz,max=definition.world.clock.maxCatchUpTicks??5;
   const steps=Math.floor(carry*hz+1e-7);
   if(steps>max){
     // Explicit stall; never silently drop unprocessed simulation ticks.
     runtime.pause();carry=0;dom.hint.textContent='运行追帧超限，已暂停；点击「继续」恢复';
   }else if(steps>0){runtime.step(steps);carry-=steps/hz;}
 }
 if(contextState==='healthy')render();raf=requestAnimationFrame(animate);
 }catch(error){showError(error);void dispose().catch(cleanup=>console.error(cleanup));}
}
function bindInputs(){
 const canvas=dom.GameCanvas;
 const rawPointer=(e,kind)=>{
   if(runtime?.status!=='playing')return;
   const rect=canvas.getBoundingClientRect();
   const input={source:'pointer',kind,tickIndex:runtime.observe().tickIndex,timeUs:Math.round(performance.now()*1000),
      payload:{pointerId:e.pointerId,pointerType:e.pointerType,u:(e.clientX-rect.left)/rect.width,v:(e.clientY-rect.top)/rect.height}};
   runtime.injectRaw(input);record('raw',{input});
 };
 listen(canvas,'pointerdown',e=>{adapter?.unlockAudio?.();if(runtime.status==='playing'){canvas.setPointerCapture(e.pointerId);rawPointer(e,'down');}});
 listen(canvas,'pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))rawPointer(e,'move');});
 listen(canvas,'pointerup',e=>rawPointer(e,'up'));
 listen(canvas,'pointercancel',e=>rawPointer(e,'cancel'));
 listen(canvas,'lostpointercapture',e=>rawPointer(e,'cancel'));
 listen(window,'keydown',e=>{
   if(e.repeat||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
   const bound=definition.inputs.actions.find(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code));
   if(bound){e.preventDefault();sendAction(bound.id);}
 });
 document.querySelectorAll('[data-action]').forEach(btn=>listen(btn,'click',()=>sendAction(btn.dataset.action)));
 listen(dom.pause,'click',()=>{
   if(contextState==='reload-required'){location.reload();return;}
   if(contextState!=='healthy')return;
   if(runtime.status==='paused'){runtime.resume();record('resume');carry=0;ts=0;dom.hint.textContent='已恢复';}
   else if(runtime.status==='playing'){runtime.pause();adapter?.pauseAudio?.();record('pause');carry=0;dom.hint.textContent='已暂停';}render();
 });
 listen(dom.restart,'click',()=>{
   if(contextState!=='healthy')return;
   runtime.restart();record('restart');carry=0;ts=0;dom.hint.textContent='已重开';render();
 });
 listen(canvas,'webglcontextlost',e=>{
   if(adapter.disposed)return;
   e.preventDefault();contextState='lost';runtime.pause();adapter?.pauseAudio?.();record('pause');carry=0;
   adapter.releaseVisualsForContextLoss?.();
   updateInfo(runtime.observe());dom.hint.textContent='图形上下文已丢失，游戏已暂停';
 });
 listen(canvas,'webglcontextrestored',()=>{
   if(adapter.disposed)return;
   contextState=backendName==='air'?'reload-required':'healthy';carry=0;ts=0;
   if(contextState==='reload-required'){
     dom.hint.textContent='图形上下文需要重新加载；点击「重新加载」开始新一局';dom.pause.textContent='重新加载';
   }else{render();dom.hint.textContent='图形上下文已恢复；点击「继续」恢复游戏';}
 });
 listen(window,'blur',()=>{if(runtime.status==='playing'){runtime.pause();adapter?.pauseAudio?.();record('pause');carry=0;render();}});
 for(const which of ['game','backend'])listen(dom[which],'change',()=>{
   const query=new URLSearchParams({backend:dom.backend.value});
   if(dom.game.value==='imported'&&releaseId)query.set('release',releaseId);else query.set('game',dom.game.value);
   if(manualClock)query.set('clock','manual');location.search=query.toString();
 });
}
function dispose(){
 if(disposal)return disposal;
 if(raf)cancelAnimationFrame(raf);listeners.abort();runtime?.dispose();
 disposal=Promise.resolve().then(()=>adapter?.dispose()).finally(()=>resources?.dispose());return disposal;
}
async function main(){
 try{
   const registry=await createBrowserRegistry();
   if(releaseId){
     const released=await loadReleasedGame(releaseId,registry);definition=released.definition;
     resources=new ResourceScope(released.resources);await resources.load();
     const option=document.createElement('option');option.value='imported';option.textContent=`导入：${definition.meta.title}`;
     dom.game.appendChild(option);dom.game.value='imported';
     document.getElementById('importStatus').textContent='已校验并加载；本地发布已保存。';
   }else definition=await loadBuiltinGame(gameName);
   dom.hint.textContent=definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='touch.swipe'))
     ? '在画面内滑动 / 使用方向键' : '点击中央目标 / 点击收集按钮';
   runtime=new HeadlessRuntime(definition,registry);
   adapter=await createAdapter(backendName);
   // Allow the real SDK's first shader/UI frame to complete before starting gameplay time.
   render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   runtime.start();bindInputs();render();raf=requestAnimationFrame(animate);
   window.render_game_to_text=()=>JSON.stringify({coordinateSystem:'center origin, +X right, +Y up; pointer top-left',
     backend:backendName,clock:manualClock?'manual':'realtime',...runtime.observe(),
     presentation:projectPresentation(definition,runtime.observe())});
   window.__a2game={runtime,definition,dispatch:sendAction,getState:()=>runtime.observe(),getHash:()=>runtime.observe().exactHash,
     backend:backendName,dispose,diagnostics:()=>({contextState,adapter:adapter.diagnostics?.(),resources:resources?.diagnostics(),listenersActive:!listeners.signal.aborted})};
   if(manualClock){
     window.__a2game.getOperations=()=>structuredClone(operations);
     window.__a2game.step=ticks=>{const result=runtime.step(ticks);record('step',{ticks});if(contextState==='healthy')render();return result;};
     window.__a2game.recreateAdapter=async()=>{await adapter.dispose();adapter=await createAdapter(backendName);render();};
     window.advanceTime=ms=>{
       if(!Number.isFinite(ms)||ms<0)throw Error('Invalid advanceTime');
       if(runtime.status==='playing')carry+=ms*definition.world.clock.tickHz/1000;
       const ticks=Math.floor(carry+1e-7);carry-=ticks;
       if(ticks)window.__a2game.step(ticks);
     };
   }
 }catch(e){try{await dispose();}catch(cleanup){console.error(cleanup);}showError(e);}
}
window.addEventListener('pagehide',()=>{void dispose().catch(e=>console.error(e));},{once:true});
const exportButton=document.getElementById('exportGame');exportButton.disabled=!releaseId;
exportButton.addEventListener('click',async()=>{
 try{
   const response=await fetch(`/api/releases/${releaseId}/bundle`);if(!response.ok)throw Error('无法导出内容包，请检查回执状态。');
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`${releaseId}.a2game.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){document.getElementById('importStatus').textContent=`导出失败：${error.message}`;}
});
// Available even when a previous release expired or an SDK failed to start.
document.getElementById('importGame').addEventListener('change',async event=>{
 const input=event.target,file=input.files?.[0],status=document.getElementById('importStatus');if(!file)return;
 input.disabled=true;status.textContent='正在校验游戏…';
 try{
   const {receipt}=await importGameFile(file),query=new URLSearchParams({backend:dom.backend.value,release:receipt.sha256Jcs});
   if(manualClock)query.set('clock','manual');location.search=query.toString();
 }catch(error){
   const details=error.diagnostics?.slice(0,3).map(item=>`${item.pointer||'/'}：${item.message}`).join('\n');
   status.textContent=`导入失败：${error.code??''} ${error.message}${details?'\n'+details:''}`;
 }finally{input.disabled=false;input.value='';}
});
main();
