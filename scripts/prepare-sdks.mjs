/** Copy real upstream SDK bytes, verifying versions and recording their provenance. No mocks or network. */
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const lock=json(resolve(root,'project/sdk-lock.json'));
const airRoot=resolve(root,process.env.A2GAME_AIR_ROOT??'.tools/cocosairjs');
const threeRoot=resolve(root,'node_modules/three');
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const git=(...args)=>execFileSync('git',['-C',airRoot,...args],{encoding:'utf8'}).trim();
if(json(resolve(threeRoot,'package.json')).version!==lock.three.version)throw Error('Three.js version differs from project/sdk-lock.json');
if(json(resolve(airRoot,'package.json')).version!==lock.cocosairjs.version||git('rev-parse','HEAD')!==lock.cocosairjs.commit)
  throw Error('CocosAirJS source differs from project/sdk-lock.json');
if(git('status','--porcelain','--','src','package.json','package-lock.json'))throw Error('CocosAirJS source/dependencies have local modifications');

const destination=resolve(root,'player/vendor');mkdirSync(destination,{recursive:true});
const sources=[
  [threeRoot,'build/three.module.js','three.module.js'],
  [threeRoot,'build/three.core.js','three.core.js'],
  [airRoot,lock.cocosairjs.entry,'cocosair.js']
];
const files=sources.map(([base,entry,name])=>{
  const source=resolve(base,entry),target=resolve(destination,name);copyFileSync(source,target);
  return {path:`player/vendor/${name}`,sourceEntry:entry,sha256:sha256(target)};
});
const provenance={format:'a2game-sdk-provenance',preparedAt:new Date().toISOString(),
  three:lock.three,cocosairjs:{...lock.cocosairjs,
    buildDate:readFileSync(resolve(airRoot,lock.cocosairjs.entry),'utf8').match(/const AIR_BUILD_DATE = "(\d+)"/)?.[1]??null,
    buildNumber:Number(readFileSync(resolve(airRoot,lock.cocosairjs.entry),'utf8').match(/const AIR_BUILD_NUMBER = (\d+)/)?.[1]??0),
    sourceTree:'clean; generated SDK build metadata may differ per build'},files};
writeFileSync(resolve(destination,'sdk-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(`Real SDKs prepared: Three.js ${lock.three.version}; CocosAirJS ${lock.cocosairjs.commit}`);
for(const file of files)console.log(`${file.sha256}  ${file.path}`);
