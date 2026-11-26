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

export function projectPuzzleWaves(definition,observation,frame){
  const puzzle=observation.state.puzzle;
  if(!puzzle?.settleUntilTick||observation.tickIndex>=puzzle.settleUntilTick||frame.stage||
     !['playing','paused'].includes(observation.flow.status)||
     globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return frame;
  const plan=observation.events.findLast(event=>event.type==='puzzle.resolving');
  if(!plan)return frame;
  const config=definition.scenes[0]?.entities[0]?.components?.find(component=>component.config?.settleTicksPerWave)?.config;
  if(!config)return frame;
  const wave=1+Math.floor((observation.tickIndex-plan.tickIndex-1)/config.settleTicksPerWave);
  const effect=observation.events.find(event=>event.type==='puzzle.resolve-wave'&&
    event.tickIndex===plan.tickIndex&&event.payload.wave===wave);
  const cells=effect?.payload.cells??plan.payload.cells;
  const commands=[...frame.commands],actions=new Map(definition.inputs.actions.map(action=>[action.id,action]));
  for(const cell of cells.slice(0,24)){
    if(commands.length>=640)break;
    const binding=actions.get(config.selectActions[cell])?.bindings.find(item=>item.source==='touch.select')?.config;
    if(binding)commands.push({id:`puzzle-wave:${cell}`,kind:'circle',at:[binding.x,binding.y],radius:.17,fill:'#fff0b6'});
  }
  return {...frame,commands};
}
