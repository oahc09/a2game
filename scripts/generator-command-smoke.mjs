/** Install a source-linked CLI into an isolated prefix; no global installation or model calls. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),prefix=mkdtempSync(join(tmpdir(),'a2game-command-'));
const directory=join(root,'output','generator-command-smoke-'+randomUUID());mkdirSync(directory,{recursive:true});
const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const receipt={format:'a2game-generator-command-smoke',version:1,status:'FAIL',modelCalls:0,G3:'NOT_RUN',prefix,steps:[],installation:'Source-linked local prefix; source workspace must remain available, portable packaging is GEN-6.'};
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const lock=join(root,'package-lock.json'),before=hash(lock);
try{
 assert.ok(existsSync(npm));
 const userConfig=join(prefix,'empty-user.npmrc'),globalConfig=join(prefix,'empty-global.npmrc');writeFileSync(userConfig,'');writeFileSync(globalConfig,'');
 const env={...process.env,npm_config_userconfig:userConfig,npm_config_globalconfig:globalConfig};
 const run=(name,args)=>{
  const result=spawnSync(process.execPath,[npm,...args],{cwd:root,env,windowsHide:true,shell:false,encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024});
  writeFileSync(join(directory,name+'.stdout.log'),result.stdout??'');writeFileSync(join(directory,name+'.stderr.log'),result.stderr??'');
  receipt.steps.push({name,exitCode:result.status});assert.equal(result.status,0,name);return result.stdout;
 };
 run('install',['install','--prefix',prefix,'--ignore-scripts','--no-save','--package-lock=false','--no-audit','--no-fund',root]);
 assert.ok(existsSync(join(prefix,'node_modules','.bin',process.platform==='win32'?'a2game.cmd':'a2game')));
 const exec=['exec','--prefix',prefix,'--offline','--no','--','a2game'];
 assert.match(run('help',[...exec,'--help']),/generate --prompt-file/);
 assert.equal(run('version',[...exec,'--version']).trim(),'1.0.0');
 const prompt=join(prefix,'prompt.txt'),output=join(prefix,'game');writeFileSync(prompt,'DEMO_FIXTURE installed command smoke.');
 const generated=JSON.parse(run('generate',[...exec,'generate','--prompt-file',prompt,'--provider','fixture','--output',output,'--max-attempts','1','--json']));
 assert.equal(generated.status,'PASS_REFERENCE');assert.equal(generated.generationCalls,0);assert.equal(generated.fixtureCalls,1);
 assert.equal(JSON.parse(run('validate',[...exec,'validate',join(output,'game.json'),'--json'])).status,'PASS_REFERENCE');
 assert.equal(hash(lock),before);receipt.dependencyLockUnchanged=true;receipt.packageSha256=hash(join(root,'package.json'));receipt.status='PASS_LOCAL';
}catch(e){receipt.code=e.code??'A2G_GEN_COMMAND_SMOKE';receipt.message='安装命令验证未完成，请查看本次分步日志后重试。';process.exitCode=1;}
finally{writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,receipt:relative(root,join(directory,'receipt.json')).replaceAll('\\','/')}));}
