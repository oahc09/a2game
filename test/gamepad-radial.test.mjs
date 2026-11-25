import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,createReplaySave,openReplaySave} from '../dist/index.js';
import {recognizeGamepadInput} from '../dist/gamepad-input.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createContentService} from '../scripts/content-service.mjs';

const lab=JSON.parse(readFileSync(new URL('../specs/v0.1/games/gamepad-lab.game.json',import.meta.url)));
const look=game=>game.inputs.actions.find(action=>action.id==='look').bindings[0].config;
const sample=(axes,connected=true)=>({source:'gamepad',kind:'sample',payload:{index:0,connected,buttons:[],axes}});
const opts=(game,config)=>Object.assign(look(game),config);
const radial=()=>{const game=structuredClone(lab);opts(game,{deadZoneMode:'radial',deadZone:.2});return game;};
function recorder(game){
 const stage={tickIndex:0,activePointers:{},pressedSources:{}};
 return (axes,connected)=>recognizeGamepadInput(stage,[sample(axes,connected)],game,id=>id==='a2game.input.gamepad.axis2'||id==='a2game.input.gamepad.button')
   .filter(action=>action.phase==='press').map(({action,value})=>[action,value]);
}

test('radial deadzone is inclusive, rescaled and unit-bounded; legacy lab stays per-axis',()=>{
 const read=recorder(radial());
 assert.deepEqual(read([.2,0]),[]);
 assert.deepEqual(read([.12,.16]),[]);
 assert.deepEqual(read([.1,.1]),[]);
 assert.deepEqual(read([.2001,0]),[['look',[.0001,0]]]);
 assert.deepEqual(read([.5,0]),[['look',[.375,0]]]);
 assert.deepEqual(read([.3,.4]),[['look',[.225,.3]]]);
 assert.deepEqual(read([-.3,-.4]),[['look',[-.225,-.3]]]);
 assert.deepEqual(read([1,1]),[['look',[.7071,.7071]]]);
 for(const y of [.001,.01,.1234,.3456,.8765,.9999]){
  const [[,v]]=read([1,y]);assert.ok(v[0]**2+v[1]**2<=1);
 }
 const legacy=recorder(lab);
 assert.deepEqual(legacy([.09,.09]),[['look',[0,0]]]);
 assert.deepEqual(legacy([.09,.5]),[['look',[0,.5]]]);
 assert.deepEqual(legacy([1,1]),[['look',[1,1]]]);
});

test('two opt-in sticks suppress neutral noise and unchanged outputs independently; disconnect neutralizes tracked sticks once',()=>{
 const game=radial();game.inputs.actions.push({id:'move',valueType:'vec2',bindings:[{
  source:'gamepad.axis2',config:{xAxis:2,yAxis:3,deadZone:.2,deadZoneMode:'radial'}
 }]});
 const read=recorder(game);
 assert.deepEqual(read([.04,-.03,0,.02]),[]);
 assert.deepEqual(read([.05,-.02,.6,0]),[['move',[.5,0]]]);
 assert.deepEqual(read([.6,0,.6,0]),[['look',[.5,0]]]);
 assert.deepEqual(read([.099,-.09,.6,0]),[['look',[0,0]]]);
 assert.deepEqual(read([.02,.01,.6,0]),[]);
 assert.deepEqual(read([],false),[['look',[0,0]],['move',[0,0]]]);
 assert.deepEqual(read([],false),[]);
});

test('opted-in Gamepad Lab carries calibrated values through runtime and trace save replay',()=>{
 const game=radial();
 const trace={format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:game.id,gameRevision:game.revision,tickHz:60,seed:game.world.clock.seed,inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1'},events:[
  {...sample([.07,.04]),tickIndex:0,timeUs:0,seq:0},
  {...sample([.3,.4]),tickIndex:1,timeUs:16667,seq:1},
  {source:'system',kind:'checkpoint',tickIndex:5,timeUs:83334,seq:2,payload:{}}
 ]};
 const saved=createReplaySave(game,makeRegistry,trace),opened=openReplaySave(game,makeRegistry,saved);
 try{
  assert.deepEqual(opened.runtime.observe().state.axis,[.225,.3]);
  assert.equal(opened.runtime.observe().exactHash,saved.finalHash);
 }finally{opened.runtime.dispose();}
});

test('radial values, destination type and distinct axes are validated before execution',()=>{
 for(const config of [{deadZoneMode:'diagonal'},{deadZone:1},{deadZone:-.1},{deadZone:'0.2'},{yAxis:0},{xAxis:16},{index:'0'},{index:4}]){
  const game=radial();opts(game,config);
  assert.throws(()=>new HeadlessRuntime(game,makeRegistry()),e=>e.code==='A2G_E_INPUT_ACTION');
 }
 const game=radial();
 game.inputs.actions.find(action=>action.id==='collect').bindings.find(b=>b.source==='gamepad.button').config.deadZoneMode='radial';
 assert.throws(()=>new HeadlessRuntime(game,makeRegistry()),e=>e.code==='A2G_E_INPUT_ACTION');
});

test('real content admission publishes radial Gamepad Lab config and rejects unknown modes',async()=>{
 const service=createContentService(),game=radial();
 const receipt=await service.release(JSON.stringify(game));
 assert.equal(look((await service.read(receipt.sha256Jcs)).definition).deadZoneMode,'radial');
 opts(game,{deadZoneMode:'diagonal'});
 await assert.rejects(service.release(JSON.stringify(game)),e=>e.code==='A2G_E_SCHEMA'&&e.diagnostics.some(row=>row.pointer.endsWith('/config/deadZoneMode')));
});
