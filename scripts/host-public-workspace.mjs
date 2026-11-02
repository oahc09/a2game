/** Public authoring capsule. Preparing a directory is NOT an OS isolation claim. */
import {mkdirSync,readdirSync,readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('Unsafe or incomplete public authoring capsule');};
const save=(p,b)=>writeFileSync(p,b,{flag:'wx'});
function regular(base,path){
 const rel=relative(base,path);if(rel.startsWith('..'+sep)||rel==='..'||rel.includes(sep+'..'+sep))fail();
 let p=base;if(lstatSync(p).isSymbolicLink())fail();
 for(const part of rel.split(sep)){p=join(p,part);if(lstatSync(p).isSymbolicLink())fail();}
 if(!lstatSync(p).isFile()||!realpathSync(p).startsWith(realpathSync(base)+sep))fail();return readFileSync(p);
}
export function prepareHostWorkspace(directory,workspace){
 const capsule=join(directory,'public-context'),files={};mkdirSync(capsule);
 for(const [kind,suffix] of [['schemas','.json'],['capabilities','.capability.json']]){
  const source=join(workspace,'specs/v0.1',kind),names=readdirSync(source).filter(n=>n.endsWith(suffix)).sort();if(!names.length)fail();
  mkdirSync(join(capsule,kind));if(kind==='schemas')mkdirSync(join(directory,'schemas'),{recursive:true});
  for(const name of names){const bytes=regular(workspace,join(source,name));const path=kind+'/'+name;save(join(capsule,path),bytes);files[path]=hash(bytes);if(kind==='schemas')save(join(directory,'schemas',name),bytes);}
 }
 const guide=Buffer.from('Author a NEW GameSpec 0.1.0 using only these public schemas and capability contracts. Write candidates to /candidate. No reference games, solutions, prior outputs, credentials, host configuration, or repository are mounted. This capsule alone does not prove host discovery, model identity, or independent generation. MCP validation must be performed by the trusted controller after authoring; no implicit Provider calls.\n');
 save(join(capsule,'AUTHORING.md'),guide);files['AUTHORING.md']=hash(guide);
 const manifest={format:'a2game-public-authoring-capsule',version:1,specVersion:'0.1.0',files};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');save(join(capsule,'manifest.json'),bytes);
 save(join(directory,'TASK.md'),regular(workspace,join(workspace,'docs/host-agent-pilot.md')));
 return {status:'PREPARED_NOT_ISOLATED',capsule:'public-context',manifestSha256:hash(bytes),policy:'schema-capability-only',runtimeIsolation:'NOT_RUN',independentAuthoring:'NOT_VERIFIED'};
}
export function verifyPublicWorkspace(capsule,expectedDigest){
 const base=resolve(capsule),bytes=regular(base,join(base,'manifest.json'));
 if(!/^[a-f0-9]{64}$/.test(expectedDigest??'')||hash(bytes)!==expectedDigest)fail();
 const manifest=JSON.parse(bytes);if(manifest.format!=='a2game-public-authoring-capsule'||manifest.version!==1||!manifest.files)fail();
 const seen=[];function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);const st=lstatSync(p);if(st.isSymbolicLink())fail();if(st.isDirectory())walk(p);else if(st.isFile())seen.push(relative(base,p).replaceAll('\\','/'));else fail();}}walk(base);
 const expected=[...Object.keys(manifest.files),'manifest.json'].sort();if(JSON.stringify(seen.sort())!==JSON.stringify(expected))fail();
 for(const [path,digest]of Object.entries(manifest.files)){
  if(!/^(?:AUTHORING\.md|schemas\/[A-Za-z0-9._-]+\.json|capabilities\/[A-Za-z0-9._-]+\.capability\.json)$/.test(path)||hash(regular(base,join(base,path)))!==digest)fail();
 }
 return {status:'VERIFIED_PUBLIC_BYTES',manifestSha256:expectedDigest,files:Object.keys(manifest.files).length};
}
