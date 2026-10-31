import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateGame,exportGamePackage,importGamePackage,startGeneratorStudio} from '../generator/index.mjs';
test('content package roundtrip revalidates unchanged JSON and refuses tampering/overwrite',async()=>{
 const base=mkdtempSync(join(tmpdir(),'a2game-package-test-')),source=join(base,'source'),output=join(base,'imported');
 const generated=await generateGame({prompt:'counter',mode:'game-plan',outputDirectory:source});assert.equal(generated.status,'PASS_REFERENCE');
 const pack=await exportGamePackage(source),text=JSON.stringify(pack);
 const imported=await importGamePackage(text,output);assert.equal(imported.status,'PASS_REFERENCE');assert.equal(imported.importModelCalls,0);assert.equal(imported.G3,'NOT_RUN');
 assert.deepEqual(JSON.parse(readFileSync(join(output,'game.json'),'utf8')),JSON.parse(readFileSync(join(source,'game.json'),'utf8')));
 await assert.rejects(importGamePackage(text,output),{code:'A2G_GEN_OUTPUT_EXISTS'});
 const changed=structuredClone(pack);changed.files.solution[0].ticks=2;
 await assert.rejects(importGamePackage(JSON.stringify(changed),join(base,'bad')),{code:'A2G_GEN_PACKAGE_INTEGRITY'});assert.equal(existsSync(join(base,'bad')),false);
 await assert.rejects(importGamePackage(text.replace('{','{"version":1,'),join(base,'duplicate')),{code:'A2G_GEN_PACKAGE_JSON'});
});
test('Studio rejects foreign origins, browser config injection and unbudgeted real calls, then closes',async()=>{
 const studio=await startGeneratorStudio({providerId:'codex',maxCalls:0});const url=studio.url+'api/';
 try{
  assert.equal((await fetch(url+'status',{headers:{Origin:'https://foreign.example'}})).status,403);
  assert.equal((await fetch(url+'jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const headers={'Content-Type':'application/json','X-A2Game-Studio':'1'},input={prompt:'counter',mode:'direct-json',providerId:'codex',maxAttempts:1};
  const blocked=await fetch(url+'jobs',{method:'POST',headers,body:JSON.stringify(input)});assert.equal((await blocked.json()).code,'A2G_GEN_STUDIO_BUDGET');
  const injected=await fetch(url+'jobs',{method:'POST',headers,body:JSON.stringify({...input,providerId:'fixture',configFile:'arbitrary.json'})});assert.equal((await injected.json()).code,'A2G_GEN_STUDIO_INPUT');
  assert.equal((await (await fetch(url+'status')).json()).jobs.length,0);
 }finally{await studio.close();await studio.close();}
 await assert.rejects(fetch(url+'status'));
});
