/** Trusted local collection entry. Each game still passes complete content admission. */
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

export async function prepareCollection(file){
  const filename=await realpath(resolve(file)),base=dirname(filename);
  const text=await readFile(filename,'utf8');
  if(Buffer.byteLength(text)>65536)throw Error('Collection exceeds 64 KiB');
  const collection=JSON.parse(text);
  const idPattern=/^[a-z0-9-]{1,64}$/;
  if(collection?.format!=='a2game-game-collection'||![1,2].includes(collection.version)||typeof collection.id!=='string'||!idPattern.test(collection.id)||!Array.isArray(collection.levels)||collection.levels.length<1||collection.levels.length>32)throw Error('Invalid collection');
  const progressive=collection.version===2,seen=new Set(),sources=[];
  for(const level of collection.levels){
    if(progressive){
      if(!level||typeof level.id!=='string'||!idPattern.test(level.id)||seen.has(level.id)||typeof level.title!=='string'||typeof level.hint!=='string'||!Number.isSafeInteger(level.par)||level.par<1||typeof level.sha256!=='string'||!/^[a-f0-9]{64}$/.test(level.sha256))throw Error('Invalid version 2 collection level');
      if(level.baseScore!==undefined&&(!Number.isSafeInteger(level.baseScore)||level.baseScore<1||!Number.isSafeInteger(2*level.baseScore)))throw Error('Invalid collection base score: '+level.id);
      seen.add(level.id);
    }
    if(typeof level.game!=='string'||isAbsolute(level.game))throw Error('Game path must be relative');
    const path=await realpath(resolve(base,level.game)),rel=relative(base,path);
    if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel))throw Error('Game path escapes collection');
    const bytes=await readFile(path);
    if(progressive&&createHash('sha256').update(bytes).digest('hex')!==level.sha256)throw Error(`Collection level digest mismatch: ${level.id}`);
    sources.push({level,text:bytes.toString('utf8')});
  }
  const contentService=createContentService(),levels=[];
  for(const {level,text} of sources){
    const receipt=await contentService.release(text);
    levels.push({id:level.id,title:level.title,hint:level.hint,par:level.par,release:receipt.sha256Jcs,
      ...(progressive&&level.baseScore!==undefined?{baseScore:level.baseScore}:{})});
  }
  const view={id:collection.id,title:collection.title,subtitle:collection.subtitle,levels,...(progressive?{progressive:true}:{})};
  return {contentService,view};
}
export async function serveCollection(file,{port=0}={}){
  const {contentService,view}=await prepareCollection(file);
  const server=createPlayerServer({contentService,collections:new Map([[view.id,view]])});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  return {server,url:`http://127.0.0.1:${server.address().port}/player/collection.html?collection=${view.id}`};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const result=await serveCollection(process.argv[2]??'games/phase2/sokoban/collection.json',{port:Number(process.env.A2GAME_PORT??8765)});
  console.log(result.url);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>result.server.close());
}
