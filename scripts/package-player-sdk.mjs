/** Build a fresh static distribution after receiver-side full admission. */
import {readFileSync,writeFileSync,mkdirSync,cpSync,copyFileSync,constants,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createContentService} from './content-service.mjs';
import {copyEmbeddedPlayer} from './player-sdk-copy.mjs';
import {sha256Canonical} from '../dist/index.js';
const root=resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
if(args.length!==1)throw Error('Usage: node scripts/package-player-sdk.mjs <GameSpec or release-bundle or generator-package JSON>');
const text=readFileSync(resolve(args[0]),'utf8'),input=JSON.parse(text),service=createContentService();
let receipt;
if(input.format==='a2game-release-bundle')receipt=await service.importBundle(text);
else if(input.format==='a2game-generator-package')receipt=await service.importBundle(JSON.stringify(input.files?.content));
else if(input.format==='a2game')receipt=await service.release(text);
else throw Error('Unsupported input format');
const bundle=await service.exportBundle(receipt.sha256Jcs),digest=sha256Canonical(bundle);
const output=resolve(root,'output',`player-sdk-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
mkdirSync(resolve(root,'output'),{recursive:true});mkdirSync(output);mkdirSync(join(output,'player'));
const copy=(src,dst)=>cpSync(resolve(root,src),join(output,dst),{recursive:true,errorOnExist:true,force:false});
copy('dist','dist');copy('specs/v0.1/capabilities','specs/v0.1/capabilities');copy('player/adapters','player/adapters');copy('player/resources.mjs','player/resources.mjs');copy('player/browser-registry.mjs','player/browser-registry.mjs');copy('player/capability-index.json','player/capability-index.json');copy('packages/player-sdk/index.mjs','player/index-sdk.mjs');copyEmbeddedPlayer(resolve(root,'examples/embedded-player'),join(output,'player'));
mkdirSync(join(output,'player/vendor'),{recursive:true});const provenance=JSON.parse(readFileSync(resolve(root,'player/vendor/sdk-provenance.json'),'utf8'));
for(const file of ['pointer-host.mjs','mobile-host.mjs','gamepad-host.mjs','input-labels.mjs'])copy('player/'+file,'player/'+file);
for(const item of provenance.files){const source=resolve(root,item.path),sha=createHash('sha256').update(readFileSync(source)).digest('hex');if(sha!==item.sha256)throw Error('SDK provenance SHA differs: '+item.path);copyFileSync(source,join(output,'player/vendor',item.path.split('/').at(-1)),constants.COPYFILE_EXCL);}
copy('player/vendor/sdk-provenance.json','player/vendor/sdk-provenance.json');
mkdirSync(join(output,'player/assets'));for(const resource of bundle.resources){const {bytes}=service.readAsset(resource.sha256);writeFileSync(join(output,'player/assets',resource.sha256),bytes,{flag:'wx'});}
const physics=JSON.parse(readFileSync(resolve(root,'project/sdk-lock.json'),'utf8')).sharedPhysics;
if(createHash('sha256').update(readFileSync(resolve(root,physics.entry))).digest('hex')!==physics.sha256)throw Error('Shared physics SHA differs');
copy(physics.entry,'player/vendor/cannon-es.js');
mkdirSync(join(output,'licenses'));copy('LICENSE','licenses/a2game-LICENSE');copy('node_modules/three/LICENSE','licenses/three-LICENSE');copy('node_modules/cannon-es/LICENSE','licenses/cannon-es-LICENSE');
const airRoot=resolve(root,process.env.A2GAME_AIR_ROOT??'.tools/cocosairjs');copyFileSync(join(airRoot,'LICENSE'),join(output,'licenses/cocosairjs-LICENSE'),constants.COPYFILE_EXCL);cpSync(join(airRoot,'licenses'),join(output,'licenses/cocosairjs-third-party'),{recursive:true,errorOnExist:true,force:false});
copy('packages/player-sdk/README.md','README.md');copy('project/sdk-lock.json','sdk-lock.json');
writeFileSync(join(output,'player/game.release.json'),JSON.stringify(bundle,null,2)+'\n',{flag:'wx'});
writeFileSync(join(output,'player/trusted-bundle.mjs'),`export const trustedBundleDigest = ${JSON.stringify(digest)};\n`,{flag:'wx'});
const inventory=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const path=join(dir,entry.name);return entry.isDirectory()?inventory(path):[{file:path.slice(output.length+1).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}];});
writeFileSync(join(output,'build-inventory.json'),JSON.stringify({receipt,files:inventory(output)},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',output,game:receipt.id,bundleDigest:digest,resources:bundle.resources.length},null,2));
