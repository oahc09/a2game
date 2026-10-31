/** Current H01 dynamic labels at 320 px on both real SDKs; not human or device acceptance. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';

const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const id='h01-narrow-'+randomUUID(),directory=resolve(root,'reports',id);mkdirSync(directory);
const rel=p=>relative(root,p).replaceAll('\\','/');
const save=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const games=['h01-candidate','h01-reward-upgrade'];
const paths=['scripts/h01-narrow.mjs','src/presentation.ts','dist/presentation.js','player/main.mjs','player/index.html','player/adapters/three-adapter.mjs','player/adapters/cocosairjs-adapter.mjs','player/validated-games.json','specs/v0.1/schemas/game.schema.json',...games.map(n=>'specs/v0.1/games/'+n+'.game.json')];
const fingerprints=Object.fromEntries(paths.map(p=>[p,hash(p)]));save('fingerprints.json',fingerprints);save('sdk-provenance.json',read('player/vendor/sdk-provenance.json'));
const report={format:'a2game-h01-narrow-dynamic',status:'FAIL',scope:'Real SDK browser reference at 320px; no human or physical device approval.',modelCalls:0,humanReview:'NOT_RUN',physical:'NOT_RUN',G3:'NOT_RUN',cases:[]};
const replay=(game,ops)=>{const r=new HeadlessRuntime(game,makeRegistry());r.start();try{for(const op of ops){if(op.op==='action')r.injectAction(op.input);else if(op.op==='raw')r.injectRaw(op.input);else if(op.op==='step')r.step(op.ticks);else r[op.op]();}return r.observe().exactHash;}finally{r.dispose();}};
let server,browser;
try{
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,A2GAME_PORT:'0',A2GAME_CONTENT_DIR:resolve(root,'.tools',id)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 const origin=await new Promise((ok,fail)=>{let text='';const timeout=setTimeout(()=>fail(Error('HTTP startup timed out')),10000);server.once('error',fail);server.once('exit',code=>fail(Error('HTTP server exited '+code)));server.stdout.on('data',part=>{text+=part;const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);ok(match[0]);}});server.stderr.on('data',()=>{});});
 browser=await chromium.launch({headless:true});report.browser=browser.version();
 for(const name of games)for(const backend of ['three','air']){
  const row={game:name,backend,status:'FAIL',errors:[],consoleErrors:[]};let context;
  try{
   const game=read('specs/v0.1/games/'+name+'.game.json'),old=structuredClone(game),layer=old.presentation.scene2d.bodyLayer;
   old.revision--;delete layer.minValueFontSize;delete layer.minValueBodySize;
   for(const n of old.presentation.scene2d.nodes)if(n.id.startsWith('slot-label'))n.at[1]=-1.55;
   assert.equal(read('player/validated-games.json').content['/specs/v0.1/games/'+name+'.game.json'].sha256Jcs,sha256Canonical(game));
   context=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:2,hasTouch:true});const page=await context.newPage();
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   await page.goto(origin+'/player/index.html?backend='+backend+'&clock=manual&game='+name);await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing',null,{timeout:60000});
   await page.locator('button[data-action="place0"]').tap();await page.evaluate(()=>window.__a2game.step(2));
   row.state=await page.evaluate(()=>window.__a2game.getState());const ops=await page.evaluate(()=>window.__a2game.getOperations());
   assert.equal(replay(game,ops),row.state.exactHash);assert.equal(replay(old,ops),row.state.exactHash);
   row.layout=await page.evaluate(()=>{const frame=JSON.parse(window.render_game_to_text()).presentation,rect=document.getElementById('GameCanvas').getBoundingClientRect(),scale=Math.min(rect.width/frame.width,rect.height/frame.height);const labels=frame.commands.filter(c=>c.id.startsWith('body-label:'));const slots=frame.commands.filter(c=>c.id.startsWith('slot-label'));const bodies=frame.commands.filter(c=>c.id.startsWith('body:'));return {scale,labels:labels.map(c=>({id:c.id,text:c.text,cssPx:c.fontSize*scale})),overlap:slots.some(s=>bodies.some(b=>b.kind==='circle'&&Math.abs(b.at[0]-s.at[0])<b.radius&&Math.abs(b.at[1]-s.at[1])<b.radius+s.fontSize/2)),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(row.layout.labels.length>=2&&row.layout.labels.every(c=>c.cssPx>=16));assert.equal(row.layout.overlap,false);assert.equal(row.layout.overflow,false);
   const screenshot=resolve(directory,backend+'-'+name+'-320.png');await page.screenshot({path:screenshot,fullPage:true});row.screenshot=rel(screenshot);row.screenshotSha256=hash(row.screenshot);
   await page.evaluate(()=>window.__a2game.dispose());row.disposal=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(row.disposal.adapter.disposed,true);assert.equal(row.disposal.resources.ownedResources,0);assert.equal(row.disposal.listenersActive,false);assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.status='PASS_REFERENCE';
  }catch(error){row.failure=String(error);}
  finally{await context?.close();save(backend+'-'+name+'.json',row);report.cases.push(row);}
 }
 assert.ok(report.cases.length===4&&report.cases.every(c=>c.status==='PASS_REFERENCE'));
 for(const name of games){const rows=report.cases.filter(c=>c.game===name);assert.equal(rows[0].state.exactHash,rows[1].state.exactHash);}
 report.status='PASS_REFERENCE';
}catch(error){report.failure=String(error);}
finally{
 await browser?.close();if(server)await new Promise(ok=>{if(server.exitCode!==null||server.signalCode!==null)ok();else{server.once('exit',ok);server.kill();}});
 report.sourcesUnchanged=Object.entries(fingerprints).every(([p,h])=>hash(p)===h);if(!report.sourcesUnchanged)report.status='FAIL';save('summary.json',report);console.log(JSON.stringify({status:report.status,receipt:rel(resolve(directory,'summary.json')),failure:report.failure}));
}
if(report.status!=='PASS_REFERENCE')process.exitCode=1;
