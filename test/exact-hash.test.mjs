import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalJson,sha256Hex,sha256Canonical,exactStateHash,HeadlessRuntime,A2GameError} from '../dist/index.js';
import {makeRegistry,spec} from '../scripts/registry.mjs';
const game = ()=>JSON.parse(readFileSync(`${spec}/samples/games/tap-target.game.json`,'utf8'));

test('SHA256 FIPS 180-4 known vectors and Node crypto parity',()=>{
  const enc = new TextEncoder();
  const vec = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['The quick brown fox jumps over the lazy dog','d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ];
  for(const [str,digest] of vec) assert.equal(sha256Hex(enc.encode(str)),digest);
  for(let i=0;i<25;i++) {
    const bytes=Uint8Array.from({length:i*251},(_,j)=>(j*43+i)%256);
    assert.equal(sha256Hex(bytes),createHash('sha256').update(bytes).digest('hex'));
  }
});
test('RFC8785 JCS key sorting uses UTF-16, and number serialization uses ES JSON',()=>{
 const value={'\uE000':2,'\u{1F600}':1,'z':4,'a':3,numbers:[1e30, 4.5,1e-27,-0]};
 assert.equal(canonicalJson(value), '{"a":3,"numbers":[1e+30,4.5,1e-27,0],"z":4,"😀":1,"":2}');
 assert.equal(sha256Canonical(value),createHash('sha256').update(canonicalJson(value)).digest('hex'));
 for (const v of ['\uD800','\uDC00']) assert.throws(()=>canonicalJson({bad:v}),(e)=>e instanceof A2GameError&&e.code==='A2G_E_HASH_CANONICAL');
});
test('exactHash is stable across sessions and complete snapshot/restore',()=>{
 const a=new HeadlessRuntime(game(),makeRegistry()),b=new HeadlessRuntime(game(),makeRegistry());
 assert.equal(a.observe().exactHash,b.observe().exactHash);
 assert.match(a.observe().exactHash,/^[a-f0-9]{64}$/);
 assert.equal(a.observe().exactHashVersion,1);
 const before=a.observe().exactHash;
 a.start();b.start();assert.equal(a.observe().exactHash,b.observe().exactHash);
 const snap=a.snapshot();
 a.injectAction({action:'collect',phase:'press',sourceId:'test'});
 a.injectAction({action:'collect',phase:'release',sourceId:'test'});
 a.step();
 assert.notEqual(a.observe().exactHash,b.observe().exactHash);
 const progressed=a.observe().exactHash;
 b.injectAction({action:'collect',phase:'press',sourceId:'test'});
 b.injectAction({action:'collect',phase:'release',sourceId:'test'});
 b.step();assert.equal(b.observe().exactHash,progressed);
 a.restore(snap); assert.equal(a.observe().exactHash,exactStateHash(snap));
 assert.notEqual(a.observe().exactHash,before);
 a.dispose();b.dispose();
});
test('canonical hash is independent of insertion order and presentation values',()=>{
 const a=new HeadlessRuntime(game(),makeRegistry());a.start();const snapshot=a.snapshot();
 const reinsert={...snapshot, state:{goal:snapshot.state.goal,score:snapshot.state.score}};
 assert.equal(exactStateHash(snapshot),exactStateHash(reinsert));
 reinsert.entities={unused:{id:'unused',tags:[],state:{active:true},transform:{},components:[]}};
 assert.notEqual(exactStateHash(snapshot),exactStateHash(reinsert));
 snapshot.feedback.push({type:'sparkle'});
 assert.equal(exactStateHash(snapshot),a.observe().exactHash);
});
