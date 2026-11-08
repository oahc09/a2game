/** Keep existing Generator packaging and receiver admission authoritative. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {exportGamePackage} from '../../../generator/index.mjs';
const source=import.meta.dirname;
const collection=JSON.parse(readFileSync(join(source,'collection.json'),'utf8'));
const directory=resolve('output',`lumen-depot-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
mkdirSync(directory,{recursive:true});
const entries=[];
for(const level of collection.levels){
  const pack=await exportGamePackage(dirname(join(source,level.game)));
  const bytes=JSON.stringify(pack,null,2)+'\n',file=level.id+'.package.json';
  writeFileSync(join(directory,file),bytes,{flag:'wx'});
  entries.push({id:level.id,file,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
}
writeFileSync(join(directory,'manifest.json'),JSON.stringify({collection,packages:entries,provenance:'CONTROLLER_AUTHORED; NOT_BRANDED_HOST_G3',requires:'Compatible trusted A2Game host, locked SDKs; collection UI not embedded in individual content packages'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_REFERENCE',directory,packages:entries},null,2));
