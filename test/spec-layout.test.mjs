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
test('all 362 relocated protocol assets retain migration provenance; capability bindings resolve without claiming formal verification',()=>{
 const migration=read('project/spec-layout-migration.json'),moved=Object.entries(migration.files).filter(([p])=>p.startsWith('specs/v0.1/samples/'));
 const downgradedAdapters=new Set(['cocosairjs.adapter.json','threejs.adapter.json','public-turn-room.adapter.json'].map(name=>'specs/v0.1/adapters/'+name));
 const adjustedGames=new Set(['h01-candidate.game.json','h01-reward-upgrade.game.json'].map(name=>'specs/v0.1/games/'+name));
 assert.equal(moved.length,362);for(const [old,row]of moved){
  assert.equal(row.to,canonicalSpecPath(old));assert.equal(row.before,row.after);
  const content=readFileSync(resolve(root,row.to));
  if(sha(content)===row.before)continue;
  if(adjustedGames.has(row.to)){assert.equal(sha(reverseH01Presentation(row.to,content.toString('utf8'))),row.before);continue;}
  // A verification downgrade changes only the status; preserve the original migration digest.
  assert.ok(downgradedAdapters.has(row.to),`Unexpected protocol asset change: ${row.to}`);
  const text=content.toString('utf8');assert.equal(JSON.parse(text).status,'implemented-unverified');
  assert.equal(sha(text.replace('"status": "implemented-unverified"','"status": "verified"')),row.before);
 }
 const registry=makeRegistry(),bindings=read('project/capability-bindings.json');assert.equal(bindings.count,127);assert.equal(bindings.capabilities.length,127);
 for(const c of bindings.capabilities){assert.equal(c.implementation.role,registry.implementation(c).role);assert.deepEqual(c.dependencies,registry.negotiate({all:[{id:c.id,version:c.version}]}).capabilities);assert.equal(c.formalVerification,'NOT_SIGNED_OFF');}
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
  const catalog=await loadBuiltinCatalog();assert.equal(catalog.length,112);assert.ok(catalog.every(c=>c.path.startsWith('/specs/v0.1/games/')));
  const game=await loadBuiltinGame('grid-push');assert.equal(game.id,'org.a2game.samples.grid-push');
 }finally{globalThis.fetch=originalFetch;await new Promise(ok=>server.close(ok));}
});
