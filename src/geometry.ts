import {fail} from './errors.js';
import {safeFinite} from './utils.js';
import type {WorldBody} from './modules/realtime.js';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function error(message:string):never{return fail('A2G_E_CAP_CONFIG',message);}
/** Parametric segment hit fraction, including zero-length inside hits. */
export function segmentAabb(from:readonly number[],to:readonly number[],body:Pick<WorldBody,'x'|'y'|'hx'|'hy'>):number|undefined{
 if(from.length!==2||to.length!==2||![...from,...to,body.x,body.y,body.hx,body.hy].every(safeFinite))error('Invalid intersection geometry');
 let near=0,far=1;
 for(const [axis,position,half] of [[0,body.x,body.hx],[1,body.y,body.hy]]){const start=from[axis!]!,delta=to[axis!]!-start,min=position!-half!,max=position!+half!;if(delta===0){if(start<min||start>max)return undefined;}else{let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return undefined;}}
 return near;
}
export function viewportToWorld(u:number,v:number,aspect:number,width:number,height:number,origin:readonly number[]):[number,number]{
 if(![u,v,aspect,width,height,...origin].every(safeFinite)||aspect<=0||width<=0||height<=0||origin.length!==2)error('Invalid scene projection');
 const scale=Math.min(aspect/width,1/height);return [Math.round(((u-0.5)*aspect/scale-origin[0]!)*1000),Math.round(((0.5-v)/scale-origin[1]!)*1000)];
}
export function moveClipped(body:WorldBody,target:readonly number[],speed:number,solids:readonly WorldBody[]):void{
 for(const axis of ['x','y'] as const){const old=body[axis],half=axis==='x'?'hx':'hy',other=axis==='x'?'y':'x',otherHalf=axis==='x'?'hy':'hx';let next=old+clamp(Math.round(target[axis==='x'?0:1]!)-old,-speed,speed);
  for(const solid of solids){if(solid.id===body.id||Math.abs(body[other]-solid[other])>=body[otherHalf]+solid[otherHalf])continue;
   const left=solid[axis]-solid[half]-body[half],right=solid[axis]+solid[half]+body[half];if(next>old&&old<=left&&next>left)next=left;if(next<old&&old>=right&&next<right)next=right;
  }body[axis]=next;
 }
}
