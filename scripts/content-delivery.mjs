#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {publishVersion,selectVersion,inspectDelivery,importVersion,preparePlayerVersion} from '../packages/content-delivery/index.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
try{
 const {positionals,values}=parseArgs({allowPositionals:true,options:{root:{type:'string'},source:{type:'string'},description:{type:'string'},version:{type:'string'}}});
 if(positionals.length!==1||!values.root)throw Error('Usage: node scripts/content-delivery.mjs export|select|inspect|import|build-player --root EXISTING_DIR [--source DIR --description TEXT | --version vN]');
 const [command]=positionals;let result;
 if(command==='export')result=await publishVersion(values);
 else if(command==='select')result=selectVersion(values);
 else if(command==='inspect')result=inspectDelivery(values);
 else if(command==='import')result=await importVersion(values);
 else if(command==='build-player'){
  const source=await preparePlayerVersion(values);
  const built=spawnSync(process.execPath,[join(import.meta.dirname,'package-player-sdk.mjs'),source.packagePath],{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true});
  if(built.error||built.status!==0)throw Error('A2G_DELIVERY_PLAYER_BUILD: '+(built.error?.message??built.stderr));
  const player=JSON.parse(built.stdout);
  result={status:'PASS',source:{version:source.version,gameId:source.gameId,packageSha256:source.packageSha256},player,receiverDirectory:source.outputDirectory};
  const provenance=JSON.stringify({format:'a2game-player-delivery-source',version:1,...result.source,bundleDigest:player.bundleDigest},null,2)+'\n';
  writeFileSync(join(player.output,'delivery-source.json'),provenance,{flag:'wx'});
  const inventoryPath=join(player.output,'build-inventory.json'),inventory=JSON.parse(readFileSync(inventoryPath,'utf8'));
  inventory.files.push({file:'delivery-source.json',sha256:createHash('sha256').update(provenance).digest('hex')});
  writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
  writeFileSync(join(source.outputDirectory,'player-build.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 }
 else throw Error('Unknown command');
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.code??error.message);process.exitCode=1;}
