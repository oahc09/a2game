/** Local, single-writer content versions. Admission remains the Generator's responsibility. */
import {readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync,renameSync,unlinkSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {resolve,dirname,parse,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {exportGamePackage,importGamePackage} from '../../generator/package.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw Error('A2G_DELIVERY: '+message);};
function safePath(input){
 if(typeof input!=='string'||!input||input.includes('\0')||input.split(/[\\/]/).includes('..'))fail('invalid path');
 const path=resolve(input);if(path===parse(path).root)fail('filesystem root is not permitted');
 for(let at=path;;at=dirname(at)){try{if(lstatSync(at).isSymbolicLink())fail('symbolic links are not permitted');}catch(error){if(error.code!=='ENOENT')throw error;}if(at===dirname(at))break;}
 return path;
}
function checkedFile(path,max=1024*1024){safePath(path);const info=lstatSync(path);if(!info.isFile()||info.size>max)fail('invalid file');return readFileSync(path);}
function checkedDir(path){safePath(path);if(!lstatSync(path).isDirectory())fail('directory required');return path;}
function ensureDir(path){safePath(path);try{mkdirSync(path);}catch(error){if(error.code!=='EEXIST')throw error;}return checkedDir(path);}
function lock(root){const path=safePath(join(root,'.content-delivery.lock')),fd=openSync(path,'wx');return ()=>{closeSync(fd);unlinkSync(path);};}
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
const label=version=>{if(typeof version!=='string'||!/^v[1-9][0-9]{0,8}$/.test(version))fail('version must be v followed by a positive revision');return version;};
function current(root){try{return JSON.parse(checkedFile(join(root,'latest.json'),8192));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function verify(root,version){
 const dir=checkedDir(join(root,'versions',label(version))),meta=JSON.parse(checkedFile(join(dir,'version.json'),8192)),bytes=checkedFile(join(dir,'package.json'),768*1024),pack=JSON.parse(bytes);
 if(meta.format!=='a2game-local-version'||meta.version!==version||meta.packageSha256!==sha(bytes)||pack.format!=='a2game-generator-package'||pack.files?.content?.definition?.id!==meta.gameId||pack.files.content.definition.revision!==meta.revision||version!==`v${meta.revision}`)fail('version integrity mismatch');
 return {meta,bytes};
}
function setLatest(root,meta){
 const path=safePath(join(root,'latest.json')),tmp=safePath(join(root,`.latest-${randomUUID()}.tmp`));
 const bytes=json({format:'a2game-local-latest',version:meta.version,gameId:meta.gameId,packageSha256:meta.packageSha256});
 let fd;try{fd=openSync(tmp,'wx');writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;safePath(path);renameSync(tmp,path);}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(tmp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
function verifyLatest(root){const pointer=current(root);if(!pointer)return null;const {meta}=verify(root,pointer.version);if(pointer.format!=='a2game-local-latest'||pointer.gameId!==meta.gameId||pointer.packageSha256!==meta.packageSha256)fail('latest integrity mismatch');return pointer;}
export async function publishVersion({root:directory,source,description}){
 const root=checkedDir(directory),input=checkedDir(source);
 if(typeof description!=='string'||!description.trim()||description.length>500)fail('change description required (1–500 characters)');
 const unlock=lock(root);try{
  const previous=verifyLatest(root),versions=ensureDir(join(root,'versions')),stage=join(versions,`.staging-${randomUUID()}`);safePath(stage);mkdirSync(stage);const authors=join(stage,'author');mkdirSync(authors);
  const sourceHashes={};for(const name of ['game.json','conformance.json','solution.json','game-plan.json']){
   const file=join(input,name);let bytes;try{bytes=checkedFile(file,name==='game-plan.json'?64*1024:768*1024);}catch(error){if(name==='game-plan.json'&&error.code==='ENOENT')continue;throw error;}
   sourceHashes[name]=sha(bytes);writeFileSync(join(authors,name),bytes,{flag:'wx'});
  }
  const candidate=JSON.parse(checkedFile(join(authors,'game.json'),256*1024));
  if(!candidate||typeof candidate.id!=='string'||!Number.isSafeInteger(candidate.revision)||candidate.revision<1)fail('invalid game identity');
  const version=label(`v${candidate.revision}`);if(previous&&previous.gameId!==candidate.id)fail('delivery directory belongs to another game');
  for(const name of readdirSync(versions).filter(name=>/^v[1-9][0-9]{0,8}$/.test(name))){const existing=verify(root,name);if(existing.meta.gameId!==candidate.id)fail('delivery directory belongs to another game');}
  const final=safePath(join(versions,version));try{lstatSync(final);fail('version already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  const pack=await exportGamePackage(authors),game=pack.files?.content?.definition;
  if(game?.id!==candidate.id||game?.revision!==candidate.revision)fail('admitted identity changed');
  const bytes=json(pack),meta={format:'a2game-local-version',version,gameId:game.id,revision:game.revision,description:description.trim(),packageSha256:sha(bytes),sourceHashes};
  writeFileSync(join(stage,'package.json'),bytes,{flag:'wx'});writeFileSync(join(stage,'version.json'),json(meta),{flag:'wx'});if(sha(checkedFile(join(stage,'package.json'),768*1024))!==meta.packageSha256)fail('package write mismatch');
  safePath(final);renameSync(stage,final);verify(root,version);setLatest(root,meta);return {status:'PASS',...meta};
 }finally{unlock();}
}
export function selectVersion({root:directory,version}){const root=checkedDir(directory),unlock=lock(root);try{verifyLatest(root);const {meta}=verify(root,label(version));setLatest(root,meta);return {status:'PASS',version:meta.version,gameId:meta.gameId,packageSha256:meta.packageSha256};}finally{unlock();}}
export function inspectDelivery({root:directory}){const root=checkedDir(directory);return {latest:verifyLatest(root)};}
export async function importVersion({root:directory,version}){const root=checkedDir(directory),unlock=lock(root);try{verifyLatest(root);const {meta,bytes}=verify(root,label(version)),imports=ensureDir(join(root,'imports')),target=safePath(join(imports,`${meta.version}-${randomUUID()}`));const result=await importGamePackage(bytes.toString('utf8'),target);return {status:'PASS',version:meta.version,outputDirectory:target,receiver:result};}finally{unlock();}}
