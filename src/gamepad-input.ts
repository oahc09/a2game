import {fail} from './errors.js';
import {safeInteger,safeFinite} from './utils.js';
import type {GameDefinition,JsonRecord,NormalizedRawInput,NormalizedAction,SessionSnapshot} from './types.js';
export const gamepadInputSources={'gamepad.button':'a2game.input.gamepad.button','gamepad.axis2':'a2game.input.gamepad.axis2'};
const source=(index:number,button:number)=>`gamepad:${index}:button:${button}`;

const axisQuantum = 10000;

function radialAxes(x: number, y: number, deadZone: number): [number,number] {
 const ix=Math.round(x*axisQuantum),iy=Math.round(y*axisQuantum);
 const radius=Math.sqrt(ix*ix+iy*iy)/axisQuantum;
 if(radius<=deadZone)return [0,0];
 const scale=(Math.min(radius,1)-deadZone)/((1-deadZone)*radius);
 const quantize=(n:number)=>Math.sign(n)*Math.round(Math.abs(n)*scale);
 let qx=quantize(ix),qy=quantize(iy);
 // Nearest component rounding can push a point just outside the unit circle.
 if(qx*qx+qy*qy>axisQuantum*axisQuantum){qx=Math.trunc(ix*scale);qy=Math.trunc(iy*scale);}
 return [qx===0?0:qx/axisQuantum,qy===0?0:qy/axisQuantum];
}

export function recognizeGamepadInput(stage:SessionSnapshot,batch:NormalizedRawInput[],definition:GameDefinition,chosen:(id:string)=>boolean):NormalizedAction[]{
 const out:NormalizedAction[]=[],bindings=definition.inputs.actions.flatMap(action=>action.bindings.filter(b=>chosen(gamepadInputSources[b.source as keyof typeof gamepadInputSources]??'')).map(binding=>({action,binding,c:binding.config??{}})));
 const emit=(action:string,phase:NormalizedAction['phase'],sourceId:string,value?:NormalizedAction['value'],timeUs=Math.ceil(stage.tickIndex*1000000/definition.world.clock.tickHz))=>out.push({action,phase,sourceId,...(value!==undefined?{value}:{}),tickIndex:stage.tickIndex,timeUs,seq:out.length});
 for(const sample of [...batch].sort((a,b)=>(a.timeUs??0)-(b.timeUs??0)||(a.seq??0)-(b.seq??0))){
  const p=sample.payload;if(sample.kind!=='sample'||!safeInteger(p.index)||p.index<0||p.index>3||typeof p.connected!=='boolean'||!Array.isArray(p.buttons)||p.buttons.length>32||p.buttons.some(b=>typeof b!=='boolean')||!Array.isArray(p.axes)||p.axes.length>16||p.axes.some(n=>!safeFinite(n)||Math.abs(n)>1))fail('A2G_E_INPUT_RAW','Invalid normalized Gamepad sample');
  const key='~gamepad:'+p.index,previous=stage.activePointers[key],buttons=p.connected?p.buttons:[],axes=p.connected?p.axes.map(n=>Math.round(Number(n)*10000)/10000):[];
  for(const {action,binding,c} of bindings){if(Number(c.index??0)!==p.index)continue;
   if(binding.source==='gamepad.button'){const id=source(p.index,Number(c.button)),was=Boolean((previous?.buttons as boolean[]|undefined)?.[Number(c.button)]),pressed=Boolean(buttons[Number(c.button)]);if(pressed!==was)emit(action.id,pressed?'press':'release',id,undefined,sample.timeUs);}
   else {
    const dz=Number(c.deadZone??0.1),xi=Number(c.xAxis),yi=Number(c.yAxis),old=previous?.axes as number[]|undefined;
    const x=axes[xi]??0,y=axes[yi]??0;
    let value:[number,number],changed:boolean;
    if(c.deadZoneMode==='radial'){
     value=radialAxes(x,y,dz);
     const before=radialAxes(old?.[xi]??0,old?.[yi]??0,dz);
     changed=(!p.connected&&!!previous)||value[0]!==before[0]||value[1]!==before[1];
    }else{
     value=[Math.abs(x)<dz?0:x,Math.abs(y)<dz?0:y];
     changed=!previous||!p.connected||old?.[xi]!==axes[xi]||old?.[yi]!==axes[yi];
    }
    if(changed){const id=`gamepad:${p.index}:axis:${action.id}`;emit(action.id,'press',id,value,sample.timeUs);emit(action.id,'release',id,undefined,sample.timeUs);}
   }
  }
  if(p.connected)stage.activePointers[key]={buttons,axes} as JsonRecord;else delete stage.activePointers[key];
 }
 // Held buttons are part of shared checkpointed state, so replay needs no repeated hardware samples.
 for(const {action,binding,c} of bindings)if(binding.source==='gamepad.button'){const index=Number(c.index??0),button=Number(c.button),id=source(index,button);if((stage.activePointers['~gamepad:'+index]?.buttons as boolean[]|undefined)?.[button]&&stage.pressedSources[action.id]?.includes(id)&&!out.some(a=>a.sourceId===id))emit(action.id,'hold',id);}
 return out;
}
export function validateGamepadBindings(game:GameDefinition):void {
 for(const action of game.inputs.actions)for(const binding of action.bindings){
  if(!(binding.source in gamepadInputSources))continue;
  const axis=binding.source==='gamepad.axis2';
  if(action.valueType!==(axis?'vec2':'button'))fail('A2G_E_INPUT_ACTION','Gamepad binding has wrong value type');
  const c=binding.config;
  if(c?.deadZoneMode===undefined)continue;
  const validAxis=(value:unknown)=>safeInteger(value)&&value>=0&&value<=15;
  if(!axis||c.deadZoneMode!=='radial'||!validAxis(c.xAxis)||!validAxis(c.yAxis)||c.xAxis===c.yAxis
    ||(c.index!==undefined&&(!safeInteger(c.index)||c.index<0||c.index>3))
    ||(c.deadZone!==undefined&&(!safeFinite(c.deadZone)||c.deadZone<0||c.deadZone>0.9))){
   fail('A2G_E_INPUT_ACTION','Radial Gamepad axis2 requires a valid device index, distinct axes and deadZone in [0, 0.9]');
  }
 }
}
