/** Desktop native key/button validation, including recorded keyboard holds. Touch/IMU/analog remains separate. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
import {verifySources} from './final-acceptance-audit.mjs';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')),rel=p=>relative(root,p).replaceAll('\\','/'),hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const batches=process.argv.slice(2).map(read),runId='g3-native-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory=resolve(root,'reports',runId);mkdirSync(directory);
const sourceDigest=hash('scripts/g3-native.mjs');writeFileSync(resolve(directory,'g3-native-source.mjs'),readFileSync(resolve(root,'scripts/g3-native.mjs')));
const save=(p,v)=>writeFileSync(resolve(directory,p),JSON.stringify(v,null,2)+'\n');
const jobs=batches.flatMap(s=>s.cases.filter(c=>s.selected.includes(c.id)&&c.status==='PASS_REFERENCE').map(c=>({id:c.id,attempt:c.attempts.findLast(a=>a.status==='PASS_REFERENCE')})));
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length,'请勿合并重复任务。');
let server,browser,origin,failure;const cases=[];
try{
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',runId)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 origin=await new Promise((accept,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('HTTP 服务启动超时。')),10000);server.on('error',e=>{clearTimeout(timer);reject(e);});server.stderr.resume();server.stdout.on('data',c=>{out+=c;const m=out.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);accept(m[0]);}});});
 browser=await chromium.launch({headless:true});
 for(const job of jobs){const prior=read(job.attempt.browser);verifySources(root,read(prior.fingerprints));const base=resolve(root,job.attempt.directory,'validation'),bundle=read(rel(resolve(base,'debug-bundle.json'))),game=bundle.game;
  if(bundle.solution.some(r=>r.raw?.some(s=>s.source!=='keyboard'||!['down','up'].includes(s.kind)||typeof s.payload?.code!=='string')||r.action&&game.inputs.actions.find(a=>a.id===r.action)?.valueType!=='button')){cases.push({id:job.id,status:'NOT_RUN',reason:'包含 Touch/IMU/Gamepad raw 或模拟量；此 Profile 仅执行原生键盘和按钮，不替代虚拟 Touch/IMU 或物理验收。'});continue;}
  for(const backend of ['three','air']){const context=await browser.newContext({viewport:{width:1100,height:1000}}),page=await context.newPage(),row={id:job.id,backend,status:'FAIL',errors:[],consoleErrors:[]};page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   try{
    const response=await context.request.post(origin+'/api/releases',{headers:{'content-type':'application/json'},data:game});assert.equal(response.status(),201);const release=await response.json();row.definitionSha256=release.receipt.sha256Jcs;
    await page.goto(origin+'/player/index.html?backend='+backend+'&clock=manual&release='+release.receipt.sha256Jcs);await page.waitForFunction(()=>window.__a2game,null,{timeout:60000});row.initial=await page.evaluate(()=>window.__a2game.getState());row.actions=[];
    for(const step of bundle.solution){if(step.action){const action=game.inputs.actions.find(a=>a.id===step.action),binding=action.bindings.find(b=>b.source==='keyboard.button');
      if(binding){await page.keyboard.down(binding.config.code);await page.keyboard.up(binding.config.code);row.actions.push({action:step.action,method:'keyboard',code:binding.config.code});}
      else{await page.locator('[data-action="'+step.action+'"]').click();row.actions.push({action:step.action,method:'native-button'});}}
     for(const raw of step.raw??[]){await page.keyboard[raw.kind==='down'?'down':'up'](raw.payload.code);row.actions.push({method:'keyboard-raw',phase:raw.kind,code:raw.payload.code});}
     await page.evaluate(n=>window.__a2game.step(n),step.ticks);
    }
    row.final=await page.evaluate(()=>window.__a2game.getState());assert.equal(row.final.flow.status,'won');assert.deepEqual(row.final.state,read(rel(resolve(base,'playability.json'))).final.state);assert.ok(row.actions.length>0);row.operations=await page.evaluate(()=>window.__a2game.getOperations());
    const runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();try{for(const o of row.operations){if(o.op==='action')runtime.injectAction(o.input);else if(o.op==='raw')runtime.injectRaw(o.input);else if(o.op==='step')runtime.step(o.ticks);else throw Error('原生获胜流程出现非预期控制。');}row.node=runtime.observe();assert.equal(row.final.exactHash,row.node.exactHash);}finally{runtime.dispose();}
    row.screenshot=rel(resolve(directory,backend+'-'+job.id+'.png'));await page.screenshot({path:resolve(root,row.screenshot),fullPage:true});await page.locator('#restart').click();assert.equal((await page.evaluate(()=>window.__a2game.getState())).exactHash,row.initial.exactHash);
    await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.adapter.disposed,true);assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS_REFERENCE';
   }catch(e){row.failure=String(e);}finally{await context.close();}save(backend+'-'+job.id+'.json',row);cases.push({id:job.id,backend,status:row.status,definitionSha256:row.definitionSha256,receipt:rel(resolve(directory,backend+'-'+job.id+'.json'))});console.log(job.id,backend,row.status,row.failure??'');
  }
 }
}catch(e){failure=String(e);}finally{await browser?.close();if(server)await new Promise(done=>{if(server.exitCode!==null||server.signalCode!==null)done();else{server.once('exit',done);server.kill();}});}
const unchanged=hash('scripts/g3-native.mjs')===sourceDigest;
save('summary.json',{format:'a2game-g3-native',version:3,status:failure||!unchanged||cases.some(c=>c.status==='FAIL')?'FAIL':'PASS_REFERENCE',G3:'NOT_RUN',scope:'Actual desktop key/button/recorded keyboard-hold -> player binding -> native SDK -> normalized Node replay; Touch/IMU/Gamepad/analog and formal quality/device review remain pending.',unchanged,sourceSnapshot:rel(resolve(directory,'g3-native-source.mjs')),fingerprints:{'scripts/g3-native.mjs':sourceDigest},browserReferences:jobs.map(j=>j.attempt.browser),failure,cases});console.log(rel(resolve(directory,'summary.json')));if(failure||!unchanged||cases.some(c=>c.status==='FAIL'))process.exitCode=1;
