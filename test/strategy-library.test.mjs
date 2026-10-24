import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime,findGridPath} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
const game=name=>JSON.parse(readFileSync(`specs/v0.1/samples/games/${name}.game.json`));
const start=d=>{const r=new HeadlessRuntime(d,makeRegistry());r.start();return r;};
const press=(r,action,ticks=1)=>{r.injectAction({action,phase:'press'});r.injectAction({action,phase:'release'});r.step(ticks);};
test('economy cost/production/collection are atomic, use Tick time and reject repeated or unaffordable actions',()=>{
 const r=start(game('strategy-farm'));press(r,'collect');assert.equal(r.observe().state.economy.wallet,10);press(r,'plant');assert.equal(r.observe().state.economy.wallet,8);r.pause();r.step(50);assert.equal(r.observe().tickIndex,2);r.resume();press(r,'collect');assert.equal(r.observe().state.economy.score,0);press(r,'collect');assert.equal(r.observe().state.economy.wallet,11);assert.equal(r.observe().state.economy.inventory.seed,1);r.dispose();
 const shop=start(game('strategy-shop'));for(const a of ['buy','unlock','buy','place','buy'])press(shop,a);assert.equal(shop.observe().state.economy.wallet,1);assert.deepEqual(shop.observe().state.economy.grid,[1,0,0,0]);shop.dispose();
});
test('turn legality preserves player on occupied cells and win/draw use board geometry',()=>{
 const r=start(game('strategy-turn'));press(r,'cell0');press(r,'cell0');assert.equal(r.observe().state.turn.player,2);assert.equal(r.observe().state.turn.moves,1);for(const a of ['cell3','cell1','cell4','cell2'])press(r,a);assert.equal(r.observe().state.turn.winner,1);assert.equal(r.observe().flow.status,'won');r.dispose();
 const d=game('strategy-turn');d.outcomes=[];const draw=start(d);for(const i of [0,1,2,4,3,5,7,6,8])press(draw,'cell'+i);assert.equal(draw.observe().state.turn.draw,true);assert.equal(draw.observe().state.turn.winner,0);draw.dispose();
});
test('deck shuffle replays exactly and conserves cards; path stays bounded and composes before T5',()=>{
 const d=game('strategy-shuffle'),a=start(d),b=start(d);for(const r of [a,b])for(const action of ['draw','draw','play0'])press(r,action);assert.equal(a.observe().exactHash,b.observe().exactHash);
 const s=a.observe().state.cards;assert.deepEqual([...s.deck,...s.hand,...s.discard].sort((a,b)=>a-b),[1,2,3,4,5]);const snap=a.snapshot();press(a,'draw');const hash=a.observe().exactHash;a.restore(snap);press(a,'draw');assert.equal(a.observe().exactHash,hash);a.dispose();b.dispose();
 assert.deepEqual(findGridPath(3,2,[1],0,2),[0,3,4,5,2]);assert.deepEqual(findGridPath(3,2,[1,4],0,2),[]);
 const path=start(game('strategy-path'));path.step(2);assert.equal(path.observe().state.world.bodies[0].x,1256);assert.equal(path.observe().state.path.arrived,true);path.dispose();
 const towerGame=game('strategy-tower');towerGame.scenes[0].entities[0].components[1].config.weaponRange=1;
 const tower=start(towerGame);tower.step(3);assert.equal(tower.observe().state.world.score,0);assert.equal(tower.observe().state.world.bodies.find(b=>b.id==='target').hp,3);
 const detached=tower.snapshot();detached.state.world.bodies=detached.state.world.bodies.filter(b=>b.id!=='target');tower.restore(detached);tower.step();assert.ok(tower.observe().events.some(e=>e.type==='strategy.detached'));assert.equal(tower.observe().flow.status,'playing');tower.dispose();
});
