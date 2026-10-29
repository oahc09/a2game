import {readFileSync,writeFileSync} from 'node:fs';
const ref=id=>({id,version:'0.1.0'}),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const base=JSON.parse(readFileSync('specs/v0.1/games/tap-target.game.json','utf8'));
export const body=(id,kind,x,y,extra={})=>({id,kind,x,y,vx:0,vy:0,hx:100,hy:100,hp:1,team:kind==='actor'?1:2,value:1,fixed:false,...extra});
export const world=bodies=>({bodies,score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false});
const actor=()=>body('hero','actor',1000,100,{team:1});
const levels=[
 {name:'realtime-jump',title:'固定 Tick 蓄力跳跃',bodies:[actor()],options:{gravity:-4,jumpSpeed:80,actions:{charge:'charge',jump:'jump'}},steps:[{ticks:1},{action:'jump',ticks:1}],checks:[{path:'/world/bodies/0/vy',equals:76}]},
 {name:'realtime-flappy',title:'重力与触发奖励',bodies:[body('hero','actor',1000,2000,{vy:-64}),body('reward','pickup',1000,1900)],options:{gravity:-4,goalScore:1},steps:[{ticks:1}],checks:[{path:'/world/score',equals:1}],expected:'won'},
 {name:'realtime-lanes',title:'换道与滚动',bodies:[actor(),body('obstacle','target',3000,4000,{fixed:false})],options:{actions:{laneRight:'laneRight'},laneWidth:1000,scrollSpeed:-64},steps:[{action:'laneRight',ticks:1}],checks:[{path:'/world/bodies/0/x',equals:2000}]},
 {name:'realtime-bounce',title:'碰撞反弹与接触',bodies:[body('ball','actor',1880,2000,{vx:128}),body('wall','solid',2100,2000,{fixed:true})],options:{restitution:1000},steps:[{ticks:1}],checks:[{path:'/world/bodies/0/vx',equals:-128}]},
 {name:'realtime-constraint',title:'约束边界',bodies:[body('ball','actor',1950,2000,{vx:128})],options:{constraints:[{body:'ball',minX:0,maxX:2100,minY:0,maxY:6000}]},steps:[{ticks:1}],checks:[{path:'/world/bodies/0/x',equals:2000}]},
 {name:'realtime-merge',title:'物理接触合成',bodies:[body('a','target',2000,2000),body('b','target',2100,2000)],options:{merge:true,goalScore:2},steps:[{ticks:1}],checks:[{path:'/world/score',equals:2}],expected:'won'},
 {name:'realtime-projectile',title:'弹丸与命中去重',bodies:[body('hero','actor',1000,2000),body('target','target',1200,2000)],options:{actions:{fire:'fire'},weapon:'projectile',projectileSpeed:128,damage:1,goalScore:1},steps:[{action:'fire',ticks:1}],checks:[{path:'/world/score',equals:1}],expected:'won'},
 {name:'realtime-hitscan',title:'射线武器与冷却',bodies:[body('hero','actor',1000,2000),body('target','target',4000,2000,{hp:2})],options:{actions:{fire:'fire'},weapon:'hitscan',damage:1,cooldownTicks:2,goalScore:1},steps:[{action:'fire',ticks:1},{action:'fire',ticks:1},{action:'fire',ticks:1}],checks:[{path:'/world/score',equals:1}],expected:'won'},
 {name:'realtime-waves',title:'波次与有限对象池',bodies:[body('hero','actor',1000,2000)],options:{maxObjects:2,autoFire:true,weapon:'hitscan',autoTarget:true,cooldownTicks:1,goalScore:2,waves:[{tick:0,body:body('wave_a','target',2000,2000)},{tick:1,body:body('wave_b','target',3000,2000)}]},steps:[{ticks:2}],checks:[{path:'/world/score',equals:2}],expected:'won'},
 {name:'realtime-seek',title:'追踪与无敌时间',bodies:[body('hero','actor',1000,2000,{hp:3}),body('target','target',1190,2000)],options:{seekSpeed:64,invulnerabilityTicks:30},steps:[{ticks:3}],checks:[{path:'/world/bodies/0/hp',equals:2}]}
];
const cases=[];
for(const level of levels){
 const game=structuredClone(base);game.id='org.a2game.samples.'+level.name;game.revision=1;game.meta={title:level.title,genres:['casual'],description:'共享整数物理和战斗参考；按钮输入，唯一逻辑时钟。'};
 game.requires={all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text','a2game.realtime.world'].map(ref)};
 const cfg={statePath:'/world',width:8000,height:6000,...level.options};game.scenes=[{id:'main',entities:[{id:'controller',components:[{capability:ref('a2game.realtime.world'),config:cfg}]}]}];game.entryScene='main';game.state={world:{type:'object',initial:world(level.bodies)}};
 const actions=Object.values(level.options.actions??{});game.inputs={actions:[...new Set(actions)].map((id,index)=>({id,valueType:'button',bindings:[{source:'keyboard.button',config:{code:'Key'+String.fromCharCode(65+index)}}]}))};
 game.rules=[];game.outcomes=[{id:'won',status:'won',when:{state:'/world/won'}},{id:'lost',status:'lost',when:{state:'/world/lost'}}];
 game.presentation={hud:[{id:'score',kind:'text',bind:{text:{template:'得分 {0}',args:[{state:'/world/score'}]}}}],cues:[],scene2d:{width:10,height:8,background:'#0d1729',nodes:[{id:'title',kind:'text',at:[0,3.4],fontSize:0.27,fill:'#b5cee8',text:{literal:level.title}}],bodyLayer:{statePath:'/world/bodies',unitsPerMeter:1000,origin:[-4,-3],palette:{actor:'#57d7c8',solid:'#a8c5d9',target:'#dc6d78',projectile:'#f5d26f',pickup:'#bd86d9'}}}};
 game.tests=[`../tests/${level.name}.conformance.json`];save(`specs/v0.1/games/${level.name}.game.json`,game);
 const steps=[{op:'start'},...level.steps.flatMap(row=>[...(row.action?[{op:'injectAction',action:row.action,phase:'press'},{op:'injectAction',action:row.action,phase:'release'}]:[]),{op:'step',ticks:row.ticks}]),...level.checks.map(row=>({op:'assert',path:'/state'+row.path,equals:row.equals})),{op:'assert',path:'/flow/status',equals:level.expected??'playing'},{op:'restart'},{op:'assert',path:'/state/world/score',equals:0}];
 save(`specs/v0.1/tests/${level.name}.conformance.json`,{format:'a2game-conformance',specVersion:'0.1.0',suiteId:level.name,subject:{type:'game',id:game.id,file:`../games/${level.name}.game.json`},cases:[{id:'REALTIME-WORLD-001',seed:42,steps}]});
 cases.push({name:level.name,steps:level.steps,checks:level.checks,expected:level.expected??'playing'});
}
save('project/realtime-reference-cases.json',{format:'a2game-mechanism-cases',cases});console.log(`Wrote ${cases.length} realtime references.`);
