/** SDK-owned audio nodes, decoded only from the verified session resources. Playback requires a gesture. */
export async function createStageAudio(backend,sdk,parent,resources,cues=[]){
  const entries=new Map(),consumed=new Set();let listener,bank,disposed=false,unlocked=false,played=0,started=0,lastTick=-1;
  try{
    if(cues.length&&backend==='three'){listener=new sdk.AudioListener();parent.add(listener);}
    if(cues.length&&backend==='air')bank=new sdk.AssetBank();
    for(const cue of cues){
      const item=resources.get(cue.asset);
      if(backend==='three'){
        const source=new sdk.Audio(listener);source.setBuffer(await listener.context.decodeAudioData(item.bytes.slice(0)));source.setVolume(cue.volume);parent.add(source);entries.set(cue.id,{source});
      }else{
        const clip=await bank.load(item.url,{ext:'wav'}),node=new sdk.Node(`Audio/${cue.id}`);node.active=false;parent.addChild(node);
        const source=node.addComponent(sdk.AudioSource);source.playOnAwake=false;source.clip=clip;source.volume=cue.volume;node.on(sdk.AudioSource.EventType.STARTED,()=>started++);node.active=true;entries.set(cue.id,{source,node});
      }
    }
  }catch(error){for(const {source,node} of entries.values()){source.stop();node?.destroy();}bank?.releaseAll();throw error;}
  return {
    unlock(){if(disposed)return;unlocked=true;if(listener)void listener.context.resume().catch(()=>{unlocked=false;});},
    draw(frame){if(disposed||frame.tickIndex===lastTick)return;if(frame.tickIndex<lastTick)consumed.clear();lastTick=frame.tickIndex;
      const seen=new Set();for(const cue of frame.audio){if(consumed.has(cue.key))continue;consumed.add(cue.key);if(!unlocked||seen.has(cue.id))continue;seen.add(cue.id);const source=entries.get(cue.id)?.source;if(!source)continue;if(backend==='three'&&source.isPlaying)source.stop();source.play();played++;}
    },
    pause(){for(const {source} of entries.values())source.pause();},
    diagnostics(){return {ownedSources:entries.size,consumedEvents:consumed.size,unlocked,played,started,disposed,nativeContext:listener?{state:listener.context.state,time:listener.context.currentTime}:undefined};},
    dispose(){if(disposed)return;disposed=true;for(const {source,node} of entries.values()){
      source.stop();if(backend==='three'){source.disconnect();source.removeFromParent();}else{source.clip=null;node.destroy();}
    }entries.clear();consumed.clear();bank?.releaseAll();if(listener){listener.gain.disconnect();listener.removeFromParent();}}
  };
}
