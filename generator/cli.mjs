#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {generateGame,validateGameFile,testGeneratedDirectory,previewGeneratedDirectory,probeProvider} from './index.mjs';
const help=`A2Game Generator (local, reference only)
  generate --prompt-file FILE --provider fixture|codex|model-http|http --output DIR
           [--config FILE] [--mode direct-json] [--max-attempts 1..3] [--timeout-ms 60000]
  validate GAME.json
  test GENERATED_DIR
  preview GENERATED_DIR [--backend air|three]
  inspect GENERATED_DIR [--backend air|three]  (手动导入 debug-bundle.json)
  probe --provider ID [--config FILE]
  --help | --version | --json
真实模型调用使用显式 provider/config；fixture 不计模型或 G3 验收。`;
const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
try{
 const {positionals,values}=parseArgs({allowPositionals:true,options:{help:{type:'boolean'},version:{type:'boolean'},json:{type:'boolean'},'prompt-file':{type:'string'},provider:{type:'string'},config:{type:'string'},output:{type:'string'},mode:{type:'string'},'max-attempts':{type:'string'},'timeout-ms':{type:'string'},backend:{type:'string'}}});
 let result;const command=positionals[0],options={signal:controller.signal,timeoutMs:Number(values['timeout-ms']??60000)};
 if(values.help||!command&&!values.version){console.log(help);}
 else if(values.version){console.log('1.0.0');}
 else{
  if(positionals.length>(['validate','test','preview','inspect'].includes(command)?2:1))throw Object.assign(Error(),{code:'A2G_GEN_ARGUMENT'});
  if(command==='generate'){
   if(!values.provider)throw Object.assign(Error(),{code:'A2G_GEN_PROVIDER_REQUIRED'});
   result=await generateGame({...options,prompt:readFileSync(values['prompt-file'],'utf8'),providerId:values.provider,configFile:values.config,mode:values.mode??'direct-json',outputDirectory:values.output,maxAttempts:Number(values['max-attempts']??3)});
  }
  else if(command==='validate')result=await validateGameFile(positionals[1],options);
  else if(command==='test')result=await testGeneratedDirectory(positionals[1],options);
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
}catch(e){console.log(JSON.stringify({status:'FAIL',code:e.code??'A2G_GEN_ARGUMENT',message:'操作未完成，请检查参数、构建和本机配置后重试。'}));process.exitCode=e.code==='A2G_GEN_CANCELLED'?130:2;}
