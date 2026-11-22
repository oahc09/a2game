/** Host-owned, bounded single-writer state. No secrets or browser-selected paths. */
import{mkdirSync,readFileSync,writeFileSync,openSync,closeSync,fsyncSync,renameSync,unlinkSync,rmdirSync,existsSync,lstatSync}from'node:fs';
import{resolve,join,sep}from'node:path';import{randomUUID,createHash}from'node:crypto';import{safePath}from'./index.mjs';
const root=resolve(import.meta.dirname,'..'),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=code=>Object.assign(Error('服务记录未能安全读取或保存，请检查存储目录；原记录已保留。'),{code,statusCode:503});
export function openServiceStore(input){
 const directory=safePath(input);if(!['.a2game','output'].some(base=>directory.startsWith(resolve(root,base)+sep)))throw fail('A2G_SERVICE_STORE_PATH');mkdirSync(directory,{recursive:true});
 const lock=join(directory,'writer.lock'),owner=join(lock,'owner.json'),file=join(directory,'state.json'),marker=join(directory,'initialized'),nonce=randomUUID();let owned=false,closed=false;
 function bounded(path,max){safePath(path);const stat=lstatSync(path);if(!stat.isFile()||stat.size>max)throw fail('A2G_SERVICE_STORE_SIZE');return JSON.parse(readFileSync(path,'utf8'));}
 if(existsSync(lock)){if(!lstatSync(safePath(lock)).isDirectory())throw fail('A2G_SERVICE_STORE_LOCK');const lease=bounded(owner,1024);if(!Number.isSafeInteger(lease.pid)||lease.pid<=0||!/^[a-f0-9-]{36}$/.test(lease.nonce))throw fail('A2G_SERVICE_STORE_LOCK');let alive=true;try{process.kill(lease.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)throw fail('A2G_SERVICE_STORE_BUSY');
  // A nonempty directory cannot replace another recovery claim. Retain the old
  // lease as evidence; two starters must never unlink each other's fresh lease.
  try{renameSync(lock,join(directory,'stale-writer-'+lease.nonce));}catch{throw fail('A2G_SERVICE_STORE_BUSY');}}
 try{mkdirSync(lock);}catch{throw fail('A2G_SERVICE_STORE_BUSY');}writeFileSync(owner,JSON.stringify({pid:process.pid,nonce}),{flag:'wx',mode:0o600});owned=true;
 const close=()=>{if(closed)return;closed=true;if(owned&&existsSync(lock)&&bounded(owner,1024).nonce===nonce){unlinkSync(owner);rmdirSync(lock);}};
 try{
  if(existsSync(marker)&&!existsSync(file))throw fail('A2G_SERVICE_STORE_MISSING');let state={usedCalls:0,jobs:[],releases:[],selected:{}};
  if(existsSync(file)){const envelope=bounded(file,2*1024*1024);if(envelope.format!=='a2game-service-state'||envelope.version!==1||hash(envelope.state)!==envelope.sha256)throw fail('A2G_SERVICE_STORE_INTEGRITY');state=envelope.state;}
  const validate=s=>{if(!s||!Number.isSafeInteger(s.usedCalls)||s.usedCalls<0||s.usedCalls>30||!Array.isArray(s.jobs)||s.jobs.length>16||!Array.isArray(s.releases)||s.releases.length>16||!s.selected||typeof s.selected!=='object'||Array.isArray(s.selected))throw fail('A2G_SERVICE_STORE_SHAPE');};validate(state);
  function atomicWrite(target,value){
   if(closed)throw fail('A2G_SERVICE_STORE_CLOSED');
   const bytes=JSON.stringify(value)+'\n';
   if(Buffer.byteLength(bytes)>2*1024*1024)throw fail('A2G_SERVICE_STORE_SIZE');
   safePath(target);
   const temp=join(directory,'state-'+randomUUID()+'.tmp');let fd;
   try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,target);}
   catch{if(fd!==undefined)closeSync(fd);throw fail('A2G_SERVICE_STORE_WRITE');}
  }
  function archivePath(kind,id){
   const pattern=kind==='job'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/:/^[a-f0-9]{64}$/;
   if(!['job','release'].includes(kind)||typeof id!=='string'||!pattern.test(id))throw fail('A2G_SERVICE_ARCHIVE_ID');
   return safePath(join(directory,'archive',kind,id+'.json'));
  }
  function archived(kind,id){
   const path=archivePath(kind,id);
   if(!existsSync(path))return null;
   const entry=bounded(path,2*1024*1024);
   if(entry.format!=='a2game-service-archive'||entry.version!==1||entry.kind!==kind||entry.record?.id!==id||hash(entry.record)!==entry.sha256)throw fail('A2G_SERVICE_ARCHIVE_INTEGRITY');
   return entry.record;
  }
  return{directory,read:()=>structuredClone(state),archived,
   archive(kind,record){
    const path=archivePath(kind,record.id),existing=archived(kind,record.id);
    if(existing){
     // A restart may refresh a terminal job's validation receipt after its
     // archive was written but before its active slot was released.
     if(kind==='release'&&existing.directory!==record.directory)throw fail('A2G_SERVICE_ARCHIVE_CONFLICT');
     return;
    }
    mkdirSync(join(directory,'archive',kind),{recursive:true});
    atomicWrite(path,{format:'a2game-service-archive',version:1,kind,record,sha256:hash(record)});
   },
   save(next){
    validate(next);safePath(marker);
    if(!existsSync(marker))writeFileSync(marker,'a2game-service-state@1\n',{flag:'wx',mode:0o600});
    atomicWrite(file,{format:'a2game-service-state',version:1,state:next,sha256:hash(next)});
    state=structuredClone(next);
   },close};
 }catch(e){close();throw e;}
}
