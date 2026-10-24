/** Governance validator: prevents silent release, gate, scope and roadmap drift. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
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
const coverage = read('specs/v0.1/samples/coverage/games.json');
const gameDir = resolve(root, 'specs/v0.1/samples/games');
const capDir = resolve(root, 'specs/v0.1/samples/capabilities');
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
      const file=resolve(root,path);
      insist(file.startsWith(root+sep)&&/^[a-f0-9]{64}$/.test(digest),`${gate}: invalid fingerprint ${path}`);
      // dist is rebuilt after the governance step on a clean checkout.
      if(existsSync(file))insist(createHash('sha256').update(readFileSync(file)).digest('hex')===digest,`${gate}: stale evidence for ${path}; rerun real G2 or reset the gate`);
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
if(failures.length){console.error('A2Game project governance FAIL:');for(const x of failures) console.error(' -',x);process.exit(1);}
console.log(`A2Game project governance PASS — release ${pkg.version}, protocol ${status.release.gameSpecVersion}, current ${status.currentStage}, frozen games ${codes.length}, reference demos ${actualGameCount}, capability manifests ${actualCapCount}`);
console.log(`Real G2: CocosAirJS ${status.gates.G2CocosAirJSRealSDK}; Three.js ${status.gates.G2ThreeJSRealSDK}; G3 ${status.gates.G3GameplayAgent}`);
