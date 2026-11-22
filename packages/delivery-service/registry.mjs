/** Receiver re-admission and immutable, approved Runtime bytes; never execute package code on the server. */
import{readFileSync,realpathSync,lstatSync}from'node:fs';import{resolve,join,dirname,sep,extname}from'node:path';import{createHash}from'node:crypto';
import{sha256Canonical}from'../../dist/index.js';import{createContentService}from'../../scripts/content-service.mjs';
export const workspace=resolve(import.meta.dirname,'../..');
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const deliveryError=(code,statusCode=400)=>Object.assign(Error(code),{code,statusCode});
export const contentType=file=>({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.wav':'audio/wav','.md':'text/plain; charset=utf-8'})[extname(file)]??'application/octet-stream';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const bounded=(file,max)=>{const info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.size>max)throw deliveryError('A2G_DELIVERY_SIZE');return readFileSync(file);};
const safe=file=>typeof file==='string'&&file.length<512&&/^[A-Za-z0-9_./-]+$/.test(file)&&file.split('/').every(p=>p&&!p.startsWith('.')&&!p.includes('..'));
function approvedSource(file){
 if(file==='player/index-sdk.mjs')return join(workspace,'packages/player-sdk/index.mjs');
 if(file==='player/README.md')return join(workspace,'examples/embedded-player/README.md');
 if(['player/index.html','player/example.mjs'].includes(file))return join(workspace,'examples/embedded-player',file.split('/').at(-1));
 if(file.startsWith('dist/')||file.startsWith('specs/v0.1/capabilities/'))return join(workspace,file);
 if(file==='player/vendor/cannon-es.js')return resolve(workspace,read(join(workspace,'project/sdk-lock.json')).sharedPhysics.entry);
 if(file.startsWith('player/vendor/')){const source=join(workspace,file);if(file.endsWith('/sdk-provenance.json'))return source;return read(join(workspace,'player/vendor/sdk-provenance.json')).files.some(e=>e.path===file)?source:null;}
 if(file.startsWith('player/')&&!file.startsWith('player/assets/')&&!['player/game.release.json','player/trusted-bundle.mjs'].includes(file))return join(workspace,file);
 return null;
}
export function createReleaseRegistry({maxVersions=16,maxBytes=128*1024*1024}={}){
 if(!Number.isInteger(maxVersions)||maxVersions<1||maxVersions>16||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw deliveryError('A2G_DELIVERY_CONFIG');
 const versions=new Map(),chunks=new Map(),selected=new Map();let bytes=0;
 return{
  async add(input,{expectedId,skip,keepSelection=false}={}){
   if(lstatSync(resolve(input)).isSymbolicLink())throw deliveryError('A2G_DELIVERY_SYMLINK');const directory=realpathSync(resolve(input));if(!directory.startsWith(join(workspace,'output')+sep))throw deliveryError('A2G_DELIVERY_DIRECTORY');
   const inventoryBytes=bounded(join(directory,'build-inventory.json'),1024*1024),inventory=JSON.parse(inventoryBytes),bundleBytes=bounded(join(directory,'player/game.release.json'),1024*1024),bundle=JSON.parse(bundleBytes);
   if(!Array.isArray(inventory.files)||!inventory.files.length||inventory.files.length>600)throw deliveryError('A2G_DELIVERY_INVENTORY');
   if(bounded(join(directory,'player/trusted-bundle.mjs'),512).toString('utf8')!==`export const trustedBundleDigest = ${JSON.stringify(sha256Canonical(bundle))};\n`)throw deliveryError('A2G_DELIVERY_TRUST_ANCHOR');
   await createContentService().importBundle(bundleBytes.toString('utf8'));
   const files=[],pending=new Map(),names=new Set(),assetTypes=new Map(read(join(workspace,'project/asset-policy.json')).entries.map(e=>[e.uri,e.mime]));let added=0;
   for(const item of[...inventory.files,{file:'build-inventory.json',sha256:digest(inventoryBytes)}]){
    const file=item.file;if(!safe(file)||names.has(file.toLowerCase())||!(/^(dist\/|player\/|specs\/v0\.1\/capabilities\/|licenses\/)/.test(file)||['README.md','sdk-lock.json','build-inventory.json','delivery-source.json'].includes(file)))throw deliveryError('A2G_DELIVERY_FILE');names.add(file.toLowerCase());
    const path=resolve(directory,file);if(!path.startsWith(directory+sep))throw deliveryError('A2G_DELIVERY_FILE');for(let at=path;at!==directory;at=dirname(at))if(lstatSync(at).isSymbolicLink())throw deliveryError('A2G_DELIVERY_SYMLINK');const info=lstatSync(path);if(!info.isFile()||info.size>16*1024*1024)throw deliveryError('A2G_DELIVERY_SIZE');
    const data=readFileSync(path),sha256=digest(data);if(sha256!==item.sha256)throw deliveryError('A2G_DELIVERY_INTEGRITY');const source=approvedSource(file);if(source&&digest(readFileSync(source))!==sha256)throw deliveryError('A2G_DELIVERY_SOURCE_STALE');if(/\.(?:js|mjs|html|css)$/.test(file)&&file!=='player/trusted-bundle.mjs'&&!source)throw deliveryError('A2G_DELIVERY_EXECUTABLE');
    if(!chunks.has(sha256)&&!pending.has(sha256)){pending.set(sha256,data);added+=data.length;}if(bytes+added>maxBytes)throw deliveryError('A2G_DELIVERY_SIZE');
    const asset=bundle.resources.find(r=>file==='player/assets/'+r.sha256);files.push({file,sha256,bytes:data.length,mime:asset?(assetTypes.get(asset.uri)??contentType(asset.uri)):contentType(file)});
   }
   for(const required of['player/index.html','player/example.mjs','player/index-sdk.mjs','player/game.release.json','player/trusted-bundle.mjs','dist/index.js'])if(!names.has(required))throw deliveryError('A2G_DELIVERY_INCOMPLETE');
   const def=bundle.definition,id=digest(Buffer.from(JSON.stringify(files))),entry=Object.freeze({id,gameId:def.id,revision:def.revision,title:def.meta.title,base:'/delivery/releases/'+id+'/',files:Object.freeze(files.map(Object.freeze))});
   if(expectedId!==undefined&&id!==expectedId)throw deliveryError('A2G_DELIVERY_STATE');
   if(skip?.(id))return null;
   if(versions.has(id))return versions.get(id);if(versions.size>=maxVersions)throw deliveryError('A2G_DELIVERY_CAPACITY',409);
   if(Buffer.byteLength(JSON.stringify({format:'a2game-delivery-channel',version:1,versions:[...versions.values(),entry],selected:{...Object.fromEntries(selected),[entry.gameId]:id}}))>1024*1024)throw deliveryError('A2G_DELIVERY_CHANNEL_SIZE');
   for(const[key,data]of pending)chunks.set(key,data);bytes+=added;versions.set(id,entry);if(!keepSelection||!selected.has(entry.gameId))selected.set(entry.gameId,id);return entry;
  },
  channel:()=>({format:'a2game-delivery-channel',version:1,versions:[...versions.values()],selected:Object.fromEntries(selected)}),
  get:id=>versions.get(id),
  remove(id){const row=versions.get(id);if(!row)return;versions.delete(id);if(selected.get(row.gameId)===id){const previous=[...versions.values()].filter(v=>v.gameId===row.gameId).at(-1);if(previous)selected.set(row.gameId,previous.id);else selected.delete(row.gameId);}const live=new Set([...versions.values()].flatMap(v=>v.files.map(f=>f.sha256)));for(const[key,data]of chunks)if(!live.has(key)){bytes-=data.length;chunks.delete(key);}},
  select(id){const row=versions.get(id);if(!row)throw deliveryError('A2G_DELIVERY_NOT_FOUND',404);selected.set(row.gameId,id);return row;},
  file(id,path){const record=versions.get(id)?.files.find(f=>f.file===path);if(!record)throw deliveryError('A2G_DELIVERY_NOT_FOUND',404);return{record,data:chunks.get(record.sha256)};},
  diagnostics:()=>({versions:versions.size,uniqueBytes:bytes,chunks:chunks.size}),
  dispose(){versions.clear();chunks.clear();selected.clear();bytes=0;}
 };
}
