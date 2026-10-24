import {readFileSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './registry.mjs';

export class AssetError extends Error {
  constructor(code,message,statusCode=422){super(message);Object.assign(this,{code,statusCode,stage:'resource',diagnostics:[{pointer:'/assets',message}]});}
}
export function createAssetPolicy(){
  const policy=JSON.parse(readFileSync(resolve(root,'project/asset-policy.json'),'utf8'));
  if(policy.format!=='a2game-asset-policy'||policy.version!==1||!Array.isArray(policy.entries)||policy.maxAssets!==32||policy.maxTotalBytes!==8388608)
    throw new AssetError('A2G_E_RESOURCE_POLICY','本地资源策略配置无效。',503);
  const entries=new Map(),byDigest=new Map();
  for(const entry of policy.entries){
    if(!/^assets\/[A-Za-z0-9_./-]+$/.test(entry.uri)||entry.uri.split('/').some(part=>part==='..'||part==='.')||entries.has(entry.uri)||
      !['image','audio','model','json','binary','font','atlas'].includes(entry.type)||!/^sha256-[A-Za-z0-9+/]{43}=$/.test(entry.integrity)||
      !Number.isInteger(entry.bytes)||entry.bytes<1||entry.bytes>policy.maxTotalBytes||typeof entry.source!=='string'||!entry.source||typeof entry.license!=='string'||!entry.license)
      throw new AssetError('A2G_E_RESOURCE_POLICY','本地资源策略条目无效。',503);
    const digest=Buffer.from(entry.integrity.slice(7),'base64').toString('hex');entries.set(entry.uri,{...entry,digest});byDigest.set(digest,entry.uri);
  }
  function read(uri){
    const entry=entries.get(uri);if(!entry)throw new AssetError('A2G_E_RESOURCE_POLICY','资源不在宿主审核白名单中。');
    let bytes;
    try{
      const path=realpathSync(resolve(root,uri));
      if(!path.startsWith(resolve(root,'assets')+sep)||!lstatSync(path).isFile())throw Error('Outside assets');
      bytes=readFileSync(path);
    }catch{throw new AssetError('A2G_E_RESOURCE_INTEGRITY','审核资源缺失或超出允许目录。',503);}
    if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.digest)
      throw new AssetError('A2G_E_RESOURCE_INTEGRITY','资源字节与审核 SHA256 不符。',503);
    return {entry,bytes};
  }
  return {
    resolve(game){
      const assets=Object.entries(game.assets??{});if(assets.length>policy.maxAssets)throw new AssetError('A2G_E_RESOURCE_POLICY','资源数量超出预算。');
      let total=0;
      return assets.sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,asset])=>{
        const {entry}=read(asset.uri);
        if(asset.type!==entry.type||asset.integrity!==entry.integrity)throw new AssetError('A2G_E_RESOURCE_INTEGRITY','资源类型或 integrity 与审核清单不符。');
        total+=entry.bytes;if(total>policy.maxTotalBytes)throw new AssetError('A2G_E_RESOURCE_POLICY','资源总字节超出预算。');
        return {id,uri:entry.uri,type:entry.type,integrity:entry.integrity,sha256:entry.digest,bytes:entry.bytes,href:`/api/assets/${entry.digest}`};
      });
    },
    readDigest(digest){const uri=byDigest.get(digest);if(!uri)throw new AssetError('A2G_E_RESOURCE_POLICY','资源不在宿主审核白名单中。',404);return read(uri);}
  };
}
