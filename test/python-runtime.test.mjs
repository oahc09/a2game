import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {requirePython} from '../scripts/python-runtime.mjs';

const root=import.meta.dirname+'/..';
const run=(args,env)=>spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:15000});
const probe=`import {requirePython} from './scripts/python-runtime.mjs';
try { console.log(requirePython(process.argv[1],{schema:true})); }
catch(e) { console.error(e.code,e.message); process.exitCode=1; }`;

test('explicit Python wins; invalid configured Python fails closed with sanitized setup help',()=>{
 const executable=requirePython(undefined,{schema:true});
 const bad=join(tmpdir(),'not-python-a2game-sensitive-marker');
 const env={...process.env,A2GAME_PYTHON:bad};
 const explicit=run(['--input-type=module','-e',probe,executable],env);
 assert.equal(explicit.status,0,explicit.stderr);
 assert.equal(explicit.stdout.trim(),executable);
 const configured=run(['--input-type=module','-e',probe],env);
 assert.equal(configured.status,1);assert.match(configured.stderr,/A2G_E_PYTHON_UNAVAILABLE/);
 assert.doesNotMatch(configured.stderr,/sensitive-marker/);
});

test('complete Schema dependency is checked instead of silently downgrading validation',()=>{
 const path=mkdtempSync(join(tmpdir(),'a2game-python-dep-'));
 try{
  writeFileSync(join(path,'jsonschema.py'),'raise ImportError("private dependency diagnosis")\n');
  const env={...process.env,A2GAME_PYTHON:requirePython(),PYTHONPATH:path};
  const result=run(['scripts/run-python.mjs','scripts/preflight.py'],env);
  assert.equal(result.status,1);assert.match(result.stderr,/A2G_E_PYTHON_SCHEMA/);
  assert.match(result.stderr,/requirements-dev\.txt/);
  assert.doesNotMatch(result.stderr,/private dependency diagnosis/);
  const stdlib=run(['--input-type=module','-e',"import {requirePython} from './scripts/python-runtime.mjs'; console.log(requirePython());"],env);
  assert.equal(stdlib.status,0,stdlib.stderr);
 }finally{rmSync(path,{recursive:true,force:true});}
});

test('a checkout without a venv can select python3 from PATH', {skip:process.platform==='win32'||existsSync(join(root,'.venv','bin','python'))},()=>{
 const path=mkdtempSync(join(tmpdir(),'a2game-python3-only-'));
 try{
  symlinkSync(requirePython(),join(path,'python3'));
  const env={...process.env,PATH:path};delete env.A2GAME_PYTHON;
  const result=run(['--input-type=module','-e',"import {resolvePython,requirePython} from './scripts/python-runtime.mjs'; console.log(resolvePython());requirePython();"],env);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'python3');
 }finally{rmSync(path,{recursive:true,force:true});}
});

test('creator and agent workflow fail before provider launch or receipt creation; undo reports infrastructure',()=>{
 const path=mkdtempSync(join(tmpdir(),'a2game-python-entry-'));
 try{
  const missing=join(path,'missing-python'),env={...process.env,A2GAME_PYTHON:missing};
  const providerMarker=join(path,'provider-ran'),directory=join(path,'run'),cfg=join(path,'agent.json'),input=join(path,'input.json');
  writeFileSync(cfg,JSON.stringify({prompt:'offline validation only',
   command:[process.execPath,'-e',`require('node:fs').writeFileSync(${JSON.stringify(providerMarker)},'unexpected')`],directory}));
  writeFileSync(input,'{}');
  const workflow=run(['scripts/agent-workflow.mjs',cfg],env);
  assert.equal(workflow.status,1);
  assert.match(workflow.stderr,/A2G_E_PYTHON_UNAVAILABLE/);
  assert.doesNotMatch(workflow.stderr,/A2G_E_PROVIDER_START|missing-python/);
  assert.equal(existsSync(providerMarker),false);assert.equal(existsSync(directory),false);
  const undo=run(['scripts/check-illegal-undo.mjs',input,input],env);
  assert.equal(undo.status,2);assert.match(undo.stderr,/A2G_E_PYTHON_UNAVAILABLE/);
  assert.doesNotMatch(undo.stderr,/A2G_E_MECHANICS_INPUT|missing-python/);
  const creator=run(['--input-type=module','-e',`import {generateGame} from './generator/index.mjs';
   console.log(JSON.stringify(await generateGame({prompt:'fixture',providerId:'fixture'})));`],env);
  assert.equal(creator.status,0,creator.stderr);
  const receipt=JSON.parse(creator.stdout);
  assert.equal(receipt.status,'BLOCKED');assert.equal(receipt.category,'PROVIDER_INFRA');
  assert.equal(receipt.code,'A2G_E_PYTHON_UNAVAILABLE');assert.equal(receipt.generationCalls,0);
 }finally{rmSync(path,{recursive:true,force:true});}
});
