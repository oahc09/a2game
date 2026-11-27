import {readFileSync} from 'node:fs';
export const lab=JSON.parse(readFileSync(new URL('../../specs/v0.1/games/gamepad-lab.game.json',import.meta.url)));
export const joy=(game,id)=>game.inputs.actions.find(a=>a.id===id).bindings.find(b=>b.source.startsWith('gamepad.')).config;
export const pos=(payload)=>({index:0,mapping:'standard',connected:true,buttons:[{pressed:false,value:0}],axes:[1,-1,-1,1],...payload});
export function profile(){
 const g=structuredClone(lab);
 joy(g,'collect').mapping='standard';
 Object.assign(joy(g,'look'),{mapping:'standard',invertY:true,deadZoneMode:'radial'});
 g.inputs.actions.push({id:'aim',valueType:'vec2',bindings:[{source:'gamepad.axis2',config:{xAxis:2,yAxis:3,mapping:'standard',invertY:true,deadZoneMode:'radial'}}]});
 g.state.rightStick={type:'vec2',initial:[0,0]};
 g.rules.push({id:'read-right-stick',on:{type:'input.action',action:'aim',edge:'press'},do:[{op:'state.set',path:'/rightStick',value:{event:'/value'}}]});
 return g;
}
export function pairedProfile(){
 const g=profile();
 g.requires.all.push({id:'a2game.input.touch.drag',version:'0.1.0'});
 for(const [action,zone] of [['look','left'],['aim','right']])
  g.inputs.actions.find(a=>a.id===action).bindings.push({source:'touch.drag',config:{stick:{zone,radius:.10,deadZone:.12}}});
 return g;
}
