/** Repository-authored complete bounded levels. No adapter contains these rules. */
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),a=(action,ticks=1,value)=>({action,ticks,...(value===undefined?{}:{value})}),wait=ticks=>({ticks}),ref=id=>({id,version:'0.1.0'}),s=state=>({state}),k=constant=>({const:constant}),op=(op,...args)=>({op,args});
export const full2048=()=>read('project/full-2048-traces.json').solutions;
export const shooterRoute=()=>[{raw:[{source:'keyboard',kind:'down',payload:{code:'KeyA'}}],ticks:13},{raw:[{source:'keyboard',kind:'up',payload:{code:'KeyA'}}],ticks:1},{raw:[{source:'keyboard',kind:'down',payload:{code:'KeyW'}}],ticks:30},{raw:[{source:'keyboard',kind:'up',payload:{code:'KeyW'}}],ticks:1}];
export function improveFullGameplay(g,id,positive,negative,options){
 const world=g.scenes[0].entities.flatMap(e=>e.components).find(c=>c.capability.id==='a2game.realtime.world')?.config;
 const point=(x,y)=>[(x/1000-4)/10+.5,.5-(y/1000-3)/8];
 if(id==='G02'){
  const t=full2048();g.state.board.initial=t[2048].initial;g.state.best.initial=2;g.state.goal.initial=2048;g.state.stalled={type:'bool',initial:false};g.scenes[0].entities[0].components[0].config.stalledPath='/stalled';g.outcomes.push({id:'no-moves',status:'lost',priority:1,when:s('/stalled')});
  positive=t[2048].actions.map(action=>a(action));negative=t.lost.actions.map(action=>a(action));options={...options,negativeExpected:'lost',checks:[{path:'/best',equals:2048}],negativeChecks:[{path:'/stalled',equals:true}],hint:'标准两个 2 开局，方向键/滑动合并至 2048；无合法步失败，undo 撤销最近一步及随机补位。'};
 }
 if(id==='G16'){
  Object.assign(world,{goalScore:16,overflowY:600});positive=[a('drop',10),a('drop',10),a('drop',10),a('drop',100)];negative=[a('drop',60),a('drop',60),a('drop',100)];options={...options,negativeExpected:'lost',checks:[{path:'/world/score',equals:16},{path:'/control/spawned',equals:4}],negativeChecks:[{path:'/world/score',equals:4},{path:'/control/spawned',equals:3}],hint:'快速连续放四颗 2，合成 4 再合成 8；错序堆叠超过红线失败。重开回收所有旧实体。'};
  g.presentation.scene2d.nodes.push({id:'overflow-line',kind:'rect',at:[0,-2.4],size:[8,.025],fill:'#dc6d78'});
 }
 if(id==='G18'){
  g.state.world.initial.bodies.push({id:'wall',kind:'solid',x:4000,y:3000,vx:0,vy:0,hx:600,hy:100,hp:1,team:0,value:0,fixed:true});positive=[...shooterRoute(),a('aim',1,point(4000,4500)),a('fire')];negative=[a('aim',1,point(4000,4500)),a('fire',120)];options={...options,negativeExpected:'lost',hint:'WASD 移动与拖动瞄准分离；正面墙体挡住射线，绕墙后 Space 射击。'};
 }
 if(id==='G19'){
  Object.assign(world,{damageBonusPath:'/skill/bonus',cooldownTicks:10,seekSpeed:32,goalScore:3,maxTicks:230});const enemy=g.state.world.initial.bodies.find(b=>b.id==='enemy');enemy.hp=14;g.state.world.initial.bodies.find(b=>b.id==='hero').value=0;world.waves=[{tick:70,body:{...enemy,id:'wave_two',x:7000,hp:6}},{tick:130,body:{...enemy,id:'wave_three',x:7000,hp:8}}];
  g.state.skill={type:'object',initial:{charges:1,bonus:0,active:false,used:0}};g.inputs.actions.push({id:'skill',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'KeyK'}}]});
  g.rules=[{id:'upgrade-bonus',on:{type:'input.action',action:'upgrade',edge:'press'},if:op('eq',s('/skill/active'),k(false)),do:[{op:'state.set',path:'/skill/bonus',value:s('/economy/plots/0/level')}]},{id:'upgrade-during-skill',on:{type:'input.action',action:'upgrade',edge:'press'},if:s('/skill/active'),do:[{op:'state.set',path:'/skill/bonus',value:op('add',s('/economy/plots/0/level'),k(4))}]},{id:'skill-cast',on:{type:'input.action',action:'skill',edge:'press'},if:op('and',op('gt',s('/skill/charges'),k(0)),op('eq',s('/skill/active'),k(false))),do:[{op:'state.add',path:'/skill/charges',value:-1},{op:'state.add',path:'/skill/used',value:1},{op:'state.set',path:'/skill/active',value:true},{op:'state.set',path:'/skill/bonus',value:op('add',s('/economy/plots/0/level'),k(4))},{op:'timer.schedule',id:'skill-end',delayTicks:40,eventType:'skill.expired'}]},{id:'skill-expire',on:{type:'skill.expired'},do:[{op:'state.set',path:'/skill/active',value:false},{op:'state.set',path:'/skill/bonus',value:s('/economy/plots/0/level')}]}];
  for(const cap of ['a2game.core.timer','a2game.rules.timer-schedule'])if(!g.requires.all.some(r=>r.id===cap))g.requires.all.push(ref(cap));
  world.heldMovement=true;world.actions={left:'moveLeft',right:'moveRight',up:'moveUp',down:'moveDown'};for(const [action,code] of [['moveLeft','KeyA'],['moveRight','KeyD'],['moveUp','KeyW'],['moveDown','KeyS']])g.inputs.actions.push({id:action,valueType:'button',bindings:[{source:'keyboard.button',config:{code,hold:true}}]});
  positive=[a('upgrade'),a('skill',200)];negative=[a('upgrade',230)];options={...options,negativeExpected:'lost',checks:[{path:'/world/score',equals:3},{path:'/skill/used',equals:1},{path:'/skill/active',equals:false},{path:'/skill/bonus',equals:1}],hint:'WASD 移动，U 升级、K 释放一次性增伤；技能 40 Tick 后恢复升级伤害，抵御三波追踪敌群。'};
  g.presentation.hud=[{id:'survival',kind:'text',bind:{text:{template:'击退 {0}/3 · 技能 {1} · 增伤 {2}\n剩余技能 {3}',args:['/world/score','/skill/active','/skill/bonus','/skill/charges'].map(s)}}}];
 }
 if(id==='G20'){
  g.scenes[0].entities[0].components[0].config.trajectoryPreview=true;positive=[a('aim',1,point(-900,3500)),a('fire',220)];negative=[a('fire',100)];options={...options,negativeExpected:'lost',checks:[{path:'/bubble/score',equals:4},{path:'/bubble/bounces',equals:1}],hint:'拖动瞄准，瞄准点显示预计轨迹；向左墙反弹后吸附同色簇，悬空泡泡会脱落。'};
 }
 if(id==='G22'){
  g.inputs.traceRecording='user-opt-in';
  const c=g.scenes[0].entities[0].components[0].config;c.products[0].durationTicks=120;c.goalScore=2;positive=[a('plant'),wait(120),a('collect'),a('collect'),a('plant'),wait(120),a('collect')];negative=[a('plant'),wait(118),a('collect')];options={...options,negativeChecks:[{path:'/economy/score',equals:0}],hint:'两秒成熟后收获，共完成两轮。提前/重复收获无奖励；暂停与回放存档恢复保持成熟时刻。'};
 }
 if(id==='H05'){
  g.state.remaining={type:'int',initial:1200};g.rules.find(r=>r.id==='start-timer').do.push({op:'timer.schedule',id:'countdown',delayTicks:1,periodTicks:1,eventType:'level.second'});g.rules.push({id:'countdown',on:{type:'level.second'},if:op('gt',s('/remaining'),k(0)),do:[{op:'state.add',path:'/remaining',value:-1}]});
  options={...options,nativePointerActions:['cell0','cell1','cell2','cell3'],hint:'把苹果和钥匙拖到相邻空位，20 秒内与右侧目标一致；暂停冻结倒计时。'};
 }
 return {positive,negative,options};
}
export function decorateHiddenObjects(g){
 const stage=g.presentation.scene2d,board=stage.repeat.find(r=>r.id==='board'),targets=stage.repeat.find(r=>r.id==='targets'),assets=read('project/asset-policy.json').entries.filter(r=>r.uri.startsWith('assets/hidden-'));g.assets=Object.fromEntries(assets.map(r=>[r.uri.includes('apple')?'apple':'key',{uri:r.uri,type:r.type,integrity:r.integrity}]));
 for(const id of ['a2game.visual.stage','a2game.visual.bound-stage'])if(!g.requires.all.some(r=>r.id===id))g.requires.all.push(ref(id));
 const at=(r,i)=>[r.origin[0]+i%r.columns*r.step[0],r.origin[1]-Math.floor(i/r.columns)*r.step[1]],nodes=[];g.state.objects={type:'object',initial:{}};
 for(const [asset,value,index,target] of [['apple',1,0,1],['key',2,2,3]]){
  const [x,y]=at(board,index);g.state.objects.initial[asset]={x,y};nodes.push({id:asset,kind:'sprite',asset,at:[{state:'/objects/'+asset+'/x'},{state:'/objects/'+asset+'/y'},0],size:[.55,.55,.01],color:'#ffffff'});const goal=at(targets,target);nodes.push({id:asset+'-target',kind:'sprite',asset,at:[...goal,0],size:[.55,.55,.01],color:'#ffffff'});
  for(let i=0;i<4;i++){const p=at(board,i);g.rules.push({id:asset+'-at-'+i,on:{type:'puzzle.changed'},if:op('eq',s('/puzzle/board/'+i),k(value)),do:[{op:'state.set',path:'/objects/'+asset+'/x',value:p[0]},{op:'state.set',path:'/objects/'+asset+'/y',value:p[1]}]});}
 }
 for(const [label,r] of [['item',board],['target',targets]])for(let i=0;i<4;i++){const [x,y]=at(r,i);for(const [n,dx,dy,w,h] of [['t',0,.34,.7,.018],['b',0,-.34,.7,.018],['l',-.34,0,.018,.7],['r',.34,0,.018,.7]])stage.nodes.push({id:label+'-'+i+'-'+n,kind:'rect',at:[x+dx,y+dy],size:[w,h],fill:'#596e86'});}
 stage.repeat=[];g.presentation.stage={bindingProfile:'numeric-pointer-v1',camera:{projection:'orthographic',at:[0,0,10],target:[0,0,0],near:.1,far:20,fov:45,orthoHeight:stage.height,fitSize:[stage.width,stage.height]},nodes};g.presentation.hud=[{id:'time',kind:'text',bind:{text:{template:'剩余 Tick {0} / 1200 · 移动 {1}',args:[s('/remaining'),s('/puzzle/moves')]}}}];
}
