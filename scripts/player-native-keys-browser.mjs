/** Ordinary HTTP player keyboard regression, not standalone/physical/G3 acceptance. */
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webkit} from 'playwright';
import {browserLaunchOptions} from './browser-launch.mjs';
import {createPlayerServer} from './serve.mjs';

const root=resolve(import.meta.dirname,'..');
const read=file=>readFileSync(resolve(root,file));
const sha=file=>createHash('sha256').update(read(file)).digest('hex');
const sdk=JSON.parse(read('player/vendor/sdk-provenance.json')), lock=JSON.parse(read('project/sdk-lock.json'));
assert.deepEqual(sdk.three,lock.three);
assert.equal(sdk.cocosairjs.commit,lock.cocosairjs.commit);
for(const file of sdk.files)assert.equal(sha(file.path),file.sha256);
const server=createPlayerServer(), launch=browserLaunchOptions();
const rows=[];
let browser;
try{
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await webkit.launch(launch);
 for(const backend of ['three','air']){
   const page=await browser.newPage({viewport:{width:1100,height:880}});
   try{
     const load=async game=>{
       const response=await page.goto(origin+'/player/index.html?game='+game+'&backend='+backend+'&clock=manual');
       assert.equal(response?.status(),200);
       await page.waitForFunction(()=>Boolean(window.__a2game?.getOperations));
     };
     const operations=()=>page.evaluate(()=>window.__a2game.getOperations());
     const entries=async()=> (await operations()).filter(row=>row.op==='action'||row.op==='raw');
     const status=()=>page.evaluate(()=>window.__a2game.getState().flow.status);
     const pressOn=async(selector,code)=>{await page.locator(selector).focus();await page.keyboard.press(code);};
     await load('g35-minesweeper');
     assert.equal(await status(),'playing');
     await pressOn('#pause','Space');
     assert.equal(await status(),'paused','focused native Space must pause, not flag');
     assert.deepEqual(await entries(),[]);
     await pressOn('#pause','Enter');
     assert.equal(await status(),'playing','focused native Enter must resume');
     await pressOn('#effectsToggle','Space');
     assert.equal(await page.locator('#effectsToggle').getAttribute('aria-pressed'),'true');
     assert.deepEqual(await entries(),[],'native controls must not enqueue any gameplay action');
     await pressOn('#GameCanvas','Space');
     assert.deepEqual((await entries()).map(row=>[row.input.action,row.input.phase]),[['flagMode','press'],['flagMode','release']]);
     rows.push({backend,game:'g35-minesweeper',cases:['native-pause-space','native-resume-enter','native-toggle-space','gameplay-canvas-space']});

     await load('g11-candidate');
     await page.locator('#GameCanvas').focus();
     await page.keyboard.down('Space');
     await page.evaluate(()=>window.__a2game.step(1));
     assert.deepEqual(await page.evaluate(()=>window.__a2game.runtime.snapshot().pressedSources.charge),['keyboard:Space']);
     await page.locator('#pause').focus();
     await page.keyboard.up('Space');
     assert.equal(await status(),'playing','keyup across focus must not activate a new control');
     await page.evaluate(()=>window.__a2game.step(1));
     assert.deepEqual(await page.evaluate(()=>window.__a2game.runtime.snapshot().pressedSources.charge),[]);
     assert.deepEqual((await entries()).map(row=>[row.op,row.input.kind,row.input.payload?.code]),[
       ['raw','down','Space'],['raw','up','Space']
     ]);
     await pressOn('#pause','Space');
     assert.equal(await status(),'paused');
     assert.equal((await entries()).length,2,'native keyboard presses must not inject unmatched gameplay keyup');
     rows.push({backend,game:'g11-candidate',cases:['held-release-across-focus','no-native-unmatched-release']});
   }finally{
     await page.evaluate(()=>window.__a2game?.dispose());
     await page.close();
   }
 }
 console.log(JSON.stringify({status:'PASS_REFERENCE',scope:'ordinary HTTP player with real SDK and browser keyboard; no physical device/G3',browser:browser.version(),playerSha256:sha('player/main.mjs'),harnessSha256:sha('scripts/player-native-keys-browser.mjs'),sdk:{three:sdk.three.version,cocosairjs:sdk.cocosairjs.commit,files:sdk.files},rows},null,2));
}finally{
 try{await browser?.close();}finally{
   if(server.listening){server.closeAllConnections();await new Promise((ok,no)=>server.close(error=>error?no(error):ok()));}
 }
}
