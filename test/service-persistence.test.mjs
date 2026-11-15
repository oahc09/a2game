import test from'node:test';import assert from'node:assert/strict';import{randomUUID,randomBytes}from'node:crypto';import{resolve,join}from'node:path';import{readFileSync,writeFileSync,mkdirSync,renameSync}from'node:fs';
import{openServiceStore}from'../generator/service-store.mjs';import{startCreationDeliveryService}from'../packages/delivery-service/index.mjs';
const directory=()=>resolve('output','service-state-test-'+randomUUID());
test('single writer retains quotas and detects corrupt state without replacing it',()=>{
 const path=directory(),store=openServiceStore(path);store.save({...store.read(),usedCalls:3});assert.throws(()=>openServiceStore(path),{code:'A2G_SERVICE_STORE_BUSY'});store.close();
 const recovered=openServiceStore(path);assert.equal(recovered.read().usedCalls,3);recovered.close();const file=join(path,'state.json');renameSync(file,file+'.backup');assert.throws(()=>openServiceStore(path),{code:'A2G_SERVICE_STORE_MISSING'});renameSync(file+'.backup',file);
 let dead;for(let pid=1000000000;pid<1000000020;pid++){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){dead=pid;break;}}}assert.ok(dead,'Need a confirmed absent PID for the synthetic stale lease');mkdirSync(join(path,'writer.lock'));writeFileSync(join(path,'writer.lock/owner.json'),JSON.stringify({pid:dead,nonce:randomUUID()}));const afterCrash=openServiceStore(path);assert.equal(afterCrash.read().usedCalls,3);afterCrash.close();
 writeFileSync(file,'{"format":"corrupt"}');assert.throws(()=>openServiceStore(path),{code:'A2G_SERVICE_STORE_INTEGRITY'});assert.equal(readFileSync(file,'utf8'),'{"format":"corrupt"}');
});
test('admin login, fixture publication and restart recover jobs/selection without resetting quotas or replaying calls',async()=>{
 const stateDirectory=directory(),interruptedId=randomUUID(),seed=openServiceStore(stateDirectory);seed.save({...seed.read(),usedCalls:2,jobs:[{id:interruptedId,status:'running',progress:[],result:null}]});seed.close();
 const adminTokenEnv='A2GAME_TEST_'+randomUUID().replaceAll('-','').toUpperCase(),token=randomBytes(32).toString('hex');process.env[adminTokenEnv]=token;let service;
 const start=async()=>service=await startCreationDeliveryService({stateDirectory,adminTokenEnv,providerId:'fixture',maxCalls:2,allowPublish:true});
 const request=async(path,options={})=>fetch(new URL(path,service.url),options);
 const login=async()=>{const r=await request('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-A2Game-Auth':'1'},body:JSON.stringify({token})});assert.equal(r.status,204);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];};
 try{
  await start();assert.equal((await request('/studio/api/status')).status,401);assert.equal((await request('/delivery/api/config',{headers:{Origin:'https://foreign.example'}})).status,403);
  const wrong=await request('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-A2Game-Auth':'1'},body:JSON.stringify({token:'x'.repeat(32)})});assert.equal(wrong.status,401);
  let cookie=await login();let status=await(await request('/studio/api/status',{headers:{Cookie:cookie}})).json();assert.equal(status.remainingCalls,0);assert.equal(status.jobs.find(j=>j.id===interruptedId).status,'interrupted');
  const headers={'Content-Type':'application/json','X-A2Game-Studio':'1',Cookie:cookie},created=await request('/studio/api/jobs',{method:'POST',headers,body:JSON.stringify({prompt:'counter',providerId:'fixture',mode:'direct-json',maxAttempts:1})});assert.equal(created.status,202);const job=await created.json();
  let done;for(let i=0;i<180;i++){done=await(await request('/studio/api/jobs/'+job.id,{headers:{Cookie:cookie}})).json();if(done.status!=='running')break;await new Promise(r=>setTimeout(r,500));}assert.equal(done.status,'completed',JSON.stringify(done.error));
  const published=await request('/delivery/api/jobs/'+job.id+'/publish',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-A2Game-Delivery':'1'},body:'{}'});assert.equal(published.status,201,await published.clone().text());const entry=await published.json();
  const state=JSON.parse(readFileSync(join(stateDirectory,'state.json'))).state;assert.equal(state.usedCalls,2);assert.equal(state.jobs.length,2);assert.ok(!readFileSync(join(stateDirectory,'state.json'),'utf8').includes(token));
  await service.close();await start();assert.equal((await request('/studio/api/status',{headers:{Cookie:cookie}})).status,401);cookie=await login();status=await(await request('/studio/api/status',{headers:{Cookie:cookie}})).json();assert.equal(status.remainingCalls,0);assert.equal(status.jobs.length,2);assert.equal(status.jobs.find(j=>j.id===job.id).status,'completed');
  let envelope=await(await request('/delivery/api/channel',{headers:{Cookie:cookie}})).json(),channel=JSON.parse(envelope.payload);assert.equal(channel.versions.length,1);assert.equal(channel.selected[entry.gameId],entry.id);
  await service.close();writeFileSync(join(state.releases[0].directory,'player/example.mjs'),'tampered after publication');await start();cookie=await login();const config=await(await request('/delivery/api/config',{headers:{Cookie:cookie}})).json();assert.equal(config.recovery.length,1);assert.equal(config.recovery[0].status,'REJECTED');envelope=await(await request('/delivery/api/channel',{headers:{Cookie:cookie}})).json();assert.equal(JSON.parse(envelope.payload).versions.length,0);
  const logout=await request('/auth/logout',{method:'POST',headers:{Cookie:cookie,'X-A2Game-Auth':'1'}});assert.equal(logout.status,204);assert.equal((await request('/studio/api/status',{headers:{Cookie:cookie}})).status,401);
 }finally{await service?.close();delete process.env[adminTokenEnv];}
});
