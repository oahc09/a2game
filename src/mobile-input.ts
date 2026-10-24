import {fail} from './errors.js';
import {isRecord,safeFinite,safeInteger,clone} from './utils.js';
import type {GameDefinition,Json,JsonRecord,NormalizedAction,NormalizedRawInput,SessionSnapshot} from './types.js';
export const mobileInputIds=['touch.raw','touch.double-tap','touch.long-press','touch.drag','touch.path','touch.pinch','touch.rotate','touch.multi-hold','imu.tilt','imu.shake','imu.orientation','imu.acceleration','imu.gyroscope','imu.calibration'].map(s=>'a2game.input.'+s);
export const mobileInputSources=Object.fromEntries(mobileInputIds.map(id=>[id.slice('a2game.input.'.length),id]));
const q=(n:number)=>Math.round(n*10000)/10000,clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const wrap=(n:number)=>q(((n+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
function error(why:string):never{return fail('A2G_E_INPUT_RAW',why);}
function vector(v:unknown):v is number[]{return Array.isArray(v)&&v.length===3&&v.every(n=>safeFinite(n)&&Math.abs(n)<=10000);}
interface Pointer {timeUs:number;tick:number;u:number;v:number;x:number;y:number;distance:number;multi:boolean;claimed:boolean;points:Json[];}
/** Extended recognizer state is checkpointed in activePointers; legacy-only sessions retain old bytes. */
export function recognizeMobileInput(stage:SessionSnapshot,batch:readonly NormalizedRawInput[],definition:GameDefinition,chosen:(id:string)=>boolean):NormalizedAction[]{
 const out:NormalizedAction[]=[],cache=stage.activePointers,startUs=Math.ceil(stage.tickIndex*1000000/definition.world.clock.tickHz),endUs=Math.ceil((stage.tickIndex+1)*1000000/definition.world.clock.tickHz)-1;
 const bindings=definition.inputs.actions.flatMap(action=>action.bindings.filter(b=>chosen('a2game.input.'+b.source)).map(binding=>({action,binding,cfg:binding.config??{}})));
 const active=()=>Object.entries(cache).filter(([key])=>/^\d+$/.test(key)).map(([key,p])=>({key,p:p as unknown as Pointer}));
 const emit=(action:string,phase:NormalizedAction['phase'],value:Json|undefined,sourceId:string,timeUs=endUs)=>{out.push({action,phase,...(value!==undefined?{value}:{}),sourceId,tickIndex:stage.tickIndex,timeUs,seq:out.length});};
 const pulse=(action:string,value:Json|undefined,source:string,timeUs?:number)=>{emit(action,'press',value,source,timeUs);emit(action,'release',undefined,source,timeUs);};
 const ordered=[...batch].sort((a,b)=>(a.timeUs??0)-(b.timeUs??0)||(a.seq??0)-(b.seq??0));
 for(const sample of ordered){
  const payload=sample.payload,time=clamp(sample.timeUs??startUs,startUs,endUs);
  if(sample.source==='imu'){
   if(sample.kind==='reset'){for(const key of Object.keys(cache))if(key.startsWith('~imu'))delete cache[key];continue;}
   if(!['sample','calibrate'].includes(sample.kind)||typeof payload.reference!=='string'||!vector(payload.angularVelocityRadps)||!vector(payload.linearAccelerationMps2))error('Malformed normalized IMU sample');
   if(!vector(payload.orientationRad)){if(sample.kind==='calibrate')error('Calibration requires orientation');continue;}
   const angle=Number(payload.screenAngle??0);if(![0,90,180,270].includes(angle))error('Invalid screen reference angle');
   if(sample.kind==='calibrate'){cache['~imu']={neutral:payload.orientationRad.map(q),reference:payload.reference,angle};for(const key of Object.keys(cache))if(key.startsWith('~imu:'))delete cache[key];for(const {action,binding} of bindings)if(binding.source==='imu.calibration')pulse(action.id,undefined,'imu:calibration',time);continue;}
   const calibration=cache['~imu'];if(calibration&&(calibration.reference!==payload.reference||calibration.angle!==angle)){for(const key of Object.keys(cache))if(key.startsWith('~imu'))delete cache[key];continue;}
   for(const {action,binding,cfg} of bindings.filter(row=>row.binding.source.startsWith('imu.'))){
    const source='imu:'+action.id,key='~imu:'+action.id,previous=cache[key]??{},neutral=calibration?.neutral as number[]|undefined;
    const available=isRecord(payload.available)?payload.available:{};
    if(binding.source==='imu.acceleration'&&available.linearAcceleration!==false)pulse(action.id,payload.linearAccelerationMps2.map(q),source,time);
    else if(binding.source==='imu.gyroscope'&&available.angularVelocity!==false)pulse(action.id,payload.angularVelocityRadps.map(q),source,time);
    else if(binding.source==='imu.shake'){
     if(available.linearAcceleration!==false&&Math.hypot(...payload.linearAccelerationMps2)>=Number(cfg.thresholdMps2??12)&&stage.tickIndex>=Number(previous.nextTick??0)){pulse(action.id,undefined,source,time);cache[key]={nextTick:stage.tickIndex+Number(cfg.cooldownTicks??30)};}
    }else if(neutral){
     const orientation=payload.orientationRad.map((value,i)=>wrap(value-neutral[i]!));
     if(binding.source==='imu.orientation')pulse(action.id,orientation,source,time);
     if(binding.source==='imu.tilt'){
      const range=Number(cfg.rangeRad??0.7),rawX=orientation[2]!/range,rawY=orientation[1]!/range;
      const [x,y]=angle===90?[-rawY,rawX]:angle===180?[-rawX,-rawY]:angle===270?[rawY,-rawX]:[rawX,rawY];
      const percent=Number(cfg.smoothingPercent??25)/100,last=Array.isArray(previous.filtered)?previous.filtered as number[]:[0,0],dead=Number(cfg.deadZone??0.05);
      const filtered=[x,y].map((v,i)=>q(clamp(last[i]!+(v-last[i]!)*percent,-1,1)));cache[key]={filtered};
      pulse(action.id,filtered.map(v=>Math.abs(v)<dead?0:v),source,time);
     }
    }
   }
   continue;
  }
  if(sample.source!=='pointer')continue;
  const id=String(payload.pointerId);if(!safeInteger(payload.pointerId)||payload.pointerId<0||!safeFinite(payload.u)||!safeFinite(payload.v)||Math.abs(payload.u)>4||Math.abs(payload.v)>4||!['down','move','up','cancel'].includes(sample.kind))error('Malformed normalized pointer');
  if(sample.kind==='down'){
   if(cache[id])error('Duplicate pointer down');if(active().length>=10)error('Pointer budget exceeded');
   cache[id]={timeUs:time,tick:stage.tickIndex,u:q(payload.u),v:q(payload.v),x:q(payload.u),y:q(payload.v),distance:0,multi:false,claimed:false,points:[[q(payload.u),q(payload.v)]]} as unknown as JsonRecord;
  }
  const p=cache[id] as unknown as Pointer|undefined;if(!p)continue;
  p.x=q(payload.u);p.y=q(payload.v);p.distance=Math.max(p.distance,Math.hypot(p.x-p.u,p.y-p.v));if(p.points.length<128)p.points.push([p.x,p.y]);
  const pointers=active();if(pointers.length>=2)for(const pointer of pointers)pointer.p.multi=true;
  for(const {action,binding} of bindings.filter(row=>row.binding.source==='touch.raw'))pulse(action.id,{pointerId:payload.pointerId,u:p.x,v:p.y,kind:sample.kind,count:pointers.length},'raw:'+id,time);
  if(sample.kind==='move'&&pointers.length===1){
   for(const {action,binding,cfg} of bindings.filter(row=>['touch.drag','touch.path'].includes(row.binding.source)))if(p.distance>=Number(cfg.minDistanceNorm??0.02)){
    p.claimed=true;pulse(action.id,binding.source==='touch.drag'?[p.x,p.y]:{pointerId:payload.pointerId,points:clone(p.points)},'drag:'+id,time);
   }
  }
  if(pointers.length===2){
   const pair=pointers.sort((a,b)=>Number(a.key)-Number(b.key)),a=pair[0]!,b=pair[1]!,dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),identity=pair.map(v=>v.key).join(':');
   const baseline=cache['~pair'];if(!baseline||baseline.identity!==identity)cache['~pair']={identity,distance:q(distance),angle:q(angle)};
   else if(sample.kind==='move')for(const {action,binding,cfg} of bindings.filter(row=>['touch.pinch','touch.rotate'].includes(row.binding.source)))if(Number(baseline.distance)>=Number(cfg.minDistanceNorm??0.02))pulse(action.id,binding.source==='touch.pinch'?q(clamp(distance/Number(baseline.distance),0.125,8)):wrap(angle-Number(baseline.angle)),'pair:'+identity,time);
  }
  if(sample.kind==='up'||sample.kind==='cancel'){
   if(sample.kind==='up'&&!p.multi&&!p.claimed)for(const {action,cfg} of bindings.filter(row=>row.binding.source==='touch.long-press'))if(p.distance<=Number(cfg.maxDistanceNorm??0.04)&&stage.tickIndex-p.tick>=Number(cfg.minTicks??30)){emit(action.id,'press',undefined,'hold:'+id,time);p.claimed=true;}
   if(sample.kind==='up'&&!p.multi&&!p.claimed){
    const durationUs=(stage.tickIndex-p.tick)*1000000/definition.world.clock.tickHz;
    const doubles=bindings.filter(row=>row.binding.source==='touch.double-tap');
    for(const {action,cfg} of doubles)if(p.distance<=Number(cfg.maxDistanceNorm??0.04)){
     const key='~tap:'+action.id,last=cache[key];if(last&&stage.tickIndex-Number(last.tick)<=Number(cfg.maxGapTicks??20)&&Math.hypot(p.x-Number(last.u),p.y-Number(last.v))<=Number(cfg.maxDistanceNorm??0.04)){pulse(action.id,undefined,'double:'+id,time);delete cache[key];}else cache[key]={tick:stage.tickIndex,u:p.x,v:p.y};
    }
    for(const {action,binding,cfg} of bindings){
     if(binding.source==='touch.tap'&&!doubles.length&&p.distance<=Number(cfg.maxDistanceNorm??0.04)&&durationUs<=Number(cfg.maxDurationUs??350000))pulse(action.id,undefined,'tap:'+id,time);
     if(binding.source==='touch.swipe'){
      const dx=p.x-p.u,dy=p.y-p.v,direction=Math.abs(dx)>=Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';
      if(direction===cfg.direction&&Math.hypot(dx,dy)>=Number(cfg.minDistanceNorm??0.12)&&durationUs<=Number(cfg.maxDurationUs??1500000))pulse(action.id,undefined,'swipe:'+id,time);
     }
    }
   }
   for(const {action,binding} of bindings.filter(row=>row.binding.source==='touch.long-press'))emit(action.id,sample.kind==='up'?'release':'cancel',undefined,'hold:'+id,time);
   delete cache[id];delete cache['~pair'];
  }
 }
 const pointers=active();
 for(const {action,binding,cfg} of bindings){
  if(binding.source==='touch.long-press')for(const {key,p} of pointers){const source='hold:'+key;if(!p.multi&&p.distance<=Number(cfg.maxDistanceNorm??0.04)&&stage.tickIndex-p.tick>=Number(cfg.minTicks??30)){p.claimed=true;emit(action.id,stage.pressedSources[action.id]?.includes(source)?'hold':'press',undefined,source);}else if(stage.pressedSources[action.id]?.includes(source))emit(action.id,'cancel',undefined,source);}
  if(binding.source==='touch.multi-hold'){
   const key='~multi:'+action.id,source='multi:'+action.id,count=Number(cfg.fingers??2),valid=pointers.length===count&&pointers.every(({p})=>p.distance<=Number(cfg.maxDistanceNorm??0.08));
   if(!valid){if(stage.pressedSources[action.id]?.includes(source))emit(action.id,'cancel',undefined,source);delete cache[key];}
   else {cache[key]??={tick:stage.tickIndex};if(stage.tickIndex-Number(cache[key]!.tick)>=Number(cfg.minTicks??15))emit(action.id,stage.pressedSources[action.id]?.includes(source)?'hold':'press',undefined,source);}
  }
  if(binding.source==='touch.double-tap'){const key='~tap:'+action.id;if(cache[key]&&stage.tickIndex-Number(cache[key]!.tick)>Number(cfg.maxGapTicks??20))delete cache[key];}
 }
 return out;
}
export function validateMobileBindings(def:GameDefinition):void{
 const types:Record<string,string>={'touch.raw':'pose','touch.double-tap':'button','touch.long-press':'button','touch.drag':'vec2','touch.path':'pose','touch.pinch':'axis1','touch.rotate':'axis1','touch.multi-hold':'button','imu.tilt':'vec2','imu.shake':'button','imu.orientation':'vec3','imu.acceleration':'vec3','imu.gyroscope':'vec3','imu.calibration':'button'};
 for(const action of def.inputs.actions)for(const binding of action.bindings)if(types[binding.source]&&action.valueType!==types[binding.source])fail('A2G_E_INPUT_ACTION',`Binding ${binding.source} requires ${types[binding.source]}`);
}
