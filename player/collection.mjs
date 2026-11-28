/** Collection UI only: gameplay is owned by the embedded shared Runtime. */
import {createFeedbackAudio} from './feedback-audio.mjs';
import {actionLabel} from './input-labels.mjs';
import {loadStaticCollection,staticDelivery} from './static-delivery.mjs';
import {scoreStars,starThresholds} from './score-record.mjs';
import {readPointer} from '../dist/utils.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let collection,index=0,loading=true,awaitingDocument=true,lastMoves=0,lastFlow='',completed={},flowObserver;
let actionRuntime, stateRuntime, puzzleStatePath;
const audio=createFeedbackAudio();
let soundWanted=false,activatingSound=false;
const sound=$('sound');
sound.disabled=true;
const soundKey=()=>`a2game.collection.sound.v1.${collection.id}`;
function showSound(){
  const {enabled,contextState,unavailable}=audio.diagnostics();
  sound.setAttribute('aria-pressed',String(soundWanted));
  sound.textContent=!soundWanted?'声音：关':enabled&&contextState==='running'?'声音：开':
    unavailable?'声音不可用':'声音：开（待启用）';
}
async function activateSound(){
  const {enabled,contextState}=audio.diagnostics();
  if(!soundWanted||activatingSound||enabled&&contextState==='running')return;
  activatingSound=true;
  try{await audio.enable(true);}
  finally{activatingSound=false;showSound();}
}
function unlockSavedSound(event){
  if(event.target!==sound)void activateSound();
}
document.addEventListener('pointerdown',unlockSavedSound,{capture:true});
document.addEventListener('keydown',unlockSavedSound,{capture:true});
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
const validScore=score=>Number.isSafeInteger(score)&&score>=0;
const recordAt=i=>completed[collection.levels[i].id];
const isCompleted=i=>recordAt(i)===true||validScore(recordAt(i)?.bestScore);
const isUnlocked=i=>!collection.progressive||i===0||isCompleted(i-1);
function readProgress(){
  const records=JSON.parse(localStorage.getItem(key())??'{}');
  if(!records||Array.isArray(records)||typeof records!=='object')return {};
  return Object.fromEntries(collection.levels.flatMap(({id})=>{
    const record=records[id];
    return record===true||validScore(record?.bestScore)?[[id,record]]:[];
  }));
}
function puzzleState(current,state){
  if(stateRuntime!==current){
    stateRuntime=current;
    const component=current.definition.scenes.flatMap(scene=>scene.entities)
      .flatMap(entity=>entity.components??[])
      .find(component=>component.capability.id==='a2game.puzzle.tray'||component.capability.id==='a2game.puzzle.swap');
    puzzleStatePath=component?.config.statePath;
  }
  return puzzleStatePath?readPointer(state,puzzleStatePath):state.puzzle;
}
function saveWin(){
  const current=api(),outcome=current?.getState();
  if(outcome?.flow.status!=='won')return;
  const {id,baseScore}=collection.levels[index],score=puzzleState(current,outcome.state)?.score;
  try{
    for(const [level,record] of Object.entries(readProgress())){
      if(!Object.hasOwn(completed,level)||validScore(record?.bestScore)&&record.bestScore>(completed[level]?.bestScore??-1))completed[level]=record;
    }
  }catch{}
  if(!baseScore){
    if(isCompleted(index))return;
    completed[id]=true;
  }else{
    if(!validScore(score)||score<=(recordAt(index)?.bestScore??-1))return;
    completed[id]={bestScore:score};
  }
  try{localStorage.setItem(key(),JSON.stringify(completed));}catch{}
  renderProgress();
}
function action(id){if(loading||api()?.getState().flow.status!=='playing')return;frame.contentDocument.querySelector(`[data-action="${id}"]`)?.click();}
async function load(n){
  if(!isUnlocked(n))return;
  flowObserver?.disconnect();
  $('levelActions').hidden=true;$('levelHud').hidden=true;
  loading=true;awaitingDocument=true;index=n;lastMoves=0;lastFlow='';$('message').textContent='正在加载…';$('next').hidden=true;
  backend.disabled=true;for(const button of $('levels').children)button.disabled=true;
  try{await api()?.dispose();}catch(error){showFailure(`关闭上一关失败：${error.message}`);return;}
  const level=collection.levels[index];$('levelTitle').textContent=`${String(index+1).padStart(2,'0')} / ${level.title}`;$('hint').textContent=level.baseScore?`${level.hint} 星级参考分 ${starThresholds(level.baseScore).join(' / ')}。`:level.hint;$('moves').textContent='0 步';
  for(const [i,button]of [...$('levels').children].entries())button.setAttribute('aria-current',String(i===index));
  frame.src=`./index.html?embed=1&motion=1&backend=${backend.value}&release=${level.release}`;
}
function retry(){if(loading)return;frame.contentDocument.getElementById('restart').click();lastFlow='';audio.play('retry');}
function togglePause(){if(loading)return;frame.contentDocument.getElementById('pause').click();}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
$('undo').onclick=()=>{action('undo');audio.play('undo');};$('retry').onclick=retry;
$('pause').onclick=togglePause;
sound.onclick=async()=>{
  soundWanted=!soundWanted;
  try{localStorage.setItem(soundKey(),soundWanted?'on':'off');}catch{}
  if(soundWanted){await activateSound();audio.play('move');}
  else await audio.enable(false);
  showSound();
};
$('next').onclick=()=>load((index+1)%collection.levels.length);backend.onchange=()=>load(index);
document.addEventListener('keydown',event=>{if(event.target instanceof HTMLSelectElement||event.repeat)return;const id={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',KeyZ:'undo'}[event.code];if(id){event.preventDefault();action(id);}if(event.code==='KeyR'){event.preventDefault();retry();}if(event.code==='KeyP'){event.preventDefault();togglePause();}});
frame.addEventListener('load',()=>{
  awaitingDocument=false;
  const doc=frame.contentDocument;
  doc?.addEventListener('pointerdown',unlockSavedSound,{capture:true});
  doc?.addEventListener('keydown',unlockSavedSound,{capture:true});
  doc?.addEventListener('keydown',event=>{if(event.repeat||event.defaultPrevented)return;if(event.code==='KeyR'){event.preventDefault();retry();}if(event.code==='KeyP'){event.preventDefault();togglePause();}});
  const status=doc?.getElementById('status');
  if(!status||!collection)return;
  const recordWin=()=>{if(status.dataset.flowStatus==='won')saveWin();};
  flowObserver=new MutationObserver(recordWin);
  flowObserver.observe(status,{attributes:true,attributeFilter:['data-flow-status']});
  recordWin();
});
const poll=setInterval(()=>{
  if(awaitingDocument)return;
  const error=frame.contentDocument?.getElementById('error');if(error?.textContent){showFailure(error.textContent);return;}
  const current=api();if(!current)return;const observation=current.getState(),state=observation.state,status=observation.flow.status;
  const puzzle=puzzleState(current,state);
  const actions=current.definition.inputs.actions.map(action=>action.id);
  if(collection.progressive&&actionRuntime!==current){
    actionRuntime=current;
    const buttons=current.definition.inputs.actions.filter(a=>a.valueType==='button'&&a.bindings.some(b=>b.source!=='touch.select')&&!['left','right','up','down','undo'].includes(a.id)).map(a=>{
      const button=document.createElement('button');button.textContent=actionLabel(current.definition,a);
      button.onclick=()=>action(a.id);return button;
    });
    $('levelActions').replaceChildren(...buttons);$('levelActions').hidden=!buttons.length;
  }
  for(const button of $('levelActions').children)button.disabled=status!=='playing';
  if(collection.progressive){
    const hud=$('levelHud');
    hud.textContent=frame.contentDocument?.getElementById('score')?.textContent??'';
    hud.hidden=!hud.textContent;
  }
  const moves=state.moves??puzzle?.moves;
  loading=false;$('moves').textContent=Number.isSafeInteger(moves)?`${moves} 步`:'';
  const directions=[...document.querySelectorAll('.pad [data-action]')];
  for(const button of directions)button.hidden=collection.progressive&&!actions.includes(button.dataset.action);
  document.querySelector('.pad').hidden=directions.every(button=>button.hidden);
  $('undo').hidden=collection.progressive&&!actions.includes('undo');
  $('undo').disabled=status!=='playing'||!(state.history??puzzle?.history)?.length;
  $('pause').disabled=!['playing','paused'].includes(status);$('pause').textContent=status==='paused'?'继续 P':'暂停 P';
  $('retry').textContent=status==='ready'?'重新开始 R':'重试 R';
  backend.disabled=false;
  if(Number.isSafeInteger(moves)&&moves!==lastMoves){if(moves>lastMoves)audio.play('move');lastMoves=moves;}
  const latestShuffle=observation.events.findLast(event=>event.type==='puzzle.deadboard');
  const latestMove=observation.events.findLast(event=>event.type==='puzzle.changed');
  const deadboard=latestShuffle&&(!latestMove||latestShuffle.tickIndex>=latestMove.tickIndex)?latestShuffle.payload:undefined;
  if(status==='won'){
    if(lastFlow!=='won'){audio.play('success');saveWin();}
    const message=collection.progressive?(index===collection.levels.length-1?'全部关卡已完成。':'本关已完成，可以进入下一关。'):(index===collection.levels.length-1?'三盏灯都亮了。谢谢你，把光送回家。':'这一束光，回家了。');
    const baseScore=collection.levels[index].baseScore;
    const score=puzzle?.score;
    $('message').textContent=baseScore&&validScore(score)?`${message} 本局 ${scoreStars(status,score,baseScore)} 星 · ${score} 分`:message;$('next').hidden=index===collection.levels.length-1;
  }else{
    const saveStatus=current.getSaveStatus();
    const toolHint=({hammer:'请点击要击打的棋子或箱体。',forceSwap:'请拖动两个相邻棋子。'})[puzzle?.toolMode];
    const resolving=observation.tickIndex<puzzle?.settleUntilTick;
    const failed=status==='lost'&&collection.levels[index].baseScore&&validScore(puzzle?.score)?` 本局 0 星 · ${puzzle.score} 分`:'';
    $('message').textContent=status==='ready'&&saveStatus?saveStatus:status==='lost'?((deadboard?.recovered===false?'棋盘没有可用交换，无法重新排列，可以重试。':'本关未完成，可以重试。')+failed):
      status==='paused'?'已暂停。准备好后点击继续。':resolving?'正在结算连锁，请稍候。':toolHint??(deadboard?.recovered?`棋盘已重新排列，步数与得分保持。 ${saveStatus}`:collection.progressive?saveStatus:'不赶时间，走错也可以撤销。');
    $('next').hidden=true;
  }
  for(const [i,button]of [...$('levels').children].entries())button.disabled=!isUnlocked(i);
  lastFlow=status;
},100);
function renderProgress(){[...$('levels').children].forEach((button,i)=>{
  const best=recordAt(i)?.bestScore,{baseScore,par}=collection.levels[i];
  button.querySelector('small').textContent=baseScore&&validScore(best)?`${scoreStars('won',best,baseScore)} 星 · ${best} 分`:
    isCompleted(i)?(collection.progressive?'已完成 ✓':'已点亮 ✓'):isUnlocked(i)?`参考 ${par} 步`:'尚未解锁';
});}
window.render_game_to_text=()=>JSON.stringify({collection:collection?.id,level:index,loading,game:loading?undefined:api()?.getState()});
window.addEventListener('pagehide',()=>{flowObserver?.disconnect();clearInterval(poll);api()?.dispose();audio.dispose();});
try{
  if(staticDelivery)collection=await loadStaticCollection();
  else{
    const response=await fetch(`/api/collections/${encodeURIComponent(params.get('collection')??'lumen-depot')}`);
    if(!response.ok)throw Error(`关卡加载失败 HTTP ${response.status}`);
    collection=await response.json();
  }
  $('title').textContent=collection.title;$('subtitle').textContent=collection.subtitle;document.title=collection.title+' · A2Game';
  try{soundWanted=localStorage.getItem(soundKey())==='on';}catch{}
  sound.disabled=false;showSound();
  if(collection.progressive){
    document.querySelector('.eyebrow').textContent='A2GAME';
    document.querySelector('footer').textContent='完成当前关卡即可解锁下一关。';
    frame.title='当前关卡';
  }
  try{completed=readProgress();}catch{}
  collection.levels.forEach((level,i)=>{const button=document.createElement('button');button.append(document.createTextNode(`${i+1} · ${level.title}`),document.createElement('small'));button.onclick=()=>load(i);$('levels').append(button);});renderProgress();
  const firstIncomplete=collection.levels.findIndex((_,i)=>!isCompleted(i));
  await load(collection.progressive?(firstIncomplete<0?collection.levels.length-1:firstIncomplete):0);
}catch(error){showFailure(`${error.message}。请检查本地服务日志后重试。`);}
