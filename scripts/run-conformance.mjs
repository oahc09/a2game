import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { makeRegistry, readJson, root, spec } from './registry.mjs';
import { runConformanceSuite } from '../dist/index.js';
const suites = process.argv.slice(2);
const files = suites.length ? suites.map(s=>resolve(process.cwd(),s)) : readdirSync(resolve(spec,'tests')).filter(s=>s.endsWith('.conformance.json')).map(s=>resolve(spec,'tests',s));
let success=true;
const results=[];
for (const file of files) {
    const suite=readJson(file);
    const subject=resolve(dirname(file), suite.subject.file);
    const rel=relative(spec,subject);
    if (rel==='..' || rel.startsWith('..'+sep) || rel.startsWith(sep)) throw new Error('Conformance subject escapes trusted spec workspace');
    const receipt=await runConformanceSuite(suite,readJson(subject),makeRegistry);
    results.push(receipt);
    console.log(`${receipt.status} ${receipt.suiteId} (${receipt.pass}/${receipt.cases.length})`);
    for (const c of receipt.cases) console.log(`  ${c.status} ${c.id} (${c.assertions} assertions, ${c.advancedTicks} ticks) ${c.error??''}`);
    if (receipt.status!=='PASS') success=false;
}
mkdirSync(resolve(root,'reports'),{recursive:true});
writeFileSync(resolve(root,'reports','conformance.json'),JSON.stringify({generatedAt:new Date().toISOString(),runner:'a2game-headless',status:success?'PASS':'FAIL',suites:results},null,2)+'\n');
if (!success) process.exitCode=1;
