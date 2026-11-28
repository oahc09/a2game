import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {sha256Canonical} from '../dist/exact-hash.js';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gameDir='games/business-complete/skyline-patrol';
const status=(await read('project/status.json')).threeCompleteGamesBusinessRun;
const args=process.argv.slice(2);
const offlineOnly=args[0]==='--offline-only';
const enduranceStem={'--offscreen-endurance':'offscreen','--contact-order-endurance':'contact-order','--muzzle-endurance':'muzzle'}[args[0]];
if(enduranceStem)assert.equal(args.length,3,'Provide the CocosAirJS and Three.js receipts for the requested revision');
const [airFile=status.shooterEndurance.cocosAirReceipt,threeFile=status.shooterEndurance.threeReceipt,
  explicitDelivery=status.refreshedStandalonePackages.browserReceipt]=enduranceStem?args.slice(1):args;
const deliveryFile=enduranceStem?undefined:offlineOnly?args[1]:explicitDelivery;
if(offlineOnly)assert.ok(deliveryFile,'Provide the offline delivery receipt');
const gameFile=(enduranceStem??'delivery')+'.game.json';
const game=await read(join(gameDir,gameFile));
const release=sha256Canonical(game);

async function checkEndurance(file,backend){
  const receipt=await read(file),seconds=backend==='air'?1800:600;
  assert.equal(receipt.backend,backend);
  assert.equal(receipt.smoke,false);
  assert.equal(receipt.gameRelease,release);
  if(enduranceStem)assert.deepEqual([receipt.gameFile,receipt.gameRevision],[gameFile,game.revision]);
  assert.equal(receipt.targetSeconds,seconds);
  assert.deepEqual(receipt.errors,[]);
  assert.deepEqual(receipt.budget,{objects:128,p95FrameMs:25,p99FrameMs:50,warmupSeconds:20,windowSeconds:60});
  assert.ok(receipt.windows.length>0,'No measured frame windows');
  for(const [index,window] of receipt.windows.entries()){
    assert.ok(window.activeTicks>=4800+index*3600);
    assert.ok(window.samples>0&&window.p95>0&&window.p95<=25&&window.p99<=50&&window.p99>=window.p95);
    assert.ok(window.peakObjects<=128);
    if(index>0)assert.ok(window.elapsedMs>receipt.windows[index-1].elapsedMs);
  }
  const routeFiles=enduranceStem?[enduranceStem+'-long-score-trace.json',enduranceStem+'-score-trace.json']:
    ['long-score-trace.json','delivery-score-trace.json'];
  assert.deepEqual(receipt.routes.map(route=>route.file),routeFiles);
  for(const route of receipt.routes)assert.equal(sha(await readFile(join(gameDir,route.file))),route.sha256);
  for(const [index,run] of receipt.runs.entries()){
    const route=receipt.routes[index>=1&&index<=10?1:0];
    assert.deepEqual([run.trace,run.ticks,run.score,run.hash],[route.file,route.ticks,route.score,route.hash]);
    assert.equal(run.diagnostics.contextState,'healthy');
    assert.equal(run.diagnostics.adapter.disposed,false);
  }
  const complete=receipt.status==='PASS';
  if(complete){
    assert.ok(receipt.activeTicks>=seconds*60&&receipt.wallMs>=seconds*1000-1000);
    assert.ok(receipt.peakObjects<=128&&receipt.restartCount>=10&&receipt.runs.length>=11);
    assert.equal(receipt.disposal.listenersActive,false);
    assert.equal(receipt.disposal.adapter.disposed,true);
    assert.equal(receipt.disposal.resources.disposed,true);
    assert.equal(receipt.disposal.resources.ownedResources,0);
    assert.equal(receipt.disposal.feedback.audio.disposed,true);
    assert.equal(receipt.disposal.feedback.audio.voices,0);
    assert.equal(receipt.disposal.gamepad.disposed,true);
    assert.equal(receipt.disposal.mobile.listenersActive,false);
    if(backend==='air'){
      assert.equal(receipt.disposal.adapter.ownedNodes,0);
      assert.equal(receipt.disposal.adapter.sceneAlive,false);
      assert.equal(receipt.disposal.adapter.release.status,'released');
      assert.deepEqual(receipt.disposal.adapter.release.pending,[]);
      assert.deepEqual(receipt.disposal.adapter.release.failures,[]);
    }else{
      assert.equal(receipt.disposal.adapter.ownedMeshes,0);
      assert.deepEqual(receipt.disposal.adapter.gpu,{geometries:0,textures:0});
    }
  }else assert.equal(receipt.status,'IN_PROGRESS');
  return {receipt,complete,summary:{backend,status:receipt.status,
    measuredTicks:receipt.activeTicks??receipt.windows.at(-1).activeTicks,
    wallMs:receipt.wallMs??receipt.windows.at(-1).elapsedMs,rounds:receipt.runs.length,
    worstP95:Math.max(...receipt.windows.map(window=>window.p95)),
    worstP99:Math.max(...receipt.windows.map(window=>window.p99))}};
}

const air=offlineOnly?undefined:await checkEndurance(airFile,'air');
const three=!offlineOnly&&threeFile?await checkEndurance(threeFile,'three'):undefined;
let sharedRounds=0;
if(three){
  assert.deepEqual(air.receipt.environment,three.receipt.environment);
  assert.deepEqual(air.receipt.routes,three.receipt.routes);
  sharedRounds=Math.min(air.receipt.runs.length,three.receipt.runs.length);
  const terminal=({trace,ticks,score,hash})=>({trace,ticks,score,hash});
  assert.deepEqual(air.receipt.runs.slice(0,sharedRounds).map(terminal),three.receipt.runs.slice(0,sharedRounds).map(terminal));
}

let offline;
if(deliveryFile){
  if(!offlineOnly)assert.ok(air.complete&&three?.complete,'Both normal-clock runs must finish before signing the browser evidence');
  const receipt=await read(deliveryFile),ids=['skylinePatrol','patternHarbor','tideglassMatch','tideglassCombos'];
  assert.equal(receipt.status,'PASS');
  assert.deepEqual(new Set(receipt.integrityRejections),new Set(ids));
  assert.equal(receipt.results.length,2*ids.length);
  for(const [index,id] of ids.entries()){
    const root=resolve(status.refreshedStandalonePackages[id]);
    assert.equal(resolve(receipt.packages[id]),root);
    const bytes=await readFile(join(root,'build-inventory.json'));
    assert.deepEqual(receipt.inventories[id],{files:JSON.parse(bytes).files.length,releases:[1,2,12,6][index],sha256:sha(bytes)});
    const runs=receipt.results.filter(result=>result.id===id);
    assert.deepEqual(new Set(runs.map(run=>run.engine)),new Set(['air','three']));
    assert.ok(runs.every(run=>run.status==='PASS'));
    if(id==='patternHarbor'||id==='tideglassMatch')assert.ok(runs.every(run=>run.soundRestored===true));
  }
  if(!offlineOnly||receipt.narrowViewport){
    assert.equal(receipt.narrowViewport?.length,6);
    for(const id of ids.slice(0,3)){
      const views=receipt.narrowViewport.filter(view=>view.id===id);
      assert.equal(views.length,2);
      assert.deepEqual(new Set(views.map(view=>view.engine)),new Set(['air','three']));
      assert.ok(views.every(view=>view.dpr===2&&view.width===390&&view.scroll<=391&&view.input==='browser-touch-emulation'));
    }
  }
  offline={status:'PASS',cases:receipt.results.length,integrityRejections:receipt.integrityRejections.length,
    narrowViewport:receipt.narrowViewport?.length??'NOT_RUN'};
}
console.log(JSON.stringify({
  status:offlineOnly?'PASS_OFFLINE_EVIDENCE':air.complete&&three?.complete?(enduranceStem?'PASS_'+enduranceStem.toUpperCase().replaceAll('-','_')+'_ENDURANCE':offline?'PASS_BROWSER_EVIDENCE':'IN_PROGRESS'):'IN_PROGRESS',
  endurance:[air?.summary,three?.summary].filter(Boolean),
  sameRoutePrefix:three?true:offlineOnly?'NOT_CHECKED':'PENDING_THREE',
  verifiedSharedTerminals:sharedRounds,
  offline:offline??{status:'NOT_RUN'}
},null,2));
