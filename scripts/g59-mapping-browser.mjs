/** Software mapping acceptance, not physical Gamepad or playable G59 evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {webkit} from 'playwright';
import {createContentService} from './content-service.mjs';
import {createPlayerServer} from './serve.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
import {profile,pos} from '../test/fixtures/g59-mapping-profile.mjs';
const root=resolve(import.meta.dirname,'..');
const out=join(root,'output','g59-mapping-browser-'+randomUUID());mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const game=profile();game.id='org.a2game.synthetic.g59-mapping-browser';game.tests=[];
game.world.clock.maxCatchUpTicks=30;
const pred=(path,value)=>({op:'eq',args:[{state:path},{const:value}]});
game.outcomes=[{id:'fixture-won',status:'won',when:{op:'and',args:[pred('/score',1),pred('/axis/0',.7071),pred('/axis/1',.7071),pred('/rightStick/0',.7071),pred('/rightStick/1',.7071)]}}];
const text=JSON.stringify(game,null,2)+'\n',gamePath=join(out,'fixture.game.json');writeFileSync(gamePath,text,{flag:'wx'});
const contentService=createContentService();
const receipt=await contentService.release(text);
const pack=JSON.parse(execFileSync(process.execPath,[join(root,'scripts/package-player-sdk.mjs'),gamePath],{cwd:root,encoding:'utf8',timeout:60000}));
const inventory=JSON.parse(readFileSync(join(pack.output,'build-inventory.json'),'utf8'));
const digests=new Map(inventory.files.map(r=>['/'+r.file,r.sha256]));
const observed=new Set();
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const host=createPlayerServer({contentService});
const exported=createServer((request,response)=>{
 const path=(request.url??'').split('?')[0],digest=digests.get(path);
 if(request.method!=='GET'||!digest)return response.writeHead(404).end();
 const bytes=readFileSync(join(pack.output,path.slice(1)));
 if(sha(bytes)!==digest)return response.writeHead(500).end();
 observed.add(path);
 response.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
});
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;};
const close=async server=>{if(server.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
const results=[];
const run={
 scope:'synthetic navigator.getGamepads; real player/standalone and locked SDKs',gameSha256:sha(text),bundleDigest:pack.bundleDigest,
 sourceFiles:Object.fromEntries(['player/main.mjs','player/gamepad-host.mjs','src/gamepad-input.ts','packages/player-sdk/index.mjs','dist/gamepad-input.js'].map(path=>[path,sha(readFileSync(join(root,path)))])),
 results
};
const options=browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.env.A2GAME_WEBKIT_EXECUTABLE});
let browser;
try{
 const origin=await listen(host),staticOrigin=await listen(exported);
 browser=await webkit.launch({...options,timeout:20000});run.browser=browserIdentity(browser,options);
 for(const backend of ['three','cocosairjs'])for(const standalone of [false,true]){
  const context=await browser.newContext();
  try{
   await context.addInitScript(()=>{window.testPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPads,configurable:true});});
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   const id=backend==='cocosairjs'?'air':'three';
   await page.goto(standalone?staticOrigin+'/player/index.html?backend='+backend:
    origin+'/player/index.html?backend='+id+'&release='+receipt.sha256Jcs+'&clock=manual');
   const diag=()=>page.evaluate(standalone?()=>window.examplePlayer.diagnostics().gamepad:()=>window.__a2game.diagnostics().gamepad);
   const waitDiag=(key,value)=>page.waitForFunction(({standalone,key,value})=>
    (standalone?window.examplePlayer?.diagnostics():window.__a2game?.diagnostics())?.gamepad?.[key]===value,{standalone,key,value});
   const setPad=(config)=>page.evaluate(pads=>{window.testPads=pads;},[pos(config)]);
   const step=async()=>{if(!standalone){await page.evaluate(()=>window.__a2game.step(1));}};
   const state=()=>page.evaluate(()=>window.__a2game.getState().state);
   const status=()=>page.evaluate(standalone?()=>window.examplePlayer.status():()=>window.__a2game.getState().flow.status);
   if(standalone){
    await page.waitForFunction(()=>window.examplePlayer?.status()==='ready');
    await page.locator('#start').click();await page.locator('#enableGamepad').click();
   }else{
    await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing'||document.querySelector('#error')?.textContent?.trim());
    assert.equal((await page.locator('#error').textContent()).trim(),'');
    await page.locator('#gamepadEnable').click();
   }
   // Physically ambiguous device tries to supply both vectors and a scoring button.
   await setPad({mapping:'',buttons:[{pressed:true,value:1}],axes:[1,-1,1,-1]});await step();
   await waitDiag('incompatibleDevices',1);assert.equal((await diag()).samples,0);assert.equal(await status(),'playing');
   if(!standalone)assert.deepEqual([(await state()).axis,(await state()).rightStick],[[0,0],[0,0]]);
   await setPad({});await step();await waitDiag('samples',1);
   if(!standalone){const s=await state();assert.deepEqual([s.axis,s.rightStick],[[.7071,.7071],[-.7071,-.7071]]);}
   await setPad({axes:[1,-1,1,-1]});await step();await waitDiag('samples',2);
   if(!standalone){const s=await state();assert.deepEqual([s.axis,s.rightStick],[[.7071,.7071],[.7071,.7071]]);}
   await setPad({mapping:''});await step();await waitDiag('samples',3);
   assert.equal((await diag()).trackedDevices,0);
   if(!standalone){const s=await state();assert.deepEqual([s.axis,s.rightStick],[[0,0],[0,0]]);}
   await setPad({axes:[1,-1,1,-1],buttons:[{pressed:true,value:1}]});await step();
   await page.waitForFunction(standalone?()=>window.examplePlayer.status()==='won':()=>window.__a2game.getState().flow.status==='won');
   const canvas=page.locator(standalone?'#game canvas':'#GameCanvas');
   const dimensions=await canvas.evaluate(e=>[e.width,e.height]);assert.ok(dimensions.every(n=>n>0));
   if(standalone){
    assert.ok(observed.has('/player/vendor/'+(backend==='three'?'three.module.js':'cocosair.js')));
    await page.evaluate(()=>window.examplePlayer.dispose());
   }else await page.evaluate(()=>window.__a2game.dispose());
   assert.deepEqual(errors,[]);
   results.push({backend,standalone,dimensions,result:'REMAP_NEUTRALIZED_THEN_WON'});
  }finally{observed.clear();await context.close();}
 }
} finally {
 try{await browser?.close();}finally{await Promise.all([close(host),close(exported)]);writeFileSync(join(out,'receipt.json'),JSON.stringify(run,null,2)+'\n',{flag:'wx'});}
}
assert.equal(results.length,4);console.log(JSON.stringify(run,null,2));
