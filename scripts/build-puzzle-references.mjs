/** Hand-authored small levels and expected outcomes. No implementation is called to invent expectations. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const save=(path,value)=>writeFileSync(resolve(root,path),JSON.stringify(value,null,2)+'\n');
const ref=id=>({id,version:'0.1.0'}),domino=[[0,0],[1,0]];
export const levels=[
 {name:'puzzle-match',title:'交换与三消连锁',cap:'swap',width:3,height:3,board:[1,2,1,3,1,4,4,3,2],options:{matchLength:3,targetScore:3},invalid:[0,2],solve:[1,4]},
 {name:'puzzle-tray',title:'遮挡与三连槽位',cap:'tray',width:3,height:2,board:[1,2,1,2,1,2],options:{matchLength:3,capacity:4,blockers:[[3],[],[],[],[],[]]},invalid:[0],solve:[1,3,5,0,2,4]},
 {name:'puzzle-mahjong',title:'开放边缘配对',cap:'pair-match',width:4,height:1,board:[1,2,2,1],options:{variant:'mahjong',blockers:[[],[],[],[]]},invalid:[1],solve:[0,3,1,2]},
 {name:'puzzle-memory',title:'记忆翻牌',cap:'pair-match',width:2,height:2,board:[1,2,1,2],options:{variant:'memory',closeTicks:2},solve:[0,2,1,3]},
 {name:'puzzle-arrows',title:'箭头路径消除',cap:'direction',width:3,height:1,board:[1,1,1],options:{directions:['right','right','right']},invalid:[0],solve:[2,1,0]},
 {name:'puzzle-polyomino',title:'多格放置与消行',cap:'placement',width:2,height:2,board:[0,0,0,0],options:{pieces:[domino,domino],rotateAction:'rotate',targetScore:2},invalid:[1],solve:[0,2]},
 {name:'puzzle-falling',title:'旋转落块',cap:'falling-piece',width:4,height:4,board:[0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],options:{pieces:[domino],rotateAction:'rotate',leftAction:'left',rightAction:'right',dropAction:'drop',fallTicks:30,targetScore:1},solve:['drop']},
 {name:'puzzle-placement',title:'物品归位',cap:'placement',width:2,height:2,board:[1,0,2,0],options:{targets:[0,1,0,2]},invalid:[0,3],solve:[0,1,2,3]},
 {name:'puzzle-sort',title:'颜色容器整理',cap:'sort',width:4,height:2,board:[],tubes:[[1,2],[2,1],[],[]],options:{capacity:2},invalid:[2],solve:[0,2,1,3,0,3,1,2]},
 {name:'puzzle-connected',title:'连通消除与悬空掉落',cap:'connected-match',width:2,height:2,board:[1,1,2,2],options:{matchLength:2},solve:[0]}
];
const palette={'-1':'#0d1729','0':'#35465e','1':'#57d7c8','2':'#ecb963','3':'#4b9bd5','4':'#bd86d9','5':'#dc6d78','6':'#a8c5d9','7':'#f5d26f'};
const press=action=>[{op:'injectAction',action,phase:'press'},{op:'injectAction',action,phase:'release'},{op:'step',ticks:1}];
const cases=[];
for(const level of levels){
 const count=level.cap==='sort'?level.width:level.cap==='falling-piece'?0:level.width*level.height;
 const selects=Array.from({length:count},(_,i)=>`cell${i}`),names=[...selects,'undo',...['rotateAction','leftAction','rightAction','dropAction'].flatMap(key=>level.options[key]?[level.options[key]]:[])];
 const codes=names.map((_,index)=>index<9?`Digit${index+1}`:`Key${String.fromCharCode(65+index-9)}`);
 let display=level.board.map(value=>value||-1);if(level.cap==='pair-match'&&level.options.variant==='memory')display=display.map(()=>0);
 if(level.options.blockers)display=display.map((value,index)=>level.options.blockers[index].length?0:value);
 if(level.cap==='sort')display=Array.from({length:level.width*level.height},(_,index)=>level.tubes[index%level.width][level.height-1-Math.floor(index/level.width)]??0);
 const anchor=Math.floor(level.width/2),preview=level.options.pieces?level.options.pieces[0].map(([x,y])=>y*4+x):[];
 if(level.cap==='falling-piece')for(const [x,y] of level.options.pieces[0])display[y*level.width+anchor+x]=7;
 const initial={board:level.board,display,preview,selected:[],removed:[],tray:[],tubes:level.tubes??[],score:0,moves:0,won:false,lost:false,history:[],closeAt:-1,active:0,anchor,rotation:0};
 const cfg={statePath:'/puzzle',width:level.width,height:level.height,selectActions:selects,undoAction:'undo',...level.options};
 const step=Math.min(0.85,4.8/level.width,3.6/level.height),origin=[-(level.width-1)*step/2,(level.height-1)*step/2];
 const game={format:'a2game',specVersion:'0.1.0',id:'org.a2game.samples.'+level.name,revision:1,meta:{title:level.title,genres:['puzzle'],description:'选择右侧 cell 按钮；undo 撤销棋盘与 RNG，终局后可重开。'},requires:{all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.core.goal','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text','a2game.puzzle.'+level.cap].map(ref)},world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:42,maxCatchUpTicks:8}},scenes:[{id:'main',entities:[{id:'controller',components:[{capability:ref('a2game.puzzle.'+level.cap),config:cfg}]}]}],entryScene:'main',state:{puzzle:{type:'object',initial}},inputs:{actions:names.map((id,index)=>({id,valueType:'button',policy:'first-ready',bindings:[{source:'keyboard.button',config:{code:codes[index]}}]}))},rules:[],outcomes:[{id:'complete',status:'won',priority:0,when:{state:'/puzzle/won'}},{id:'failed',status:'lost',priority:1,when:{state:'/puzzle/lost'}}],presentation:{hud:[{id:'score',kind:'text',bind:{text:{template:'分数 {0} · 操作 {1}',args:[{state:'/puzzle/score'},{state:'/puzzle/moves'}]}}}],cues:[],scene2d:{width:8,height:6,background:'#0d1729',nodes:[{id:'title',kind:'text',at:[0,2.5],fontSize:0.32,fill:'#b5cee8',text:{literal:level.title}},{id:'hint',kind:'text',at:[0,-2.65],fontSize:0.17,fill:'#9fb8d2',text:{literal:'cell0… 按行从左到右 · undo 撤销'}}],repeat:[
   {id:'board',source:{state:'/puzzle/display'},columns:level.width,origin,step:[step,step],indexMode:'array',template:[{id:'tile',kind:'rect',at:[0,0],size:[step*0.92,step*0.92],fill:{from:{item:true},map:palette,fallback:'#a8c5d9'}},{id:'value',kind:'text',at:[0,0],fontSize:step*0.35,fill:'#ffffff',text:level.cap==='direction'?{literal:'→'}:{item:true},omitWhen:[-1,0]}]},
   {id:'selection',source:{state:'/puzzle/selected'},columns:level.width,origin,step:[step,step],indexMode:'cell',template:[{id:'mark',kind:'circle',at:[-step*0.3,step*0.3],radius:step*0.08,fill:'#f5d26f'}]},
   {id:'tray',source:{state:'/puzzle/tray'},columns:8,origin:[-1.8,-1.9],step:[0.45,0.45],indexMode:'array',template:[{id:'tile',kind:'rect',at:[0,0],size:[0.4,0.4],fill:{from:{item:true},map:palette,fallback:'#a8c5d9'}}]},
   {id:'preview',source:{state:'/puzzle/preview'},columns:4,origin:[2.3,1.6],step:[0.32,0.32],indexMode:'cell',template:[{id:'cell',kind:'rect',at:[0,0],size:[0.29,0.29],fill:'#f5d26f'}]}
 ]}},tests:[`../tests/${level.name}.conformance.json`]};
 const action=index=>typeof index==='number'?selects[index]:index;
 const steps=[{op:'start'},...(level.invalid??[]).flatMap(index=>press(action(index))),...(level.invalid?.length?[{op:'assertEvent',eventType:'puzzle.invalid',count:1}]:[]),...level.solve.flatMap(index=>press(action(index))),{op:'assert',path:'/flow/status',equals:'won'},{op:'restart'},{op:'assert',path:'/state/puzzle/score',equals:0}];
 save(`specs/v0.1/samples/games/${level.name}.game.json`,game);save(`specs/v0.1/samples/tests/${level.name}.conformance.json`,{format:'a2game-conformance',specVersion:'0.1.0',suiteId:level.name,subject:{type:'game',id:game.id,file:`../games/${level.name}.game.json`},cases:[{id:'PUZZLE-LIBRARY-001',seed:42,steps}]});
 cases.push({name:level.name,invalid:(level.invalid??[]).map(action),solve:level.solve.map(action),expected:'won'});
}
for(const [name,source,original,alias,first] of [['puzzle-push-undo','grid-push','grid-push','push','moveRight'],['puzzle-slide-undo','grid-merge-spawn','grid-slide-merge','slide','moveLeft']]){
 const game=read(`specs/v0.1/samples/games/${source}.game.json`);game.id='org.a2game.samples.'+name;game.revision=1;game.meta.title+=' · 撤销';
 game.requires.all=game.requires.all.map(cap=>cap.id==='a2game.puzzle.'+original?ref('a2game.puzzle.'+alias):cap);
 game.state.history={type:'array',initial:[]};game.inputs.actions.push({id:'undo',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'KeyZ'}}]});
 const comp=game.scenes[0].entities[0].components[0];comp.capability=ref('a2game.puzzle.'+alias);comp.config.historyPath='/history';comp.config.undoAction='undo';game.tests=[`../tests/${name}.conformance.json`];
 const path=alias==='slide'?'/board':'/moves',value=game.state[path.slice(1)].initial;
 save(`specs/v0.1/samples/games/${name}.game.json`,game);save(`specs/v0.1/samples/tests/${name}.conformance.json`,{format:'a2game-conformance',specVersion:'0.1.0',suiteId:name,subject:{type:'game',id:game.id,file:`../games/${name}.game.json`},cases:[{id:'PUZZLE-UNDO-001',seed:42,steps:[{op:'start'},...press(first),...press('undo'),{op:'assert',path:'/state'+path,equals:value},{op:'assert',path:'/state/history',equals:[]}]}]});
 cases.push({name,invalid:[],solve:[first,'undo'],expected:'playing'});
}
save('project/puzzle-reference-cases.json',{format:'a2game-puzzle-reference-cases',cases});
console.log(`Wrote ${cases.length} reference games/conformance recipes.`);
