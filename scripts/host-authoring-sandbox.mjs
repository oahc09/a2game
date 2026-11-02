/** Fail-closed Linux process launcher. Never launches a model implicitly or grants network/credentials. */
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verifyPublicWorkspace} from './host-public-workspace.mjs';
const blocked=reason=>({status:'BLOCKED_OS_ISOLATION',reason,independentAuthoring:'NOT_VERIFIED',modelCalls:0});
export function sandboxArguments(run,{executable,args=[]}={}){
 const dir=realpathSync(run),meta=JSON.parse(readFileSync(join(dir,'run.json'),'utf8'));
 verifyPublicWorkspace(join(dir,'public-context'),meta.isolation?.manifestSha256);
 const candidate=join(dir,'candidate');if(lstatSync(candidate).isSymbolicLink()||!lstatSync(candidate).isDirectory())throw Error('Unsafe candidate directory');
 const out=['--unshare-all','--die-with-parent','--new-session','--ro-bind','/usr','/usr','--symlink','usr/bin','/bin','--symlink','usr/lib','/lib','--symlink','usr/lib64','/lib64','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--clearenv','--setenv','PATH','/usr/bin:/bin','--setenv','HOME','/tmp','--ro-bind',join(dir,'public-context'),'/public','--bind',candidate,'/candidate','--chdir','/candidate'];
 if(existsSync('/etc/ld.so.cache'))out.push('--ro-bind','/etc/ld.so.cache','/etc/ld.so.cache');
 if(executable){const path=realpathSync(executable);if(!lstatSync(path).isFile()||!Array.isArray(args)||args.some(a=>typeof a!=='string'||a.includes('\0')))throw Error('Host must supply an executable and argv');out.push('--ro-bind',path,'/host-command','--','/host-command',...args);}
 return out;
}
export function probeAuthoringSandbox(run,{spawn=spawnSync,platform=process.platform}={}){
 if(platform!=='linux')return blocked('Linux bubblewrap isolation is not available on this platform');
 const sentinel=join(tmpdir(),'a2game-isolation-'+randomUUID());writeFileSync(sentinel,'private probe',{flag:'wx'});
 try{
  const args=sandboxArguments(run);
  const program='import os,json,hashlib\nassert not os.path.exists('+JSON.stringify(realpathSync(run))+')\nassert not os.path.exists('+JSON.stringify(sentinel)+')\nassert not os.path.exists("/home/agent")\np="/candidate/.probe-'+randomUUID()+'"\nf=open(p,"x");f.write("probe");f.close();os.unlink(p)\nprint(json.dumps({"probe":"isolated-filesystem","manifestSha256":hashlib.sha256(open("/public/manifest.json","rb").read()).hexdigest()}))';
  const result=spawn('/usr/bin/bwrap',[...args,'--','/usr/bin/python3','-c',program],{env:{PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:10000,maxBuffer:16384,shell:false});
  if(result.error||result.status!==0)return blocked('bubblewrap could not establish the required namespaces; no fallback launch was performed');
  let observed;try{observed=JSON.parse(result.stdout);}catch{return blocked('Isolation probe returned no verifiable result');}
  const meta=JSON.parse(readFileSync(join(run,'run.json'),'utf8'));
  if(observed.probe!=='isolated-filesystem'||observed.manifestSha256!==meta.isolation.manifestSha256)return blocked('Isolation probe identity differs');
  return {status:'VERIFIED_OS_SANDBOX',manifestSha256:observed.manifestSha256,scope:'This probe process only; not a Qoder/TRAE/WorkBuddy attestation',independentAuthoring:'NOT_VERIFIED',modelCalls:0};
 }finally{unlinkSync(sentinel);}
}
export function launchAuthoringSandbox(run,executable,args=[],options={}){
 // A probe receipt is never trusted as authority; re-probe immediately and launch with the same enforced mount policy.
 const probe=probeAuthoringSandbox(run,options);if(probe.status!=='VERIFIED_OS_SANDBOX')return probe;
 const command=sandboxArguments(run,{executable,args}),spawn=options.spawn??spawnSync;
 const result=spawn('/usr/bin/bwrap',command,{env:{PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:600000,maxBuffer:1024*1024,shell:false});
 return {status:result.error||result.status!==0?'AUTHORING_PROCESS_FAILED':'SANDBOXED_PROCESS_COMPLETED',exitCode:result.status,manifestSha256:probe.manifestSha256,independentAuthoring:'NOT_VERIFIED',notice:'Only a host-authorized local command was run; host identity, usage, candidate provenance and MCP acceptance remain separate.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const [mode,run,executable,...args]=process.argv.slice(2);if(!['probe','launch'].includes(mode)||!run||mode==='launch'&&!executable)throw Error('Usage: host-authoring-sandbox.mjs probe <run> | launch <run> <host-approved executable> [argv...]');const result=mode==='probe'?probeAuthoringSandbox(run):launchAuthoringSandbox(run,executable,args);console.log(JSON.stringify(result,null,2));if(result.status.startsWith('BLOCKED')||result.status.endsWith('FAILED'))process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}
}
