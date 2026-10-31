/** Read-only audit of a model-http run's private call evidence; never copies provider responses. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {safePath} from '../generator/index.mjs';

const root=resolve(import.meta.dirname,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>Object.assign(Error(code),{code});
function limited(path,limit){
 const file=safePath(path),info=statSync(file);if(!info.isFile()||info.size>limit)throw fail('A2G_AUDIT_INPUT');
 return readFileSync(file);
}
function numericUsage(value){
 return Object.fromEntries(Object.entries(value??{}).filter(([key,n])=>/^[a-z_]{1,64}$/.test(key)&&typeof n==='number'&&Number.isFinite(n)&&n>=0).sort(([a],[b])=>a.localeCompare(b)));
}
export function auditModelEvidence(report,privateRoot=join(root,'.a2game/generator')){
 if(report?.format!=='a2game-generation-report'||report.provider?.id!=='model-http'||typeof report.runId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(report.runId)||!Array.isArray(report.calls)||report.calls.length>30||report.generationCalls!==report.calls.length)throw fail('A2G_AUDIT_REPORT');
 const requested=report.provider.requestedModelId,seen=new Set();
 if(typeof requested!=='string'||!requested||requested.length>200)throw fail('A2G_AUDIT_REPORT');
 const rows=report.calls.map(call=>{
  if(!Number.isInteger(call.attempt)||call.attempt<1||call.attempt>30||seen.has(call.attempt)||!['DISPATCHED','RETURNED'].includes(call.status))throw fail('A2G_AUDIT_REPORT');
  seen.add(call.attempt);const directory=safePath(join(privateRoot,report.runId,'attempt-'+call.attempt));
  const file=safePath(join(directory,'provider-call.json'));
  const row={attempt:call.attempt,dispatch:call.status,privateEvidence:'MISSING',responseIntegrity:'NOT_CHECKED',usageConsistent:null,identity:'UNAVAILABLE'};
  if(!existsSync(file)){row.identity=call.status==='RETURNED'?'EVIDENCE_MISSING':'NO_RETURN_RECORDED';return row;}
  const bytes=limited(file,128*1024),telemetry=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  row.privateEvidence='PRESENT';row.evidenceSha256=hash(bytes);
  if(call.status!=='RETURNED'){row.identity='NOT_RETURNED_IN_REPORT';return row;}
  if(telemetry.format!=='a2game-model-call'||telemetry.requestedModel!==requested){row.identity='EVIDENCE_INCONSISTENT';return row;}
  const raw=safePath(join(directory,'response.raw.json'));
  if(!existsSync(raw))row.responseIntegrity='MISSING';
  else row.responseIntegrity=hash(limited(raw,2*1024*1024))===telemetry.outputSha256?'MATCH':'MISMATCH';
  row.usageConsistent=JSON.stringify(numericUsage(call.usage))===JSON.stringify(numericUsage(telemetry.usage));
  if(row.responseIntegrity!=='MATCH'||!row.usageConsistent){row.identity='EVIDENCE_INCONSISTENT';return row;}
  if(typeof telemetry.returnedModel!=='string'||!telemetry.returnedModel.trim())row.identity='MODEL_NOT_REPORTED';
  else row.identity=telemetry.returnedModel===requested?'PROVIDER_REPORTED_MATCH':'PROVIDER_REPORTED_MISMATCH';
  return row;
 });
 const inconsistent=rows.some(row=>row.identity==='EVIDENCE_INCONSISTENT');
 const incomplete=rows.some(row=>['EVIDENCE_MISSING','NO_RETURN_RECORDED','NOT_RETURNED_IN_REPORT','MODEL_NOT_REPORTED','PROVIDER_REPORTED_MISMATCH'].includes(row.identity));
 return {format:'a2game-model-evidence-audit',version:1,status:inconsistent?'FAIL':incomplete?'PARTIAL':'PASS_REFERENCE',scope:'Local integrity and provider-reported model comparison only; not independent model attestation.',runId:report.runId,requestedModelId:requested,dispatched:rows.length,calls:rows,modelCalls:0,formalG3:'NOT_RUN'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw fail('A2G_AUDIT_ARGUMENT');
  const source=limited(process.argv[2],2*1024*1024),report=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source));
  const result=auditModelEvidence(report);result.inputReportSha256=hash(source);result.auditorSha256=hash(limited(fileURLToPath(import.meta.url),128*1024));
  const reports=safePath(resolve(root,'reports'));mkdirSync(reports,{recursive:true});
  const directory=safePath(join(reports,'model-identity-audit-'+randomUUID()));mkdirSync(directory,{recursive:false});
  const receipt=join(directory,'summary.json');writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,dispatched:result.dispatched,identities:result.calls.map(call=>call.identity),receipt:relative(root,receipt).replaceAll('\\','/'),modelCalls:0}));
  if(result.status==='FAIL')process.exitCode=1;
 }catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code??'A2G_AUDIT_FAILURE',message:'模型证据审计未完成，请检查报告和本机私有记录。'}));process.exitCode=1;}
}
