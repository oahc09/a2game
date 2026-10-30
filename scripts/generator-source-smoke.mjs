/** Source-only local smoke; no historical evidence, copied dependencies or renderer SDK. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync,existsSync,mkdtempSync} from 'node:fs';
import {join,dirname,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'output','generator-source-smoke-'+randomUUID());mkdirSync(output,{recursive:true});
const directory=mkdtempSync(join(tmpdir(),'a2game-generator-source-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={format:'a2game-generator-source-smoke',version:1,status:'FAIL',startedAt:new Date().toISOString(),sourceDirectory:directory,outputDirectory:output,node:process.version,modelCalls:0,fixture:'DEMO_FIXTURE',G3:'NOT_RUN',sourceFiles:{},steps:[],assertions:{}};
const excluded=new Set(['vendor','reports','node_modules','dist','.git','__pycache__','output','.a2game']);
function copy(source,target){
 const stat=lstatSync(source);if(stat.isSymbolicLink())throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_SYMLINK'});
 if(stat.isDirectory()){mkdirSync(target,{recursive:true});for(const entry of readdirSync(source).sort())if(!excluded.has(entry)&&!entry.endsWith('.pyc'))copy(join(source,entry),join(target,entry));}
 else if(stat.isFile()){mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);receipt.sourceFiles[relative(root,source).replaceAll('\\','/')]=hash(readFileSync(target));}
}
try{
 for(const name of ['src','specs','scripts','generator','player','package.json','package-lock.json','tsconfig.json','project/sdk-lock.json','project/asset-policy.json'])copy(join(root,name),join(directory,name));
 receipt.sourceSha256=hash(JSON.stringify(Object.entries(receipt.sourceFiles).sort(([a],[b])=>a.localeCompare(b))));
 for(const name of ['reports','player/vendor','node_modules','dist'])receipt.assertions['notCopied:'+name]=!existsSync(join(directory,name));
 if(Object.values(receipt.assertions).some(value=>!value))throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_NOT_SOURCE_ONLY'});
 const python=process.env.A2GAME_PYTHON??join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
 if(!existsSync(python))throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_PYTHON_REQUIRED'});
 receipt.python={source:'A2GAME_PYTHON or original workspace venv',reused:true};
 const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 if(!existsSync(npm))throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_NPM_REQUIRED'});
 const userConfig=join(directory,'.npmrc-smoke-user'),globalConfig=join(directory,'.npmrc-smoke-global');writeFileSync(userConfig,'');writeFileSync(globalConfig,'');
 const env={...process.env,A2GAME_PYTHON:resolve(python),PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',npm_config_userconfig:userConfig,npm_config_globalconfig:globalConfig};
 function step(name,args,{timeout=120000,json=false}={}){
  const started=performance.now(),result=spawnSync(process.execPath,args,{cwd:directory,env,shell:false,windowsHide:true,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
  writeFileSync(join(output,name+'.stdout.log'),result.stdout??'');writeFileSync(join(output,name+'.stderr.log'),result.stderr??'');
  const entry={name,argv:[process.execPath,...args],exitCode:result.status,elapsedMs:Math.round(performance.now()-started),status:result.status===0&&!result.error?'PASS':'FAIL'};receipt.steps.push(entry);
  if(entry.status!=='PASS')throw Object.assign(Error(),{code:result.error?.code==='ETIMEDOUT'?'A2G_GEN_SMOKE_TIMEOUT':'A2G_GEN_SMOKE_STEP',step:name});
  if(json){const value=JSON.parse(result.stdout);if(value.status!=='PASS_REFERENCE')throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_RESULT',step:name});return value;}
 }
 step('install',[npm,'ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org'],{timeout:180000});
 step('build',[npm,'run','build']);
 const prompt=join(directory,'smoke-prompt.txt'),gameDirectory=join(directory,'output','fixture');writeFileSync(prompt,'DEMO_FIXTURE engineering pipeline smoke.');
 const generated=step('generate',['generator/cli.mjs','generate','--prompt-file',prompt,'--provider','fixture','--max-attempts','1','--output',gameDirectory,'--json'],{json:true});
 if(generated.generationCalls!==0||generated.fixtureCalls!==1||generated.provenance!=='DEMO_FIXTURE')throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_FIXTURE_IDENTITY'});
 step('validate',['generator/cli.mjs','validate',join(gameDirectory,'game.json'),'--json'],{json:true});
 step('test',['generator/cli.mjs','test',gameDirectory,'--json'],{json:true});
 receipt.assertions.noHistoricalReports=!existsSync(join(directory,'reports'));
 receipt.assertions.noRendererSdk=!existsSync(join(directory,'player/vendor'));
 if(!receipt.assertions.noHistoricalReports||!receipt.assertions.noRendererSdk)throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_EXTERNAL_EVIDENCE'});
 receipt.artifacts={gameDirectory,gameSha256:hash(readFileSync(join(gameDirectory,'game.json'))),generationReport:join(gameDirectory,'generation-report.json')};
 receipt.status='PASS_LOCAL';
}catch(e){receipt.code=e.code??'A2G_GEN_SMOKE_FAILURE';if(e.step)receipt.failedStep=e.step;receipt.message='纯源码 Generator 验证未完成；请查看分步日志，补齐 Python、npm 或网络后重试。';process.exitCode=1;}
finally{receipt.finishedAt=new Date().toISOString();writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,code:receipt.code,receipt:join(output,'receipt.json'),sourceDirectory:directory}));}
