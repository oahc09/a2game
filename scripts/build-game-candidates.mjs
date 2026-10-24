/** Individually authored bounded introductory/endgame levels. These are candidates, never G3/physical receipts. */
import {readFileSync,writeFileSync} from 'node:fs';
import {initialControlState} from '../dist/index.js';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n'),ref=id=>({id,version:'0.1.0'});
const registry=read('specs/v0.1/samples/coverage/games.json'),base=read('specs/v0.1/samples/games/tap-target.game.json'),puzzles=read('project/puzzle-reference-cases.json').cases;
const records=[],s=state=>({state}),k=value=>({const:value}),op=(op,...args)=>({op,args}),eq=(path,v)=>op('eq',s(path),k(v)),gte=(path,v)=>op('gte',s(path),k(v));
const button=(id,code='Space',source,config={})=>({id,valueType:'button',bindings:[{source:'keyboard.button',config:{code}},...(source?[{source,config}]:[])]});
const sensor=(id,source,valueType,config={})=>({id,valueType,bindings:[{source,config}]});
const act=(action,ticks=1,value)=>({action,ticks,...(value!==undefined?{value}:{})}),wait=ticks=>({ticks});
const press=(action,value)=>({action,phase:'press',...(value!==undefined?{value}:{})}),release=action=>({action,phase:'release'});
const point=(x,y)=>[(x/1000-4)/10+0.5,0.5-(y/1000-3)/8];
const raw=(kind,id,u,v)=>({source:'pointer',kind,payload:{pointerId:id,u,v,viewportAspect:1.25}});
const pointer=(kind,x,y,id=1,ticks=1)=>({raw:[raw(kind,id,...point(x,y))],ticks});
const body=(id,kind,x,y,extra={})=>({id,kind,x,y,vx:0,vy:0,hx:100,hy:100,hp:1,team:kind==='actor'?1:2,value:1,fixed:false,...extra});
const world=bodies=>({bodies,score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false});
const palette={actor:'#57d7c8',solid:'#a8c5d9',target:'#dc6d78',projectile:'#f5d26f',pickup:'#bd86d9'},values={'1':'#57d7c8','2':'#ecb963','4':'#bd86d9','8':'#dc6d78'};
function cap(g,...ids){g.requires.all=[...new Map([...g.requires.all,...ids.map(ref)].map(r=>[r.id,r])).values()];}
function fresh(){const g=structuredClone(base);g.requires={all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.core.goal','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text'].map(ref)};g.state={};g.inputs={actions:[]};g.scenes=[{id:'main',entities:[{id:'controller',components:[]}]}];g.rules=[];g.outcomes=[];g.presentation={hud:[],cues:[],scene2d:{width:10,height:8,background:'#0d1729',nodes:[]}};return g;}
const component=(g,id,config)=>{cap(g,id);g.scenes[0].entities[0].components.push({capability:ref(id),config});};
const field=(g,name,initial,type='object')=>g.state[name]={type,initial};
function renderWorld(g,path='/world/bodies'){cap(g,'a2game.visual.body-style');g.presentation.scene2d.bodyLayer={statePath:path,unitsPerMeter:1000,origin:[-4,-3],palette,circleKinds:['actor','target','projectile','pickup'],valuePalette:values,showValues:true};}
function physical(bodies,options={}){const g=fresh();field(g,'world',world(bodies));component(g,'a2game.realtime.world',{statePath:'/world',width:8000,height:6000,...options});renderWorld(g);g.outcomes=[{id:'won',status:'won',when:s('/world/won')},{id:'lost',status:'lost',priority:-1,when:s('/world/lost')}];return g;}
function controller(g,options={}){if(!g.state.control)field(g,'control',initialControlState());component(g,'a2game.realtime.input-control',{statePath:'/control',worldPath:'/world',width:8000,height:6000,sceneWidth:10,sceneHeight:8,origin:[-4,-3],...options});}
function outcome(g,path='/control/won',lost='/control/lost'){g.outcomes=[{id:'complete',status:'won',when:s(path)},{id:'failed',status:'lost',priority:-1,when:s(lost)}];}
function addInput(g,input){g.inputs.actions.push(input);for(const b of input.bindings)cap(g,'a2game.input.'+b.source);}
function actionRule(g,id,action,effects,condition){g.rules.push({id,on:{type:'input.action',action,edge:'press'},...(condition?{if:condition}:{}),do:effects});}
function timer(g,ticks){field(g,'started',false,'bool');field(g,'timeout',false,'bool');component(g,'a2game.core.bootstrap',{startedPath:'/started'});cap(g,'a2game.core.timer','a2game.rules.timer-schedule','a2game.rules.state-set');g.rules.push({id:'start-timer',on:{type:'level.started'},do:[{op:'timer.schedule',id:'deadline',delayTicks:ticks,eventType:'level.timeout'}]},{id:'time-expired',on:{type:'level.timeout'},do:[{op:'state.set',path:'/timeout',value:true}]});g.outcomes.push({id:'timeout',status:'lost',priority:-2,when:s('/timeout')});}
function touchCells(g,mode='tap'){
 const repeats=g.presentation.scene2d.repeat??[];
 for(const action of g.inputs.actions){const m=action.id.match(/^cell(\d+)$/);if(!m)continue;const index=Number(m[1]),repeat=repeats.find(row=>['board','grid'].includes(row.id));if(!repeat)continue;
  action.bindings.push({source:'touch.select',config:{sceneWidth:g.presentation.scene2d.width,sceneHeight:g.presentation.scene2d.height,x:repeat.origin[0]+(index%repeat.columns)*repeat.step[0],y:repeat.origin[1]-Math.floor(index/repeat.columns)*repeat.step[1],hx:repeat.step[0]*0.45,hy:repeat.step[1]*0.45,mode}});
 }
 cap(g,'a2game.input.touch.select','a2game.input.touch.raw');
}
function cloneGame(name){const g=read(`specs/v0.1/samples/games/${name}.game.json`);delete g.inputs.traceRecording;return g;}
function noUndo(g){for(const e of g.scenes[0].entities)for(const c of e.components){delete c.config.undoAction;delete c.config.historyPath;}g.inputs.actions=g.inputs.actions.filter(a=>a.id!=='undo');}
function write(id,g,positive,negative,options={}){
 const entry=registry.games.find(row=>row.id===id),title=entry?.name??options.title;g.id='org.a2game.games.'+id.toLowerCase();g.revision=1;g.meta={title:`${id} ${title}`,genres:entry?.taxonomy.genres??['casual'],description:options.hint??'独立单关候选；完成目标后重开。参考物理与关卡范围见候选回执。'};
 if(entry){cap(g,...entry.requiredCapabilities.all.map(r=>r.id));for(const group of entry.requiredCapabilities.anyOf??[])for(const r of group)cap(g,r.id);}
 for(const rule of g.rules)for(const effect of rule.do)cap(g,'a2game.rules.'+effect.op.replace('.','-'));
 const name=id.toLowerCase()+'-candidate';g.tests=[`../tests/${name}.conformance.json`];
 const stage=g.presentation.scene2d;stage.nodes=stage.nodes.filter(n=>!['title','hint'].includes(n.id));stage.nodes.push({id:'title',kind:'text',at:[0,stage.height/2-0.4],fontSize:0.26,fill:'#b5cee8',text:{literal:g.meta.title}},{id:'hint',kind:'text',at:[0,-stage.height/2+0.35],fontSize:0.14,fill:'#9fb8d2',text:{literal:g.meta.description}});
 if(!g.presentation.hud.length)g.presentation.hud.push({id:'goal',kind:'text',bind:{text:{literal:options.hint??g.meta.title}}});
 save(`specs/v0.1/samples/games/${name}.game.json`,g);
 const convert=rows=>rows.flatMap(row=>[...(row.action?[{op:'injectAction',action:row.action,phase:'press',...(row.value!==undefined?{value:row.value}:{})},{op:'injectAction',action:row.action,phase:'release'}]:[]),...(row.actions??[]).map(a=>({op:'injectAction',...a})),...(row.raw??[]).map(raw=>({op:'injectRaw',raw})),...(row.pause?[{op:'pause'}]:[]),{op:'step',ticks:row.ticks??1},...(row.resume?[{op:'resume'}]:[])]);
 const cases=[{id:'COVERAGE-'+id+'-POSITIVE',seed:42,steps:[{op:'start'},...convert(positive),...(options.checks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals})),{op:'assert',path:'/flow/status',equals:options.expected??'won'},{op:'restart'},{op:'assert',path:'/tickIndex',equals:0}]},{id:'COVERAGE-'+id+'-NEGATIVE',seed:42,steps:[{op:'start'},...convert(negative),...(options.negativeChecks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals})),{op:'assert',path:'/flow/status',equals:options.negativeExpected??'playing'}]}];
 save(`specs/v0.1/samples/tests/${name}.conformance.json`,{format:'a2game-conformance',specVersion:'0.1.0',suiteId:name,subject:{type:'game',id:g.id,file:`../games/${name}.game.json`},cases});
 records.push({id,name,title,steps:positive,negative,expected:options.expected??'won',negativeExpected:options.negativeExpected??'playing',checks:options.checks??[],negativeChecks:options.negativeChecks??[],scope:options.scope??'Bounded introductory/endgame reference level; commercial-game quality and general variants are independent.',gates:{G0:'NOT_RUN',G1:'NOT_RUN',G2:'NOT_RUN',G3:'NOT_RUN',physical:entry?.inputs.some(i=>i.startsWith('imu.')||i==='touch.multi-hold')?'NOT_RUN':'NOT_APPLICABLE'},verified:false});
}
// G01-G10: individual boards, hidden layers, target slots and touch selection.
{
 const g=cloneGame('puzzle-push-undo');write('G01',g,[act('moveRight'),act('moveUp')],[act('moveLeft')],{hint:'方向键或滑动，把箱子推入目标；undo 撤销。'});
}
{
 const g=cloneGame('puzzle-slide-undo');g.state.board.initial=[512,512,1024,0,...Array(12).fill(0)];g.state.best.initial=1024;g.state.goal.initial=2048;write('G02',g,[act('moveLeft'),act('moveLeft')],[act('moveUp')],{hint:'2048 终盘挑战：方向键或滑动合并，达到 2048。'});
}
for(const [id,name] of [['G03','puzzle-match'],['G04','puzzle-tray'],['G05','puzzle-mahjong'],['G06','puzzle-arrows'],['G07','puzzle-memory'],['G08','puzzle-polyomino'],['G09','puzzle-falling'],['G10','puzzle-placement']]){
 const g=cloneGame(name),recipe=puzzles.find(r=>r.name===name);let positive=recipe.solve.map(a=>act(a)),negative=(recipe.invalid.length?recipe.invalid:['undo']).map(a=>act(a)),options={hint:'点选棋盘或右侧 cell 按钮；按行从 0 编号，undo 撤销。'};
 if(id==='G07')g.scenes[0].entities[0].components[0].config.closeTicks=60;
 if(id==='G09'){g.state.puzzle.initial.board.splice(12,4,0,0,1,1);g.state.puzzle.initial.display.splice(12,4,-1,-1,1,1);positive=['left','left','drop'].map(a=>act(a));negative=[act('drop')];options.negativeExpected='lost';options.hint='left/right 移动，rotate 旋转，drop 下落并填满底行。';}
 if(id==='G10'){const r=structuredClone(g.presentation.scene2d.repeat[0]);r.id='targets';r.source={literal:[0,1,0,2]};r.origin=[2,0.5];g.presentation.scene2d.repeat.push(r);options.hint='先点物品，再点目标槽；右侧小格显示目标编号。';}
 touchCells(g,['G03','G10'].includes(id)?'drag-select':'tap');write(id,g,positive,negative,options);
}
// G11-G19: different bounded worlds, all simulated by the same integer physics/combat modules.
{
 const g=physical([body('hero','actor',1000,1100),body('platform_a','solid',1000,800,{hx:700,hy:200,fixed:true}),body('platform_b','solid',4000,800,{hx:700,hy:200,fixed:true}),body('goal','pickup',4000,1250,{hx:250,hy:250,fixed:true})],{gravity:-4,jumpSpeed:96,jumpHorizontalSpeed:64,killBelowY:600,goalScore:1,maxTicks:300,actions:{charge:'charge'}});addInput(g,button('charge','Space','touch.long-press',{minTicks:2}));write('G11',g,[wait(1),{actions:[press('charge'),release('charge')],ticks:60}],[wait(300)],{negativeExpected:'lost',hint:'按住 Space 或长按画布蓄力，松开跳到下一平台。'});
}
{
 const g=physical([body('hero','actor',1000,3000,{vx:64}),...['a','b'].map((id,i)=>body('gate_'+id,'pickup',2100+i*2000,3000,{hy:600,fixed:true}))],{gravity:-4,allowAirJump:true,jumpSpeed:64,goalScore:2,killBelowY:500,maxTicks:180,actions:{jump:'flap'}});addInput(g,button('flap','Space','touch.tap'));write('G12',g,[act('flap',31),act('flap',31)],[wait(180)],{negativeExpected:'lost',hint:'点击或 Space 拍翼，穿过两道门；坠落失败。'});
}
{
 const g=physical([body('hero','actor',3000,1000),body('obstacle','target',3000,5000,{vy:-64,fixed:false})],{laneWidth:2000,goalTick:100,maxTicks:120,actions:{laneLeft:'left',laneRight:'right'}});addInput(g,button('left','ArrowLeft','touch.swipe',{direction:'left'}));addInput(g,button('right','ArrowRight','touch.swipe',{direction:'right'}));write('G13',g,[act('left',100)],[wait(100)],{negativeExpected:'lost',hint:'左右滑动或方向键换道，躲过障碍后抵达终点。'});
}
{
 const g=physical([body('ball','actor',2000,3500,{vy:-64}),body('paddle','solid',4000,400,{hx:650,hy:100,fixed:true}),body('brick','target',2000,4800,{hx:700,hy:150,fixed:true})],{restitution:1000,damageTargetsOnContact:true,goalScore:1,killBelowY:200,maxTicks:240});controller(g,{bodyId:'paddle',moveMode:'drag',dragAction:'drag'});addInput(g,sensor('drag','touch.drag','vec2'));write('G14',g,[pointer('down',4000,400),pointer('move',2000,400,1,130)],[wait(240)],{negativeExpected:'lost',hint:'拖动挡板接住球，反弹击碎上方砖块；球落底失败。'});
}
{
 const g=physical([body('ball','actor',4000,1000),body('trigger','pickup',4000,2200,{hy:180,fixed:true})],{gravity:-4,allowAirJump:true,jumpSpeed:128,goalScore:1,killBelowY:600,maxTicks:160,restitution:800,constraints:[{body:'ball',minX:1000,maxX:7000,minY:0,maxY:6000}],actions:{jump:'kick'}});addInput(g,button('kick','Space','touch.tap'));write('G15',g,[act('kick',20)],[wait(160)],{negativeExpected:'lost',hint:'点击弹射小球，触发上方奖励区；本关使用轴对齐边界。'});
}
{
 const g=physical([],{gravity:-16,merge:true,goalScore:4,maxTicks:300});controller(g,{spawnAction:'drop',dragAction:'drag',spawnY:5000,spawnValue:2,spawnHalfSize:160});addInput(g,button('drop','Space','touch.tap'));addInput(g,sensor('drag','touch.drag','vec2'));write('G16',g,[act('drop',60),act('drop',60)],[act('drop',60)],{hint:'拖动选择横向位置，点击 drop 放球；相同数字接触合成。'});
}
{
 const g=physical([body('hero','actor',4000,1000)],{weapon:'projectile',fireDirection:'up',projectileSpeed:128,goalScore:1,maxTicks:200,actions:{fire:'fire'},waves:[{tick:0,body:body('enemy','target',2500,4500,{fixed:true,hx:300,hy:300})}]});controller(g,{bodyId:'hero',moveMode:'drag',dragAction:'drag'});addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,button('fire','Space'));write('G17',g,[pointer('down',4000,1000),pointer('move',2500,1000,1,16),act('fire',60)],[act('fire',200)],{negativeExpected:'lost',hint:'拖动飞机对准敌机，Space 或 fire 发射；限时击落目标。'});
}
{
 const g=physical([body('hero','actor',4000,2000),body('enemy','target',4000,4500,{fixed:true,hx:300,hy:300})],{weapon:'hitscan',aimPath:'/control/aim',goalScore:1,maxTicks:120,actions:{fire:'fire'}});controller(g,{bodyId:'hero',dragAction:'aim',aimFromDrag:true});addInput(g,sensor('aim','touch.drag','vec2'));addInput(g,button('fire','Space'));write('G18',g,[act('aim',1,point(4000,4500)),act('fire')],[act('fire',120)],{negativeExpected:'lost',hint:'拖动瞄准，Space 或 fire 射击；射线会被实体墙遮挡。'});
}
{
 const g=physical([body('hero','actor',4000,2000),body('enemy','target',6000,2000,{hp:2})],{weapon:'hitscan',autoFire:true,autoTarget:true,damageBonusPath:'/economy/plots/0/level',cooldownTicks:120,seekSpeed:16,goalScore:1,maxTicks:100});const eco=cloneGame('strategy-upgrade');field(g,'economy',eco.state.economy.initial);g.state.economy.initial.wallet=2;component(g,'a2game.strategy.economy-loop',{...eco.scenes[0].entities[0].components[0].config,goalScore:2});addInput(g,button('upgrade','KeyU'));addInput(g,button('plant','KeyP'));addInput(g,button('collect','KeyC'));write('G19',g,[act('upgrade')],[wait(100)],{negativeExpected:'lost',hint:'及时 upgrade 升级伤害；炮台自动瞄准追近的敌群。'});
}
{
 const g=fresh();field(g,'bubble',{board:[1,1,1,2,2,2,...Array(12).fill(0)],ammo:1,color:1,score:0,aim:[0,1],shot:{active:false,x:4000,y:500,vx:0,vy:0},won:false,lost:false,visuals:[]});component(g,'a2game.combat.bubble-grid',{statePath:'/bubble',columns:6,rows:3,cellSize:700,originX:1900,topY:4500,worldWidth:8000,worldHeight:6000,launchX:4000,launchY:500,colors:2,goalScore:4,fireAction:'fire',aimAction:'aim',sceneWidth:10,sceneHeight:8});renderWorld(g,'/bubble/visuals');addInput(g,sensor('aim','touch.drag','vec2'));addInput(g,button('fire','Space','touch.tap'));outcome(g,'/bubble/won','/bubble/lost');write('G20',g,[act('aim',1,point(2600,4500)),act('fire',100)],[act('fire',100)],{negativeExpected:'lost',hint:'拖动瞄准同色泡泡，点击 fire；本关一发，四邻接方格吸附。'});
}
{
 const g=cloneGame('puzzle-placement');noUndo(g);field(g,'world',world([body('hero','actor',1000,2000),body('enemy','target',5000,2000)]));field(g,'control',initialControlState());field(g,'path',{x:5000,y:2000,cursor:0,arrived:false});component(g,'a2game.strategy.path-follow',{statePath:'/path',worldPath:'/world',bodyId:'enemy',waypoints:[{x:1000,y:2000}],speed:16});component(g,'a2game.realtime.world',{statePath:'/world',width:8000,height:6000,weapon:'hitscan',autoTarget:true,fireRequestPath:'/control/fireRequest',goalScore:1,maxTicks:100});cap(g,'a2game.rules.state-set');g.rules=[{id:'placed-tower',on:{type:'puzzle.changed'},if:s('/puzzle/won'),do:[{op:'state.set',path:'/control/fireRequest',value:true}]}];g.outcomes=[{id:'won',status:'won',when:s('/world/won')},{id:'lost',status:'lost',when:s('/world/lost')}];touchCells(g,'drag-select');write('G21',g,['cell0','cell1','cell2','cell3'].map(a=>act(a)).concat(wait(1)),[wait(100)],{negativeExpected:'lost',hint:'整理四格解锁炮台，拦截沿路径前进的敌人。'});
}
{
 const g=cloneGame('strategy-farm');write('G22',g,[act('plant'),wait(2),act('collect')],[act('collect')],{hint:'plant 播种，等待两 Tick 后 collect 收获；暂停冻结生产。'});
}
{
 const g=cloneGame('strategy-merge'),c=g.scenes[0].entities[0].components[0].config;c.goalScore=3;c.actions.push({action:'plant',kind:'plant',item:'seed',index:0},{action:'collect',kind:'collect',index:0});addInput(g,button('plant','KeyP'));addInput(g,button('collect','KeyC'));write('G23',g,[act('plant'),act('select0'),act('merge1'),act('collect')],[act('collect'),act('select0')],{hint:'select0、merge1 合并店铺，再 plant、collect 完成生产目标。'});
}
{
 const g=cloneGame('strategy-turn'),c=g.scenes[0].entities[0].components[0].config;c.width=c.height=c.winLength=5;c.selectActions=Array.from({length:25},(_,i)=>'cell'+i);g.state.turn.initial.board=Array(25).fill(0);g.inputs.actions=c.selectActions.map((id,i)=>button(id,'Key'+String.fromCharCode(65+i)));const r=g.presentation.scene2d.repeat[0];r.columns=5;r.origin=[-1.4,1.4];r.step=[0.7,0.7];r.template[0].size=[0.64,0.64];touchCells(g);write('G24',g,[0,5,1,6,2,7,3,8,4].map(i=>act('cell'+i)),[act('cell0'),act('cell0')],{negativeChecks:[{path:'/turn/moves',equals:1},{path:'/turn/player',equals:2}],hint:'两人轮流点击空格，横竖斜连续五子获胜；占用格不换手。'});
}
{
 const g=physical([body('fruit_a','target',2500,3000,{fixed:true,hx:450,hy:450}),body('fruit_b','target',4000,3000,{fixed:true,hx:450,hy:450}),body('fruit_c','target',5500,3000,{fixed:true,hx:450,hy:450}),body('bomb','solid',4000,1000,{fixed:true,hx:400,hy:400})],{goalScore:3});controller(g,{pathAction:'slice',hazardIds:['bomb'],goalScore:3});addInput(g,sensor('slice','touch.path','pose'));outcome(g);write('G25',g,[pointer('down',1500,3000),pointer('move',6500,3000)],[pointer('down',3000,1000),pointer('move',5000,1000)],{negativeExpected:'lost',hint:'划过三枚水果，避开下方方形炸弹；重复命中只计一次。'});
}
{
 const g=cloneGame('puzzle-placement');noUndo(g);field(g,'world',world([]));controller(g,{rotateAction:'rotate',pinchAction:'pinch',targetAngle:Math.PI/2,targetScale:1.5});addInput(g,sensor('rotate','touch.rotate','axis1'));addInput(g,sensor('pinch','touch.pinch','axis1'));cap(g,'a2game.visual.stage','a2game.visual.bound-stage');g.presentation.stage={bindingProfile:'numeric-pointer-v1',camera:{projection:'orthographic',at:[0,0,8],target:[0,0,0],near:0.1,far:100,fov:45,orthoHeight:8},nodes:[{id:'piece',kind:'mesh',geometry:'box',at:[-1,0,0],rotation:[0,0,{state:'/control/angle'}],size:[{state:'/control/scale',scale:2},{state:'/control/scale',scale:0.3},0.2],color:'#57d7c8'},{id:'target',kind:'mesh',geometry:'box',at:[1.5,0,0],rotation:[0,0,Math.PI/2],size:[3,0.45,0.2],color:'#ecb963'}]};g.outcomes=[{id:'aligned-and-placed',status:'won',when:op('and',s('/control/won'),s('/puzzle/won'))}];touchCells(g,'drag-select');write('G26',g,[act('rotate',1,Math.PI/2),act('pinch',1,1.5),...['cell0','cell1','cell2','cell3'].map(a=>act(a))],[act('rotate',1,0.2),act('pinch',1,1.5)],{hint:'双指旋转与缩放左侧长条匹配右侧，再完成四格归位。'});
}
{
 const g=physical([body('hero','actor',1000,3000),body('wall','solid',4000,1800,{hx:200,hy:1700,fixed:true}),body('goal','pickup',6500,4500,{hx:300,hy:300,fixed:true})],{goalScore:1,maxTicks:500});controller(g,{bodyId:'hero',moveMode:'tilt',dragAction:'drag',tiltAction:'tilt'});addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,sensor('tilt','imu.tilt','vec2'));write('G27',g,[pointer('down',1000,3000),pointer('move',1000,4500,1,15),pointer('move',6500,4500,1,60)],[pointer('down',1000,3000),pointer('move',6500,3000,1,50)],{negativeChecks:[{path:'/world/bodies/1/x',equals:3700}],hint:'启用并校准传感器后倾斜；也可拖动圆点绕过墙到达目标。'});
}
{
 const g=physical([],{gravity:-16,restitution:0});controller(g,{spawnAction:'drop',dragAction:'drag',axisFromDrag:true,balance:true,balanceGoalTicks:60,minBalancedBodies:3,spawnY:5000,spawnHalfSize:200});addInput(g,button('drop','Space','touch.tap'));addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,sensor('tilt','imu.tilt','vec2'));g.scenes[0].entities[0].components.find(c=>c.capability.id==='a2game.realtime.input-control').config.tiltAction='tilt';outcome(g);write('G28',g,[act('drop',60),act('drop',60),act('drop',120)],[act('drag',1,point(7500,5000)),act('drop'),act('drop')],{negativeExpected:'lost',hint:'在中心逐个放下三块并保持平衡；拖动或倾斜调整，偏置过大失败。',scope:'Logical balance moment and AABB stack; general angular rigid-body placement remains outside this candidate.'});
}
{
 const g=cloneGame('strategy-shop');g.state.economy.initial.wallet=0;const c=g.scenes[0].entities[0].components[0].config;c.actions=[{action:'unlock',kind:'unlock',item:'license',cost:3}];g.inputs.actions=[button('unlock','KeyU')];addInput(g,button('shake','KeyJ','imu.shake',{cooldownTicks:3,thresholdMps2:10}));addInput(g,button('shakeFallback','Space','touch.tap'));field(g,'shakes',0,'int');cap(g,'a2game.rules.state-add');for(const a of ['shake','shakeFallback'])actionRule(g,'shake-'+a,a,[{op:'state.add',path:'/economy/wallet',value:1},{op:'state.add',path:'/shakes',value:1}]);g.outcomes=[{id:'unlocked',status:'won',when:eq('/economy/unlocked', ['license'])}];timer(g,300);write('G29',g,[act('shakeFallback'),act('shakeFallback'),act('shakeFallback'),act('unlock')],[act('shakeFallback'),act('unlock'),wait(301)],{negativeExpected:'lost',hint:'摇动三次积累能量，再 unlock；无传感器可点击 shakeFallback。'});
}
{
 const g=physical([body('hero','actor',2000,1500),body('target','target',5000,1500,{fixed:true,hx:300,hy:300})],{weapon:'projectile',aimPath:'/control/aim',powerPath:'/control/power',fireRequestPath:'/control/fireRequest',goalScore:1,maxTicks:160});controller(g,{rawAction:'pull',slingshot:true});addInput(g,sensor('pull','touch.raw','pose'));write('G30',g,[pointer('down',4000,1500),pointer('move',0,1500),pointer('up',0,1500,1,100)],[pointer('down',4000,1500),pointer('move',0,1500),pointer('cancel',0,1500,1,160)],{negativeExpected:'lost',hint:'向左拉开并松手，按拉力发射；取消或多指中断不会发射。'});
}
{
 const g=physical([body('hero','actor',4000,2000),body('target','target',4000,4500,{fixed:true,hx:300,hy:300})],{weapon:'hitscan',aimPath:'/control/aim',goalScore:1,maxTicks:120,actions:{fire:'fire'}});controller(g,{bodyId:'hero',orientationAction:'orientation',dragAction:'aim',aimFromDrag:true});addInput(g,sensor('orientation','imu.orientation','vec3'));addInput(g,sensor('aim','touch.drag','vec2'));addInput(g,button('fire','Space','touch.tap'));write('G31',g,[act('aim',1,point(4000,4500)),act('fire')],[act('fire',120)],{negativeExpected:'lost',hint:'启用、校准后调整姿态瞄准再点击射击；可拖动瞄准回退。'});
}
{
 const g=fresh();field(g,'opened',false,'bool');addInput(g,sensor('hold','touch.multi-hold','button',{fingers:2,minTicks:30}));cap(g,'a2game.rules.state-set');actionRule(g,'open-two-finger','hold',[{op:'state.set',path:'/opened',value:true}]);g.outcomes=[{id:'open',status:'won',when:s('/opened')}];timer(g,240);write('G32',g,[{raw:[raw('down',1,0.3,0.5),raw('down',2,0.7,0.5)],ticks:31}],[{raw:[raw('down',1,0.3,0.5)],ticks:241}],{negativeExpected:'lost',hint:'两指同时静止按住半秒，解开机关；单指无效，四秒超时。'});
}
// H01-H05 are independent definitions and state interactions, never aliases of Gxx receipts.
{
 const g=cloneGame('grid-merge-spawn');noUndo(g);g.state.board.initial=[2,2,...Array(14).fill(0)];g.state.goal.initial=2048;field(g,'world',world([body('hero','actor',1000,2000),body('enemy','target',5000,2000,{hp:5})]));field(g,'path',{x:5000,y:2000,cursor:0,arrived:false});component(g,'a2game.strategy.path-follow',{statePath:'/path',worldPath:'/world',bodyId:'enemy',waypoints:[{x:1000,y:2000}],speed:16});component(g,'a2game.realtime.world',{statePath:'/world',width:8000,height:6000,autoFire:true,autoTarget:true,weapon:'hitscan',damageBonusPath:'/best',cooldownTicks:120,goalScore:1,maxTicks:100});g.outcomes=[{id:'defended',status:'won',when:s('/world/won')},{id:'lost',status:'lost',when:s('/world/lost')}];write('H01',g,[act('moveLeft')],[wait(100)],{title:'合成炮台保卫战',negativeExpected:'lost',hint:'合并 2+2 提升本 Tick 炮台伤害，击退路径上的敌人。',checks:[{path:'/best',equals:4}]});
}
{
 const g=cloneGame('puzzle-match');noUndo(g);const eco=cloneGame('strategy-upgrade');field(g,'economy',eco.state.economy.initial);g.state.economy.initial.wallet=0;component(g,'a2game.strategy.economy-loop',eco.scenes[0].entities[0].components[0].config);field(g,'rewarded',false,'bool');addInput(g,button('upgrade','KeyU'));addInput(g,button('plant','KeyP'));addInput(g,button('collect','KeyC'));cap(g,'a2game.rules.state-set','a2game.rules.state-add');g.rules=[{id:'match-reward',on:{type:'puzzle.changed'},if:op('and',s('/puzzle/won'),op('not',s('/rewarded'))),do:[{op:'state.add',path:'/economy/wallet',value:3},{op:'state.set',path:'/rewarded',value:true}]}];g.outcomes=[{id:'upgraded',status:'won',when:op('and',s('/puzzle/won'),gte('/economy/plots/0/level',1))}];touchCells(g,'drag-select');write('H02',g,[act('cell1'),act('cell4'),act('upgrade')],[act('cell1'),{actions:[press('cell4'),release('cell4'),press('upgrade'),release('upgrade')],ticks:1}],{title:'三消与升级',negativeChecks:[{path:'/economy/plots/0/level',equals:0},{path:'/economy/wallet',equals:3}],hint:'三消成功的奖励在规则阶段到账，下一 Tick 才能 upgrade。'});
}
{
 const g=physical([body('hero','actor',3000,1000),body('enemy','target',1000,4500,{fixed:true,hx:300,hy:300})],{weapon:'hitscan',fireDirection:'up',fireRequestPath:'/control/fireRequest',laneRequestPath:'/control/laneSignal',laneWidth:2000,goalScore:1,maxTicks:120});field(g,'control',initialControlState());addInput(g,sensor('zones','touch.raw','pose'));cap(g,'a2game.rules.state-set');const down=op('eq',{event:'/value/kind'},k('down'));actionRule(g,'left-zone','zones',[{op:'state.set',path:'/control/laneSignal',value:-1}],op('and',down,op('lt',{event:'/value/u'},k(0.3))));actionRule(g,'right-zone','zones',[{op:'state.set',path:'/control/fireRequest',value:true}],op('and',down,op('gt',{event:'/value/u'},k(0.7))));write('H03',g,[{raw:[raw('down',1,0.2,0.5),raw('down',2,0.8,0.5)],ticks:2}],[{raw:[raw('down',1,0.8,0.5)],ticks:120}],{title:'换道与射击',negativeExpected:'lost',hint:'左侧触摸换道，右侧触摸射击；两指可在同一 Tick 分别操作。'});
}
{
 const g=physical([body('a','target',3000,160,{hx:160,hy:160,value:2}),body('b','target',5000,160,{hx:160,hy:160,value:2})],{merge:true,tiltGravityPath:'/control/axis',goalScore:4,maxTicks:300});controller(g,{dragAction:'drag',tiltAction:'tilt',axisFromDrag:true});addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,sensor('tilt','imu.tilt','vec2'));g.outcomes[0].when=op('and',s('/world/won'),s('/control/usedInput'));write('H04',g,[pointer('down',4000,3000),pointer('move',7500,3000,1,80)],[wait(300)],{title:'物理合成与倾斜',negativeExpected:'lost',hint:'倾斜或拖动施加水平重力，碰壁后两枚同色球合成。'});
}
{
 const g=cloneGame('puzzle-placement');noUndo(g);timer(g,1200);touchCells(g,'drag-select');write('H05',g,[wait(1),{pause:true,ticks:5000,resume:true},...['cell0','cell1','cell2','cell3'].map(a=>act(a))],[wait(1201)],{title:'找物与限时关卡',negativeExpected:'lost',hint:'20 秒内把物品归位；暂停冻结逻辑倒计时。'});
}
save('project/game-candidates.json',{format:'a2game-game-candidates',profile:'bounded-reference-levels-v1',frozenGames:32,independentHybrids:5,verifiedGames:0,verifiedHybrids:0,scope:'Individual playable candidate definitions; full Gate requires genuine independent Agent G3, applicable physical input and complete gameplay DoD. No coverage registry status is promoted by this generator.',cases:records});
console.log(`Wrote ${records.length} individual Gxx/Hxx candidates and positive/negative conformance.`);
