/** Prepare a host run and archive exact service receipts. Never dispatches a model or MCP tool. */
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,join,relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {contracts,resultSchema} from '../integrations/mcp/contract.mjs';

const root=resolve(import.meta.dirname,'..'),hosts=['qoder','trae','workbuddy','zcode'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const write=(path,data)=>writeFileSync(path,typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const inside=(base,path)=>{
 const parent=realpathSync(base),target=realpathSync(path);
 if(!target.startsWith(parent+sep))throw Error('Path must remain in its declared evidence directory');
 return target;
};
export function decodeHostResult(text){
 const prefix='The MCP server responded with: ';
 let value=JSON.parse(text.startsWith(prefix)?text.slice(prefix.length):text);
 if(value.structuredContent)value=value.structuredContent;
 else if(Array.isArray(value))value=JSON.parse(value.find(item=>item.type==='text').text);
 else if(value.content)value=JSON.parse(value.content.find(item=>item.type==='text').text);
 return value;
}
function runDirectory(run,workspace){return inside(join(workspace,'reports/host-first-evaluations'),resolve(workspace,run));}

export function initHostRun(host,workspace=root){
 if(!hosts.includes(host))throw Error('Unknown host');
 const base=join(workspace,'reports/host-first-evaluations');mkdirSync(base,{recursive:true});
 const parent=join(base,host);mkdirSync(parent,{recursive:true});inside(base,parent);
 const directory=join(parent,new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID());
 mkdirSync(directory);mkdirSync(join(directory,'candidate'));mkdirSync(join(directory,'calls'));mkdirSync(join(directory,'schemas'));
 for(const file of readdirSync(join(workspace,'specs/v0.1/schemas')).filter(name=>name.endsWith('.json'))){
  write(join(directory,'schemas',file),readFileSync(join(workspace,'specs/v0.1/schemas',file)));
 }
 write(join(directory,'TASK.md'),readFileSync(join(workspace,'docs/host-agent-pilot.md')));
 write(join(directory,'run.json'),{format:'a2game-host-agent-run',version:1,host,runId:basename(directory),createdAt:new Date().toISOString(),maxValidationAttempts:3,mcpProviderBudget:0,hostNativeUsage:'UNKNOWN',provenance:'HOST_NATIVE_GENERATION_PENDING',formalG3:'NOT_RUN'});
 return {run:relative(workspace,directory).replaceAll('\\','/'),task:'TASK.md',candidate:'candidate/',schemaContext:'schemas/',modelCalls:0};
}

export function captureHostCall(run,runId,workspace=root,hostResponseFile){
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(runId))throw Error('Expected response runId UUID');
 const directory=runDirectory(run,workspace),meta=json(join(directory,'run.json'));
 if(!hosts.includes(meta.host))throw Error('Invalid host run');
 const output=join(workspace,'output/mcp');
 const matches=readdirSync(output,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>join(output,e.name,runId+'.receipt.json')).filter(existsSync);
 if(matches.length!==1)throw Error('Expected exactly one service receipt for response runId');
 const source=inside(output,matches[0]),callFile=source.replace('.receipt.json','.call.json');
 if(!existsSync(callFile))throw Error('Call metadata missing; reconnect A2Game MCP after updating this checkout');
 inside(output,callFile);
 const bytes=readFileSync(source),response=resultSchema.parse(JSON.parse(bytes)),call=json(callFile);
 if(call.format!=='a2game-mcp-call'||call.runId!==runId||call.sessionId!==basename(resolve(source,'..'))||response.runId!==runId)throw Error('Call metadata does not bind this receipt');
 if(!Object.hasOwn(contracts,call.tool)||call.tool==='a2game.generate_game')throw Error('This run does not permit provider generation');
 if(call.budgetConsumed!==0||call.unknownCalls!==0)throw Error('MCP provider budget was consumed or is unknown');
 if(call.parameters.artifactId&&response.data?.artifactId&&call.parameters.artifactId!==response.data.artifactId)throw Error('Request and response artifact differ');
 const callRoot=inside(directory,join(directory,'calls'));
 const dest=join(callRoot,runId);mkdirSync(dest,{recursive:true});inside(directory,dest);
 const copy=(name,data)=>{const p=join(dest,name);if(existsSync(p)){if(!readFileSync(p).equals(data))throw Error('Existing captured bytes differ');}else write(p,data);};
 copy('server-response.json',bytes);copy('server-call.json',readFileSync(callFile));
 let comparison='NOT_CAPTURED';
 if(hostResponseFile){
  const hostBytes=readFileSync(inside(directory,resolve(directory,hostResponseFile)));copy('host-response.txt',hostBytes);
  try{comparison=isDeepStrictEqual(decodeHostResult(hostBytes.toString('utf8')),response)?'MATCH':'DIFFERENT';}catch{comparison='UNPARSEABLE';}
 }
 let packageFile=null;
 if(call.tool==='a2game.export_game'&&response.status==='PASS_REFERENCE'){
  const exported=inside(resolve(source,'..'),resolve(workspace,response.data.path));const pack=readFileSync(exported);
  if(sha(pack)!==response.data.sha256)throw Error('Export package SHA mismatch');
  copy('game.package.json',pack);packageFile='game.package.json';
 }
 if(call.tool==='a2game.preview_game'&&call.parameters.action==='close'&&response.data?.lifecyclePath){
  const event=inside(resolve(source,'..'),resolve(workspace,response.data.lifecyclePath));
  copy('preview-lifecycle.json',readFileSync(event));
 }
 const files=Object.fromEntries(readdirSync(dest).filter(name=>name!=='capture.json').map(name=>[name,sha(readFileSync(join(dest,name)))]));
 const capture={format:'a2game-server-receipt-capture',version:1,runId,source:'SERVER_CANONICAL_NOT_HOST_EXPORT',hostExecutionAttestation:'HOST_REPORTED',serverFile:relative(workspace,source).replaceAll('\\','/'),files,hostResponseComparison:comparison,packageFile};
 const receipt=Buffer.from(JSON.stringify(capture,null,2)+'\n');copy('capture.json',receipt);
 const next=Object.fromEntries(['artifactId','previewId','url','path','sha256','exactHash','initialHash','finalHash'].filter(key=>response.data?.[key]!==undefined).map(key=>[key,response.data[key]]));
 return {call:runId,tool:call.tool,status:response.status,hostResponseComparison:comparison,path:relative(workspace,dest).replaceAll('\\','/'),next};
}

export function checkHostRun(run,workspace=root){
 const directory=runDirectory(run,workspace),runMeta=json(join(directory,'run.json')),calls=[],incompleteCaptures=[];
 for(const entry of readdirSync(join(directory,'calls'),{withFileTypes:true}).filter(e=>e.isDirectory())){
  const dir=inside(directory,join(directory,'calls',entry.name));
  if(['capture.json','server-call.json','server-response.json'].some(name=>!existsSync(join(dir,name)))){incompleteCaptures.push(entry.name);continue;}
  const capture=json(join(dir,'capture.json'));
  for(const name of ['server-call.json','server-response.json'])if(!capture.files?.[name])throw Error('Required captured evidence digest missing');
  for(const [name,digest]of Object.entries(capture.files))if(sha(readFileSync(inside(dir,resolve(dir,name))))!==digest)throw Error('Captured evidence SHA mismatch');
  const response=resultSchema.parse(json(join(dir,'server-response.json'))),call=json(join(dir,'server-call.json'));
  if(call.format!=='a2game-mcp-call'||entry.name!==response.runId||call.runId!==response.runId||capture.runId!==response.runId||call.budgetConsumed!==0||call.unknownCalls!==0)throw Error('Captured call identity or budget differs');
  if(call.parameters.artifactId&&response.data?.artifactId&&call.parameters.artifactId!==response.data.artifactId)throw Error('Request and response artifact differ');
  if(call.tool==='a2game.preview_game'&&call.parameters.action==='close'&&response.data?.lifecyclePath){
   if(!capture.files['preview-lifecycle.json'])throw Error('Preview lifecycle evidence missing');
   const event=json(join(dir,'preview-lifecycle.json'));
   if(event.format!=='a2game-preview-lifecycle'||event.sessionId!==call.sessionId||event.previewId!==call.parameters.previewId||event.closeReason!==response.data.closeReason||event.closed!==response.data.closed)throw Error('Preview lifecycle identity differs');
  }
  if(call.tool==='a2game.generate_game')throw Error('Provider generation is outside this host run');
  calls.push({call,response,capture});
 }
 // The host receipt is an inventory, not proof: declared calls must have their own captured bytes.
 const declared=new Set();
 const collect=value=>{
  if(!value||typeof value!=='object')return;
  if(typeof value.runId==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.runId))declared.add(value.runId);
  for(const child of Object.values(value))collect(child);
 };
 if(existsSync(join(directory,'receipt.json')))collect(json(join(directory,'receipt.json')));
 const captured=new Set(calls.map(e=>e.call.runId)),related=new Set(declared);
 // Recover inventory gaps for known artifacts/previews without sweeping other hosts' work.
 const artifacts=new Set(calls.flatMap(e=>[e.call.parameters.artifactId,e.response.data?.artifactId]).filter(Boolean));
 const previewIds=new Set(calls.flatMap(e=>[e.call.parameters.previewId,e.response.data?.previewId]).filter(Boolean));
 for(const sessionId of new Set(calls.map(e=>e.call.sessionId))){
  if(!/^[0-9a-f-]{36}$/i.test(sessionId))throw Error('Invalid service session identity');
  const session=join(workspace,'output/mcp',sessionId);if(!existsSync(session))continue;
  inside(join(workspace,'output/mcp'),session);
  for(const file of readdirSync(session).filter(name=>name.endsWith('.call.json'))){
   const call=json(inside(session,join(session,file)));
   if(!/^[0-9a-f-]{36}$/i.test(call.runId)||call.sessionId!==sessionId)throw Error('Invalid server call identity');
   if(!call.createdAt||call.createdAt<runMeta.createdAt)continue;
   const responseFile=join(session,call.runId+'.receipt.json');if(!existsSync(responseFile))continue;
   const response=json(inside(session,responseFile));
   if(artifacts.has(call.parameters?.artifactId)||artifacts.has(response.data?.artifactId)||previewIds.has(call.parameters?.previewId)||previewIds.has(response.data?.previewId))related.add(call.runId);
  }
 }
 const missingCaptures=[...related].filter(id=>!captured.has(id)).sort();
 const success=calls.filter(e=>e.response.status==='PASS_REFERENCE'),exports=success.filter(e=>e.call.tool==='a2game.export_game');
 const artifactChecks=[];
 let selected=null,missing=['validate_game','test_game','inspect_game','preview_air','close_air','preview_three','close_three','export_game'];
 for(const candidate of exports){
  const session=candidate.call.sessionId,artifact=candidate.response.data.artifactId;
  const same=success.filter(e=>e.call.sessionId===session),artifactCalls=same.filter(e=>e.call.parameters.artifactId===artifact||e.response.data?.artifactId===artifact);
  const gaps=[];
  for(const tool of ['list_capabilities','get_capability'])if(!same.some(e=>e.call.tool==='a2game.'+tool))gaps.push(tool);
  for(const tool of ['validate_game','test_game','inspect_game','export_game'])if(!artifactCalls.some(e=>e.call.tool==='a2game.'+tool))gaps.push(tool);
  for(const backend of ['air','three']){
   const opens=artifactCalls.filter(e=>e.call.tool==='a2game.preview_game'&&e.call.parameters.action==='open'&&e.response.data.backend===backend);
   if(!opens.length)gaps.push('preview_'+backend);
   if(!opens.some(open=>same.some(e=>e.call.tool==='a2game.preview_game'&&e.call.parameters.action==='close'&&e.call.parameters.previewId===open.response.data.previewId&&e.response.data.closed===true)))gaps.push('close_'+backend);
  }
  artifactChecks.push({sessionId:session,artifactId:artifact,missing:gaps});
  if(gaps.length<missing.length){missing=gaps;selected={sessionId:session,artifactId:artifact,packageCall:candidate.response.runId};}
 }
 missing=[...missing];
 for(const artifact of artifactChecks)for(const gap of artifact.missing)missing.push('artifact:'+artifact.artifactId+':'+gap);
 for(const id of missingCaptures)missing.push('CAPTURE_MISSING:'+id);
 for(const id of incompleteCaptures)missing.push('CAPTURE_INCOMPLETE:'+id);
 const previewLifecycle=success.filter(e=>e.call.tool==='a2game.preview_game'&&e.call.parameters.action==='open').map(open=>{
  const previewId=open.response.data.previewId;
  const closes=success.filter(e=>e.call.sessionId===open.call.sessionId&&e.call.tool==='a2game.preview_game'&&e.call.parameters.action==='close'&&e.call.parameters.previewId===previewId&&e.response.data.closed===true&&e.response.data.previewId===previewId);
  const explicit=closes.some(e=>!e.response.data.closeReason||e.response.data.closeReason==='explicit');
  if(!explicit)missing.push('PREVIEW_EXPLICIT_CLOSE_MISSING:'+previewId);
  return {previewId,artifactId:open.call.parameters.artifactId,backend:open.response.data.backend,explicitClose:explicit,closeReasons:closes.map(e=>e.response.data.closeReason??'explicit-legacy')};
 });
 const hostResponseMismatches=calls.filter(e=>['DIFFERENT','UNPARSEABLE'].includes(e.capture.hostResponseComparison)).map(e=>e.response.runId);
 for(const id of hostResponseMismatches)missing.push('HOST_RESPONSE_MISMATCH:'+id);
 const attempts=calls.filter(e=>e.call.tool==='a2game.validate_game').length;
 if(attempts>runMeta.maxValidationAttempts)missing.push('VALIDATION_ATTEMPT_BUDGET_EXCEEDED');
 return {format:'a2game-host-run-check',version:1,host:runMeta.host,mcpLoopStatus:selected&&!missing.length?'PASS_REFERENCE':'PARTIAL',selected,missing,
  calls:calls.length,validationAttempts:attempts,missingCaptures,incompleteCaptures,artifactChecks,previewLifecycle,failures:calls.filter(e=>e.response.status!=='PASS_REFERENCE').map(e=>({runId:e.response.runId,tool:e.call.tool,status:e.response.status,codes:e.response.diagnostics.map(d=>d.code)})),
  hostResponseMismatches,
  source:'SERVER_RECEIPTS_WITH_HOST_REPORTED_CALL_IDS',browserInputAndVisual:'NOT_RUN',formalG3:'NOT_RUN',hostNativeUsage:'UNKNOWN',mcpProviderBudgetConsumed:0};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command,a,b,c]=process.argv.slice(2);
  const result=command==='init'?initHostRun(a):command==='capture'?captureHostCall(a,b,root,c):command==='check'?checkHostRun(a):null;
  if(!result)throw Error('Usage: host-agent-run.mjs init <host> | capture <run> <responseRunId> [host-response-file-in-run] | check <run>');
  console.log(JSON.stringify(result,null,2));
  if(command==='check'&&result.mcpLoopStatus!=='PASS_REFERENCE')process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
