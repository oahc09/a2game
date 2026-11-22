/** CLI generation -> unchanged strict validator -> genuine browser replay. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {root} from './registry.mjs';
import {buildG3Plan,inspectGeneratedTask} from './g3-batch.mjs';
import {buildAgentRequest,runAgentWorkflow} from './agent-workflow.mjs';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
import {generateCodex} from './codex-generator.mjs';
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const rel=p=>relative(root,p).replaceAll('\\','/'),hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
export async function runCodexBatch(config,ids){
 const plan=buildG3Plan(),selected=ids??plan.tasks.map(t=>t.id);
 assert.ok(selected.length&&new Set(selected).size===selected.length&&selected.every(id=>plan.tasks.some(t=>t.id===id)),'未知或重复任务。');
 assert.ok(Number.isInteger(config.maxTasks)&&config.maxTasks>=selected.length&&config.maxTasks<=37,'超出 maxTasks。');assert.ok(Number.isInteger(config.maxCalls)&&config.maxCalls>=selected.length&&config.maxCalls<=111,'无效的 maxCalls。');assert.ok(Number.isInteger(config.maxAttempts)&&config.maxAttempts>=1&&config.maxAttempts<=3,'maxAttempts 必须为 1–3。');
 const directory=resolve(root,'reports','g3-codex-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);assert.ok(!existsSync(directory));mkdirSync(directory);save(resolve(directory,'plan.json'),plan);
 const fingerprints=Object.fromEntries(['scripts/codex-generator.mjs','generator/adapters/codex-generator.mjs','scripts/g3-codex.mjs','scripts/g3-batch.mjs','scripts/g3-playthrough.mjs','scripts/g3-browser.mjs','scripts/agent-workflow.mjs','scripts/agent-solver.mjs','project/g3-tasks.json'].map(p=>[p,hash(p)]));save(resolve(directory,'fingerprints.json'),fingerprints);
 const archivedSources={};for(const p of Object.keys(fingerprints)){const path=resolve(directory,'source',p);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,readFileSync(resolve(root,p)));archivedSources[p]=rel(path);}
 const rows=plan.tasks.map(t=>({id:t.id,status:'NOT_RUN',G3:'NOT_RUN',attempts:[]}));let calls=0,stop=false;
 const checkpoint=()=>{const unchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h),summary={format:'a2game-g3-codex-batch',version:1,status:!unchanged||rows.some(r=>r.status==='FAIL')?'FAIL':rows.filter(r=>r.status==='PASS_REFERENCE').length===37?'PASS_REFERENCE':'PARTIAL',selected,plannedGames:32,plannedHybrids:5,provider:'host-selected-current-codex-cli',model:'inherited-cli-default',modelOverride:false,calls,limits:{maxCalls:config.maxCalls,maxAttempts:config.maxAttempts,generationTimeoutMs:config.generationTimeoutMs},engineeringPassed:rows.filter(r=>r.status==='PASS_REFERENCE').length,independentG3Passed:0,G3:'NOT_RUN',independenceReview:'HOST_PROCESS_RECORDED_PENDING_REVIEW',qualityReview:'NOT_RUN',unchanged,fingerprints:rel(resolve(directory,'fingerprints.json')),archivedSources,cases:rows};save(resolve(directory,'summary.json'),summary);return summary;};checkpoint();console.log('BATCH',rel(directory));
 for(const id of selected){if(stop||calls>=config.maxCalls||config.stopFile&&existsSync(resolve(root,config.stopFile)))break;const task=plan.tasks.find(t=>t.id===id),row=rows.find(r=>r.id===id);let previous;
  for(let attempt=1;attempt<=config.maxAttempts&&calls<config.maxCalls;attempt++){
   if(config.stopFile&&existsSync(resolve(root,config.stopFile)))break;
   const attemptDir=resolve(directory,id,'attempt-'+attempt);mkdirSync(attemptDir,{recursive:true});const item={attempt,status:'FAIL',directory:rel(attemptDir)};let nextDiagnostic;calls++;
   try{
    console.log('GENERATE',id,attempt);await generateCodex(config,buildAgentRequest(task.prompt,attempt,previous),attemptDir);
    const validation=await runAgentWorkflow({prompt:task.prompt,command:[process.execPath,'scripts/codex-generator.mjs','--read-output',resolve(attemptDir,'output.raw.json')],maxAttempts:1,timeoutMs:60000,directory:resolve(attemptDir,'validation')});item.validation=rel(resolve(attemptDir,'validation/summary.json'));
    if(!validation.success){const error=read(resolve(attemptDir,'validation/attempt-1.json'));nextDiagnostic={code:error.code,message:error.message,diagnostics:error.diagnostics,output:{raw:readFileSync(resolve(attemptDir,'output.raw.json'),'utf8')}};throw Object.assign(Error(error.message),{code:error.code,attribution:error.attribution});}
    const output=read(resolve(attemptDir,'validation/output-1.json'));checkG3SuiteBudget(output.conformance);inspectGeneratedTask(task,validation.success);
    const browser=await verifyGeneratedBrowser(resolve(attemptDir,'validation'),resolve(attemptDir,'browser'));item.browser=rel(resolve(attemptDir,'browser/summary.json'));if(browser.status!=='PASS')throw Object.assign(Error('双 SDK 回放未通过。'),{code:'A2G_E_G3_BROWSER',attribution:'ENGINE_OR_HOST_UNRESOLVED'});item.status='PASS_REFERENCE';row.status='PASS_REFERENCE';row.oneShot=attempt===1;
   }catch(e){item.code=e.code??'A2G_E_G3_CODEX_REVIEW';item.message=String(e.message).slice(0,600);item.attribution=e.attribution??(item.code.startsWith('A2G_E_CODEX_')?'INFRA':'AGENT_STRATEGY');row.status='FAIL';if(item.attribution==='INFRA')stop=true;
    previous=nextDiagnostic??{code:item.code,message:item.message,...(existsSync(resolve(attemptDir,'output.raw.json'))?{output:{raw:readFileSync(resolve(attemptDir,'output.raw.json'),'utf8')}}:{})};
   }finally{row.attempts.push(item);checkpoint();}console.log(id,attempt,item.status,item.code??'');if(item.status==='PASS_REFERENCE'||stop||item.attribution==='ENGINE_OR_HOST_UNRESOLVED')break;
  }
 }
 return {directory:rel(directory),summary:checkpoint()};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const config=read(resolve(process.argv[2])),ids=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');const result=await runCodexBatch(config,ids);console.log(JSON.stringify({directory:result.directory,calls:result.summary.calls,engineeringPassed:result.summary.engineeringPassed,G3:'NOT_RUN'},null,2));if(result.summary.status==='FAIL')process.exitCode=1;}catch(e){console.error('A2G_E_G3_CODEX：'+e.message);process.exitCode=1;}
