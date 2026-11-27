import {fail} from './errors.js';
import {isRecord,safeFinite,safeInteger,clone} from './utils.js';
import {viewportToWorld} from './geometry.js';
import {radialAxes} from './gamepad-input.js';
import type {GameDefinition,Json,JsonRecord,NormalizedAction,NormalizedRawInput,SessionSnapshot} from './types.js';
export const mobileInputIds=['touch.select','touch.raw','touch.double-tap','touch.long-press','touch.drag','touch.path','touch.pinch','touch.rotate','touch.multi-hold','imu.tilt','imu.shake','imu.orientation','imu.acceleration','imu.gyroscope','imu.calibration'].map(s=>'a2game.input.'+s);
export const mobileInputSources=Object.fromEntries(mobileInputIds.map(id=>[id.slice('a2game.input.'.length),id]));
const q=(n:number)=>Math.round(n*10000)/10000,clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const wrap=(n:number)=>q(((n+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
function error(why:string):never{return fail('A2G_E_INPUT_RAW',why);}
function vector(v:unknown):v is number[]{return Array.isArray(v)&&v.length===3&&v.every(n=>safeFinite(n)&&Math.abs(n)<=10000);}
interface Pointer {timeUs:number;tick:number;seq:number;u:number;v:number;x:number;y:number;distance:number;multi:boolean;claimed:boolean;points:Json[];stick?:string;stickAspect?:number;stickOrigin?:[number,number];stickPoint?:[number,number];}
/** Extended recognizer state is checkpointed in activePointers; legacy-only sessions retain old bytes. */
export function recognizeMobileInput(stage:SessionSnapshot,batch:readonly NormalizedRawInput[],definition:GameDefinition,chosen:(id:string)=>boolean):NormalizedAction[]{
 const out:NormalizedAction[]=[],cache=stage.activePointers,startUs=Math.ceil(stage.tickIndex*1000000/definition.world.clock.tickHz),endUs=Math.ceil((stage.tickIndex+1)*1000000/definition.world.clock.tickHz)-1;
 const bindings=definition.inputs.actions.flatMap(action=>action.bindings.filter(b=>chosen('a2game.input.'+b.source)).map(binding=>({action,binding,cfg:binding.config??{}})));
 const sticks=bindings.filter(row=>row.binding.source==='touch.drag'&&isRecord(row.cfg.stick));
 const releasedSticks=new Set<string>();
 const active=()=>Object.entries(cache).filter(([key])=>/^\d+$/.test(key)).map(([key,p])=>({key,p:p as unknown as Pointer}));
 let sampleAspect:number|undefined;
 const emit=(action:string,phase:NormalizedAction['phase'],value:Json|undefined,sourceId:string,timeUs=endUs)=>{out.push({action,phase,...(value!==undefined?{value}:{}),...(sampleAspect!==undefined?{viewportAspect:sampleAspect}:{}),sourceId,tickIndex:stage.tickIndex,timeUs,seq:out.length});};
 const pulse=(action:string,value:Json|undefined,source:string,timeUs?:number)=>{emit(action,'press',value,source,timeUs);emit(action,'release',undefined,source,timeUs);};
 const ordered=[...batch].sort((a,b)=>(a.timeUs??0)-(b.timeUs??0)||(a.seq??0)-(b.seq??0));
 for(const sample of ordered){
  const payload=sample.payload,time=clamp(sample.timeUs??startUs,startUs,endUs);
  sampleAspect=undefined;
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
    if(cfg.trackSample===true&&available.orientation===false){delete cache['~imu'];delete cache[key];continue;}
    if(binding.source==='imu.acceleration'&&available.linearAcceleration!==false)pulse(action.id,payload.linearAccelerationMps2.map(q),source,time);
    else if(binding.source==='imu.gyroscope'&&available.angularVelocity!==false)pulse(action.id,payload.angularVelocityRadps.map(q),source,time);
    else if(binding.source==='imu.shake'){
     if(available.linearAcceleration!==false&&Math.hypot(...payload.linearAccelerationMps2)>=Number(cfg.thresholdMps2??12)&&stage.tickIndex>=Number(previous.nextTick??0)){pulse(action.id,undefined,source,time);cache[key]={nextTick:stage.tickIndex+Number(cfg.cooldownTicks??30)};}
    }else if(neutral){
     const orientation=payload.orientationRad.map((value,i)=>wrap(value-neutral[i]!));
     if(binding.source==='imu.orientation'){if(cfg.trackSample===true)cache[key]={valid:true};pulse(action.id,orientation,source,time);}
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
  if(payload.viewportAspect!==undefined){if(!safeFinite(payload.viewportAspect)||payload.viewportAspect<0.1||payload.viewportAspect>10)error('Invalid viewport aspect');sampleAspect=payload.viewportAspect;}
  if(sample.kind==='down'){
   if(cache[id])error('Duplicate pointer down');if(active().length>=10)error('Pointer budget exceeded');
   cache[id]={timeUs:time,tick:stage.tickIndex,seq:sample.seq??0,u:q(payload.u),v:q(payload.v),x:q(payload.u),y:q(payload.v),distance:0,multi:false,claimed:false,points:[[q(payload.u),q(payload.v)]]} as unknown as JsonRecord;
  }
  const p=cache[id] as unknown as Pointer|undefined;if(!p)continue;
  if(sticks.length&&sample.kind==='down'&&sampleAspect!==undefined&&payload.u>=0&&payload.u<=1&&payload.v>=0&&payload.v<=1){
   const zone=payload.u<.5?'left':'right';
   const selected=sticks.find(({cfg})=>isRecord(cfg.stick)&&cfg.stick.zone===zone);
   if(selected&&!active().some(({p})=>p.stick===selected.action.id)){
    p.stick=selected.action.id;p.stickAspect=sampleAspect;p.stickOrigin=[payload.u,payload.v];p.claimed=true;
   }
  }
  if(p.stick&&(sample.kind==='up'||sample.kind==='cancel'||sampleAspect!==p.stickAspect)){
   releasedSticks.add(p.stick);delete p.stick;delete p.stickAspect;delete p.stickOrigin;delete p.stickPoint;
  }
  if(p.stick)p.stickPoint=[payload.u,payload.v];
  p.x=q(payload.u);p.y=q(payload.v);p.distance=Math.max(p.distance,Math.hypot(p.x-p.u,p.y-p.v));if(p.points.length<128)p.points.push([p.x,p.y]);
  const pointers=active();if(pointers.length>=2)for(const pointer of pointers)pointer.p.multi=true;
  for(const {action,binding,cfg} of bindings.filter(row=>row.binding.source==='touch.select')){
   const width=Number(cfg.sceneWidth),height=Number(cfg.sceneHeight),inside=(u:number,v:number)=>{const [x,y]=viewportToWorld(u,v,sampleAspect??width/height,width,height,[0,0]);return Math.abs(x/1000-Number(cfg.x))<=Number(cfg.hx)&&Math.abs(y/1000-Number(cfg.y))<=Number(cfg.hy);};
   if(!p.multi&&inside(p.x,p.y)&&(cfg.mode==='drag-select'?sample.kind==='down'||sample.kind==='up'&&!inside(p.u,p.v):sample.kind==='up'&&p.distance<=Number(cfg.maxDistanceNorm??0.04)))
    pulse(action.id,cfg.gestureMetadata===true?{startedTick:p.tick}:undefined,'select:'+id,time);
  }
  for(const {action,binding} of bindings.filter(row=>row.binding.source==='touch.raw'))pulse(action.id,{pointerId:payload.pointerId,u:p.x,v:p.y,kind:sample.kind,count:pointers.length},'raw:'+id,time);
  if(sample.kind==='move'&&pointers.length===1){
   for(const {action,binding,cfg} of bindings.filter(row=>['touch.drag','touch.path'].includes(row.binding.source)&&!isRecord(row.cfg.stick)))if(p.distance>=Number(cfg.minDistanceNorm??0.02)){
    p.claimed=true;pulse(action.id,binding.source==='touch.drag'?[p.x,p.y]:{pointerId:payload.pointerId,points:clone(p.points)},'drag:'+id,time);
   }
  }
  if(pointers.length===2){
   const pair=pointers.sort((a,b)=>Number(a.key)-Number(b.key)),a=pair[0]!,b=pair[1]!,dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),identity=pair.map(v=>v.key+'@'+v.p.tick+':'+v.p.seq).join(':');
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
 const previousAspect=sampleAspect;
 sampleAspect=undefined;
 for(const {action,cfg} of sticks){
  const owner=pointers.find(({p})=>p.stick===action.id)?.p;
  const source='touch-stick:'+action.id;
  if(!owner){if(releasedSticks.has(action.id))pulse(action.id,[0,0],source);continue;}
  const stick=cfg.stick as JsonRecord,aspect=owner.stickAspect!,short=Math.min(1,aspect);
  const [u0,v0]=owner.stickOrigin!,[u,v]=owner.stickPoint!;
  // Keep viewport precision until both components are in the same spatial metric.
  const x=(u-u0)*aspect/short/Number(stick.radius),y=(v0-v)/short/Number(stick.radius);
  pulse(action.id,radialAxes(x,y,Number(stick.deadZone??.12)),source);
 }
 sampleAspect=previousAspect;
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
 const types:Record<string,string>={'touch.select':'button','touch.raw':'pose','touch.double-tap':'button','touch.long-press':'button','touch.drag':'vec2','touch.path':'pose','touch.pinch':'axis1','touch.rotate':'axis1','touch.multi-hold':'button','imu.tilt':'vec2','imu.shake':'button','imu.orientation':'vec3','imu.acceleration':'vec3','imu.gyroscope':'vec3','imu.calibration':'button'};
 const stickZones=new Set(),stickActions=new Set();
 for(const action of def.inputs.actions)for(const binding of action.bindings){
  if(types[binding.source]&&action.valueType!==types[binding.source])fail('A2G_E_INPUT_ACTION',`Binding ${binding.source} requires ${types[binding.source]}`);
  if(binding.config?.stick!==undefined){
   const c=binding.config.stick;
   if(binding.source!=='touch.drag'||!isRecord(c)||!['left','right'].includes(String(c.zone))||
    !safeFinite(c.radius)||c.radius<.03||c.radius>.4||
    (c.deadZone!==undefined&&(!safeFinite(c.deadZone)||c.deadZone<0||c.deadZone>.9))||
    binding.config.minDistanceNorm!==undefined||stickZones.has(c.zone)||stickActions.has(action.id))
     fail('A2G_E_CAP_CONFIG','Touch stick requires a unique left/right zone and action, radius .03–.4, and optional dead zone 0–.9');
   stickZones.add(c.zone);stickActions.add(action.id);
  }
  if(binding.config?.trackSample!==undefined&&(!['imu.tilt','imu.orientation'].includes(binding.source)||typeof binding.config.trackSample!=='boolean'))fail('A2G_E_CAP_CONFIG','trackSample requires an IMU tilt/orientation boolean');
 }
}
