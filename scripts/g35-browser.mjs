/** Targeted host-authored G35 acceptance. No gate pointers or model/physical acceptance. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {join,resolve,extname,relative} from 'node:path';
import {webkit} from 'playwright';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {makeRegistry} from './registry.mjs';

const root=resolve(import.meta.dirname,'..');
const files=process.argv.slice(2).map(path=>resolve(path));
assert.equal(files.length,2,'Usage: node scripts/g35-browser.mjs <G35 base GameSpec> <G35 variant GameSpec>');
const out=join(root,'output','g35-browser-'+randomUUID());
mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=(file)=>JSON.parse(readFileSync(file,'utf8'));
const fileSha=file=>sha(readFileSync(file));
const local=file=>relative(root,file).replaceAll('\\','/');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
const tracked=git('ls-files','-z','--cached','--others','--exclude-standard','--','src','scripts','player','packages/player-sdk','examples/embedded-player','specs/v0.1/capabilities','package.json','package-lock.json','project/sdk-lock.json').split('\0').filter(Boolean);
const walkFiles=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const path=join(directory,entry.name);return entry.isDirectory()?walkFiles(path):[path];});
const fingerprint=()=>Object.fromEntries([...new Set([...tracked,...walkFiles(join(root,'dist')).map(local),...walkFiles(join(root,'player/vendor')).map(local)])].sort().map(path=>[path,fileSha(join(root,path))]));
const sourceHashes=fingerprint();
writeFileSync(join(out,'fingerprints.json'),JSON.stringify(sourceHashes,null,2)+'\n',{flag:'wx'});
const report={format:'a2game-g35-browser-smoke',version:1,scope:'TARGETED_HOST_AUTHORED_SOFTWARE_ENGINEERING',status:'FAIL',node:process.version,playwright:read(join(root,'node_modules/playwright/package.json')).version,head:git('rev-parse','HEAD'),harnessSha256:fileSha(import.meta.filename),sourceFingerprintsSha256:fileSha(join(out,'fingerprints.json')),acceptance:{g3:'NOT_CLAIMED',physical:'NOT_RUN',human:'NOT_RUN'},definitions:[],browsers:[],cases:[]};

const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;};
const close=async server=>{server.closeAllConnections();await new Promise((ok,no)=>server.close(error=>error?no(error):ok()));};
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};

function exportServer(directory,entries){
 const inventory=new Map(entries.map(row=>['/'+row.file,row.sha256]));
 const observed=new Set();
 const server=createServer((req,res)=>{
  const path=(req.url??'').split('?')[0],digest=inventory.get(path);
  if(req.method!=='GET'||req.headers.host!=='127.0.0.1:'+server.address().port||!digest){res.writeHead(404);res.end();return;}
  try{
   const bytes=readFileSync(join(directory,path.slice(1)));
   assert.equal(sha(bytes),digest);
   observed.add(path);
   res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   res.end(bytes);
  }catch{res.writeHead(500);res.end();}
 });
 return {server,observed};
}

function replay(definition,ops){
 const rt=new HeadlessRuntime(definition,makeRegistry());
 rt.start();
 try{
  for(const row of ops){
   if(row.op==='action')rt.injectAction(row.input);
   else if(row.op==='raw')rt.injectRaw(row.input);
   else if(row.op==='step')rt.step(row.ticks);
   else if(['pause','resume','restart'].includes(row.op))rt[row.op]();
   else throw Error('Unexpected host operation: '+row.op);
  }
  return rt.observe();
 }finally{rt.dispose();}
}

function inputProfile(game){
 const field=game.state.minefield.initial;
 const cells=game.inputs.actions.filter(action=>/^cell[0-9]+$/.test(action.id)&&action.bindings.some(binding=>binding.source==='touch.select'));
 assert.equal(cells.length,field.cells.length);
 assert.ok(cells.every((action,index)=>action.id==='cell'+index),'Ordered per-cell coordinate ABI');
 const flag=game.inputs.actions.find(action=>/flag/i.test(action.id)&&action.bindings.some(binding=>binding.source==='keyboard.button'));
 assert.ok(flag,'Expected an explicit keyboard flag mode');
 const key=flag.bindings.find(binding=>binding.source==='keyboard.button').config.code;
 const first=cells.findIndex(cell=>replay(game,[
  {op:'action',input:{action:cell.id,phase:'press',sourceId:'oracle'}},
  {op:'action',input:{action:cell.id,phase:'release',sourceId:'oracle'}},
  {op:'step',ticks:1}
 ]).flow.status==='playing');
 assert.ok(first>=0,'Need a first reveal that leaves a nonterminal board');
 const oracle=replay(game,[
  {op:'action',input:{action:cells[first].id,phase:'press',sourceId:'oracle'}},
  {op:'action',input:{action:cells[first].id,phase:'release',sourceId:'oracle'}},
  {op:'step',ticks:1}
 ]);
 const mines=oracle.state.minefield.mines;
 const safe=[first,...cells.map((_,index)=>index).filter(index=>index!==first&&!mines.includes(index))];
 assert.ok(mines.length>0&&safe.length>1);
 assert.ok(oracle.state.minefield.cells[first]>=0&&oracle.state.minefield.cells[first]<9);
 return {cells,safe,mines,first,flag:flag.id,key};
}

async function clickCell(page,selector,action){
 const target=action.bindings.find(row=>row.source==='touch.select').config;
 const canvas=page.locator(selector);
 await canvas.scrollIntoViewIfNeeded();
 const box=await canvas.boundingBox();
 assert.ok(box&&box.width>0&&box.height>0);
 const scale=Math.min(box.width/target.sceneWidth,box.height/target.sceneHeight);
 const x=box.x+box.width/2+target.x*scale,y=box.y+box.height/2-target.y*scale;
 assert.ok(x>box.x&&x<box.x+box.width&&y>box.y&&y<box.y+box.height);
 await page.mouse.click(x,y);
 return {action:action.id,x,y,viewportAspect:box.width/box.height};
}

async function capture(page,selector,name){
 const path=join(out,name+'.png');
 await page.locator(selector).screenshot({path,timeout:10000});
 return {path:local(path),sha256:fileSha(path)};
}

function observePages(context,origin){
 const errors=[];
 return {errors,async page(){
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('response',response=>{
   if(response.url().startsWith(origin+'/')&&response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push('HTTP '+response.status()+' '+new URL(response.url()).pathname);
  });
  await page.route('**/*',route=>{
   if(new URL(route.request().url()).origin===origin)return route.continue();
   errors.push('Non-loopback request: '+new URL(route.request().url()).origin);return route.abort();
  });
  return page;
 }};
}

async function manualFlow(page,item,backend,origin,release,result){
 const canvas='#GameCanvas',backendId=backend==='cocosairjs'?'air':'three';
 await page.goto(origin+'/player/index.html?backend='+backendId+'&release='+release+'&clock=manual',{timeout:15000});
 await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing'||document.querySelector('#error')?.textContent?.trim(),undefined,{timeout:30000});
 assert.equal((await page.locator('#error').textContent()).trim(),'');
 assert.equal(await page.evaluate(()=>window.__a2game.backend),backendId);
 const checkpoints=[],check=async label=>{
  const {state,ops}=await page.evaluate(()=>({state:window.__a2game.getState(),ops:window.__a2game.getOperations()}));
  const node=replay(item.game,ops);
  assert.equal(state.exactHash,node.exactHash,label);
  assert.deepEqual(state.state.minefield,node.state.minefield,label);
  checkpoints.push({label,hash:state.exactHash,inputSha256:sha256Canonical(ops)});
  return state;
 };
 const step=()=>page.evaluate(()=>window.__a2game.step(1));
 const pick=async index=>{await clickCell(page,canvas,item.profile.cells[index]);await step();};
 const start=await check('initial');
 const {mines:[mine],first}=item.profile;
 await page.locator(canvas).focus();await page.keyboard.press(item.profile.key);await step();
 assert.ok((await check('keyboard flag mode')).state.minefield.flagMode);
 await pick(mine);assert.equal((await check('pointer flag')).state.minefield.cells[mine],-1);
 await pick(mine);assert.equal((await check('pointer unflag')).state.minefield.cells[mine],-2);
 await page.keyboard.press(item.profile.key);await step();
 assert.ok(!(await check('keyboard reveal mode')).state.minefield.flagMode);
 await pick(first);assert.deepEqual((await check('safe first reveal')).state.minefield.mines,item.profile.mines);
 await pick(mine);assert.equal((await check('mine loses')).flow.status,'lost');
 await page.locator('#restart').click();assert.equal((await check('restart restores initial hash')).exactHash,start.exactHash);
 for(const index of item.profile.safe){
  if((await page.evaluate(()=>window.__a2game.getState().flow.status))!=='playing')break;
  await pick(index);
 }
 assert.equal((await check('all safe won')).flow.status,'won');
 result.manual={checkpoints,operations:await page.evaluate(()=>window.__a2game.getOperations()),screenshot:await capture(page,canvas,result.id+'-host-won')};
 await page.evaluate(()=>window.__a2game.dispose());
 const diagnostics=await page.evaluate(()=>window.__a2game.diagnostics());
 assert.equal(diagnostics.resources.ownedResources,0);
 assert.equal(diagnostics.listenersActive,false);
 assert.equal(diagnostics.adapter.disposed,true);
}

async function standaloneFlow(page,item,backend,origin,result){
 const canvas='#game canvas',status=()=>page.evaluate(()=>window.examplePlayer.status());
 const wait=state=>page.waitForFunction(value=>window.examplePlayer?.status()===value,state);
 await page.goto(origin+'/player/index.html?backend='+backend,{timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('#start')?.disabled||/^加载失败/.test(document.querySelector('#status')?.textContent??''));
 assert.ok(await page.locator('#start').isEnabled(),await page.locator('#status').textContent());
 assert.equal(await page.locator('#backend').inputValue(),backend);
 assert.equal(await page.evaluate(()=>window.examplePlayer.getInfo().id),item.game.id);
 assert.equal(await status(),'ready');
 assert.equal(await page.locator(canvas).count(),1);
 const dimensions=await page.locator(canvas).evaluate(c=>({width:c.width,height:c.height}));
 assert.ok(dimensions.width>0&&dimensions.height>0);
 const captures={ready:await capture(page,canvas,result.id+'-export-ready')};
 await page.locator('#start').click();await wait('playing');
 const flag=page.locator('#controls button[data-action="'+item.profile.flag+'"]');
 const points=[];
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const pick=async index=>{points.push(await clickCell(page,canvas,item.profile.cells[index]));await frames();};
 // Two public input sources: click the visible flag control, then use its declared keyboard key.
 const mine=item.profile.mines[0];
 await flag.click();await frames();
 await pick(mine);
 await page.waitForFunction(()=>window.examplePlayer.diagnostics().pointer.samples>=2);
 captures.flag=await capture(page,canvas,result.id+'-export-flag');
 assert.equal(await status(),'playing');
 assert.notEqual(captures.flag.sha256,captures.ready.sha256,'Flag action should visibly change the standalone canvas');
 await pick(mine); // Unflag while still in flag mode.
 await page.keyboard.press(item.profile.key);await frames();
 await pick(item.profile.first);
 await pick(mine);await wait('lost');
 captures.lost=await capture(page,canvas,result.id+'-export-lost');
 await page.locator('#restart').click();await wait('playing');
 await page.locator('#pause').click();await wait('paused');
 const paused=await page.evaluate(()=>window.examplePlayer.diagnostics().pointer.samples);
 await pick(mine);
 assert.equal(await page.evaluate(()=>window.examplePlayer.diagnostics().pointer.samples),paused);
 assert.equal(await status(),'paused');
 await page.locator('#pause').click();await wait('playing');
 for(const index of item.profile.safe){if(await status()!=='playing')break;await pick(index);}
 await wait('won');captures.won=await capture(page,canvas,result.id+'-export-won');
 assert.notEqual(captures.lost.sha256,captures.won.sha256);
 const before=await page.evaluate(()=>window.examplePlayer.diagnostics());
 assert.ok(before.pointer.samples>=4);assert.ok(before.adapter&&!before.adapter.disposed);
 await page.locator('#dispose').click();await wait('disposed');
 const after=await page.evaluate(()=>window.examplePlayer.diagnostics());
 assert.equal(after.resources.ownedResources,0);
 assert.equal(after.pointer.listenersActive,false);
 assert.equal(after.pointer.activePointers,0);
 assert.equal(after.adapter.disposed,true);
 assert.equal(await page.locator(canvas).count(),0);
 result.standalone={dimensions,captures,points,before,after,status:'WON_THEN_DISPOSED'};
}

const contentService=createContentService();
const host=createPlayerServer({contentService});
const exports=[];
try{
 const origin=await listen(host);
 report.sdk=read(join(root,'player/vendor/sdk-provenance.json'));
 const locked=read(join(root,'project/sdk-lock.json'));
 assert.deepEqual(report.sdk.three,locked.three);
 assert.equal(report.sdk.cocosairjs.commit,locked.cocosairjs.commit);
 for(const row of report.sdk.files)assert.equal(fileSha(join(root,row.path)),row.sha256);
 for(const path of files){
  const game=read(path),profile=inputProfile(game);
  const receipt=await contentService.release(readFileSync(path,'utf8'));
  const log=execFileSync(process.execPath,[join(root,'scripts/package-player-sdk.mjs'),path],{cwd:root,encoding:'utf8',timeout:60000});
  const build=JSON.parse(log),inventory=read(join(build.output,'build-inventory.json'));
  const bundle=read(join(build.output,'player/game.release.json'));
  assert.equal(build.status,'PASS');assert.deepEqual(bundle.definition,game);
  assert.equal(build.bundleDigest,sha256Canonical(bundle));
  const paths=inventory.files.map(row=>row.file);
  assert.equal(new Set(paths).size,paths.length);
  const walk=(directory)=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
   const path=join(directory,entry.name);
   assert.ok(entry.isFile()||entry.isDirectory(),'Non-regular package entry');
   return entry.isDirectory()?walk(path):[relative(build.output,path).replaceAll('\\','/')];
  });
  assert.deepEqual(walk(build.output).filter(path=>path!=='build-inventory.json').sort(),paths.sort());
  for(const row of inventory.files)assert.equal(fileSha(join(build.output,row.file)),row.sha256);
  const staticServer=exportServer(build.output,inventory.files);
  const item={game,profile,release:receipt.sha256Jcs,staticServer,exportOrigin:await listen(staticServer.server)};
  exports.push(item);
  report.definitions.push({id:game.id,gameSha256:fileSha(path),normalizedSha256:sha256Canonical(game),receipt:receipt.sha256Jcs,bundleDigest:build.bundleDigest,exportDirectory:local(build.output),inventorySha256:fileSha(join(build.output,'build-inventory.json')),files:inventory.files.length});
 }
 assert.notEqual(exports[0].game.id,exports[1].game.id);
 {
  const name='webkit',opts=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
  const browser=await webkit.launch({...opts,timeout:20000});
  try{
   report.browsers.push({engine:name,...browserIdentity(browser,opts),executableSha256:opts.executablePath?fileSha(opts.executablePath):null});
   for(const item of exports)for(const backend of ['cocosairjs','three']){
    const id=[name,backend,item.game.id].join('-'),result={id,engine:name,backend,game:item.game.id,status:'FAIL'};
    report.cases.push(result);
    try{
     for(const flow of ['manual','standalone']){
      const pageOrigin=flow==='manual'?origin:item.exportOrigin;
      const context=await browser.newContext({viewport:flow==='manual'?{width:1100,height:900}:{width:390,height:844},serviceWorkers:'block'});
      const sessions=observePages(context,pageOrigin);
      try{
       const page=await sessions.page();
       result.userAgent=await page.evaluate(()=>navigator.userAgent);
       try{
        if(flow==='manual')await manualFlow(page,item,backend,pageOrigin,item.release,result);
        else await standaloneFlow(page,item,backend,pageOrigin,result);
        assert.deepEqual(sessions.errors,[]);
       }catch(error){
        result.failureContext={flow,errors:sessions.errors,text:(await page.locator('body').innerText({timeout:2000}).catch(()=>'' )).slice(0,2000)};
        throw error;
       }
      }finally{await context.close();}
     }
     const sdk=backend==='cocosairjs'?'/player/vendor/cocosair.js':'/player/vendor/three.module.js';
     assert.ok(item.staticServer.observed.has(sdk),'Actual SDK bytes were not requested');
     item.staticServer.observed.clear();
     result.status='PASS_REFERENCE';
    }catch(error){result.failure=String(error.stack??error);item.staticServer.observed.clear();}
   }
  }finally{await browser.close();}
 }
 assert.equal(report.cases.length,4);
 assert.deepEqual(fingerprint(),sourceHashes,'Acceptance inputs changed during the run');
 assert.ok(report.cases.every(row=>row.status==='PASS_REFERENCE'),'Some targeted cases failed');
 report.status='PASS_REFERENCE';
}catch(error){report.failure=String(error.stack??error);process.exitCode=1;}
finally{
 for(const item of exports)await close(item.staticServer.server);
 await close(host);
 writeFileSync(join(out,'summary.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:report.status,report:local(join(out,'summary.json')),passed:report.cases.filter(row=>row.status==='PASS_REFERENCE').length}));
}
