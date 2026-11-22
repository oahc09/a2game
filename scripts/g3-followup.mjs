/** One bounded, explicitly recorded follow-up per host-selected task; never edits a model artifact. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {HeadlessRuntime,sha256Canonical,projectPresentation} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
import {buildAgentRequest,runAgentWorkflow} from './agent-workflow.mjs';
import {buildG3Plan,inspectGeneratedTask} from './g3-batch.mjs';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
import {generateCodex} from '../generator/adapters/codex-generator.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')),hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/'),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const config=read(process.argv[2]);assert.ok(config.tasks.length>0&&config.tasks.length<=config.maxCalls&&config.maxCalls<=5);
const directory=resolve(root,'reports','g3-followup-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);mkdirSync(directory);writeFileSync(resolve(directory,'driver-source.mjs'),readFileSync(resolve(root,'scripts/g3-followup.mjs')));
const context=read(config.context),plan=buildG3Plan(),rows=[];let calls=0;
const checkpoint=()=>{const summary={...context,selected:config.tasks.map(t=>t.id),cases:rows,calls,limits:{maxCalls:config.maxCalls,maxAttempts:1,generationTimeoutMs:config.generationTimeoutMs},engineeringPassed:rows.filter(r=>r.status==='PASS_REFERENCE').length,status:rows.some(r=>r.status==='FAIL')?'FAIL':'PARTIAL',scope:'Single recorded follow-up after contract/quality diagnosis; original outputs preserved, new CLI calls counted separately, no global one-shot claim.',revalidationSource:{path:rel(resolve(directory,'driver-source.mjs')),sha256:hash(rel(resolve(directory,'driver-source.mjs')))}};save(resolve(directory,'summary.json'),summary);return summary;};checkpoint();
for(const task of config.tasks){const contract=plan.tasks.find(t=>t.id===task.id),source=read(task.source),old=source.cases.find(c=>c.id===task.id),prior=task.mode==='presentation-only'?old.attempts.findLast(a=>a.status==='PASS_REFERENCE'):old.attempts.at(-1);assert.ok(prior);
 const cli=read(prior.directory+'/cli.json');assert.equal(cli.status,'PASS');assert.equal(hash(prior.directory+'/output.raw.json'),cli.outputSha256);const raw=readFileSync(resolve(root,prior.directory,'output.raw.json'),'utf8');
 const local=resolve(directory,task.id);mkdirSync(local);const item={attempt:1,status:'FAIL',directory:rel(local),mode:task.mode,previousBatch:task.source,previousAttempt:prior.directory},row={id:task.id,status:'FAIL',G3:'NOT_RUN',attempts:[item]};rows.push(row);
 try{
  const previous={code:prior.code??'A2G_QUALITY_REVIEW',message:task.feedback??prior.message,output:{raw},publicContracts:Object.fromEntries(['src/presentation.ts','src/conformance.ts'].map(path=>[path,{sha256:hash(path),source:readFileSync(resolve(root,path),'utf8')}]))};
  if(prior.validation){const path=prior.validation.replace(/summary\.json$/,'attempt-1.json');previous.diagnostics=read(path).diagnostics;}
  const instruction=task.mode==='presentation-only'?'Only repair presentation/hud and metadata. Increase game.revision by exactly 1. Preserve world, inputs, state, rules, prototypes, scenes, runtime, assets, requirements, solution and conformance exactly. Do not change gameplay or tests. Keep all drawing centers/shapes inside declared scene bounds; every text font should project to at least 15 pixels in a 724x460 canvas. Return a full a2game-generation-output envelope with format, version, game, conformance, solution, provenance.':'Repair the previous output using the actual diagnostics and public contracts, preserving the task requirements. Return a full a2game-generation-output envelope with format, version, game, conformance, solution, provenance.';
  calls++;console.log('FOLLOWUP',task.id,task.mode);await generateCodex(config,buildAgentRequest(contract.prompt+'\n'+instruction,1,previous),local);
  const validation=await runAgentWorkflow({prompt:contract.prompt,command:[process.execPath,'generator/adapters/codex-generator.mjs','--read-output',resolve(local,'output.raw.json')],maxAttempts:1,timeoutMs:60000,directory:resolve(local,'validation')});item.validation=rel(resolve(local,'validation/summary.json'));
  if(!validation.success){const error=read(item.validation.replace(/summary\.json$/,'attempt-1.json'));throw Object.assign(Error(error.message),{code:error.code,attribution:error.attribution});}
  const output=read(rel(resolve(local,'validation/output-1.json')));checkG3SuiteBudget(output.conformance);inspectGeneratedTask(contract,validation.success);
  if(task.mode==='presentation-only'){
   const original=read(prior.validation.replace(/summary\.json$/,'output-1.json')),withoutPresentation=({presentation,meta,revision,...logic})=>logic;
   assert.equal(sha256Canonical(withoutPresentation(output.game)),sha256Canonical(withoutPresentation(original.game)),'画面修复不能修改玩法。');assert.equal(output.game.revision,original.game.revision+1);assert.deepEqual(output.conformance,original.conformance);assert.deepEqual(output.solution,read(prior.validation.replace(/summary\.json$/,'solution.json')));
   const runtime=new HeadlessRuntime(output.game,makeRegistry());runtime.start();try{const frame=projectPresentation(output.game,runtime.observe()),scale=Math.min(724/frame.width,460/frame.height);for(const c of frame.commands){const half=c.kind==='rect'?c.size.map(v=>v/2):c.kind==='circle'?[c.radius,c.radius]:[0,c.fontSize/2];assert.ok(Math.abs(c.at[0])+half[0]<=frame.width/2+1e-6&&Math.abs(c.at[1])+half[1]<=frame.height/2+1e-6,'画面元素越界：'+c.id);if(c.kind==='text')assert.ok(c.fontSize*scale>=15,'文字小于 15px：'+c.id);}}finally{runtime.dispose();}
  }
  const browser=await verifyGeneratedBrowser(resolve(local,'validation'),resolve(local,'browser'));item.browser=rel(resolve(local,'browser/summary.json'));if(browser.status!=='PASS')throw Object.assign(Error('双 SDK 重验未通过。'),{code:'A2G_E_G3_BROWSER',attribution:'ENGINE_OR_HOST_UNRESOLVED'});item.status='PASS_REFERENCE';row.status='PASS_REFERENCE';
 }catch(e){item.code=e.code??'A2G_E_G3_FOLLOWUP';item.message=String(e.message).slice(0,700);item.attribution=e.attribution??(item.code.startsWith('A2G_E_CODEX_')?'INFRA':'AGENT_STRATEGY');}
 checkpoint();console.log(task.id,item.status,item.code??'');
}
const summary=checkpoint();console.log(JSON.stringify({summary:rel(resolve(directory,'summary.json')),calls,engineeringPassed:summary.engineeringPassed},null,2));if(summary.status==='FAIL')process.exitCode=1;
