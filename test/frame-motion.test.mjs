import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameMotion} from '../player/frame-motion.mjs';

test('host easing preserves authoritative targets, handles interrupted moves and resets on restart',()=>{
  const motion=createFrameMotion({duration:100,reducedMotion:()=>false});
  const frame=x=>({width:3,height:3,background:'#ffffff',commands:[{id:'actor',kind:'circle',at:[x,0],radius:.2,fill:'#000000'}]});
  motion.project(frame(0),0);
  const target=frame(1),original=structuredClone(target);
  assert.equal(motion.project(target,10).commands[0].at[0],0);
  const middle=motion.project(target,60).commands[0].at[0];assert.ok(middle>0&&middle<1);
  assert.equal(motion.project(frame(2),60).commands[0].at[0],middle);
  assert.equal(motion.project(frame(2),160).commands[0].at[0],2);
  assert.deepEqual(target,original);
  motion.reset();assert.equal(motion.project(frame(0),170).commands[0].at[0],0);
  const reduced=createFrameMotion({reducedMotion:()=>true});assert.equal(reduced.project(target),target);
});
