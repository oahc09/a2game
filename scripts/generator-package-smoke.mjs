/** Rehydrate a content package in a new source-only host, then use its real SDKs over HTTP. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync,mkdtempSync,existsSync} from 'node:fs';
import {join,dirname,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {requirePython} from './python-runtime.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),directory=join(root,'reports/generator-package-'+randomUUID());mkdirSync(directory,{recursive:true});
const host=mkdtempSync(join(tmpdir(),'a2game-package-host-')),hash=b=>createHash('sha256').update(b).digest('hex');
const receipt={format:'a2game-generator-package-smoke',version:1,status:'FAIL',host,modelCalls:0,G3:'NOT_RUN',humanReview:'NOT_RUN',sourceFiles:{},steps:[],cases:[]};
const save=(name,v)=>writeFileSync(join(directory,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const excluded=new Set(['vendor','reports','node_modules','dist','.git','output','.a2game','__pycache__']);
function copy(source,target){const stat=lstatSync(source);if(stat.isSymbolicLink())throw Error('Symbolic source rejected');if(stat.isDirectory()){mkdirSync(target,{recursive:true});for(const name of readdirSync(source).sort())if(!excluded.has(name)&&!name.endsWith('.pyc'))copy(join(source,name),join(target,name));}else if(stat.isFile()){mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);receipt.sourceFiles[relative(root,source).replaceAll('\\','/')]=hash(readFileSync(source));}}
let browser;
try{
 const python=requirePython(undefined,{schema:true});
 const source=resolve(process.argv[2]??'');const bytes=readFileSync(source);if(bytes.length>768*1024)throw Error('Package exceeds limit');
 const pack=JSON.parse(bytes),definition=pack.files?.content?.definition,solution=pack.files?.solution;
 if(!definition||!Array.isArray(solution)||solution.some(row=>row.raw?.length||row.action&&(!definition.inputs.actions.some(a=>a.id===row.action&&a.valueType==='button')||row.value!==undefined&&typeof row.value!=='boolean')))throw Error('This independent-host input smoke supports button solutions only; import-package remains generic.');
 receipt.package={path:relative(root,source).replaceAll('\\','/'),sha256:hash(bytes)};copyFileSync(source,join(host,'game-package.json'));
 for(const name of ['src','specs','scripts','generator','integrations','player','assets','package.json','package-lock.json','tsconfig.json','project/sdk-lock.json','project/asset-policy.json'])copy(join(root,name),join(host,name));
 receipt.noHistoricalReports=!existsSync(join(host,'reports'));receipt.freshDependencies=!existsSync(join(host,'node_modules'));assert.ok(receipt.noHistoricalReports&&receipt.freshDependencies);
 const sdk=JSON.parse(readFileSync(join(root,'player/vendor/sdk-provenance.json'),'utf8'));mkdirSync(join(host,'player/vendor'),{recursive:true});
 for(const item of sdk.files){assert.match(item.path,/^player\/vendor\/[\w.-]+\.js$/);assert.equal(hash(readFileSync(join(root,item.path))),item.sha256);copyFileSync(join(root,item.path),join(host,item.path));}
 copyFileSync(join(root,'player/vendor/sdk-provenance.json'),join(host,'player/vendor/sdk-provenance.json'));receipt.sdkPolicy='Exact locked installed SDK bytes copied to independent host; no reports/old releases.';
 const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');assert.ok(existsSync(npm));
 const user=join(host,'.npmrc-smoke-user'),global=join(host,'.npmrc-smoke-global');writeFileSync(user,'');writeFileSync(global,'');
 const env={...process.env,A2GAME_PYTHON:python,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',npm_config_userconfig:user,npm_config_globalconfig:global};
 function step(name,args){const started=performance.now(),result=spawnSync(process.execPath,args,{cwd:host,env,shell:false,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});writeFileSync(join(directory,name+'.stdout.log'),result.stdout??'');writeFileSync(join(directory,name+'.stderr.log'),result.stderr??'');receipt.steps.push({name,status:result.status===0&&!result.error?'PASS':'FAIL',elapsedMs:performance.now()-started});assert.equal(result.status,0,`${name}: ${result.error?.code??''}`);return result.stdout;}
 step('install',[npm,'ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org']);step('build',[npm,'run','build']);
 const output=join(host,'output/imported'),imported=JSON.parse(step('import',['generator/cli.mjs','import-package',join(host,'game-package.json'),'--output',output,'--json']));assert.equal(imported.status,'PASS_REFERENCE');
 assert.deepEqual(JSON.parse(readFileSync(join(output,'game.json'),'utf8')),pack.files.content.definition);receipt.gameUnchanged=true;
 // Import modules from the independently installed/built host, with its own root and asset policy.
 const previous=process.env.A2GAME_PYTHON;process.env.A2GAME_PYTHON=python;
 try{
  const {previewGeneratedDirectory}=await import(pathToFileURL(join(host,'generator/index.mjs')).href);
  const {playSolution}=await import(pathToFileURL(join(host,'scripts/agent-solver.mjs')).href),expected=playSolution(definition,solution);
  browser=await chromium.launch({headless:true});
  for(const backend of ['three','air']){
   const session=await previewGeneratedDirectory(output,{backend});assert.equal(session.status,'READY');const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.goto(session.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
    assert.equal(await page.evaluate(()=>window.__a2game.definition.id),definition.id);assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);const initialHash=await page.evaluate(()=>window.__a2game.getHash());
    for(const [i,row]of solution.entries()){
     if(row.action&&row.value!==false){const controls=page.locator('button[data-action]'),index=await controls.evaluateAll((els,id)=>els.findIndex(e=>e.dataset.action===id),row.action);assert.ok(index>=0);await controls.nth(index).click();}
     await page.evaluate(ticks=>window.__a2game.step(ticks),row.ticks);assert.equal(await page.evaluate(()=>window.__a2game.getHash()),expected.trace[i].hash);
    }
    const won=await page.evaluate(()=>window.__a2game.getState());assert.equal(won.flow.status,'won');
    await page.screenshot({path:join(directory,backend+'-won.png'),fullPage:true});await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getHash()),initialHash);
    await page.evaluate(()=>window.__a2game.dispose());const diagnostics=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(diagnostics.resources.ownedResources,0);assert.equal(diagnostics.listenersActive,false);assert.deepEqual(errors,[]);
    receipt.cases.push({backend,status:'PASS_REFERENCE',hash:won.exactHash,ownedResources:0,screenshot:backend+'-won.png'});
   }finally{await page.close();await session.close();await assert.rejects(fetch(session.url));}
  }
 }finally{if(previous===undefined)delete process.env.A2GAME_PYTHON;else process.env.A2GAME_PYTHON=previous;}
 assert.equal(receipt.cases[0].hash,receipt.cases[1].hash);receipt.status='PASS_REFERENCE';receipt.hostScope='Independent source installation on same machine; Python interpreter reused, approved assets + exact SDK prerequisites explicitly supplied. Not a new physical machine or signed model origin.';
}catch(e){receipt.code=e.code??'A2G_GEN_PACKAGE_SMOKE';receipt.failure=String(e.message);process.exitCode=1;}
finally{await browser?.close();receipt.sourcesUnchanged=Object.entries(receipt.sourceFiles).every(([p,d])=>hash(readFileSync(join(root,p)))===d);if(!receipt.sourcesUnchanged){receipt.status='FAIL';process.exitCode=1;}save('summary.json',receipt);console.log(JSON.stringify({status:receipt.status,code:receipt.code,receipt:relative(root,join(directory,'summary.json')).replaceAll('\\','/'),failure:receipt.failure}));}
