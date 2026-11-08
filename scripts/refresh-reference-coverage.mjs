/** Rebuild bounded reference coverage only from current, independently checked receipts. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry,root} from './registry.mjs';
import {archivePath,verifySources} from './final-acceptance-audit.mjs';
import {resolvePython} from './python-runtime.mjs';

assert.equal(process.argv.length,2,'This command uses only the current project evidence pointers.');
const read=p=>JSON.parse(readFileSync(archivePath(root,p),'utf8'));
const status=read('project/status.json'),contract=read('project/gameplay-acceptance.json');
assert.equal(status.perGameRun.status,'PASS_REFERENCE');
assert.equal(status.currentRun.status,'PASS');
assert.equal(contract.cases.length,37);
assert.equal(new Set(contract.cases.map(c=>c.id)).size,37);
const expectedIds=read('project/acceptance-baseline.json').ids.toSorted();
assert.deepEqual(contract.cases.map(c=>c.id).toSorted(),expectedIds);
const sources={
  candidates:read(status.perGameRun.browser),
  variants:read(status.perGameRun.variants),
  headless:read(status.perGameRun.headless)
};
for(const [kind,summary] of Object.entries(sources)){
  assert.equal(summary.status,'PASS');assert.equal(summary.unchanged,true);
  verifySources(root,read(summary.fingerprints));
  if(kind!=='headless'){
    assert.equal(summary.physicalClose,'PASS');assert.equal(summary.cases.length,74);
    assert.equal(summary.parity.length,37);assert.ok(summary.parity.every(p=>p.status==='PASS'));
    assert.deepEqual(summary.parity.map(p=>p.id).toSorted(),expectedIds);
  }else assert.equal(summary.cases.length,37);
}
assert.equal(read(status.currentRun.conformanceReceipt).status,'PASS');
const indexPath=resolve(root,'project/candidate-evidence.json'),oldBytes=readFileSync(indexPath),oldIndex=JSON.parse(oldBytes);
const directory='reports/reference-coverage-'+randomUUID();mkdirSync(resolve(root,directory));
const saveNew=(path,value)=>writeFileSync(resolve(root,path),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(root,directory,'historical-index.json'),oldBytes,{flag:'wx'});
const cases=[];let nativeCases=0;
for(const entry of contract.cases){
  assert.match(entry.id,/^[GH]\d{2}$/);
  const nodeRow=sources.headless.cases.find(r=>r.id===entry.id);
  assert.equal(nodeRow?.status,'PASS');const node=read(nodeRow.receipt);
  assert.equal(node.status,'PASS');
  const expected=['positive','negative','boundary','variant-positive','variant-negative',
    ...(entry.additionalScenarios??[]).map(s=>s.name)];
  assert.deepEqual(node.scenarios.map(s=>s.name).toSorted(),expected.toSorted());
  assert.ok(node.scenarios.every(s=>s.status==='PASS'&&s.snapshotRestore==='PASS'&&s.restartReplay==='PASS'));
  for(const [kind,gamePath] of [['candidates',entry.game],['variants',entry.variant]]){
    const game=read(gamePath),runtime=new HeadlessRuntime(game,makeRegistry());
    let digest;try{digest=sha256Canonical(runtime.effectiveCapabilities);}finally{runtime.dispose();}
    assert.equal(kind==='candidates'?node.definitionSha256:node.variantSha256,sha256Canonical(game));
    for(const [backend,adapterId] of [['three','threejs-a2game'],['air','cocosairjs-a2game']]){
      const matching=sources[kind].cases.filter(r=>r.id===entry.id&&r.backend===backend);
      assert.equal(matching.length,1);const row=matching[0],result=read(row.receipt);
      assert.equal(row.status,'PASS');assert.equal(result.status,'PASS');
      assert.equal(result.sha256Jcs,sha256Canonical(game));
      assert.match(result.final.exactHash,/^[a-f0-9]{64}$/);
      assert.match(result.negative.exactHash,/^[a-f0-9]{64}$/);
      assert.equal(result.final.exactHash,result.node.exactHash);
      assert.equal(result.negative.exactHash,result.negativeNode.exactHash);
      assert.equal(result.restart,'PASS');assert.equal(result.retryAfterNegative,'PASS');
      assert.equal(result.disposal.adapter.disposed,true);
      assert.equal(result.disposal.listenersActive,false);
      assert.equal(result.disposal.resources.disposed,true);
      assert.equal(result.disposal.resources.ownedResources,0);
      assert.deepEqual(result.errors,[]);assert.deepEqual(result.messages,[]);
      archivePath(root,row.screenshot);
      if(kind==='candidates'){
        assert.match(result.boundary?.exactHash??'',/^[a-f0-9]{64}$/);
        assert.equal(result.boundary.exactHash,result.boundaryNode.exactHash);
      }
      if(entry.nativeInputProfile){
        const input=result.nativeInput;assert.equal(input?.status,'PASS');
        assert.equal(input.profile,entry.nativeInputProfile);
        assert.ok(input.checkpoints.length>=2&&input.checkpoints.every(p=>
          /^[a-f0-9]{64}$/.test(p.state?.exactHash??'')&&p.state.exactHash===p.node?.exactHash));
        archivePath(root,input.screenshot);nativeCases++;
      }
      const path=directory+'/'+kind+'-'+backend+'-'+entry.id+'.receipt.json';
      saveNew(path,{format:'a2game-coverage-result',receiptVersion:'0.1.0',gameId:entry.id,
        testCaseId:entry.id+(kind==='candidates'?'-REFERENCE-BOUNDARY-G2':'-AUTHORED-VARIANT-G2'),
        adapterId,platformProfile:'windows-chromium-desktop-normalized-input-reference',capabilitySetDigest:digest,
        testRevision:'per-game-reference-boundaries-v1',status:'PASS',
        reason:'Bounded reference only; human quality, independent G3 and applicable physical input remain separate.',
        evidence:{runId:sources[kind].runId,eventTraceUri:row.receipt,stateTraceUri:row.receipt,
          screenCaptureUri:row.screenshot,diagnosticsUri:row.receipt}});
      cases.push({id:entry.id,kind,backend,receipt:path});
    }
  }
}
assert.equal(cases.length,148);assert.equal(nativeCases,32);
const python=[
  'import json, pathlib, sys',
  'from jsonschema import Draft202012Validator',
  'root = pathlib.Path.cwd()',
  "schema = json.loads((root / 'specs/v0.1/schemas/coverage-result.schema.json').read_text(encoding='utf-8'))",
  'Draft202012Validator.check_schema(schema)',
  'validator = Draft202012Validator(schema)',
  "files = sorted(pathlib.Path(sys.argv[1]).glob('*.receipt.json'))",
  "errors = [{'file': p.name, 'message': e.message} for p in files for e in validator.iter_errors(json.loads(p.read_text(encoding='utf-8')))]",
  "if len(files) != 148: errors.append({'message': 'Expected 148 bounded reference receipts'})",
  "print(json.dumps({'format':'a2game-reference-coverage-schema-check','status':'FAIL' if errors else 'PASS','documents':len(files),'schema':'specs/v0.1/schemas/coverage-result.schema.json','errors':errors}))",
  'sys.exit(1 if errors else 0)'
].join('\n');
const check=spawnSync(resolvePython(),['-c',python,resolve(root,directory)],{cwd:root,encoding:'utf8',windowsHide:true});
assert.equal(check.status,0,'Coverage Schema validation failed: '+(check.stderr||check.stdout));
const schema=JSON.parse(check.stdout);assert.equal(schema.status,'PASS');assert.equal(schema.documents,148);
const schemaPath=directory+'/schema-check.json';saveNew(schemaPath,schema);
const next={...oldIndex,summary:status.perGameRun.browser,variants:status.perGameRun.variants,
  headless:status.perGameRun.headless,verification:status.currentRun.log,cases,nativeInputCases:nativeCases,
  coverageSchema:schemaPath,historicalIndex:directory+'/historical-index.json',
  qualityScope:'HISTORICAL_REVIEW_PENDING_CURRENT_SOURCE',G3:'NOT_RUN',physical:'NOT_RUN',verifiedGames:0,verifiedHybrids:0};
const temporary=resolve(root,'project/.candidate-evidence-'+randomUUID()+'.tmp');
writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
assert.ok(readFileSync(indexPath).equals(oldBytes),'Coverage index changed while collecting evidence.');
renameSync(temporary,indexPath);
console.log(JSON.stringify({status:'PASS_REFERENCE',directory,coverageReceipts:cases.length,nativeCases,
  schema:schemaPath,humanQuality:'NOT_RUN',G3:'NOT_RUN',physical:'NOT_RUN',modelCalls:0}));
