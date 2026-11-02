/** Read-only review of host evidence. Integrity success never upgrades an acceptance gate. */
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {contracts,resultSchema} from '../integrations/mcp/contract.mjs';
import {decodeHostResult} from './host-agent-run.mjs';

const root=resolve(import.meta.dirname,'..');
const expected=Object.keys(contracts).sort();
const normalize=name=>expected.find(tool=>name===tool||name.endsWith('__'+tool)||name.endsWith('_'+tool.replaceAll('.','_')));
const pointer=(object,path)=>path.split('/').slice(1).reduce((value,key)=>value?.[key],object);

export function auditHostReview(review,workspace=root){
 const reportRoot=realpathSync(resolve(workspace,'reports'));
 const read=evidence=>{
  const path=realpathSync(resolve(workspace,evidence.file));
  if(!path.startsWith(reportRoot+sep))throw Error('Evidence must stay inside reports');
  const bytes=readFileSync(path);
  if(createHash('sha256').update(bytes).digest('hex')!==evidence.sha256)throw Error('Evidence SHA mismatch: '+evidence.file);
  return bytes.toString('utf8');
 };
 const hosts=review.hosts.map(host=>{
  for(const evidence of host.references)read(evidence);
  const source=JSON.parse(read(host.toolEvidence));
  const list=pointer(source,host.toolEvidence.pointer);
  if(!Array.isArray(list))throw Error('Tool list missing: '+host.host);
  const names=list.map(item=>normalize(typeof item==='string'?item:item.serverOriginalName??item.serverName??item.name??item.hostId??item.sessionAlias));
  if(JSON.stringify(names.slice().sort())!==JSON.stringify(expected))throw Error('Tool list differs: '+host.host);
  let hostResponse='NOT_PRESERVED';
  let hostResponseSchema='NOT_RUN',serverComparison='NOT_CAPTURED';
  let directProbe=null;
  if(host.probeResponse){
   const response=JSON.parse(read(host.probeResponse));
   if(response.runId!==host.probeResponse.runId)throw Error('Probe response runId mismatch: '+host.host);
   directProbe={runId:response.runId,channel:host.probeResponse.channel,
    relation:response.runId===host.hostRunId?'SAME_ID':'DIFFERENT_FROM_HOST_CLAIM'};
  }
  if(host.hostResponse){
   const response=pointer(decodeHostResult(read(host.hostResponse)),host.hostResponse.pointer??'');
   if(response.runId!==host.hostRunId)throw Error('Host response runId mismatch: '+host.host);
   hostResponseSchema=resultSchema.safeParse(response).success?'PASS':'FAIL';
   hostResponse=hostResponseSchema==='PASS'&&response.status==='PASS_REFERENCE'&&response.data?.modelCalls===0?'ARCHIVED_RESPONSE_MATCHES':'INVALID_HOST_RESPONSE';
   if(host.serverReceipt){
    const original=resultSchema.parse(JSON.parse(read(host.serverReceipt)));
    if(original.runId!==host.hostRunId)throw Error('Server receipt runId mismatch: '+host.host);
    serverComparison=isDeepStrictEqual(original,response)?'MATCH':'DIFFERENT';
    if(serverComparison==='DIFFERENT')hostResponse='DIFFERS_FROM_SERVER';
   }
  }
  return {host:host.host,status:host.status,toolCount:names.length,hostResponse,hostResponseSchema,serverComparison,directProbe,
   configurationScope:host.configurationScope,skillDiscovery:host.skillDiscovery,findings:host.findings};
 });
 return {format:'a2game-host-first-audit',version:1,integrity:'PASS',acceptance:review.status,
  responseConsistency:hosts.some(h=>h.hostResponseSchema==='FAIL'||h.serverComparison==='DIFFERENT')?'FAIL':'PASS_WITHIN_ARCHIVED_SCOPE',
  scope:'Checks archived file integrity, tool names and response IDs; does not independently attest host execution or upgrade gates.',
  hostCount:hosts.length,hosts,hostNativeUsage:'UNKNOWN',formalG3:'NOT_RUN'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const result=auditHostReview(JSON.parse(readFileSync(resolve(root,'project/host-first-review.json'),'utf8')));console.log(JSON.stringify(result,null,2));if(result.responseConsistency==='FAIL')process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=1;}
}
