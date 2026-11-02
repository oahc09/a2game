/** Prepare a host run and archive exact service receipts. Never dispatches a model or MCP tool. */
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {contracts,resultSchema} from '../integrations/mcp/contract.mjs';
import {readHostRunLedger} from './host-run-ledger.mjs';
import {prepareHostWorkspace} from './host-public-workspace.mjs';

const root=resolve(import.meta.dirname,'..'),hosts=['qoder','trae','workbuddy','zcode','native-agent-simulated'];
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
function assertHostIdentity(meta,directory){
 if(!hosts.includes(meta.host)||basename(dirname(directory))!==meta.host)throw Error('Host identity does not match its run directory');
 const simulated=meta.host==='native-agent-simulated';
 if(simulated!==(meta.provenance==='NATIVE_AGENT_SIMULATED_HOST'))throw Error('Host/provenance mismatch: simulated evidence cannot be relabelled as a real host');
}

export function initHostRun(host,workspace=root){
 if(!hosts.includes(host))throw Error('Unknown host');
 const base=join(workspace,'reports/host-first-evaluations');mkdirSync(base,{recursive:true});
 const parent=join(base,host);mkdirSync(parent,{recursive:true});inside(base,parent);
 // Simulation is a separate host identity, never evidence of Qoder/TRAE/WorkBuddy discovery.
 const provenance=host==='native-agent-simulated'?'NATIVE_AGENT_SIMULATED_HOST':'HOST_NATIVE_GENERATION_PENDING';
 const hostRunId=randomUUID();
 const directory=join(parent,new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID());
 mkdirSync(directory);mkdirSync(join(directory,'candidate'));mkdirSync(join(directory,'calls'));
 const isolation=prepareHostWorkspace(directory,workspace);
 write(join(directory,'run.json'),{format:'a2game-host-agent-run',version:1,host,hostRunId,isolation,implementationSha256:hostSourceFingerprint(workspace),runId:basename(directory),createdAt:new Date().toISOString(),maxValidationAttempts:3,mcpProviderBudget:0,hostNativeUsage:'UNKNOWN',provenance,formalG3:'NOT_RUN'});
 return {hostRunId,provenance,isolation,run:relative(workspace,directory).replaceAll('\\','/'),task:'TASK.md',candidate:'candidate/',schemaContext:'schemas/',modelCalls:0};
}

export function captureHostCall(run,runId,workspace=root,hostResponseFile){
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(runId))throw Error('Expected response runId UUID');
 const directory=runDirectory(run,workspace),meta=json(join(directory,'run.json'));
 assertHostIdentity(meta,directory);
 const output=join(workspace,'output/mcp');
 const matches=readdirSync(output,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>join(output,e.name,runId+'.receipt.json')).filter(existsSync);
 if(matches.length!==1)throw Error('Expected exactly one service receipt for response runId');
 const source=inside(output,matches[0]),callFile=source.replace('.receipt.json','.call.json');
 if(!existsSync(callFile))throw Error('Call metadata missing; reconnect A2Game MCP after updating this checkout');
 inside(output,callFile);
 const bytes=readFileSync(source),response=resultSchema.parse(JSON.parse(bytes)),call=json(callFile);
 if(call.format!=='a2game-mcp-call'||call.runId!==runId||call.sessionId!==basename(resolve(source,'..'))||response.runId!==runId)throw Error('Call metadata does not bind this receipt');
 const sessionFile=join(resolve(source,'..'),'session.json');
 const session=existsSync(sessionFile)?json(inside(output,sessionFile)):null;
 if(call.hostRunId&&call.hostRunId!==meta.hostRunId||session?.hostRunId&&session.hostRunId!==meta.hostRunId)throw Error('Service session belongs to another host run');
 if(call.hostRunId&&(session?.hostRunId!==call.hostRunId||session.sessionId!==call.sessionId||call.state!=='COMPLETED'||call.receiptSha256!==sha(bytes)))throw Error('Canonical call ledger is incomplete or inconsistent');
 if((!Object.hasOwn(contracts,call.tool)&&!(call.tool===null&&response.status!=='PASS_REFERENCE'))||call.tool==='a2game.generate_game')throw Error('This run does not permit provider generation');
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
 assertHostIdentity(runMeta,directory);
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
  if(existsSync(join(dir,'host-response.txt'))){
   if(!capture.files['host-response.txt'])throw Error('Unsealed host response evidence');
   try{capture.hostResponseComparison=isDeepStrictEqual(decodeHostResult(readFileSync(join(dir,'host-response.txt'),'utf8')),response)?'MATCH':'DIFFERENT';}catch{capture.hostResponseComparison='UNPARSEABLE';}
  }else if(capture.hostResponseComparison!=='NOT_CAPTURED')throw Error('Host response evidence missing');
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
 const ledger=readHostRunLedger(workspace,runMeta.hostRunId);
 if(runMeta.implementationSha256!==hostSourceFingerprint(workspace))ledger.problems.push('RUN_IMPLEMENTATION_CHANGED_OR_UNBOUND');
 for(const entry of ledger.calls)related.add(entry.call.runId);
 for(const entry of calls){
  const canonical=ledger.calls.find(e=>e.call.runId===entry.call.runId);
  if(entry.call.hostRunId&&entry.call.hostRunId!==runMeta.hostRunId)throw Error('Captured call belongs to another host run');
  if(!canonical){ledger.problems.push('CANONICAL_CALL_MISSING:'+entry.call.runId);continue;}
  const capturedRoot=join(directory,'calls',entry.call.runId);
  if(!readFileSync(join(capturedRoot,'server-call.json')).equals(canonical.callBytes)||!canonical.responseBytes||!readFileSync(join(capturedRoot,'server-response.json')).equals(canonical.responseBytes))throw Error('Captured bytes differ from canonical ledger');
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
 missing=[...missing,...ledger.problems];
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
 const attempts=ledger.calls.filter(e=>e.call.tool==='a2game.validate_game').length;
 if(runMeta.maxValidationAttempts!==3)missing.push('INVALID_VALIDATION_ATTEMPT_LIMIT');
 if(attempts>3)missing.push('VALIDATION_ATTEMPT_BUDGET_EXCEEDED');
 return {format:'a2game-host-run-check',version:1,host:runMeta.host,realHostMatrix:runMeta.host==='native-agent-simulated'?'EXCLUDED_SIMULATION':'NOT_EVALUATED',provenance:runMeta.host==='native-agent-simulated'?'NATIVE_AGENT_SIMULATED_HOST':runMeta.provenance??'HOST_NATIVE_GENERATION_PENDING',mcpLoopStatus:selected&&!missing.length?'PASS_REFERENCE':'PARTIAL',selected,missing,
  calls:calls.length,canonicalCalls:ledger.calls.length,hostRunId:runMeta.hostRunId??null,validationAttempts:attempts,missingCaptures,incompleteCaptures,artifactChecks,previewLifecycle,failures:ledger.calls.filter(e=>e.response&&e.response.status!=='PASS_REFERENCE').map(e=>({runId:e.response.runId,tool:e.call.tool,status:e.response.status,codes:e.response.diagnostics.map(d=>d.code)})),
  hostResponseMismatches,
  source:'SERVER_RECEIPTS_WITH_HOST_REPORTED_CALL_IDS',independentAuthoring:'NOT_VERIFIED',isolation:runMeta.isolation??{status:'NOT_RECORDED'},browserInputAndVisual:'NOT_RUN',formalG3:'NOT_RUN',hostNativeUsage:'UNKNOWN',mcpProviderBudgetConsumed:0};
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
