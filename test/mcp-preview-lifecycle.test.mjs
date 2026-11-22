import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createMcpService} from '../integrations/mcp/mcp.mjs';
import {createFixture} from '../generator/fixture.mjs';

const root=resolve(import.meta.dirname,'..');
test('preview expiration and repeated closes preserve the actual cause and auditable cleanup',{
 skip:!existsSync(join(root,'player/vendor/sdk-provenance.json'))&&'Requires prepared locked SDK files; no browser rendering is claimed'
},async()=>{
 const service=createMcpService({previewTtlMs:150});
 try{
  const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(createFixture().game)});
  assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));
  const artifactId=admitted.data.artifactId;
  const open=async()=>{
   const result=await service.call('a2game.preview_game',{action:'open',artifactId,backend:'three'});
   assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));
   assert.ok(Date.parse(result.data.expiresAt)>=Date.parse(result.data.openedAt));
   return result.data;
  };
  const close=previewId=>service.call('a2game.preview_game',{action:'close',previewId});
  const explicit=await open();
  const first=await close(explicit.previewId);
  assert.equal(first.data.closeReason,'explicit');assert.equal(first.data.alreadyClosed,false);
  const repeated=await close(explicit.previewId);
  assert.equal(repeated.data.closeReason,'explicit');assert.equal(repeated.data.alreadyClosed,true);
  assert.equal(repeated.data.lifecyclePath,first.data.lifecyclePath);

  const expired=await open();
  for(let i=0;i<100&&service.stats().previews;i++)await delay(10);
  assert.equal(service.stats().previews,0);
  const afterExpiry=await close(expired.previewId);
  assert.equal(afterExpiry.status,'PASS_REFERENCE');
  assert.equal(afterExpiry.data.closeReason,'expired');assert.equal(afterExpiry.data.alreadyClosed,true);
  const event=JSON.parse(readFileSync(join(root,afterExpiry.data.lifecyclePath),'utf8'));
  assert.equal(event.closed,true);assert.equal(event.sessionId,service.sessionId);assert.equal(event.artifactId,artifactId);
  assert.equal(event.closeReason,'expired');
  await assert.rejects(fetch(expired.url),/fetch failed/);

  const controller=new AbortController();
  const cancelled=service.call('a2game.preview_game',{action:'open',artifactId,backend:'three'},{signal:controller.signal});
  controller.abort();
  assert.equal((await cancelled).status,'FAIL');assert.equal(service.stats().previews,0);

  const shutdown=await open();
  await Promise.all([service.close(),service.close()]);
  assert.equal(service.stats().previews,0);
  const shutdownEvents=readdirSync(service.directory).filter(name=>name.startsWith(shutdown.previewId+'.lifecycle.'));
  assert.equal(shutdownEvents.length,1,'concurrent shutdown calls must share cleanup');
  assert.equal(JSON.parse(readFileSync(join(service.directory,shutdownEvents[0]),'utf8')).closeReason,'shutdown');
  assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});

test('shutdown waits for an opening preview call and its final receipt before declaring cleanup complete',{
 skip:!existsSync(join(root,'player/vendor/sdk-provenance.json'))&&'Requires prepared locked SDK files; no browser rendering is claimed'
},async()=>{
 const service=createMcpService();
 try{
  const admitted=await service.call('a2game.validate_game',{gameJson:JSON.stringify(createFixture().game)});
  assert.equal(admitted.status,'PASS_REFERENCE',JSON.stringify(admitted));
  let settled=false;
  const pending=service.call('a2game.preview_game',{action:'open',artifactId:admitted.data.artifactId,backend:'three'}).then(result=>{settled=true;return result;});
  assert.equal(service.stats().active,true);
  const closing=service.close();
  assert.equal(service.close(),closing,'concurrent shutdown callers share the same completion');
  await closing;
  assert.equal(settled,true,'shutdown must wait for the active call to settle');
  assert.equal(service.stats().active,false);assert.equal(service.stats().previews,0);
  const result=await pending;
  assert.equal(result.status,'FAIL');
  const metadata=JSON.parse(readFileSync(join(service.directory,result.runId+'.call.json'),'utf8'));
  assert.equal(metadata.state,'COMPLETED');
  assert.deepEqual(JSON.parse(readFileSync(join(service.directory,result.runId+'.receipt.json'),'utf8')),result);
  assert.equal(JSON.parse(readFileSync(join(service.directory,'session.json'),'utf8')).state,'CLOSED');
 }finally{await service.close();}
});
