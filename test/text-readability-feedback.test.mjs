import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';
import {inspectTextReadability as inspect,textReadabilityObservationSchema as schema} from '../integrations/mcp/text-readability-feedback.mjs';
import {contracts} from '../integrations/mcp/contract.mjs';
import {createMcpService} from '../integrations/mcp/service.mjs';
import {createFixture} from '../generator/fixture.mjs';
const artifactId=randomUUID(),previewId=randomUUID(),gameSha256='a'.repeat(64);
const observation=()=>({previewId,gameSha256,backend:'three',viewport:{width:390,height:844},status:'DIAGNOSTIC_ONLY',referenceCssPx:16,measuredCanvasRect:{left:10,top:20,width:368,height:375},scene:{width:320,height:440},texts:[{fontScene:18,nominalTextCssPx:15}]});
const context=()=>({artifactId,gameSha256,preview:{artifactId,backend:'three'}});
test('readability feedback is bounded advisory data without mutation, aesthetic PASS or implicit repair',()=>{
 const input=observation(),binding=context(),before=JSON.stringify({input,binding}),result=inspect(input,binding);
 assert.equal(result.status,'DIAGNOSTIC_ONLY');assert.equal(result.provenance,'HOST_REPORTED_UNVERIFIED');assert.equal(result.visualAcceptance,'NOT_RUN');
 assert.equal(result.warnings[0].code,'SMALL_TEXT');assert.equal(result.warnings[0].textIndex,0);assert.match(result.warnings[0].repairHint,/new artifact/);
 assert.equal(JSON.stringify({input,binding}),before);
 input.referenceCssPx=12;const large=inspect(input,binding);assert.deepEqual(large.warnings,[]);assert.equal(large.visualAcceptance,'NOT_RUN');
 input.status='UNAVAILABLE';input.scene=null;input.measuredCanvasRect=null;input.texts=[];assert.equal(inspect(input,binding).warnings[0].code,'MEASUREMENT_UNAVAILABLE');
});
test('observation binding rejects closed, closing, cross-session, backend and replaced-artifact evidence',()=>{
 for(const binding of [{...context(),preview:undefined},{...context(),preview:{...context().preview,closing:Promise.resolve()}},{...context(),preview:{artifactId:randomUUID(),backend:'three'}},{...context(),preview:{artifactId,backend:'air'}},{...context(),gameSha256:'b'.repeat(64)}])assert.throws(()=>inspect(observation(),binding),{code:'A2G_MCP_READABILITY_BINDING'});
 // Session-local lookup prevents another service's preview ID from reaching a binding.
 const otherSession=new Map();assert.throws(()=>inspect(observation(),{...context(),preview:otherSession.get(previewId)}),{code:'A2G_MCP_READABILITY_BINDING'});
});
test('strict numeric projection rejects arbitrary text, paths, nonfinite or excessive observations',()=>{
 for(const bad of [{...observation(),path:'/private/sentinel'},{...observation(),texts:[{fontScene:18,nominalTextCssPx:12,id:'/private/sentinel'}]},{...observation(),referenceCssPx:NaN},{...observation(),viewport:{width:Infinity,height:10}},{...observation(),texts:Array(257).fill({fontScene:18,nominalTextCssPx:12})},{...observation(),status:'PASS_REFERENCE'},{...observation(),measuredCanvasRect:null},{...observation(),status:'UNAVAILABLE'}])assert.equal(schema.safeParse(bad).success,false);
 assert.equal(Object.keys(contracts).length,9);assert.deepEqual(contracts['a2game.inspect_game'].schema.parse({artifactId}),{artifactId});
});
test('MCP inspection keeps legacy fields and immutable artifact; unknown preview gives safe diagnostic',async()=>{
 const service=createMcpService();
 try{
  const validation=await service.call('a2game.validate_game',{gameJson:JSON.stringify(createFixture().game)});assert.equal(validation.status,'PASS_REFERENCE',JSON.stringify(validation));
  const a=validation.data,path=join(service.directory,a.artifactId,'game.json'),before=readFileSync(path,'utf8');
  const old=await service.call('a2game.inspect_game',{artifactId:a.artifactId});assert.equal(old.status,'PASS_REFERENCE');assert.equal(old.data.textReadability,undefined);
  const result=await service.call('a2game.inspect_game',{artifactId:a.artifactId,textReadability:{...observation(),gameSha256:a.files['game.json']}});
  assert.equal(result.status,'FAIL');assert.equal(result.diagnostics[0].code,'A2G_MCP_READABILITY_BINDING');assert.ok(!JSON.stringify(result).includes(service.directory));assert.ok(!JSON.stringify(result).includes('stack'));
  assert.equal(readFileSync(path,'utf8'),before);assert.equal(service.stats().budgetConsumed,0);
 }finally{await service.close();}
});


test('real service preview binding rejects cross-session, closed, expired and replaced-artifact reports without browser claims',{
 skip:!existsSync(new URL('../player/vendor/sdk-provenance.json',import.meta.url))&&'Requires prepared SDK files; observations remain synthetic, no browser execution claimed'
},async()=>{
 const service=createMcpService(),other=createMcpService({previewTtlMs:150});
 const admit=async(s,game)=>{const result=await s.call('a2game.validate_game',{gameJson:JSON.stringify(game)});assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));return result.data;};
 const open=async(s,a)=>{const result=await s.call('a2game.preview_game',{action:'open',artifactId:a.artifactId,backend:'three'});assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));return result.data;};
 const observe=(a,p)=>({...observation(),previewId:p.previewId,gameSha256:a.files['game.json']});
 const inspectReport=(s,a,report)=>s.call('a2game.inspect_game',{artifactId:a.artifactId,textReadability:report});
 const rejected=result=>{assert.equal(result.status,'FAIL');assert.equal(result.diagnostics[0].code,'A2G_MCP_READABILITY_BINDING');};
 try{
  const game=createFixture().game,a=await admit(service,game),b=await admit(other,game),p=await open(service,a),report=observe(a,p);
  const path=join(service.directory,a.artifactId,'game.json'),bytes=readFileSync(path,'utf8');
  const good=await inspectReport(service,a,report);assert.equal(good.status,'PASS_REFERENCE');
  assert.deepEqual(good.data.textReadability,inspect(report,{artifactId:a.artifactId,gameSha256:a.files['game.json'],preview:{artifactId:a.artifactId,backend:'three'}}));
  assert.equal(good.data.textReadability.provenance,'HOST_REPORTED_UNVERIFIED');assert.equal(good.data.textReadability.visualAcceptance,'NOT_RUN');
  assert.equal(readFileSync(path,'utf8'),bytes);assert.equal(good.data.tested,false);
  rejected(await inspectReport(other,b,report));
  rejected(await inspectReport(service,a,{...report,backend:'air'}));
  const legacy=await service.call('a2game.inspect_game',{artifactId:a.artifactId});assert.equal(legacy.status,'PASS_REFERENCE');assert.equal(legacy.data.textReadability,undefined);assert.equal(legacy.data.initialHash,good.data.initialHash);
  const closed=await service.call('a2game.preview_game',{action:'close',previewId:p.previewId});assert.equal(closed.data.closeReason,'explicit');
  rejected(await inspectReport(service,a,report));await assert.rejects(fetch(p.url));
  // Author changed source, then validated a new immutable artifact and opened its own preview.
  const activeOld=await open(service,a);
  const revised=structuredClone(game);revised.presentation.scene2d.nodes[0].fontSize=0.5;
  const fresh=await admit(service,revised),freshPreview=await open(service,fresh);
  rejected(await inspectReport(service,fresh,observe(a,activeOld))); // still-active old preview cannot bind the new artifact
  rejected(await inspectReport(service,fresh,{...report,previewId:freshPreview.previewId})); // new preview cannot launder old SHA
  const freshGood=await inspectReport(service,fresh,observe(fresh,freshPreview));assert.equal(freshGood.status,'PASS_REFERENCE');
  assert.notEqual(fresh.files['game.json'],a.files['game.json']);assert.equal(readFileSync(path,'utf8'),bytes);
  const expiring=await open(other,b),expiredReport=observe(b,expiring);
  // Wait only for this 150 ms lifecycle to finish, bounded by a test failure deadline.
  const deadline=Date.now()+3000;while(other.stats().previews&&Date.now()<deadline)await delay(10);
  assert.equal(other.stats().previews,0,'preview expiry must release the listener');
  rejected(await inspectReport(other,b,expiredReport));
  const expiry=await other.call('a2game.preview_game',{action:'close',previewId:expiring.previewId});assert.equal(expiry.data.closeReason,'expired');await assert.rejects(fetch(expiring.url));
  assert.equal(service.stats().budgetConsumed,0);assert.equal(other.stats().budgetConsumed,0);
 }finally{await Promise.all([service.close(),other.close()]);}
});
