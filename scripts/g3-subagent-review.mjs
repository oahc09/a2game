/** Adapt one already validated native output to the existing browser source-input verifier. No generation. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {sha256Canonical} from '../dist/index.js';
import {root} from './registry.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const rel=p=>relative(root,p).replaceAll('\\','/');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
export function prepareSourceInputReview(workflow,{gameId,directory}={}){
 assert.match(gameId??'',/^(G(0[1-9]|[12][0-9]|3[0-2])|H0[1-5])$/,'需要显式 --id=Gxx/Hxx，不能依赖模型生成的游戏 ID。');
 workflow=resolve(root,workflow);const summary=read(resolve(workflow,'summary.json'));
 assert.equal(summary.status,'PASS_REFERENCE','先完成工程验证。');
 const bundle=read(resolve(workflow,'debug-bundle.json')),game=read(resolve(workflow,'game.json')),solution=read(resolve(workflow,'solution.json'));
 assert.deepEqual(bundle.game,game);assert.deepEqual(bundle.solution,solution);
 const priorPath=resolve(workflow,'../browser/summary.json'),prior=read(priorPath);
 assert.equal(prior.status,'PASS');assert.equal(prior.parity,true);
 for(const backend of ['three','air']){
  const receipt=read(prior.cases.find(c=>c.backend===backend)?.receipt??'');
  assert.equal(receipt.status,'PASS');assert.equal(receipt.final.exactHash,read(resolve(workflow,'playability.json')).final.exactHash);
 }
 directory??=resolve(root,'reports','g3-subagent-review-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
 mkdirSync(directory);const definitionSha256=sha256Canonical(game),batchPath=resolve(directory,'selection-batch.json'),selectionPath=resolve(directory,'selection.json');
 save(batchPath,{format:'a2game-subagent-source-selection',version:1,source:rel(workflow),sourceSummarySha256:hash(resolve(workflow,'summary.json')),cases:[{id:gameId,attempts:[{status:'PASS_REFERENCE',validation:rel(resolve(workflow,'summary.json')),browser:rel(priorPath)}]}]});
 save(selectionPath,{format:'a2game-subagent-source-selection',version:1,cases:[{id:gameId,status:'PASS_REFERENCE',definitionSha256,batch:rel(batchPath)}]});
 return {directory,selection:rel(selectionPath),definitionSha256,gameId,workflow:rel(workflow)};
}
export async function reviewSubagentInput(workflow,{gameId}={}){
 const selection=prepareSourceInputReview(workflow,{gameId});let stdout='';
 const exitCode=await new Promise((accept,reject)=>{
  const child=spawn(process.execPath,['scripts/g3-source-input.mjs','--selection='+selection.selection,'--ids='+gameId,'--generated-solution'],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>{stdout+=data;process.stdout.write(data);});child.stderr.on('data',data=>process.stderr.write(data));child.once('error',reject);child.once('close',accept);
 });
 const path=stdout.trim().split(/\r?\n/).findLast(s=>/^reports\/g3-source-input-[^\r\n]+\/summary\.json$/.test(s));
 const sourceInput=path?read(path):null;
 const valid=exitCode===0&&sourceInput?.status==='PASS_REFERENCE'&&sourceInput.cases.length===2&&sourceInput.cases.every(c=>c.definitionSha256===selection.definitionSha256&&c.status==='PASS_REFERENCE');
 const receipt={format:'a2game-subagent-input-review',version:1,status:valid?'PASS_REFERENCE':'FAIL',gameId,workflow:selection.workflow,definitionSha256:selection.definitionSha256,generationCalls:0,sourceInput:path??null,sourceInputSha256:path?hash(path):null,exitCode,scope:'Generated solution via declared DOM/keyboard sources; CDP/synthetic sources if required are not physical devices. No host game-specific solution profile.',identityAndIsolation:'AWAITING_HOST_EVIDENCE_REVIEW',variantSemantics:'AWAITING_REVIEW',visualQuality:'AWAITING_REVIEW',formalG3:'NOT_RUN'};
 save(resolve(selection.directory,'review.json'),receipt);console.log(rel(resolve(selection.directory,'review.json')));return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const [workflow,...args]=process.argv.slice(2),gameId=args.find(a=>a.startsWith('--id='))?.slice(5);
 if(!workflow)throw Error('用法：g3-subagent-review.mjs <attempt/validation> --id=G01');
 const receipt=await reviewSubagentInput(workflow,{gameId});if(receipt.status!=='PASS_REFERENCE')process.exitCode=1;
}catch(e){console.error('A2G_E_G3_INPUT_REVIEW：'+e.message);process.exitCode=1;}
