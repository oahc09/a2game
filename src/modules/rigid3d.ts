import {World,Body,Box,Sphere,Vec3,Quaternion,NaiveBroadphase} from 'cannon-es';
import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeInteger,safeFinite,stableCompare} from '../utils.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
const Q=1000000,quantize=(n:number)=>Math.round(n*Q),unpack=(v:number[])=>v.map(n=>n/Q);
function xyz(q:Quaternion):number[]{
 const {x,y,z,w}=q,m13=2*(x*z+y*w),ry=Math.asin(Math.max(-1,Math.min(1,m13)));
 return (Math.abs(m13)<0.9999999?[Math.atan2(2*(x*w-y*z),1-2*(x*x+y*y)),ry,Math.atan2(2*(z*w-x*y),1-2*(y*y+z*z))]:[Math.atan2(2*(y*z+x*w),1-2*(x*x+z*z)),ry,0]).map(quantize);
}
interface RigidStateBody {active:boolean;p:number[];v:number[];q:number[];w:number[];e:number[];renderY:number;}
interface RigidState {bodies:RigidStateBody[];contacts:string[];hitIds:string[];axis:number[];axisSource:string;score:number;stableTicks:number;placed:number;spawnX:number;spawnZ:number;launched:boolean;won:boolean;lost:boolean;}
let activeWorlds=0;
export const rigid3dDiagnostics=()=>({activeWorlds});
function bad(message:string):never{return fail('A2G_E_CAP_CONFIG',message);}
const vector=(v:unknown,length=3,bound=1000):v is number[]=>Array.isArray(v)&&v.length===length&&v.every(n=>safeFinite(n)&&Math.abs(n)<=bound);
function config(c:Readonly<JsonRecord>):void{
 if(typeof c.statePath!=='string'||!c.statePath.startsWith('/')||!Array.isArray(c.bodies)||c.bodies.length<1||c.bodies.length>16||!vector(c.gravity)||!safeInteger(c.maxTicks)||c.maxTicks<1||c.maxTicks>36000)bad('Invalid rigid3d world');
 const ids=new Set<string>();for(const raw of c.bodies){if(!isRecord(raw)||typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(raw.id)||ids.has(raw.id)||!['box','sphere'].includes(String(raw.shape))||!vector(raw.size)||raw.size.some(n=>n<0.05||n>20)||!vector(raw.position)||!safeFinite(raw.mass)||raw.mass<0||raw.mass>100||typeof raw.active!=='boolean')bad('Invalid rigid3d body');ids.add(raw.id);}
 for(const d of c.bodies as JsonRecord[])if(d.shape==='sphere'&&(d.size as number[]).some(n=>n!==(d.size as number[])[0])||d.mass===0&&d.active!==true)bad('Invalid sphere or static activation');
 if(!vector(c.gravity,3,32)||c.failBelow!==undefined&&(!safeFinite(c.failBelow)||c.failBelow<-32||c.failBelow>0))bad('Invalid rigid3d gravity/boundary');
 for(const k of ['requiredBodies','stableTicks'])if(c[k]!==undefined&&(!safeInteger(c[k])||Number(c[k])<1||Number(c[k])>36000))bad('Invalid rigid3d goal');
 if(c.triggers!==undefined&&(!Array.isArray(c.triggers)||c.triggers.length>8||c.triggers.some(t=>!isRecord(t)||typeof t.id!=='string'||!vector(t.min)||!vector(t.max)||(t.min as number[]).some((v,i)=>v>=Number((t.max as number[])[i])))))bad('Invalid rigid3d triggers');
 if(c.spawnAction!==undefined&&(!safeFinite(c.spawnY)||Number(c.spawnY)<1||Number(c.spawnY)>16))bad('Invalid rigid3d spawn');
 if(c.launchVelocity!==undefined&&!vector(c.launchVelocity,3,20)||c.restitution!==undefined&&(!safeFinite(c.restitution)||c.restitution<0||c.restitution>1))bad('Invalid rigid3d impulse/material');
 if(c.launchAction!==undefined&&(!vector(c.launchVelocity,3,20)||!safeInteger(c.actorIndex)||c.actorIndex<0||c.actorIndex>=c.bodies.length||Number((c.bodies[c.actorIndex] as JsonRecord).mass)<=0))bad('Invalid rigid3d launch body');
 if(c.requiredBodies!==undefined&&Number(c.requiredBodies)>c.bodies.filter(d=>isRecord(d)&&Number(d.mass)>0).length)bad('Rigid3d goal exceeds pool');
}
export function initialRigidState(c:Readonly<JsonRecord>):JsonRecord{
 config(c);const defs=c.bodies as JsonRecord[];
 return {bodies:defs.map(d=>{const p=(d.position as number[]).map(quantize);return {active:d.active,p,v:[0,0,0],q:[0,0,0,Q],w:[0,0,0],e:[0,0,0],renderY:d.active?p[1]:-1000*Q};}),contacts:[],hitIds:[],axis:[0,0],axisSource:'',score:0,stableTicks:0,placed:0,spawnX:0,spawnZ:0,launched:false,won:false,lost:false} as unknown as JsonRecord;
}
function state(raw:unknown,c:Readonly<JsonRecord>):RigidState{
 if(!isRecord(raw)||!Array.isArray(raw.bodies)||raw.bodies.length!==(c.bodies as Json[]).length||!Array.isArray(raw.contacts)||raw.contacts.length>120||raw.contacts.some(x=>typeof x!=='string')||!Array.isArray(raw.hitIds)||raw.hitIds.length>16||raw.hitIds.some(x=>typeof x!=='string'))bad('Invalid rigid3d state');
 for(const b of raw.bodies){if(!isRecord(b)||typeof b.active!=='boolean'||!vector(b.p,3,1000*Q)||!vector(b.v,3,100*Q)||!vector(b.q,4,2*Q)||Math.abs(Math.hypot(...b.q)/Q-1)>0.001||!vector(b.w,3,100*Q)||!vector(b.e,3,10*Q)||!safeInteger(b.renderY)||['p','v','q','w','e'].some(k=>(b[k] as number[]).some(n=>!safeInteger(n))))bad('Invalid quantized rigid3d body');}
 for(const key of ['score','stableTicks','placed'])if(!safeInteger(raw[key])||Number(raw[key])<0||Number(raw[key])>1000000)bad('Invalid rigid3d counter');
 if(!safeInteger(raw.spawnX)||!safeInteger(raw.spawnZ)||Math.abs(raw.spawnX)>2*Q||Math.abs(raw.spawnZ)>2*Q||!vector(raw.axis,2,1)||typeof raw.axisSource!=='string'||raw.axisSource.length>96||![raw.won,raw.lost,raw.launched].every(v=>typeof v==='boolean'))bad('Invalid rigid3d control');
 return raw as unknown as RigidState;
}
export function simulateRigid3d(ctx:ModuleContext):ModuleResult{
 const c=ctx.config;config(c);const s=clone(state(readPointer(ctx.world.state,String(c.statePath)),c)),defs=c.bodies as JsonRecord[],events:NonNullable<ModuleResult['events']>=[];
 const inputs=ctx.inputs.filter(e=>e.type==='input.action'&&e.edge==='press'),has=(key:string)=>inputs.some(e=>e.action===c[key]);
 for(const e of inputs)if(e.action===c.dragAction){const v=e.payload.value;if(!Array.isArray(v)||v.length!==2||!v.every(n=>safeFinite(n)&&n>=0&&n<=1))bad('Invalid rigid3d placement');s.spawnX=quantize((Number(v[0])-0.5)*4);s.spawnZ=quantize((Number(v[1])-0.5)*4);}
 if(has('spawnAction')){const i=s.bodies.findIndex((b,i)=>!b.active&&Number(defs[i]!.mass)>0);if(i>=0){const b=s.bodies[i]!;b.active=true;b.p=[s.spawnX,quantize(Number(c.spawnY)),s.spawnZ];b.v=[0,0,0];b.q=[0,0,0,Q];b.w=[0,0,0];s.placed++;s.stableTicks=0;events.push({type:'rigid3d.spawned',payload:{id:String(defs[i]!.id)}});}}
 for(const e of inputs)if(e.action===c.tiltAction){const v=e.payload.value;if(!vector(v,2,1))bad('Invalid rigid3d tilt');s.axis=[...v];s.axisSource=e.sourceId??'';}
 if(s.axisSource.startsWith('imu:')&&(!ctx.normalizedInputs?.['~imu']||!ctx.normalizedInputs?.['~imu:'+String(c.tiltAction)]))s.axis=[0,0];
 if(ctx.inputs.some(e=>e.action===c.tiltAction&&e.edge==='cancel'))s.axis=[0,0];
 const world=new World({gravity:new Vec3(...(c.gravity as number[] as [number,number,number]))});world.allowSleep=false;world.broadphase=new NaiveBroadphase();world.defaultContactMaterial.friction=0;world.defaultContactMaterial.restitution=Number(c.restitution??0);(world.solver as unknown as {iterations:number}).iterations=16;
 activeWorlds++;try{
 world.gravity.x+=s.axis[0]!*9.82;world.gravity.z+=s.axis[1]!*9.82;
 const native=new Map<number,Body>();
 for(const [i,b]of s.bodies.entries())if(b.active){const d=defs[i]!,mass=Number(d.mass),shape=d.shape==='sphere'?new Sphere(Number((d.size as number[])[0])/2):new Box(new Vec3(...(d.size as number[]).map(n=>n/2) as [number,number,number]));const body=new Body({mass,shape,position:new Vec3(...unpack(b.p) as [number,number,number]),velocity:new Vec3(...unpack(b.v) as [number,number,number]),quaternion:new Quaternion(...unpack(b.q) as [number,number,number,number]),angularVelocity:new Vec3(...unpack(b.w) as [number,number,number]),linearDamping:0.01,angularDamping:0.15,allowSleep:false});body.id=i;body.quaternion.normalize();world.addBody(body);native.set(i,body);}
 if(has('launchAction')&&!s.launched){const b=native.get(Number(c.actorIndex??1));if(b){b.velocity.set(...c.launchVelocity as [number,number,number]);s.launched=true;events.push({type:'rigid3d.launched',payload:{}});}}
 const pairs=new Set<string>();for(let step=0;step<4;step++){world.step(1/ctx.tickHz/4);for(const contact of world.contacts){const ids=[String(defs[contact.bi.id]!.id),String(defs[contact.bj.id]!.id)].sort(stableCompare);pairs.add(ids.join('|'));}}
 for(const pair of [...pairs].sort(stableCompare))if(!s.contacts.includes(pair))events.push({type:'rigid3d.contact',payload:{pair}});s.contacts=[...pairs].sort(stableCompare);
 let stable=true;for(const [i,body]of native){const b=s.bodies[i]!;b.p=body.position.toArray().map(quantize);b.v=body.velocity.toArray().map(quantize);b.q=body.quaternion.toArray().map(quantize);b.w=body.angularVelocity.toArray().map(quantize);b.e=xyz(body.quaternion);b.renderY=b.p[1]!;
  if(Number(defs[i]!.mass)>0){stable&&=body.velocity.length()<0.1&&body.angularVelocity.length()<0.1&&body.position.y>=0;if(body.position.y<Number(c.failBelow??-3))s.lost=true;}
 }
 s.stableTicks=stable?s.stableTicks+1:0;
 const triggers=(c.triggers??[]) as JsonRecord[],actor=s.bodies[Number(c.actorIndex??1)];if(actor?.active&&s.score<triggers.length){const t=triggers[s.score]!,p=unpack(actor.p);if(p.every((v,i)=>v>=Number((t.min as number[])[i])&&v<=Number((t.max as number[])[i]))){s.score++;events.push({type:'rigid3d.trigger',payload:{id:String(t.id)}});}}
 s.won=triggers.length>0?s.score>=triggers.length:c.requiredBodies!==undefined&&s.placed>=Number(c.requiredBodies)&&s.stableTicks>=Number(c.stableTicks??60);
 s.lost||=ctx.tickIndex+1>=Number(c.maxTicks)&&!s.won;
 state(s,c);return {proposals:[{kind:'state.set',path:String(c.statePath),value:s as unknown as Json}],events};
 }finally{for(const body of [...world.bodies])world.removeBody(body);activeWorlds--;}
}
export function validateRigid3dDefinition(def:GameDefinition):void{
 const initial=Object.fromEntries(Object.entries(def.state).map(([k,v])=>[k,v.initial]));
 for(const e of [...def.scenes.flatMap(s=>s.entities),...Object.values(def.prototypes??{})])for(const m of e.components??[])if(m.capability.id==='a2game.physics.rigid3d'){config(m.config);state(readPointer(initial,String(m.config.statePath)),m.config);for(const k of ['spawnAction','dragAction','tiltAction','launchAction'])if(m.config[k]!==undefined&&!def.inputs.actions.some(a=>a.id===m.config[k]))bad('Unknown rigid3d action');}
}
export const rigid3dImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateRigid3d};
