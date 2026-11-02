/** Real stdio clients, shared service, no provider dispatch. Optional external model JSON stays unchanged. */
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserLaunchOptions,browserIdentity} from './browser-launch.mjs';
import {root,makeRegistry} from './registry.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {playSolution} from './agent-solver.mjs';
import {contracts} from '../integrations/mcp/contract.mjs';
const directory=join(root,'reports/generator-mcp-'+randomUUID());mkdirSync(directory,{recursive:true});
const rel=p=>relative(root,p).replaceAll('\\','/'),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),save=(n,v)=>writeFileSync(join(directory,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const report={format:'a2game-mcp-smoke',version:1,status:'FAIL',mcpToolContractVersion:1,modelCalls:0,provenance:'HOST_AUTHORED_EXERCISE_NOT_MODEL_OR_G3',clients:[],cases:[],negative:{},humanReview:'NOT_RUN',G3:'NOT_RUN'};
const files=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>['vendor','node_modules'].includes(e.name)?[]:e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const sourceFiles=[...files('generator'),...files('integrations'),...files('scripts'),...files('src'),...files('player'),'package.json','package-lock.json'];
const fingerprints=Object.fromEntries(sourceFiles.map(p=>[p,sha(join(root,p))]));save('fingerprints.json',fingerprints);
report.sdkProvenance=JSON.parse(readFileSync(join(root,'player/vendor/sdk-provenance.json'),'utf8'));for(const f of report.sdkProvenance.files)assert.equal(sha(join(root,f.path)),f.sha256);
let output=createFixture();output.game.id='org.a2game.mcp.energy-exercise';output.game.meta.title='能量收集练习';output.game.state.goal.initial=4;
output.game.presentation.scene2d.nodes[0].text.literal='能量收集练习';output.game.tests=['../tests/mcp-energy.conformance.json'];
output.solution.push({action:'collect',ticks:1});output.conformance.suiteId='mcp-energy-exercise';output.conformance.subject.id=output.game.id;
output.conformance.cases[0].steps.splice(-2,2,{op:'injectAction',action:'collect',phase:'press'},{op:'injectAction',action:'collect',phase:'release'},{op:'step',ticks:1},{op:'assert',path:'/state/score',equals:4},{op:'assert',path:'/flow/status',equals:'won'});
if(process.argv[2]){
 const input=resolve(process.argv[2]);output=Object.fromEntries(['game','conformance','solution'].map(k=>[k,JSON.parse(readFileSync(join(input,k+'.json'),'utf8'))]));
 assert.ok(output.solution.every(row=>!row.raw?.length&&(!row.action||output.game.inputs.actions.some(a=>a.id===row.action&&a.valueType==='button'))));
 report.provenance='EXTERNAL_GENERATED_JSON_REVALIDATION_NO_NEW_MODEL_CALLS';report.externalInput={path:rel(input),gameSha256:sha(join(input,'game.json')),generationReportSha256:existsSync(join(input,'generation-report.json'))?sha(join(input,'generation-report.json')):null,sourceIdentity:'NOT_AUTHENTICATED_BY_REVALIDATION'};
}
const gameDirectory=join(directory,'exercise');mkdirSync(gameDirectory);for(const k of ['game','conformance','solution'])writeFileSync(join(gameDirectory,k+'.json'),JSON.stringify(output[k],null,2)+'\n');
const args={gameJson:JSON.stringify(output.game),conformanceJson:JSON.stringify(output.conformance),solutionJson:JSON.stringify(output.solution)},expected=playSolution(output.game,output.solution),env={...process.env};
const client=new Client({name:'a2game-sdk-stdio-smoke',version:'1.0.0'}),transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs')],cwd:root,env,stderr:'pipe'});let browser;
async function call(name,args,ok=true){const response=await client.callTool({name,arguments:args},undefined,{timeout:180000});let result=response.structuredContent;try{result??=JSON.parse(response.content[0].text);}catch{assert.equal(response.isError,true);result={status:'FAIL',diagnostics:[{code:'SDK_SCHEMA_REJECTION'}]};}if(ok)assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));return result;}
try{
 await client.connect(transport);
 const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),Object.keys(contracts).sort());save('tools.json',tools);
 const list=await call('a2game.list_capabilities',{query:'grid',limit:5});assert.ok(list.data.capabilities.length);
 await call('a2game.get_capability',{id:list.data.capabilities[0].id,version:list.data.capabilities[0].version});
 await call('a2game.plan_game',{prompt:'点击收集能量计数，明确目标与未达目标测试。'});
 const artifact=(await call('a2game.validate_game',args)).data;save('artifact.json',artifact);
 const tested=await call('a2game.test_game',{artifactId:artifact.artifactId});assert.equal(tested.data.exactHash,expected.final.exactHash);assert.deepEqual(tested.data.trace,expected.trace);
 const inspected=await call('a2game.inspect_game',{artifactId:artifact.artifactId});assert.equal(inspected.data.finalHash,expected.final.exactHash);
 const exported=await call('a2game.export_game',{artifactId:artifact.artifactId});assert.equal(sha(resolve(root,exported.data.path)),exported.data.sha256);save('export.json',exported);
 report.negative.defaultBudget=(await call('a2game.generate_game',{prompt:'counter exercise',provider:'codex'},false)).diagnostics[0].code;assert.equal(report.negative.defaultBudget,'A2G_MCP_BUDGET');
 report.negative.pathTraversal=(await call('a2game.inspect_game',{artifactId:'../../project/sdk-lock.json'},false)).status??'SDK_SCHEMA_REJECTION';
 const unknown=await client.callTool({name:'a2game.execute_shell',arguments:{command:'echo forbidden'}});assert.equal(unknown.isError,true);report.negative.noShellTool=true;
 const bad=await call('a2game.validate_game',{gameJson:'{"bad":true} '},false);assert.equal(bad.status,'FAIL');report.negative.invalidGame=true;
 const extra=await client.callTool({name:'a2game.list_capabilities',arguments:{path:'../private'}});assert.equal(extra.isError,true);report.negative.extraFields=true;
 const oversized=await client.callTool({name:'a2game.plan_game',arguments:{prompt:'x'.repeat(8001)}});assert.equal(oversized.isError,true);report.negative.oversizedArguments=true;
 const secret=await client.callTool({name:'a2game.validate_game',arguments:{gameJson:'{"credential":"A2G_TEST_SECRET_SENTINEL"}'}});assert.equal(secret.isError,true);assert.ok(!JSON.stringify(secret).includes('A2G_TEST_SECRET_SENTINEL'));report.negative.noSensitiveEcho=true;
 // Same JSON through the existing CLI, with no provider configured or called.
 for(const [command,path]of [['validate',join(gameDirectory,'game.json')],['test',gameDirectory]]){
  const r=spawnSync(process.execPath,[join(root,'generator/cli.mjs'),command,path,'--json'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:180000});writeFileSync(join(directory,'cli-'+command+'.log'),r.stdout??'');assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'PASS_REFERENCE');
 }
 report.cliParity={gameSha256:sha(join(gameDirectory,'game.json')),exactHash:expected.final.exactHash,trace:expected.trace,validator:'Shared complete admission and test service; identical external JSON'};
 const launchOptions=browserLaunchOptions();browser=await chromium.launch(launchOptions);report.browser=browserIdentity(browser,launchOptions);
 for(const backend of ['air','three']){
  const preview=(await call('a2game.preview_game',{action:'open',artifactId:artifact.artifactId,backend})).data,context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(preview.url+'&clock=manual');await page.waitForFunction(()=>window.__a2game?.getState().flow.status==='playing');assert.equal(await page.evaluate(()=>window.__a2game.backend),backend);
  const first=await page.evaluate(()=>window.__a2game.getState().exactHash);await page.screenshot({path:join(directory,backend+'-initial.png'),fullPage:true});
  let keyboardActions=0,buttonActions=0;
  for(const [i,row]of output.solution.entries()){
   if(row.action&&row.value!==false){const action=output.game.inputs.actions.find(a=>a.id===row.action),key=action.bindings.find(b=>b.source==='keyboard.button')?.config?.code;
    if(key&&/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter|Escape|Backspace)$/.test(key)){await page.locator('h1').first().click();await page.keyboard.press(key);keyboardActions++;}
    else{const buttons=page.locator('button[data-action]'),index=await buttons.evaluateAll((elements,id)=>elements.findIndex(e=>e.dataset.action===id&&e.getBoundingClientRect().width>0),row.action);assert.ok(index>=0);await buttons.nth(index).click();buttonActions++;}
   }
   await page.evaluate(ticks=>window.__a2game.step(ticks),row.ticks);assert.equal(await page.evaluate(()=>window.__a2game.getState().exactHash),expected.trace[i].hash);
  }
  await page.screenshot({path:join(directory,backend+'-won.png'),fullPage:true});
  await page.locator('#restart').click();assert.equal(await page.evaluate(()=>window.__a2game.getState().exactHash),first);
  await page.evaluate(()=>window.__a2game.dispose());const stats=await page.evaluate(()=>window.__a2game.diagnostics());assert.equal(stats.resources.ownedResources,0);assert.equal(stats.listenersActive,false);assert.equal(stats.adapter.disposed,true);assert.equal(errors.length,0);await context.close();
  await call('a2game.preview_game',{action:'close',previewId:preview.previewId});await assert.rejects(fetch(preview.url));report.cases.push({backend,status:'PASS_REFERENCE',sourceInput:{keyboardActions,buttonActions},finalHash:expected.final.exactHash,resourcesReleased:true,listenerClosed:true});
 }
 report.clients.push({name:'Official TypeScript SDK Client',version:JSON.parse(readFileSync(join(root,'integrations/mcp/node_modules/@modelcontextprotocol/sdk/package.json'),'utf8')).version,status:'PASS_REFERENCE'});
 const fixtureClient=new Client({name:'a2game-explicit-fixture-transport-smoke',version:'1.0.0'}),fixtureTransport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/mcp-server.mjs'),'--provider','fixture','--max-calls','1'],cwd:root,env,stderr:'pipe'});
 try{
  await fixtureClient.connect(fixtureTransport);const generated=await fixtureClient.callTool({name:'a2game.generate_game',arguments:{prompt:'DEMO_FIXTURE counter exercise',provider:'fixture',maxAttempts:1}},undefined,{timeout:180000}),value=generated.structuredContent;
  assert.equal(value.status,'PASS_REFERENCE',JSON.stringify(generated));assert.equal(value.data.generationCalls,0);assert.equal(value.data.fixtureCalls,1);assert.equal(value.data.provenance,'DEMO_FIXTURE');report.explicitFixtureGeneration={status:'PASS_REFERENCE',fixtureCalls:1,modelCalls:0,provenance:'DEMO_FIXTURE'};
 }finally{await fixtureClient.close();}
 const python=process.env.A2GAME_PYTHON??join(root,'.venv/Scripts/python.exe'),raw=spawnSync(python,[join(root,'scripts/mcp-raw-client.py'),process.execPath,join(root,'scripts/mcp-server.mjs'),gameDirectory],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:2*1024*1024});writeFileSync(join(directory,'raw-client.stdout.log'),raw.stdout??'');writeFileSync(join(directory,'raw-client.stderr.log'),raw.stderr??'');assert.equal(raw.status,0,raw.stderr);const second=JSON.parse(raw.stdout);assert.equal(second.finalHash,expected.final.exactHash);save('raw-client.json',second);report.clients.push(second);
 report.status='PASS_REFERENCE';
}catch(e){report.failure=String(e.message);report.code=e.code??'A2G_MCP_SMOKE';process.exitCode=1;}
finally{await browser?.close();await client.close();report.sourcesUnchanged=Object.entries(fingerprints).every(([p,h])=>sha(join(root,p))===h);if(!report.sourcesUnchanged){report.status='FAIL';process.exitCode=1;}report.screenshots=Object.fromEntries(readdirSync(directory).filter(p=>p.endsWith('.png')).map(p=>[p,sha(join(directory,p))]));save('summary.json',report);console.log(JSON.stringify({status:report.status,receipt:rel(join(directory,'summary.json'))}));}
