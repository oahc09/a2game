/** Collection UI only: gameplay is owned by the embedded shared Runtime. */
import {createFeedbackAudio} from './feedback-audio.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let collection,index=0,loading=true,awaitingDocument=true,lastMoves=0,lastFlow='',completed={};
const audio=createFeedbackAudio();
const backend=$('backend'),frame=$('game');
function showFailure(error){
  loading=true;$('message').textContent='关卡未能加载';$('error').textContent=String(error?.message??error);$('reload').hidden=false;
  backend.disabled=true;for(const button of document.querySelectorAll('#levels button,[data-action],#undo,#retry,#pause,#next'))button.disabled=true;
  clearInterval(poll);
}
$('reload').onclick=()=>location.reload();
backend.value=params.get('backend')==='three'?'three':'air';
const api=()=>frame.contentWindow?.__a2game;
const key=()=>`a2game.collection.${collection.id}.${collection.levels.map(l=>l.release).join('.')}`;
function action(id){if(loading||api()?.getState().flow.status!=='playing')return;frame.contentDocument.querySelector(`[data-action="${id}"]`)?.click();}
async function load(n){
  loading=true;awaitingDocument=true;index=n;lastMoves=0;lastFlow='';$('message').textContent='正在加载…';$('next').hidden=true;
  backend.disabled=true;for(const button of $('levels').children)button.disabled=true;
  try{await api()?.dispose();}catch(error){showFailure(`关闭上一关失败：${error.message}`);return;}
  const level=collection.levels[index];$('levelTitle').textContent=`${String(index+1).padStart(2,'0')} / ${level.title}`;$('hint').textContent=level.hint;$('moves').textContent='0 步';
  for(const [i,button]of [...$('levels').children].entries())button.setAttribute('aria-current',String(i===index));
  frame.src=`./index.html?embed=1&motion=1&backend=${backend.value}&release=${level.release}`;
}
function retry(){if(loading)return;frame.contentDocument.getElementById('restart').click();lastFlow='';audio.play('retry');}
function togglePause(){if(loading)return;frame.contentDocument.getElementById('pause').click();}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
$('undo').onclick=()=>{action('undo');audio.play('undo');};$('retry').onclick=retry;
$('pause').onclick=togglePause;
$('sound').onclick=async()=>{const enabled=await audio.enable(!audio.diagnostics().enabled);$('sound').setAttribute('aria-pressed',String(enabled));$('sound').textContent=audio.diagnostics().unavailable?'声音不可用':`声音：${enabled?'开':'关'}`;if(enabled)audio.play('move');};
$('next').onclick=()=>load((index+1)%collection.levels.length);backend.onchange=()=>load(index);
document.addEventListener('keydown',event=>{if(event.target instanceof HTMLSelectElement||event.repeat)return;const id={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',KeyZ:'undo'}[event.code];if(id){event.preventDefault();action(id);}if(event.code==='KeyR'){event.preventDefault();retry();}if(event.code==='KeyP'){event.preventDefault();togglePause();}});
frame.addEventListener('load',()=>{awaitingDocument=false;frame.contentDocument?.addEventListener('keydown',event=>{if(event.repeat)return;if(event.code==='KeyR'){event.preventDefault();retry();}if(event.code==='KeyP'){event.preventDefault();togglePause();}});});
const poll=setInterval(()=>{
  if(awaitingDocument)return;
  const error=frame.contentDocument?.getElementById('error');if(error?.textContent){showFailure(error.textContent);return;}
  const current=api();if(!current)return;const observation=current.getState(),state=observation.state,status=observation.flow.status;
  loading=false;$('moves').textContent=`${state.moves} 步`;$('undo').disabled=status!=='playing'||!state.history?.length;
  $('pause').disabled=!['playing','paused'].includes(status);$('pause').textContent=status==='paused'?'继续 P':'暂停 P';
  backend.disabled=false;for(const button of $('levels').children)button.disabled=false;
  if(state.moves!==lastMoves){if(state.moves>lastMoves)audio.play('move');lastMoves=state.moves;}
  if(status==='won'){
    if(lastFlow!=='won'){audio.play('success');completed[collection.levels[index].id]=true;try{localStorage.setItem(key(),JSON.stringify(completed));}catch{}renderProgress();}
    $('message').textContent=index===collection.levels.length-1?'三盏灯都亮了。谢谢你，把光送回家。':'这一束光，回家了。';$('next').hidden=index===collection.levels.length-1;
  }else{$('message').textContent=status==='paused'?'已暂停。准备好后点击继续。':'不赶时间，走错也可以撤销。';$('next').hidden=true;}
  lastFlow=status;
},100);
function renderProgress(){[...$('levels').children].forEach((button,i)=>button.querySelector('small').textContent=completed[collection.levels[i].id]?'已点亮 ✓':`参考 ${collection.levels[i].par} 步`);}
window.render_game_to_text=()=>JSON.stringify({collection:collection?.id,level:index,loading,game:api()?.getState()});
window.addEventListener('pagehide',()=>{clearInterval(poll);api()?.dispose();audio.dispose();});
try{
  const response=await fetch(`/api/collections/${encodeURIComponent(params.get('collection')??'lumen-depot')}`);if(!response.ok)throw Error(`关卡加载失败 HTTP ${response.status}`);collection=await response.json();
  $('title').textContent=collection.title;$('subtitle').textContent=collection.subtitle;document.title=collection.title+' · A2Game';
  try{completed=JSON.parse(localStorage.getItem(key())??'{}');if(!completed||Array.isArray(completed)||typeof completed!=='object')completed={};}catch{completed={};}
  collection.levels.forEach((level,i)=>{const button=document.createElement('button');button.append(document.createTextNode(`${i+1} · ${level.title}`),document.createElement('small'));button.onclick=()=>load(i);$('levels').append(button);});renderProgress();await load(0);
}catch(error){showFailure(`${error.message}。请检查本地服务日志后重试。`);}
