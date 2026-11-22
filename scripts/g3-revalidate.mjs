/** Retry SHA-bound output after INFRA; optional model repairs are separately counted, never hidden. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './registry.mjs';
import {archivePath} from './final-acceptance-audit.mjs';
import {buildAgentRequest,runAgentWorkflow} from './agent-workflow.mjs';
import {buildG3Plan,inspectGeneratedTask} from './g3-batch.mjs';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
import {generateCodex} from '../generator/adapters/codex-generator.mjs';
const read=p=>JSON.parse(readFileSync(archivePath(root,p),'utf8')),rel=p=>relative(root,p).replaceAll('\\','/'),hash=p=>createHash('sha256').update(readFileSync(archivePath(root,p))).digest('hex');
const source=process.argv[2],id=process.argv[3],batch=read(source),old=batch.cases.find(c=>c.id===id),original=old?.attempts.at(-1);assert.ok(original&&original.attribution==='INFRA','只重试基础设施失败；模型修复需独立调用并计数。');
const originalRaw=original.directory+'/output.raw.json',cli=read(original.directory+'/cli.json');assert.equal(cli.status,'PASS');assert.equal(hash(originalRaw),cli.outputSha256);
const config=process.argv[4]?JSON.parse(readFileSync(resolve(process.argv[4]),'utf8')):undefined;
const directory=resolve(root,'reports','g3-revalidate-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);mkdirSync(directory);const task=buildG3Plan().tasks.find(t=>t.id===id),row={id,status:'FAIL',G3:'NOT_RUN',attempts:[]};let failure,previous,calls=0;
for(let repair=0;repair<=(config?3-original.attempt:0);repair++){
 const local=resolve(directory,'try-'+repair);mkdirSync(local);let raw=originalRaw;
 const item=repair?{attempt:original.attempt+repair,directory:rel(local),status:'FAIL'}:{...original,status:'FAIL',validationOnlyRetry:true,originalValidation:original.validation};
 try{
  if(repair){calls++;await generateCodex(config,buildAgentRequest(task.prompt,item.attempt,previous),local);raw=rel(resolve(local,'output.raw.json'));}
  const validation=await runAgentWorkflow({prompt:task.prompt,command:[process.execPath,'generator/adapters/codex-generator.mjs','--read-output',archivePath(root,raw)],maxAttempts:1,timeoutMs:60000,directory:resolve(local,'validation')});item.validation=rel(resolve(local,'validation/summary.json'));
  if(!validation.success){const error=read(rel(resolve(local,'validation/attempt-1.json')));previous={code:error.code,message:error.message,diagnostics:error.diagnostics,output:{raw:readFileSync(archivePath(root,raw),'utf8')}};throw Object.assign(Error(error.message),{code:error.code,attribution:error.attribution});}
  checkG3SuiteBudget(read(rel(resolve(local,'validation/output-1.json'))).conformance);inspectGeneratedTask(task,validation.success);
  const browser=await verifyGeneratedBrowser(resolve(local,'validation'),resolve(local,'browser'));item.browser=rel(resolve(local,'browser/summary.json'));assert.equal(browser.status,'PASS');row.status='PASS_REFERENCE';item.status='PASS_REFERENCE';delete item.code;delete item.attribution;
 }catch(e){item.code=e.code??'A2G_E_G3_REVALIDATION';item.attribution=e.attribution??(item.code.startsWith('A2G_E_CODEX_')?'INFRA':'AGENT_STRATEGY');item.message=String(e.message).slice(0,600);failure=item.message;
  previous??={code:item.code,message:item.message,output:{raw:readFileSync(archivePath(root,raw),'utf8')}};
  if(item.code==='A2G_E_PRESENTATION'){const path='src/presentation.ts';previous.publicDiagnosticContract={path,sha256:hash(path),source:readFileSync(resolve(root,path),'utf8')};}
 }finally{row.attempts.push(item);}
 console.log(id,item.attempt,item.status,item.code??'',repair?'MODEL_REPAIR':'VALIDATION_ONLY');if(row.status==='PASS_REFERENCE'||item.attribution==='INFRA')break;
}
const result={...batch,selected:[id],calls,originalCalls:1,sourceBatch:source,scope:'SHA-bound original CLI output validation retry. Any subsequent Codex repairs are new calls and explicitly counted.',revalidationSource:{path:'scripts/g3-revalidate.mjs',sha256:hash('scripts/g3-revalidate.mjs')},engineeringPassed:row.status==='PASS_REFERENCE'?1:0,cases:[row],status:row.status==='PASS_REFERENCE'?'PARTIAL':'FAIL',...(row.status==='PASS_REFERENCE'?{}:{failure})};
writeFileSync(resolve(directory,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:row.status,id,newModelCalls:calls,summary:rel(resolve(directory,'summary.json'))},null,2));if(row.status!=='PASS_REFERENCE')process.exitCode=1;
