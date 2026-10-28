/** Trusted authoring of bounded rigid-body levels; the adapters have no game logic. */
import {initialRigidState} from '../dist/modules/rigid3d.js';
const ref=id=>({id,version:'0.1.0'});
export function configureRigidLevel(g,profile,{count=3,returnGate=-0.75,speed=8}={}){
 const body=(id,shape,size,position,mass=0,active=true)=>({id,shape,size,position,mass,active});
 const stacking=profile==='stack';
 const bodies=stacking?[body('platform','box',[1.6,0.4,1.6],[0,-0.2,0]),...Array.from({length:count},(_,i)=>body('block'+i,'box',[0.6,0.6,0.6],[0,4,0],1,false))]:[
  body('table','box',[4,0.4,6],[0,-0.2,0]),body('ball','sphere',[0.36,0.36,0.36],[0,0.2,-2],1),body('left','box',[0.2,0.7,6.4],[-2.1,0.35,0]),body('right','box',[0.2,0.7,6.4],[2.1,0.35,0]),body('back','box',[4.4,0.7,0.2],[0,0.35,3.1]),body('drain-left','box',[1.2,0.7,0.2],[-1.4,0.35,-3.1]),body('drain-right','box',[1.2,0.7,0.2],[1.4,0.35,-3.1])];
 const c={statePath:'/rigid',bodies,gravity:[0,-9.82,0],maxTicks:stacking?900:480,failBelow:-3,restitution:stacking?0:0.95,...(stacking?{spawnAction:'drop',dragAction:'drag',tiltAction:'tilt',spawnY:4,requiredBodies:count,stableTicks:60}:{launchAction:'kick',actorIndex:1,launchVelocity:[2.2,0,speed],triggers:[{id:'out',min:[-2,0,1.5],max:[2,1,2.2]},{id:'return',min:[-2,0,returnGate-0.2],max:[2,1,returnGate+0.2]}]})};
 g.requires.all=['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.core.goal','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text','a2game.visual.stage','a2game.visual.bound-stage','a2game.physics.rigid3d','a2game.input.touch.raw',...(stacking?['a2game.input.touch.tap','a2game.input.touch.drag','a2game.input.imu.tilt']:['a2game.input.touch.tap'])].map(ref);
 g.world.dimension='3d';g.state={rigid:{type:'object',initial:initialRigidState(c)}};g.scenes=[{id:'main',entities:[{id:'controller',components:[{capability:ref('a2game.physics.rigid3d'),config:c}]}]}];g.rules=[];
 g.inputs={actions:[{id:stacking?'drop':'kick',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'Space'}},{source:'touch.tap',config:{}}]},...(stacking?[{id:'drag',valueType:'vec2',bindings:[{source:'touch.drag',config:{}}]},{id:'tilt',valueType:'vec2',bindings:[{source:'imu.tilt',config:{}}]}]:[])]};
 g.outcomes=[{id:'won',status:'won',when:{state:'/rigid/won'}},{id:'lost',status:'lost',priority:-1,when:{state:'/rigid/lost'}}];
 const scene=g.presentation.scene2d;scene.nodes=scene.nodes.filter(n=>['title','hint'].includes(n.id));delete scene.repeat;delete scene.bodyLayer;
 const bind=(i,key,axis)=>({state:'/rigid/bodies/'+i+'/'+key+(axis===undefined?'':'/'+axis),scale:0.000001});
 g.presentation.stage={bindingProfile:'numeric-pointer-v1',camera:{projection:'perspective',at:stacking?[6,5,8]:[6,8,9],target:[0,stacking?1.2:0,0],near:0.1,far:50,fov:45,orthoHeight:10},nodes:bodies.map((b,i)=>({id:b.id,kind:'mesh',geometry:b.shape==='sphere'?'sphere':'box',at:[bind(i,'p',0),bind(i,'renderY'),bind(i,'p',2)],size:b.size,rotation:[0,1,2].map(a=>bind(i,'e',a)),color:b.mass?(stacking?['#57d7c8','#eac36c','#b591db','#83b8eb'][(i-1)%4]:'#57d7c8'):'#35465e',material:'standard'}))};
 if(!stacking)for(const t of c.triggers)g.presentation.stage.nodes.push({id:'gate-'+t.id,kind:'mesh',geometry:'box',at:[0,0.015,(t.min[2]+t.max[2])/2],size:[3.8,0.03,0.16],color:'#bd86d9'});
 g.presentation.hud=[{id:'rigid',kind:'text',bind:{text:stacking?{template:'放置 {0}/'+count+' · 稳定 {1}/60',args:[{state:'/rigid/placed'},{state:'/rigid/stableTicks'}]}:{template:'触发 {0}/2 · 已发射 {1}',args:[{state:'/rigid/score'},{state:'/rigid/launched'}]}}}];return g;
}
