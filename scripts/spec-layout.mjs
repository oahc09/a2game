/** Narrow compatibility for the 2026-10-29 spec directory relocation; never a general stale-source waiver. */
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
export const SPEC_ASSET_DIRS=['capabilities','adapters','games','tests','coverage'];
export const SPEC_LAYOUT_REPLACEMENTS=[
 ['samples/coverage/not-run.receipt.json','examples/coverage/not-run.receipt.json'],
 ['samples/tests/touch-imu.input-trace.json','examples/input-traces/touch-imu.input-trace.json'],
 ...SPEC_ASSET_DIRS.map(d=>['samples/'+d,d]),
 ["'/specs/v0.1/samples/'",SPEC_ASSET_DIRS.concat('examples').map(d=>"'/specs/v0.1/"+d+"/'").join(',')],
 ["'specs/v0.1/samples'",SPEC_ASSET_DIRS.concat('examples').map(d=>"'specs/v0.1/"+d+"'").join(',')],
 ["ROOT/'specs/v0.1'/'samples'","ROOT/'specs/v0.1'"],
 [String.raw`samples\/games`,'games'],
];
export function canonicalSpecPath(path){
 if(path==='specs/v0.1/samples/coverage/not-run.receipt.json')return 'specs/v0.1/examples/coverage/not-run.receipt.json';
 if(path==='specs/v0.1/samples/tests/touch-imu.input-trace.json')return 'specs/v0.1/examples/input-traces/touch-imu.input-trace.json';
 return path.replace(/^specs\/v0\.1\/samples\/(capabilities|adapters|games|tests|coverage)(?=\/|$)/,'specs/v0.1/$1');
}
const digest=b=>createHash('sha256').update(b).digest('hex');
export function sourceMatches(root,path,expected){
 if(typeof path!=='string'||path.includes('\\')||path.includes(':')||path.split('/').some(p=>p==='..'||p==='.')||path.startsWith('/'))return false;
 const file=resolve(root,canonicalSpecPath(path));if(!file.startsWith(resolve(root)+sep)||!existsSync(file))return false;
 if(!realpathSync(file).startsWith(realpathSync(root)+sep))return false;
 const bytes=readFileSync(file),actual=digest(bytes);if(actual===expected)return true;
 const manifestPath=resolve(root,'project/spec-layout-migration.json');if(!existsSync(manifestPath))return false;
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),row=manifest.files?.[path];
 if(manifest.format!=='a2game-spec-layout-migration'||manifest.version!==1||JSON.stringify(manifest.replacements)!==JSON.stringify(SPEC_LAYOUT_REPLACEMENTS)||!row||row.to!==canonicalSpecPath(path)||row.before!==expected||row.after!==actual||!Array.isArray(row.reverseSteps))return false;
 let text=bytes.toString('utf8');
 for(const step of [...row.reverseSteps].reverse()){
  const pair=SPEC_LAYOUT_REPLACEMENTS[step.rule];if(!pair||!Array.isArray(step.offsets))return false;
  const [oldValue,newValue]=pair;let previous=Infinity;
  for(const offset of [...step.offsets].reverse()){
   if(!Number.isSafeInteger(offset)||offset<0||offset>=previous||text.slice(offset,offset+newValue.length)!==newValue)return false;
   text=text.slice(0,offset)+oldValue+text.slice(offset+newValue.length);previous=offset;
  }
 }
 return digest(Buffer.from(text))===expected;
}
/** Reporting tools archived in immutable evidence describe the old audit, not current Runtime source. */
export function evidenceMatches(root,path,expected){
 if(sourceMatches(root,path,expected))return true;
 if(!['scripts/final-acceptance-audit.mjs','scripts/g3-codex-report.mjs'].includes(path))return false;
 const history='project/spec-layout-history/'+path.split('/').at(-1),file=resolve(root,history);
 return existsSync(file)&&realpathSync(file).startsWith(realpathSync(root)+sep)&&digest(readFileSync(file))===expected;
}
