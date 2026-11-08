import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventFeedback} from '../player/event-feedback.mjs';

test('event decorations deduplicate, preserve state, locate removed bodies and obey draw/lifetime limits',()=>{
  const sounds=[],feedback=createEventFeedback({onSound:name=>sounds.push(name),maxEffects:2,reducedMotion:()=>false});
  const definition={presentation:{scene2d:{bodyLayer:{statePath:'/arena/bodies',origin:[-3,-3]}}}};
  const observation={tickIndex:0,state:{arena:{bodies:[{id:'target',x:1000,y:1000}]}},events:[]};
  feedback.capture(definition,observation,{now:0});
  observation.tickIndex=1;observation.state.arena.bodies=[];
  observation.events=[{eventId:'1',type:'combat.death',payload:{id:'target'}}];
  const before=structuredClone(observation);feedback.capture(definition,observation,{now:10});feedback.capture(definition,observation,{now:10});
  const frame={commands:[],width:6,height:6};
  const decorated=feedback.project(frame,20);assert.equal(decorated.commands.length,8);assert.ok(decorated.commands[0].at[0]<0);
  assert.deepEqual(sounds,['success']);assert.deepEqual(observation,before);assert.deepEqual(frame.commands,[]);
  const full={...frame,commands:Array.from({length:640},(_,i)=>({id:String(i)}))};assert.equal(feedback.project(full,20).commands.length,640);
  assert.equal(feedback.project(frame,331),frame);
  feedback.reset();assert.deepEqual(feedback.diagnostics(),{effects:0,positions:0,seen:0});
  const reduced=createEventFeedback({reducedMotion:()=>true});reduced.capture(definition,before,{now:0});assert.equal(reduced.project(frame,0),frame);
  feedback.capture(definition,{tickIndex:2,state:{arena:{bodies:[{id:'replacement',x:500,y:500},{id:'enemy',x:2000,y:2000}]}},events:[{eventId:'merge',type:'defense.merged',payload:{replacement:'replacement'}},{eventId:'shot',type:'defense.fired',payload:{owner:'replacement',target:'enemy'}}]},{now:400});
  const defenseFrame=feedback.project(frame,410);assert.ok(defenseFrame.commands.some(command=>command.id.startsWith('host-shot:')));assert.ok(defenseFrame.commands.some(command=>command.fill==='#8af2cd'));assert.deepEqual(sounds.slice(-2),['merge','hit']);
});
