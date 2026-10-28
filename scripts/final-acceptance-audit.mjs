/** Read-only P2 audit; works before dist exists on a clean checkout. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function archivePath(root,path){
 assert.ok(typeof path==='string'&&path.length>0&&!path.includes('\\')&&!path.split('/').some(s=>s==='..'||s==='.')&&!path.includes(':')&&!path.startsWith('/'),'A2G_E_ACCEPTANCE_PATH');
 const file=resolve(root,path),base=realpathSync(root);
 assert.ok(file.startsWith(resolve(root)+sep)&&realpathSync(file).startsWith(base+sep),'A2G_E_ACCEPTANCE_PATH');return file;
}
export function pendingGates(entry){
 // P0 and the provider currently have no authenticated formal sign-off intake.
 // A manually edited PASS/fixture identity is deliberately not a replacement.
 return ['HUMAN_QUALITY_NOT_RUN','INDEPENDENT_G3_NOT_RUN',...(entry.physical==='NOT_APPLICABLE'?[]:['PHYSICAL_INPUT_DEFERRED'])];
}
export function currentBindings(status){return {headless:status.perGameRun.headless,browser:status.perGameRun.browser,variants:status.perGameRun.variants,quality:status.qualityRun.summary,verification:status.currentRun.log,conformance:status.currentRun.conformanceReceipt};}
export function verifySources(root,fingerprints){for(const [path,digest] of Object.entries(fingerprints)){assert.match(digest,/^[a-f0-9]{64}$/);if(!existsSync(resolve(root,path))&&path.startsWith('dist/')&&path.endsWith('.js')&&!path.includes('\\')&&!path.includes(':')&&!path.split('/').some(s=>s==='..'||s==='.'))continue;assert.equal(hash(archivePath(root,path)),digest,'A2G_E_ACCEPTANCE_STALE: '+path);}}
export function validateArchive(index,root=resolve(import.meta.dirname,'..')){
 assert.equal(index.format,'a2game-final-acceptance-index');assert.equal(hash(archivePath(root,index.summary)),index.sha256,'A2G_E_ACCEPTANCE_DIGEST');
 const summary=read(archivePath(root,index.summary));assert.equal(summary.format,'a2game-final-acceptance-archive');assert.equal(summary.version,1);assert.equal(summary.archiveStatus,'PASS');assert.equal(summary.acceptanceStatus,'PARTIAL');assert.equal(summary.registrationMode,'evidence-only');
 assert.equal(summary.packets.length,37);assert.equal(new Set(summary.packets.map(p=>p.id)).size,37);assert.equal(summary.verifiedGames,0);assert.equal(summary.verifiedHybrids,0);
 const current=read(resolve(root,'project/status.json'));assert.equal(current.perGameRun.status,'PASS_REFERENCE');assert.equal(current.qualityRun.status,'PASS_REFERENCE');for(const key of ['headless','browser','variants','quality'])assert.equal(currentBindings(current)[key],summary.bindings[key],'A2G_E_ACCEPTANCE_POINTERS: '+key);
 for(const [path,digest] of Object.entries(summary.files))assert.equal(hash(archivePath(root,path)),digest,'A2G_E_ACCEPTANCE_DIGEST: '+path);
 for(const key of ['headless','browser','variants']){const s=read(archivePath(root,summary.bindings[key]));assert.equal(s.status,'PASS');verifySources(root,read(archivePath(root,s.fingerprints)));}
 const baseline=read(resolve(root,'project/acceptance-baseline.json'));assert.equal(hash(archivePath(root,'specs/v0.1/samples/coverage/games.json')),baseline.registrySha256);assert.equal(summary.registryBasisDigest,baseline.registryBasisDigest);
 const contract=read(resolve(root,'project/gameplay-acceptance.json'));const wanted=contract.cases.map(c=>c.id).sort();assert.deepEqual(summary.packets.map(c=>c.id).sort(),wanted);
 let targets=0,physical=0;
 for(const row of summary.packets){
  assert.ok(summary.files[row.path]);const packet=read(archivePath(root,row.path)),entry=contract.cases.find(c=>c.id===row.id);assert.equal(packet.id,entry.id);assert.equal(packet.status,'NOT_RUN');assert.equal(packet.verified,false);assert.deepEqual(packet.blockers,pendingGates(entry));assert.equal(packet.quality.humanApproval,'NOT_RUN');assert.equal(packet.gates.independentG3,'NOT_RUN');
  if(entry.physical!=='NOT_APPLICABLE')physical++;
  assert.equal(row.targets.length,2);assert.deepEqual(row.targets.map(t=>t.adapterId).sort(),['cocosairjs-a2game','threejs-a2game']);
  for(const target of row.targets){assert.ok(summary.files[target.receipt]);const r=read(archivePath(root,target.receipt));assert.equal(r.gameId,row.id);assert.equal(r.adapterId,target.adapterId);assert.equal(r.capabilitySetDigest,packet.capabilitySetDigest);assert.equal(r.platformProfile,'windows-chromium-desktop');assert.equal(r.status,'NOT_RUN');assert.equal(r.evidence.diagnosticsUri,row.path);targets++;}
 }
 assert.equal(targets,74);assert.deepEqual(summary.pending,{humanQuality:37,independentG3:37,physical});
 assert.deepEqual(contract.cases.filter(c=>c.physical!=='NOT_APPLICABLE').map(c=>c.id).sort(),baseline.physicalIds);
 const registry=read(resolve(root,'specs/v0.1/samples/coverage/games.json')),status=read(resolve(root,'project/status.json'));
 assert.equal(registry.games.filter(c=>c.status==='verified').length,0,'Formal registration requires external acceptance, not this evidence-only archive');assert.equal(status.coverage.verifiedGames,0);assert.equal(status.coverage.verifiedHybridCases,0);
 return summary;
}
