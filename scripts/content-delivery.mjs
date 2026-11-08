#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {publishVersion,selectVersion,inspectDelivery,importVersion} from '../packages/content-delivery/index.mjs';
try{
 const {positionals,values}=parseArgs({allowPositionals:true,options:{root:{type:'string'},source:{type:'string'},description:{type:'string'},version:{type:'string'}}});
 if(positionals.length!==1||!values.root)throw Error('Usage: node scripts/content-delivery.mjs export|select|inspect|import --root EXISTING_DIR [--source DIR --description TEXT | --version vN]');
 const [command]=positionals;let result;
 if(command==='export')result=await publishVersion(values);
 else if(command==='select')result=selectVersion(values);
 else if(command==='inspect')result=inspectDelivery(values);
 else if(command==='import')result=await importVersion(values);
 else throw Error('Unknown command');
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.code??error.message);process.exitCode=1;}
