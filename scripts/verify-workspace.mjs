/** Preserve old canonical reports while collecting this verification in a new directory. */
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from './registry.mjs';
const directory=resolve(root,process.env.A2GAME_VERIFY_DIR??`reports/verify-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`);
if(!directory.startsWith(resolve(root,'reports')+sep)||existsSync(resolve(directory,'verify.log')))throw Error('Verification requires a fresh reports directory');
mkdirSync(directory,{recursive:true});
const originals=new Map(['conformance.json','schema-preflight.json'].filter(name=>existsSync(resolve(root,'reports',name))).map(name=>[name,readFileSync(resolve(root,'reports',name))]));
let result;
try{
  result=spawnSync('npm run verify',{cwd:root,shell:true,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
  const log=(result.stdout??'')+(result.stderr??'');writeFileSync(resolve(directory,'verify.log'),log);process.stdout.write(log);
  for(const name of originals.keys())if(existsSync(resolve(root,'reports',name)))copyFileSync(resolve(root,'reports',name),resolve(directory,name));
  const status=JSON.parse(readFileSync(resolve(root,'project/status.json'),'utf8'));
  const node=log.match(/(?:ℹ |# )?tests (\d+)/),pass=log.match(/(?:ℹ |# )?pass (\d+)/);
  status.currentRun={...status.currentRun,date:new Date().toISOString().slice(0,10),command:'npm run verify',status:result.status===0?'PASS':'FAIL',
    log:relative(root,resolve(directory,'verify.log')).replaceAll('\\','/'),conformanceReceipt:relative(root,resolve(directory,'conformance.json')).replaceAll('\\','/'),
    ...(node&&pass?{nodeTests:{pass:Number(pass[1]),total:Number(node[1])}}:{})};
  writeFileSync(resolve(root,'project/status.json'),JSON.stringify(status,null,2)+'\n');
}finally{for(const [name,bytes] of originals)writeFileSync(resolve(root,'reports',name),bytes);}
if(result.status!==0)process.exitCode=result.status??1;
