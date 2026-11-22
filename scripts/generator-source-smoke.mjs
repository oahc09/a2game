/** Source-only local smoke; no historical evidence, copied dependencies or renderer SDK. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync,existsSync,mkdtempSync} from 'node:fs';
import {join,dirname,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isPythonRuntimeError,requirePython} from './python-runtime.mjs';
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
 const python=requirePython(undefined,{schema:true});
 for(const name of ['src','specs','scripts','generator','integrations','player','package.json','package-lock.json','tsconfig.json','project/sdk-lock.json','project/asset-policy.json','project/generator-benchmark-tasks.json'])copy(join(root,name),join(directory,name));
 receipt.sourceSha256=hash(JSON.stringify(Object.entries(receipt.sourceFiles).sort(([a],[b])=>a.localeCompare(b))));
 for(const name of ['reports','player/vendor','node_modules','dist'])receipt.assertions['notCopied:'+name]=!existsSync(join(directory,name));
 if(Object.values(receipt.assertions).some(value=>!value))throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_NOT_SOURCE_ONLY'});
 receipt.python={source:'shared validated Python (override, workspace venv, or PATH)',reused:true};
 const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 if(!existsSync(npm))throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_NPM_REQUIRED'});
 const userConfig=join(directory,'.npmrc-smoke-user'),globalConfig=join(directory,'.npmrc-smoke-global');writeFileSync(userConfig,'');writeFileSync(globalConfig,'');
 const env={...process.env,A2GAME_PYTHON:python,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',npm_config_userconfig:userConfig,npm_config_globalconfig:globalConfig};
 function step(name,args,{timeout=120000,json=false}={}){
  const started=performance.now(),result=spawnSync(process.execPath,args,{cwd:directory,env,shell:false,windowsHide:true,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
  writeFileSync(join(output,name+'.stdout.log'),result.stdout??'');writeFileSync(join(output,name+'.stderr.log'),result.stderr??'');
  const entry={name,argv:[process.execPath,...args],exitCode:result.status,elapsedMs:Math.round(performance.now()-started),status:result.status===0&&!result.error?'PASS':'FAIL'};receipt.steps.push(entry);
  if(entry.status!=='PASS')throw Object.assign(Error(),{code:result.error?.code==='ETIMEDOUT'?'A2G_GEN_SMOKE_TIMEOUT':'A2G_GEN_SMOKE_STEP',step:name});
  if(json){const value=JSON.parse(result.stdout);if(value.status!=='PASS_REFERENCE')throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_RESULT',step:name});return value;}
  return result.stdout;
 }
 step('install',[npm,'ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org'],{timeout:180000});
 step('install-mcp',[npm,'ci','--prefix','integrations/mcp','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org'],{timeout:180000});
 step('build',[npm,'run','build']);
 const prompt=join(directory,'smoke-prompt.txt'),gameDirectory=join(directory,'output','fixture');writeFileSync(prompt,'DEMO_FIXTURE engineering pipeline smoke.');
 const generated=step('generate',['generator/cli.mjs','generate','--prompt-file',prompt,'--provider','fixture','--max-attempts','1','--output',gameDirectory,'--json'],{json:true});
 if(generated.generationCalls!==0||generated.fixtureCalls!==1||generated.provenance!=='DEMO_FIXTURE')throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_FIXTURE_IDENTITY'});
 step('validate',['generator/cli.mjs','validate',join(gameDirectory,'game.json'),'--json'],{json:true});
 step('test',['generator/cli.mjs','test',gameDirectory,'--json'],{json:true});
 const rawClient=spawnSync(python,[join(directory,'scripts/mcp-raw-client.py'),process.execPath,join(directory,'scripts/mcp-server.mjs'),gameDirectory,'--expect-no-sdk'],{cwd:directory,env,shell:false,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024});
 writeFileSync(join(output,'mcp.stdout.log'),rawClient.stdout??'');writeFileSync(join(output,'mcp.stderr.log'),rawClient.stderr??'');
 receipt.steps.push({name:'mcp-no-model-chain',exitCode:rawClient.status,status:rawClient.status===0?'PASS':'FAIL'});
 if(rawClient.status!==0)throw Object.assign(Error(),{code:'A2G_MCP_SOURCE_SMOKE'});
 receipt.assertions.mcpNoModelChain=JSON.parse(rawClient.stdout).modelCalls===0;
 receipt.assertions.missingSdkRejected=JSON.parse(rawClient.stdout).missingSdkRejected===true;
 const plannedDirectory=join(directory,'output','planned-fixture');
 const planned=step('generate-plan',['generator/cli.mjs','generate','--prompt-file',prompt,'--provider','fixture','--mode','game-plan','--max-attempts','1','--output',plannedDirectory,'--json'],{json:true});
 if(planned.generationCalls!==0||planned.fixtureCalls!==1||planned.planner?.source!=='HOST_KEYWORD_DRAFT')throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_PLAN_IDENTITY'});
 step('test-plan',['generator/cli.mjs','test',plannedDirectory,'--json'],{json:true});
 receipt.assertions.modesSameGame=hash(readFileSync(join(gameDirectory,'game.json')))===hash(readFileSync(join(plannedDirectory,'game.json')));
 receipt.assertions.planPresent=existsSync(join(plannedDirectory,'game-plan.json'));
 receipt.assertions.planLifecycle=JSON.parse(readFileSync(join(plannedDirectory,'tests/lifecycle.json'),'utf8')).status==='PASS_REFERENCE';
 if(!receipt.assertions.modesSameGame||!receipt.assertions.planPresent||!receipt.assertions.planLifecycle)throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_PLAN_RESULT'});
 const packageFile=join(directory,'output','game-package.json'),importedDirectory=join(directory,'output','imported');
 step('export-package',['generator/cli.mjs','export-package',plannedDirectory,'--output',packageFile,'--json'],{json:true});
 step('import-package',['generator/cli.mjs','import-package',packageFile,'--output',importedDirectory,'--json'],{json:true});
 receipt.assertions.importUnchanged=hash(readFileSync(join(plannedDirectory,'game.json')))===hash(readFileSync(join(importedDirectory,'game.json')));
 if(!receipt.assertions.importUnchanged)throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_IMPORT_RESULT'});
 const prepared=JSON.parse(step('benchmark-plan',['scripts/generator-benchmark.mjs','plan','--output',join(directory,'output','benchmark-plan')]));
 if(prepared.status!=='PREPARED_NOT_RUN'||prepared.plannedCells!==10||prepared.generationCalls!==0)throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_BENCH_PLAN'});
 receipt.assertions.noHistoricalReports=!existsSync(join(directory,'reports'));
 receipt.assertions.noRendererSdk=!existsSync(join(directory,'player/vendor'));
 if(!receipt.assertions.noHistoricalReports||!receipt.assertions.noRendererSdk)throw Object.assign(Error(),{code:'A2G_GEN_SMOKE_EXTERNAL_EVIDENCE'});
 receipt.artifacts={gameDirectory,gameSha256:hash(readFileSync(join(gameDirectory,'game.json'))),generationReport:join(gameDirectory,'generation-report.json')};
 receipt.status='PASS_LOCAL';
}catch(e){receipt.code=e.code??'A2G_GEN_SMOKE_FAILURE';if(e.step)receipt.failedStep=e.step;receipt.message=isPythonRuntimeError(e)?e.message:'纯源码 Generator 验证未完成；请查看分步日志，补齐 Python、npm 或网络后重试。';process.exitCode=1;}
finally{receipt.finishedAt=new Date().toISOString();writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,code:receipt.code,message:receipt.message,receipt:join(output,'receipt.json'),sourceDirectory:directory}));}
