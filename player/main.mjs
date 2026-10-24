import {HeadlessRuntime,sha256Canonical,projectPresentation} from '../dist/index.js';
import {createBrowserRegistry} from './browser-registry.mjs';
import {CanvasPreviewAdapter} from './adapters/canvas-preview.mjs';
import {ThreeAdapter} from './adapters/three-adapter.mjs';
import {CocosAirAdapter} from './adapters/cocosairjs-adapter.mjs';

const dom=Object.fromEntries(['game','backend','restart','pause','GameCanvas','engineLabel','score','status','hash','trace','error','hint'].map(x=>[x,document.getElementById(x)]));
const params=new URLSearchParams(location.search);
const gameName=['tap-target','grid-merge','grid-merge-spawn','grid-push'].includes(params.get('game'))?params.get('game'):'tap-target';
const backendName=['preview','air','three'].includes(params.get('backend'))?params.get('backend'):'preview';
dom.game.value=gameName;dom.backend.value=backendName;
dom.engineLabel.textContent=backendName==='air'?'A2Game + CocosAirJS':backendName==='three'?'A2Game + Three.js':'A2Game + Canvas2D Preview';
let runtime,adapter,definition,raf,ts=0,carry=0,errorMessage='';
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
function render(){if(!runtime||!adapter)return;const o=observation();adapter.draw(projectPresentation(definition,o));updateInfo(o);}
function sendAction(action){
 if(!runtime||runtime.status!=='playing'||!definition.inputs.actions.some(x=>x.id===action))return;
 const sourceId=`ui:${action}:${runtime.observe().tickIndex}`;
 runtime.injectAction({action,phase:'press',sourceId});runtime.injectAction({action,phase:'release',sourceId});
 // The animation-frame accumulator is the single production Tick driver.
 // Never advance simulation from DOM input callbacks.
}
function animate(now){
 if(!runtime)return;
 if(!ts)ts=now;
 const dt=Math.max(0,(now-ts)/1000);ts=now;
 if(runtime.status==='playing'){
   carry+=dt;const hz=definition.world.clock.tickHz,max=definition.world.clock.maxCatchUpTicks??5;
   const steps=Math.floor(carry*hz+1e-7);
   if(steps>max){
     // Explicit stall; never silently drop unprocessed simulation ticks.
     runtime.pause();carry=0;dom.hint.textContent='运行追帧超限，已暂停；点击「继续」恢复';
   }else if(steps>0){runtime.step(steps);carry-=steps/hz;}
 }
 render();raf=requestAnimationFrame(animate);
}
function relPos(e){const r=dom.GameCanvas.getBoundingClientRect();return {u:(e.clientX-r.left)/r.width,v:(e.clientY-r.top)/r.height};}
function bindInputs(){
 const canvas=dom.GameCanvas;
 const rawPointer=(e,kind)=>{
   if(runtime?.status!=='playing')return;
   const rect=canvas.getBoundingClientRect();
   runtime.injectRaw({source:'pointer',kind,tickIndex:runtime.observe().tickIndex,timeUs:Math.round(performance.now()*1000),
      payload:{pointerId:e.pointerId,pointerType:e.pointerType,u:(e.clientX-rect.left)/rect.width,v:(e.clientY-rect.top)/rect.height}});
 };
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);rawPointer(e,'down');});
 canvas.addEventListener('pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))rawPointer(e,'move');});
 canvas.addEventListener('pointerup',e=>rawPointer(e,'up'));
 canvas.addEventListener('pointercancel',e=>rawPointer(e,'cancel'));
 canvas.addEventListener('lostpointercapture',e=>rawPointer(e,'cancel'));
 window.addEventListener('keydown',e=>{
   if(e.repeat||e.target instanceof HTMLSelectElement)return;
   const bound=definition.inputs.actions.find(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code));
   if(bound){e.preventDefault();sendAction(bound.id);}
 });
 document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>sendAction(btn.dataset.action)));
 dom.pause.addEventListener('click',()=>{
   if(runtime.status==='paused'){runtime.resume();carry=0;ts=0;dom.hint.textContent='已恢复';}
   else if(runtime.status==='playing'){runtime.pause();carry=0;dom.hint.textContent='已暂停';}render();
 });
 dom.restart.addEventListener('click',()=>{runtime.restart();carry=0;ts=0;dom.hint.textContent='已重开';render();});
 for(const which of ['game','backend'])dom[which].addEventListener('change',()=>{location.search=new URLSearchParams({game:dom.game.value,backend:dom.backend.value}).toString();});
}
async function main(){
 try{
   definition=await fetchValidatedGame(gameName);
   dom.hint.textContent=definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='touch.swipe'))
     ? '在画面内滑动 / 使用方向键' : '点击中央目标 / 点击收集按钮';
   const registry=await createBrowserRegistry();
   runtime=new HeadlessRuntime(definition,registry);
   adapter=await createAdapter(backendName);
   runtime.start();bindInputs();render();raf=requestAnimationFrame(animate);
   window.__a2game={runtime,definition,dispatch:sendAction,getState:()=>runtime.observe(),getHash:()=>runtime.observe().exactHash,backend:backendName};
 }catch(e){showError(e);}
}
window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);try{runtime?.dispose();void adapter?.dispose();}catch(e){console.error(e);}});
main();
