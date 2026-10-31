/** Authoring-time layouts only. Renderers still consume the same generic PresentationFrame. */
import {rotatePolyomino} from '../dist/modules/puzzle.js';
export function polishGameplayPresentation(game,id,title,variant=false){
 const stage=game.presentation.scene2d;stage.nodes=stage.nodes.filter(n=>!n.id.startsWith('gameplay-'));const nodes=stage.nodes;
 const header=nodes.find(n=>n.id==='title');if(header)header.text={literal:id+' '+title+(variant?' · 变体':'')};
 const hint=nodes.find(n=>n.id==='hint');if(hint?.text?.literal?.length>56)hint.text.literal=hint.text.literal.slice(0,55)+'…';
 const rect=(name,at,size,fill)=>({id:'gameplay-'+name,kind:'rect',at,size,fill});
 const text=(name,at,value,fontSize=0.2)=>({id:'gameplay-'+name,kind:'text',at,fontSize,fill:'#b5cee8',text:{literal:value}});
 const behind=(...rows)=>nodes.unshift(...rows);
 if(id==='G02'){
  stage.nodes=nodes.filter(n=>n.id!=='caption');const best=stage.nodes.find(n=>n.id==='best');best.at=[2.6,2.55];best.fontSize=0.3;
  stage.repeat.find(r=>r.id==='tiles').template.find(n=>n.id==='value').fontSize=0.3;
 }
 if(['G08','G09','G10','G26','H05'].includes(id)){
  const board=stage.repeat.find(r=>r.id==='board');board.template.find(n=>n.id==='tile').fill.map['-1']='#243851';
  const puzzle=game.scenes[0].entities.flatMap(e=>e.components).find(c=>c.config.targets);
  if(puzzle){
   if(id==='G26'){board.origin=[-2.6,-1.2];const selected=stage.repeat.find(r=>r.id==='selection');if(selected)selected.origin=[...board.origin];}
   let targets=stage.repeat.find(r=>r.id==='targets');
   if(!targets){targets=structuredClone(board);targets.id='targets';stage.repeat.push(targets);}
   targets.source={literal:[...puzzle.config.targets]};targets.origin=id==='G26'?[1.8,-1.2]:[2,0.5];
   for(const action of game.inputs.actions){const index=puzzle.config.selectActions.indexOf(action.id);if(index<0)continue;
    for(const binding of action.bindings)if(binding.source==='touch.select'){binding.config.x=board.origin[0]+index%board.columns*board.step[0];binding.config.y=board.origin[1]-Math.floor(index/board.columns)*board.step[1];}
   }
  }
 }
 if(id==='G09'){
  const p=game.state.puzzle.initial,c=game.scenes[0].entities[0].components[0].config,shape=rotatePolyomino(c.pieces[p.active],p.rotation);
  p.display=p.board.map(value=>value||-1);p.preview=shape.map(([x,y])=>y*4+x);
  for(const [x,y] of shape)p.display[(Math.floor(p.anchor/c.width)+y)*c.width+p.anchor%c.width+x]=7;
  const board=stage.repeat.find(r=>r.id==='board');board.origin=[-1.65,1.9];board.step=[0.55,0.55];board.template[0].size=[0.5,0.5];board.template=board.template.filter(node=>node.id!=='value');
  const selected=stage.repeat.find(r=>r.id==='selection');selected.origin=[...board.origin];selected.step=[...board.step];
  const preview=stage.repeat.find(r=>r.id==='preview');preview.origin=[1.15,0.8];preview.step=[0.35,0.35];
  nodes.push(text('piece-label',[1.7,1.5],'当前拼块'));
  game.presentation.hud=[{id:'falling',kind:'text',bind:{text:{template:'消行 {0}/'+c.targetScore+' · 锁定 {1}/'+c.pieces.length,args:[{state:'/puzzle/score'},{state:'/puzzle/moves'}]}}}];
 }
 if(id==='G12'){
  stage.bodyLayer.circleKinds=['actor','projectile'];const c=game.scenes[0].entities[0].components[0].config;
  game.presentation.hud=[{id:'gates',kind:'text',bind:{text:{template:'通过 {0}/'+c.goalScore,args:[{state:'/world/score'}]}}}];
 }
 if(id==='G11'){
  const layer=stage.bodyLayer;
  for(const b of game.state.world.initial.bodies.filter(b=>b.kind==='solid')){
   nodes.push(rect('center-'+b.id,[layer.origin[0]+b.x/1000,layer.origin[1]+1.03],[0.2,0.04],'#f5d26f'));
  }
  game.presentation.hud=[{id:'jump',kind:'text',bind:{text:{template:'平台 {0}/2 · 连击 {1} · 得分 {2}\n蓄力 {3} · 落点偏移 {4}',args:['/jump/landings','/jump/combo','/jump/score','/world/charge','/jump/lastOffset'].map(state=>({state}))}}}];
 }
 if(id==='G24')game.presentation.hud=[{id:'turn',kind:'text',bind:{text:{template:'玩家 {0} · 步数 {1}\n胜方 {2} · 和棋 {3}',args:['/turn/player','/turn/moves','/turn/winner','/turn/draw'].map(state=>({state}))}}}];
 if(['G13','H03'].includes(id)){
  behind(rect('road',[0,0],[6.8,5.6],'#17273c'),...[-3,-1,1,3].map((x,i)=>rect('lane-'+i,[x,0],[0.025,5.6],'#35465e')));
  stage.bodyLayer.circleKinds=['actor','projectile'];
  game.presentation.hud=[{id:'runner',kind:'text',bind:{text:{template:'检查点 {0}/2'+(id==='H03'?' · 击退 {1} · 弹丸 {2}':''),args:(id==='H03'?['/runner/checkpoints','/runner/kills','/world/nextId']:['/runner/checkpoints']).map(state=>({state}))}}}];
 }
 if(id==='G06'){
  const board=stage.repeat.find(r=>r.id==='board'),c=game.scenes[0].entities[0].components[0].config;
  const tile=board.template.find(n=>n.id==='tile');board.source={literal:[]};board.template=board.template.filter(n=>n.id!=='value');
  const glyph={up:'↑',down:'↓',left:'←',right:'→'};
  for(const [i,d] of c.directions.entries()){
   const at=[board.origin[0]+i%3*board.step[0],board.origin[1]-Math.floor(i/3)*board.step[1]];
   nodes.push(rect('tile-'+i,at,tile.size,{from:{state:'/puzzle/board/'+i},map:{0:'#243851',1:'#57d7c8'},fallback:'#243851'}),{...text('arrow-'+i,at,glyph[d],0.42),fill:{from:{state:'/puzzle/board/'+i},map:{0:'#243851',1:'#ffffff'},fallback:'#ffffff'}});
  }
 }
 if(id==='G19')game.presentation.hud=[{id:'horde',kind:'text',bind:{text:{template:'击退 {0} · 金币 {1} · 升级 {2}',args:[{state:'/world/score'},{state:'/economy/wallet'},{state:'/economy/plots/0/level'}]}}}];
 if(id==='G20'){
  game.presentation.hud=[{id:'bubble',kind:'text',bind:{text:{template:'得分 {0} · 弹药 {1}',args:[{state:'/bubble/score'},{state:'/bubble/ammo'}]}}}];
  const p=game.state.bubble.initial,c=game.scenes[0].entities[0].components[0].config;
  p.visuals=p.board.flatMap((value,index)=>value?[{id:'bubble_'+index,kind:'target',x:c.originX+index%c.columns*c.cellSize,y:c.topY-Math.floor(index/c.columns)*c.cellSize,hx:c.cellSize*0.44,hy:c.cellSize*0.44,value}]:[]);
  p.visuals.push({id:'launcher',kind:'actor',x:c.launchX,y:c.launchY,hx:c.radius??160,hy:c.radius??160,value:p.color});
 }
 if(id==='G23'){
  for(let i=nodes.length-1;i>=0;i--)if(['wallet','score'].includes(nodes[i].id))nodes.splice(i,1);
  game.presentation.hud=[{id:'economy',kind:'text',bind:{text:{template:'金币 {0} · 得分 {1} · 工厂等级 {2}',args:[{state:'/economy/wallet'},{state:'/economy/score'},{state:'/economy/plots/0/level'}]}}}];
  const grid=stage.repeat.find(r=>r.id==='grid');grid.origin=[-1.9,0.4];
  nodes.find(n=>n.id==='plot').at=[1.6,0];
  behind(rect('factory',[1.6,0],[1.6,1.3],'#17273c'));
  nodes.push({...rect('factory-light',[1.6,0.9],[0.25,0.25],'#35465e'),fill:{from:{state:'/factoryUnlocked'},map:{false:'#35465e',true:'#57d7c8'},fallback:'#35465e'}},text('factory-label',[1.6,1.5],'合成解锁工厂'),text('grid-label',[-1.45,1.5],'选择 → 合成'));
 }
 if(id==='H02'){
  game.presentation.hud=[{id:'upgrade',kind:'text',bind:{text:{template:'消除 {0} · 金币 {1} · 等级 {2}\n下次伤害 {3} · 上次命中 {4} · 敌人生命 {5}',args:['/puzzle/score','/economy/wallet','/economy/plots/0/level','/combat/nextDamage','/combat/lastDamage','/combat/targetHP'].map(state=>({state}))}}}];
  nodes.push(text('battle-label',[2.5,1.8],'敌人'),{...text('target-hp',[2.5,0.5],''),text:{state:'/combat/targetHP'}},text('hero-label',[2.5,-1.9],'角色 · Space 攻击'));
 }
 if(id==='H01'){
  header.at=[0,3.25];header.fontSize=0.6;header.text.literal=variant?'炮台保卫战 · 变体':'炮台保卫战';
  hint.at=[0,-3.35];hint.fontSize=0.5;hint.text.literal=variant?'合成后用奖励升级':'先建塔，再选择并合成';
  for(const node of nodes)if(node.id.startsWith('slot-label'))node.fontSize=0.5;
 }
 if(id==='G14')stage.bodyLayer.circleKinds=['actor','projectile','pickup'];
 if(id==='G15'&&!game.state.rigid){const c=game.scenes[0].entities.flatMap(e=>e.components).find(c=>c.config.constraints).config.constraints[0],left=c.minX/1000-4,right=c.maxX/1000-4;behind(rect('playfield',[(left+right)/2,0],[right-left,5.6],'#17273c'),rect('rail-left',[left,0],[0.04,5.6],'#35465e'),rect('rail-right',[right,0],[0.04,5.6],'#35465e'));}
 if(['G16','G28','H04'].includes(id)&&!game.state.rigid){
  behind(rect('drop-area',[0,-0.25],[8,5.5],'#17273c'),rect('floor',[0,-3],[8,0.05],'#a8c5d9'));
  if(id!=='H04')nodes.push(text('drop-label',[0,2.6],id==='G28'?'逐个放置并保持逻辑平衡':'拖动选位置，点击放下球体'));
  if(id==='G28')game.presentation.hud=[{id:'balance',kind:'text',bind:{text:{template:'倾角 {0} · 稳定 Tick {1}\n已放置 {2}',args:[{state:'/control/angle'},{state:'/control/balanceTicks'},{state:'/control/spawned'}]}}}];
 }
 if(id==='G29'){
  delete stage.repeat;stage.nodes=nodes.filter(n=>['title','hint'].includes(n.id));
  stage.nodes.push({id:'gameplay-energy',kind:'circle',at:[0,0],radius:1,fill:{from:{state:'/economy/wallet'},map:{0:'#35465e',1:'#4b9bd5',2:'#ecb963',3:'#57d7c8',4:'#57d7c8'},fallback:'#57d7c8'}},{id:'gameplay-energy-value',kind:'text',at:[0,0],fontSize:0.8,fill:'#ffffff',text:{state:'/economy/wallet'}},text('energy-label',[0,1.5],'能量'),text('unlock-label',[0,-1.5],'能量足够后点击 unlock'));
  game.presentation.hud=[{id:'energy',kind:'text',bind:{text:{template:'能量 {0} · 摇动 {1}',args:[{state:'/economy/wallet'},{state:'/shakes'}]}}}];
 }
 if(id==='G30')behind(rect('launcher',[-2,-1.95],[0.16,0.7],'#a8c5d9'));
 if(id==='H03'){
  const swapped=game.rules.find(r=>r.id==='left-zone').do[0].path==='/control/fireRequest';
  nodes.push(text('left-zone-label',[-3.5,-2.8],swapped?'开火':'左移'),text('middle-zone-label',[-0.75,-2.8],swapped?'左移':'右移'),text('right-zone-label',[3.5,-2.8],swapped?'右移':'开火'));
 }
}
