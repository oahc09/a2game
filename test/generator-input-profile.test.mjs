import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../generator/fixture.mjs';
import {closeCapabilities} from '../generator/catalog.mjs';
import {checkPlanGame} from '../generator/game-plan.mjs';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
test('generated realtime directions reject the no-hold shortcut that cancels movement in the reference host',()=>{
 const game=createFixture().game,ref={id:'a2game.realtime.world',version:'0.1.0'};
 game.requires.all=closeCapabilities([...game.requires.all,ref]);
 game.state.arena={type:'object',initial:{bodies:[{id:'player',kind:'actor',x:50,y:50,vx:0,vy:0,hx:16,hy:16,hp:1,team:1,value:0,fixed:false}],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false}};
 game.scenes[0].entities=[{id:'engine',components:[{capability:ref,config:{statePath:'/arena',width:256,height:256,gravity:0,moveSpeed:8,actions:{left:'collect'}}}]}];
 const plan={mechanisms:[{id:'movement',capabilities:[ref]}],capabilities:game.requires.all,controls:[{source:'keyboard.button'}],stateModel:[],entities:[],concept:{dimension:'2d'}};
 const position=()=>{const rt=new HeadlessRuntime(game,makeRegistry());try{rt.start();if(game.inputs.actions[0].bindings[0].config.hold===true)rt.injectRaw({source:'keyboard',kind:'down',payload:{code:'Space'},tickIndex:0,timeUs:0,seq:1});else{rt.injectAction({action:'collect',phase:'press'});rt.injectAction({action:'collect',phase:'release'});}rt.step(3);return rt.observe().state.arena.bodies[0].x;}finally{rt.dispose();}};
 assert.equal(position(),50);assert.throws(()=>checkPlanGame(plan,game),{code:'A2G_GEN_INPUT_PROFILE'});
 game.inputs.actions[0].bindings[0].config.hold=true;
 assert.equal(position(),26);assert.equal(checkPlanGame(plan,game).status,'PASS');
});
