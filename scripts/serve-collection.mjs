/** Trusted local collection entry. Each game still passes complete content admission. */
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';

export async function serveCollection(file,{port=0}={}){
  const filename=await realpath(resolve(file)),base=dirname(filename);
  const text=await readFile(filename,'utf8');
  if(Buffer.byteLength(text)>65536)throw Error('Collection exceeds 64 KiB');
  const collection=JSON.parse(text);
  if(collection.format!=='a2game-game-collection'||collection.version!==1||!/^[a-z0-9-]{1,64}$/.test(collection.id)||!Array.isArray(collection.levels)||collection.levels.length<1||collection.levels.length>32)throw Error('Invalid collection');
  const contentService=createContentService(),levels=[];
  for(const level of collection.levels){
    if(typeof level.game!=='string'||isAbsolute(level.game))throw Error('Game path must be relative');
    const path=await realpath(resolve(base,level.game)),rel=relative(base,path);
    if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel))throw Error('Game path escapes collection');
    const receipt=await contentService.release(await readFile(path,'utf8'));
    levels.push({id:level.id,title:level.title,hint:level.hint,par:level.par,release:receipt.sha256Jcs});
  }
  const view={id:collection.id,title:collection.title,subtitle:collection.subtitle,levels};
  const server=createPlayerServer({contentService,collections:new Map([[collection.id,view]])});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  return {server,url:`http://127.0.0.1:${server.address().port}/player/collection.html?collection=${collection.id}`};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const result=await serveCollection(process.argv[2]??'games/phase2/sokoban/collection.json',{port:Number(process.env.A2GAME_PORT??8765)});
  console.log(result.url);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>result.server.close());
}
