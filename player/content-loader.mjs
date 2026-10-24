import {sha256Canonical,verifyReleasedGame,capabilityManifestDigest,CONTENT_BUNDLE_MAX_BYTES} from '../dist/index.js';

async function api(response){
  const result=await response.json();
  if(!response.ok){
    const error=new Error(result.error?.message??'本地内容服务请求失败。');
    Object.assign(error,result.error);throw error;
  }
  return result;
}
export async function loadBuiltinGame(name){
  const catalog=await api(await fetch('./validated-games.json'));
  const entries=Object.entries(catalog.content??{});
  const entry=entries.find(([path])=>path===`/specs/v0.1/samples/games/${name}.game.json`);
  if(!entry)throw Error('A2G_E_RELEASE_INTEGRITY: 此游戏未通过 G0 白名单校验。');
  const [path,record]=entry,game=await api(await fetch(path));
  if(sha256Canonical(game)!==record.sha256Jcs||game.id!==record.id||game.revision!==record.revision)
    throw Error('A2G_E_RELEASE_INTEGRITY: 游戏内容与可信白名单不一致。');
  return game;
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
