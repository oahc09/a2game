import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedbackAudio} from '../player/feedback-audio.mjs';

test('feedback stays silent before opt-in and releases bounded voices on mute/dispose',async()=>{
  let created=0,closed=0;
  const nodes=[];
  const context={state:'suspended',currentTime:0,destination:{},
    async resume(){this.state='running';},async close(){closed++;this.state='closed';},
    createOscillator(){const node={frequency:{value:0},connect(){},disconnect(){this.disconnected=true;},start(){},stop(){}};nodes.push(node);return node;},
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
  const audio=createFeedbackAudio({contextFactory:()=>{created++;return context;},maxVoices:3});
  assert.equal(audio.play('success'),false);assert.equal(created,0);
  assert.equal(await audio.enable(true),true);assert.equal(created,1);
  for(let i=0;i<20;i++)audio.play('success');
  assert.equal(audio.diagnostics().voices,3);assert.equal(nodes.length,3);
  assert.equal(audio.play('arbitrary-frequency'),false);
  await audio.enable(false);assert.equal(audio.diagnostics().voices,0);assert.ok(nodes.every(n=>n.disconnected));
  await audio.dispose();await audio.dispose();assert.equal(closed,1);
  assert.equal(await audio.enable(true),false);assert.equal(audio.play('move'),false);assert.equal(created,1);
});
