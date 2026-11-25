import {createA2GamePlayer} from './index-sdk.mjs';
const $=id=>document.getElementById(id),keys=new Map(),pointers=new Map();
let actions=[],lastError='';
const notifyParent=(type,detail={})=>{if(window.parent!==window)window.parent.postMessage({format:'a2game-embed-event',type,...detail},location.origin);};
const selectedBackend=new URLSearchParams(location.search).get('backend');
$('backend').value=['three','cocosairjs'].includes(selectedBackend)?selectedBackend:'three';
$('backend').onchange=()=>{location.search='?backend='+encodeURIComponent($('backend').value);};
const focusCanvas=()=>$('game').querySelector('canvas')?.focus({preventScroll:true});
function clearBindings(){keys.clear();pointers.clear();for(const b of $('controls').children)b.setAttribute('aria-pressed','false');}
function update(){
 const state=player.status(),playing=state==='playing';
 $('start').disabled=state!=='ready';$('pause').disabled=!['playing','paused'].includes(state);
 $('pause').textContent=state==='paused'?'继续':'暂停';$('restart').disabled=!['playing','paused','won','lost'].includes(state);
 for(const button of $('controls').children)button.disabled=!playing;
 for(const button of $('deviceControls').querySelectorAll('button'))button.disabled=['disposing','disposed','loading','empty'].includes(state);
}
const player=createA2GamePlayer({backend:$('backend').value,container:$('game'),onEvent:event=>{
 if(event.type==='inputs-reset')clearBindings();
 if(event.type==='sensor-status'||event.type==='gamepad-status')$('deviceStatus').textContent=event.message??'';
 if(event.type==='sources-reset')$('deviceStatus').textContent='持续设备采样已停止；需要时重新启用并校准。';
 if(event.type==='status'){
  if(event.status!=='paused')lastError='';
  const text=({playing:'进行中',paused:'已暂停；继续后重新按住操作键',won:'挑战完成',lost:'本局结束，可重开',ready:'准备好后开始'})[event.status]??event.status;
  const score=event.score,settled=score?.settlement;
  if(score){$('scoreRecord').hidden=false;$('scoreRecord').textContent=`${score.available?'本机最高':'本页最高'}：${score.best}`;}
  $('status').textContent=lastError||(settled?`生存结束 · 本局 ${settled.score} 分${settled.newBest?' · 新纪录':''}，可重开`:text);update();
 }
 if(event.type==='error'){lastError=event.message==='A2G_E_CLOCK_STALL'?'运行追帧超限，已暂停；点击继续后重新按住操作键。':'运行失败：'+event.message;$('status').textContent=lastError;update();}
 if(event.type==='disposed'){clearBindings();$('status').textContent=lastError?lastError+'（实例已关闭）':'已销毁';update();}
}});
window.examplePlayer=player;
window.addEventListener('message',async event=>{const data=event.data;if(event.origin!==location.origin||event.source!==window.parent||window.parent===window||data?.format!=='a2game-embed-control'||data.action!=='dispose'||typeof data.requestId!=='string'||data.requestId.length>80)return;try{await player.dispose();notifyParent('disposed',{requestId:data.requestId});}catch(error){$('status').textContent='关闭未完成：'+error.message;notifyParent('dispose-failed',{requestId:data.requestId});}});
function cancelInputs(){clearBindings();if(!['disposing','disposed'].includes(player.status()))player.cancelInputs();}
function releasePointer(event){const entry=pointers.get(event.pointerId);if(!entry)return;pointers.delete(event.pointerId);player.release(entry.action,entry.source);event.currentTarget.setAttribute('aria-pressed','false');}
function buildControls(){
 const info=player.getInfo();$('title').textContent=info.title;$('description').textContent=info.description??'';actions=info.actions;
 $('deviceControls').hidden=!info.inputSources.sensors&&!info.inputSources.gamepad;
 for(const id of ['enableSensors','calibrateSensors','disableSensors'])$(id).hidden=!info.inputSources.sensors;
 for(const id of ['enableGamepad','disableGamepad'])$(id).hidden=!info.inputSources.gamepad;
 for(const action of actions){
  const button=document.createElement('button');button.dataset.action=action.id;button.textContent=action.label;button.title=action.keys.join(' / ')+(action.hold?' · 按住操作':'');
  if(action.hold){
   button.setAttribute('aria-pressed','false');
   button.onpointerdown=event=>{event.preventDefault();const source='pointer:'+event.pointerId;if(player.press(action.id,source)){pointers.set(event.pointerId,{action:action.id,source});button.setPointerCapture(event.pointerId);button.setAttribute('aria-pressed','true');}};
   for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,releasePointer);
  }else button.onclick=()=>{player.action(action.id);focusCanvas();};
  $('controls').append(button);
 }
 $('status').textContent='内容已校验加载。读完说明后点击开始，计时才会运行。';update();
}
$('start').onclick=()=>{player.start();focusCanvas();};
$('pause').onclick=()=>{if(player.status()==='playing'){cancelInputs();player.pause();}else if(player.status()==='paused'){player.resume();focusCanvas();}};
$('restart').onclick=()=>{cancelInputs();player.restart();focusCanvas();};
$('dispose').onclick=()=>{cancelInputs();void player.dispose();};
$('enableSensors').onclick=()=>{void player.enableSensors();};$('calibrateSensors').onclick=()=>player.calibrateSensors();$('disableSensors').onclick=()=>player.disableSensors();
$('enableGamepad').onclick=()=>player.enableGamepad();$('disableGamepad').onclick=()=>player.disableGamepad();
// CocosAirJS consumes canvas keyboard events at the target; read declared inputs before that.
window.addEventListener('keydown',event=>{
 if(player.status()!=='playing'||event.target.closest?.('button,select,input,textarea'))return;
 const action=actions.find(row=>row.keys.includes(event.code));if(!action)return;event.preventDefault();
 if(action.hold){if(!keys.has(event.code)&&player.press(action.id,'key:'+event.code))keys.set(event.code,action.id);}
 else if(!event.repeat)player.action(action.id);
},{capture:true});
window.addEventListener('keyup',event=>{const action=keys.get(event.code);if(!action)return;keys.delete(event.code);player.release(action,'key:'+event.code);},{capture:true});
const background=()=>{cancelInputs();if(player.status()==='playing')player.pause();};
window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});
window.addEventListener('pagehide',()=>{clearBindings();void player.dispose();},{once:true});
try{const response=await fetch('./game.release.json');if(!response.ok)throw Error('游戏包 HTTP '+response.status);const bundle=await response.json();await player.load(bundle);buildControls();notifyParent('ready',{gameId:bundle.definition.id,revision:bundle.definition.revision});}
catch(error){$('status').textContent='加载失败：'+error.message;update();notifyParent('load-failed');}
