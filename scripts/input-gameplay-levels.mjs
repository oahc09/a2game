/** Authoring only: opted-in loss policy and finite real-time input levels. */
export function improveInputGameplay(g,id){
 if(['G27','G31','H04'].includes(id)){
  const c=g.scenes[0].entities.flatMap(e=>e.components).find(c=>c.capability.id==='a2game.realtime.input-control').config;c.clearLostImu=true;
  for(const a of g.inputs.actions)for(const b of a.bindings)if(['imu.tilt','imu.orientation'].includes(b.source))b.config={...b.config,trackSample:true};
 }
 if(id==='G26'){const c=g.presentation.stage.camera;c.fitSize=[g.presentation.scene2d.width,Math.max(c.orthoHeight,g.presentation.scene2d.height)];}
 if(id==='G25'){
  const c=g.scenes[0].entities[0].components[0].config;c.gravity=-1;c.maxTicks=240;
  for(const b of g.state.world.initial.bodies)if(b.kind==='target'){b.fixed=false;b.vy=32;}
  g.rules.push({id:'missed-fruit',on:{type:'realtime.landed'},do:[{op:'state.set',path:'/control/lost',value:true}]});
  g.outcomes.find(o=>o.status==='lost').when={op:'or',args:[{state:'/control/lost'},{state:'/world/lost'}]};
 }
 if(id==='G30'){g.scenes[0].entities.flatMap(e=>e.components).find(c=>c.capability.id==='a2game.realtime.input-control').config.cancelClearsPower=true;g.presentation.hud=[{id:'pull',kind:'text',bind:{text:{template:'拉力 {0} · 发射 {1}',args:[{state:'/control/power'},{state:'/world/nextId'}]}}}];}
}
