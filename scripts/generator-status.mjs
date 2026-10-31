/** Read-only workstream summary; recorded receipts are not silently revalidated. */
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
try{
 const s=JSON.parse(readFileSync(resolve(root,'project/generator-status.json'),'utf8'));
 const result={format:'a2game-generator-status-summary',version:1,status:s.status,currentBatch:s.currentBatch,nextStep:s.nextBatch,scope:'Recorded local engineering evidence; this command does not rerun tests or approve model/human/device/CI gates.',workPackages:s.workPackages.map(w=>({id:w.id,status:w.status})),gates:s.gates.map(g=>({id:g.id,status:g.status})),benchmark:s.benchmarkExecution??s.batchD??null,delivery:s.currentDelivery?{...s.currentDelivery,available:existsSync(resolve(root,s.currentDelivery.receipt))}:null,formalG3:s.formalG3,humanReview:s.humanReview,physicalDevices:s.physicalDevices,remoteCI:s.remoteCI};
 if(process.argv.includes('--json'))console.log(JSON.stringify(result));
 else{console.log(`Generator：${s.status}；当前 Batch ${s.currentBatch}`);for(const w of result.workPackages)console.log(`${w.id}: ${w.status}`);console.log(`下一步：${s.nextBatch}`);console.log('以上为记录状态；正式 G3、人工质量、真机和远端 CI 单独验收。');}
}catch{console.error('Generator 状态读取失败；请检查 project/generator-status.json 后重试。');process.exitCode=1;}
