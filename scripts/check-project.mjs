/** Governance validator: prevents silent release, gate, scope and roadmap drift. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {validateArchive,verifySources} from './final-acceptance-audit.mjs';
import {canonicalSpecPath,sourceMatches} from './spec-layout.mjs';
const root = resolve(import.meta.dirname, '..');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const text = path => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const insist = (ok, why) => { if (!ok) failures.push(why); };
const files = [
  'package.json','README.md','AGENTS.md','PROJECT-PLAN.md','PROJECT-STATUS.md',
  'CHANGELOG.md','project/status.json','requirements-dev.txt','src/release-version.ts',
  'IMPLEMENTATION-REPORT.md','IMPLEMENTATION-NEXT.md',
  'specs/v0.1/docs/01-GameSpec-V0.1.md',
  'specs/v0.1/docs/02-Capability-Manifest-V0.1.md',
  'specs/v0.1/docs/03-Runtime-Tick-Rule-Semantics-V0.1.md',
  'specs/v0.1/docs/04-Conformance-Test-V0.1.md',
  'specs/v0.1/docs/05-Coverage-Registry-V0.1.md',
  'specs/v0.1/docs/06-Presentation-Slice-V0.1.md',
  'specs/v0.1/docs/07-Touch-Swipe-InputTrace-V0.1.md'
];
for (const f of files) insist(existsSync(resolve(root, f)), `Required path missing: ${f}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
const pkg = read('package.json');
const status = read('project/status.json');
const page = text('player/index.html');
const readme = text('README.md');
const plan = text('PROJECT-PLAN.md');
const statusDoc = text('PROJECT-STATUS.md');
const source = text('src/release-version.ts');
const coverage = read('specs/v0.1/coverage/games.json');
const gameDir = resolve(root, 'specs/v0.1/games');
const capDir = resolve(root, 'specs/v0.1/capabilities');
const actualGameCount = readdirSync(gameDir).filter(x => x.endsWith('.game.json')).length;
const actualCapCount = readdirSync(capDir).filter(x => x.endsWith('.capability.json')).length;
const statuses = new Set(['PASS','PARTIAL','NOT_RUN','NOT_IMPLEMENTED','PLANNED','BLOCKED','FAIL','DESIGN_COMPLETE']);
insist(/^\d+\.\d+\.\d+$/.test(pkg.version), 'Package version must be SemVer');
insist(pkg.version === status.release.version, 'Release version differs between package.json and project/status.json');
insist(source.includes(`A2GAME_RELEASE_VERSION = '${pkg.version}'`), 'Runtime release version mismatches package.json');
insist(source.includes(`A2GAME_GAMESPEC_VERSION = '${status.release.gameSpecVersion}'`), 'Runtime GameSpec protocol version mismatches project/status.json');
insist(readme.includes(`A2Game ${pkg.version}`), 'README does not identify current release');
insist(page.includes(`A2Game ${pkg.version}`), 'Browser player does not identify current release');
insist(readme.includes(status.release.gameSpecVersion), 'README must explicitly note separate protocol version');
insist(status.release.gameSpecVersion === status.release.capabilityManifestVersion, 'Manifest / GameSpec protocol version mismatch');
insist(new Set(status.stages.map(s => s.id)).size === status.stages.length, 'Stage IDs must be unique');
insist(status.stages.length === 12, 'S0..S11 must all remain planned');
for (let i=0; i<12; i++) insist(status.stages.some(s=>s.id===`S${i}`), `Missing stage S${i}`);
insist(status.stages.some(s=>s.id===status.currentStage), 'currentStage absent from roadmap');
insist(statusDoc.includes(status.currentStage), 'Current status document omits current stage');
for (const [k,v] of Object.entries(status.gates)) insist(statuses.has(v), `Unknown gate state ${k}: ${v}`);
for (const st of status.stages) insist(statuses.has(st.status), `Unknown stage state ${st.id}: ${st.status}`);
insist(Array.isArray(coverage.games) && coverage.games.length === status.coverage.plannedGames, 'Frozen Gxx coverage total drift');
insist(status.coverage.plannedGames === 32, 'Original 32-game baseline must remain frozen (add G33+ with new registry version)');
const codes = coverage.games.map(x => x.id);
for(let i=1;i<=32;i++) insist(codes.includes(`G${String(i).padStart(2,'0')}`),`Frozen game G${i} missing`);
insist(new Set(codes).size === 32, 'Duplicate or unexpected game IDs in frozen baseline');
const markedVerified = coverage.games.filter(x => x.status==='verified');
insist(status.coverage.verifiedGames === markedVerified.length, 'Verified game count not backed by coverage records');
insist(status.coverage.verifiedGames <= status.coverage.plannedGames,'Verified coverage count exceeds frozen denominator');
insist(status.coverage.referenceDemoGames === actualGameCount, 'Reference JSON game count differs from project status');
insist(status.coverage.referenceCapabilityManifests === actualCapCount, 'Capability manifest count differs from project status');
for(let i=1;i<=5;i++) insist(plan.includes(`H0${i}`), `Missing hybrid test H0${i}`);
for(const token of ['IMU','Touch','CocosAirJS','Three.js','G0','G1','G2','G3','Agent','32','S11']) {
  insist(plan.includes(token), `Plan omits required theme: ${token}`);
}
for(const [gate, receipt] of [
  ['G2CocosAirJSRealSDK','reports/g2-cocosairjs-real.json'],
  ['G2ThreeJSRealSDK','reports/g2-threejs-real.json']
]) if(status.gates[gate]==='PASS') {
  try {
    const pointer=read(receipt),evidence=read(pointer.receipt);
    const backend=gate==='G2CocosAirJSRealSDK'?'air':'three';
    insist(pointer.status==='PASS'&&evidence.status==='PASS'&&pointer.runId===evidence.runId,`${gate}: receipt is not PASS for the active run`);
    insist(evidence.backend===backend&&evidence.format==='a2game-g2-real-sdk',`${gate}: wrong SDK receipt`);
    insist(evidence.physicalClose?.status==='PASS'&&evidence.fingerprintsUnchanged===true,`${gate}: incomplete shutdown or concurrent edit`);
    insist(evidence.cases?.length===8&&evidence.cases.every(item=>item.status==='PASS'),`${gate}: four games x two viewport/DPR profiles must pass`);
    insist(evidence.nativeContext?.status==='PASS',`${gate}: native clock/context-loss check missing`);
    insist(evidence.crossEngineParity?.length===8&&evidence.crossEngineParity.every(item=>item.status==='PASS'),`${gate}: cross-engine hashes must pass`);
    const sdk=read(evidence.sdk),lock=read('project/sdk-lock.json');
    insist(sdk.three.version===lock.three.version&&sdk.cocosairjs.commit===lock.cocosairjs.commit,`${gate}: SDK source differs from lock`);
    for(const [path,digest] of Object.entries(read(evidence.fingerprints))){
      const file=resolve(root,canonicalSpecPath(path));
      insist(file.startsWith(root+sep)&&/^[a-f0-9]{64}$/.test(digest),`${gate}: invalid fingerprint ${path}`);
      // dist is rebuilt after the governance step on a clean checkout.
      if(existsSync(file))insist(sourceMatches(root,path,digest),`${gate}: stale evidence for ${path}; rerun real G2 or reset the gate`);
      else insist(path.startsWith('dist/'),`${gate}: missing fingerprinted source ${path}`);
    }
    for(const item of evidence.cases){
      for(const key of ['initial','keyboard','pointer','restart'])insist(
        item[key]?.node?.exactHash===item[key]?.observation?.exactHash&&item[key]?.node?.tickIndex===item[key]?.observation?.tickIndex,
        `${gate}: Node/Host proof missing for ${item.id}/${key}`);
      for(const visual of [item.visual,item.resized])insist(visual?.checks?.length>0&&existsSync(resolve(root,visual.screenshot)),`${gate}: screenshot/pixel proof missing for ${item.id}`);
    }
  }catch(error){insist(false,`${gate}: cannot verify receipt: ${error.message}`);}
}
if(status.gates.G0BrowserDynamicJson==='PASS'){
  try{
    const evidence=read(status.contentRun.summary);
    insist(evidence.format==='a2game-content-admission-browser'&&evidence.status==='PASS'&&evidence.profile===status.contentRun.profile,'Dynamic JSON gate requires a PASS real-browser receipt for the declared profile');
    insist(evidence.unchanged&&evidence.physicalClose==='PASS'&&evidence.nodeThreeAirParity,'Dynamic JSON evidence must close cleanly with matching Node/Host hashes');
    insist(evidence.cases.length===2&&new Set(evidence.cases.map(item=>item.backend)).size===2,'Dynamic JSON must run in both real SDKs');
    for(const item of evidence.cases){
      const result=read(item.receipt);
      insist(item.status==='PASS'&&result.status==='PASS'&&existsSync(resolve(root,item.screenshot)),`Missing content import proof: ${item.backend}`);
      insist(result.final.exactHash===result.node.exactHash&&result.release.receipt.sha256Jcs===evidence.sha256Jcs,`Content/hash proof differs: ${item.backend}`);
      insist(result.rejections.some(row=>row.code==='A2G_E_SCHEMA')&&result.rejections.some(row=>row.code==='A2G_E_CAP_UNKNOWN'),`Missing content rejection proof: ${item.backend}`);
      if(status.contentRun.persistentRestart==='PASS')insist(evidence.persistentRestart&&result.persistentRestart?.status==='PASS'&&result.persistentRestart.previousPid!==result.persistentRestart.pid&&result.persistentRestart.receiptUnchanged&&result.persistentRestart.inputAfterRestart==='PASS',`Missing persistent restart proof: ${item.backend}`);
      if(status.contentRun.trustedAssets==='PASS'){const assets=Object.values(result.release.definition.assets);insist(assets.length>0&&result.resources?.ownedResources===assets.length&&result.resources.decodedImages===assets.filter(a=>a.type==='image').length&&result.resourceRelease?.ownedResources===0&&result.resourceRelease.disposed&&result.bundleTransfer?.status==='PASS'&&result.bundleTransfer.resources===assets.length,`Missing approved assets/bundle/lifecycle proof: ${item.backend}`);}
    }
    for(const [path,digest] of Object.entries(read(evidence.fingerprints))){
      const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&/^[a-f0-9]{64}$/.test(digest),`Invalid content fingerprint ${path}`);
      if(existsSync(file))insist(sourceMatches(root,path,digest),`Stale dynamic content evidence for ${path}`);
      else insist(path.startsWith('dist/'),`Missing content source ${path}`);
    }
  }catch(error){insist(false,`Cannot verify dynamic JSON gate: ${error.message}`);}
}
if(status.zeroGapGoal?.status==='PASS_REFERENCE'){
 const contract=read('project/gameplay-acceptance.json'),profiles=read('project/input-gameplay-profiles.json');
 insist(status.zeroGapGoal.target===0&&status.zeroGapGoal.remaining===0&&contract.cases.every(c=>c.remainingGameplay.length===0),'Gameplay zero goal: unresolved required mechanics');
 insist(status.perGameRun.status==='PASS_REFERENCE'&&Object.keys(profiles.profiles).length===8&&Object.entries(profiles.profiles).every(([id,p])=>contract.cases.find(c=>c.id===id)?.nativeInputProfile===p),'Gameplay zero goal: missing current per-game/input evidence');
}
if(failures.length){console.error('A2Game project governance FAIL:');for(const x of failures) console.error(' -',x);process.exit(1);}
if(status.stages.find(stage=>stage.id==='S4')?.status==='PASS'){
  for(const projection of ['perspective','orthographic']){
    const summary=read(status.visualStageRun[projection]);
    insist(summary.status==='PASS'&&summary.visualStage&&summary.projection===projection&&summary.unchanged&&summary.physicalClose==='PASS',`S4: missing real ${projection} stage evidence`);
    insist(summary.cases?.length===2&&['three','air'].every(backend=>summary.cases.some(row=>row.backend===backend)),`S4: both real SDKs required for ${projection}`);
    for(const row of summary.cases){const result=read(row.receipt);insist(result.visualStage?.status==='PASS'&&result.contextLoss?.status==='PASS'&&result.contextLoss.actualHash===result.contextLoss.expectedHash&&result.stageRelease?.ownedMeshes===0&&result.stageRelease.audio?.ownedSources===0&&result.audio.native.some(clock=>clock.state==='running'&&clock.time>0&&clock.starts>0),`S4: incomplete visual/audio/lifecycle proof for ${projection}/${row.backend}`);}
    for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S4: stale fingerprint ${path}`);}
  }
}
if(status.stages.find(stage=>stage.id==='S5')?.status==='PASS'){
  try{
    const summary=read(status.puzzleRun.summary);
    insist(summary.format==='a2game-puzzle-library-real-sdk'&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS','S5: missing current real SDK puzzle proof');
    insist(summary.cases?.length===24&&summary.parity?.length===12&&summary.parity.every(row=>row.status==='PASS'),'S5: all twelve mechanisms require dual Host parity');
    for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.final?.exactHash===result.node?.exactHash&&result.restart==='PASS'&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.initialScreenshot))&&existsSync(resolve(root,result.screenshot)),`S5: incomplete input/hash/visual/lifecycle proof for ${row.receipt}`);}
    for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S5: stale fingerprint ${path}`);}
  }catch(error){insist(false,`S5: cannot verify puzzle evidence: ${error.message}`);}
}
for(const [stage,suite] of [['S6','realtime'],['S7','strategy']])if(status.stages.find(row=>row.id===stage)?.status==='PASS'){
  try{
    const summary=read(status.mechanismRuns[suite].summary),recipes=read(`project/${suite}-reference-cases.json`).cases;
    insist(summary.format==='a2game-mechanism-real-sdk'&&summary.suite===suite&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS',`${stage}: missing real SDK mechanism proof`);
    insist(summary.cases?.length===recipes.length*2&&summary.parity?.length===recipes.length&&summary.parity.every(row=>row.status==='PASS'),`${stage}: incomplete dual SDK cases`);
    for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.final?.exactHash===result.node?.exactHash&&result.restart==='PASS'&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.initialScreenshot))&&existsSync(resolve(root,result.screenshot)),`${stage}: incomplete ${row.receipt}`);}
    for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`${stage}: stale fingerprint ${path}`);}
  }catch(error){insist(false,`${stage}: cannot verify mechanism evidence: ${error.message}`);}
}
for(const name of readdirSync(resolve(root,'specs/v0.1/adapters')).filter(n=>n.endsWith('.adapter.json'))){
  const adapter=read('specs/v0.1/adapters/'+name);if(adapter.status!=='verified')continue;
  try{const entry=read('project/adapter-evidence.json').adapters.find(e=>e.adapterId===adapter.adapterId);insist(entry?.status==='PASS_REFERENCE'&&entry.receipts?.length>0,`Adapter ${adapter.adapterId}: current reference receipts required`);
    if(adapter.adapterId==='a2game-public-turn-room')insist(status.compatibilityRun?.status==='PASS_REFERENCE'&&entry.receipts.includes(status.compatibilityRun.browser),'Room adapter must link current native SDK extension evidence');
    else if(['threejs-a2game','cocosairjs-a2game'].includes(adapter.adapterId)){const gate=adapter.adapterId==='threejs-a2game'?'G2ThreeJSRealSDK':'G2CocosAirJSRealSDK';insist(status.gates[gate]==='PASS'&&status.stages.find(s=>s.id==='S4')?.status==='PASS'&&status.candidateRun?.status==='PASS_REFERENCE'&&entry.receipts.includes(status.visualStageRun.perspective)&&entry.receipts.includes(status.visualStageRun.orthographic)&&entry.receipts.includes(status.candidateRun.summary),`Adapter ${adapter.adapterId}: current G2/Stage/bound visual receipts required`);}
    else insist(false,`Adapter ${adapter.adapterId}: add a reviewed verification gate binding before claiming verified`);
    for(const receipt of entry?.receipts??[])insist(read(receipt).status==='PASS',`Adapter ${adapter.adapterId}: failed reference ${receipt}`);
  }catch(error){insist(false,`Adapter ${adapter.adapterId}: evidence unavailable: ${error.message}`);}
}
if(status.compatibilityRun?.status==='PASS_REFERENCE'){
  try{
    const summary=read(status.compatibilityRun.browser),matrix=read(status.compatibilityRun.matrix),performance=read(status.compatibilityRun.performance),profiles=read('project/extension-profiles.json');
    insist(summary.format==='a2game-compatibility-real-sdk'&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS'&&summary.parity&&summary.cases?.length===3,'S11: incomplete native SDK extension proof');
    for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS',`S11: failed extension ${row.receipt}`);if(row.kind==='public-turn-room')insist(result.final?.observation?.exactHash===result.node?.exactHash&&result.reconnect==='PASS'&&result.crossOrigin==='PASS'&&result.disposal?.length===2&&result.disposal.every(d=>d.disposed&&d.listenersActive===false&&d.adapter?.disposed&&(d.adapter.ownedMeshes??d.adapter.ownedNodes)===0)&&result.screenshots.every(p=>existsSync(resolve(root,p))),`S11: incomplete authoritative room ${row.receipt}`);else insist(result.replay==='PASS'&&result.save?.finalHash===result.final?.exactHash&&result.disposal?.gamepad?.disposed&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.screenshot)),`S11: incomplete Gamepad/save ${row.receipt}`);}
    insist(matrix.format==='a2game-node-compatibility-matrix'&&matrix.status==='PASS'&&matrix.unchanged&&matrix.runs?.length>=2&&new Set(matrix.runs.map(r=>r.version.split('.')[0])).size>=2&&matrix.runs.every(r=>r.status==='PASS'&&r.pass===r.total&&existsSync(resolve(root,r.log))),'S11: missing multi-major regression');
    insist(performance.format==='a2game-performance-profile'&&performance.status==='MEASURED'&&performance.workload?.bodies===128&&performance.workload?.measuredTicks>=120&&Object.values(performance.milliseconds??{}).every(n=>Number.isFinite(n)&&n>=0),'S11: missing bounded performance measurement');
    for(const receipts of [read(summary.fingerprints),matrix.fingerprints,performance.fingerprints])for(const [path,digest] of Object.entries(receipts)){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S11: stale source ${path}`);}
    insist(profiles.profiles?.length===3&&profiles.profiles.every(p=>p.status==='PASS_REFERENCE')&&['NOT_RUN','UNVERIFIED_AFTER_PUSH'].includes(status.compatibilityRun.remoteCI),'S11: extension profile scope or remote CI evidence differs');
  }catch(error){insist(false,`S11: cannot verify compatibility evidence: ${error.message}`);}
}
if(status.agentWorkflowRun?.status==='PASS_REFERENCE'){
  try{
    const workflow=read(status.agentWorkflowRun.workflow),browser=read(status.agentWorkflowRun.browser);
    insist(workflow.format==='a2game-agent-workflow'&&workflow.status==='PASS_REFERENCE'&&workflow.G3==='NOT_RUN'&&workflow.attempts.some(a=>a.status==='PASS'),'S10: missing admitted/solved generation workflow');
    for(const [path,digest] of Object.entries(workflow.toolchain??{}))insist(createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')===digest,`S10: stale workflow tool ${path}`);
    insist(browser.format==='a2game-agent-browser'&&browser.status==='PASS'&&browser.unchanged&&browser.physicalClose==='PASS'&&browser.parity&&browser.cases?.length===2,'S10: incomplete real SDK debugger proof');
    for(const row of browser.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.final?.exactHash===result.node?.exactHash&&result.rewind==='PASS'&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.screenshot))&&existsSync(resolve(root,result.mobileScreenshot)),`S10: incomplete debugger lifecycle ${row.receipt}`);}
    for(const [path,digest] of Object.entries(read(browser.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S10: stale browser source ${path}`);}
    if(workflow.provenance?.kind==='fixture')insist(status.gates.G3GameplayAgent!=='PASS','Fixture generation cannot satisfy G3');
  }catch(error){insist(false,`S10: cannot verify workflow evidence: ${error.message}`);}
}
if(status.candidateRun?.status==='PASS_REFERENCE'){
  try{
    const summary=read(status.candidateRun.summary),recipes=read('project/game-candidates.json').cases;
    insist(recipes.length===37&&recipes.filter(r=>/^G\d\d$/.test(r.id)).length===32&&recipes.filter(r=>/^H\d\d$/.test(r.id)).length===5&&new Set(recipes.map(r=>r.id)).size===37,'S9: frozen Gxx/Hxx candidate inventory differs');
    insist(summary.format==='a2game-candidates-real-sdk'&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS'&&summary.batchSize<=16,'S9: incomplete real SDK receipt');
    insist(summary.cases?.length===74&&summary.parity?.length===37&&summary.parity.every(r=>r.status==='PASS'),'S9: every candidate needs both SDKs and parity');
    for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.final?.exactHash===result.node?.exactHash&&result.negative?.exactHash===result.negativeNode?.exactHash&&result.restart==='PASS'&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.screenshot))&&existsSync(resolve(root,result.negativeScreenshot)),`S9: incomplete positive/negative/lifecycle ${row.receipt}`);}
    for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S9: stale fingerprint ${path}`);}
  }catch(error){insist(false,`S9: cannot verify candidate evidence: ${error.message}`);}
}
if(status.mobileInputRun?.status==='PASS_REFERENCE'){
  try{
    const summary=read(status.mobileInputRun.summary);
    insist(summary.format==='a2game-mobile-input-real-sdk'&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS'&&summary.physicalDevice==='NOT_RUN','S8 reference: incomplete real SDK/virtual input receipt');
    insist(summary.cases?.length===2&&new Set(summary.cases.map(row=>row.backend)).size===2,'S8 reference: both real SDKs required');
    for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.permissionDenied?.diagnostics?.enabled===false&&result.final?.exactHash===result.replay?.finalHash&&result.final?.exactHash===result.browserReplay?.finalHash&&result.disposal?.mobile?.listenersActive===false&&result.disposal?.recording?.count===0&&existsSync(resolve(root,row.trace))&&existsSync(resolve(root,row.screenshot)),`S8 reference: missing permission/trace/lifecycle evidence for ${row.backend}`);}
    for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`S8 reference: stale fingerprint ${path}`);}
  }catch(error){insist(false,`Cannot verify mobile input reference: ${error.message}`);}
}
if(status.stages.find(row=>row.id==='S8')?.status==='PASS')insist(status.gates.RealDeviceTouchIMU==='PASS'&&status.mobileDeviceRun?.status==='PASS'&&existsSync(resolve(root,status.mobileDeviceRun?.receipt??'')),'S8 requires separate physical Touch/IMU and permission evidence; virtual browser inputs cannot complete this stage');
if(status.variantsRun?.status==='PASS_REFERENCE'){
 try{
  const summary=read(status.variantsRun.summary),recipes=read('project/rule-variants.json').cases;
  insist(summary.format==='a2game-rule-variants-real-sdk'&&summary.status==='PASS'&&summary.unchanged&&summary.physicalClose==='PASS','Variants: missing current real SDK receipt');
  insist(recipes.length===37&&new Set(recipes.map(r=>r.name)).size===37&&new Set(recipes.map(r=>r.id)).size===37&&read('project/game-candidates.json').cases.every(r=>recipes.some(v=>v.id===r.id))&&summary.cases.length===recipes.length*2&&summary.parity.length===recipes.length&&summary.parity.every(r=>r.status==='PASS'),'Variants: incomplete authored positive/negative matrix');
  for(const row of summary.cases){const result=read(row.receipt);insist(result.status==='PASS'&&result.final?.exactHash===result.node?.exactHash&&result.negative?.exactHash===result.negativeNode?.exactHash&&result.restart==='PASS'&&result.disposal?.listenersActive===false&&result.disposal?.resources?.ownedResources===0&&existsSync(resolve(root,result.screenshot))&&existsSync(resolve(root,result.negativeScreenshot)),`Variants: incomplete ${row.receipt}`);}
  for(const [path,digest] of Object.entries(read(summary.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`Variants: stale fingerprint ${path}`);}
 }catch(error){insist(false,`Variants: cannot verify evidence: ${error.message}`);}
}
if(status.perGameRun?.status==='PASS_REFERENCE'){
 try{
  const contract=read(status.perGameRun.contract),headless=read(status.perGameRun.headless),candidates=read(status.candidateRun.summary),variants=read(status.variantsRun.summary);
  insist(contract.cases.length===37&&new Set(contract.cases.map(c=>c.id)).size===37&&read('project/game-candidates.json').cases.every(r=>contract.cases.some(c=>c.id===r.id)),'Per-game: missing frozen game/hybrid');
  const expectedScenarios=contract.cases.reduce((sum,c)=>sum+5+(c.additionalScenarios??[]).length,0);
  insist(headless.status==='PASS'&&headless.unchanged&&headless.cases.length===37&&headless.scenarioCount===expectedScenarios,'Per-game: incomplete focused headless evidence');
  for(const c of contract.cases)if(c.additionalScenarios?.length){const suite=read('specs/v0.1/tests/'+c.id.toLowerCase()+'-candidate.conformance.json');insist(c.additionalScenarios.every(s=>suite.cases.some(r=>r.id==='PER-GAME-'+c.id+'-'+s.name.toUpperCase())),`Per-game: missing supplementary Conformance ${c.id}`);}
  insist(status.candidateRun.status==='PASS_REFERENCE'&&status.variantsRun.status==='PASS_REFERENCE'&&candidates.cases.length===74&&variants.cases.length===74,'Per-game: current base and authored variant SDK receipts required');
  for(const row of candidates.cases){const receipt=read(row.receipt);insist(receipt.boundary?.exactHash===receipt.boundaryNode?.exactHash&&receipt.boundaryCheckpoints?.length>0&&receipt.visual?.status==='PASS'&&existsSync(resolve(root,receipt.visual.canvas))&&existsSync(resolve(root,receipt.mobileScreenshot))&&existsSync(resolve(root,receipt.boundaryScreenshot)),`Per-game: missing boundary/visual/mobile evidence ${row.id}/${row.backend}`);}
  for(const row of candidates.cases){
   const receipt=read(row.receipt),field={G18:'wallInteraction',G20:'bankShot',G22:'farmSave',H05:'hiddenObjectInteraction'}[row.id];
   if(field){const proof=receipt[field];insist(proof?.status==='PASS'&&existsSync(resolve(root,proof?.screenshot??'')),`Per-game: missing native gameplay proof ${row.id}/${row.backend}`);}
   const nativeProfile=contract.cases.find(c=>c.id===row.id).nativeInputProfile;if(nativeProfile)insist(receipt.nativeInput?.status==='PASS'&&receipt.nativeInput.profile===nativeProfile&&receipt.nativeInput.checkpoints?.length>=2&&receipt.nativeInput.checkpoints.every(p=>p.state?.exactHash===p.node?.exactHash&&p.operations?.length>0)&&existsSync(resolve(root,receipt.nativeInput?.screenshot??''))&&receipt.disposal?.mobile?.listenersActive===false,`Per-game: missing native fixture/Node/lifecycle proof ${row.id}/${row.backend}`);
   if(row.id==='G22')insist(receipt.farmSave?.saved?.finalHash===receipt.farmSave?.loaded?.hash&&receipt.farmSave?.loaded?.revisionRejection==='A2G_E_SAVE_COMPATIBILITY',`Per-game: missing persisted farm save/revision check ${row.backend}`);
   if(row.id==='H05')insist(receipt.hiddenObjectInteraction?.resources?.decodedImages===2&&receipt.disposal?.resources?.ownedResources===0,`Per-game: missing hidden-object assets/lifecycle ${row.backend}`);
  }
  for(const row of candidates.cases){const receipt=read(row.receipt),required=contract.cases.find(c=>c.id===row.id).additionalScenarios??[],actual=receipt.additionalScenarios??[];insist(actual.length===required.length&&required.every(c=>actual.some(r=>r.name===c.name&&r.state?.exactHash===r.node?.exactHash&&r.terminalInput==='A2G_E_FLOW'&&r.terminalFreeze==='PASS'&&existsSync(resolve(root,r.screenshot)))),`Per-game: missing additional SDK scenarios ${row.id}/${row.backend}`);}
  for(const row of variants.cases){const receipt=read(row.receipt),profile=contract.cases.find(c=>c.id===row.id).nativeInputProfile;if(profile)insist(receipt.nativeInput?.status==='PASS'&&receipt.nativeInput.profile===profile&&receipt.nativeInput.checkpoints?.length>=2&&receipt.nativeInput.checkpoints.every(p=>p.state?.exactHash===p.node?.exactHash)&&existsSync(resolve(root,receipt.nativeInput?.screenshot??'')),`Per-game: missing authored variant native fixture ${row.id}/${row.backend}`); }
  for(const row of headless.cases){const receipt=read(row.receipt),names=['positive','negative','boundary','variant-positive','variant-negative',...(contract.cases.find(c=>c.id===row.id).additionalScenarios??[]).map(c=>c.name)];insist(receipt.status==='PASS'&&receipt.scenarios.length===names.length&&names.every(name=>receipt.scenarios.some(s=>s.name===name))&&receipt.scenarios.every(s=>s.status==='PASS'&&s.snapshotRestore==='PASS'&&s.restartReplay==='PASS'),`Per-game: missing logical replay ${row.id}`);}
  for(const [path,digest] of Object.entries(read(headless.fingerprints))){const file=resolve(root,canonicalSpecPath(path));insist(file.startsWith(root+sep)&&(!existsSync(file)?path.startsWith('dist/'):sourceMatches(root,path,digest)),`Per-game: stale headless source ${path}`);}
  insist(contract.verifiedGames===0&&contract.verifiedHybrids===0&&contract.cases.every(c=>c.verified===false&&c.independentG3==='NOT_RUN'&&c.fullAcceptance==='PARTIAL'),'Per-game: focused authored checks cannot promote full DoD/G3');
 }catch(error){insist(false,`Per-game: invalid evidence: ${error.message}`);}
}
if(status.qualityRun?.status==='PASS_REFERENCE'){
 try{
  const quality=read(status.qualityRun.summary),browser=read(quality.browser),production=read(quality.production);
  insist(quality.status==='PASS_REFERENCE'&&quality.reviewedGames===37&&quality.humanApproval==='NOT_RUN'&&quality.independentG3==='NOT_RUN'&&quality.physical==='DEFERRED_BY_USER','P0: AI quality review cannot promote human/G3/device approval');
  insist(browser.status==='PASS'&&browser.cases.length===74&&quality.reviews?.length===37&&new Set(quality.reviews.map(c=>c.id)).size===37,'P0: incomplete per-game quality review');
  for(const row of browser.cases){const r=read(row.receipt);insist(r.quality?.status==='PASS_REFERENCE'&&r.quality.viewports?.length===3&&[1100,390,320].every(w=>r.quality.viewports.some(v=>v.width===w&&v.noHorizontalOverflow&&existsSync(resolve(root,v.screenshot))))&&r.retryAfterNegative==='PASS'&&r.errors?.length===0&&r.messages?.length===0,`P0: missing layout/retry/console proof ${row.id}/${row.backend}`);}
  insist(production.status==='PASS'&&production.cases?.length===4&&production.cases.every(c=>c.status==='PASS'&&existsSync(resolve(root,c.screenshot))),'P0: G13/H03 production-clock evidence required');
  for(const fp of [read(browser.fingerprints),production.fingerprints])for(const [p,h] of Object.entries(fp))insist(!existsSync(resolve(root,canonicalSpecPath(p)))?p.startsWith('dist/'):sourceMatches(root,p,h),`P0: stale source ${p}`);
 }catch(error){insist(false,`P0: invalid quality evidence: ${error.message}`);}
}
if(status.independentG3Run){
 try{
  const run=status.independentG3Run,tasks=read(run.tasks),plan=read(run.plan),baseline=read('project/acceptance-baseline.json');
  insist(tasks.format==='a2game-g3-tasks'&&tasks.tasks.length===37&&JSON.stringify(tasks.tasks.map(t=>t.id).sort())===JSON.stringify(baseline.ids),'G3: natural-language task identities differ from frozen 32+5');
  insist(plan.format==='a2game-g3-plan'&&plan.tasks.length===37&&plan.G3==='NOT_RUN'&&JSON.stringify(plan.tasks.map(t=>t.id).sort())===JSON.stringify(baseline.ids),'G3: missing 37-task first-variant plan');
  for(const t of plan.tasks)insist(createHash('sha256').update(JSON.stringify(t.prompt)).digest('hex')===t.promptSha256,'G3: prompt digest differs: '+t.id);
  insist(run.status==='NOT_RUN'&&run.independentG3Passed===0&&run.independenceReview==='NOT_RUN'&&run.qualityReview==='NOT_RUN'&&status.gates.G3GameplayAgent!=='PASS','G3: prepared tasks, capability declarations or provider self-report cannot promote formal acceptance');
  if(run.toolingProof){const fixture=read(run.toolingProof),browser=read(fixture.browser);insist(fixture.format==='a2game-g3-fixture'&&fixture.status==='PASS_REFERENCE'&&fixture.G3==='NOT_RUN'&&fixture.provenance.kind==='fixture'&&fixture.independentG3Passed===0,'G3: synthetic proof must stay a fixture');insist(browser.format==='a2game-g3-browser'&&browser.status==='PASS'&&browser.parity&&browser.unchanged&&browser.closed&&browser.cases.length===2&&browser.cases.every(c=>c.status==='PASS'),'G3: missing real SDK generalized replay evidence');verifySources(root,read(browser.fingerprints));}
 }catch(error){insist(false,`G3: invalid preparation evidence: ${error.message}`);}
}
if(status.finalAcceptanceRun?.archiveStatus==='PASS'){
 try{const index=read('project/final-acceptance.json'),archive=validateArchive(index,root);insist(status.finalAcceptanceRun.status==='PARTIAL'&&status.finalAcceptanceRun.summary===index.summary&&archive.packets.length===37&&archive.pending.humanQuality===37&&archive.pending.independentG3===37&&archive.pending.physical===10,'P2: archive readiness or external gate scope differs');}
 catch(error){insist(false,`P2: invalid formal acceptance archive: ${error.message}`);}
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`A2Game project governance PASS — release ${pkg.version}, protocol ${status.release.gameSpecVersion}, current ${status.currentStage}, frozen games ${codes.length}, reference demos ${actualGameCount}, capability manifests ${actualCapCount}`);
console.log(`Real G2: CocosAirJS ${status.gates.G2CocosAirJSRealSDK}; Three.js ${status.gates.G2ThreeJSRealSDK}; G3 ${status.gates.G3GameplayAgent}`);
