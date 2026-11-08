import {readPointer} from '../dist/index.js';

/** Opt-in host decorations of existing events. No GameSpec extension or state writes. */
export function createEventFeedback({onSound=()=>{},maxEffects=12,reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}){
  if(!Number.isInteger(maxEffects)||maxEffects<1||maxEffects>24)throw Error('Invalid feedback budget');
  let positions=new Map(),effects=[],seen=new Set(),serial=0,lastTick=-1;
  const reset=()=>{positions.clear();effects=[];seen.clear();lastTick=-1;};
  return {
    reset,
    capture(definition,observation,{visual=true,now=performance.now()}={}){
      if(observation.tickIndex<lastTick)reset();lastTick=observation.tickIndex;
      const layer=definition.presentation?.scene2d?.bodyLayer;
      const bodies=layer?readPointer(observation.state,layer.statePath):[];
      const current=new Map();
      if(Array.isArray(bodies))for(const body of bodies.slice(0,256)){
        if(typeof body?.id==='string'&&Number.isFinite(body.x)&&Number.isFinite(body.y))current.set(body.id,[layer.origin[0]+body.x/1000,layer.origin[1]+body.y/1000]);
      }
      for(const event of observation.events.slice(-256)){
        if(seen.has(event.eventId))continue;seen.add(event.eventId);
        const hit=event.type==='combat.hit'||event.type==='defense.fired',death=event.type==='combat.death'||event.type==='defense.reward',merge=event.type==='defense.merged';
        const name=hit?'hit':death?'success':merge?'merge':event.type==='grid.box-pushed'?'push':event.type==='puzzle.undone'?'undo':event.type==='strategy.changed'&&event.payload.kind==='merge'?'merge':null;
        if(!name)continue;onSound(name);
        const id=event.type==='defense.fired'?event.payload.target:merge?event.payload.replacement:event.payload.id;
        const at=current.get(id)??positions.get(id),from=event.type==='defense.fired'?(current.get(event.payload.owner)??positions.get(event.payload.owner)):undefined;
        if(!visual||!at||reducedMotion()||(!hit&&!death&&!merge))continue;
        if(effects.length>=maxEffects)effects.shift();
        effects.push({id:++serial,at:[...at],from:from?[...from]:undefined,start:now,death,merge});
      }
      if(seen.size>512)seen=new Set([...seen].slice(-256));
      positions=current;
    },
    project(frame,now=performance.now()){
      effects=effects.filter(effect=>now-effect.start<320);
      if(reducedMotion()||frame.stage||!effects.length)return frame;
      const commands=[...frame.commands];
      for(const effect of effects){
        const age=Math.max(0,(now-effect.start)/320),count=effect.death?8:4;
        if(effect.from&&age<.5)for(let i=1;i<7&&commands.length<640;i++)commands.push({id:`host-shot:${effect.id}:${i}`,kind:'circle',at:effect.from.map((n,axis)=>n+(effect.at[axis]-n)*i/7),radius:.025,fill:'#ffe0a0'});
        for(let i=0;i<count&&commands.length<640;i++){
          const angle=i*Math.PI*2/count,distance=(effect.death ? .12 : .06)+age*(effect.death ? .45 : .22);
          commands.push({id:`host-fx:${effect.id}:${i}`,kind:'circle',at:[effect.at[0]+Math.cos(angle)*distance,effect.at[1]+Math.sin(angle)*distance],radius:(effect.death ? .075 : .055)*(1-age),fill:effect.merge?'#8af2cd':effect.death?'#ffe0a0':'#fff8d5'});
        }
      }
      return {...frame,commands};
    },
    diagnostics:()=>({effects:effects.length,positions:positions.size,seen:seen.size}),
    dispose:reset
  };
}
