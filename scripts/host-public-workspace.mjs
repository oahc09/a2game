/** Public authoring capsule. Preparing a directory is NOT an OS isolation claim. */
import {mkdirSync,readdirSync,readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,relative,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {readPublicResource} from '../integrations/mcp/resources.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('Unsafe or incomplete public authoring capsule');};
const save=(p,b)=>writeFileSync(p,b,{flag:'wx'});
const skillFiles=['SKILL.md','references/workflow.md','references/troubleshooting.md'];
const resourceNames=['host-profile','contract-fragments'];
const uriFor=name=>'a2game://spec/0.1.0/'+name+'.json';
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
function regular(base,path){
 const rel=relative(base,path);if(rel.startsWith('..'+sep)||rel==='..'||rel.includes(sep+'..'+sep))fail();
 let p=base;if(lstatSync(p).isSymbolicLink())fail();
 for(const part of rel.split(sep)){p=join(p,part);if(lstatSync(p).isSymbolicLink())fail();}
 if(!lstatSync(p).isFile()||!realpathSync(p).startsWith(realpathSync(base)+sep))fail();return readFileSync(p);
}
function taskInput(workspace,task){
 if(task===undefined)return {taskId:'G01',prompt:regular(workspace,join(workspace,'docs/host-agent-pilot.md')),mode:'LEGACY_EXPLICIT_GUIDE'};
 if(!sameKeys(task,['taskId','prompt'])||typeof task.taskId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(task.taskId)||typeof task.prompt!=='string'||!task.prompt.trim()||Buffer.byteLength(task.prompt)>65536||/[\u0000]/.test(task.prompt))fail();
 return {taskId:task.taskId,prompt:Buffer.from(task.prompt,'utf8'),mode:'CONTROLLER_SUPPLIED_TASK'};
}
export function prepareHostWorkspace(directory,workspace,task){
 const input=taskInput(workspace,task),capsule=join(directory,'public-context'),files={};mkdirSync(capsule);
 const put=(path,bytes)=>{mkdirSync(dirname(join(capsule,path)),{recursive:true});save(join(capsule,path),bytes);files[path]=hash(bytes);};
 for(const [kind,suffix] of [['schemas','.json'],['capabilities','.capability.json']]){
  const source=join(workspace,'specs/v0.1',kind),names=readdirSync(source).filter(n=>n.endsWith(suffix)).sort();if(!names.length)fail();
  if(kind==='schemas')mkdirSync(join(directory,'schemas'),{recursive:true});
  for(const name of names){const bytes=regular(workspace,join(source,name));put(kind+'/'+name,bytes);if(kind==='schemas')save(join(directory,'schemas',name),bytes);}
 }
 for(const name of skillFiles)put('skill/'+name,regular(workspace,join(workspace,'integrations/skill/a2game',name)));
 const resources={};
 for(const name of resourceNames){
  const uri=uriFor(name),envelopeBytes=Buffer.from(readPublicResource(uri).contents[0].text,'utf8'),envelope=JSON.parse(envelopeBytes);
  const contentPath='resources/'+name+'.json',envelopePath='resources/'+name+'.envelope.json';
  put(contentPath,Buffer.from(envelope.content,'utf8'));put(envelopePath,envelopeBytes);
  resources[uri]={contentPath,envelopePath,sha256:envelope.sha256};
 }
 const guide=Buffer.from('Author a NEW GameSpec 0.1.0 using only this frozen public task, shared Skill, schemas, capability contracts and versioned resources. Write candidates to /candidate. No reference games, solutions, prior outputs, credentials, host configuration, or repository are included. This capsule alone does not prove OS isolation, host discovery, model identity, or independent generation. MCP validation must be performed by the trusted controller after authoring; no implicit Provider calls. Legacy explicit guidance is not evidence of automatic Skill discovery.\n');
 put('AUTHORING.md',guide);put('TASK.md',input.prompt);
 const taskBinding={taskId:input.taskId,path:'TASK.md',promptSha256:hash(input.prompt),mode:input.mode};
 const manifest={format:'a2game-public-authoring-capsule',version:2,specVersion:'0.1.0',files,task:taskBinding,skill:{source:'integrations/skill/a2game',files:Object.fromEntries(skillFiles.map(name=>[name,files['skill/'+name]]))},resources};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');save(join(capsule,'manifest.json'),bytes);
 save(join(directory,'TASK.md'),input.prompt);
 const manifestSha256=hash(bytes);verifyPublicWorkspace(capsule,manifestSha256);
 return {status:'PREPARED_NOT_ISOLATED',capsule:'public-context',capsuleVersion:2,manifestSha256,task:taskBinding,policy:'public-task-skill-schema-capability-resources-only',runtimeIsolation:'NOT_RUN',independentAuthoring:'NOT_VERIFIED'};
}
export function verifyPublicWorkspace(capsule,expectedDigest){
 const base=resolve(capsule),bytes=regular(base,join(base,'manifest.json'));
 if(!digest(expectedDigest)||hash(bytes)!==expectedDigest)fail();
 const manifest=JSON.parse(bytes);if(manifest.format!=='a2game-public-authoring-capsule'||![1,2].includes(manifest.version)||manifest.specVersion!=='0.1.0'||!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))fail();
 const seen=[];function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);const st=lstatSync(p);if(st.isSymbolicLink())fail();if(st.isDirectory()){const rel=relative(base,p).replaceAll('\\','/');if(!(manifest.version===2?['schemas','capabilities','skill','skill/references','resources']:['schemas','capabilities']).includes(rel))fail();walk(p);}else if(st.isFile())seen.push(relative(base,p).replaceAll('\\','/'));else fail();}}walk(base);
 const expected=[...Object.keys(manifest.files),'manifest.json'].sort();if(JSON.stringify(seen.sort())!==JSON.stringify(expected))fail();
 const fixed=manifest.version===2?['TASK.md',...skillFiles.map(n=>'skill/'+n),...resourceNames.flatMap(n=>['resources/'+n+'.json','resources/'+n+'.envelope.json'])]:[];
 for(const [path,sha]of Object.entries(manifest.files)){
  if(!(/^(?:AUTHORING\.md|schemas\/[A-Za-z0-9._-]+\.json|capabilities\/[A-Za-z0-9._-]+\.capability\.json)$/.test(path)||fixed.includes(path))||!digest(sha)||hash(regular(base,join(base,path)))!==sha)fail();
 }
 if(manifest.version===2){
  if(!sameKeys(manifest,['format','version','specVersion','files','task','skill','resources'])||!['AUTHORING.md',...fixed].every(p=>Object.hasOwn(manifest.files,p))||!Object.keys(manifest.files).some(p=>p.startsWith('schemas/'))||!Object.keys(manifest.files).some(p=>p.startsWith('capabilities/')))fail();
  const task=manifest.task;
  if(!sameKeys(task,['taskId','path','promptSha256','mode'])||typeof task.taskId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(task.taskId)||task.path!=='TASK.md'||task.promptSha256!==manifest.files['TASK.md']||!['LEGACY_EXPLICIT_GUIDE','CONTROLLER_SUPPLIED_TASK'].includes(task.mode))fail();
  const prompt=regular(base,join(base,'TASK.md'));
  if(!prompt.length||!prompt.toString('utf8').trim()||prompt.includes(0)||task.mode==='CONTROLLER_SUPPLIED_TASK'&&prompt.length>65536)fail();
  if(!sameKeys(manifest.skill,['source','files'])||manifest.skill.source!=='integrations/skill/a2game'||!sameKeys(manifest.skill.files,skillFiles)||skillFiles.some(n=>manifest.skill.files[n]!==manifest.files['skill/'+n]))fail();
  if(!sameKeys(manifest.resources,resourceNames.map(uriFor)))fail();
  for(const name of resourceNames){
   const uri=uriFor(name),mapping=manifest.resources[uri],contentPath='resources/'+name+'.json',envelopePath='resources/'+name+'.envelope.json';
   if(!sameKeys(mapping,['contentPath','envelopePath','sha256'])||mapping.contentPath!==contentPath||mapping.envelopePath!==envelopePath||mapping.sha256!==manifest.files[contentPath])fail();
   const content=regular(base,join(base,contentPath)),envelope=JSON.parse(regular(base,join(base,envelopePath)));
   if(!sameKeys(envelope,['format','version','specVersion','uri','contentType','sha256','bytes','content'])||envelope.format!=='a2game-public-resource'||envelope.version!==1||envelope.specVersion!=='0.1.0'||envelope.uri!==uri||envelope.contentType!=='application/json'||typeof envelope.content!=='string'||!Buffer.from(envelope.content,'utf8').equals(content)||envelope.bytes!==content.length||content.length>256*1024||envelope.sha256!==mapping.sha256)fail();
  }
 }
 return {status:'VERIFIED_PUBLIC_BYTES',manifestSha256:expectedDigest,files:Object.keys(manifest.files).length,...(manifest.version===2?{capsuleVersion:2,task:manifest.task}:{})};
}
