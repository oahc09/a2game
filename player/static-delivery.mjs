import {capabilityManifestDigest,verifyReleasedGame} from '../dist/content-release.js';
import {sha256Canonical} from '../dist/exact-hash.js';

export const staticDelivery=document.documentElement.hasAttribute('data-static-delivery');
const integrityError=()=>Error('A2G_E_RELEASE_INTEGRITY: 独立包内容与交付清单不一致。');
const locks=()=>import('./static-delivery-lock.mjs');
async function readLocked(path,expected){
 if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))throw integrityError();
 const response=await fetch(new URL(path,import.meta.url));
 if(!response.ok)throw integrityError();
 const json=await response.json();
 if(sha256Canonical(json)!==expected)throw integrityError();
 return json;
}
export async function loadStaticCollection(){
 const {collectionDigest}=await locks();
 return readLocked('./collection.static.json',collectionDigest);
}
export async function loadStaticRelease(digest,registry){
 if(!/^[a-f0-9]{64}$/.test(digest))throw integrityError();
 const {releaseDigests}=await locks();
 const envelope=await readLocked(`./releases/${digest}.json`,releaseDigests[digest]);
 const definition=verifyReleasedGame(envelope,digest,capabilityManifestDigest(registry.list()));
 const resources=envelope.resources.map(item=>({...item,href:new URL('./assets/'+item.sha256,import.meta.url).href}));
 return {definition,resources};
}
