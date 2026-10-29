/** Versioned contracts first; implementations and reference games bind these exact IDs. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),directory=resolve(root,'specs/v0.1/capabilities');
const int=(minimum,maximum)=>({type:'integer',minimum,maximum}),str={type:'string',minLength:1};
const list=(items,maxItems=256)=>({type:'array',items,maxItems});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const common={statePath:{type:'string',pattern:'^/(?:[^~/]|~[01])+$'},width:int(1,16),height:int(1,16),selectActions:list(str),undoAction:str,targetScore:int(1,1000000)};
const tileOptions={matchLength:int(2,8),capacity:int(1,32),blockers:list(list(int(0,255))),variant:{enum:['memory','mahjong']},closeTicks:int(1,600),directions:list({enum:['left','right','up','down']}),targets:list(int(0,256)),pieces:list(list({type:'array',items:int(0,3),minItems:2,maxItems:2},16),16),rotateAction:str,leftAction:str,rightAction:str,dropAction:str,fallTicks:int(1,600)};
export const behaviorContracts={
 'a2game.puzzle.swap':{mode:'match',services:['match-n','cascade','gravity-fill'],fields:['matchLength']},
 'a2game.puzzle.tray':{mode:'tray',services:['layered-stack','match-n'],fields:['matchLength','capacity','blockers']},
 'a2game.puzzle.pair-match':{mode:'pair',services:['occlusion','reveal'],fields:['variant','closeTicks','blockers']},
 'a2game.puzzle.direction':{mode:'arrows',services:['occupancy'],fields:['directions']},
 'a2game.puzzle.placement':{mode:'placement',services:['select','polyomino','line-clear'],fields:['targets','pieces','rotateAction']},
 'a2game.puzzle.falling-piece':{mode:'falling',services:['polyomino','rotate-piece','line-clear'],fields:['pieces','rotateAction','leftAction','rightAction','dropAction','fallTicks']},
 'a2game.puzzle.sort':{mode:'sort',services:['select'],fields:['capacity']},
 'a2game.puzzle.connected-match':{mode:'connected',services:['match-n','occupancy'],fields:['matchLength']}
};
export const puzzleServices=['grid','occupancy','match-n','cascade','gravity-fill','layered-stack','occlusion','reveal','polyomino','rotate-piece','line-clear','select','undo','merge'];
function manifest(id,kind,configSchema,dependencies,description){return {format:'a2game-capability',manifestVersion:'0.1.0',id,version:'0.1.0',kind,portability:'exact',description,phase:'simulate',dependencies,contract:{configSchema,stateSchema:{type:'object'},commands:[],events:kind==='behavior'?[{name:'puzzle.changed',payloadSchema:{type:'object'}},{name:'puzzle.invalid',payloadSchema:{type:'object'}},{name:'puzzle.undone',payloadSchema:{type:'object'}}]:[],stateWrites:kind==='behavior'?['global']:[],lifecycle:['initialize','tick','pause','resume','reset','dispose']},limits:id.startsWith('a2game.puzzle.')?{maxCells:256,maxHistory:16,maxCascadeWaves:16,pieceGridSize:4,maxPieceCells:16,undoScope:'single-behavior scene; whole-session snapshots for compositions'}:{},testSuites:['PUZZLE-LIBRARY-001']};}
const ref=id=>({id,version:'0.1.0'}),save=m=>writeFileSync(resolve(directory,m.id+'.capability.json'),JSON.stringify(m,null,2)+'\n');
for(const name of puzzleServices)save(manifest('a2game.puzzle.'+name,'service',object({}),[ref('a2game.core.state')],`Trusted shared puzzle library service: ${name}; consumed by versioned behavior implementations, never executable JSON.`));
for(const [id,entry] of Object.entries(behaviorContracts)){
 const properties={...common,...Object.fromEntries(entry.fields.map(name=>[name,tileOptions[name]]))};
 const config=object(properties,['statePath','width','height','selectActions']);
 if(entry.mode==='placement')config.oneOf=[{required:['pieces']},{required:['targets']}];
 save(manifest(id,'behavior',config,[ref('a2game.core.state'),ref('a2game.puzzle.grid'),ref('a2game.puzzle.undo'),...entry.services.map(name=>ref('a2game.puzzle.'+name))],`Shared ${entry.mode} mechanism; transactional state proposals, legal-action checks, bounded undo and deterministic RNG.`));
}
for(const [alias,original] of [['push','grid-push'],['slide','grid-slide-merge']]){
 const source=JSON.parse(readFileSync(resolve(directory,`a2game.puzzle.${original}.capability.json`),'utf8'));source.id='a2game.puzzle.'+alias;
 source.description+=' Bounded history and RNG restoration are available through historyPath/undoAction.';
 source.contract.configSchema.properties.historyPath=common.statePath;source.contract.configSchema.properties.undoAction=str;
 source.contract.configSchema.dependentRequired={historyPath:['undoAction'],undoAction:['historyPath']};
 source.dependencies=[...source.dependencies,ref('a2game.puzzle.undo')];source.contract.events.push({name:'puzzle.undone',payloadSchema:{type:'object'}});source.testSuites=['PUZZLE-UNDO-001'];save(source);
}
for(const name of ['goal','rng','score','timer'])save(manifest('a2game.core.'+name,'core',object({}),[ref('a2game.core.state')],`Existing shared Runtime ${name} service exposed explicitly for catalog composition; no new per-game behavior.`));
console.log(`Wrote ${puzzleServices.length+Object.keys(behaviorContracts).length+6} puzzle/core capability contracts.`);
