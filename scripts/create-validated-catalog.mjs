/** Run ONLY after scripts/preflight.py passes; hashes artifacts using actual JS JCS implementation. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {sha256Canonical} from '../dist/index.js';
const root=resolve(import.meta.dirname,'..');
const receipt=JSON.parse(readFileSync(resolve(root,'reports/schema-preflight.json')));
if(receipt.status!=='PASS') throw Error('Full schema preflight must pass');
const dir=resolve(root,'A2Game-V0.1-Spec/samples/games');
const games={};
for(const name of readdirSync(dir).filter(x=>x.endsWith('.game.json')).sort()){
 const content=JSON.parse(readFileSync(resolve(dir,name)));
 games[`/A2Game-V0.1-Spec/samples/games/${name}`]={id:content.id,revision:content.revision,sha256Jcs:sha256Canonical(content)};
}
const manifest={format:'a2game-validated-game-catalog',formatVersion:1,gameSpecVersion:'0.1.0',schemaDialect:'2020-12',content:games};
mkdirSync(resolve(root,'player'),{recursive:true});
writeFileSync(resolve(root,'player/validated-games.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Validated game catalog created (${Object.keys(games).length} entries)`);
