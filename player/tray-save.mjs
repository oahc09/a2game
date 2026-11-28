import {HeadlessRuntime,capabilityManifestDigest,readPointer,replayNormalizedInputTrace,sha256Canonical} from '../dist/index.js';

const maximumTransactions=512;
const snapshotDigest=(runtime,path)=>{
 const state=readPointer(runtime.observe().state,path);
 delete state.tilePress;
 delete state.settleUntilTick;
 if(state.toolRemaining){state.selected=[];state.toolMode='';}
 return sha256Canonical({state,rng:runtime.snapshot().rng});
};

export function createPuzzleSave(definition,registry,getStorage=()=>globalThis.localStorage){
 const component=definition.scenes[0]?.entities[0]?.components?.[0];
 if(component?.config.journalActions!==true)return null;
 const tray=component.capability.id==='a2game.puzzle.tray';
 if(!tray&&component.capability.id!=='a2game.puzzle.swap')return null;
 const config=component.config,{statePath,tilePointer,trayTools,selectActions,matchTools,settleTicksPerWave}=config;
 const stride=1+16*(settleTicksPerWave??0);
 const allowedActions=tray?[config.undoAction,trayTools.moveOutAction,trayTools.shuffleAction,...trayTools.returnActions].filter(Boolean):[];
 const gameSha256=sha256Canonical(definition),manifestDigest=capabilityManifestDigest(registry.list());
 const prefix=`a2game.${tray?'tray':'swap'}-save.v1.${definition.id}.`;
 const key=prefix+gameSha256, startedKey=key+'.started';
 const tickHz=definition.world.clock.tickHz;
 let journal=[],seen=new Set(),status='',writeLocked=false,needsRestart=false;
 function trace(entries){
  const events=entries.flatMap((entry,index)=>{
   const tickIndex=index*stride;
   if(!entry||typeof entry!=='object'||Object.keys(entry).length!==1)throw Error('Invalid saved transaction');
   const clock={tickIndex,timeUs:Math.ceil(tickIndex*1000000/tickHz)};
   if(!tray){
    let cells=entry.swap,actions=[];
    if(Array.isArray(entry.tool)){
     const [kind,...targets]=entry.tool;
     if(!matchTools||!['hammer','forceSwap','shuffle'].includes(kind))throw Error('Unknown saved match tool');
     cells=targets;actions=[matchTools[kind]];
     if(cells.length!==({hammer:1,forceSwap:2,shuffle:0})[kind])throw Error('Invalid saved tool targets');
    }else if(!Array.isArray(cells)||cells.length!==2)throw Error('Invalid saved swap');
    if((cells.length===2&&cells[0]===cells[1])||
       cells.some(cell=>!Number.isSafeInteger(cell)||cell<0||cell>=selectActions.length))throw Error('Invalid saved swap');
    actions.push(...cells.map(cell=>selectActions[cell]));
    return actions.flatMap((action,i)=>['press','release'].map((phase,j)=>({...clock,seq:i*2+j,source:'action',kind:'input',payload:{action,phase}})));
   }
   if(Number.isSafeInteger(entry.card)&&entry.card>=0&&entry.card<tilePointer.centers.length){
    const [width,height]=tilePointer.scene;
    const [x,y]=tilePointer.centers[entry.card];
    return ['down','up'].map((kind,seq)=>({...clock,seq,source:'pointer',kind,payload:{pointerId:0,u:.5+x/width,v:.5-y/height,viewportAspect:width/height}}));
   }
   if(!allowedActions.includes(entry.action))throw Error('Unknown saved action');
   return ['press','release'].map((phase,seq)=>({...clock,seq,source:'action',kind:'input',payload:{action:entry.action,phase}}));
  });
  return {format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:definition.id,gameRevision:definition.revision,tickHz,seed:definition.world.clock.seed,coordinateProfile:'viewport-top-left-v1',inputNormalizerVersion:'0.1.0'},events};
 }
 function restore(){
  let runtime;
  try{
   const storage=getStorage(),text=storage.getItem(key);
   if(text===null){
    if(storage.getItem(startedKey)===null){
     for(let i=0;i<storage.length;i++){
      const previous=storage.key(i);
      if(previous?.startsWith(prefix)&&/^[0-9a-f]{64}$/.test(previous.slice(prefix.length))&&previous!==key){
       needsRestart=true;
       status='此关已更新，旧版局中存档与当前版本不兼容。旧记录已保留，请重新开始。';
       break;
      }
     }
    }
    return null;
   }
   if(text.length>131072)throw Error('Oversized save');
   const saved=JSON.parse(text);
   if(saved?.version!==1||saved.gameSha256!==gameSha256||saved.manifestDigest!==manifestDigest||
      !Array.isArray(saved.journal)||!saved.journal.length||saved.journal.length>maximumTransactions||
      (saved.journal.length-1)*stride>100000)throw Error('Incompatible save');
   runtime=new HeadlessRuntime(definition,registry);
   replayNormalizedInputTrace(runtime,trace(saved.journal));
   if(runtime.status!=='playing'||snapshotDigest(runtime,statePath)!==saved.stateSha256)throw Error('Save result differs');
   if(settleTicksPerWave){
    const wait=readPointer(runtime.observe().state,statePath).settleUntilTick-runtime.tickIndex;
    if(wait>0)runtime.step(wait);
   }
   journal=saved.journal;
   seen=new Set(runtime.observe().events.map(event=>event.eventId));
   status=tray?'已恢复上次牌局。':'已恢复上次棋局。';
   return runtime;
  }catch{
   runtime?.dispose();writeLocked=true;
   status='局中存档无法读取或验证。旧记录保留，点击重试可开始新局。';
   return null;
  }
 }
 return {
  restore,
  status:()=>status,
  needsRestart:()=>needsRestart,
  reset(){
   journal=[];seen.clear();writeLocked=false;status='';
   const acknowledgeUpdate=needsRestart;needsRestart=false;
   try{
    const storage=getStorage();
    storage.removeItem(key);
    if(acknowledgeUpdate)storage.setItem(startedKey,'1');
   }catch{status='浏览器存储不可用。';}
  },
  observe(runtime,observation){
   if(writeLocked)return;
   const newEntries=[];
   for(const event of observation.events){
    if(!event.payload?.transaction||!['puzzle.changed','puzzle.undone'].includes(event.type)||seen.has(event.eventId))continue;
    seen.add(event.eventId);newEntries.push(event.payload.transaction);
   }
   if(!newEntries.length)return;
   journal.push(...newEntries);
   if(journal.length>maximumTransactions){writeLocked=true;status='局中存档已达到事务上限。';return;}
   try{
    if(observation.flow.status==='playing'){
     getStorage().setItem(key,JSON.stringify({version:1,gameSha256,manifestDigest,journal,stateSha256:snapshotDigest(runtime,statePath)}));
     status='局中进度已保存。';
    }else if(['won','lost'].includes(observation.flow.status)){
     getStorage().removeItem(key);status='';
    }
   }catch{status='局中进度未保存，浏览器存储不可用。';}
  }
 };
}
