import {readFileSync,writeFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync('specs/v0.1/schemas/game.schema.json','utf8')),stage=schema.$defs.visualStage;
const num={type:'number',minimum:-10000,maximum:10000};
const binding={oneOf:[num,{type:'object',properties:{state:{type:'string',pattern:'^/(?:[^~]|~[01])+$'},scale:num,offset:num},required:['state'],additionalProperties:false}]};
const vector=items=>({type:'array',items,minItems:3,maxItems:3});
stage.properties.bindingProfile={const:'numeric-pointer-v1'};
stage.allOf=[{if:{not:{required:['bindingProfile']}},then:{properties:{nodes:{items:{properties:{
 at:vector({oneOf:[num,{type:'object',properties:{state:{type:'string',pattern:'^/(?:[^~/]|~[01])+$'}},required:['state'],additionalProperties:false}]}),
 size:vector({type:'number',exclusiveMinimum:0,maximum:10000}),rotation:vector(num)
}}}}}}];
for(const key of ['at','rotation','size'])stage.properties.nodes.items.properties[key]=vector(binding);
schema.$defs.scene2d.properties.bodyLayer.properties.circleKinds={type:'array',maxItems:5,uniqueItems:true,items:{enum:['actor','solid','target','projectile','pickup']}};
schema.$defs.scene2d.properties.bodyLayer.properties.valuePalette={type:'object',maxProperties:128,additionalProperties:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}};
schema.$defs.scene2d.properties.bodyLayer.properties.showValues={type:'boolean'};
writeFileSync('specs/v0.1/schemas/game.schema.json',JSON.stringify(schema,null,2)+'\n');
for(const [name,description] of [['bound-stage','Capability-gated numeric-pointer-v1 bindings for nested numeric positions, rotations and size; affine scale/offset only, pure projection.'],['body-style','Read-only circle/rectangle styling of bounded world bodies; visual style does not change the AABB physics profile.']]){
 const m={format:'a2game-capability',manifestVersion:'0.1.0',id:'a2game.visual.'+name,version:'0.1.0',kind:'presentation',portability:'host-defined',description,phase:'present',dependencies:[{id:name==='bound-stage'?'a2game.visual.stage':'a2game.visual.scene2d',version:'0.1.0'}],contract:{configSchema:{type:'object',additionalProperties:false},stateSchema:{type:'object',additionalProperties:false},commands:[],events:[],stateWrites:[],lifecycle:['initialize','tick','pause','resume','reset','dispose']},limits:{maxNodes:128,maxResolvedMagnitude:10000,expressions:'numeric JSON pointer plus scale/offset only; no scripts'},testSuites:['BOUND-VISUAL-001']};
 writeFileSync(`specs/v0.1/samples/capabilities/${m.id}.capability.json`,JSON.stringify(m,null,2)+'\n');
}
