import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {copyEmbeddedPlayer} from '../scripts/player-sdk-copy.mjs';

const files=['README.md','example.mjs','index.html'];
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'a2game-embed-copy-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const src=join(root,'example'),dst=join(root,'player');
 mkdirSync(src);mkdirSync(dst);
 for(const file of [...files,'not-packaged.mjs'])writeFileSync(join(src,file),'source '+file);
 mkdirSync(join(dst,'adapters'));writeFileSync(join(dst,'adapters/locked.mjs'),'keep');
 return {src,dst};
}

test('embedded files enter the already-populated player directory without copying undeclared files',t=>{
 const {src,dst}=fixture(t);
 copyEmbeddedPlayer(src,dst);
 assert.deepEqual(readdirSync(dst).sort(),['README.md','adapters','example.mjs','index.html']);
 for(const file of files)assert.equal(readFileSync(join(dst,file),'utf8'),'source '+file);
 assert.equal(readFileSync(join(dst,'adapters/locked.mjs'),'utf8'),'keep');
});

test('embedded packaging fails closed on a real collision and does not overwrite destination bytes',t=>{
 const {src,dst}=fixture(t);
 const collision=join(dst,'example.mjs');
 writeFileSync(collision,'keep existing example');
 assert.throws(()=>copyEmbeddedPlayer(src,dst),{code:'EEXIST'});
 assert.equal(readFileSync(collision,'utf8'),'keep existing example');
 assert.equal(readFileSync(join(dst,'adapters/locked.mjs'),'utf8'),'keep');
});
