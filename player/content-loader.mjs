import {sha256Canonical,verifyReleasedGame,capabilityManifestDigest,CONTENT_BUNDLE_MAX_BYTES} from '../dist/index.js';

async function api(response){
  const result=await response.json();
  if(!response.ok){
    const error=new Error(result.error?.message??'本地内容服务请求失败。');
    Object.assign(error,result.error);throw error;
  }
  return result;
}
let builtinCatalog;
export async function loadBuiltinCatalog(){
 if(builtinCatalog)return builtinCatalog;
  const catalog=await api(await fetch('./validated-games.json'));
 if(catalog.format!=='a2game-validated-game-catalog'||catalog.formatVersion!==1||!catalog.content||typeof catalog.content!=='object')throw Error('A2G_E_RELEASE_INTEGRITY: 游戏目录格式无效。');
 const entries=Object.entries(catalog.content);if(entries.length<1||entries.length>256)throw Error('A2G_E_RELEASE_INTEGRITY: 游戏目录超过预算。');
 builtinCatalog=entries.map(([path,record])=>{const match=path.match(/^\/specs\/v0\.1\/samples\/games\/([a-z0-9][a-z0-9-]{0,100})\.game\.json$/);if(!match||!record||typeof record.id!=='string'||!Number.isSafeInteger(record.revision)||!/^[a-f0-9]{64}$/.test(record.sha256Jcs))throw Error('A2G_E_RELEASE_INTEGRITY: 游戏目录条目无效。');return {name:match[1],path,...record,title:typeof record.title==='string'?record.title:match[1]};});return builtinCatalog;
}
export async function loadBuiltinGame(name){
  const entries=await loadBuiltinCatalog(),entry=entries.find(record=>record.name===name);
  if(!entry)throw Error('A2G_E_RELEASE_INTEGRITY: 此游戏未通过 G0 白名单校验。');
  const {path,...record}=entry,game=await api(await fetch(path));
  if(sha256Canonical(game)!==record.sha256Jcs||game.id!==record.id||game.revision!==record.revision)
    throw Error('A2G_E_RELEASE_INTEGRITY: 游戏内容与可信白名单不一致。');
  return game;
}
export async function loadBuiltinResources(game,registry){
 if(!Object.keys(game.assets??{}).length)return undefined;
 const admitted=await api(await fetch('/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(game)}));
 if(admitted.receipt.sha256Jcs!==sha256Canonical(game))throw Error('A2G_E_RELEASE_INTEGRITY: 内置资源准入内容不一致。');
 return (await loadReleasedGame(admitted.receipt.sha256Jcs,registry)).resources;
}
export async function importGameFile(file){
  if(file.size>CONTENT_BUNDLE_MAX_BYTES)throw Error('JSON 或内容包超过 1 MiB 上限。');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
  let isBundle=false;try{isBundle=JSON.parse(text).format==='a2game-release-bundle';}catch{}
  return api(await fetch(isBundle?'/api/bundles':'/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:text}));
}
export async function loadReleasedGame(digest,registry){
  if(!/^[a-f0-9]{64}$/.test(digest))throw Error('A2G_E_RELEASE_INTEGRITY: 发布标识无效。');
  const envelope=await api(await fetch(`/api/releases/${digest}`));
  return {definition:verifyReleasedGame(envelope,digest,capabilityManifestDigest(registry.list())),receipt:envelope.receipt,resources:envelope.resources};
}
