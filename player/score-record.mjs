import {readPointer} from '../dist/utils.js';
import {sha256Canonical} from '../dist/exact-hash.js';

export function starThresholds(baseScore){
 return [baseScore,Math.ceil(1.5*baseScore),2*baseScore];
}

export function scoreStars(status,score,baseScore){
 if(status!=='won')return 0;
 const [,silver,gold]=starThresholds(baseScore);
 return score>=gold?3:score>=silver?2:1;
}

export function createScoreRecord(definition,getStorage=()=>globalThis.localStorage){
 const path=definition.extensions?.['x-a2game-score-session']?.scorePath;
 if(typeof path!=='string'||!path.startsWith('/')||path.length>256)return null;
 const key=`a2game.score.v1.${definition.id}.${sha256Canonical(definition)}`;
 const score=value=>Number.isSafeInteger(value)&&value>=0?value:0;
 let best=0,available=true,savedRun=false;
 const read=()=>{
  const raw=getStorage().getItem(key);
  if(raw===null)return 0;
  try{
   const record=JSON.parse(raw);
   return record?.version===1?score(record.best):0;
  }catch{return 0;}
 };
 try{best=read();}catch{available=false;}
 return {
  observe(observation){
   if(observation.flow.status==='playing')savedRun=false;
   if(observation.flow.status!=='lost'||savedRun)return {best,available,settlement:null};
   savedRun=true;
   let current;
   try{current=score(readPointer(observation.state,path));}catch{return {best,available,settlement:null};}
   let previousBest=best;
   try{
    const previous=read();
    previousBest=Math.max(previousBest,previous);
    best=Math.max(previousBest,current);
    if(best>previous)getStorage().setItem(key,JSON.stringify({version:1,best}));
    available=true;
   }catch{best=Math.max(previousBest,current);available=false;}
   return {best,available,settlement:{score:current,newBest:current>previousBest}};
  },
  label(){return `最高分 ${best}${available?'':'（本页）'}`;}
 };
}
