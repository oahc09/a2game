import {readFileSync,writeFileSync} from 'node:fs';
import {createReplaySave,openReplaySave} from '../dist/index.js';
import {createContentService} from './content-service.mjs';
import {makeRegistry} from './registry.mjs';
try{const [operation,gamePath,inputPath,outputPath]=process.argv.slice(2);if(!['export','open'].includes(operation)||!gamePath||!inputPath||operation==='export'&&!outputPath)throw Error('用法：node scripts/replay-save.mjs export <game.json> <trace.json> <新存档.json>，或 open <game.json> <存档.json>');
 const text=readFileSync(gamePath,'utf8'),service=createContentService(),receipt=await service.release(text),{definition}=await service.read(receipt.sha256Jcs),input=JSON.parse(readFileSync(inputPath,'utf8'));
 if(operation==='export'){const save=createReplaySave(definition,makeRegistry,input);writeFileSync(outputPath,JSON.stringify(save,null,2)+'\n',{flag:'wx'});console.log('PASS replay save:',outputPath);}
 else{const opened=openReplaySave(definition,makeRegistry,input);try{console.log(JSON.stringify(opened.receipt,null,2));}finally{opened.runtime.dispose();}}
}catch(e){console.error('存档操作未完成：',e.code??'',e.message);process.exitCode=1;}
