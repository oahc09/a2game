/** Install the reviewed Skill into project-only host discovery paths; never edit host settings. */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const destinations={qoder:'.agents/skills/a2game',zcode:'.agents/skills/a2game',trae:'.trae/skills/a2game',workbuddy:'.codebuddy/skills/a2game'};
const host=process.argv[2],check=process.argv.includes('--check');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 if(!Object.hasOwn(destinations,host)&&host!=='all')throw Error('Usage: node scripts/install-host-skill.mjs <qoder|trae|workbuddy|zcode|all> [--check]');
 const source=resolve(root,'integrations/skill/a2game');
 const workbuddy=resolve(root,destinations.workbuddy);
 const files=dir=>readdirSync(dir).sort().flatMap(name=>{
  const path=join(dir,name),stat=lstatSync(path);
  if(stat.isSymbolicLink())throw Error('Skill symlinks are not supported');
  if(stat.isDirectory())return files(path);
  if(!name.endsWith('.md')||stat.size>65536)throw Error('Unexpected Skill file');
  return [path];
 });
 const sources=files(source),targets=[...new Set((host==='all'?Object.values(destinations):[destinations[host]]))];
 const pending=[];
 for(const target of targets)for(const file of sources){
  const dest=resolve(root,target,relative(source,file));
  for(let p=dest;p!==root;p=dirname(p))if(lstatSync(p,{throwIfNoEntry:false})?.isSymbolicLink()){
   // Only the WorkBuddy discovery root may link to the reviewed source directory.
   if(p===workbuddy&&realpathSync(p)===realpathSync(source))continue;
   throw Error('Refusing symlink target: '+relative(root,p));
  }
  if(existsSync(dest)){
   if(!lstatSync(dest).isFile()||digest(readFileSync(dest))!==digest(readFileSync(file)))throw Error('Existing Skill differs; review before replacing: '+relative(root,dest));
  }else if(check)throw Error('Missing project Skill: '+relative(root,dest));
  else pending.push([file,dest]);
 }
 for(const [file,dest]of pending){mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,readFileSync(file),{flag:'wx'});}
 console.log(JSON.stringify({status:'PASS_LOCAL',scope:'Project Skill layout only; host discovery still needs a new session.',targets,created:pending.length,files:Object.fromEntries(sources.map(p=>[relative(source,p).replaceAll('\\','/'),digest(readFileSync(p))]))}));
}catch(error){console.error(error.message);process.exitCode=1;}
