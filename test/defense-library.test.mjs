import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
const definition=()=>JSON.parse(readFileSync('specs/v0.1/samples/games/h01-candidate.game.json','utf8'));
const start=d=>{const r=new HeadlessRuntime(d??definition(),makeRegistry());r.start();return r;};
const press=(r,action,ticks=1)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step(ticks);};
test('defense merge retires both identities and weapons, inherits cooldown, snapshots replay and rewards cannot fund earlier commands',()=>{
 const r=start();try{
  press(r,'place0');press(r,'place1');const before=r.observe().state.defense,retired=before.towers.map(t=>t.id),weapons=before.weapons.map(w=>w.id),nextFire=Math.max(...before.weapons.map(w=>w.nextFire));
  press(r,'select0');const snapshot=r.snapshot();press(r,'merge1');const s=r.observe().state.defense;
  assert.equal(s.towers.length,1);assert.equal(s.weapons.length,1);assert.equal(s.towers[0].level,2);assert.equal(s.weapons[0].owner,s.towers[0].id);assert.equal(s.weapons[0].nextFire,nextFire);assert.ok(!retired.includes(s.towers[0].id));assert.ok(!weapons.includes(s.weapons[0].id));assert.deepEqual(s.shots,[]);
  const hash=r.observe().exactHash;r.restore(snapshot);press(r,'merge1');assert.equal(r.observe().exactHash,hash);
  r.pause();r.step(80);assert.equal(r.observe().tickIndex,4);assert.deepEqual(r.observe().state.defense,s);r.resume();r.step(180);assert.equal(r.observe().flow.status,'won');assert.equal(r.observe().state.defense.score,3);assert.ok(r.observe().state.defense.shots.every(shot=>!retired.includes(shot.owner)&&!weapons.includes(shot.weapon)));
  r.restart();assert.equal(r.observe().state.defense.nextId,0);assert.deepEqual(r.observe().state.defense.weapons,[]);
 }finally{r.dispose();}
 const d=definition(),cfg=d.scenes[0].entities[0].components[0].config;cfg.waves=[{tick:1,hp:1,reward:2}];d.state.defense.initial.wallet=2;d.outcomes=[];
 const economy=start(d);try{economy.step();for(const action of ['place0','place1']){economy.injectAction({action,phase:'press'});economy.injectAction({action,phase:'release'});}economy.step();assert.equal(economy.observe().state.defense.towers.length,1);assert.equal(economy.observe().state.defense.wallet,2);press(economy,'place1');assert.equal(economy.observe().state.defense.towers.length,2);}finally{economy.dispose();}
});
test('defense rejects dangling owners and invalid wave/action bindings; range, duplicate placement, escapes and timeout are enforced',()=>{
 for(const mutate of [d=>{const s=d.state.defense.initial;s.towers.push({id:'tower_0',cell:0,level:1,weaponId:'weapon_0'});s.weapons.push({id:'weapon_0',owner:'missing',nextFire:0});s.nextId=1;},d=>d.scenes[0].entities[0].components[0].config.waves.reverse(),d=>d.scenes[0].entities[0].components[0].config.actions[0].action='missing']){const d=definition();mutate(d);assert.throws(()=>start(d),e=>e.code==='A2G_E_CAP_CONFIG');}
 const d=definition();d.scenes[0].entities[0].components[0].config.range=16;const r=start(d);try{press(r,'place0');press(r,'place0');assert.equal(r.observe().state.defense.wallet,2);assert.equal(r.observe().state.defense.towers.length,1);r.step(220);assert.equal(r.observe().flow.status,'lost');assert.equal(r.observe().state.defense.score,0);assert.equal(r.observe().state.defense.lives,0);}finally{r.dispose();}
 const timeout=definition();timeout.scenes[0].entities[0].components[0].config.maxTicks=70;const t=start(timeout);try{t.step(71);assert.equal(t.observe().flow.status,'lost');}finally{t.dispose();}
});
test('layered mahjong blocks covered and side-locked tiles, undo restores the occlusion graph state',()=>{
 const d=JSON.parse(readFileSync('specs/v0.1/samples/games/g05-candidate.game.json','utf8')),r=start(d);try{press(r,'cell0');assert.deepEqual(r.observe().state.puzzle.selected,[]);press(r,'cell4');press(r,'cell7');press(r,'cell1');assert.deepEqual(r.observe().state.puzzle.selected,[]);press(r,'undo');assert.equal(r.observe().state.puzzle.board[4],3);assert.equal(r.observe().state.puzzle.display[0],0);for(const i of [4,7,0,3,1,2])press(r,'cell'+i);assert.equal(r.observe().flow.status,'won');}finally{r.dispose();}
});
