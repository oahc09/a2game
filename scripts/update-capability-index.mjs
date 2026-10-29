import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {makeRegistry} from './registry.mjs';
const root=resolve(import.meta.dirname,'..'),directory=resolve(root,'specs/v0.1/capabilities');
const ids=readdirSync(directory).filter(file=>file.endsWith('.capability.json')).sort().map(file=>{
  const manifest=JSON.parse(readFileSync(resolve(directory,file),'utf8'));if(file!==manifest.id+'.capability.json')throw Error('Capability filename/ID mismatch');return manifest.id;
});
writeFileSync(resolve(root,'player/capability-index.json'),JSON.stringify(ids,null,2)+'\n');
const registry=makeRegistry(),manifests=registry.list();assert.deepEqual(manifests.map(m=>m.id).sort(),[...ids].sort());
const cases=new Map(),testDirectory=resolve(root,'specs/v0.1/tests'),specPath='specs/v0.1/docs/04-Conformance-Test-V0.1.md',specification=readFileSync(resolve(root,specPath),'utf8');
for(const name of readdirSync(testDirectory).filter(n=>n.endsWith('.conformance.json'))){const suite=JSON.parse(readFileSync(resolve(testDirectory,name)));for(const c of suite.cases){if(!cases.has(c.id))cases.set(c.id,[]);cases.get(c.id).push({file:'specs/v0.1/tests/'+name,suiteId:suite.suiteId});}}
const capabilities=manifests.map(m=>({id:m.id,version:m.version,kind:m.kind,manifest:'specs/v0.1/capabilities/'+m.id+'.capability.json',implementation:{role:registry.implementation(m).role,bound:true},dependencies:registry.negotiate({all:[{id:m.id,version:m.version}]}).capabilities,testDeclarations:m.testSuites.map(id=>({id,executableCases:cases.get(id)??[],specification:specification.includes('`'+id+'`')?specPath:null,status:cases.has(id)?'EXECUTABLE_CASE_REFERENCE':specification.includes('`'+id+'`')?'SPECIFICATION_REFERENCE':'UNRESOLVED_DECLARATION'})),formalVerification:'NOT_SIGNED_OFF'}));
writeFileSync(resolve(root,'project/capability-bindings.json'),JSON.stringify({format:'a2game-capability-bindings',version:1,specVersion:'0.1.0',count:capabilities.length,scope:'Current trusted bindings and test declarations; references are not per-capability execution receipts or formal platform approval.',capabilities},null,2)+'\n');
console.log(`Indexed ${ids.length} trusted capability manifests.`);
