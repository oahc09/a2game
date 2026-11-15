import test from'node:test';import assert from'node:assert/strict';import{createStageAudio}from'../player/adapters/stage-audio.mjs';
test('stage cues consume historical events once, discard muted backlog and allow the same event IDs after restart',async()=>{
 let plays=0;class AudioListener{context={decodeAudioData:async()=>({}),resume:async()=>{}};gain={disconnect(){}};removeFromParent(){}}class Audio{setBuffer(){}setVolume(){}play(){plays++;}stop(){}pause(){}disconnect(){}removeFromParent(){}}
 const host=await createStageAudio('three',{AudioListener,Audio},{add(){}},{get:()=>({bytes:new ArrayBuffer(4)})},[{id:'cue',asset:'tone',volume:.2}]),frame=(tick,keys)=>({tickIndex:tick,audio:keys.map(key=>({id:'cue',key}))});
 host.draw(frame(1,['cue:e1']));host.unlock();host.draw(frame(2,['cue:e1','cue:e2']));assert.equal(plays,1);host.draw(frame(3,['cue:e1','cue:e2']));assert.equal(plays,1);host.draw(frame(4,['cue:e1','cue:e2','cue:e3','cue:e4']));assert.equal(plays,2);host.draw(frame(4,['cue:e4']));assert.equal(plays,2);
 host.draw(frame(0,[]));host.draw(frame(1,['cue:e1']));assert.equal(plays,3);host.dispose();assert.equal(host.diagnostics().ownedSources,0);assert.equal(host.diagnostics().consumedEvents,0);host.draw(frame(2,['cue:e5']));assert.equal(plays,3);
});
