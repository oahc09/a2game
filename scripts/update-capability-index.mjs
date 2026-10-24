import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),directory=resolve(root,'specs/v0.1/samples/capabilities');
const ids=readdirSync(directory).filter(file=>file.endsWith('.capability.json')).sort().map(file=>{
  const manifest=JSON.parse(readFileSync(resolve(directory,file),'utf8'));if(file!==manifest.id+'.capability.json')throw Error('Capability filename/ID mismatch');return manifest.id;
});
writeFileSync(resolve(root,'player/capability-index.json'),JSON.stringify(ids,null,2)+'\n');
console.log(`Indexed ${ids.length} trusted capability manifests.`);
