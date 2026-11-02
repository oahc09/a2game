/** Synthetic real-SDK regression: constrained actor + three distinct wave arrivals.
 * No Pilot data, providers, external helpers or branded-host acceptance claims.
 */
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry,root} from './registry.mjs';
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
import {playSolution} from './agent-solver.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const ref=id=>({id,version:'0.1.0'});
const body=(id,kind,x,y)=>({id,kind,x,y,vx:0,vy:0,hx:20,hy:20,hp:1,team:kind==='actor'?1:2,value:0,fixed:kind!=='actor'});
const waveIds=['wave_alpha','wave_beta','wave_gamma'];
const world={bodies:[body('pilot_actor','actor',200,200)],score:0,charge:0,nextId:0,cooldowns:{},contacts:[],spawned:[],grounded:[],won:false,lost:false};
const config={statePath:'/world',width:1000,height:1000,maxObjects:4,gravity:0,moveSpeed:64,heldMovement:true,actions:{right:'right'},goalTick:8,
 constraints:[{body:'pilot_actor',minX:100,maxX:400,minY:100,maxY:400}],
 waves:waveIds.map((id,i)=>({tick:1+i*2,body:body(id,'target',600+i*100,700)}))};
const game={format:'a2game',specVersion:'0.1.0',id:'org.a2game.synthetic.constrained-waves',revision:1,
 meta:{title:'Synthetic constrained waves',genres:['casual'],description:'Synthetic regression only: three distinct arrivals while actor remains constrained.'},
 requires:{all:['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.input.keyboard.button','a2game.visual.scene2d','a2game.visual.text','a2game.realtime.world'].map(ref)},
 world:{dimension:'2d',coordinateSystem:'rh-y-up',units:'meter',clock:{tickHz:60,seed:93,maxCatchUpTicks:5}},assets:{},prototypes:{},
 scenes:[{id:'main',entities:[{id:'world-controller',components:[{capability:ref('a2game.realtime.world'),config}]}]}],entryScene:'main',
 state:{world:{type:'object',initial:world}},inputs:{actions:[{id:'right',valueType:'button',bindings:[{source:'keyboard.button',config:{code:'ArrowRight',hold:true}}]}]},
 rules:[],outcomes:[{id:'done',status:'won',when:{state:'/world/won'}},{id:'dead',status:'lost',when:{state:'/world/lost'}}],
 presentation:{hud:[{id:'scope',kind:'text',text:'SYNTHETIC: constrained actor / 3 arrivals'}],cues:[],scene2d:{width:1.2,height:1.3,background:'#102030',
 nodes:[{id:'label',kind:'text',at:[0,0.57],fontSize:0.05,fill:'#ffffff',text:{literal:'SYNTHETIC WAVE REGRESSION'}}],
 bodyLayer:{statePath:'/world/bodies',unitsPerMeter:1000,origin:[-0.5,-0.5],palette:{actor:'#45e6c0',target:'#ffb454',solid:'#99aabb',projectile:'#ffffff',pickup:'#ee99ff'}}}},
 tests:['../tests/synthetic-constrained-waves.conformance.json'],extensions:{}};
const raw=kind=>({source:'keyboard',kind,payload:{code:'ArrowRight'}});
const solution=[{raw:[raw('down')],ticks:6},{raw:[raw('up')],ticks:2}];
const check=(path,equals)=>({op:'assert',path,equals});
const conformance={format:'a2game-conformance',specVersion:'0.1.0',suiteId:'synthetic-constrained-waves',
 subject:{type:'game',id:game.id,file:'../games/synthetic-constrained-waves.game.json'},cases:[{id:'held-clamp-and-distinct-arrivals',seed:93,steps:[
 {op:'start'},{op:'injectRaw',raw:raw('down')},{op:'step',ticks:6},
 check('/state/world/bodies/0/x',380),check('/state/world/spawned',[0,1,2]),
 ...waveIds.map((id,i)=>check('/state/world/bodies/'+(i+1)+'/id',id)),check('/flow/status','playing'),
 {op:'injectRaw',raw:raw('up')},{op:'step',ticks:2},check('/state/world/bodies/0/vx',0),check('/flow/status','won')
 ]},{id:'early-arrival-is-not-completion-and-does-not-repeat',seed:93,steps:[{op:'start'},{op:'step',ticks:2},check('/state/world/spawned',[0]),check('/state/world/bodies/1/id','wave_alpha'),check('/flow/status','playing'),{op:'step',ticks:1},check('/state/world/spawned',[0]),check('/state/world/bodies/0/x',200),check('/flow/status','playing')]}]};

const admissionOnly=process.argv.includes('--admission-only');
const directory=join(root,'reports/realtime-wave-synthetic-'+randomUUID());mkdirSync(directory,{recursive:true});
const rel=p=>relative(root,p).replaceAll('\\','/'),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(name,value)=>writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const report={format:'a2game-realtime-wave-smoke',version:1,status:'FAIL',scope:'SYNTHETIC_REFERENCE',admissionOnly,excludedFrom:'15-cell simulated-host experiment and real-host acceptance',modelCalls:0,providerBudget:0,browserEngine:'WEBKIT_WPE',human:'NOT_RUN',formalG3:'NOT_RUN',sourceFingerprint:hostSourceFingerprint(),cases:[]};
const client=new Client({name:'a2game-synthetic-wave-regression',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs'),'--max-calls','0'],cwd:root,env:{...process.env},stderr:'pipe'});
let browser,callIndex=0;
transport.stderr?.on('data',bytes=>process.stderr.write(bytes));
async function call(name,args){
 const response=await client.callTool({name,arguments:args},undefined,{timeout:180000});
 save('mcp-'+String(++callIndex).padStart(2,'0')+'.json',{name,args,response});
 const result=response.structuredContent??JSON.parse(response.content.find(c=>c.type==='text').text);
 assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));return result;
}
async function parity(page){
 const operations=await page.evaluate(()=>window.__a2game.getOperations());
 const runtime=new HeadlessRuntime(game,makeRegistry());runtime.start();
 try{
  for(const op of operations){
   if(op.op==='raw')runtime.injectRaw(op.input);
   else if(op.op==='action')runtime.injectAction(op.input);
   else if(op.op==='step')runtime.step(op.ticks);
   else if(['pause','resume','restart'].includes(op.op))runtime[op.op]();
   else throw Error('Unexpected recorded operation '+op.op);
  }
  const observed=await page.evaluate(()=>window.__a2game.getState()),node=runtime.observe();
  assert.equal(observed.exactHash,node.exactHash);assert.deepEqual(observed.state,node.state);assert.deepEqual(observed.flow,node.flow);
  return {observed,nodeHash:node.exactHash,operations};
 }finally{runtime.dispose();}
}
try{
 for(const [name,value]of Object.entries({game,conformance,solution}))save(name+'.json',value);
 const expected=playSolution(game,solution);save('node-solution.json',expected);
 report.sdk=JSON.parse(readFileSync(join(root,'player/vendor/sdk-provenance.json'),'utf8'));
 for(const f of report.sdk.files)assert.equal(sha(join(root,f.path)),f.sha256);
 await client.connect(transport);
 const artifact=(await call('a2game.validate_game',{gameJson:JSON.stringify(game),conformanceJson:JSON.stringify(conformance),solutionJson:JSON.stringify(solution)})).data;
 report.artifactId=artifact.artifactId;
 assert.equal((await call('a2game.test_game',{artifactId:artifact.artifactId})).data.exactHash,expected.final.exactHash);
 assert.equal((await call('a2game.inspect_game',{artifactId:artifact.artifactId})).data.finalHash,expected.final.exactHash);
 if(!admissionOnly){
 const options=browserLaunchOptions();assert.ok(options.executablePath,'Explicit existing WPE/WebKit executable required; no browser is installed');
 browser=await webkit.launch(options);report.browser={...browserIdentity(browser,options),versionSource:'PLAYWRIGHT_DRIVER_REPORTED_NOT_BINARY_ATTESTATION',wrapperSha256:sha(options.executablePath)};
 for(const backend of ['air','three']){
  const receipt={backend,status:'FAIL',checkpoints:[]};report.cases.push(receipt);let preview,context;
  try{
   preview=(await call('a2game.preview_game',{action:'open',artifactId:artifact.artifactId,backend})).data;
   context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(preview.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing');
   assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);receipt.userAgent=await page.evaluate(()=>navigator.userAgent);
   const initial=(await parity(page)).observed;assert.deepEqual(initial.state.world.bodies.map(b=>b.id),['pilot_actor']);
   await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__a2game.getState());await page.evaluate(()=>window.__a2game.step(3));
   assert.deepEqual(await page.evaluate(()=>window.__a2game.getState()),paused);await parity(page);await page.locator('#pause').click();await page.locator('#restart').click();
   assert.equal((await parity(page)).observed.exactHash,initial.exactHash);receipt.pauseFrozen=true;
   await page.locator('h1').click();await page.keyboard.down('ArrowRight');
   let spawnEvents=[];
   for(let tick=1;tick<=6;tick++){
    await page.evaluate(()=>window.__a2game.step(1));const point=await parity(page),w=point.observed.state.world,actor=w.bodies.find(b=>b.id==='pilot_actor');
    assert.equal(actor.x,Math.min(200+64*tick,380));assert.equal(actor.y,200);
    const count=Math.floor(tick/2);assert.deepEqual(w.spawned,Array.from({length:count},(_,i)=>i));assert.deepEqual(w.bodies.map(b=>b.id),['pilot_actor',...waveIds.slice(0,count)]);
    // observe().events is cumulative history: inspect the complete list, never append it again.
    spawnEvents=point.observed.events.filter(e=>e.type==='realtime.spawned').map(e=>e.payload.id);assert.deepEqual(spawnEvents,waveIds.slice(0,count));receipt.checkpoints.push(point);
   }
   assert.deepEqual(spawnEvents,waveIds);receipt.distinctWaveEvents=spawnEvents;
   await page.keyboard.up('ArrowRight');await page.evaluate(()=>window.__a2game.step(2));
   const end=await parity(page);assert.equal(end.observed.flow.status,'won');assert.equal(end.observed.state.world.bodies[0].vx,0);assert.equal(end.observed.state.world.bodies[0].x,380);receipt.final=end;
   const screenshot=backend+'-three-arrivals.png';await page.screenshot({path:join(directory,screenshot),fullPage:true});receipt.screenshot={path:screenshot,sha256:sha(join(directory,screenshot))};
   await page.locator('#restart').click();assert.equal((await parity(page)).observed.exactHash,initial.exactHash);receipt.restarted=true;
   await page.evaluate(()=>window.__a2game.dispose());const stats=await page.evaluate(()=>window.__a2game.diagnostics());
   assert.equal(stats.resources.ownedResources,0);assert.equal(stats.listenersActive,false);assert.equal(stats.adapter.disposed,true);assert.deepEqual(errors,[]);
   receipt.disposal=stats;receipt.status='PASS_REFERENCE';
  }finally{
   try{await context?.close();}finally{if(preview){const closed=await call('a2game.preview_game',{action:'close',previewId:preview.previewId});assert.equal(closed.data.closeReason,'explicit');await assert.rejects(fetch(preview.url));receipt.explicitClose=true;}}
  }
 }
 const exported=await call('a2game.export_game',{artifactId:artifact.artifactId});assert.equal(sha(resolve(root,exported.data.path)),exported.data.sha256);report.export=exported.data;
 }
 report.status=admissionOnly?'PASS_ADMISSION_REFERENCE':'PASS_REFERENCE';
}catch(error){report.failure=String(error.stack??error);process.exitCode=1;}
finally{
 try{await browser?.close();}finally{await client.close();report.sourcesUnchanged=hostSourceFingerprint()===report.sourceFingerprint;if(!report.sourcesUnchanged){report.status='FAIL';process.exitCode=1;}save('result.json',report);console.log(JSON.stringify({status:report.status,receipt:rel(join(directory,'result.json'))}));}
}
