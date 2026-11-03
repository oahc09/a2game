import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getPublicCapability} from '../generator/catalog.mjs';
import {readPublicResource} from '../integrations/mcp/resources.mjs';
import {simulatePuzzle,validatePuzzleDefinition} from '../dist/modules/puzzle.js';
import {initialDefenseState,validateDefenseDefinition} from '../dist/modules/tower-defense.js';
import {validateIntegerWorld} from '../dist/modules/realtime.js';
import {GameRng} from '../dist/rng.js';
import {makeRegistry} from '../scripts/registry.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const ids=['a2game.puzzle.swap','a2game.strategy.tower-defense','a2game.realtime.world'];
const manifest=id=>JSON.parse(readFileSync(new URL('../specs/v0.1/capabilities/'+id+'.capability.json',import.meta.url)));
const runPython=(code,data)=>{const r=spawnSync('python',['-c',code],{cwd:root,input:JSON.stringify(data),encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);};
const schemaCheck=(id,valid,invalid=[])=>runPython(`import json,sys\nfrom jsonschema import Draft202012Validator\nx=json.load(sys.stdin); v=Draft202012Validator(x['schema'])\nfor state in x['valid']: v.validate(state)\nfor state in x['invalid']: assert not v.is_valid(state),state\n`,{schema:manifest(id).contract.stateSchema,valid,invalid});

test('public get_capability exposes complete state schemas and non-level semantics without protocol bump',()=>{
 for(const id of ids){const m=getPublicCapability({id,version:'0.1.0'});assert.deepEqual(m,manifest(id));assert.equal(m.version,'0.1.0');assert.ok(Object.keys(m.contract.stateSchema.properties).length>10);assert.equal(m.extensions.publicSemantics.scope,'PUBLIC_MECHANISM_CONTRACT_NOT_LEVEL_OR_SOLUTION');}
 runPython(`import json,sys,pathlib\nfrom jsonschema import Draft202012Validator\ns=json.loads(pathlib.Path('specs/v0.1/schemas/capability.schema.json').read_text()); v=Draft202012Validator(s)\nfor m in json.load(sys.stdin):\n v.validate(m); Draft202012Validator.check_schema(m['contract']['stateSchema'])\n`,ids.map(manifest));
});
test('minimal swap board and nullable optional defaults remain consumable; selected is an array',()=>{
 const config={statePath:'/p',width:2,height:2,selectActions:['a','b','c','d']};
 const minimal={board:[1,2,2,1]},nullable={...minimal,selected:null,score:null,moves:null,won:null,history:null};
 const normalized=[];
 for(const state of [minimal,nullable]){assert.doesNotThrow(()=>validatePuzzleDefinition({state:{p:{initial:state}},scenes:[{entities:[{components:[{capability:{id:ids[0],version:'0.1.0'},config}]}]}],inputs:{actions:config.selectActions.map(id=>({id,valueType:'button'}))}},makeRegistry()));const r=simulatePuzzle({config,world:{state:{p:state}},inputs:[],tickIndex:0,rng:new GameRng(7)},'match');const p=r.proposals[0].value;assert.deepEqual(p.selected,[]);assert.equal(p.score,0);assert.equal(p.moves,0);assert.deepEqual(p.history,[]);assert.deepEqual(p.display,state.board);assert.equal(p.anchor,1);normalized.push(p);}
 schemaCheck(ids[0],[minimal,nullable,...normalized],[{board:[1],selected:-1},{tiles:[1,2,3,4]}]);
 assert.deepEqual(manifest(ids[0]).contract.stateSchema.required,['board']);
 assert.match(manifest(ids[0]).extensions.publicSemantics.cascade,/atomically/);
});
test('defense documented initialization matches existing helper and is accepted with valid synthetic config',()=>{
 const state=initialDefenseState(7,2),config={statePath:'/defense',width:1000,height:1000,cost:2,damage:1,range:100,speed:1,cooldownTicks:5,maxTicks:50,cells:[{x:200,y:200}],path:[{x:100,y:100},{x:900,y:100}],waves:[{tick:10,hp:2,reward:1}],actions:[{action:'place',kind:'place',index:0}]};
 const definition={state:{defense:{initial:state}},scenes:[{entities:[{components:[{capability:{id:ids[1]},config}]}]}],inputs:{actions:[{id:'place',valueType:'button'}]}};
 assert.doesNotThrow(()=>validateDefenseDefinition(definition));schemaCheck(ids[1],[state],[{wallet:7,lives:2},{...state,selected:16}]);
 definition.scenes[0].entities[0].components[0].config.actions[0].index=1;assert.throws(()=>validateDefenseDefinition(definition),e=>e.code==='A2G_E_CAP_CONFIG');
 const semantics=manifest(ids[1]).extensions.publicSemantics;assert.match(semantics.tickOrder,/Commands|commands/);assert.match(semantics.merge,/max\(currentTick/);assert.match(semantics.crossFieldInvariants,/cells.length/);
});
test('integer-world bookkeeping is explicit and optional overflow duration remains optional',()=>{
 const state={bodies:[],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false};
 assert.doesNotThrow(()=>validateIntegerWorld(state,{width:1000,height:1000}));schemaCheck(ids[2],[state,{...state,overflowTicks:0}],[{bodies:[]},{...state,spawned:[64]}]);
 assert.ok(!manifest(ids[2]).contract.stateSchema.required.includes('overflowTicks'));
});
test('all existing reference initial states for the three mechanisms still fit the expanded schemas',()=>{
 runPython(`import json,sys,pathlib\nfrom jsonschema import Draft202012Validator\nms={m['id']:m for m in json.load(sys.stdin)}\ncounts={k:0 for k in ms}\nfor p in pathlib.Path('specs/v0.1/games').glob('*.game.json'):\n d=json.loads(p.read_text())\n for scene in d.get('scenes',[]):\n  for entity in scene.get('entities',[]):\n   for c in entity.get('components',[]):\n    ident=c['capability']['id']\n    if ident not in ms: continue\n    parts=c['config']['statePath'].split('/')[1:]; state={k:v['initial'] for k,v in d['state'].items()}\n    for part in parts: state=state[part.replace('~1','/').replace('~0','~')]\n    Draft202012Validator(ms[ident]['contract']['stateSchema']).validate(state); counts[ident]+=1\nassert all(n>0 for n in counts.values()),counts\n`,ids.map(manifest));
});
test('actual MCP resource envelope exposes body-array path and conditional body-style dependency',()=>{
 const envelope=JSON.parse(readPublicResource('a2game://spec/0.1.0/host-profile.json').contents[0].text),bytes=Buffer.from(envelope.content),p=JSON.parse(envelope.content);
 assert.equal(envelope.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(envelope.bytes,bytes.length);assert.deepEqual(p.mechanismContracts.ids,ids);assert.equal(p.presentation.scene2d.bodyLayer.statePath,'/<stateField>/bodies');assert.match(p.presentation.scene2d.bodyLayer.pathScope,/not \/state/);assert.match(p.presentation.scene2d.bodyLayer.conditionalDependencies['a2game.visual.body-style'],/showValues:false/);
 assert.ok(!envelope.content.includes('/workspace/'));assert.ok(!envelope.content.includes('candidate/attempt'));assert.equal(p.specVersion,'0.1.0');
});
