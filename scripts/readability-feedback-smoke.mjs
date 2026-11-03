/** Local synthetic WPE regression, not a model repair experiment or visual acceptance. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {webkit} from 'playwright';
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {root} from './registry.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {playSolution} from './agent-solver.mjs';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
const directory=join(root,'reports/readability-feedback-smoke-'+randomUUID());mkdirSync(directory,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),sha=p=>hash(readFileSync(p));
const rel=p=>relative(root,p).replaceAll('\\','/');
const save=(name,value)=>writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const files=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>['node_modules','vendor'].includes(e.name)?[]:e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const fingerprints=Object.fromEntries([...['src','dist','player','generator','integrations'].flatMap(files),
 'scripts/readability-feedback-smoke.mjs','scripts/mcp-server.mjs','scripts/agent-solver.mjs','scripts/registry.mjs',
 'package.json','package-lock.json'].map(p=>[p,sha(join(root,p))]));save('fingerprints.json',fingerprints);
const report={format:'a2game-readability-feedback-smoke',version:1,status:'FAIL',modelCalls:0,
 provenance:'SYNTHETIC_PREDETERMINED_FIXTURES_NOT_AGENT_REPAIR',browserEngine:'WEBKIT_WPE',
 scope:'Local stdio MCP / both prepared SDKs / narrow viewport advisory feedback only',
 visualAcceptance:'NOT_RUN',humanReview:'NOT_RUN',G3:'NOT_RUN',cases:[],negative:[]};
const client=new Client({name:'synthetic-readability-feedback-smoke',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs')],cwd:root,env:{...process.env},stderr:'pipe'});
let browser,stage='setup';
async function call(name,args,ok=true){
 const raw=await client.callTool({name,arguments:args},undefined,{timeout:180000});
 const result=raw.structuredContent??JSON.parse(raw.content[0].text);
 if(ok)assert.equal(result.status,'PASS_REFERENCE',`MCP ${name} failed`);
 // Never archive process stderr, unbounded tool text, or low-level exception messages.
 return result;
}
try{
 report.sdkProvenance=JSON.parse(readFileSync(join(root,'player/vendor/sdk-provenance.json'),'utf8'));
 for(const f of report.sdkProvenance.files)assert.equal(sha(join(root,f.path)),f.sha256);
 await client.connect(transport);
 const launch=browserLaunchOptions();assert.ok(launch.executablePath,'Explicit local WPE executable required');
 browser=await webkit.launch(launch);report.browser={...browserIdentity(browser,launch),wrapperSha256:sha(launch.executablePath),versionSource:'PLAYWRIGHT_DRIVER_REPORTED'};
 // Optional explicit local binary provenance; never assume a machine/version-specific wrapper layout.
 const binary=process.env.A2GAME_BROWSER_BINARY;
 if(binary){assert.ok(isAbsolute(binary),'Browser binary provenance requires an absolute local path');report.browser.binary={path:binary,sha256:sha(binary),source:'EXPLICIT_LOCAL_BINARY'};}
 else report.browser.binary={source:'NOT_ATTESTED'};
 const previous=new Map();
 for(const [variant,fontSize] of [['small',0.15],['predetermined-large',0.65]]){
  stage=variant+' admission';
  const fixture=createFixture();for(const node of fixture.game.presentation.scene2d.nodes)if(node.kind==='text')node.fontSize=fontSize;
  const gameJson=JSON.stringify(fixture.game),bytesHash=hash(gameJson);
  save(variant+'-fixture.json',fixture);
  const expected=playSolution(fixture.game,fixture.solution);
  const artifact=(await call('a2game.validate_game',{gameJson,conformanceJson:JSON.stringify(fixture.conformance),solutionJson:JSON.stringify(fixture.solution)})).data;
  assert.equal(artifact.files['game.json'],bytesHash);save(variant+'-artifact.json',artifact);
  const artifactPath=join(root,artifact.path,'game.json');assert.equal(readFileSync(artifactPath,'utf8'),gameJson);
  const tested=(await call('a2game.test_game',{artifactId:artifact.artifactId})).data;
  assert.equal(tested.exactHash,expected.final.exactHash);assert.deepEqual(tested.trace,expected.trace);
  for(const backend of ['air','three'])for(const width of [320,390]){
   stage=`${variant} ${backend} ${width}`;
   const preview=(await call('a2game.preview_game',{action:'open',artifactId:artifact.artifactId,backend})).data;
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
   page.on('pageerror',()=>errors.push('PAGE_ERROR'));
   try{
    await page.goto(preview.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing');
    assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
    const measured=await page.evaluate(()=>{
     const before=window.__a2game.getState().exactHash,d=window.__a2game.getTextReadability(),rect=document.querySelector('#GameCanvas').getBoundingClientRect();
     return {before,after:window.__a2game.getState().exactHash,status:d.status,referenceCssPx:d.referenceCssPx,
      viewport:{width:innerWidth,height:innerHeight},measuredCanvasRect:d.measuredCanvasRect,scene:d.scene,
      texts:d.texts.map(({fontScene,nominalTextCssPx})=>({fontScene,nominalTextCssPx})),
      actualCanvasRect:Object.fromEntries(['left','top','width','height'].map(k=>[k,rect[k]]))};
    });
    assert.equal(measured.before,measured.after);assert.equal(measured.status,'DIAGNOSTIC_ONLY');
    assert.deepEqual(measured.actualCanvasRect,measured.measuredCanvasRect);assert.equal(measured.viewport.width,width);
    const {before,after,actualCanvasRect,...numeric}=measured;
    const observation={...numeric,previewId:preview.previewId,gameSha256:bytesHash,backend};
    const legacy=(await call('a2game.inspect_game',{artifactId:artifact.artifactId})).data;
    assert.equal(legacy.textReadability,undefined);
    const inspected=(await call('a2game.inspect_game',{artifactId:artifact.artifactId,textReadability:observation})).data;
    const {textReadability,...unchanged}=inspected;assert.deepEqual(unchanged,legacy);
    assert.equal(inspected.files['game.json'],bytesHash);assert.equal(inspected.finalHash,expected.final.exactHash);
    assert.equal(readFileSync(artifactPath,'utf8'),gameJson);assert.equal(sha(artifactPath),bytesHash);
    assert.equal(textReadability.provenance,'HOST_REPORTED_UNVERIFIED');assert.equal(textReadability.visualAcceptance,'NOT_RUN');
    const key=backend+'-'+width,small=textReadability.warnings.filter(w=>w.code==='SMALL_TEXT').length;
    if(variant==='small'){assert.ok(small>0);previous.set(key,{observation,small});}
    else{
     const old=previous.get(key);assert.ok(small<old.small);
     for(const stale of [old.observation,{...old.observation,previewId:preview.previewId}]){
      const rejected=await call('a2game.inspect_game',{artifactId:artifact.artifactId,textReadability:stale},false);
      assert.equal(rejected.status,'FAIL');assert.equal(rejected.diagnostics[0].code,'A2G_MCP_READABILITY_BINDING');
      assert.ok(!JSON.stringify(rejected).includes(root));assert.ok(!JSON.stringify(rejected).includes('stack'));
      report.negative.push({backend,width,code:rejected.diagnostics[0].code,oldPreview:stale.previewId===old.observation.previewId});
     }
    }
    await page.screenshot({path:join(directory,variant+'-'+key+'-initial.png'),fullPage:true});
    for(const [i,row] of fixture.solution.entries()){
     await page.locator('h1').first().click();await page.keyboard.press('Space');
     await page.evaluate(ticks=>window.__a2game.step(ticks),row.ticks);
     assert.equal(await page.evaluate(()=>window.__a2game.getState().exactHash),expected.trace[i].hash);
    }
    assert.equal(await page.evaluate(()=>window.__a2game.getState().flow.status),'won');
    await page.screenshot({path:join(directory,variant+'-'+key+'-won.png'),fullPage:true});
    await page.evaluate(()=>window.__a2game.dispose());const stats=await page.evaluate(()=>window.__a2game.diagnostics());
    assert.equal(stats.resources.ownedResources,0);assert.equal(stats.listenersActive,false);assert.equal(stats.adapter.disposed,true);assert.deepEqual(errors,[]);
    report.cases.push({variant,backend,width,status:'PASS_REFERENCE',artifactId:artifact.artifactId,gameSha256:bytesHash,
     initialHash:before,finalHash:expected.final.exactHash,observation,textReadability,keyboardSpacePresses:3,resourcesReleased:true});
   }finally{await context.close();await call('a2game.preview_game',{action:'close',previewId:preview.previewId});await assert.rejects(fetch(preview.url));}
  }
 }
 report.status='PASS_REFERENCE';
}catch(error){report.failure={stage,code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'SMOKE_ASSERTION_OR_RUNTIME_FAILURE'};process.exitCode=1;}
finally{
 await browser?.close();await client.close();
 report.sourcesUnchanged=Object.entries(fingerprints).every(([p,h])=>sha(join(root,p))===h);
 report.sdkBytesUnchanged=report.sdkProvenance?.files.every(f=>sha(join(root,f.path))===f.sha256)??false;
 if(!report.sourcesUnchanged||!report.sdkBytesUnchanged){report.status='FAIL';report.sourceDrift=true;process.exitCode=1;}
 report.screenshots=Object.fromEntries(readdirSync(directory).filter(p=>p.endsWith('.png')).map(p=>[p,sha(join(directory,p))]));
 save('summary.json',report);console.log(JSON.stringify({status:report.status,receipt:rel(join(directory,'summary.json')),failure:report.failure}));
}
