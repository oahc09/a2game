import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
const game=name=>JSON.parse(readFileSync(`specs/v0.1/samples/games/${name}.game.json`,'utf8'));
const start=d=>{const r=new HeadlessRuntime(d,makeRegistry());r.start();return r;};
const press=(r,action)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step();};

test('fixed-tick integer motion, pause/snapshot replay, constraints and pure body projection',()=>{
 const d=game('realtime-jump'),r=start(d);r.step();press(r,'jump');assert.equal(r.observe().state.world.bodies[0].vy,76);
 const snap=r.snapshot();r.step(12);const expected=r.observe();r.restore(snap);r.step(12);assert.equal(r.observe().exactHash,expected.exactHash);
 r.restore(snap);r.pause();r.step(12);assert.equal(r.observe().tickIndex,snap.tickIndex);r.resume();r.step(12);assert.deepEqual(r.observe().state,expected.state);
 const hash=r.observe().exactHash,frame=projectPresentation(d,r.observe());assert.ok(frame.commands.some(c=>c.id==='body:hero'));assert.equal(r.observe().exactHash,hash);r.dispose();
 const constrained=start(game('realtime-constraint'));constrained.step(20);assert.ok(constrained.observe().state.world.bodies[0].x<=2000);constrained.dispose();
});
test('contacts and damage deduplicate across substeps; pool saturation never overwrites; T5 rollback is atomic',()=>{
 const d=game('realtime-projectile'),r=start(d);press(r,'fire');assert.equal(r.observe().state.world.score,1);assert.equal(r.observe().events.filter(e=>e.type==='combat.hit').length,1);assert.equal(r.observe().events.filter(e=>e.type==='combat.death').length,1);r.dispose();
 const saturated=game('realtime-projectile');saturated.scenes[0].entities[0].components[0].config.maxObjects=2;const full=start(saturated);press(full,'fire');assert.equal(full.observe().state.world.nextId,0);assert.equal(full.observe().state.world.score,0);assert.equal(full.observe().events.filter(e=>e.type==='realtime.pool-full').length,1);full.dispose();
 const bad=game('realtime-jump');bad.requires.all.push({id:'a2game.rules.state-add',version:'0.1.0'});bad.state.guard={type:'int',initial:0,constraints:{max:0}};
 bad.rules=[{id:'rollback',on:{type:'realtime.landed'},do:[{op:'state.add',path:'/guard',value:1}]}];
 const transactional=start(bad),before=structuredClone(transactional.observe().state.world);
 assert.throws(()=>transactional.step(),error=>error.code==='A2G_E_TICK_COMMIT');assert.deepEqual(transactional.observe().state.world,before);assert.equal(transactional.observe().tickIndex,0);transactional.dispose();
 const invalid=game('realtime-jump');invalid.state.world.initial.bodies[0].vx=129;assert.throws(()=>start(invalid));
});
