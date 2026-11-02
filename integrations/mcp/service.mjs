/** Narrow session adapter: no caller paths, commands, credentials or implicit generation. */
import {mkdirSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {root,makeRegistry} from '../../scripts/registry.mjs';
import {buildGamePlan,generateGame,validateGameFile,testGeneratedDirectory,previewGeneratedDirectory,safePath} from '../../generator/index.mjs';
import {exportGamePackage} from '../../generator/package.mjs';
import {HeadlessRuntime} from '../../dist/index.js';
import {playSolution} from '../../scripts/agent-solver.mjs';
import {contracts,resultSchema} from './contract.mjs';
import {queryCapabilities,getPublicCapability} from '../../generator/catalog.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),relativePath=p=>relative(root,p).replaceAll('\\','/');
const fail=code=>Object.assign(Error(code),{code});
export function createMcpService({provider,configFile,maxCalls=0,timeoutMs=120000,previewTtlMs=120000}={}){
 if(!Number.isInteger(maxCalls)||maxCalls<0||maxCalls>30||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>600000||!Number.isInteger(previewTtlMs)||previewTtlMs<100||previewTtlMs>300000)throw fail('A2G_MCP_CONFIG');
 if(provider&&!['fixture','codex','claude','model-http','http'].includes(provider))throw fail('A2G_MCP_CONFIG');
 const sessionId=randomUUID(),directory=safePath(join(root,'output/mcp',sessionId));mkdirSync(directory,{recursive:true});
 const artifacts=new Map(),previews=new Map(),previewHistory=new Map(),controllers=new Set();let active=false,closed=false,calls=0,unknownCalls=0,requests=0;
 function save(path,value){safePath(path);writeFileSync(path,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
 function persistCall(result,metadata){
  quota();
  save(join(directory,result.runId+'.call.json'),{...metadata,budgetConsumed:calls,unknownCalls});
  save(join(directory,result.runId+'.receipt.json'),result);
  return result;
 }
 function newArtifact(){if(artifacts.size>=32)throw fail('A2G_MCP_QUOTA');const artifactId=randomUUID(),path=safePath(join(directory,artifactId));mkdirSync(path);return {artifactId,path,status:'NOT_RUN',tested:false};}
 function seal(a){const files={};function walk(base){for(const n of readdirSync(safePath(base))){const file=safePath(join(base,n));if(statSync(file).isDirectory())walk(file);else files[relative(a.path,file).replaceAll('\\','/')]=hash(readFileSync(file));}}walk(a.path);a.files=files;artifacts.set(a.artifactId,a);return {artifactId:a.artifactId,path:relativePath(a.path),files:a.files};}
 function get(artifactId){const a=artifacts.get(artifactId);if(!a)throw fail('A2G_MCP_ARTIFACT');for(const [n,sha]of Object.entries(a.files))if(hash(readFileSync(safePath(join(a.path,n))))!==sha)throw fail('A2G_MCP_INTEGRITY');return a;}
 function quota(){let total=0;function walk(p){for(const n of readdirSync(safePath(p))){const file=safePath(join(p,n)),s=statSync(file);if(s.isDirectory())walk(file);else total+=s.size;}}walk(directory);if(total>32*1024*1024)throw fail('A2G_MCP_QUOTA');}
 async function closePreview(id,closeReason='explicit'){
  const past=previewHistory.get(id);if(past)return {...past,alreadyClosed:true};
  const p=previews.get(id);if(!p)throw fail('A2G_MCP_PREVIEW');
  if(p.closing)return {...await p.closing,alreadyClosed:true};
  clearTimeout(p.timer);p.signal.removeEventListener('abort',p.cancel);
  p.closing=(async()=>{
   const path=join(directory,id+'.lifecycle.'+randomUUID()+'.json');
   try{
    await p.session.close();
    const result={closed:true,previewId:id,closeReason,alreadyClosed:false,closedAt:new Date().toISOString(),lifecyclePath:relativePath(path)};
    save(path,{format:'a2game-preview-lifecycle',version:1,sessionId,artifactId:p.artifactId,backend:p.backend,openedAt:p.openedAt,...result});
    previewHistory.set(id,result);previews.delete(id);return result;
   }catch(error){
    save(path,{format:'a2game-preview-lifecycle',version:1,sessionId,previewId:id,artifactId:p.artifactId,backend:p.backend,openedAt:p.openedAt,closed:false,closeReason,closedAt:new Date().toISOString(),code:error.code??'A2G_MCP_PREVIEW_CLOSE'});
    throw error;
   }
  })();
  try{return await p.closing;}catch(error){p.closing=null;throw error;}
 }
 async function execute(name,args,signal){
  const registry=makeRegistry();
  if(name==='a2game.list_capabilities')return queryCapabilities(args);
  if(name==='a2game.get_capability')return {capability:getPublicCapability(args),modelCalls:0};
  if(name==='a2game.plan_game')return {plan:await buildGamePlan(args.prompt,{signal}),modelCalls:0,planner:'HOST_KEYWORD_DRAFT'};
  if(name==='a2game.generate_game'){
   if(!provider||args.provider!==provider||maxCalls-calls<args.maxAttempts)throw fail('A2G_MCP_BUDGET');
   const a=newArtifact();calls+=args.maxAttempts;let result;
   try{result=await generateGame({prompt:args.prompt,providerId:provider,configFile,mode:args.mode,outputDirectory:join(a.path,'generated'),maxAttempts:args.maxAttempts,timeoutMs,signal});calls-=args.maxAttempts-(result.generationCalls??args.maxAttempts);}catch(e){unknownCalls+=args.maxAttempts;throw e;}
   a.path=join(a.path,'generated');a.status=result.status;a.tested=result.status==='PASS_REFERENCE';
   return {status:result.status,code:result.code??null,...seal(a),generationCalls:result.generationCalls??null,fixtureCalls:result.fixtureCalls??0,provenance:result.provenance??'UNVERIFIED',budgetConsumed:calls,unknownCalls,G3:'NOT_RUN'};
  }
  if(name==='a2game.validate_game'){
   if(Boolean(args.conformanceJson)!==Boolean(args.solutionJson))throw fail('A2G_MCP_TEST_INPUTS');
   const a=newArtifact();save(join(a.path,'game.json'),args.gameJson);
   const result=await validateGameFile(join(a.path,'game.json'),{signal,timeoutMs});a.status=result.status;
   if(result.status!=='PASS_REFERENCE')return {status:'FAIL',code:result.code??'A2G_MCP_ADMISSION',modelCalls:0};
   if(args.conformanceJson){save(join(a.path,'conformance.json'),args.conformanceJson);save(join(a.path,'solution.json'),args.solutionJson);}
   return {...seal(a),modelCalls:0,G3:'NOT_RUN'};
  }
  if(name==='a2game.preview_game'&&args.action==='close'){if(!args.previewId||args.artifactId||args.backend)throw fail('A2G_MCP_ARGUMENTS');return {...await closePreview(args.previewId),modelCalls:0};}
  if(name==='a2game.preview_game'&&(!args.artifactId||!args.backend||args.previewId))throw fail('A2G_MCP_ARGUMENTS');
  const a=get(args.artifactId);
  if(name==='a2game.test_game'){
   if(!a.files['conformance.json']||!a.files['solution.json'])throw fail('A2G_MCP_TEST_INPUTS');
   const result=await testGeneratedDirectory(a.path,{signal,timeoutMs});a.tested=result.status==='PASS_REFERENCE';
   if(!a.tested)return {status:result.status,code:result.code??'A2G_MCP_TEST',modelCalls:0};
   const game=JSON.parse(readFileSync(join(a.path,'game.json'),'utf8')),solution=JSON.parse(readFileSync(join(a.path,'solution.json'),'utf8'));
   a.played=playSolution(game,solution);return {artifactId:a.artifactId,exactHash:a.played.final.exactHash,trace:a.played.trace,modelCalls:0,G3:'NOT_RUN'};
  }
  if(name==='a2game.preview_game'){
   if(previews.size>=2)throw fail('A2G_MCP_PREVIEW_QUOTA');
   const session=await previewGeneratedDirectory(a.path,{backend:args.backend,signal});
   if(session.status!=='READY')return {status:'BLOCKED',code:session.code??'A2G_MCP_SDK',modelCalls:0};
   const previewId=randomUUID(),openedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+previewTtlMs).toISOString();
   const cancel=()=>{void closePreview(previewId,'cancelled').catch(()=>{});};
   const timer=setTimeout(()=>{void closePreview(previewId,'expired').catch(()=>{});},previewTtlMs);timer.unref();
   previews.set(previewId,{session,timer,signal,cancel,artifactId:a.artifactId,backend:args.backend,openedAt});
   signal.addEventListener('abort',cancel,{once:true});
   if(signal.aborted||closed){await closePreview(previewId,closed?'shutdown':'cancelled');throw fail('A2G_MCP_CANCELLED');}
   return {previewId,url:session.url,backend:args.backend,openedAt,expiresAt,expiresInMs:previewTtlMs,modelCalls:0,browserInteraction:'NOT_RUN'};
  }
  if(name==='a2game.inspect_game'){
   const game=JSON.parse(readFileSync(join(a.path,'game.json'),'utf8')),runtime=new HeadlessRuntime(game,registry);let state;
   try{runtime.start();state=runtime.observe();}finally{runtime.dispose();}
   return {artifactId:a.artifactId,gameId:game.id,files:a.files,tested:a.tested,initialHash:state.exactHash,finalHash:a.played?.final.exactHash??null,previews:[...previews.entries()].filter(([,p])=>p.artifactId===a.artifactId).map(([previewId,p])=>({previewId,backend:p.backend})),modelCalls:0,G3:'NOT_RUN'};
  }
  if(name==='a2game.export_game'){
   if(!a.tested)throw fail('A2G_MCP_TEST_REQUIRED');
   const pack=await exportGamePackage(a.path,{signal,timeoutMs}),path=join(directory,randomUUID()+'.package.json');save(path,pack);
   return {artifactId:a.artifactId,path:relativePath(path),sha256:hash(readFileSync(path)),format:'a2game-content-package',modelCalls:0,requires:'Compatible trusted host, locked SDKs and approved resources'};
  }
  throw fail('A2G_MCP_TOOL');
 }
 return {sessionId,directory,stats:()=>({budgetConsumed:calls,unknownCalls,maxCalls,artifacts:artifacts.size,previews:previews.size,active,closed}),
  async call(name,input,{signal}={}){
   const runId=randomUUID();let controller,timer,abort;
   const metadata={format:'a2game-mcp-call',version:1,sessionId,runId,tool:Object.hasOwn(contracts,name)?name:null,
    createdAt:new Date().toISOString(),argumentsSha256:null,parameters:{}};
   try{
    if(closed)throw fail('A2G_MCP_CLOSED');if(!contracts[name])throw fail('A2G_MCP_TOOL');
    if(Buffer.byteLength(JSON.stringify(input??{}))>768*1024)throw fail('A2G_MCP_SIZE');
    const args=contracts[name].schema.parse(input);
    metadata.argumentsSha256=hash(Buffer.from(JSON.stringify(args)));
    for(const key of ['artifactId','previewId','backend','action'])if(args[key]!==undefined)metadata.parameters[key]=args[key];
    if(active)throw fail('A2G_MCP_BUSY');if(++requests>256)throw fail('A2G_MCP_QUOTA');quota();
    if(signal?.aborted)throw fail('A2G_MCP_CANCELLED');controller=new AbortController();controllers.add(controller);abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>controller.abort(),timeoutMs);active=true;
    const data=await execute(name,args,controller.signal);if(controller.signal.aborted)throw fail(signal?.aborted?'A2G_MCP_CANCELLED':'A2G_MCP_TIMEOUT');
    const result={mcpToolContractVersion:1,runId,status:data.status??'PASS_REFERENCE',diagnostics:data.code?[{code:data.code,stage:name,message:'操作未完成，请按错误码检查输入、测试或宿主配置后重试。'}]:[],data};
    resultSchema.parse(result);if(Buffer.byteLength(JSON.stringify(result))>256*1024)throw fail('A2G_MCP_RESPONSE_SIZE');return persistCall(result,metadata);
   }catch(e){const code=e.name==='ZodError'?'A2G_MCP_ARGUMENTS':/^(?:A2G_|ENOENT)/.test(e.code??'')?e.code:'A2G_MCP_FAILURE';
    const result={mcpToolContractVersion:1,runId,status:['A2G_MCP_BUDGET','A2G_MCP_BUSY','A2G_MCP_CLOSED'].includes(code)?'BLOCKED':'FAIL',diagnostics:[{code,stage:name,message:'操作未完成；请检查参数、调用预算、文件完整性或宿主配置后重试。'}]};
    try{return persistCall(result,metadata);}catch{result.diagnostics.push({code:'A2G_MCP_EVIDENCE',stage:'receipt',message:'本地回执未能保存；不得声明已取得原始证据。'});return result;}
   }finally{if(controller){clearTimeout(timer);controllers.delete(controller);signal?.removeEventListener('abort',abort);active=false;}}
  },
  async close(){closed=true;for(const c of controllers)c.abort();await Promise.allSettled([...previews.keys()].map(id=>closePreview(id,'shutdown')));}
 };
}
