import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256Canonical,compileGame,HeadlessRuntime} from '../dist/index.js';
import {makeRegistry,spec} from '../scripts/registry.mjs';
const root=new URL('../',import.meta.url);
function game(){return JSON.parse(readFileSync(join(spec,'games/tap-target.game.json'),'utf8'));}
function validate(obj){
 const dir=mkdtempSync(join(tmpdir(),'a2game-schema-'));
 try {
  const input=join(dir,'game.json');writeFileSync(input,JSON.stringify(obj));
  const exec=spawnSync('python',['scripts/validate-one.py','game',input],{cwd:root,encoding:'utf8'});
  return {status:exec.status,result:JSON.parse(exec.stdout)};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('Draft 2020-12 Python validator admits sample and rejects structural modifications',()=>{
 let original=game();assert.equal(validate(original).status,0);
 const extra=structuredClone(original);extra.presentation.hud[0].arbitrary=true;
 const failure=validate(extra);assert.equal(failure.status,1);assert.equal(failure.result.status,'FAIL');assert.ok(failure.result.errors[0].pointer.startsWith('/presentation'));
 const missing=structuredClone(original);delete missing.meta.genres;assert.equal(validate(missing).status,1);
});
test('body value display minimums require bounded numbers and enabled labels',()=>{
 const game=JSON.parse(readFileSync(join(spec,'games/h01-candidate.game.json'),'utf8'));assert.equal(validate(game).status,0);
 for(const [key,value] of [['minValueFontSize',0],['minValueBodySize',2.1],['showValues',false]]){const bad=structuredClone(game);bad.presentation.scene2d.bodyLayer[key]=value;assert.equal(validate(bad).status,1);}
});
test('Release catalog only whitelists full-schema-validated exact JCS digest',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../player/validated-games.json',import.meta.url)));
 const path='/specs/v0.1/games/tap-target.game.json';
 const entry=catalog.content[path];const def=game();
 assert.equal(entry.sha256Jcs,sha256Canonical(def));
 const injected=structuredClone(def);injected.state.score.initial=99;
 assert.notEqual(entry.sha256Jcs,sha256Canonical(injected));
});
test('Undefined and lone-surrogate nested inputs rejected before runtime creation',()=>{
 const a=game();a.meta.title='broken\ud800';assert.throws(()=>new HeadlessRuntime(a,makeRegistry()),e=>e.code==='A2G_E_STATE_TYPE');
 const b=game();b.meta.extra=[0,,2];assert.throws(()=>compileGame(b,makeRegistry()),e=>e.code==='A2G_E_STATE_TYPE');
});
