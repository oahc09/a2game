import {measureTextReadability} from './text-readability.mjs';
import {createFrameMotion} from './frame-motion.mjs';
import {createFeedbackAudio} from './feedback-audio.mjs';
import {createEventFeedback} from './event-feedback.mjs';
import {createGamepadHost} from './gamepad-host.mjs';
import {HeadlessRuntime,projectPresentation,readPointer} from '../dist/index.js';
import {createBrowserRegistry} from './browser-registry.mjs';
import {CanvasPreviewAdapter} from './adapters/canvas-preview.mjs';
import {createPlayerEngineRegistry} from './engines.mjs';
import {loadBuiltinCatalog,loadBuiltinGame,loadBuiltinResources,loadReleasedGame,importGameFile} from './content-loader.mjs';
import {ResourceScope} from './resources.mjs';
import {createMobileHost,createTraceRecorder} from './mobile-host.mjs';

const dom=Object.fromEntries(['game','backend','restart','pause','GameCanvas','engineLabel','score','status','hash','trace','error','hint','instructions','stageResult','stageResultTitle','stageResultDetail','stageRestart'].map(x=>[x,document.getElementById(x)]));
const params=new URLSearchParams(location.search);
const engines=createPlayerEngineRegistry().register({id:'preview',label:'Canvas2D Preview',create:({canvas})=>new CanvasPreviewAdapter(canvas)});
if(params.get('embed')==='1')document.documentElement.classList.add('embedded');
const frameMotion=params.get('motion')==='1'?createFrameMotion():null;
const feedbackAudio=createFeedbackAudio(),eventFeedback=createEventFeedback({onSound:name=>feedbackAudio.play(name)});
let waitingToStart=false;
let effectsEnabled=params.get('feedback')==='1';
const effectsToggle=document.getElementById('effectsToggle'),effectsSound=document.getElementById('effectsSound');
effectsToggle.setAttribute('aria-pressed',String(effectsEnabled));effectsToggle.textContent=`事件特效：${effectsEnabled?'开':'关'}`;
effectsToggle.onclick=()=>{effectsEnabled=!effectsEnabled;eventFeedback.reset();effectsToggle.setAttribute('aria-pressed',String(effectsEnabled));effectsToggle.textContent=`事件特效：${effectsEnabled?'开':'关'}`;};
effectsSound.onclick=async()=>{const enabled=await feedbackAudio.enable(!feedbackAudio.diagnostics().enabled);effectsSound.setAttribute('aria-pressed',String(enabled));effectsSound.textContent=feedbackAudio.diagnostics().unavailable?'反馈声音不可用':`反馈声音：${enabled?'开':'关'}`;};
const gameName=params.get('game')??'tap-target';
const backendName=['preview','air','three'].includes(params.get('backend'))?params.get('backend'):'preview';
const releaseId=params.get('release');
// Explicit automation mode replaces the production clock; both use the same runtime.
const manualClock=params.get('clock')==='manual';
const operations=[];
const record=(op,payload)=>{if(manualClock)operations.push({op,...payload});};
const listeners=new AbortController();
const listen=(target,type,callback,options={})=>target.addEventListener(type,callback,{...options,signal:listeners.signal});
dom.game.value=gameName;dom.backend.value=backendName;
dom.engineLabel.textContent=backendName==='air'?'A2Game + CocosAirJS':backendName==='three'?'A2Game + Three.js':'A2Game + Canvas2D Preview';
let runtime,adapter,definition,resources,raf,resizeRaf,mobileHost,gamepadHost,traceRecorder,finishTrace=false,inputSequence=0,ts=0,carry=0,errorMessage='',contextState='healthy',disposal;
function inputTimeUs(){const tick=runtime.tickIndex,hz=definition.world.clock.tickHz;return Math.min(Math.ceil((tick+1)*1000000/hz)-1,Math.ceil(tick*1000000/hz)+Math.max(0,Math.floor(carry*1000000)));}
function injectRaw(input){if(runtime?.status!=='playing')return;input={...input,tickIndex:runtime.tickIndex,timeUs:inputTimeUs(),seq:inputSequence++};runtime.injectRaw(input);record('raw',{input});traceRecorder?.raw(input);}
function pauseSession(){feedbackAudio.silence();gamepadHost?.stop();traceRecorder?.control('pause',runtime.tickIndex);runtime.pause();mobileHost?.stop('游戏已暂停，采集已停止；继续后需显式启用并重新校准。');}
function resumeSession(){runtime.resume();traceRecorder?.control('resume',runtime.tickIndex);}
const showError=e=>{document.getElementById('readyPanel').hidden=true;errorMessage=`无法运行游戏：${e instanceof Error?e.message:String(e)}`;dom.error.textContent=errorMessage;dom.error.style.display='block';dom.status.textContent='ERROR';dom.status.className='error';console.error(e);};
async function createAdapter(mode){
 return engines.create(mode==='air'?'cocosairjs':mode,{canvas:dom.GameCanvas,definition,resources,signal:listeners.signal});
}
function observation(){return runtime?.observe();}
function updateInfo(obs){
 const statusLabels={playing:'进行中',paused:'已暂停',won:'已通关',lost:'本局结束',stopped:'对局已结束',error:'运行异常'};
 dom.status.textContent=statusLabels[obs.flow.status]??obs.flow.status;dom.status.className=['won','playing'].includes(obs.flow.status)?'':['paused','stopped'].includes(obs.flow.status)?'warn':'error';
 if(dom.status.dataset.flowStatus!==obs.flow.status){
   dom.status.dataset.flowStatus=obs.flow.status;
   document.getElementById('resultMessage').textContent=({won:'目标已完成。点击「重新开始」再玩一局。',lost:'这次未完成目标。点击「重新开始」重试。',paused:'游戏和计时已暂停。点击「继续」恢复。',stopped:'本局已结束。点击「重新开始」开启新一局。'})[obs.flow.status]??'';
   const result=({won:['已通关','目标已完成'],lost:['本局结束','目标未完成'],stopped:['对局已结束','可以重新开始']})[obs.flow.status];
   dom.stageResult.hidden=!result;
   if(result){dom.stageResultTitle.textContent=result[0];dom.stageResultDetail.textContent=result[1];dom.hint.textContent='';}
 }
 dom.hash.textContent=obs.exactHash;
 const hudLines=[];
 for(const item of definition.presentation.hud??[]){
   if(item.kind!=='text')continue;
   const boundText=item.bind?.text;
   if(boundText?.template&&Array.isArray(boundText.args)){
     const args=boundText.args.map(x=>x.state?readPointer(obs.state,x.state):'?');
     hudLines.push(boundText.template.replace(/\{(\d+)\}/g,(all,index)=>index<args.length?String(args[index]):all));
   }else if(boundText&&Object.hasOwn(boundText,'literal'))hudLines.push(String(boundText.literal));
   else if(boundText?.state)hudLines.push(String(readPointer(obs.state,boundText.state)));
   else if(typeof item.bind?.state==='string'){
     // HUD bindings are optional metadata; a bad pointer must not stop the game.
     try{const value=readPointer(obs.state,item.bind.state);if(['string','number','boolean'].includes(typeof value)){const text=typeof value==='boolean'?(value?'是':'否'):String(value),ratio=typeof value==='number'&&typeof item.text==='string'?item.text.match(/^(.+?)\s*\/\s*(\d+)\s*$/):null;hudLines.push(ratio?`${ratio[1].trim()}：${text} / ${ratio[2]}`:item.text?`${item.text}：${text}`:text);}}catch{}
   }else if(typeof item.text==='string'&&item.text)hudLines.push(item.text);
 }
 dom.score.textContent=hudLines.length?hudLines.join('\n'):Object.entries(obs.state).filter(([k,v])=>typeof v==='number'||typeof v==='boolean').map(([k,v])=>`${k}: ${v}`).join(' · ');
 const last=obs.events.slice(-3).map(e=>`${e.tickIndex} ${e.type} ${e.action||e.payload?.reason||''}`).join('\n');
 dom.trace.textContent=`tick ${obs.tickIndex} · ${definition.world.clock.tickHz} Hz\n${last}`;
 dom.pause.textContent=obs.flow.status==='paused'?'继续':'暂停';
 for(const el of document.querySelectorAll('[data-action]')){
   el.disabled=!(definition.inputs.actions.some(x=>x.id===el.dataset.action)) || obs.flow.status!=='playing';
 }
}
function render(){if(!runtime||!adapter||adapter.disposed||disposal)return;if(traceRecorder?.diagnostics().overflow){finishTrace=false;document.getElementById('traceStatus').textContent='录制超过 4096 个样本，已停止；请重开并缩短录制。';document.getElementById('traceExport').disabled=true;}if(finishTrace){const snapshot=runtime.snapshot();if(!snapshot.inputQueue.length&&!snapshot.rawQueue.length){traceRecorder.stop(snapshot.tickIndex);finishTrace=false;document.getElementById('traceStatus').textContent='录制已结束；数据仅保存在本页内存，可导出。';document.getElementById('traceExport').disabled=false;}}const o=observation();const target=projectPresentation(definition,o);if(effectsEnabled||feedbackAudio.diagnostics().enabled)eventFeedback.capture(definition,o,{visual:effectsEnabled});const decorated=effectsEnabled?eventFeedback.project(target):target;adapter.draw(frameMotion?frameMotion.project(decorated):decorated);updateInfo(o);}
function sendAction(action){
 adapter?.unlockAudio?.();
 if(!runtime||runtime.status!=='playing'||!definition.inputs.actions.some(x=>x.id===action))return;
 const sourceId=`ui:${action}:${runtime.tickIndex}`;
 for(const phase of ['press','release']){const input={action,phase,sourceId,tickIndex:runtime.tickIndex,timeUs:inputTimeUs(),seq:inputSequence++};runtime.injectAction(input);record('action',{input});traceRecorder?.action(input,input.tickIndex,input.timeUs);}
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
     pauseSession();carry=0;dom.hint.textContent='运行追帧超限，已暂停；点击「继续」恢复';
   }else if(steps>0){for(let i=0;i<steps;i++){gamepadHost?.poll();mobileHost?.poll();runtime.step(1);if(effectsEnabled||feedbackAudio.diagnostics().enabled)eventFeedback.capture(definition,runtime.observe(),{visual:effectsEnabled});}carry-=steps/hz;}
 }
 // Manual-clock callers draw after each step/control; idle frames have no new presentation.
 if(contextState==='healthy'&&!manualClock)render();raf=requestAnimationFrame(animate);
 }catch(error){showError(error);void dispose().catch(cleanup=>console.error(cleanup));}
}
function bindInputs(){
 const extra=document.getElementById('extraActions'),existing=new Set([...document.querySelectorAll('[data-action]')].map(button=>button.dataset.action));
 const names={left:'向左',right:'向右',up:'向上',down:'向下',fire:'射击',charge:'蓄力',drop:'放下',rotate:'旋转',undo:'撤销',restart:'重新开始',jump:'跳跃',flap:'拍翼',kick:'弹射',skill:'使用技能',upgrade:'升级',harvest:'收获',plant:'播种',unlock:'解锁',shake:'摇动',shakeFallback:'按钮摇动',spawn:'放置',hold:'按住机关',confirm:'确认',attack:'攻击',collect:'收集'};
 const declaredLabel=id=>definition.presentation.hud?.find(item=>item.kind==='button'&&item.bind?.action===id&&typeof item.text==='string'&&item.text.trim())?.text;
 const label=id=>{const match=id.match(/^(cell|place|select|merge|upgrade)(\d+)$/);return declaredLabel(id)??names[id]??(match?({cell:'格位',place:'建造',select:'选择',merge:'合成',upgrade:'升级'})[match[1]]+' '+Number(match[2]):id);};
 for(const action of definition.inputs.actions)if(action.valueType==='button'&&!existing.has(action.id)){const button=document.createElement('button');button.dataset.action=action.id;button.textContent=label(action.id);extra.appendChild(button);}
 for(const button of document.querySelectorAll('[data-action]')){const action=definition.inputs.actions.find(a=>a.id===button.dataset.action);if(!action)continue;const declared=declaredLabel(action.id);if(declared){if(!button.closest('.pad')||action.id==='collect')button.textContent=declared;button.setAttribute('aria-label',declared);}const keys=action.bindings.filter(b=>b.source==='keyboard.button').map(b=>({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'空格',Enter:'回车'})[b.config?.code]??String(b.config?.code??'').replace(/^(Key|Digit)/,''));button.title=label(action.id)+(keys.length?' · 键盘 '+keys.join(' / '):'');}
 document.querySelector('.play-controls').classList.toggle('compact',definition.inputs.actions.filter(a=>a.valueType==='button').length<=6);
 document.querySelector('.play-controls').hidden=!definition.inputs.actions.some(a=>a.valueType==='button');
 document.querySelector('.pad').style.display=definition.inputs.actions.some(action=>existing.has(action.id))?'':'none';
 for(const button of document.querySelectorAll('.pad [data-action]'))button.style.visibility=definition.inputs.actions.some(action=>action.id===button.dataset.action)?'':'hidden';
 if(definition.inputs.actions.some(action=>action.id==='collect')&&!declaredLabel('collect'))document.querySelector('[data-action="collect"]').textContent='收集';
 const canvas=dom.GameCanvas;
 const rawPointer=(e,kind)=>{
   if(runtime?.status!=='playing')return;
   const rect=canvas.getBoundingClientRect();
   const input={source:'pointer',kind,
      payload:{pointerId:e.pointerId,pointerType:e.pointerType,u:(e.clientX-rect.left)/rect.width,v:(e.clientY-rect.top)/rect.height,viewportAspect:rect.width/rect.height}};
   injectRaw(input);
 };
 listen(canvas,'pointerdown',()=>canvas.focus({preventScroll:true}),{capture:true});
 listen(canvas,'pointerdown',e=>{adapter?.unlockAudio?.();if(runtime.status==='playing'){canvas.setPointerCapture(e.pointerId);rawPointer(e,'down');}});
 listen(canvas,'pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))rawPointer(e,'move');});
 listen(canvas,'pointerup',e=>rawPointer(e,'up'));
 listen(canvas,'pointercancel',e=>rawPointer(e,'cancel'));
 listen(canvas,'lostpointercapture',e=>rawPointer(e,'cancel'));
 listen(window,'keydown',e=>{
   if(e.repeat||e.target===dom.stageRestart||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
   const bound=definition.inputs.actions.find(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code));
   if(bound){e.preventDefault();if(bound.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code&&b.config?.hold===true))injectRaw({source:'keyboard',kind:'down',payload:{code:e.code}});else sendAction(bound.id);}
  },{capture:true});
 listen(window,'keyup',e=>{
   if(e.target===dom.stageRestart)return;
   if(definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='keyboard.button'&&b.config?.code===e.code&&b.config?.hold===true))){e.preventDefault();injectRaw({source:'keyboard',kind:'up',payload:{code:e.code}});}
 },{capture:true});
 document.querySelectorAll('[data-action]').forEach(btn=>{
   const action=definition.inputs.actions.find(a=>a.id===btn.dataset.action),held=action?.bindings.some(b=>b.source==='keyboard.button'&&b.config?.hold===true);
   if(!held){listen(btn,'click',()=>sendAction(btn.dataset.action));return;}
   const edge=(e,phase)=>{e.preventDefault();if(runtime.status!=='playing')return;const input={action:action.id,phase,sourceId:`ui-hold:${action.id}:${e.pointerId}`,tickIndex:runtime.tickIndex,timeUs:inputTimeUs(),seq:inputSequence++};runtime.injectAction(input);record('action',{input});traceRecorder?.action(input,input.tickIndex,input.timeUs);};
   listen(btn,'pointerdown',e=>{if(runtime.status==='playing'){btn.setPointerCapture(e.pointerId);edge(e,'press');}});
   listen(btn,'pointerup',e=>edge(e,'release'));listen(btn,'pointercancel',e=>edge(e,'cancel'));listen(btn,'lostpointercapture',e=>edge(e,'cancel'));
 });
 listen(dom.pause,'click',()=>{
   if(contextState==='reload-required'){location.reload();return;}
   if(contextState!=='healthy')return;
   const startingFromReady=waitingToStart;
   if(waitingToStart){waitingToStart=false;document.getElementById('readyPanel').hidden=true;}
   if(runtime.status==='paused'){resumeSession();record('resume');carry=0;ts=0;dom.hint.textContent=startingFromReady?'已开始':'已恢复；持续操作请重新按住按键';}
   else if(runtime.status==='playing'){pauseSession();adapter?.pauseAudio?.();record('pause');carry=0;dom.hint.textContent='已暂停';}render();
 });
 listen(dom.restart,'click',()=>{
   if(contextState!=='healthy')return;
   waitingToStart=false;document.getElementById('readyPanel').hidden=true;eventFeedback.reset();frameMotion?.reset();runtime.restart();record('restart');mobileHost?.stop();gamepadHost?.stop();traceRecorder=createTraceRecorder(definition,()=>inputSequence++);finishTrace=false;inputSequence=0;carry=0;ts=0;document.getElementById('traceExport').disabled=true;dom.hint.textContent='已重开';render();
 });
 listen(dom.stageRestart,'click',()=>{dom.restart.click();if(runtime.status==='playing')canvas.focus({preventScroll:true});});
 listen(document.getElementById('prepareRestart'),'click',()=>{if(contextState!=='healthy')return;dom.restart.click();if(runtime.status==='playing'){pauseSession();waitingToStart=true;carry=0;ts=0;document.getElementById('readyPanel').hidden=false;render();}});
 listen(document.getElementById('readyStart'),'click',()=>{if(waitingToStart&&contextState==='healthy'){adapter?.unlockAudio?.();dom.pause.click();canvas.focus({preventScroll:true});}});
 listen(canvas,'webglcontextlost',e=>{
   if(adapter.disposed)return;
   e.preventDefault();contextState='lost';pauseSession();adapter?.pauseAudio?.();record('pause');carry=0;
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
 // Let the native SDK's container/layout observers finish before changing its design size.
 // Two coalesced frames avoid a transient zero screen scale during a viewport switch.
 listen(window,'resize',()=>{if(!manualClock)return;cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(()=>{resizeRaf=requestAnimationFrame(()=>{resizeRaf=undefined;if(!disposal&&contextState==='healthy')render();});});});
 listen(window,'blur',()=>{
   // Moving from an embedded canvas to its same-origin host controls is still
   // inside the game application. A real tab/window blur remains a pause.
   try{if(params.get('embed')==='1'&&parent!==window&&!parent.document.hidden&&parent.document.hasFocus()){
     const heldKeys=new Set(definition.inputs.actions.flatMap(action=>action.bindings.filter(binding=>binding.source==='keyboard.button'&&binding.config?.hold===true).map(binding=>binding.config.code)));
     for(const code of heldKeys)injectRaw({source:'keyboard',kind:'cancel',payload:{code}});
     return;
   }}catch{}
   if(runtime.status==='playing'){pauseSession();adapter?.pauseAudio?.();record('pause');carry=0;render();}
 });
 listen(document,'visibilitychange',()=>{if(document.hidden&&runtime.status==='playing'){pauseSession();adapter?.pauseAudio?.();record('pause');carry=0;render();}});
 for(const which of ['game','backend'])listen(dom[which],'change',()=>{
   const query=new URLSearchParams({backend:dom.backend.value});
   if(dom.game.value==='imported'&&releaseId)query.set('release',releaseId);else query.set('game',dom.game.value);
   if(manualClock)query.set('clock','manual');location.search=query.toString();
 });
}
function dispose(){
 if(disposal)return disposal;
 dom.stageResult.hidden=true;document.getElementById('readyPanel').hidden=true;
 if(raf)cancelAnimationFrame(raf);if(resizeRaf)cancelAnimationFrame(resizeRaf);gamepadHost?.dispose();listeners.abort();traceRecorder?.dispose();runtime?.dispose();
 eventFeedback.dispose();disposal=Promise.resolve().then(()=>adapter?.dispose()).finally(()=>feedbackAudio.dispose()).finally(()=>resources?.dispose());return disposal;
}
async function main(){
 try{
   const registry=await createBrowserRegistry();
   const catalog=await loadBuiltinCatalog(),groups=new Map();dom.game.replaceChildren();
   for(const entry of catalog){const label=['tap-target','grid-merge','grid-merge-spawn','grid-push'].includes(entry.name)?'基础示例':/^[gh]\d\d-candidate$/.test(entry.name)?'Gxx / Hxx 参考玩法':/^[gh]\d\d-/.test(entry.name)?'作者编写的规则变体':'机制实验';let group=groups.get(label);if(!group){group=document.createElement('optgroup');group.label=label;groups.set(label,group);dom.game.appendChild(group);}const option=document.createElement('option');option.value=entry.name;option.textContent=entry.title;group.appendChild(option);}
   dom.game.value=gameName;
   if(releaseId){
     const released=await loadReleasedGame(releaseId,registry);definition=released.definition;
     resources=new ResourceScope(released.resources);await resources.load();
     const option=document.createElement('option');option.value='imported';option.textContent=`导入：${definition.meta.title}`;
     dom.game.appendChild(option);dom.game.value='imported';
     document.getElementById('importStatus').textContent='已校验并加载；本地发布已保存。';
   }else{definition=await loadBuiltinGame(gameName);resources=new ResourceScope(await loadBuiltinResources(definition,registry));await resources.load();}
   dom.instructions.textContent=definition.meta.description??(definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='touch.swipe'))
     ? '在画面内滑动 / 使用方向键' : '使用画面或右侧按钮操作');
   runtime=new HeadlessRuntime(definition,registry);
   traceRecorder=createTraceRecorder(definition,()=>inputSequence++);
   mobileHost=createMobileHost({getRuntime:()=>runtime,inject:injectRaw,onStatus:result=>{document.getElementById('sensorStatus').textContent=result.message;},signal:listeners.signal});
   gamepadHost=createGamepadHost({inject:injectRaw,onStatus:message=>{const status=document.getElementById('gamepadStatus');if(status)status.textContent=message;}});
   if(definition.inputs.actions.some(a=>a.bindings.some(b=>b.source.startsWith('gamepad.')))){const control=document.createElement('button'),status=document.createElement('span');control.id='gamepadEnable';control.textContent='启用手柄';status.id='gamepadStatus';status.setAttribute('role','status');listen(control,'click',()=>gamepadHost.enable());document.getElementById('extraActions').append(control,status);}
   const imuDeclared=definition.requires.all.some(ref=>ref.id.startsWith('a2game.input.imu.'));
   document.getElementById('mobilePanel').hidden=!imuDeclared&&definition.inputs.traceRecording!=='user-opt-in';
   document.getElementById('recordingControls').hidden=definition.inputs.traceRecording!=='user-opt-in';
   document.getElementById('sensorControls').hidden=!imuDeclared;
   document.getElementById('sensorEnable').disabled=!imuDeclared;
   listen(document.getElementById('sensorEnable'),'click',()=>{void mobileHost.enable();});
   listen(document.getElementById('sensorCalibrate'),'click',()=>mobileHost.calibrate());
   listen(document.getElementById('sensorStop'),'click',()=>{mobileHost.stop();});
   document.getElementById('traceStart').disabled=definition.inputs.traceRecording!=='user-opt-in';
   listen(document.getElementById('traceStart'),'click',()=>{waitingToStart=false;document.getElementById('readyPanel').hidden=true;eventFeedback.reset();frameMotion?.reset();runtime.restart();record('restart');mobileHost.stop();gamepadHost.stop();inputSequence=0;carry=0;ts=0;finishTrace=false;traceRecorder=createTraceRecorder(definition,()=>inputSequence++);traceRecorder.start();document.getElementById('traceExport').disabled=true;document.getElementById('traceStatus').textContent='正在录制；可随时结束，离开页面会释放数据。';render();});
   listen(document.getElementById('traceStop'),'click',()=>{if(traceRecorder.diagnostics().recording){finishTrace=true;render();}});
   listen(document.getElementById('traceExport'),'click',()=>{try{const trace=traceRecorder.export(),url=URL.createObjectURL(new Blob([JSON.stringify(trace,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=definition.id+'.input-trace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){document.getElementById('traceStatus').textContent=error.message;}});
   adapter=await createAdapter(backendName);
   // Allow the real SDK's first shader/UI frame to complete before starting gameplay time.
   render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   runtime.start();bindInputs();if(params.get('ready')==='1'){pauseSession();waitingToStart=true;document.getElementById('readyPanel').hidden=false;}render();raf=requestAnimationFrame(animate);
   window.render_game_to_text=()=>JSON.stringify({coordinateSystem:'center origin, +X right, +Y up; pointer top-left',
     backend:backendName,clock:manualClock?'manual':'realtime',...runtime.observe(),
     presentation:projectPresentation(definition,runtime.observe())});
   window.__a2game={runtime,definition,dispatch:sendAction,getState:()=>runtime.observe(),getHash:()=>runtime.observe().exactHash,
     getTextReadability:(options={})=>measureTextReadability(projectPresentation(definition,runtime.observe()),dom.GameCanvas,{referenceCssPx:options.referenceCssPx??16,backend:backendName,adapter}),
     backend:backendName,dispose,getInputTrace:()=>traceRecorder.export(),diagnostics:()=>({contextState,feedback:{visualEnabled:effectsEnabled,audio:feedbackAudio.diagnostics(),...eventFeedback.diagnostics()},gamepad:gamepadHost.diagnostics(),mobile:mobileHost.diagnostics(),recording:traceRecorder.diagnostics(),adapter:adapter.diagnostics?.(),resources:resources?.diagnostics(),listenersActive:!listeners.signal.aborted})};
   if(manualClock){
     window.__a2game.getOperations=()=>structuredClone(operations);
     window.__a2game.injectRaw=injectRaw;
     window.__a2game.injectAction=input=>{input={...input,tickIndex:runtime.tickIndex,timeUs:inputTimeUs(),seq:inputSequence++};runtime.injectAction(input);record('action',{input});traceRecorder.action(input,input.tickIndex,input.timeUs);};
     window.__a2game.step=ticks=>{if(!Number.isInteger(ticks)||ticks<1||ticks>100000)throw Error('Invalid step budget');let advanced=0;for(let i=0;i<ticks&&runtime.status==='playing';i++){gamepadHost.poll();mobileHost.poll();advanced+=runtime.step(1).advanced;if(effectsEnabled||feedbackAudio.diagnostics().enabled)eventFeedback.capture(definition,runtime.observe(),{visual:effectsEnabled});}const result={requested:ticks,advanced,status:runtime.status};record('step',{ticks});if(contextState==='healthy')render();return result;};
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
