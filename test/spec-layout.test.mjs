import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {canonicalSpecPath,sourceMatches,evidenceMatches,SPEC_LAYOUT_REPLACEMENTS} from '../scripts/spec-layout.mjs';
import {makeRegistry,root} from '../scripts/registry.mjs';
import {createPlayerServer} from '../scripts/serve.mjs';
import {createContentService} from '../scripts/content-service.mjs';
import {loadBuiltinCatalog,loadBuiltinGame} from '../player/content-loader.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p))),sha=b=>createHash('sha256').update(b).digest('hex');
// Explicit post-migration public-contract revisions; never qualify old evidence for new bytes.
const publicContractRevisions={
  "specs/v0.1/capabilities/a2game.input.touch.select.capability.json": {before: "f455ce06a808b6149181d02356913f423d77498db0ebcc23f21215b25d6843a7", current: "38c79975d1531aee6f22ad9bdf0f5043178262390adb9f9f9aaf3eb354a1e522"},
  "specs/v0.1/capabilities/a2game.puzzle.tray.capability.json": {before: "3a1f42b0a5f39cef09a495e49e14d5c0f3044c021aece78c7d3e5defe688156f", current: "e5b91053e76dae27b353af9d1593b4392c8e6f705bd38fadbc2156ac5f6b7884"},
  "specs/v0.1/capabilities/a2game.realtime.input-control.capability.json": {before: "829fad8bc8992ba893b2e7504a0a064695555d1ae60827922487d085382aa87f", current: "b2fb0d80d46357e97debc2d079c58d5c9a89770150ccbb5c546e1492f6d25515"},
  "specs/v0.1/capabilities/a2game.physics.rigid3d.capability.json": {before: "27993268426195158afb371f4d28b4742f230f3b6930e40cb5da8962627afb13", current: "a39d165d329f48677cbf4a729a37b9204d3c11409ba366e8ceb3273076a91520"},
  "specs/v0.1/capabilities/a2game.input.gamepad.axis2.capability.json": {
    "before": "16d9838030931606d977a68d226c63cf8c35750565c2334e6cad3193f2e88d39",
    "current": "c8e5139bc4d0fb7257bfc223cd4a0912af95c44dd0ca59429bd023e3994bbf0d"
  },
  "specs/v0.1/capabilities/a2game.input.gamepad.button.capability.json": {
    "before": "e5f04204554acc82859eb5b6781cce2a14c88f66a68721bb06393a0c177d70a2",
    "current": "2a80d45495c17aee1e6102c350a486cf3bd22a49f6e53e58e8d5743298e067dd"
  },
  "specs/v0.1/capabilities/a2game.input.touch.drag.capability.json": {
    "before": "897604edec9605cfa6554ecc4abeac00e0da951f77899991ad2940f7c7000147",
    "current": "365d2effa12ea20da9acede6ce479e68cfb7da015c5b4c3a5467471672ccfaa1"
  },
  "specs/v0.1/capabilities/a2game.rules.state-set.capability.json": {
    "before": "d1577ee06290f51848e02d33591008367a3690b2b3ec43654b29014d31db9067",
    "current": "43f5fa30e9eff340d402a57ff005d2ac54037372e6576d66a80af814aa03ae04"
  },
  "specs/v0.1/capabilities/a2game.puzzle.swap.capability.json": {
    "before": "b8854b33b62aa0f4244fe1bad17b18520ac1f0e1c829e36e000b99c998cb8d40",
    "current": "70cb96cda4cbb9e2979d3be3d1021b0c5f45e3ea90ff998a9935553ccb6ed6e4"
  },
  "specs/v0.1/capabilities/a2game.realtime.world.capability.json": {
    "before": "b0e237589ccd1173649e20377b5f3dd0a7d822a91b9be4aa406a7a6eceb96da6",
    "current": "9e1f93d60855a7f8feb0a11bcd884f956590a6e0cede5b5b113875a574ec36d3"
  },
  "specs/v0.1/capabilities/a2game.strategy.tower-defense.capability.json": {
    "before": "6ae334f9e6fcc4278176750174635c1848ce3fac977eefacfa98ce15806b9859",
    "current": "7b564a15c71fa502658e4364880c9e2f88b7bc85249513bb122746772d896dde"
  },
  "specs/v0.1/capabilities/a2game.turnbased.turn.capability.json": {
    "before": "a9e3a34d59178bc43d2716e6379fae82d451165b22f90fa48ea0487f263e1a1f",
    "current": "8abcf1f5beb5da309fef8727d3d82b0338b6ab4c9df5c1905e9d4caa666d9320"
  },
  "specs/v0.1/capabilities/a2game.visual.bound-stage.capability.json": {
    "before": "f19001bc3b0c6dc53e512a9efb62a716bdc0b58ab466b552dec7aa33caaffc8d",
    "current": "c65848d79b2fdc6670de5bdb26b64d11c0249e58f8767201ef534a92f64c42e0"
  }
};
function assertPublicContractRevision(path,before,content){
 assert.ok(Object.hasOwn(publicContractRevisions,path),'Unregistered public contract revision');const revision=publicContractRevisions[path];assert.equal(before,revision.before);assert.equal(sha(content),revision.current);
}
function reverseH01Presentation(path,text){
 const variant=path.endsWith('/h01-reward-upgrade.game.json'),game=JSON.parse(text);
 assert.equal(JSON.stringify(game,null,2)+'\n',text);
 assert.equal(game.revision,variant?4:5);game.revision=variant?2:3;
 const layer=game.presentation.scene2d.bodyLayer;assert.equal(layer.minValueFontSize,0.6);assert.equal(layer.minValueBodySize,0.8);delete layer.minValueFontSize;delete layer.minValueBodySize;
 const nodes=game.presentation.scene2d.nodes;
 for(let i=0;i<3;i++){const matches=nodes.filter(node=>node.id==='slot-label'+i);assert.equal(matches.length,1);assert.equal(matches[0].fontSize,0.5);assert.equal(matches[0].at[1],-1.8);matches[0].fontSize=0.18;matches[0].at[1]=-1.55;}
 const title=nodes.filter(node=>node.id==='title'),hint=nodes.filter(node=>node.id==='hint');assert.equal(title.length,1);assert.equal(hint.length,1);
 assert.deepEqual([title[0].at,title[0].fontSize,title[0].text.literal],[[0,3.25],0.6,variant?'炮台保卫战 · 变体':'炮台保卫战']);
 assert.deepEqual([hint[0].at,hint[0].fontSize,hint[0].text.literal],[[0,-3.35],0.5,variant?'合成后用奖励升级':'先建塔，再选择并合成']);
 title[0].at=[0,3.6];title[0].fontSize=0.26;title[0].text.literal=variant?'H01 合成炮台保卫战 · 变体':'H01 合成炮台保卫战';
 hint[0].at=[0,-3.65];hint[0].fontSize=0.14;hint[0].text.literal=variant?'合成后用首波奖励升级：未升级无法击退末波':'place0、place1 建塔，select0 后 merge1 合成；旧炮与武器释放，抵御三波。';
 return JSON.stringify(game,null,2)+'\n';
}
function assertMigratedAsset(old,row,content){
 const downgradedAdapters=new Set(['cocosairjs.adapter.json','threejs.adapter.json','public-turn-room.adapter.json'].map(name=>'specs/v0.1/adapters/'+name));
 const adjustedGames=new Set(['h01-candidate.game.json','h01-reward-upgrade.game.json'].map(name=>'specs/v0.1/games/'+name));
  assert.equal(row.to,canonicalSpecPath(old));assert.equal(row.before,row.after);
  if(Object.hasOwn(publicContractRevisions,row.to))assert.equal(row.before,publicContractRevisions[row.to].before,'Historical digest cannot be re-signed');
  if(sha(content)===row.before)return;
  if(adjustedGames.has(row.to)){assert.equal(sha(reverseH01Presentation(row.to,content.toString('utf8'))),row.before);return;}
  if(Object.hasOwn(publicContractRevisions,row.to)){assertPublicContractRevision(row.to,row.before,content);assert.equal(sourceMatches(root,row.to,row.before),false);assert.equal(evidenceMatches(root,row.to,row.before),false);return;}
  // A verification downgrade changes only the status; preserve the original migration digest.
  assert.ok(downgradedAdapters.has(row.to),`Unexpected protocol asset change: ${row.to}`);
  const text=content.toString('utf8');assert.equal(JSON.parse(text).status,'implemented-unverified');
  assert.equal(sha(text.replace('"status": "implemented-unverified"','"status": "verified"')),row.before);
}
test('all 362 relocated protocol assets retain migration provenance; capability bindings resolve without claiming formal verification',()=>{
 const migration=read('project/spec-layout-migration.json'),moved=Object.entries(migration.files).filter(([p])=>p.startsWith('specs/v0.1/samples/'));
 assert.equal(moved.length,362);for(const [old,row]of moved)assertMigratedAsset(old,row,readFileSync(resolve(root,row.to)));
 const registry=makeRegistry(),bindings=read('project/capability-bindings.json'),coverage=read('project/status.json').coverage;
 assert.equal(bindings.count,coverage.referenceCapabilityManifests);assert.equal(bindings.capabilities.length,registry.list().length);
 assert.deepEqual(bindings.capabilities.map(c=>c.id),registry.list().map(c=>c.id));
 assert.ok(bindings.capabilities.some(c=>c.id==='a2game.visual.body-motif'));
 for(const c of bindings.capabilities){assert.equal(c.implementation.role,registry.implementation(c).role);assert.deepEqual(c.dependencies,registry.negotiate({all:[{id:c.id,version:c.version}]}).capabilities);assert.equal(c.formalVerification,'NOT_SIGNED_OFF');}
});
test('actual migration path rejects extra-byte drift and re-signing historical metadata as current',()=>{
 const migration=read('project/spec-layout-migration.json');
 for(const [path,revision] of Object.entries(publicContractRevisions)){const [old,row]=Object.entries(migration.files).find(([,r])=>r.to===path),bytes=readFileSync(resolve(root,path));assert.doesNotThrow(()=>assertMigratedAsset(old,row,bytes));assert.throws(()=>assertMigratedAsset(old,{...row,before:revision.current,after:revision.current},bytes));assert.throws(()=>assertMigratedAsset(old,row,Buffer.concat([bytes,Buffer.from(' ')])));}
 const [old,row]=Object.entries(migration.files).find(([,r])=>r.to==='specs/v0.1/capabilities/a2game.core.state.capability.json');assert.throws(()=>assertMigratedAsset(old,row,Buffer.concat([readFileSync(resolve(root,row.to)),Buffer.from(' ')])));
});
test('historical fingerprints accept only reversible path edits and reject semantic edits even when migration metadata is modified',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'a2game-spec-layout-'));
 try{
  mkdirSync(resolve(dir,'scripts'));mkdirSync(resolve(dir,'project'));
  const before="const path='specs/v0.1/samples/games/a.game.json';",after=before.replace('samples/games','games'),path='scripts/demo.mjs',rule=SPEC_LAYOUT_REPLACEMENTS.findIndex(([a])=>a==='samples/games');
  const row={to:path,before:sha(before),after:sha(after),reverseSteps:[{rule,offsets:[before.indexOf('samples/games')]}]},migration={format:'a2game-spec-layout-migration',version:1,replacements:SPEC_LAYOUT_REPLACEMENTS,files:{[path]:row}};
  const save=()=>writeFileSync(resolve(dir,'project/spec-layout-migration.json'),JSON.stringify(migration));save();writeFileSync(resolve(dir,path),after);assert.equal(sourceMatches(dir,path,row.before),true);
  const tampered=after+"\nrunUnapprovedCode();";writeFileSync(resolve(dir,path),tampered);assert.equal(sourceMatches(dir,path,row.before),false);
  row.after=sha(tampered);save();assert.equal(sourceMatches(dir,path,row.before),false);assert.equal(evidenceMatches(dir,path,row.before),false);
  assert.equal(sourceMatches(dir,'../escape',row.before),false);
 }finally{assert.ok(dir.startsWith(resolve(tmpdir(),'a2game-spec-layout-')));rmSync(dir,{recursive:true,force:true});}
});
test('HTTP exposes canonical game/capability URLs while keeping protocol tools and private files outside public roots',async()=>{
 const server=createPlayerServer({contentService:createContentService()});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const originalFetch=globalThis.fetch;
 try{const origin='http://127.0.0.1:'+server.address().port;
  for(const path of ['/specs/v0.1/games/tap-target.game.json','/specs/v0.1/capabilities/a2game.core.state.capability.json'])assert.equal((await fetch(origin+path)).status,200);
  for(const path of ['/specs/v0.1/samples/games/tap-target.game.json','/specs/v0.1/tools/build_artifacts.py','/project/status.json'])assert.equal((await fetch(origin+path)).status,404);
  globalThis.fetch=(url,...args)=>originalFetch(new URL(url,origin+'/player/'),...args);
  const catalog=await loadBuiltinCatalog();assert.equal(catalog.length,read('project/status.json').coverage.referenceDemoGames);assert.ok(catalog.every(c=>c.path.startsWith('/specs/v0.1/games/')));
  assert.ok(catalog.some(c=>c.path==='/specs/v0.1/games/body-motif.game.json'));
  for(const slug of ['g35-minesweeper','g35-minesweeper-wide','g41-snake','g41-snake-wide','g59-neon-arena','g59-neon-arena-mirror','g59-neon-survival']){
   const id='org.a2game.games.'+slug;
   assert.ok(catalog.some(c=>c.id===id&&c.path==='/specs/v0.1/games/'+slug+'.game.json'));
   assert.equal((await loadBuiltinGame(slug)).id,id);
  }
  const game=await loadBuiltinGame('grid-push');assert.equal(game.id,'org.a2game.samples.grid-push');
 }finally{globalThis.fetch=originalFetch;await new Promise(ok=>server.close(ok));}
});
