/** One-time authoring expansion; presets are not read by the runtime. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const dir=import.meta.dirname,root=resolve(dir,'../../..');
for(const name of ['game.json','conformance.json','solution.json'])if(existsSync(join(dir,name)))throw Error('Refusing to overwrite '+name);
const template=JSON.parse(readFileSync(join(root,'specs/v0.1/games/visual-stage.game.json'),'utf8'));
const theme=JSON.parse(readFileSync(join(root,'assets/themes/woodland-props-3d.json'),'utf8'));
const instance=(kind,prefix,origin)=>theme.props[kind].map(node=>({...node,id:prefix+'-'+node.id,at:node.at.map((value,index)=>value+origin[index])}));
template.id='org.a2game.phase2.woodland-props-stage';template.revision=1;
template.meta={title:'林间小站 · 道具展示',description:'按空格或点击“收集”两次，让小光球走到终点。这里展示树、岩石和货箱的组合模型。',author:'Cindy native subagent original CC0 authoring preset; reference collect mechanic',genres:['casual']};
template.assets={};delete template.tests;
template.presentation.hud=[{id:'score',kind:'text',text:'已收集',bind:{text:{template:'已收集 {0} / {1}',args:[{state:'/score'},{state:'/goal'}]}}},{id:'collect-label',kind:'button',text:'收集',bind:{action:'collect'}}];
template.presentation.scene2d.background='#112933';template.presentation.scene2d.nodes=[{id:'title',kind:'text',at:[0,2.52],fontSize:0.30,fill:'#e5efda',text:{literal:'林间小站'}},{id:'help',kind:'text',at:[0,-2.55],fontSize:0.18,fill:'#d0dfc3',text:{literal:'空格 / 收集：让光球到达右侧'}}];
template.presentation.stage={camera:{projection:'perspective',at:[5,4.6,9.8],target:[0,0.45,0],near:0.1,far:80,fov:38,orthoHeight:6},nodes:[
 {id:'island-base',kind:'mesh',geometry:'box',at:[0,-0.25,0],size:[6.8,0.5,3.7],color:'#4c6958',material:'standard'},
 {id:'island-top',kind:'mesh',geometry:'box',at:[0,0.015,0],size:[6.85,0.08,3.75],color:'#9bad7d',material:'standard'},
 {id:'path',kind:'mesh',geometry:'box',at:[0,0.07,0.8],size:[5.6,0.06,0.9],color:'#d9c79c',material:'standard'},
 ...instance('tree','tree-a',[-2.45,0,-0.6]),...instance('tree','tree-b',[2.25,0,-1]),...instance('rock','rock-a',[-0.95,0,-0.7]),...instance('crate','crate-a',[0.7,0,-0.55]),
 {id:'collect-orb',kind:'mesh',geometry:'sphere',at:[{state:'/score'},0.28,0.82],size:[0.3,0.3,0.3],color:'#ffda78',material:'unlit'}
 ],particles:[],audio:[]};
const input=[{op:'injectAction',action:'collect',phase:'press'},{op:'injectAction',action:'collect',phase:'release'},{op:'step',ticks:1}];
const suite={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'woodland-props-stage',subject:{type:'game',id:template.id,file:'game.json'},cases:[{id:'collect-two',seed:42,steps:[{op:'start'},...input,{op:'assert',path:'/state/score',equals:1},{op:'assert',path:'/flow/status',equals:'playing'},...input,{op:'assert',path:'/state/score',equals:2},{op:'assert',path:'/flow/status',equals:'won'}]},{id:'pause-and-incomplete-goal',seed:42,steps:[{op:'start'},{op:'pause'},{op:'step',ticks:1},{op:'assert',path:'/state/score',equals:0},{op:'assert',path:'/flow/status',equals:'paused'},{op:'resume'},...input,{op:'assert',path:'/state/score',equals:1},{op:'assert',path:'/flow/status',equals:'playing'}]}]};
for(const [name,value]of Object.entries({'game.json':template,'conformance.json':suite,'solution.json':[{action:'collect',ticks:1},{action:'collect',ticks:1}]}))writeFileSync(join(dir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log('Created independent visual-stage collect example; no external runtime assets.');
