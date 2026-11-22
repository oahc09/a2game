/** Replay v2 author suites with DOM input and compare each case against Headless. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {createPlayerServer} from '../scripts/serve.mjs';
import {createContentService} from '../scripts/content-service.mjs';
const root='games/coverage-v2';
const args=process.argv.slice(2);
const verifyRestart=args.includes('--verify-restart');
const requested=args.filter(arg=>arg!=='--verify-restart');
const dirs=requested.length?requested:fs.readdirSync(root,{withFileTypes:true})
 .filter(entry=>entry.isDirectory()&&!['g58-barrage','g90-lighthouse'].includes(entry.name)).map(entry=>entry.name);
assert.ok(dirs.length>0&&dirs.length<=32&&dirs.every(dir=>/^[gh]\d+-[a-z0-9-]+$/.test(dir)));
const save='reports/coverage-v2-browser-'+Date.now();
fs.mkdirSync(save,{recursive:true});
const server=createPlayerServer({contentService:createContentService()});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const results=[];
function replay(game,operations){
 const logic=new HeadlessRuntime(game,makeRegistry());
 try{
  logic.start();
  for(const op of operations){
   if(op.op==='action')logic.injectAction(op.input);
   else if(op.op==='raw')logic.injectRaw(op.input);
   else if(op.op==='step')logic.step(op.ticks);
   else if(['restart','pause','resume'].includes(op.op))logic[op.op]();
   else throw Error(JSON.stringify(op));
  }
  return logic.observe().exactHash;
 }finally{logic.dispose();}
}
async function pointer(page,input){
 const canvas=page.locator('#GameCanvas');
 await canvas.scrollIntoViewIfNeeded();
 const box=await canvas.boundingBox();
 assert.ok(box&&box.width>0&&box.height>0);
 await page.mouse.move(box.x+input.payload.u*box.width,box.y+input.payload.v*box.height);
 if(input.kind==='down')await page.mouse.down();
 else if(input.kind==='up')await page.mouse.up();
 else assert.equal(input.kind,'move');
}
let browser;
try{
 browser=await chromium.launch();
 for(const dir of dirs){
  const read=file=>JSON.parse(fs.readFileSync(root+'/'+dir+'/'+file+'.json'));
  const game=read('game'),suite=read('conformance');
  const response=await fetch(origin+'/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(game)});
  const payload=await response.json();
  assert.equal(response.status,201,JSON.stringify(payload));
  const backendHashes=new Map();
  for(const backend of ['three','air']){
   const page=await browser.newPage({viewport:{width:1100,height:850}});
   const result={dir,backend,browser:browser.version(),gameSha:payload.receipt.sha256Jcs,
    conformanceSha:sha256Canonical(suite),cases:[],errors:[]};
   results.push(result);
   page.on('pageerror',err=>result.errors.push(err.message));
   try{
    await page.goto(origin+'/player/index.html?backend='+backend+'&clock=manual&release='+payload.receipt.sha256Jcs);
    await page.waitForFunction(()=>window.__a2game?.getState()?.flow.status==='playing');
    const initial=await page.evaluate(()=>window.__a2game.getState().state);
    const run=async ticks=>page.evaluate(t=>window.__a2game.step(t),ticks);
    const pressed=new Set();
    async function edge(code,kind){
     await page.keyboard[kind](code);
     if(kind==='down')pressed.add(code);else pressed.delete(code);
    }
    async function restart(){
     for(const code of pressed)await edge(code,'up');
     await page.locator('#restart').evaluate(el=>el.click());
    }
    async function playCase(test){
     for(const [stepIndex,op] of test.steps.entries()){
      if(op.op==='start')continue;
      if(op.op==='expectError'){
       // The browser drops terminal DOM input. The Headless suite checks its API error code.
       const next=test.steps[stepIndex+1];
       assert.equal(op.code,'A2G_E_FLOW');
       assert.equal(next?.op,'injectAction');
       const flow=await page.evaluate(()=>window.__a2game.getState().flow.status);
       assert.ok(['won','lost','stopped'].includes(flow));
       continue;
      }
      if(op.op==='restart'){await restart();continue;}
      if(op.op==='injectRaw'&&op.raw.source==='keyboard'){await edge(op.raw.payload.code,op.raw.kind);continue;}
      if(op.op==='injectRaw'&&op.raw.source==='pointer'){await pointer(page,op.raw);continue;}
      if(op.op==='step'){await run(op.ticks);continue;}
      if(op.op==='assert'){
       const actual=await page.evaluate(path=>path.slice(1).split('/').reduce((v,k)=>v?.[k],window.__a2game.getState()),op.path);
       assert.deepEqual(actual,op.equals,test.id+' '+op.path);continue;
      }
      if(op.op==='injectAction'){
       const code=game.inputs.actions.find(a=>a.id===op.action).bindings[0].config.code;
       await edge(code,op.phase==='press'?'down':'up');continue;
      }
      throw Error('Unsupported browser operation '+op.op);
     }
    }
    let terminalCase;
    for(const [i,test] of suite.cases.entries()){
     if(i)await restart();
     await playCase(test);
     const {observation,operations}=await page.evaluate(()=>({
      observation:window.__a2game.getState(),operations:window.__a2game.getOperations()
     }));
     const hash=replay(game,operations);
     assert.equal(hash,observation.exactHash,test.id+' Headless exact hash');
     if(backendHashes.has(test.id))assert.equal(hash,backendHashes.get(test.id),test.id+' cross-engine exact hash');
     else backendHashes.set(test.id,hash);
     const prefix=dir+'-'+backend+'-'+test.id;
     const screenshot=prefix+'.png',trace=prefix+'.json';
     await page.locator('#GameCanvas').scrollIntoViewIfNeeded();
     await page.screenshot({path:save+'/'+screenshot});
     fs.writeFileSync(save+'/'+trace,JSON.stringify({
      gameId:game.id,gameSha:result.gameSha,backend,caseId:test.id,hash,operations
     },null,2)+'\n');
     result.cases.push({id:test.id,screenshot,trace,hash,status:observation.flow.status});
     if(['won','lost','stopped'].includes(observation.flow.status))terminalCase={test,hash,status:observation.flow.status};
    }
    if(verifyRestart){
     assert.ok(terminalCase,'Suite must exercise a terminal state');
     if(result.cases.at(-1).id!==terminalCase.test.id){
      await restart();
      await playCase(terminalCase.test);
     }
     for(const code of pressed)await edge(code,'up');
     await page.locator('#stageRestart').click();
     const reset=await page.evaluate(()=>window.__a2game.getState());
     assert.equal(reset.flow.status,'playing');
     assert.equal(reset.tickIndex,0);
     assert.deepEqual(reset.state,initial);
     await playCase(terminalCase.test);
     const second=await page.evaluate(()=>window.__a2game.getState());
     assert.equal(second.flow.status,terminalCase.status);
     assert.equal(second.exactHash,terminalCase.hash);
     result.secondSession={status:'PASS',caseId:terminalCase.test.id,finalHash:second.exactHash};
    }
    await restart();
    assert.equal(await page.evaluate(()=>window.__a2game.getState().tickIndex),0);
    await page.locator('#pause').evaluate(el=>el.click());
    assert.equal((await run(2)).advanced,0);
    result.disposal=await page.evaluate(async()=>{await window.__a2game.dispose();return window.__a2game.diagnostics();});
    assert.equal(result.disposal.listenersActive,false);
    assert.deepEqual(result.errors,[]);
    result.status='PASS';
   }catch(err){result.status='FAIL';result.error=err.message;}
   finally{await page.close();}
  }
 }
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
 fs.writeFileSync(save+'/summary.json',JSON.stringify({results},null,2)+'\n');
 console.log(save+'/summary.json',results.map(({dir,backend,status,error})=>({dir,backend,status,error})));
}
if(results.length!==dirs.length*2||results.some(r=>r.status!=='PASS'))process.exitCode=1;
