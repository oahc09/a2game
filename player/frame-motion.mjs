/** Optional host-only easing. Never changes Runtime state or the target frame. */
export function createFrameMotion({duration=130,reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}){
  let previous=new Map();
  return {
    reset(){previous.clear();},
    project(frame,now=performance.now()){
      if(reducedMotion()||frame.stage){previous.clear();return frame;}
      const next=new Map();
      const commands=frame.commands.map(command=>{
        const old=previous.get(command.id);
        let entry=old;
        const point=e=>{const t=Math.min(1,Math.max(0,(now-e.start)/duration)),ease=1-(1-t)**3;return e.to.map((v,i)=>e.from[i]+(v-e.from[i])*ease);};
        if(!old)entry={from:command.at,to:command.at,start:now};
        else if(command.at.some((v,i)=>v!==old.to[i]))entry={from:point(old),to:command.at,start:now};
        next.set(command.id,entry);return {...command,at:point(entry)};
      });
      previous=next;return {...frame,commands};
    }
  };
}
