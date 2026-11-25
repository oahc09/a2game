import {readPointer,sha256Canonical} from '../dist/index.js';

const validScore=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000;
/** A browser-local record only. Never a replay, competitive score, or provider assertion. */
export function createSurvivalScore(definition,{storage=()=>globalThis.localStorage}={}){
 const profiles=definition.scenes.flatMap(scene=>scene.entities.flatMap(entity=>(entity.components??[])
  .filter(c=>c.capability.id==='a2game.realtime.world'&&c.config.survival)));
 if(profiles.length!==1)return null;
 const {statePath}=profiles[0].config;
 const initial=Object.fromEntries(Object.entries(definition.state).map(([key,field])=>[key,field.initial]));
 const pilot=readPointer(initial,statePath)?.bodies?.find(b=>b.kind==='actor')?.id;
 if(!pilot)return null;
 const key='a2game.score.v1:'+sha256Canonical(definition);
 const read=()=>{
  try{
   const backend=storage(),text=backend?.getItem(key);
   if(typeof text!=='string')return {value:0,available:Boolean(backend)};
   const value=/^(0|[1-9][0-9]{0,8})$/.test(text)?Number(text):0;
   return {value:validScore(value)?value:0,available:true};
  }catch{return {value:0,available:false};}
 };
 const saved=read();
 let best=saved.value,available=saved.available,handled=false,settlement=null;
 const summary=()=>({best,available,settlement:settlement?{...settlement}:null});
 return Object.freeze({
  update(observation){
   if(observation.flow.status==='playing'){
    handled=false;settlement=null;
   }else if(observation.flow.status==='lost'&&!handled){
    handled=true;
    const tick=observation.tickIndex-1,world=readPointer(observation.state,statePath);
    const died=observation.events.some(e=>e.tickIndex===tick&&e.channel==='module'&&e.type==='combat.death'&&e.payload.id===pilot);
    if(died&&world?.lost===true&&world.health===0&&Array.isArray(world.bodies)&&!world.bodies.some(b=>b.id===pilot)&&validScore(world.score)){
     const latest=read();best=Math.max(best,latest.value);available=latest.available;
     const newBest=world.score>best;
     best=Math.max(best,world.score);
     if(available&&best>latest.value){
      try{storage().setItem(key,String(best));}catch{available=false;}
     }
     settlement={score:world.score,newBest};
    }
   }
   return summary();
  },
  summary
 });
}
