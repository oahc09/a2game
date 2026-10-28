/** Browser-only retry of recorded content; no new generation and no edited game/solution. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './registry.mjs';
import {archivePath,verifySources} from './final-acceptance-audit.mjs';
import {verifyGeneratedBrowser} from './g3-browser.mjs';
const read=p=>JSON.parse(readFileSync(archivePath(root,p),'utf8')),hash=p=>createHash('sha256').update(readFileSync(archivePath(root,p))).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/');
const source=process.argv[2],id=process.argv[3],batch=read(source),old=batch.cases.find(c=>c.id===id),original=old?.attempts.at(-1);assert.ok(original?.browser&&original.validation,'原始回执必须已有生成/准入/浏览器结果。');
assert.equal(read(original.validation).status,'PASS_REFERENCE');const cli=read(original.directory+'/cli.json');assert.equal(cli.status,'PASS');assert.equal(hash(original.directory+'/output.raw.json'),cli.outputSha256);
const prior=read(original.browser);assert.equal(prior.status,'FAIL');verifySources(root,read(prior.fingerprints));
const directory=resolve(root,'reports','g3-browser-retry-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);mkdirSync(directory);
const browser=await verifyGeneratedBrowser(resolve(root,original.validation,'..'),resolve(directory,'browser')),passed=browser.status==='PASS',attempt={...original,status:passed?'PASS_REFERENCE':'FAIL',browser:rel(resolve(directory,'browser/summary.json')),originalBrowser:original.browser,browserOnlyRetry:true};
if(passed){delete attempt.code;delete attempt.attribution;delete attempt.message;}
const summary={...batch,selected:[id],calls:0,originalCalls:1,sourceBatch:source,scope:'Browser-only recheck of SHA-bound original CLI output; zero additional model calls.',revalidationSource:{path:'scripts/g3-browser-retry.mjs',sha256:hash('scripts/g3-browser-retry.mjs')},engineeringPassed:passed?1:0,status:passed?'PARTIAL':'FAIL',cases:[{...old,status:attempt.status,attempts:[...old.attempts.slice(0,-1),attempt]}]};writeFileSync(resolve(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({id,status:attempt.status,newModelCalls:0,summary:rel(resolve(directory,'summary.json'))},null,2));if(!passed)process.exitCode=1;
