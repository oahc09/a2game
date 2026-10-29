/** Additive, versioned visual-stage schema/manifest and a reference game; preserves older fixtures. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const save=(p,data)=>writeFileSync(resolve(root,p),JSON.stringify(data,null,2)+'\n');
const number={type:'number',minimum:-10000,maximum:10000},positive={type:'number',exclusiveMinimum:0,maximum:10000};
const vector=item=>({type:'array',items:item,minItems:3,maxItems:3});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const name={type:'string',pattern:'^[_A-Za-z][_A-Za-z0-9-]*$'},color={type:'string',pattern:'^#[A-Fa-f0-9]{6}$'},asset={type:'string',minLength:1};
const node=object({id:name,kind:{enum:['mesh','sprite']},geometry:{enum:['box','sphere','plane']},at:vector({oneOf:[number,object({state:{type:'string',pattern:'^/(?:[^~/]|~[01])+$'}})]}),size:vector(positive),rotation:vector(number),spin:vector(number),color,asset,material:{enum:['unlit','standard']}},['id','kind','at','size','color']);
node.allOf=[{if:{properties:{kind:{const:'mesh'}}},then:{required:['geometry']}},{if:{properties:{kind:{const:'sprite'}}},then:{required:['asset']}}];
const stage=object({camera:object({projection:{enum:['perspective','orthographic']},at:vector(number),target:vector(number),near:{type:'number',exclusiveMinimum:0},far:{type:'number',exclusiveMinimum:0,maximum:10000},fov:{type:'number',minimum:10,maximum:120},orthoHeight:{type:'number',exclusiveMinimum:0,maximum:1000}}),
  nodes:{type:'array',maxItems:128,items:node},
  particles:{type:'array',maxItems:8,items:object({id:name,count:{type:'integer',minimum:1,maximum:128},origin:vector(number),spread:vector(number),velocity:vector(number),size:{type:'number',exclusiveMinimum:0,maximum:10},color,periodTicks:{type:'integer',minimum:1,maximum:36000}})},
  audio:{type:'array',maxItems:8,items:object({id:name,asset,event:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_.-]{0,95}$'},volume:{type:'number',minimum:0,maximum:1}})}},['camera','nodes']);
const path='specs/v0.1/schemas/game.schema.json',schema=read(path);schema.$defs.visualStage=stage;schema.properties.presentation.properties.stage={$ref:'#/$defs/visualStage'};save(path,schema);
save('specs/v0.1/capabilities/a2game.visual.stage.capability.json',{format:'a2game-capability',manifestVersion:'0.1.0',id:'a2game.visual.stage',version:'0.1.0',kind:'presentation',portability:'host-defined',description:'Versioned camera, textured sprites, mesh/material presets, tick-projected animation, bounded particles and event audio; read-only logical state.',phase:'present',dependencies:[{id:'a2game.visual.scene2d',version:'0.1.0'}],contract:{configSchema:stage,stateSchema:object({}),commands:[],events:[],stateWrites:[],lifecycle:['initialize','tick','pause','resume','reset','dispose']},testSuites:['VISUAL-STAGE-001']});
const game=read('specs/v0.1/games/tap-target.game.json');game.id='org.a2game.samples.visual-stage';game.revision=1;game.meta.title='通用 3D 表现与资源';game.world.dimension='3d';game.requires.all.push({id:'a2game.visual.stage',version:'0.1.0'});
const entries=read('project/asset-policy.json').entries;game.assets={checker:{uri:entries[0].uri,type:'image',integrity:entries[0].integrity},tone:{uri:entries[1].uri,type:'audio',integrity:entries[1].integrity}};
game.presentation.scene2d.nodes=[{id:'title',kind:'text',at:[0,2.5],fontSize:0.32,fill:'#b5cee8',text:{literal:'A2Game / Shared 3D Stage'}},{id:'help',kind:'text',at:[0,-2.5],fontSize:0.17,fill:'#9fb8d2',text:{literal:'Space / Tap to collect'}}];
game.presentation.stage={camera:{projection:'perspective',at:[0,1.5,8],target:[0,0,0],near:0.1,far:100,fov:45,orthoHeight:6},nodes:[
 {id:'cube',kind:'mesh',geometry:'box',at:[-1.2,0,0],size:[1.5,1.5,1.5],rotation:[0.25,0.4,0],spin:[0,0.8,0],color:'#57d7c8',material:'standard',asset:'checker'},
 {id:'sprite',kind:'sprite',at:[1.2,0,0],size:[1.5,1.5,1],color:'#ffffff',asset:'checker'},
 {id:'scoreOrb',kind:'mesh',geometry:'sphere',at:[{state:'/score'},-1.3,-2],size:[0.4,0.4,0.4],color:'#ecb963',material:'unlit'}],
 particles:[{id:'sparks',count:12,origin:[0,1.5,0],spread:[5,1,1],velocity:[0,-0.2,0],size:0.08,color:'#ecb963',periodTicks:120}],
 audio:[{id:'collectSound',asset:'tone',event:'input.action',volume:0.25}]};
game.tests=['../tests/visual-stage.conformance.json'];save('specs/v0.1/games/visual-stage.game.json',game);
save('specs/v0.1/tests/visual-stage.conformance.json',{format:'a2game-conformance',specVersion:'0.1.0',suiteId:'visual-stage-reference',subject:{type:'game',id:game.id,file:'../games/visual-stage.game.json'},cases:[{id:'VISUAL-STAGE-001',seed:42,steps:[{op:'start'},{op:'injectAction',action:'collect',phase:'press'},{op:'step',ticks:1},{op:'assert',path:'/state/score',equals:1},{op:'pause'},{op:'step',ticks:5},{op:'assert',path:'/tickIndex',equals:1},{op:'restart'},{op:'assert',path:'/state/score',equals:0}]}]});
console.log('Wrote additive visual-stage schema, manifest, game and conformance contract.');
