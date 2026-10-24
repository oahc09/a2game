import {HeadlessRuntime,sha256Canonical,projectPresentation} from '../dist/index.js';
import {createBrowserRegistry} from './browser-registry.mjs';
import {CanvasPreviewAdapter} from './adapters/canvas-preview.mjs';
import {ThreeAdapter} from './adapters/three-adapter.mjs';
import {CocosAirAdapter} from './adapters/cocosairjs-adapter.mjs';

const dom=Object.fromEntries(['game','backend','restart','pause','GameCanvas','engineLabel','score','status','hash','trace','error','hint'].map(x=>[x,document.getElementById(x)]));
const params=new URLSearchParams(location.search);
const gameName=['tap-target','grid-merge','grid-merge-spawn','grid-push'].includes(params.get('game'))?params.get('game'):'tap-target';
const backendName=['preview','air','three'].includes(params.get('backend'))?params.get('backend'):'preview';
// Explicit automation mode replaces the production clock; both use the same runtime.
const manualClock=params.get('clock')==='manual';
const operations=[];
const record=(op,payload)=>{if(manualClock)operations.push({op,...payload});};
const listeners=new AbortController();
const listen=(target,type,callback)=>target.addEventListener(type,callback,{signal:listeners.signal});
dom.game.value=gameName;dom.backend.value=backendName;
dom.engineLabel.textContent=backendName==='air'?'A2Game + CocosAirJS':backendName==='three'?'A2Game + Three.js':'A2Game + Canvas2D Preview';
let runtime,adapter,definition,raf,ts=0,carry=0,errorMessage='',contextState='healthy',disposal;
const showError=e=>{errorMessage=e instanceof Error?`${e.name}: ${e.message}`:String(e);dom.error.textContent=errorMessage;dom.error.style.display='block';dom.status.textContent='ERROR';dom.status.className='error';console.error(e);};
async function fetchValidatedGame(name){
 const catalogResp=await fetch('./validated-games.json');if(!catalogResp.ok)throw Error('Missing G0 validated catalog: run npm run catalog:build');
 const catalog=await catalogResp.json();
 const path=`/A2Game-V0.1-Spec/samples/games/${name}.game.json`;
 const record=catalog.content?.[path];if(!record)throw Error(`Game ${name} was not validated at G0`);
 const response=await fetch(path);if(!response.ok)throw Error(`Game request failed ${response.status}`);
 const obj=await response.json();
 if(record.sha256Jcs!==sha256Canonical(obj)||record.id!==obj.id||record.revision!==obj.revision)
     throw Error('A2G_E_RELEASE_INTEGRITY: Game JSON differs from fully validated G0 artifact');
 return obj;
}
async function createAdapter(mode){
 const canvas=dom.GameCanvas;
 if(mode==='preview') return new CanvasPreviewAdapter(canvas);
 if(mode==='three'){
   let three;
   try { three=await import('three'); }catch(e){throw Error('Three.js SDK missing. Provide player/vendor/three.module.js (official ESM build).');}
   return new ThreeAdapter(three,canvas);
 }
 let air;
 try {air=await import('cocosair.js');}catch(e){throw Error('CocosAirJS SDK missing. Provide player/vendor/cocosair.js (official ESM build).');}
 return CocosAirAdapter.create(air,canvas);
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
 if(!runtime||runtime.status!=='playing'||!definition.inputs.actions.some(x=>x.id===action))return;
 const sourceId=`ui:${action}:${runtime.observe().tickIndex}`;
 runtime.injectAction({action,phase:'press',sourceId});runtime.injectAction({action,phase:'release',sourceId});
 record('action',{input:{action,phase:'press',sourceId}});record('action',{input:{action,phase:'release',sourceId}});
 // The animation-frame accumulator is the single production Tick driver.
 // Never advance simulation from DOM input callbacks.
}
function animate(now){
 if(disposal)return;
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
 listen(canvas,'pointerdown',e=>{if(runtime.status==='playing'){canvas.setPointerCapture(e.pointerId);rawPointer(e,'down');}});
 listen(canvas,'pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))rawPointer(e,'move');});
 listen(canvas,'pointerup',e=>rawPointer(e,'up'));
 listen(canvas,'pointercancel',e=>rawPointer(e,'cancel'));
 listen(canvas,'lostpointercapture',e=>rawPointer(e,'cancel'));
 listen(window,'keydown',e=>{
   if(e.repeat||e.target instanceof HTMLSelectElement)return;
   const bound=definition.inputs.actions.find(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code));
   if(bound){e.preventDefault();sendAction(bound.id);}
 });
 document.querySelectorAll('[data-action]').forEach(btn=>listen(btn,'click',()=>sendAction(btn.dataset.action)));
 listen(dom.pause,'click',()=>{
   if(contextState==='reload-required'){location.reload();return;}
   if(contextState!=='healthy')return;
   if(runtime.status==='paused'){runtime.resume();record('resume');carry=0;ts=0;dom.hint.textContent='已恢复';}
   else if(runtime.status==='playing'){runtime.pause();record('pause');carry=0;dom.hint.textContent='已暂停';}render();
 });
 listen(dom.restart,'click',()=>{
   if(contextState!=='healthy')return;
   runtime.restart();record('restart');carry=0;ts=0;dom.hint.textContent='已重开';render();
 });
 listen(canvas,'webglcontextlost',e=>{
   if(adapter.disposed)return;
   e.preventDefault();contextState='lost';runtime.pause();record('pause');carry=0;
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
 listen(window,'blur',()=>{if(runtime.status==='playing'){runtime.pause();record('pause');carry=0;render();}});
 for(const which of ['game','backend'])listen(dom[which],'change',()=>{location.search=new URLSearchParams({game:dom.game.value,backend:dom.backend.value}).toString();});
}
function dispose(){
 if(disposal)return disposal;
 if(raf)cancelAnimationFrame(raf);listeners.abort();runtime?.dispose();
 disposal=Promise.resolve().then(()=>adapter?.dispose());return disposal;
}
async function main(){
 try{
   definition=await fetchValidatedGame(gameName);
   dom.hint.textContent=definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='touch.swipe'))
     ? '在画面内滑动 / 使用方向键' : '点击中央目标 / 点击收集按钮';
   const registry=await createBrowserRegistry();
   runtime=new HeadlessRuntime(definition,registry);
   adapter=await createAdapter(backendName);
   // Allow the real SDK's first shader/UI frame to complete before starting gameplay time.
   render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   runtime.start();bindInputs();render();raf=requestAnimationFrame(animate);
   window.render_game_to_text=()=>JSON.stringify({coordinateSystem:'center origin, +X right, +Y up; pointer top-left',
     backend:backendName,clock:manualClock?'manual':'realtime',...runtime.observe(),
     presentation:projectPresentation(definition,runtime.observe())});
   window.__a2game={runtime,definition,dispatch:sendAction,getState:()=>runtime.observe(),getHash:()=>runtime.observe().exactHash,
     backend:backendName,dispose,diagnostics:()=>({contextState,adapter:adapter.diagnostics?.(),listenersActive:!listeners.signal.aborted})};
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
main();
