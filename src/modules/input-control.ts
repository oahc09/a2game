import {segmentAabb,viewportToWorld,moveClipped} from '../geometry.js';
import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeFinite,safeInteger} from '../utils.js';
import {validateIntegerWorld} from './realtime.js';
import type {WorldBody} from './realtime.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
const quantize=(n:number)=>Math.round(n*10000)/10000,clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function wrapAngle(n:number):number{return quantize(((n+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);}
function error(message:string):never{return fail('A2G_E_CAP_CONFIG',message);}
export {segmentAabb,viewportToWorld,moveClipped} from '../geometry.js';
export function initialControlState():JsonRecord{return {angle:0,scale:1,axis:[0,0],aim:[1,0],power:0,score:0,won:false,lost:false,cutIds:[],spawned:0,grabbing:false,grab:[0.5,0.5],target:[0,0],hasTarget:false,rotateSource:'',pinchSource:'',angleBase:0,scaleBase:1,balanceTicks:0,fireRequest:false,usedInput:false,laneSignal:0};}
export const controlServiceIds=['intersection','rotate','collision','balance'].map(name=>'a2game.realtime.'+name);
function checkState(s:JsonRecord):void{
 if(!safeFinite(s.angle)||Math.abs(s.angle)>10000||!safeFinite(s.scale)||s.scale<0.125||s.scale>8||!safeFinite(s.power)||s.power<0||s.power>1||!safeInteger(s.score)||s.score<0||s.score>100000000||!safeInteger(s.spawned)||s.spawned<0||s.spawned>1000000||!safeInteger(s.balanceTicks)||s.balanceTicks<0||!Array.isArray(s.cutIds)||s.cutIds.length>128||s.cutIds.some(id=>typeof id!=='string')||![s.won,s.lost,s.grabbing,s.hasTarget,s.fireRequest].every(value=>typeof value==='boolean'))error('Invalid control state');
 for(const key of ['axisSource','aimSource'])if(s[key]!==undefined&&(typeof s[key]!=='string'||String(s[key]).length>256))error('Invalid input source provenance');
 for(const key of ['axis','aim','grab','target']){const value=s[key];if(!Array.isArray(value)||value.length!==2||!value.every(safeFinite))error('Invalid control vector');}
}
export function simulateInputControl(ctx:ModuleContext):ModuleResult{
 const c=ctx.config,raw=readPointer(ctx.world.state,String(c.statePath));if(!isRecord(raw))error('Missing controller state');const s=clone(raw) as JsonRecord;checkState(s);
 const w=clone(validateIntegerWorld(readPointer(ctx.world.state,String(c.worldPath)),c)),events:NonNullable<ModuleResult['events']>=[],body=w.bodies.find(body=>body.id===c.bodyId),normalized=ctx.normalizedInputs??{};
 const sceneWidth=Number(c.sceneWidth??Number(c.width)/1000),sceneHeight=Number(c.sceneHeight??Number(c.height)/1000),origin=Array.isArray(c.origin)?c.origin as number[]:[-Number(c.width)/2000,-Number(c.height)/2000];let aspect=sceneWidth/sceneHeight;
 const point=(value:Json):[number,number]=>{if(!Array.isArray(value)||value.length!==2||!value.every(safeFinite))error('Expected normalized pointer point');return viewportToWorld(value[0] as number,value[1] as number,aspect,sceneWidth,sceneHeight,origin);};
 if(c.clearLostImu!==undefined&&typeof c.clearLostImu!=='boolean')error('Invalid IMU loss policy');
 let dragReceived=false;
 for(const input of ctx.inputs){
  if(input.type!=='input.action'||input.edge!=='press')continue;const value=input.payload.value,source=input.sourceId??String(input.payload.sourceId??'');
  aspect=typeof input.payload.viewportAspect==='number'?input.payload.viewportAspect:sceneWidth/sceneHeight;
  if(input.action===c.dragAction&&Array.isArray(value)){s.target=point(value);s.hasTarget=true;dragReceived=true;s.usedInput=true;if(c.clearLostImu===true){if(c.axisFromDrag===true)s.axisSource=source;if(c.aimFromDrag===true)s.aimSource=source;}if(c.axisFromDrag===true)s.axis=[quantize(clamp(Number(value[0])*2-1,-1,1)),quantize(clamp(Number(value[1])*2-1,-1,1))];if(c.aimFromDrag===true&&body){const delta=[Number((s.target as number[])[0])-body.x,Number((s.target as number[])[1])-body.y],length=Math.hypot(...delta);if(length>0)s.aim=delta.map(n=>quantize(n/length));}}
  if(input.action===c.tiltAction&&Array.isArray(value)&&value.length===2&&value.every(safeFinite)){s.axis=value.map(v=>quantize(clamp(Number(v),-1,1)));s.usedInput=true;if(c.clearLostImu===true)s.axisSource=source;}
  if(input.action===c.orientationAction&&Array.isArray(value)&&value.length===3&&value.every(safeFinite)){const angle=Number(value[2]);s.aim=[quantize(Math.cos(angle)),quantize(Math.sin(angle))];if(c.clearLostImu===true)s.aimSource=source;}
  if(input.action===c.rotateAction&&safeFinite(value)){if(s.rotateSource!==source){s.rotateSource=source;s.angleBase=s.angle;}s.angle=wrapAngle(Number(s.angleBase)+value);}
  if(input.action===c.pinchAction&&safeFinite(value)){if(s.pinchSource!==source){s.pinchSource=source;s.scaleBase=s.scale;}s.scale=quantize(clamp(Number(s.scaleBase)*value,0.125,8));}
  if(input.action===c.rawAction&&isRecord(value)&&safeFinite(value.u)&&safeFinite(value.v)){
   if(Number(value.count??1)>1){s.grabbing=false;s.power=0;continue;}
   if(value.kind==='down'){s.grabbing=true;s.grab=[value.u,value.v];s.power=0;}
   if(s.grabbing&&value.kind==='move'&&c.slingshot===true){const pull=[Number((s.grab as number[])[0])-value.u,value.v-Number((s.grab as number[])[1])],length=Math.hypot(...pull);s.power=quantize(clamp(length/0.5,0,1));if(length>0)s.aim=pull.map(v=>quantize(v/length));}
   if(value.kind==='up'||value.kind==='cancel'){if(c.slingshot===true&&s.grabbing&&value.kind==='up'&&Number(s.power)>0.02)s.fireRequest=true;if(value.kind==='cancel'&&c.cancelClearsPower===true)s.power=0;s.grabbing=false;}
  }
  if(input.action===c.spawnAction){
   if(w.bodies.length>=Number(c.spawnLimit??32)){s.lost=true;events.push({type:'control.failed',payload:{reason:'pool-full'}});}
   else {const half=Number(c.spawnHalfSize??128),x=clamp(s.hasTarget?Number((s.target as number[])[0]):Number(c.width)/2,half,Number(c.width)-half),id='drop_'+s.spawned;
    if(w.bodies.some(body=>body.id===id))error('Drop ID already alive');w.bodies.push({id,kind:'target',x:Math.round(x),y:Number(c.spawnY??Number(c.height)-half),vx:0,vy:0,hx:half,hy:half,hp:1,team:2,value:Number(c.spawnValue??2),fixed:false});s.spawned=Number(s.spawned)+1;if(c.balance===true)s.angle=quantize(Number(s.angle)+(x-Number(c.width)/2)/Number(c.width));events.push({type:'control.spawned',payload:{id}});
   }
  }
  if(input.action===c.pathAction&&isRecord(value)&&Array.isArray(value.points)){
   if(value.points.length>128)error('Cut path budget exceeded');const points=value.points.map(value=>point(value));
   for(let i=1;i<points.length&&!s.lost;i++)for(const target of [...w.bodies]){
    if((s.cutIds as string[]).includes(target.id)||segmentAabb(points[i-1]!,points[i]!,target)===undefined)continue;
    if((c.hazardIds as Json[]|undefined)?.includes(target.id)){s.lost=true;events.push({type:'control.failed',payload:{reason:'hazard',id:target.id}});break;}
    if(target.kind!=='target')continue;(s.cutIds as string[]).push(target.id);s.score=Number(s.score)+target.value;w.score+=target.value;w.bodies=w.bodies.filter(body=>body.id!==target.id);events.push({type:'control.cut',payload:{id:target.id}});
   }
  }
 }
 if(c.clearLostImu===true){if(String(s.axisSource??'').startsWith('imu:')&&(!normalized['~imu']||!normalized['~imu:'+String(c.tiltAction)])){s.axis=[0,0];s.axisSource='';}if(String(s.aimSource??'').startsWith('imu:')&&(!normalized['~imu']||!normalized['~imu:'+String(c.orientationAction)])){s.aim=[0,0];s.aimSource='';}}
 const activePointer=Object.keys(normalized).some(key=>/^\d+$/.test(key));
 if(c.axisFromDrag===true&&!activePointer&&!dragReceived&&!normalized['~imu'])s.axis=[0,0];
 if(body){
  if(c.moveMode==='drag'&&(dragReceived||activePointer)&&s.hasTarget){moveClipped(body,s.target as number[],Number(c.speed??128),w.bodies.filter(b=>b.fixed&&b.kind==='solid'));body.vx=body.vy=0;}
  if(c.moveMode==='tilt'&&!activePointer){const axis=normalized['~imu']?s.axis as number[]:[0,0];body.vx=Math.round(Number(c.speed??64)*axis[0]!);body.vy=Math.round(-Number(c.speed??64)*axis[1]!);}
  if(c.moveMode==='tilt'&&activePointer&&s.hasTarget){moveClipped(body,s.target as number[],Number(c.speed??128),w.bodies.filter(b=>b.fixed&&b.kind==='solid'));body.vx=body.vy=0;}
  body.x=clamp(body.x,body.hx,Number(c.width)-body.hx);body.y=clamp(body.y,body.hy,Number(c.height)-body.hy);
 }
 if(c.balance===true){const axis=normalized['~imu']||c.axisFromDrag===true?s.axis as number[]:[0,0];s.angle=quantize(Number(s.angle)*0.995+axis[0]!*0.02);if(Math.abs(Number(s.angle))>Number(c.failureAngle??0.8))s.lost=true;if(Number(s.spawned)>=Number(c.minBalancedBodies??3)&&Math.abs(Number(s.angle))<0.15)s.balanceTicks=Number(s.balanceTicks)+1;else s.balanceTicks=0;}
 const rotateGoal=c.targetAngle!==undefined&&Math.abs(wrapAngle(Number(s.angle)-Number(c.targetAngle)))<=Number(c.angleTolerance??0.1)&&(c.targetScale===undefined||Math.abs(Number(s.scale)-Number(c.targetScale))<=Number(c.scaleTolerance??0.1));
 s.won=!s.lost&&(rotateGoal||c.goalScore!==undefined&&Number(s.score)>=Number(c.goalScore)||c.balanceGoalTicks!==undefined&&Number(s.balanceTicks)>=Number(c.balanceGoalTicks));
 checkState(s);validateIntegerWorld(w,c);return {proposals:[{kind:'state.set',path:String(c.statePath),value:s},{kind:'state.set',path:String(c.worldPath),value:w as unknown as Json}],events};
}
export const inputControlImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateInputControl};
export function validateInputControlDefinition(def:GameDefinition):void{
 const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
 for(const entity of [...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.realtime.input-control'){
  const c=component.config;if(c.clearLostImu!==undefined&&typeof c.clearLostImu!=='boolean'||c.cancelClearsPower!==undefined&&typeof c.cancelClearsPower!=='boolean')error('Invalid opted-in input clearing policy');const s=readPointer(initial,String(c.statePath));if(!isRecord(s))error('Missing initial controller state');checkState(s as JsonRecord);const w=validateIntegerWorld(readPointer(initial,String(c.worldPath)),c);if(c.bodyId&&!w.bodies.some(body=>body.id===c.bodyId))error('Unknown controlled Body');
  if(c.clearLostImu===true)for(const key of ['tiltAction','orientationAction']){
   const action=def.inputs.actions.find(a=>a.id===c[key]);if(action?.bindings.some(b=>['imu.tilt','imu.orientation'].includes(b.source)&&b.config?.trackSample!==true))error('IMU loss clearing requires tracked sample validity');
  }
  const half=Number(c.spawnHalfSize??128),y=Number(c.spawnY??Number(c.height)-half);if(y<half||y>Number(c.height)-half||half*2>Number(c.width))error('Drop template exceeds world bounds');
  for(const [key,value] of Object.entries(c))if(key.endsWith('Action')&&!def.inputs.actions.some(action=>action.id===value))error('Unknown controller action');
 }
}
