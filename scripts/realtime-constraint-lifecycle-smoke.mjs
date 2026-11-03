/** Synthetic real-SDK lifecycle regression only; no author games, benchmark answers or model calls. */
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry,root} from './registry.mjs';
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
import {playSolution} from './agent-solver.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createConnection} from 'node:net';
const ref=id=>({id,version:'0.1.0'});
const body=(id,kind,x,y,extra={})=>({id,kind,x,y,vx:0,vy:0,hx:20,hy:20,hp:1,team:kind==='actor'?1:2,value:0,fixed:kind!=='actor',...extra});
const initial={bodies:[body('actor','actor',200,250),body('obstacle','target',400,250),body('retiring_target','target',700,650,{value:3}),body('synthetic_shot','projectile',700,650,{team:1,value:1}),body('ttl_target','target',750,400,{ttl:1})],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false};
const config={statePath:'/world',width:1000,height:1000,maxObjects:8,gravity:0,moveSpeed:64,heldMovement:true,actions:{right:'right'},goalTick:8,
 constraints:['actor','retiring_target','ttl_target'].map(body=>({body,minX:100,maxX:900,minY:100,maxY:900}))};
const game={format:'a2game',specVersion:'0.1.0',id:'org.a2game.synthetic.constraint-lifecycle',revision:1,meta:{title:'Synthetic constraint retirement',genres:['casual'],description:'Engineering fixture: retire target/TTL, then move into contact to verify actor loss.'},
 requires:{all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text','a2game.realtime.world'].map(ref)},
 world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:71,maxCatchUpTicks:5}},assets:{},prototypes:{},
 scenes:[{id:'main',entities:[{id:'world-controller',components:[{capability:ref('a2game.realtime.world'),config}]}]}],entryScene:'main',state:{world:{type:'object',initial}},
 inputs:{actions:[{id:'right',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'ArrowRight',hold:true}}]}]},rules:[],outcomes:[{id:'done',status:'won',when:{state:'/world/won'}},{id:'dead',status:'lost',when:{state:'/world/lost'}}],
 presentation:{hud:[{id:'scope',kind:'text',text:'Synthetic regression only: right moves into contact'}],cues:[],scene2d:{width:1.2,height:1.3,background:'#102030',nodes:[{id:'label',kind:'text',at:[0,0.57],fontSize:0.06,fill:'#ffffff',text:{literal:'SYNTHETIC LIFECYCLE'}}],bodyLayer:{statePath:'/world/bodies',unitsPerMeter:1000,origin:[-0.5,-0.5],palette:{actor:'#45e6c0',target:'#ffb454',solid:'#99aabb',projectile:'#ffffff',pickup:'#ee99ff'}}}},tests:['../tests/synthetic-constraint-lifecycle.conformance.json'],extensions:{}};
const check=(path,equals)=>({op:'assert',path,equals}),raw=kind=>({source:'keyboard',kind,payload:{code:'ArrowRight'}});
const solution=[{ticks:8}];
const conformance={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'synthetic-constraint-lifecycle',subject:{type:'game',id:game.id,file:'../games/synthetic-constraint-lifecycle.game.json'},cases:[
 {id:'retirement-next-tick-and-survival',seed:71,steps:[{op:'start'},{op:'step',ticks:2},check('/state/world/bodies',initial.bodies.slice(0,2)),check('/state/world/score',3),check('/flow/status','playing'),{op:'step',ticks:6},check('/flow/status','won')]},
 {id:'held-contact-is-a-normal-loss',seed:71,steps:[{op:'start'},{op:'injectRaw',raw:raw('down')},{op:'step',ticks:3},check('/state/world/lost',true),check('/flow/status','lost')]}
]};
const admissionOnly=process.argv.includes('--admission-only'),directory=join(root,'reports/realtime-constraint-lifecycle-'+randomUUID());mkdirSync(directory,{recursive:true});
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),rel=path=>relative(root,path).replaceAll('\\','/');
const save=(name,value)=>writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const report={format:'a2game-realtime-constraint-lifecycle-smoke',version:1,status:'FAIL',scope:'SYNTHETIC_REFERENCE',admissionOnly,excludedFrom:'Frozen host experiments, independent authoring and real-client acceptance',sourceFingerprint:hostSourceFingerprint(),modelCalls:0,providerBudget:0,formalG3:'NOT_RUN',human:'NOT_RUN',cases:[]};
const client=new Client({name:'a2game-synthetic-constraint-lifecycle',version:'1.0.0'}),transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs'),'--max-calls','0'],cwd:root,env:{...process.env},stderr:'pipe'});
transport.stderr?.on('data',bytes=>process.stderr.write(bytes));let browser,callIndex=0;
async function call(name,args){const response=await client.callTool({name,arguments:args},undefined,{timeout:180000});save('mcp-'+String(++callIndex).padStart(2,'0')+'.json',{name,args,response});const result=response.structuredContent??JSON.parse(response.content.find(c=>c.type==='text').text);assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));return result.data;}
async function portClosed(url){const {hostname,port}=new URL(url);return await new Promise((resolve,reject)=>{const socket=createConnection({host:hostname.replace(/^\[|\]$/g,''),port:Number(port)});socket.setTimeout(5000);socket.once('connect',()=>{socket.destroy();reject(Error('Preview port is still accepting connections'));});socket.once('timeout',()=>{socket.destroy();reject(Error('Preview port closure probe timed out'));});socket.once('error',error=>{socket.destroy();if(error.code==='ECONNREFUSED')resolve({closed:true,observation:'ECONNREFUSED'});else reject(error);});});}
async function parity(page,annotations){
 const operations=await page.evaluate(()=>window.__a2game.getOperations()),runtime=new HeadlessRuntime(game,makeRegistry()),snapshots=new Map();runtime.start();
 try{
  for(let i=0;i<=operations.length;i++){
   for(const marker of annotations.filter(m=>m.beforeOperation===i)){if(marker.op==='snapshot')snapshots.set(marker.key,runtime.snapshot());else if(marker.op==='restore'){assert.ok(snapshots.has(marker.key));runtime.restore(snapshots.get(marker.key));}else throw Error('Unknown snapshot marker');}
   if(i===operations.length)break;const op=operations[i];
   if(op.op==='raw')runtime.injectRaw(op.input);else if(op.op==='action')runtime.injectAction(op.input);else if(op.op==='step')runtime.step(op.ticks);else if(['pause','resume','restart'].includes(op.op))runtime[op.op]();else throw Error('Unexpected recorded operation '+op.op);
  }
  const observed=await page.evaluate(()=>window.__a2game.getState()),node=runtime.observe();assert.equal(observed.exactHash,node.exactHash);assert.deepEqual(observed.state,node.state);assert.deepEqual(observed.flow,node.flow);assert.deepEqual(observed.diagnostics,[]);
  return {observed,nodeHash:node.exactHash,operations,controllerSnapshotMarkers:structuredClone(annotations)};
 }finally{runtime.dispose();}
}
async function screenshot(page,name){
 const readState=()=>page.evaluate(()=>{const state=window.__a2game.getState();return {exactHash:state.exactHash,tickIndex:state.tickIndex};});
 const before=await readState();
 // Let both SDK render loops present the manual-clock state without advancing simulation.
 const paint=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const started=performance.now(),timer=setTimeout(()=>reject(Error('Two-frame paint barrier timed out after 5000ms')),5000);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve({frames:2,timeoutMs:5000,elapsedMs:performance.now()-started});}));
 }));
 const afterPaint=await readState();assert.deepEqual(afterPaint,before,'Paint barrier advanced simulation');
 await page.screenshot({path:join(directory,name),fullPage:true,timeout:5000});
 const afterScreenshot=await readState();assert.deepEqual(afterScreenshot,before,'Screenshot advanced simulation');
 return {path:name,sha256:sha(join(directory,name)),paintBarrier:{...paint,before,afterPaint,afterScreenshot,stateUnchanged:true}};
}
try{
 for(const [name,value]of Object.entries({game,conformance,solution}))save(name+'.json',value);
 const expected=playSolution(game,solution);save('node-solution.json',expected);
 report.sdk=JSON.parse(readFileSync(join(root,'player/vendor/sdk-provenance.json'),'utf8'));for(const file of report.sdk.files)assert.equal(sha(join(root,file.path)),file.sha256);
 await client.connect(transport);const artifact=await call('a2game.validate_game',{gameJson:JSON.stringify(game),conformanceJson:JSON.stringify(conformance),solutionJson:JSON.stringify(solution)});report.artifactId=artifact.artifactId;
 assert.equal((await call('a2game.test_game',{artifactId:artifact.artifactId})).exactHash,expected.final.exactHash);assert.equal((await call('a2game.inspect_game',{artifactId:artifact.artifactId})).finalHash,expected.final.exactHash);
 if(!admissionOnly){
  const options=browserLaunchOptions();assert.ok(options.executablePath,'Explicit existing WPE/WebKit executable required; no browser installation or flags are changed');browser=await webkit.launch(options);report.browser={...browserIdentity(browser,options),engine:'WEBKIT_WPE',versionSource:'PLAYWRIGHT_DRIVER_REPORTED_NOT_BINARY_ATTESTATION',wrapperSha256:sha(options.executablePath)};
  for(const backend of ['air','three']){
   const receipt={backend,status:'FAIL',checkpoints:[],screenshots:[]},annotations=[];report.cases.push(receipt);let preview,context;
   try{
    preview=await call('a2game.preview_game',{action:'open',artifactId:artifact.artifactId,backend});context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage(),pageErrors=[],consoleErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    await page.goto(preview.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing');assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);receipt.userAgent=await page.evaluate(()=>navigator.userAgent);
    const first=await parity(page,annotations);receipt.checkpoints.push({phase:'initial',...first});receipt.screenshots.push(await screenshot(page,backend+'-initial.png'));
    await page.evaluate(()=>window.__a2game.step(1));let point=await parity(page,annotations);assert.deepEqual(point.observed.state.world.bodies.map(b=>b.id),['actor','obstacle']);assert.equal(point.observed.state.world.score,3);assert.equal(point.observed.flow.status,'playing');receipt.checkpoints.push({phase:'target-and-ttl-retired',...point});
    const index=await page.evaluate(()=>window.__a2game.getOperations().length),snapshot=await page.evaluate(()=>window.__a2game.runtime.snapshot());annotations.push({op:'snapshot',key:'after-retirement',beforeOperation:index});
    await page.evaluate(()=>window.__a2game.step(2));const replayExpected=await parity(page,annotations);assert.equal(replayExpected.observed.flow.status,'playing');
    const restoreIndex=await page.evaluate(()=>window.__a2game.getOperations().length);await page.evaluate(value=>window.__a2game.runtime.restore(value),snapshot);annotations.push({op:'restore',key:'after-retirement',beforeOperation:restoreIndex});
    await page.evaluate(()=>window.__a2game.step(2));point=await parity(page,annotations);assert.equal(point.observed.exactHash,replayExpected.observed.exactHash);receipt.snapshotReplay={status:'PASS_REFERENCE',expected:replayExpected.nodeHash,actual:point.nodeHash};receipt.checkpoints.push({phase:'retired-next-ticks-snapshot-replay',...point});
    await page.locator('#restart').click();assert.equal((await parity(page,annotations)).observed.exactHash,first.observed.exactHash);
    await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__a2game.getState());await page.evaluate(()=>window.__a2game.step(2));assert.deepEqual(await page.evaluate(()=>window.__a2game.getState()),paused);await parity(page,annotations);await page.locator('#pause').click();
    await page.locator('#GameCanvas').click({position:{x:35,y:35}});assert.equal(await page.evaluate(()=>document.activeElement?.id),'GameCanvas');await page.keyboard.down('ArrowRight');
    for(let tick=1;tick<=3;tick++){await page.evaluate(()=>window.__a2game.step(1));point=await parity(page,annotations);receipt.checkpoints.push({phase:'canvas-held-right-'+tick,...point});if(tick===1){assert.equal(point.observed.state.world.bodies.find(b=>b.id==='actor').x,264);receipt.screenshots.push(await screenshot(page,backend+'-progress.png'));}}
    await page.keyboard.up('ArrowRight');assert.equal(point.observed.flow.status,'lost');assert.equal(point.observed.state.world.lost,true);assert.equal(point.observed.state.world.bodies.some(b=>b.id==='actor'),false);assert.equal(point.observed.events.filter(e=>e.type==='combat.death'&&e.payload.id==='actor').length,1);
    receipt.screenshots.push(await screenshot(page,backend+'-lost.png'));const terminal=await page.evaluate(()=>window.__a2game.getState());await page.evaluate(()=>window.__a2game.step(2));assert.deepEqual(await page.evaluate(()=>window.__a2game.getState()),terminal);await parity(page,annotations);
    const rejection=await page.evaluate(()=>{try{window.__a2game.runtime.injectAction({action:'right',phase:'press'});return 'ACCEPTED';}catch(e){return e.code;}});assert.equal(rejection,'A2G_E_FLOW');receipt.terminalInputRejected=true;
    await page.locator('#stageRestart').click();assert.equal((await parity(page,annotations)).observed.exactHash,first.observed.exactHash);receipt.restartedAfterLoss=true;
    await page.evaluate(()=>window.__a2game.step(8));point=await parity(page,annotations);assert.equal(point.observed.flow.status,'won');assert.equal(point.observed.state.world.score,3);receipt.checkpoints.push({phase:'survival-won',...point});receipt.screenshots.push(await screenshot(page,backend+'-won.png'));
    await page.evaluate(()=>window.__a2game.dispose());const stats=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(stats.resources.ownedResources,0);assert.equal(stats.listenersActive,false);assert.equal(stats.adapter.disposed,true);receipt.disposal=stats;receipt.pageErrors=pageErrors;receipt.consoleErrors=consoleErrors;assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);receipt.status='PASS_REFERENCE';
   }finally{try{await context?.close();}finally{if(preview){const closed=await call('a2game.preview_game',{action:'close',previewId:preview.previewId});assert.equal(closed.closeReason,'explicit');receipt.explicitClose=true;receipt.portClosed=await portClosed(preview.url);}}}
  }
 }
 report.status=admissionOnly?'PASS_ADMISSION_REFERENCE':'PASS_REFERENCE';
}catch(error){report.failure=String(error.stack??error);process.exitCode=1;}
finally{try{await browser?.close();}finally{await client.close();report.sourcesUnchanged=hostSourceFingerprint()===report.sourceFingerprint;if(!report.sourcesUnchanged){report.status='FAIL';process.exitCode=1;}save('result.json',report);console.log(JSON.stringify({status:report.status,receipt:rel(join(directory,'result.json'))}));}}
