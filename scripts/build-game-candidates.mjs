/** Individually authored bounded introductory/endgame levels. These are candidates, never G3/physical receipts. */
import {readFileSync,writeFileSync} from 'node:fs';
import {polishGameplayPresentation} from './gameplay-presentation.mjs';
import {improveInputGameplay} from './input-gameplay-levels.mjs';
import {improveFullGameplay,decorateHiddenObjects} from './full-gameplay-levels.mjs';
import {configureRigidLevel} from './rigid-levels.mjs';
import {initialControlState} from '../dist/index.js';
import {initialDefenseState} from '../dist/modules/tower-defense.js';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n'),ref=id=>({id,version:'0.1.0'});
const registry=read('specs/v0.1/coverage/games.json'),base=read('specs/v0.1/games/tap-target.game.json'),puzzles=read('project/puzzle-reference-cases.json').cases;
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
function physical(bodies,options={}){const g=fresh();field(g,'world',world(bodies));component(g,'a2game.realtime.world',{statePath:'/world',width:8000,height:6000,...options});renderWorld(g);if(options.merge!==true){delete g.presentation.scene2d.bodyLayer.valuePalette;g.presentation.scene2d.bodyLayer.showValues=false;}g.presentation.hud=[{id:'world-score',kind:'text',bind:{text:options.actions?.charge?{template:'得分 {0} · 蓄力 {1}',args:[{state:'/world/score'},{state:'/world/charge'}]}:{template:'得分 {0}',args:[{state:'/world/score'}]}}}];g.outcomes=[{id:'won',status:'won',when:s('/world/won')},{id:'lost',status:'lost',priority:-1,when:s('/world/lost')}];return g;}
function runnerLevel(shooter=false){
 const obstacle=(id,x)=>body(id,'solid',x,5500,{vy:-64,hx:350,hy:180,value:0,ttl:90});
 const checkpoint=id=>body(id,'pickup',4000,5500,{vy:-64,hx:2000,hy:60,ttl:100});
 const bodies=[body('hero','actor',4000,1000,{value:0}),obstacle('obstacle_a',4000)];
 if(shooter)bodies.push(body('gunner','target',2000,4500,{vy:-32,hx:200,hy:200,ttl:110}));
 const g=physical(bodies,{laneCenters:[2000,4000,6000],maxTicks:300,actions:{laneLeft:'left',laneRight:'right',...(shooter?{fire:'fire'}:{})},waves:[{tick:35,body:checkpoint('checkpoint_1')},{tick:90,body:obstacle('obstacle_b',2000)},{tick:145,body:obstacle('obstacle_c',4000)},{tick:170,body:checkpoint('checkpoint_2')}]});
 field(g,'runner',{checkpoints:0,kills:0,crashed:false});
 for(const [id,code] of [['left','ArrowLeft'],['right','ArrowRight']])addInput(g,button(id,code,'touch.swipe',{direction:id}));
 for(const id of ['a','b','c'])g.rules.push({id:'crash-'+id,on:{type:'contact.begin'},if:op('eq',{event:'/pair'},k('hero|obstacle_'+id)),do:[{op:'state.set',path:'/runner/crashed',value:true}]});
 for(let i=1;i<=2;i++)g.rules.push({id:'checkpoint-'+i,on:{type:'realtime.trigger'},if:op('and',op('eq',{event:'/id'},k('checkpoint_'+i)),eq('/runner/checkpoints',i-1)),do:[{op:'state.set',path:'/runner/checkpoints',value:i}]});
 if(shooter){const c=g.scenes[0].entities[0].components[0].config;Object.assign(c,{weapon:'projectile',fireDirection:'up',projectileSpeed:128,projectileHalfSize:64,cooldownTicks:8,fireRequestPath:'/control/fireRequest',laneRequestPath:'/control/laneSignal'});field(g,'control',initialControlState());addInput(g,button('fire','Space'));addInput(g,sensor('zones','touch.raw','pose'));
  const down=op('eq',{event:'/value/kind'},k('down')),u={event:'/value/u'};
  actionRule(g,'left-zone','zones',[{op:'state.set',path:'/control/laneSignal',value:-1}],op('and',down,op('lt',u,k(0.25))));
  actionRule(g,'middle-zone','zones',[{op:'state.set',path:'/control/laneSignal',value:1}],op('and',down,op('gte',u,k(0.25)),op('lt',u,k(0.6))));
  actionRule(g,'right-zone','zones',[{op:'state.set',path:'/control/fireRequest',value:true}],op('and',down,op('gt',u,k(0.75))));
  g.rules.push({id:'defeat-gunner',on:{type:'combat.death'},if:op('eq',{event:'/id'},k('gunner')),do:[{op:'state.add',path:'/runner/kills',value:1}]});
 }
 g.outcomes=[{id:'finish',status:'won',when:shooter?op('and',eq('/runner/checkpoints',2),eq('/runner/kills',1)):eq('/runner/checkpoints',2)},{id:'crash',status:'lost',priority:-2,when:op('or',s('/runner/crashed'),s('/world/lost'))}];return g;
}
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
function defenseLevel(){
 const g=fresh();field(g,'defense',initialDefenseState(4,1));
 const cells=[{x:3000,y:2000},{x:4500,y:2000},{x:6000,y:2000}],actions=[];
 for(let index=0;index<cells.length;index++)for(const kind of ['place','select','merge','upgrade']){const action=kind+index;actions.push({action,kind,index});const cell=cells[index];addInput(g,button(action,'Key'+String.fromCharCode(65+index*4+['place','select','merge','upgrade'].indexOf(kind)),kind==='place'?'touch.select':undefined,kind==='place'?{sceneWidth:10,sceneHeight:8,x:cell.x/1000-4,y:cell.y/1000-3,hx:0.25,hy:0.25,mode:'tap'}:{}));}cap(g,'a2game.input.touch.raw');
 component(g,'a2game.strategy.tower-defense',{statePath:'/defense',width:8000,height:6000,cost:2,damage:1,range:6000,speed:64,cooldownTicks:8,maxTicks:220,cells,path:[{x:7000,y:3000},{x:4000,y:3000},{x:1000,y:3000}],waves:[{tick:1,hp:3,reward:2},{tick:35,hp:6,reward:3},{tick:70,hp:10,reward:4}],actions});
 renderWorld(g,'/defense/bodies');delete g.presentation.scene2d.bodyLayer.valuePalette;
 for(const [index,p] of cells.entries())g.presentation.scene2d.nodes.push({id:'slot'+index,kind:'rect',at:[p.x/1000-4,p.y/1000-3],size:[0.5,0.5],fill:'#35465e'},{id:'slot-label'+index,kind:'text',at:[p.x/1000-4,p.y/1000-3-0.55],fontSize:0.18,fill:'#b5cee8',text:{literal:String(index)}});
 g.presentation.scene2d.nodes.push({id:'path',kind:'rect',at:[0,0],size:[6.2,0.1],fill:'#a8c5d9'});
 g.presentation.hud=[{id:'status',kind:'text',bind:{text:{template:'金币 {0} · 击退 {1}\n生命 {2} · 波次 {3}',args:['wallet','score','lives','waveCursor'].map(id=>({state:'/defense/'+id}))}}}];g.outcomes=[{id:'won',status:'won',when:s('/defense/won')},{id:'lost',status:'lost',priority:-1,when:s('/defense/lost')}];return g;
}
function cloneGame(name){const g=read(`specs/v0.1/games/${name}.game.json`);delete g.inputs.traceRecording;return g;}
function noUndo(g){for(const e of g.scenes[0].entities)for(const c of e.components){delete c.config.undoAction;delete c.config.historyPath;}g.inputs.actions=g.inputs.actions.filter(a=>a.id!=='undo');}
// Published definition revisions changed by the 2026-10-26 gameplay/input/visual increment.
const revisions={G24:3,G06:2,G02:3,G20:3,G23:3,H02:3,G08:2,G09:3,G10:2,G16:3,G26:3,G29:3,H04:3,H05:3,G11:3,G12:3,G13:3,G14:2,G15:3,G17:2,G18:3,G19:3,G21:3,G22:3,G25:3,G27:3,G28:3,G30:3,G31:3,G32:3,H01:4,H03:3};
function write(id,g,positive,negative,options={}){
 ({positive,negative,options}=improveFullGameplay(g,id,positive,negative,options));improveInputGameplay(g,id);
 const entry=registry.games.find(row=>row.id===id),title=entry?.name??options.title;g.id='org.a2game.games.'+id.toLowerCase();g.revision=Math.max(options.revision??1,revisions[id]??1);g.meta={title:`${id} ${title}`,genres:entry?.taxonomy.genres??['casual'],description:options.hint??'独立单关候选；完成目标后重开。参考物理与关卡范围见候选回执。'};
 if(entry){cap(g,...entry.requiredCapabilities.all.map(r=>r.id));for(const group of entry.requiredCapabilities.anyOf??[])for(const r of group)cap(g,r.id);}
 for(const rule of g.rules)for(const effect of rule.do)cap(g,'a2game.rules.'+effect.op.replace('.','-'));
 if(id==='G32')g.presentation.scene2d.nodes.push({id:'door',kind:'rect',at:[0,0],size:[2,2.5],fill:{from:{state:'/opened'},map:{false:'#ecb963',true:'#57d7c8'},fallback:'#35465e'}},{id:'door-label',kind:'text',at:[0,0],fontSize:0.35,fill:'#0d1729',text:{literal:'机关'}});
 if(id==='G22'){delete g.presentation.scene2d.repeat;g.presentation.hud=[{id:'farm',kind:'text',bind:{text:{template:'金币 {0} · 收获 {1}\n成熟 Tick {2}',args:[{state:'/economy/wallet'},{state:'/economy/score'},{state:'/economy/plots/0/readyAt'}]}}}];g.presentation.scene2d.nodes.push({id:'field',kind:'rect',at:[0,0],size:[2.8,1.8],fill:{from:{state:'/economy/plots/0/item'},map:{'':'#35465e',seed:'#57d7c8'},fallback:'#35465e'}},{id:'crop',kind:'text',at:[0,0],fontSize:0.3,fill:'#ffffff',text:{state:'/economy/plots/0/item'}});}
 const name=id.toLowerCase()+'-candidate';g.tests=[`../tests/${name}.conformance.json`];
 const stage=g.presentation.scene2d;stage.nodes=stage.nodes.filter(n=>!['title','hint'].includes(n.id));stage.nodes.push({id:'title',kind:'text',at:[0,stage.height/2-0.4],fontSize:0.26,fill:'#b5cee8',text:{literal:g.meta.title}},{id:'hint',kind:'text',at:[0,-stage.height/2+0.35],fontSize:0.14,fill:'#9fb8d2',text:{literal:g.meta.description}});
 if(!g.presentation.hud.length)g.presentation.hud.push({id:'goal',kind:'text',bind:{text:{literal:options.hint??g.meta.title}}});
 polishGameplayPresentation(g,id,title);if(id==='H05')decorateHiddenObjects(g);
 save(`specs/v0.1/games/${name}.game.json`,g);
 const convert=rows=>rows.flatMap(row=>[...(row.action?[{op:'injectAction',action:row.action,phase:'press',...(row.value!==undefined?{value:row.value}:{})},{op:'injectAction',action:row.action,phase:'release'}]:[]),...(row.actions??[]).map(a=>({op:'injectAction',...a})),...(row.raw??[]).map(raw=>({op:'injectRaw',raw})),...(row.pause?[{op:'pause'}]:[]),{op:'step',ticks:row.ticks??1},...(row.resume?[{op:'resume'}]:[]),...(row.checks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals}))]);
 const cases=[{id:'COVERAGE-'+id+'-POSITIVE',seed:42,steps:[{op:'start'},...convert(positive),...(options.checks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals})),{op:'assert',path:'/flow/status',equals:options.expected??'won'},{op:'restart'},{op:'assert',path:'/tickIndex',equals:0}]},{id:'COVERAGE-'+id+'-NEGATIVE',seed:42,steps:[{op:'start'},...convert(negative),...(options.negativeChecks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals})),{op:'assert',path:'/flow/status',equals:options.negativeExpected??'playing'}]}];
 save(`specs/v0.1/tests/${name}.conformance.json`,{format:'a2game-conformance',specVersion:'0.1.0',suiteId:name,subject:{type:'game',id:g.id,file:`../games/${name}.game.json`},cases});
 records.push({id,name,title,steps:positive,negative,expected:options.expected??'won',negativeExpected:options.negativeExpected??'playing',checks:options.checks??[],negativeChecks:options.negativeChecks??[],...(options.nativePointerActions?{nativePointerActions:options.nativePointerActions,nativePointerWait:options.nativePointerWait??0}:{}),scope:options.scope??'Bounded introductory/endgame reference level; commercial-game quality and general variants are independent.',gates:{G0:'NOT_RUN',G1:'NOT_RUN',G2:'NOT_RUN',G3:'NOT_RUN',physical:entry?.inputs.some(i=>i.startsWith('imu.')||i==='touch.multi-hold')?'NOT_RUN':'NOT_APPLICABLE'},verified:false});
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
 if(id==='G05'){
  const config=g.scenes[0].entities[0].components[0].config;config.height=2;config.selectActions=Array.from({length:8},(_,i)=>'cell'+i);config.blockers=[[4],[4],[7],[7],[],[],[],[]];
  const p=g.state.puzzle.initial;p.board=[1,2,2,1,3,0,0,3];p.display=[0,0,0,0,3,-1,-1,3];
  g.inputs.actions=g.inputs.actions.filter(a=>a.id==='undo');for(let i=0;i<8;i++)addInput(g,button('cell'+i,'Digit'+(i+1)));
  positive=[4,7,0,3,1,2].map(i=>act('cell'+i));negative=[act('cell0')];options={revision:2,hint:'先移除上层 4/7，再移除 0/3、1/2；覆盖牌与两侧封闭牌不可选。',negativeChecks:[{path:'/puzzle/moves',equals:0},{path:'/puzzle/selected',equals:[]}],nativePointerActions:positive.map(a=>a.action)};
 }
 if(id==='G06'){
  const c=g.scenes[0].entities[0].components[0].config,p=g.state.puzzle.initial,board=g.presentation.scene2d.repeat.find(r=>r.id==='board');
  c.width=3;c.height=3;c.directions=['up','down','right','up','left','down','left','right','down'];c.selectActions=Array.from({length:9},(_,i)=>'cell'+i);p.board=Array(9).fill(1);p.display=[...p.board];
  board.columns=3;board.origin=[-0.85,0.85];board.step=[0.85,0.85];
  const selection=g.presentation.scene2d.repeat.find(r=>r.id==='selection');if(selection){selection.columns=3;selection.origin=[...board.origin];selection.step=[...board.step];}
  g.inputs.actions=g.inputs.actions.filter(a=>a.id==='undo');g.inputs.actions[0].bindings[0].config.code='KeyZ';for(let i=0;i<9;i++)addInput(g,button('cell'+i,'Digit'+(i+1)));
  positive=[0,3,4,2,6,8,5,7,1].map(i=>act('cell'+i));negative=[act('cell1'),act('cell3')];options={hint:'箭头沿四方向出界才能移除；先清上方 0，再清 3；1 下方仍有 4/7 阻挡。Z 撤销。',checks:[{path:'/puzzle/moves',equals:9},{path:'/puzzle/board',equals:Array(9).fill(0)}],negativeChecks:[{path:'/puzzle/moves',equals:0}],nativePointerActions:positive.map(a=>a.action)};
 }
 if(id==='G07')g.scenes[0].entities[0].components[0].config.closeTicks=60;
 if(id==='G09'){
  noUndo(g);const c=g.scenes[0].entities[0].components[0].config,p=g.state.puzzle.initial;
  c.width=4;c.height=8;c.fallTicks=12;c.targetScore=4;c.pieces=[[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[0,2],[0,3]],[[0,0],[0,1],[0,2],[0,3]]];
  p.board=Array(32).fill(0);p.display=Array(32).fill(-1);p.anchor=2;
  const keys={left:'ArrowLeft',right:'ArrowRight',rotate:'ArrowUp',drop:'Space'};for(const action of g.inputs.actions)action.bindings[0].config.code=keys[action.id];
  positive=[act('left'),act('left'),{...wait(84),checks:[{path:'/puzzle/moves',equals:1},{path:'/puzzle/active',equals:1},{path:'/puzzle/score',equals:0}],hudIncludes:['锁定 1/4'],capture:'gravity-lock'}, {...act('drop'),checks:[{path:'/puzzle/score',equals:2}],capture:'two-lines'},...['left','left','rotate','drop','left','left','rotate','drop'].map(a=>act(a))];
  negative=[wait(600)];options={hint:'左右移动、↑旋转、Space 硬降；先将 O 放左侧等待重力锁定，再消四行；出生被挡立即顶出。',negativeExpected:'lost',checks:[{path:'/puzzle/score',equals:4},{path:'/puzzle/moves',equals:4},{path:'/puzzle/board',equals:Array(32).fill(0)}],negativeChecks:[{path:'/puzzle/score',equals:0},{path:'/puzzle/active',equals:3}]};
 }
 if(id==='G10'){const r=structuredClone(g.presentation.scene2d.repeat[0]);r.id='targets';r.source={literal:[0,1,0,2]};r.origin=[2,0.5];g.presentation.scene2d.repeat.push(r);options.hint='先点物品，再点目标槽；右侧小格显示目标编号。';}
 touchCells(g,['G03','G10'].includes(id)?'drag-select':'tap');write(id,g,positive,negative,options);
}
// G11-G19: different bounded worlds, all simulated by the same integer physics/combat modules.
{
 const g=physical([body('hero','actor',1000,1100,{value:0}),...['a','b','c'].map((id,i)=>body('platform_'+id,'solid',1000+i*3000,800,{hx:i?450:600,hy:200,fixed:true,value:0}))],{gravity:-4,jumpSpeed:96,jumpHorizontalSpeed:60,platformLanding:true,killBelowY:600,maxTicks:480,actions:{charge:'charge'}});
 field(g,'jump',{landings:0,combo:0,bestCombo:0,score:0,lastOffset:0,lastSurface:'platform_a'});addInput(g,button('charge','Space','touch.long-press',{minTicks:2}));g.inputs.actions[0].bindings[0].config.hold=true;
 for(const [index,surface] of ['platform_b','platform_c'].entries())for(const centered of [true,false]){const center=op('and',op('gte',{event:'/centerOffset'},k(-100)),op('lte',{event:'/centerOffset'},k(100)));
  g.rules.push({id:'land-'+surface+'-'+centered,on:{type:'realtime.landed'},if:op('and',op('eq',{event:'/surface'},k(surface)),eq('/jump/landings',index),centered?center:op('not',center)),do:[{op:'state.add',path:'/jump/landings',value:1},{op:'state.set',path:'/jump/lastOffset',value:{event:'/centerOffset'}},{op:'state.set',path:'/jump/lastSurface',value:surface},...(centered?[{op:'state.add',path:'/jump/combo',value:1},{op:'state.set',path:'/jump/bestCombo',value:op('max',s('/jump/bestCombo'),op('add',s('/jump/combo'),k(1)))},{op:'state.add',path:'/jump/score',value:op('add',s('/jump/combo'),k(2))}]:[{op:'state.set',path:'/jump/combo',value:0},{op:'state.add',path:'/jump/score',value:1}])]});
 }
 g.outcomes=[{id:'finish',status:'won',when:eq('/jump/landings',2)},{id:'fall',status:'lost',priority:-1,when:s('/world/lost')}];
 const hold={raw:[{source:'keyboard',kind:'down',payload:{code:'Space'}}],ticks:4},jump={raw:[{source:'keyboard',kind:'up',payload:{code:'Space'}}],ticks:60};
 write('G11',g,[wait(1),{...hold,checks:[{path:'/world/charge',equals:4}],capture:'charge'}, {...jump,checks:[{path:'/jump/landings',equals:1},{path:'/jump/combo',equals:1}],hudIncludes:['连击 1'],capture:'first-center'},hold,jump],[{...hold,ticks:60},{...jump,ticks:150}],{negativeExpected:'lost',hint:'按住 Space 或长按蓄力，松开连跳两平台；约 4 Tick 蓄力落中心，中心连击加分，偏心落点重置连击。',checks:[{path:'/jump/landings',equals:2},{path:'/jump/combo',equals:2},{path:'/jump/score',equals:5}],negativeChecks:[{path:'/jump/landings',equals:0}]});
}
{
 const gates=['a','b'].flatMap((id,i)=>{const x=2100+i*2000;return [body('gate_'+id,'pickup',x+400,3300,{hx:16,hy:1000,fixed:true}),body('pipe_'+id+'_bottom','target',x,1100,{hx:140,hy:1100,fixed:true,value:0}),body('pipe_'+id+'_top','target',x,5200,{hx:140,hy:800,fixed:true,value:0})];});
 const g=physical([body('hero','actor',1000,3000,{vx:64,value:0}),...gates],{gravity:-4,allowAirJump:true,jumpSpeed:64,goalScore:2,killBelowY:500,maxTicks:180,actions:{jump:'flap'}});addInput(g,button('flap','Space','touch.tap'));
 write('G12',g,[{...act('flap',20),checks:[{path:'/world/score',equals:0}],capture:'before-score-line'}, {...wait(11),checks:[{path:'/world/score',equals:1}],capture:'first-gate'},act('flap',31)],[wait(180)],{negativeExpected:'lost',negativeChecks:[{path:'/world/score',equals:0}],checks:[{path:'/world/score',equals:2}],hint:'点击或 Space 拍翼穿过门柱；身体完全越过门柱后计分，碰柱或坠落失败。'});
}
{
 const g=runnerLevel();write('G13',g,[{...act('left',110),checks:[{path:'/runner/checkpoints',equals:1}],hudIncludes:['检查点 1/2'],capture:'first-checkpoint'}, {...act('right',80),checks:[{path:'/runner/checkpoints',equals:1}],capture:'second-section'},act('right',70)],[wait(300)],{negativeExpected:'lost',hint:'←/→ 或滑动在三车道换道；依次左、中、右避开三段障碍，通过两个检查点。',checks:[{path:'/runner/checkpoints',equals:2},{path:'/world/spawned',equals:[0,1,2,3]},{path:'/world/bodies',equals:[body('hero','actor',6000,1000,{value:0})]}],negativeChecks:[{path:'/runner/crashed',equals:true},{path:'/runner/checkpoints',equals:0}]});
}
{
 const g=physical([body('ball','actor',2000,3500,{vy:-64}),body('paddle','solid',4000,400,{hx:650,hy:100,fixed:true}),body('brick','target',2000,4800,{hx:700,hy:150,fixed:true})],{restitution:1000,damageTargetsOnContact:true,goalScore:1,killBelowY:200,maxTicks:240});controller(g,{bodyId:'paddle',moveMode:'drag',dragAction:'drag'});addInput(g,sensor('drag','touch.drag','vec2'));write('G14',g,[pointer('down',4000,400),pointer('move',2000,400,1,130)],[wait(240)],{negativeExpected:'lost',hint:'拖动挡板接住球，反弹击碎上方砖块；球落底失败。'});
}
{
 const g=configureRigidLevel(fresh(),'table');write('G15',g,[act('kick',180)],[wait(480)],{negativeExpected:'lost',hint:'Space 或点击发射真实三维弹球，沿边界反弹，先通过远端触发区，再回到近端触发区。',checks:[{path:'/rigid/score',equals:2}],negativeChecks:[{path:'/rigid/score',equals:0}]});
}
{
 const g=physical([],{gravity:-16,merge:true,goalScore:4,maxTicks:300});controller(g,{spawnAction:'drop',dragAction:'drag',spawnY:5000,spawnValue:2,spawnHalfSize:160});addInput(g,button('drop','Space','touch.tap'));addInput(g,sensor('drag','touch.drag','vec2'));write('G16',g,[act('drop',60),act('drop',60)],[act('drop',60)],{hint:'拖动选择横向位置，点击 drop 放球；相同数字接触合成。'});
}
{
 const g=physical([body('hero','actor',4000,1000)],{weapon:'projectile',fireDirection:'up',projectileSpeed:128,goalScore:1,maxTicks:200,actions:{fire:'fire'},waves:[{tick:0,body:body('enemy','target',2500,4500,{fixed:true,hx:300,hy:300})}]});controller(g,{bodyId:'hero',moveMode:'drag',dragAction:'drag'});addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,button('fire','Space'));write('G17',g,[pointer('down',4000,1000),pointer('move',2500,1000,1,16),act('fire',60)],[act('fire',200)],{negativeExpected:'lost',hint:'拖动飞机对准敌机，Space 或 fire 发射；限时击落目标。'});
}
{
 const g=physical([body('hero','actor',4000,2000),body('enemy','target',4000,4500,{fixed:true,hx:300,hy:300})],{weapon:'hitscan',aimPath:'/control/aim',goalScore:1,maxTicks:120,actions:{fire:'fire'}});controller(g,{bodyId:'hero',dragAction:'aim',aimFromDrag:true});addInput(g,sensor('aim','touch.drag','vec2'));addInput(g,button('fire','Space'));const c=g.scenes[0].entities[0].components.find(c=>c.capability.id==='a2game.realtime.world').config;c.heldMovement=true;c.actions={fire:'fire',left:'moveLeft',right:'moveRight',up:'moveUp',down:'moveDown'};for(const [id,code] of [['moveLeft','KeyA'],['moveRight','KeyD'],['moveUp','KeyW'],['moveDown','KeyS']]){const input=button(id,code);input.bindings[0].config.hold=true;addInput(g,input);}write('G18',g,[act('aim',1,point(4000,4500)),act('fire')],[act('fire',120)],{revision:2,negativeExpected:'lost',hint:'WASD 独立移动，拖动瞄准；Space 或 fire 射击，墙会阻挡射线。'});
}
{
 const g=physical([body('hero','actor',4000,2000),body('enemy','target',6000,2000,{hp:2})],{weapon:'hitscan',autoFire:true,autoTarget:true,damageBonusPath:'/economy/plots/0/level',cooldownTicks:120,seekSpeed:16,goalScore:1,maxTicks:100});const eco=cloneGame('strategy-upgrade');field(g,'economy',eco.state.economy.initial);g.state.economy.initial.wallet=2;component(g,'a2game.strategy.economy-loop',{...eco.scenes[0].entities[0].components[0].config,goalScore:2});addInput(g,button('upgrade','KeyU'));addInput(g,button('plant','KeyP'));addInput(g,button('collect','KeyC'));write('G19',g,[act('upgrade')],[wait(100)],{negativeExpected:'lost',hint:'及时 upgrade 升级伤害；炮台自动瞄准追近的敌群。'});
}
{
 const g=fresh();field(g,'bubble',{board:[1,1,1,2,2,2,...Array(12).fill(0)],ammo:1,color:1,score:0,aim:[0,1],shot:{active:false,x:4000,y:500,vx:0,vy:0},won:false,lost:false,visuals:[]});component(g,'a2game.combat.bubble-grid',{statePath:'/bubble',columns:6,rows:3,cellSize:700,originX:1900,topY:4500,worldWidth:8000,worldHeight:6000,launchX:4000,launchY:500,colors:2,goalScore:4,fireAction:'fire',aimAction:'aim',sceneWidth:10,sceneHeight:8});renderWorld(g,'/bubble/visuals');addInput(g,sensor('aim','touch.drag','vec2'));addInput(g,button('fire','Space','touch.tap'));outcome(g,'/bubble/won','/bubble/lost');write('G20',g,[act('aim',1,point(2600,4500)),act('fire',100)],[act('fire',100)],{negativeExpected:'lost',hint:'拖动瞄准同色泡泡，点击 fire；本关一发，四邻接方格吸附。'});
}
{
 const g=defenseLevel();write('G21',g,[act('place0'),act('place1'),wait(170)],[wait(220)],{revision:2,negativeExpected:'lost',checks:[{path:'/defense/score',equals:3},{path:'/defense/lives',equals:1}],nativePointerActions:['place0','place1'],nativePointerWait:170,hint:'点击格子或 place0/1 建塔，upgrade0 升级；抵御三波，漏怪失败。'});
}
{
 const g=cloneGame('strategy-farm');write('G22',g,[act('plant'),wait(2),act('collect')],[act('collect')],{hint:'plant 播种，等待两 Tick 后 collect 收获；暂停冻结生产。'});
}
{
 const g=cloneGame('strategy-merge'),c=g.scenes[0].entities[0].components[0].config;
 c.goalScore=4;c.products[0].requires='mill';c.actions.push({action:'plant',kind:'plant',item:'seed',index:0},{action:'collect',kind:'collect',index:0});
 field(g,'factoryUnlocked',false,'bool');addInput(g,button('plant','KeyP'));addInput(g,button('collect','KeyC'));
 g.rules=[{id:'merge-unlocks-mill',on:{type:'strategy.changed'},if:op('and',op('eq',{event:'/kind'},k('merge')),op('not',s('/factoryUnlocked')),gte('/economy/grid/1',2)),do:[{op:'state.set',path:'/factoryUnlocked',value:true},{op:'state.set',path:'/economy/unlocked',value:['mill']},{op:'state.set',path:'/economy/plots',value:[{item:'',readyAt:-1,level:1}]}]}];
 const checked=(row,checks)=>({...row,checks:checks.map(([path,equals])=>({path,equals}))});
 write('G23',g,[checked(act('plant'),[['/economy/wallet',10],['/factoryUnlocked',false]]),act('select0'),{...checked(act('merge1'),[['/factoryUnlocked',true],['/economy/plots/0/level',1]]),hudIncludes:['工厂等级 1'],capture:'factory-unlocked'},checked(act('plant'),[['/economy/wallet',8],['/economy/plots/0/item','seed']]),checked(act('collect'),[['/economy/inventory',{}]]),wait(1),{...act('collect'),hudIncludes:['金币 14','得分 4'],capture:'factory-produced'}],[act('plant'),act('collect'),act('select0')],{hint:'select0、merge1 合成解锁工厂，plant 扣费生产，成熟后 collect 获得双倍产量。',checks:[{path:'/economy/score',equals:4},{path:'/economy/inventory/seed',equals:2},{path:'/economy/wallet',equals:14}],negativeChecks:[{path:'/factoryUnlocked',equals:false},{path:'/economy/wallet',equals:10},{path:'/economy/plots/0/item',equals:''}]});
}
{
 const g=cloneGame('strategy-turn'),c=g.scenes[0].entities[0].components[0].config;c.width=c.height=c.winLength=5;g.outcomes.push({id:'draw',status:'stopped',when:s('/turn/draw')});g.outcomes[0].when=op('gt',s('/turn/winner'),k(0));c.selectActions=Array.from({length:25},(_,i)=>'cell'+i);g.state.turn.initial.board=Array(25).fill(0);g.inputs.actions=c.selectActions.map((id,i)=>button(id,'Key'+String.fromCharCode(65+i)));const r=g.presentation.scene2d.repeat[0];r.columns=5;r.origin=[-1.4,1.4];r.step=[0.7,0.7];r.template[0].size=[0.64,0.64];touchCells(g);write('G24',g,[0,5,1,6,2,7,3,8,4].map(i=>act('cell'+i)),[act('cell0'),act('cell0')],{revision:3,nativePointerActions:[0,5,1,6,2,7,3,8,4].map(i=>'cell'+i),negativeChecks:[{path:'/turn/moves',equals:1},{path:'/turn/player',equals:2}],hint:'两人轮流点击空格，横竖斜连续五子获胜；占用格不换手。'});
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
 const g=configureRigidLevel(fresh(),'stack');write('G28',g,[act('drop',90),act('drop',90),act('drop',180)],[act('drag',1,[0.75,0.5]),act('drop',300)],{negativeExpected:'lost',hint:'Space/点击逐个放置三维刚体，拖动选择 X/Z；三块真实碰撞堆叠后稳定 60 Tick 通关，偏出支撑会倾覆坠落。',checks:[{path:'/rigid/placed',equals:3},{path:'/rigid/stableTicks',equals:60}],negativeChecks:[{path:'/rigid/placed',equals:1}]});
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
 const g=defenseLevel();write('H01',g,[act('place0'),act('place1'),act('select0'),act('merge1'),wait(170)],[wait(220)],{revision:2,title:'合成炮台保卫战',negativeExpected:'lost',hint:'place0、place1 建塔，select0 后 merge1 合成；旧炮与武器释放，抵御三波。',checks:[{path:'/defense/towers/0/level',equals:2},{path:'/defense/towers/0/cell',equals:1},{path:'/defense/score',equals:3}]});
}
{
 const g=cloneGame('puzzle-match');noUndo(g);const eco=cloneGame('strategy-upgrade');field(g,'economy',eco.state.economy.initial);g.state.economy.initial.wallet=0;
 const economy=eco.scenes[0].entities[0].components[0].config;economy.actions=economy.actions.filter(a=>a.kind==='upgrade');component(g,'a2game.strategy.economy-loop',economy);
 field(g,'world',world([body('hero','actor',6500,1700,{hx:180,hy:180}),body('target','target',6500,4000,{hp:4,fixed:true,hx:250,hy:250})]));field(g,'combat',{bonus:0,nextDamage:1,lastDamage:0,targetHP:4});
 component(g,'a2game.realtime.world',{statePath:'/world',width:8000,height:6000,weapon:'hitscan',fireDirection:'up',damageBonusPath:'/combat/bonus',cooldownTicks:1,goalScore:1,actions:{fire:'fire'}});renderWorld(g);delete g.presentation.scene2d.bodyLayer.valuePalette;g.presentation.scene2d.bodyLayer.showValues=false;
 field(g,'rewarded',false,'bool');addInput(g,button('upgrade','KeyU'));addInput(g,button('fire','Space'));cap(g,'a2game.rules.state-set','a2game.rules.state-add');
 g.rules=[{id:'match-reward',on:{type:'puzzle.changed'},if:op('and',s('/puzzle/won'),op('not',s('/rewarded'))),do:[{op:'state.add',path:'/economy/wallet',value:3},{op:'state.set',path:'/rewarded',value:true}]},
 {id:'upgrade-character',on:{type:'strategy.upgraded'},do:[{op:'state.set',path:'/combat/bonus',value:s('/economy/plots/0/level')},{op:'state.set',path:'/combat/nextDamage',value:op('add',k(1),s('/economy/plots/0/level'))}]},
 {id:'combat-feedback',on:{type:'combat.hit'},do:[{op:'state.set',path:'/combat/lastDamage',value:{event:'/amount'}},{op:'state.set',path:'/combat/targetHP',value:{event:'/hp'}}]}];
 g.outcomes=[{id:'upgraded-victory',status:'won',when:op('and',s('/puzzle/won'),gte('/economy/plots/0/level',1),s('/world/won'))}];touchCells(g,'drag-select');
 write('H02',g,[{...act('fire'),hudIncludes:['下次伤害 1','上次命中 1','敌人生命 3'],capture:'base-damage',checks:[{path:'/combat/lastDamage',equals:1},{path:'/combat/targetHP',equals:3}]},act('cell1'),act('cell4'),{actions:[press('upgrade'),release('upgrade'),press('fire'),release('fire')],ticks:1,checks:[{path:'/combat/lastDamage',equals:1},{path:'/combat/targetHP',equals:2},{path:'/combat/nextDamage',equals:2}],hudIncludes:['等级 1','下次伤害 2','上次命中 1','敌人生命 2'],capture:'upgrade-tick'}, {...act('fire'),hudIncludes:['下次伤害 2','上次命中 2','敌人生命 0'],capture:'upgraded-victory'}],[act('cell1'),{actions:[press('cell4'),release('cell4'),press('upgrade'),release('upgrade')],ticks:1}],{title:'三消与升级',negativeChecks:[{path:'/economy/plots/0/level',equals:0},{path:'/economy/wallet',equals:3},{path:'/combat/bonus',equals:0},{path:'/combat/targetHP',equals:4}],checks:[{path:'/combat/lastDamage',equals:2},{path:'/combat/targetHP',equals:0},{path:'/combat/bonus',equals:1}],hint:'Space 攻击，三消得金币后 U 升级；升级从下一 Tick 增伤，击败敌人才过关。'});
}
{
 const g=runnerLevel(true);write('H03',g,[{raw:[raw('down',1,0.15,0.5),raw('down',2,0.85,0.5)],ticks:110,checks:[{path:'/runner/checkpoints',equals:1},{path:'/runner/kills',equals:1},{path:'/world/nextId',equals:1}],hudIncludes:['击退 1','检查点 1/2'],capture:'move-and-fire'}, {actions:[press('right'),release('right'),press('fire'),release('fire')],ticks:80,checks:[{path:'/runner/checkpoints',equals:1},{path:'/world/nextId',equals:2}],capture:'blocked-projectile'},act('right',70)],[{raw:[raw('down',1,0.85,0.5)],ticks:300}],{title:'换道与射击',negativeExpected:'lost',hint:'左区左移、中区右移、右区开火；双指左移并射击，再右移两次过检查点；←/→ 和 Space 可操作。',checks:[{path:'/runner/checkpoints',equals:2},{path:'/runner/kills',equals:1},{path:'/world/nextId',equals:2},{path:'/world/spawned',equals:[0,1,2,3]},{path:'/world/bodies',equals:[body('hero','actor',6000,1000,{value:0})]}],negativeChecks:[{path:'/runner/crashed',equals:true},{path:'/runner/kills',equals:0}]});
}
{
 const g=physical([body('a','target',3000,160,{hx:160,hy:160,value:2}),body('b','target',5000,160,{hx:160,hy:160,value:2})],{merge:true,tiltGravityPath:'/control/axis',goalScore:4,maxTicks:300});controller(g,{dragAction:'drag',tiltAction:'tilt',axisFromDrag:true});addInput(g,sensor('drag','touch.drag','vec2'));addInput(g,sensor('tilt','imu.tilt','vec2'));g.outcomes[0].when=op('and',s('/world/won'),s('/control/usedInput'));write('H04',g,[pointer('down',4000,3000),pointer('move',7500,3000,1,80)],[wait(300)],{title:'物理合成与倾斜',negativeExpected:'lost',hint:'倾斜或拖动施加水平重力，碰壁后两枚同色球合成。'});
}
{
 const g=cloneGame('puzzle-placement');noUndo(g);timer(g,1200);touchCells(g,'drag-select');write('H05',g,[wait(1),{pause:true,ticks:5000,resume:true},...['cell0','cell1','cell2','cell3'].map(a=>act(a))],[wait(1201)],{title:'找物与限时关卡',negativeExpected:'lost',hint:'20 秒内把物品归位；暂停冻结逻辑倒计时。'});
}
save('project/game-candidates.json',{format:'a2game-game-candidates',profile:'bounded-reference-levels-v1',frozenGames:32,independentHybrids:5,verifiedGames:0,verifiedHybrids:0,scope:'Individual playable candidate definitions; full Gate requires genuine independent Agent G3, applicable physical input and complete gameplay DoD. No coverage registry status is promoted by this generator.',cases:records});
console.log(`Wrote ${records.length} individual Gxx/Hxx candidates and positive/negative conformance.`);
