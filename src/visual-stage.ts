import {fail} from './errors.js';
import {readPointer,safeFinite,safeInteger} from './utils.js';
import type {GameDefinition,SessionObservation} from './types.js';

export type StageScalar=number|{state:string;scale?:number;offset?:number};
export interface StageNode {id:string;kind:'mesh'|'sprite';geometry?:'box'|'sphere'|'plane';at:[StageScalar,StageScalar,StageScalar];size:[StageScalar,StageScalar,StageScalar];rotation?:[StageScalar,StageScalar,StageScalar];spin?:[number,number,number];color:string;asset?:string;material?:'unlit'|'standard';}
export interface StageCamera {projection:'perspective'|'orthographic';at:[number,number,number];target:[number,number,number];near:number;far:number;fov:number;orthoHeight:number;fitSize?:[number,number];}
export interface StageParticle {id:string;count:number;origin:[number,number,number];spread:[number,number,number];velocity:[number,number,number];size:number;color:string;periodTicks:number;}
export interface StageAudio {id:string;asset:string;event:string;volume:number;}
export interface VisualStageSpec {bindingProfile?:'numeric-pointer-v1';camera:StageCamera;nodes:StageNode[];particles?:StageParticle[];audio?:StageAudio[];}
export interface StageDraw {id:string;kind:'mesh'|'sprite';geometry:'box'|'sphere'|'plane';at:number[];size:number[];rotation:number[];color:string;asset?:string;material:'unlit'|'standard';}
export interface VisualStageFrame {camera:StageCamera;nodes:StageDraw[];audio:{id:string;key:string}[];tickIndex:number;}
function bad(message:string,path='/presentation/stage'):never{fail('A2G_E_PRESENTATION',message,{jsonPointer:path});}
function obj(raw:unknown,keys:string[],path:string):Record<string,unknown>{if(!raw||typeof raw!=='object'||Array.isArray(raw))bad('Object expected',path);const r=raw as Record<string,unknown>;if(Object.keys(r).some(key=>!keys.includes(key)))bad('Unknown visual stage field',path);return r;}
function vec(raw:unknown,path:string,positive=false):asserts raw is number[]{if(!Array.isArray(raw)||raw.length!==3||!raw.every(x=>safeFinite(x)&&Math.abs(x)<=10000&&(!positive||x>0)))bad('Finite vec3 required',path);}
function color(raw:unknown,path:string):void{if(typeof raw!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(raw))bad('RGB color required',path);}
export function validateVisualStage(def:GameDefinition):void{
  const raw=def.presentation.stage;if(raw===undefined)return;
  if(!def.requires.all.some(ref=>ref.id==='a2game.visual.stage'&&ref.version==='0.1.0'))fail('A2G_E_CAP_DEPENDENCY','Visual stage requires a2game.visual.stage@0.1.0');
  const stage=obj(raw,['bindingProfile','camera','nodes','particles','audio'],'/presentation/stage');
  const bound=stage.bindingProfile==='numeric-pointer-v1';if(stage.bindingProfile!==undefined&&!bound)bad('Unknown binding profile');
  if(bound&&!def.requires.all.some(ref=>ref.id==='a2game.visual.bound-stage'))fail('A2G_E_CAP_DEPENDENCY','Numeric pointer bindings require visual.bound-stage');
  const initial=Object.fromEntries(Object.entries(def.state).map(([key,value])=>[key,value.initial]));
  const scalar=(value:unknown,path:string,positive=false)=>{
    if(safeFinite(value)&&Math.abs(value)<=10000&&(!positive||value>0))return;
    if(!bound)bad('Non-numeric rotation/size requires numeric-pointer-v1',path);
    const b=obj(value,['state','scale','offset'],path);if(typeof b.state!=='string'||!/^\/(?:[^~]|~[01])+$/.test(b.state))bad('Numeric JSON Pointer required',path);
    if(b.scale!==undefined&&(!safeFinite(b.scale)||Math.abs(b.scale)>10000)||b.offset!==undefined&&(!safeFinite(b.offset)||Math.abs(b.offset)>10000))bad('Invalid affine binding',path);
    const initialValue=readPointer(initial,b.state);if(!safeFinite(initialValue))bad('Binding must reference numeric initial state',path);const resolved=initialValue*Number(b.scale??1)+Number(b.offset??0);if(!safeFinite(resolved)||Math.abs(resolved)>10000||positive&&resolved<=0)bad('Invalid initial resolved binding',path);
  };
  const camera=obj(stage.camera,['projection','at','target','near','far','fov','orthoHeight','fitSize'],'/presentation/stage/camera');
  vec(camera.at,'/presentation/stage/camera/at');vec(camera.target,'/presentation/stage/camera/target');
  if(!['perspective','orthographic'].includes(String(camera.projection))||!safeFinite(camera.near)||!safeFinite(camera.far)||camera.near<=0||camera.far<=camera.near||camera.far>10000||!safeFinite(camera.fov)||camera.fov<10||camera.fov>120||!safeFinite(camera.orthoHeight)||camera.orthoHeight<=0||camera.orthoHeight>1000)bad('Invalid camera');
  if(camera.at.every((n,i)=>n===(camera.target as number[])[i]))bad('Camera target equals its position');
  if(camera.fitSize!==undefined&&(camera.projection!=='orthographic'||!Array.isArray(camera.fitSize)||camera.fitSize.length!==2||!camera.fitSize.every(n=>safeFinite(n)&&n>0&&n<=1000)))bad('Orthographic fitSize must contain two positive world extents');
  if(!Array.isArray(stage.nodes)||stage.nodes.length>128)bad('At most 128 stage nodes');
  const ids=new Set<string>();
  const id=(raw:unknown)=>{if(typeof raw!=='string'||!/^[_A-Za-z][_A-Za-z0-9-]*$/.test(raw)||ids.has(raw))bad('Invalid or duplicate stage ID');ids.add(raw);};
  const asset=(raw:unknown,type:string)=>{if(typeof raw!=='string'||def.assets?.[raw]?.type!==type)bad(`Approved ${type} asset reference required`);};
  for(const [index,rawNode] of stage.nodes.entries()){
    const path=`/presentation/stage/nodes/${index}`,n=obj(rawNode,['id','kind','geometry','at','size','rotation','spin','color','asset','material'],path);id(n.id);
    if(!['mesh','sprite'].includes(String(n.kind)))bad('Invalid visual stage node',path);
    if(!Array.isArray(n.at)||n.at.length!==3)bad('Position requires three scalar bindings',path);
    for(const value of n.at){if(bound){scalar(value,path+'/at');continue;}if(safeFinite(value)&&Math.abs(value)<=10000)continue;const b=obj(value,['state'],path+'/at');if(typeof b.state!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(b.state))bad('Numeric top-level JSON Pointer required',path);const field=readPointer(def.state,b.state);if(!field||typeof field!=='object'||!('type' in field)||!['int','number'].includes(String(field.type)))bad('Position binding must name a numeric state field',path);}
    if(bound){for(const key of ['size','rotation']){if(key==='rotation'&&n[key]===undefined)continue;if(!Array.isArray(n[key])||(n[key] as unknown[]).length!==3)bad('Vec3 binding required',path);for(const value of n[key] as unknown[])scalar(value,path+'/'+key,key==='size');}}else{vec(n.size,path+'/size',true);if(n.rotation!==undefined)vec(n.rotation,path+'/rotation');}
    if(n.spin!==undefined)vec(n.spin,path+'/spin');color(n.color,path+'/color');
    if(n.material!==undefined&&!['unlit','standard'].includes(String(n.material)))bad('Unknown trusted material preset',path);
    if(n.kind==='mesh'&&!['box','sphere','plane'].includes(String(n.geometry)))bad('Unknown geometry',path);
    if(n.asset!==undefined)asset(n.asset,'image');if(n.kind==='sprite')asset(n.asset,'image');
  }
  const particles=stage.particles??[];if(!Array.isArray(particles)||particles.length>8)bad('At most 8 particle emitters');let count=0;
  for(const rawParticle of particles){const p=obj(rawParticle,['id','count','origin','spread','velocity','size','color','periodTicks'],'/presentation/stage/particles');id(p.id);if(!safeInteger(p.count)||p.count<1||p.count>128||!safeInteger(p.periodTicks)||p.periodTicks<1||p.periodTicks>36000||!safeFinite(p.size)||p.size<=0||p.size>10)bad('Invalid particle limits');count+=p.count;vec(p.origin,'/presentation/stage/particles/origin');vec(p.spread,'/presentation/stage/particles/spread');vec(p.velocity,'/presentation/stage/particles/velocity');color(p.color,'/presentation/stage/particles/color');}
  if(count>128)bad('At most 128 particles in total');
  const audio=stage.audio??[];if(!Array.isArray(audio)||audio.length>8)bad('At most 8 audio cues');
  for(const rawCue of audio){const cue=obj(rawCue,['id','asset','event','volume'],'/presentation/stage/audio');id(cue.id);asset(cue.asset,'audio');if(typeof cue.event!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,95}$/.test(cue.event)||!safeFinite(cue.volume)||cue.volume<0||cue.volume>1)bad('Invalid audio cue');}
}
export function projectVisualStage(def:GameDefinition,obs:SessionObservation):VisualStageFrame|undefined{
  const stage=def.presentation.stage as unknown as VisualStageSpec|undefined;if(!stage)return;
  const time=obs.tickIndex/def.world.clock.tickHz;
  const resolve=(value:StageScalar,positive=false)=>{const raw=typeof value==='number'?value:readPointer(obs.state,value.state);if(!safeFinite(raw))bad('Resolved binding must be numeric');const n=typeof value==='number'?raw:raw*Number(value.scale??1)+Number(value.offset??0);if(!safeFinite(n)||Math.abs(n)>10000||positive&&n<=0)bad('Resolved binding exceeds visual bounds');return n;};
  const nodes:StageDraw[]=stage.nodes.map(node=>({id:node.id,kind:node.kind,geometry:node.kind==='sprite'?'plane':node.geometry!,
    at:node.at.map(value=>resolve(value)),
    size:node.size.map(value=>resolve(value,true)),rotation:[0,1,2].map(axis=>resolve(node.rotation?.[axis]??0)+(node.spin?.[axis]??0)*time),color:node.color,
    ...(node.asset?{asset:node.asset}:{}),material:node.material??'unlit'}));
  for(const particle of stage.particles??[])for(let i=0;i<particle.count;i++){
    const age=((obs.tickIndex+i*17)%particle.periodTicks)/def.world.clock.tickHz;
    nodes.push({id:`${particle.id}[${i}]`,kind:'mesh',geometry:'sphere',size:[particle.size,particle.size,particle.size],rotation:[0,0,0],color:particle.color,material:'unlit',
      at:[0,1,2].map(axis=>particle.origin[axis]!+((((i+1)*(axis+3)*2654435761)>>>0)/4294967296-0.5)*particle.spread[axis]!+particle.velocity[axis]!*age)});
  }
  const audio=(stage.audio??[]).flatMap(cue=>obs.events.filter(event=>event.type===cue.event).map(event=>({id:cue.id,key:`${obs.tickIndex}:${cue.id}:${event.eventId}`})));
  return {camera:structuredClone(stage.camera),nodes,audio,tickIndex:obs.tickIndex};
}
