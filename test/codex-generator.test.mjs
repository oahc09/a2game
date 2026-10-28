import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCodexEvents,withCodexHostProfile} from '../scripts/codex-generator.mjs';
test('CLI evidence keeps the final raw JSON and actual usage, while tool calls and incomplete turns cannot count as isolated generation',()=>{
 const text='{"中文":"独立关卡","duplicate":1,"duplicate":2}',events=[{type:'thread.started',thread_id:'test-thread'},{type:'turn.started'},{type:'item.completed',item:{type:'agent_message',text}},{type:'turn.completed',usage:{input_tokens:10,output_tokens:8}}],stream=e=>e.map(v=>JSON.stringify(v)).join('\n');
 const result=collectCodexEvents(stream(events));assert.equal(result.text,text);assert.equal(result.usage.output_tokens,8);assert.equal(result.events[0].threadId,'test-thread');assert.ok(!JSON.stringify(result.events).includes('duplicate'));
 assert.throws(()=>collectCodexEvents(stream(events.slice(0,-1))),e=>e.code==='A2G_E_CODEX_OUTPUT');
 assert.throws(()=>collectCodexEvents(stream([...events,{type:'item.completed',item:{type:'command_execution',command:'read repository'}}])),e=>e.code==='A2G_E_CODEX_TOOLS');
 assert.throws(()=>collectCodexEvents(stream([...events,{type:'item.completed',item:{type:'agent_message',text:'{}'}}])),e=>e.code==='A2G_E_CODEX_OUTPUT');
 const request=withCodexHostProfile({prompt:'独立任务'});assert.equal(request.prompt,'独立任务');assert.equal(request.hostProfile.inputBindingSources['keyboard.button'],'a2game.input.keyboard.button');assert.ok(request.hostProfile.observation.paths.includes('/flow/status'));
 assert.equal(request.hostProfile.version,2);assert.ok(request.hostProfile.publicLibrary['src/modules/tower-defense.ts'].source.includes('initialDefenseState'));assert.ok(request.hostProfile.publicPresentationContract.includes('中心原点'));assert.ok(Object.keys(request.hostProfile.publicLibrary).every(p=>p.startsWith('src/')&&!p.includes('game.json')));
});
