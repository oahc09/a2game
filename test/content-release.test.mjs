import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContentService} from '../scripts/content-service.mjs';
import {createPlayerServer} from '../scripts/serve.mjs';
import {makeRegistry,readJson,spec,root} from '../scripts/registry.mjs';
import {verifyReleasedGame,capabilityManifestDigest,sha256Canonical,CONTENT_MAX_BYTES} from '../dist/index.js';

const game=()=>readJson(`${spec}/samples/games/tap-target.game.json`);
let service,server,origin;
before(async()=>{service=createContentService();server=createPlayerServer({contentService:service});await new Promise(done=>server.listen(0,'127.0.0.1',done));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
const upload=(value,headers={})=>fetch(`${origin}/api/releases`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof value==='string'?value:JSON.stringify(value)});

test('unlisted JSON is fully admitted and content/context integrity is checked before loading',async()=>{
  const variant=game();variant.id='org.a2game.tests.imported';variant.state.goal.initial=3;
  const response=await upload(variant);assert.equal(response.status,201);
  const {receipt,href}=await response.json();assert.match(receipt.validator,/Draft202012Validator \(full dialect\)/);
  const envelope=await (await fetch(origin+href)).json(),manifest=capabilityManifestDigest(makeRegistry().list());
  assert.deepEqual(verifyReleasedGame(envelope,receipt.sha256Jcs,manifest),variant);
  const same=await service.release(JSON.stringify(variant));assert.deepEqual(same,receipt);
  const tampered=structuredClone(envelope);tampered.definition.state.goal.initial=99;
  assert.throws(()=>verifyReleasedGame(tampered,receipt.sha256Jcs,manifest),{code:'A2G_E_RELEASE_INTEGRITY'});
  assert.throws(()=>verifyReleasedGame(envelope,receipt.sha256Jcs,'0'.repeat(64)),{code:'A2G_E_RELEASE_INTEGRITY'});
  envelope.definition.meta.title='changed by caller';assert.notEqual((await service.read(receipt.sha256Jcs)).definition.meta.title,envelope.definition.meta.title);
});
test('schema, semantic and resource policy failures return diagnostics without releasing content',async()=>{
  const cases=[
    ['A2G_E_SCHEMA',g=>{g.presentation.hud[0].arbitrary=true;}],
    ['A2G_E_CAP_UNKNOWN',g=>{g.requires.all.push({id:'org.example.unimplemented',version:'0.1.0'});} ],
    ['A2G_E_STATE_PATH',g=>{g.rules[0].do[0].path='/missing';}],
    ['A2G_E_RESOURCE_POLICY',g=>{g.assets={icon:{type:'image',uri:'assets/icon.png'}};}]
  ];
  const size=service.size;
  for(const [code,change] of cases){const invalid=game();change(invalid);const response=await upload(invalid);assert.equal(response.status,422);const body=await response.json();assert.equal(body.error.code,code);assert.ok(body.error.diagnostics.length>0);}
  assert.equal(service.size,size);
});
test('binding and component configs use full manifest schemas; invalid initial module state is rejected',async()=>{
  const invalid=game();invalid.inputs.actions[0].bindings[0].config.maxDurationUs=-1;
  let response=await upload(invalid),error=(await response.json()).error;assert.equal(error.code,'A2G_E_SCHEMA');assert.match(error.diagnostics[0].pointer,/bindings/);
  const push=readJson(`${spec}/samples/games/grid-push.game.json`);push.scenes[0].entities[0].components[0].config.width=2.5;
  response=await upload(push);error=(await response.json()).error;assert.equal(error.code,'A2G_E_SCHEMA');assert.match(error.diagnostics[0].pointer,/components/);
  push.scenes[0].entities[0].components[0].config.width=5;push.state.player.initial=push.state.walls.initial[0];
  response=await upload(push);assert.equal(response.status,422);assert.equal((await response.json()).error.stage,'semantic');
});
test('malformed, duplicate-key, non-finite and oversized JSON fail closed',async()=>{
  assert.equal((await upload('{')).status,400);
  let response=await upload(JSON.stringify(game()).replace('{','{"id":"duplicate",'));assert.equal((await response.json()).error.stage,'parse');
  response=await upload(' '.repeat(CONTENT_MAX_BYTES+1));assert.equal(response.status,413);
  const nonFinite=JSON.stringify(game()).replace('"revision":2','"revision":1e400');response=await upload(nonFinite);assert.equal(response.status,422);
});
test('local API rejects cross-origin admission, wrong media types, private static paths and unknown releases',async()=>{
  assert.equal((await upload(game(),{Origin:'https://outside.example'})).status,403);
  assert.equal((await upload(game(),{'Content-Type':'text/plain'})).status,415);
  assert.equal((await fetch(`${origin}/api/releases/${'0'.repeat(64)}`)).status,404);
  assert.equal((await fetch(`${origin}/package.json`)).status,404);
  assert.equal((await fetch(`${origin}/player/index.html`)).status,200);
});
test('missing full validator never substitutes the semantic subset or creates a release',async()=>{
  const unavailable=createContentService({python:resolveMissingPython()});
  await assert.rejects(()=>unavailable.release(JSON.stringify(game())),{code:'A2G_E_VALIDATOR_UNAVAILABLE'});assert.equal(unavailable.size,0);
});
function resolveMissingPython(){return `${spec}/tools/nonexistent-python-for-admission-test`;}

test('persistent releases survive a new service, retain receipts, revalidate on restore and preserve capacity',async()=>{
  // Use the workspace filesystem, which may be exFAT rather than the system temp volume's NTFS.
  mkdirSync(join(root,'.tools'),{recursive:true});
  const storageDirectory=mkdtempSync(join(root,'.tools/persistent-release-'));
  const original=createContentService({storageDirectory,maxReleases:1}),definition=game();
  const receipt=await original.release(JSON.stringify(definition)),digest=receipt.sha256Jcs;
  const restored=createContentService({storageDirectory,maxReleases:1});
  assert.equal(restored.size,1);assert.deepEqual(await restored.read(digest),{receipt,definition});
  assert.deepEqual(await restored.release(JSON.stringify(definition)),receipt);
  const different=game();different.meta.title='second release';
  await assert.rejects(()=>restored.release(JSON.stringify(different)),{code:'A2G_E_RELEASE_CAPACITY'});
  const unavailable=createContentService({storageDirectory,python:resolveMissingPython()});
  await assert.rejects(()=>unavailable.read(digest),{code:'A2G_E_VALIDATOR_UNAVAILABLE'});
  const folder=join(storageDirectory,receipt.contextDigest);
  assert.deepEqual(readdirSync(folder),[digest+'.json']);
  const file=join(folder,digest+'.json'),bytes=readFileSync(file);
  const corrupt=JSON.parse(bytes);corrupt.definition.state.goal.initial=99;writeFileSync(file,JSON.stringify(corrupt));
  await assert.rejects(()=>restored.read(digest),{code:'A2G_E_RELEASE_INTEGRITY'});
  await assert.rejects(()=>createContentService({storageDirectory}).read(digest),{code:'A2G_E_RELEASE_INTEGRITY'});
  writeFileSync(file,bytes);assert.deepEqual((await restored.read(digest)).receipt,receipt);
});

test('stored content from another context, invalid storage and self-consistent invalid JSON fail closed',async()=>{
  const storageDirectory=mkdtempSync(join(tmpdir(),'a2game-release-'));
  const first=createContentService({storageDirectory}),receipt=await first.release(JSON.stringify(game()));
  const file=join(storageDirectory,receipt.contextDigest,receipt.sha256Jcs+'.json');
  const envelope=JSON.parse(readFileSync(file,'utf8'));
  // A forged but internally consistent digest must still undergo the full Schema after restart.
  envelope.definition.presentation.hud[0].arbitrary=true;
  const digest=sha256Canonical(envelope.definition);envelope.receipt.sha256Jcs=digest;
  writeFileSync(join(storageDirectory,receipt.contextDigest,digest+'.json'),JSON.stringify(envelope));
  await assert.rejects(()=>createContentService({storageDirectory}).read(digest),{code:'A2G_E_SCHEMA'});
  const old='0'.repeat(64),unknown='1'.repeat(64);mkdirSync(join(storageDirectory,old));
  writeFileSync(join(storageDirectory,old,unknown+'.json'),'{}');
  await assert.rejects(()=>first.read(unknown),{code:'A2G_E_RELEASE_STALE'});
  await assert.rejects(()=>first.read('../private'),{code:'A2G_E_RELEASE_INTEGRITY'});
  const blocked=join(storageDirectory,'not-a-directory');writeFileSync(blocked,'file');
  assert.throws(()=>createContentService({storageDirectory:blocked}),{code:'A2G_E_RELEASE_STORE'});
  assert.equal(readFileSync(blocked,'utf8'),'file');
});
