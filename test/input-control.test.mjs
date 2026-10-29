import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,initialControlState,segmentAabb,moveClipped,viewportToWorld,projectPresentation} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
const ref=id=>({id,version:'0.1.0'});
function fixture(){const g=JSON.parse(readFileSync('specs/v0.1/games/realtime-constraint.game.json'));g.state.control={type:'object',initial:initialControlState()};g.requires.all.push(ref('a2game.realtime.input-control'));g.scenes[0].entities[0].components.push({capability:ref('a2game.realtime.input-control'),config:{statePath:'/control',worldPath:'/world',width:8000,height:6000,sceneWidth:10,sceneHeight:8,origin:[-4,-3]}});return g;}
const press=(r,action,value,sourceId='test')=>{r.injectAction({action,phase:'press',value,sourceId,viewportAspect:1.25});r.injectAction({action,phase:'release',sourceId});r.step();};
test('swept axis clipping prevents thin-wall tunnelling and viewport conversion follows contain projection',()=>{
 const body={id:'a',x:16,y:50,hx:16,hy:16},wall={id:'b',x:80,y:50,hx:16,hy:32};moveClipped(body,[200,50],128,[wall]);assert.equal(body.x,48);moveClipped(body,[16,50],128,[wall]);assert.equal(body.x,16);
 assert.equal(segmentAabb([0,0],[100,0],{x:50,y:0,hx:1,hy:1}),0.49);assert.equal(segmentAabb([0,2],[100,2],{x:50,y:0,hx:1,hy:1}),undefined);
 assert.deepEqual(viewportToWorld(0.5,0.5,1.25,10,8,[-4,-3]),[4000,3000]);assert.deepEqual(viewportToWorld(0.5,0.5,0.5,10,8,[-4,-3]),[4000,3000]);
 const g=fixture();g.inputs.actions=[{id:'slice',valueType:'pose',bindings:[{source:'touch.path',config:{}}]}];g.requires.all.push(ref('a2game.input.touch.path'));g.scenes[0].entities[0].components[0].config={statePath:'/world',width:8000,height:6000,goalScore:1};g.scenes[0].entities[0].components[1].config.pathAction='slice';g.state.world.initial.bodies=[{id:'fruit',kind:'target',x:4000,y:3000,vx:0,vy:0,hx:300,hy:300,hp:1,team:2,value:1,fixed:true}];
 const r=new HeadlessRuntime(g,makeRegistry());r.start();press(r,'slice',{points:[[0.2,0.5],[0.8,0.5]]});assert.equal(r.observe().state.control.score,1);assert.equal(r.observe().state.world.score,1);assert.equal(r.status,'won');r.dispose();
 const hazard=structuredClone(g);hazard.state.world.initial.bodies.push({...hazard.state.world.initial.bodies[0],id:'bomb',kind:'solid'});hazard.scenes[0].entities[0].components[1].config.hazardIds=['bomb'];hazard.outcomes.push({id:'hazard',status:'lost',priority:-1,when:{state:'/control/lost'}});const failed=new HeadlessRuntime(hazard,makeRegistry());failed.start();press(failed,'slice',{points:[[0.2,0.5],[0.8,0.5]]});assert.equal(failed.status,'lost');failed.dispose();
});
test('bound visuals require their capability, resolve numeric nested state and never change logical hash',()=>{
 const g=fixture();g.requires.all.push(...['a2game.visual.bound-stage','a2game.visual.stage','a2game.visual.body-style','a2game.input.touch.rotate'].map(ref));g.inputs.actions=[{id:'rotate',valueType:'axis1',bindings:[{source:'touch.rotate',config:{}}]}];g.scenes[0].entities[0].components[1].config.rotateAction='rotate';
 g.presentation.scene2d.bodyLayer.circleKinds=['actor'];g.presentation.stage={bindingProfile:'numeric-pointer-v1',camera:{projection:'orthographic',at:[0,0,8],target:[0,0,0],near:0.1,far:100,fov:45,orthoHeight:8},nodes:[{id:'bound',kind:'mesh',geometry:'box',at:[{state:'/world/bodies/0/x',scale:0.001,offset:-4},0,0],size:[{state:'/control/scale'},1,1],rotation:[0,0,{state:'/control/angle'}],color:'#57d7c8'}]};
 const r=new HeadlessRuntime(g,makeRegistry());r.start();press(r,'rotate',0.5);const hash=r.observe().exactHash,frame=projectPresentation(g,r.observe());assert.equal(frame.stage.nodes[0].rotation[2],0.5);assert.equal(frame.commands.find(command=>command.id==='body:ball').kind,'circle');assert.equal(r.observe().exactHash,hash);r.dispose();
 const bad=structuredClone(g);bad.requires.all=bad.requires.all.filter(ref=>ref.id!=='a2game.visual.bound-stage');assert.throws(()=>new HeadlessRuntime(bad,makeRegistry()),error=>error.code==='A2G_E_CAP_DEPENDENCY');const invalid=structuredClone(g);invalid.presentation.stage.nodes[0].rotation[2]={state:'/world'};assert.throws(()=>new HeadlessRuntime(invalid,makeRegistry()));
});
