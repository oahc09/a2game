import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,runConformanceSuite,createReplaySave,openReplaySave} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createGamepadHost} from '../player/gamepad-host.mjs';
const game=JSON.parse(readFileSync('specs/v0.1/samples/games/gamepad-lab.game.json'));
test('gamepad reference conformance, held-source OR/disconnect and save replay share one deterministic cache',async()=>{
 const suite=JSON.parse(readFileSync('specs/v0.1/samples/tests/gamepad-lab.conformance.json'));assert.equal((await runConformanceSuite(suite,game,makeRegistry)).status,'PASS');const r=new HeadlessRuntime(game,makeRegistry());r.start();try{r.injectAction({action:'collect',phase:'press',sourceId:'keyboard:test'});r.injectRaw({source:'gamepad',kind:'sample',payload:{index:0,connected:true,buttons:[true],axes:[0.01,0]}});r.step();assert.equal(r.observe().state.score,1);r.injectRaw({source:'gamepad',kind:'sample',payload:{index:0,connected:false,buttons:[],axes:[]}});r.step();assert.deepEqual(r.snapshot().pressedSources.collect,['keyboard:test']);r.pause();assert.deepEqual(r.snapshot().activePointers,{});assert.deepEqual(r.snapshot().pressedSources,{});}finally{r.dispose();}
 const trace={format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:game.id,gameRevision:game.revision,tickHz:60,seed:game.world.clock.seed,inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1'},events:[{source:'gamepad',kind:'sample',tickIndex:0,timeUs:0,seq:0,payload:{index:0,connected:true,buttons:[true],axes:[0.8,0]}},{source:'system',kind:'checkpoint',tickIndex:10,timeUs:166667,seq:1,payload:{}}]};const save=createReplaySave(game,makeRegistry,trace),opened=openReplaySave(game,makeRegistry,save);try{assert.equal(opened.runtime.observe().state.score,1);assert.equal(opened.runtime.observe().exactHash,save.finalHash);}finally{opened.runtime.dispose();}
});
test('native host samples only after enable at caller Tick boundary, disconnects and disposes; malformed samples roll back',()=>{
 const inputs=[];let pads=[{index:0,connected:true,buttons:[{pressed:true,value:1}],axes:[0.8,0]}];const host=createGamepadHost({inject:raw=>inputs.push(raw),getPads:()=>pads});host.poll();assert.equal(inputs.length,0);host.enable();host.poll();host.poll();assert.equal(inputs.length,1);pads=[];host.poll();assert.equal(inputs[1].payload.connected,false);host.stop();host.poll();assert.equal(inputs.length,2);host.dispose();assert.equal(host.diagnostics().trackedDevices,0);
 const r=new HeadlessRuntime(game,makeRegistry());r.start();const before=r.observe().state;try{r.injectRaw({source:'gamepad',kind:'sample',payload:{index:4,connected:true,buttons:[],axes:[]}});assert.throws(()=>r.step(),e=>e.code==='A2G_E_INPUT_RAW');assert.deepEqual(r.observe().state,before);}finally{r.dispose();}
});
