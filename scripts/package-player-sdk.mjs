/** Build a fresh static distribution after receiver-side full admission. */
import {readFileSync,writeFileSync,mkdirSync,cpSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createContentService} from './content-service.mjs';
import {prepareCollection} from './serve-collection.mjs';
import {sha256Canonical} from '../dist/index.js';
const root=resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
if(args.length!==1)throw Error('Usage: node scripts/package-player-sdk.mjs <GameSpec, collection, release-bundle or generator-package JSON>');
const text=readFileSync(resolve(args[0]),'utf8'),input=JSON.parse(text);
const collection=input.format==='a2game-game-collection'?await prepareCollection(args[0]):null;
if(collection&&!collection.view.progressive)throw Error('Static collections require version 2');
const service=collection?.contentService??createContentService();
let receipt,bundle,digest;
if(collection){
  digest=sha256Canonical(collection.view);
}else if(input.format==='a2game-release-bundle')receipt=await service.importBundle(text);
else if(input.format==='a2game-generator-package')receipt=await service.importBundle(JSON.stringify(input.files?.content));
else if(input.format==='a2game')receipt=await service.release(text);
else throw Error('Unsupported input format');
if(receipt){bundle=await service.exportBundle(receipt.sha256Jcs);digest=sha256Canonical(bundle);}
const output=resolve(root,'output',`player-sdk-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
if(existsSync(output))throw Error('Output already exists');mkdirSync(join(output,'player'),{recursive:true});
const copy=(src,dst)=>cpSync(resolve(root,src),join(output,dst),{recursive:true,errorOnExist:true,force:false});
copy('dist','dist');copy('specs/v0.1/capabilities','specs/v0.1/capabilities');copy('player/adapters','player/adapters');copy('player/resources.mjs','player/resources.mjs');copy('player/browser-registry.mjs','player/browser-registry.mjs');copy('player/capability-index.json','player/capability-index.json');
if(collection){
  for(const file of ['main.mjs','collection.mjs','static-delivery.mjs','tray-save.mjs','text-readability.mjs','frame-motion.mjs','content-loader.mjs'])copy('player/'+file,'player/'+file);
  for(const file of ['index.html','collection.html']){
    const page=readFileSync(resolve(root,'player',file),'utf8')
      .replace('<html lang="zh-CN">','<html lang="zh-CN" data-static-delivery>')
      .replaceAll('"/player/vendor/','"./vendor/')
      .replace('"/player/physics/cannon-es.js"','"./vendor/cannon-es.js"');
    if(!page.includes('data-static-delivery'))throw Error('Static delivery page bootstrap is missing');
    writeFileSync(join(output,'player',file),page,{flag:'wx'});
  }
}else{
  copy('packages/player-sdk/index.mjs','player/index-sdk.mjs');copy('examples/embedded-player','player');
}
mkdirSync(join(output,'player/vendor'),{recursive:true});const provenance=JSON.parse(readFileSync(resolve(root,'player/vendor/sdk-provenance.json'),'utf8'));
for(const file of ['pointer-host.mjs','mobile-host.mjs','gamepad-host.mjs','input-labels.mjs','engines.mjs','hud-text.mjs','score-record.mjs','feedback-audio.mjs','event-feedback.mjs'])copy('player/'+file,'player/'+file);
for(const item of provenance.files){const source=resolve(root,item.path),sha=createHash('sha256').update(readFileSync(source)).digest('hex');if(sha!==item.sha256)throw Error('SDK provenance SHA differs: '+item.path);copyFileSync(source,join(output,'player/vendor',item.path.split('/').at(-1)));}
copy('player/vendor/sdk-provenance.json','player/vendor/sdk-provenance.json');
mkdirSync(join(output,'player/assets'));
const assetHashes=new Set();
function writeAssets(resources){
  for(const resource of resources){
    if(assetHashes.has(resource.sha256))continue;
    const {bytes}=service.readAsset(resource.sha256);
    writeFileSync(join(output,'player/assets',resource.sha256),bytes,{flag:'wx'});
    assetHashes.add(resource.sha256);
  }
}
const physics=JSON.parse(readFileSync(resolve(root,'project/sdk-lock.json'),'utf8')).sharedPhysics;
if(createHash('sha256').update(readFileSync(resolve(root,physics.entry))).digest('hex')!==physics.sha256)throw Error('Shared physics SHA differs');
copy(physics.entry,'player/vendor/cannon-es.js');
mkdirSync(join(output,'licenses'));copy('node_modules/three/LICENSE','licenses/three-LICENSE');copy('node_modules/cannon-es/LICENSE','licenses/cannon-es-LICENSE');
const airRoot=resolve(root,process.env.A2GAME_AIR_ROOT??'.tools/cocosairjs');copyFileSync(join(airRoot,'LICENSE'),join(output,'licenses/cocosairjs-LICENSE'));cpSync(join(airRoot,'licenses'),join(output,'licenses/cocosairjs-third-party'),{recursive:true});
copy('packages/player-sdk/README.md','README.md');copy('project/sdk-lock.json','sdk-lock.json');
let collectionReceipts;
const writeJson=(path,value)=>writeFileSync(join(output,'player',path),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
if(collection){
  const releaseDigests={};
  collectionReceipts=[];
  mkdirSync(join(output,'player/releases'));
  for(const level of collection.view.levels){
    if(Object.hasOwn(releaseDigests,level.release))continue;
    const envelope=await service.read(level.release);
    writeAssets(envelope.resources);
    writeJson(`releases/${level.release}.json`,envelope);
    releaseDigests[level.release]=sha256Canonical(envelope);
    collectionReceipts.push(envelope.receipt);
  }
  writeJson('collection.static.json',collection.view);
  writeFileSync(join(output,'player/static-delivery-lock.mjs'),
    `export const collectionDigest = ${JSON.stringify(digest)};\nexport const releaseDigests = ${JSON.stringify(releaseDigests)};\n`,{flag:'wx'});
}else{
  writeAssets(bundle.resources);
  writeJson('game.release.json',bundle);
  writeFileSync(join(output,'player/trusted-bundle.mjs'),`export const trustedBundleDigest = ${JSON.stringify(digest)};\n`,{flag:'wx'});
}
const inventory=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const path=join(dir,entry.name);return entry.isDirectory()?inventory(path):[{file:path.slice(output.length+1).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}];});
writeFileSync(join(output,'build-inventory.json'),JSON.stringify({...(collection?{collection:collection.view.id,collectionDigest:digest,receipts:collectionReceipts}:{receipt}),files:inventory(output)},null,2)+'\n',{flag:'wx'});
const summary=collection?{collection:collection.view.id,levels:collection.view.levels.length,collectionDigest:digest,entry:'/player/collection.html'}:{game:receipt.id,bundleDigest:digest,entry:'/player/index.html'};
console.log(JSON.stringify({status:'PASS',output,...summary,resources:assetHashes.size},null,2));
