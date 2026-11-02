import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readPublicResource} from '../integrations/mcp/resources.mjs';
import {tmpdir} from 'node:os';
import {prepareHostWorkspace,verifyPublicWorkspace} from '../scripts/host-public-workspace.mjs';
import {sandboxArguments,probeAuthoringSandbox,launchAuthoringSandbox} from '../scripts/host-authoring-sandbox.mjs';
function setup(){const base=mkdtempSync(join(tmpdir(),'a2game-public-'));const repo=join(base,'repository'),run=join(base,'run');for(const p of ['specs/v0.1/schemas','specs/v0.1/capabilities','specs/v0.1/games','docs','integrations/skill/a2game/references'])mkdirSync(join(repo,p),{recursive:true});mkdirSync(join(run,'candidate'),{recursive:true});writeFileSync(join(repo,'specs/v0.1/schemas/game.schema.json'),'{}');writeFileSync(join(repo,'specs/v0.1/capabilities/a2game.core.state.capability.json'),'{}');writeFileSync(join(repo,'specs/v0.1/games/g01.game.json'),'PRIVATE ANSWER');writeFileSync(join(repo,'docs/host-agent-pilot.md'),'Public task');for(const name of ['SKILL.md','references/workflow.md','references/troubleshooting.md'])writeFileSync(join(repo,'integrations/skill/a2game',name),'Public Skill '+name);const isolation=prepareHostWorkspace(run,repo);writeFileSync(join(run,'run.json'),JSON.stringify({isolation}));return {base,repo,run,isolation};}
test('public capsule contains only allowlisted contracts; additions and modified bytes fail closed',()=>{const x=setup();try{assert.equal(x.isolation.status,'PREPARED_NOT_ISOLATED');assert.equal(verifyPublicWorkspace(join(x.run,'public-context'),x.isolation.manifestSha256).status,'VERIFIED_PUBLIC_BYTES');assert.deepEqual(readdirSync(join(x.run,'public-context')).sort(),['AUTHORING.md','TASK.md','capabilities','manifest.json','resources','schemas','skill']);writeFileSync(join(x.run,'public-context','answer.json'),'{}');assert.throws(()=>verifyPublicWorkspace(join(x.run,'public-context'),x.isolation.manifestSha256));rmSync(join(x.run,'public-context','answer.json'));writeFileSync(join(x.run,'public-context/schemas/game.schema.json'),'{"modified":true}');assert.throws(()=>sandboxArguments(x.run));}finally{rmSync(x.base,{recursive:true,force:true});}});
test('capsule source and destination symlinks cannot smuggle repository answers',()=>{const x=setup();try{const p=join(x.repo,'specs/v0.1/schemas/leak.json');symlinkSync(join(x.repo,'specs/v0.1/games/g01.game.json'),p);const run2=join(x.base,'other');mkdirSync(run2);assert.throws(()=>prepareHostWorkspace(run2,x.repo));const output=join(x.run,'candidate');rmSync(output,{recursive:true});symlinkSync(x.repo,output,'dir');assert.throws(()=>sandboxArguments(x.run));}finally{rmSync(x.base,{recursive:true,force:true});}});
test('sandbox policy has no repository/home/network/config mounts and clears inherited environment',()=>{const x=setup();try{const args=sandboxArguments(x.run);assert.ok(args.includes('--unshare-all'));assert.ok(args.includes('--clearenv'));assert.ok(!args.includes('--share-net'));assert.ok(!args.includes(x.repo));assert.ok(!args.includes('/home'));assert.ok(!args.includes('/'));assert.equal(args.filter(a=>a==='--bind').length,1);assert.ok(args.includes(join(x.run,'candidate')));}finally{rmSync(x.base,{recursive:true,force:true});}});
test('unsupported or denied isolation never launches authoring command or falls back unsandboxed',()=>{const x=setup();try{let calls=0;const spawn=()=>{calls++;return {status:1,stderr:'namespace denied'};};assert.equal(launchAuthoringSandbox(x.run,process.execPath,[],{spawn,platform:'linux'}).status,'BLOCKED_OS_ISOLATION');assert.equal(calls,1);assert.equal(probeAuthoringSandbox(x.run,{spawn,platform:'win32'}).status,'BLOCKED_OS_ISOLATION');assert.equal(calls,1);}finally{rmSync(x.base,{recursive:true,force:true});}});
test('a successful probe is not host identity or independent-generation acceptance',()=>{const x=setup();try{const spawn=()=>({status:0,stdout:JSON.stringify({probe:'isolated-filesystem',manifestSha256:x.isolation.manifestSha256})});const result=probeAuthoringSandbox(x.run,{spawn,platform:'linux'});assert.equal(result.status,'VERIFIED_OS_SANDBOX');assert.equal(result.independentAuthoring,'NOT_VERIFIED');const bad=probeAuthoringSandbox(x.run,{spawn:()=>({status:0,stdout:'{}'}),platform:'linux'});assert.equal(bad.status,'BLOCKED_OS_ISOLATION');}finally{rmSync(x.base,{recursive:true,force:true});}});

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const rewriteManifest=(x,edit)=>{const path=join(x.run,'public-context/manifest.json'),manifest=JSON.parse(readFileSync(path));edit(manifest);const bytes=JSON.stringify(manifest);writeFileSync(path,bytes);return hash(bytes);};
test('v2 capsule binds exact shared Skill, mounted task, versioned resource content and envelopes without answers',()=>{
 const x=setup();try{
  const base=join(x.run,'public-context'),manifest=JSON.parse(readFileSync(join(base,'manifest.json')));
  assert.equal(manifest.version,2);assert.equal(manifest.task.mode,'LEGACY_EXPLICIT_GUIDE');assert.equal(manifest.task.taskId,'G01');
  assert.equal(manifest.task.promptSha256,hash(readFileSync(join(base,'TASK.md'))));assert.deepEqual(readFileSync(join(base,'TASK.md')),readFileSync(join(x.run,'TASK.md')));
  for(const name of ['SKILL.md','references/workflow.md','references/troubleshooting.md'])assert.deepEqual(readFileSync(join(base,'skill',name)),readFileSync(join(x.repo,'integrations/skill/a2game',name)));
  for(const name of ['host-profile','contract-fragments']){const uri='a2game://spec/0.1.0/'+name+'.json',expected=readPublicResource(uri).contents[0].text;assert.equal(readFileSync(join(base,'resources',name+'.envelope.json'),'utf8'),expected);assert.equal(readFileSync(join(base,'resources',name+'.json'),'utf8'),JSON.parse(expected).content);}
  for(const path of Object.keys(manifest.files))assert.ok(!readFileSync(join(base,path),'utf8').includes('PRIVATE ANSWER'));
  assert.equal(x.isolation.runtimeIsolation,'NOT_RUN');assert.equal(x.isolation.independentAuthoring,'NOT_VERIFIED');
 }finally{rmSync(x.base,{recursive:true,force:true});}
});
test('controller task freezes original UTF-8 bytes and only accepts bounded text, never a task file path',()=>{
 const x=setup();try{
  const run=join(x.base,'task-run');mkdirSync(run);const prompt='设计一个新游戏。\nPreserve trailing whitespace.  \n',result=prepareHostWorkspace(run,x.repo,{taskId:'H01-new',prompt});
  assert.equal(result.task.promptSha256,hash(Buffer.from(prompt)));assert.equal(readFileSync(join(run,'public-context/TASK.md'),'utf8'),prompt);assert.equal(result.task.mode,'CONTROLLER_SUPPLIED_TASK');
  for(const task of [{taskId:'../G01',prompt:'task'},{taskId:'G01',prompt:''},{taskId:'G01',prompt:' '.repeat(10)},{taskId:'G01',prompt:'x'.repeat(65537)},{taskId:'G01',prompt:'bad\0text'},{taskId:'G01',prompt:'task',path:'/private'}])assert.throws(()=>prepareHostWorkspace(join(x.base,'invalid'),x.repo,task));
 }finally{rmSync(x.base,{recursive:true,force:true});}
});
test('v2 metadata stays structurally bound even when a caller supplies a newly computed manifest digest',()=>{
 for(const edit of [m=>{m.task.promptSha256='0'.repeat(64);},m=>{m.task.path='../TASK.md';},m=>{delete m.skill.files['SKILL.md'];},m=>{m.resources['a2game://spec/0.1.0/host-profile.json'].contentPath='../answer.json';},m=>{delete m.files['skill/SKILL.md'];},m=>{m.files['../answer.json']='0'.repeat(64);},m=>{m.files['skill/answer.md']='0'.repeat(64);}]){
  const x=setup();try{const changed=rewriteManifest(x,edit);assert.throws(()=>verifyPublicWorkspace(join(x.run,'public-context'),changed));}finally{rmSync(x.base,{recursive:true,force:true});}
 }
});
test('Skill/task/resource tampering, missing required files, resource envelope mismatch and cross-cell extra output fail closed',()=>{
 for(const path of ['TASK.md','skill/SKILL.md','resources/host-profile.json','resources/contract-fragments.envelope.json']){const x=setup();try{writeFileSync(join(x.run,'public-context',path),'changed');assert.throws(()=>verifyPublicWorkspace(join(x.run,'public-context'),x.isolation.manifestSha256));}finally{rmSync(x.base,{recursive:true,force:true});}}
 const x=setup();try{
  const base=join(x.run,'public-context'),path='resources/host-profile.envelope.json',env=JSON.parse(readFileSync(join(base,path)));env.uri='a2game://spec/0.1.0/contract-fragments.json';const bytes=JSON.stringify(env);writeFileSync(join(base,path),bytes);const changed=rewriteManifest(x,m=>{m.files[path]=hash(bytes);});assert.throws(()=>verifyPublicWorkspace(base,changed));
 }finally{rmSync(x.base,{recursive:true,force:true});}
 const y=setup();try{writeFileSync(join(y.run,'public-context/other-cell-game.json'),'{}');assert.throws(()=>verifyPublicWorkspace(join(y.run,'public-context'),y.isolation.manifestSha256));}finally{rmSync(y.base,{recursive:true,force:true});}
});
test('shared Skill source and public resource symlinks are rejected rather than followed',()=>{
 const x=setup();try{
  const source=join(x.repo,'integrations/skill/a2game/SKILL.md');rmSync(source);symlinkSync(join(x.repo,'specs/v0.1/games/g01.game.json'),source);const other=join(x.base,'other');mkdirSync(other);assert.throws(()=>prepareHostWorkspace(other,x.repo));
  const publicPath=join(x.run,'public-context/resources/host-profile.json');rmSync(publicPath);symlinkSync(join(x.repo,'specs/v0.1/games/g01.game.json'),publicPath);assert.throws(()=>verifyPublicWorkspace(join(x.run,'public-context'),x.isolation.manifestSha256));
 }finally{rmSync(x.base,{recursive:true,force:true});}
});
test('v1 minimal capsules remain readable but cannot acquire v2 files or imply isolation',()=>{
 const x=setup();try{
  const base=join(x.run,'public-context');for(const path of ['TASK.md','skill','resources'])rmSync(join(base,path),{recursive:true,force:true});
  const changed=rewriteManifest(x,m=>{m.version=1;delete m.task;delete m.skill;delete m.resources;for(const path of Object.keys(m.files))if(path==='TASK.md'||path.startsWith('skill/')||path.startsWith('resources/'))delete m.files[path];});
  const result=verifyPublicWorkspace(base,changed);assert.equal(result.status,'VERIFIED_PUBLIC_BYTES');assert.equal(result.task,undefined);assert.equal(result.capsuleVersion,undefined);
  writeFileSync(join(base,'TASK.md'),'unregistered task');assert.throws(()=>verifyPublicWorkspace(base,changed));
 }finally{rmSync(x.base,{recursive:true,force:true});}
});

test('v2 rejects missing mandatory bytes and unlisted empty directories as well as extra files',()=>{
 for(const edit of [base=>rmSync(join(base,'skill/references/workflow.md')),base=>mkdirSync(join(base,'answers')),base=>mkdirSync(join(base,'resources/other-cell'))]){const x=setup();try{edit(join(x.run,'public-context'));assert.throws(()=>verifyPublicWorkspace(join(x.run,'public-context'),x.isolation.manifestSha256));}finally{rmSync(x.base,{recursive:true,force:true});}}
});
