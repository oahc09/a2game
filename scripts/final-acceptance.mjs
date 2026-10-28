/** P2 evidence archive and registration-readiness audit. Never promotes self-reported gates. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry,root as workspace} from './registry.mjs';
import {archivePath,pendingGates,currentBindings,verifySources,validateArchive} from './final-acceptance-audit.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const identities=registry=>registry.games.map(({status,extensions,...entry})=>entry);
function schemaCheck(directory){
 const p=spawnSync('python',['scripts/check-acceptance-schema.py',directory],{cwd:workspace,encoding:'utf8',windowsHide:true});
 assert.equal(p.status,0,'A2G_E_ACCEPTANCE_SCHEMA: '+(p.stderr||p.stdout));return JSON.parse(p.stdout);
}
export function collectAcceptance(root=workspace){
 const files={},attach=path=>{const file=archivePath(root,path);files[path]=hash(file);return path;},load=path=>read(archivePath(root,attach(path)));
 const status=read(resolve(root,'project/status.json')),contract=load('project/gameplay-acceptance.json'),registry=load('specs/v0.1/samples/coverage/games.json'),baseline=load('project/acceptance-baseline.json');
 assert.equal(sha256Canonical(identities(registry)),baseline.registryBasisDigest,'A2G_E_ACCEPTANCE_BASELINE');
 const expected=[...Array.from({length:32},(_,i)=>'G'+String(i+1).padStart(2,'0')),...Array.from({length:5},(_,i)=>'H'+String(i+1).padStart(2,'0'))];
 assert.deepEqual(contract.cases.map(c=>c.id).sort(),expected,'A2G_E_ACCEPTANCE_IDENTITIES');assert.deepEqual(baseline.ids,expected);
 assert.deepEqual(contract.cases.filter(c=>c.physical!=='NOT_APPLICABLE').map(c=>c.id).sort(),baseline.physicalIds,'A2G_E_ACCEPTANCE_PHYSICAL_SCOPE');
 assert.equal(status.currentRun.status,'PASS','Current full verification required');assert.equal(status.perGameRun.status,'PASS_REFERENCE');assert.equal(status.qualityRun.status,'PASS_REFERENCE');
 const bindings=currentBindings(status),headless=load(bindings.headless),browser=load(bindings.browser),variants=load(bindings.variants),quality=load(bindings.quality),conformance=load(bindings.conformance);attach(bindings.verification);
 const g3Reference={workflow:attach(status.agentWorkflowRun.workflow),status:'NOT_RUN',reason:'Reference provider provenance and solver success do not establish independent G3 acceptance.'};
 for(const s of [headless,browser,variants]){assert.equal(s.status,'PASS');assert.equal(s.unchanged,true);const fp=load(s.fingerprints);verifySources(root,fp);}
 for(const s of [browser,variants])load(s.sdk);
 assert.equal(headless.scenarioCount,contract.cases.reduce((n,c)=>n+5+(c.additionalScenarios??[]).length,0));
 assert.equal(headless.cases.length,37);assert.equal(browser.cases.length,74);assert.equal(variants.cases.length,74);assert.equal(conformance.status,'PASS');
 assert.equal(quality.status,'PASS_REFERENCE');assert.equal(quality.browser,bindings.browser);assert.equal(quality.variants,bindings.variants);assert.equal(quality.reviewedGames,37);
 const production=load(quality.production);assert.equal(production.status,'PASS');assert.equal(production.cases.length,4);verifySources(root,production.fingerprints);for(const row of production.cases){assert.equal(row.status,'PASS');load(row.receipt);attach(row.screenshot);}
 const schema=load(bindings.verification.replace('verify.log','schema-preflight.json'));assert.equal(schema.status,'PASS');assert.deepEqual(schema.errors,[]);
 load('player/validated-games.json');load('project/game-candidates.json');load('project/rule-variants.json');const coverage=load('project/candidate-evidence.json');
 assert.equal(coverage.summary,bindings.browser);assert.equal(coverage.variants,bindings.variants);
 for(const path of ['scripts/final-acceptance.mjs','scripts/final-acceptance-audit.mjs','scripts/check-acceptance-schema.py','specs/v0.1/schemas/coverage-result.schema.json'])attach(path);
 const packets=[];
 for(const entry of contract.cases){
  const definition=load(entry.game),variant=load(entry.variant),nodeRow=headless.cases.find(c=>c.id===entry.id);assert.ok(nodeRow);
  for(const gamePath of [entry.game,entry.variant]){const game=read(resolve(root,gamePath));for(const ref of game.tests??[])attach(relative(root,resolve(root,gamePath,'..',ref)).replaceAll('\\','/'));}
  const node=load(nodeRow.receipt);assert.equal(node.status,'PASS');assert.equal(node.definitionSha256,sha256Canonical(definition));assert.equal(node.variantSha256,sha256Canonical(variant));
  const expectedScenarios=['positive','negative','boundary','variant-positive','variant-negative',...(entry.additionalScenarios??[]).map(c=>c.name)];
  assert.deepEqual(node.scenarios.map(c=>c.name).sort(),expectedScenarios.sort());assert.ok(node.scenarios.every(c=>c.status==='PASS'&&c.restartReplay==='PASS'&&c.snapshotRestore==='PASS'));
  const suite=conformance.suites.find(c=>c.suiteId===entry.id.toLowerCase()+'-candidate');assert.equal(suite?.status,'PASS');
  const runtime=new HeadlessRuntime(definition,makeRegistry());let effective;try{effective=runtime.effectiveCapabilities;}finally{runtime.dispose();}
  const capabilitySetDigest=sha256Canonical(effective),registered=registry.games.find(c=>c.id===entry.id);
  if(registered){const supports=c=>effective.capabilities.some(e=>e.id===c.id&&e.version===c.version);assert.ok(registered.requiredCapabilities.all.every(supports)&&(registered.requiredCapabilities.anyOf??[]).every(group=>group.some(supports)),'Registry capability requirements differ: '+entry.id);}
  const evidence=[];
  for(const [kind,summary,game] of [['candidates',browser,definition],['variants',variants,variant]])for(const backend of ['three','air']){
   const row=summary.cases.find(c=>c.id===entry.id&&c.backend===backend);assert.equal(row?.status,'PASS');const r=load(row.receipt);
   assert.equal(r.status,'PASS');assert.equal(r.sha256Jcs,sha256Canonical(game));assert.equal(r.final.exactHash,r.node.exactHash);assert.equal(r.negative.exactHash,r.negativeNode.exactHash);assert.equal(r.restart,'PASS');assert.equal(r.retryAfterNegative,'PASS');assert.equal(r.disposal.adapter.disposed,true);assert.equal(r.disposal.listenersActive,false);assert.equal(r.disposal.resources.ownedResources,0);assert.equal(r.quality.status,'PASS_REFERENCE');assert.deepEqual(r.errors,[]);assert.deepEqual(r.messages,[]);
   const ref=coverage.cases.find(c=>c.id===entry.id&&c.kind===kind&&c.backend===backend);assert.ok(ref);const receipt=load(ref.receipt);assert.equal(receipt.status,'PASS');if(kind==='candidates')assert.equal(receipt.capabilitySetDigest,capabilitySetDigest);
   for(const path of [row.screenshot,r.negativeScreenshot,r.visual.canvas,...r.quality.viewports.map(v=>v.screenshot),...(r.boundaryScreenshot?[r.boundaryScreenshot]:[])])attach(path);
   evidence.push({kind,backend,receipt:row.receipt,referenceCoverage:ref.receipt,screenshot:row.screenshot});
  }
  const reviewed=quality.reviews.find(c=>c.id===entry.id);assert.equal(reviewed?.status,'AI_REVIEWED');
  packets.push({format:'a2game-final-acceptance-packet',version:1,id:entry.id,title:entry.title,definition:{path:entry.game,sha256Jcs:sha256Canonical(definition),revision:definition.revision},variant:{path:entry.variant,sha256Jcs:sha256Canonical(variant),revision:variant.revision,authorship:'repository-authored; not independent G3'},capabilitySetDigest,registryBasisDigest:baseline.registryBasisDigest,completion:entry.completion,headless:nodeRow.receipt,evidence,quality:{receipt:bindings.quality,observation:reviewed.observation,humanApproval:'NOT_RUN'},g3Reference,gates:{G0:'PASS_REFERENCE',G1:'PASS_REFERENCE',G2:'PASS_REFERENCE',humanQuality:'NOT_RUN',independentG3:'NOT_RUN',physical:entry.physical},blockers:pendingGates(entry),status:'NOT_RUN',verified:false});
 }
 return {bindings,baseline,packets,files};
}
export function buildArchive(){
 const collected=collectAcceptance(),runId='acceptance-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory='reports/'+runId;
 assert.ok(!existsSync(resolve(workspace,directory)));mkdirSync(resolve(workspace,directory));const files={...collected.files},packets=[];
 const write=(path,value)=>{save(resolve(workspace,path),value);files[path]=hash(resolve(workspace,path));};
 for(const packet of collected.packets){const path=directory+'/'+packet.id+'.packet.json';write(path,packet);const targets=[];
  for(const [backend,adapterId] of [['three','threejs-a2game'],['air','cocosairjs-a2game']]){const receipt=directory+'/'+backend+'-'+packet.id+'-full.receipt.json';write(receipt,{format:'a2game-coverage-result',receiptVersion:'0.1.0',gameId:packet.id,testCaseId:packet.id+'-FULL-DOD',adapterId,platformProfile:'windows-chromium-desktop',capabilitySetDigest:packet.capabilitySetDigest,testRevision:'full-game-acceptance-v1',status:'NOT_RUN',reason:packet.blockers.join(', ')+'. Existing reference evidence is not full acceptance.',evidence:{runId,diagnosticsUri:path}});targets.push({adapterId,receipt});}
  packets.push({id:packet.id,path,targets});
 }
 write(directory+'/schema-check.json',schemaCheck(resolve(workspace,directory)));
 const readme=directory+'/README.md';writeFileSync(resolve(workspace,readme),'# 逐款正式验收档案\n\n档案检查通过；完整验收仍为 PARTIAL。正式 0/32＋0/5。\n\n现有证据范围为 Windows Chromium 的参考 Profile；作者变体、AI 画面审查和合成输入不能替代人工质量、独立 G3 或真实设备。所有正式 CoverageResult 保持 NOT_RUN。\n\n| 关卡 | 档案 | 尚缺证据 |\n|---|---|---|\n'+collected.packets.map(p=>'| '+p.id+' '+p.title+' | [JSON]('+p.id+'.packet.json) | 人工质量、独立 G3'+(p.gates.physical==='NOT_APPLICABLE'?'':'、适用真机')+' |').join('\n')+'\n');files[readme]=hash(resolve(workspace,readme));
 const summary={format:'a2game-final-acceptance-archive',version:1,runId,archiveStatus:'PASS',acceptanceStatus:'PARTIAL',registrationMode:'evidence-only',scope:'Current Windows Chromium desktop reference evidence, two real SDKs; no other platform or unexecuted external gate is certified.',bindings:collected.bindings,registryBasisDigest:collected.baseline.registryBasisDigest,verifiedGames:0,plannedGames:32,verifiedHybrids:0,plannedHybrids:5,pending:{humanQuality:37,independentG3:37,physical:collected.packets.filter(p=>p.gates.physical!=='NOT_APPLICABLE').length},packets,files};
 const path=directory+'/summary.json';save(resolve(workspace,path),summary);const index={format:'a2game-final-acceptance-index',version:1,summary:path,sha256:hash(resolve(workspace,path))};validateArchive(index);save(resolve(workspace,'project/final-acceptance.json'),index);return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const command=process.argv[2]??'check';assert.ok(['build','check'].includes(command));const summary=command==='build'?buildArchive():validateArchive(read(resolve(workspace,'project/final-acceptance.json')),workspace);if(command==='check')schemaCheck(resolve(workspace,'reports',summary.runId));console.log(JSON.stringify({archiveStatus:summary.archiveStatus,acceptanceStatus:summary.acceptanceStatus,runId:summary.runId,packets:summary.packets.length,formalReceipts:74,verifiedGames:'0/32',verifiedHybrids:'0/5',pending:summary.pending},null,2));if(process.argv.includes('--require-ready')){console.error('A2G_E_ACCEPTANCE_NOT_READY: 人工质量、独立 G3 和适用真机证据尚未齐全，不能正式登记。');process.exitCode=1;}}
 catch(e){console.error('A2G_E_ACCEPTANCE',e.message);process.exitCode=1;}
}
