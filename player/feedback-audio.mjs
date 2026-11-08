/** Optional host UI feedback. Fixed presets, gesture-gated, bounded and disposable. */
export const feedbackPresets=Object.freeze({
  move:Object.freeze([390]),push:Object.freeze([300,440]),undo:Object.freeze([260]),
  retry:Object.freeze([330]),success:Object.freeze([440,550,660]),
  merge:Object.freeze([330,495,660]),hit:Object.freeze([160]),error:Object.freeze([140,110])
});

export function createFeedbackAudio({contextFactory=()=>new AudioContext(),maxVoices=8}={}){
  if(!Number.isInteger(maxVoices)||maxVoices<1||maxVoices>16)throw Error('Invalid voice budget');
  let context,enabled=false,disposed=false,unavailable=false;
  const voices=new Set();
  const stop=()=>{for(const voice of voices){try{voice.oscillator.stop();}catch{}voice.oscillator.disconnect();voice.gain.disconnect();}voices.clear();};
  return {
    async enable(value){
      if(disposed)return false;
      enabled=Boolean(value);if(!enabled){stop();return false;}
      try{context??=contextFactory();await context.resume();if(disposed||!enabled)return false;return true;}
      catch{enabled=false;unavailable=true;return false;}
    },
    play(name){
      if(!enabled||disposed||!context||context.state!=='running')return false;
      const preset=feedbackPresets[name];if(!preset)return false;
      try{
        for(const [index,frequency]of preset.entries()){
          if(voices.size>=maxVoices)break;
          const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.07;
          const voice={oscillator,gain};voices.add(voice);
          oscillator.type='sine';oscillator.frequency.value=frequency;
          gain.gain.setValueAtTime(.045,start);gain.gain.exponentialRampToValueAtTime(.001,start+.12);
          oscillator.connect(gain);gain.connect(context.destination);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();voices.delete(voice);};
          oscillator.start(start);oscillator.stop(start+.13);
        }
        return true;
      }catch{stop();enabled=false;unavailable=true;return false;}
    },
    diagnostics:()=>({enabled,disposed,unavailable,voices:voices.size,contextState:context?.state??'not-created'}),
    silence(){stop();},
    async dispose(){if(disposed)return;disposed=true;enabled=false;stop();if(context&&context.state!=='closed')await context.close();}
  };
}
