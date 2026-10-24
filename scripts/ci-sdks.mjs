/** Explicit CI preparation of the public, pinned upstream SDK; never replaces an existing checkout. */
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),lock=JSON.parse(readFileSync(resolve(root,'project/sdk-lock.json'),'utf8')),target=resolve(root,'.tools/cocosairjs');
const run=(command,args,options={})=>execFileSync(command,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});
if(existsSync(target))throw Error('SDK directory already exists; use sdk:prepare for a separately reviewed existing checkout.');
mkdirSync(resolve(root,'.tools'),{recursive:true});run('git',['clone','--filter=blob:none','--no-checkout',lock.cocosairjs.source,target]);run('git',['-C',target,'checkout','--detach',lock.cocosairjs.commit]);
const npm=process.platform==='win32'?'npm.cmd':'npm';
// npm.cmd needs a shell on Windows; fixed command/arguments only, no user or JSON command interpolation.
if(process.platform==='win32'){run('cmd.exe',['/d','/s','/c','npm ci'],{cwd:target});run('cmd.exe',['/d','/s','/c','npm run build'],{cwd:target});}
else{run(npm,['ci'],{cwd:target});run(npm,['run','build'],{cwd:target});}
run(process.execPath,['scripts/prepare-sdks.mjs']);
