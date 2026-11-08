#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {publicDiagnostics} from './diagnostics.mjs';
import {queryCapabilities,getPublicCapability} from './catalog.mjs';
import {generateGame,validateGameFile,testGeneratedDirectory,previewGeneratedDirectory,probeProvider,admitNativeGeneration,buildGamePlan,validateGamePlan,startGeneratorStudio,exportGamePackage,importGamePackage,safePath} from './index.mjs';
const help=`A2Game Generator (local, reference only)
  capabilities [--query TEXT ≤120] [--offset 0..1000] [--limit 1..20]
  capability --id CAPABILITY_ID --cap-version 0.1.0
  generate --prompt-file FILE --provider fixture|codex|claude|model-http|http --output DIR
           [--config FILE] [--mode direct-json|game-plan] [--plan-file FILE]
           [--max-attempts 1..3] [--timeout-ms 60000]
  plan --prompt-file FILE --output FILE   (host keyword draft; no model call)
  check-plan PLAN.json
  studio [--provider fixture|codex|claude|model-http|http] [--config FILE] [--max-calls 0..30] [--port 0]
  export-package GENERATED_DIR --output FILE
  import-package FILE --output NEW_DIR
  validate GAME.json [--evidence-dir DIR]
  test GENERATED_DIR [--evidence-dir DIR]
  preview GENERATED_DIR [--backend air|three]
  inspect GENERATED_DIR [--backend air|three]  (手动导入 debug-bundle.json)
  probe --provider ID [--config FILE]
  import-native --context FILE --raw FILE --host-record FILE --output DIR
  --help | --version | --json
真实模型调用使用显式 provider/config；fixture 不计模型或 G3 验收。`;
const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
try{
 const {positionals,values}=parseArgs({allowPositionals:true,options:{help:{type:'boolean'},version:{type:'boolean'},json:{type:'boolean'},query:{type:'string'},offset:{type:'string'},limit:{type:'string'},id:{type:'string'},'cap-version':{type:'string'},'prompt-file':{type:'string'},'plan-file':{type:'string'},provider:{type:'string'},config:{type:'string'},output:{type:'string'},mode:{type:'string'},'max-attempts':{type:'string'},'timeout-ms':{type:'string'},'max-calls':{type:'string'},port:{type:'string'},backend:{type:'string'},context:{type:'string'},raw:{type:'string'},'host-record':{type:'string'},'evidence-dir':{type:'string'}}});
 let result;const command=positionals[0],options={signal:controller.signal,timeoutMs:Number(values['timeout-ms']??60000)};
 if(values.help||!command&&!values.version){console.log(help);}
 else if(values.version){console.log('1.0.0');}
 else{
  if(positionals.length>(['validate','test','preview','inspect','check-plan','export-package','import-package'].includes(command)?2:1))throw Object.assign(Error(),{code:'A2G_GEN_ARGUMENT'});
  if(command==='capabilities')result={status:'PASS_REFERENCE',...queryCapabilities({query:values.query??'',offset:Number(values.offset??0),limit:Number(values.limit??10)})};
  else if(command==='capability')result={status:'PASS_REFERENCE',capability:getPublicCapability({id:values.id,version:values['cap-version']??'0.1.0'}),modelCalls:0};
  else if(command==='generate'){
   if(!values.provider)throw Object.assign(Error(),{code:'A2G_GEN_PROVIDER_REQUIRED'});
   result=await generateGame({...options,prompt:readFileSync(values['prompt-file'],'utf8'),providerId:values.provider,configFile:values.config,mode:values.mode??'direct-json',gamePlan:values['plan-file']?readFileSync(values['plan-file'],'utf8'):undefined,outputDirectory:values.output,maxAttempts:Number(values['max-attempts']??3)});
  }
  else if(command==='plan'){
   const {plan}=await buildGamePlan(readFileSync(values['prompt-file'],'utf8'),options);
   // File output uses the same traversal/symlink/no-overwrite policy as game directories.
   const {writePlanFile}=await import('./plan-file.mjs');writePlanFile(values.output,plan);
   result={status:'PASS_REFERENCE',provenance:'HOST_KEYWORD_DRAFT',output:values.output,modelCalls:0,semanticReview:'NOT_RUN',G3:'NOT_RUN'};
  }
  else if(command==='check-plan'){await validateGamePlan(readFileSync(positionals[1],'utf8'),options);result={status:'PASS_REFERENCE',modelCalls:0,G3:'NOT_RUN'};}
  else if(command==='export-package'){const pack=await exportGamePackage(positionals[1],options);writeFileSync(safePath(values.output),JSON.stringify(pack,null,2)+'\n',{flag:'wx'});result={status:'PASS_REFERENCE',output:values.output,generationCalls:0,G3:'NOT_RUN'};}
  else if(command==='import-package')result=await importGamePackage(readFileSync(positionals[1],'utf8'),values.output,options);
  else if(command==='studio'){
   const session=await startGeneratorStudio({...options,providerId:values.provider??'fixture',configFile:values.config,maxCalls:Number(values['max-calls']??0),port:Number(values.port??0)});
   console.log(JSON.stringify({status:'READY',url:session.url},null,values.json?0:2));
   await new Promise(ok=>controller.signal.aborted?ok():controller.signal.addEventListener('abort',ok,{once:true}));await session.close();result=null;
  }
  else if(command==='import-native')result=await admitNativeGeneration({...options,contextFile:values.context,rawFile:values.raw,hostRecordFile:values['host-record'],outputDirectory:values.output});
  else if(command==='validate')result=await validateGameFile(positionals[1],{...options,evidenceDir:values['evidence-dir']});
  else if(command==='test')result=await testGeneratedDirectory(positionals[1],{...options,evidenceDir:values['evidence-dir']});
  else if(command==='probe')result=await probeProvider({id:values.provider,configFile:values.config});
  else if(['preview','inspect'].includes(command)){
   const session=await previewGeneratedDirectory(positionals[1],{...options,backend:values.backend??'three'});
   result={status:session.status,code:session.code,nextStep:session.nextStep,url:command==='inspect'?session.url?.replace(/\/player\/index.html.*/, '/player/inspect.html'):session.url,...(command==='inspect'?{instruction:'在页面导入产物目录的 debug-bundle.json。'}:{})};
   console.log(JSON.stringify(result,null,values.json?0:2));
   if(session.status==='READY')await new Promise(ok=>controller.signal.aborted?ok():controller.signal.addEventListener('abort',ok,{once:true}));
   if(session.status==='BLOCKED')process.exitCode=3;
   result=null;
  }else throw Object.assign(Error(),{code:'A2G_GEN_ARGUMENT'});
  if(result){console.log(JSON.stringify(result,null,values.json?0:2));process.exitCode=result.status==='BLOCKED'?3:result.status==='CANCELLED'?130:['PASS_REFERENCE','READY'].includes(result.status)?0:1;}
 }
}catch(e){console.log(JSON.stringify({status:'FAIL',code:e.code??'A2G_GEN_ARGUMENT',message:'操作未完成，请检查参数、构建和本机配置后重试。',diagnostics:publicDiagnostics({...e,code:e.code??'A2G_GEN_ARGUMENT'}),...(e.evidence&&typeof e.evidence==='object'?{evidence:e.evidence}:{})}));process.exitCode=e.code==='A2G_GEN_CANCELLED'?130:2;}
