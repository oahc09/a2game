/** Read all canonical calls assigned at service startup, never infer a run from artifacts. */
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
import {createHash} from 'node:crypto';
import {existsSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import {join,sep} from 'node:path';
import {resultSchema} from '../integrations/mcp/contract.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readHostRunLedger(workspace,hostRunId){
 const calls=[],problems=[],output=join(workspace,'output/mcp');
 if(!uuid(hostRunId))return {calls,problems:['HOST_RUN_BINDING_REQUIRED']};
 if(!existsSync(output))return {calls,problems:['CANONICAL_LEDGER_MISSING']};
 const base=realpathSync(output),safe=path=>{const resolved=realpathSync(path);if(!resolved.startsWith(base+sep))throw Error('Canonical ledger escapes output/mcp');return resolved;};
 let sessions=0;
 for(const dir of readdirSync(output,{withFileTypes:true}).filter(e=>e.isDirectory())){
  const sessionPath=join(output,dir.name,'session.json');if(!existsSync(sessionPath))continue;
  const sessionBytes=readFileSync(safe(sessionPath)),session=JSON.parse(sessionBytes);if(session.hostRunId!==hostRunId)continue;
  sessions++;
  if(session.implementationSha256!==hostSourceFingerprint(workspace))problems.push('SESSION_IMPLEMENTATION_CHANGED_OR_UNBOUND:'+session.sessionId);
  if(session.format!=='a2game-mcp-session'||session.version!==1||session.sessionId!==dir.name||!uuid(session.sessionId))throw Error('Invalid canonical session identity');
  const directory=safe(join(output,dir.name)),sequences=[];
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.call.json'))){
   const callBytes=readFileSync(safe(join(directory,file))),call=JSON.parse(callBytes);
   if(call.format!=='a2game-mcp-call'||call.sessionId!==session.sessionId||call.hostRunId!==hostRunId||!uuid(call.runId)||file!==call.runId+'.call.json'||!Number.isInteger(call.sequence)||call.sequence<1)throw Error('Canonical call identity or run binding differs');
   sequences.push(call.sequence);
   const responsePath=join(directory,call.runId+'.receipt.json');let responseBytes=null,response=null;
   if(existsSync(responsePath)){
    responseBytes=readFileSync(safe(responsePath));response=resultSchema.parse(JSON.parse(responseBytes));
    if(response.runId!==call.runId)throw Error('Canonical response identity differs');
   }
   if(call.state!=='COMPLETED'||!responseBytes)problems.push('CANONICAL_CALL_INCOMPLETE:'+call.runId);
   else if(call.receiptSha256!==sha(responseBytes))throw Error('Canonical response SHA mismatch');
   if(call.budgetConsumed!==0||call.unknownCalls!==0)problems.push('CANONICAL_PROVIDER_BUDGET_UNKNOWN_OR_CONSUMED:'+call.runId);
   if(call.tool==='a2game.generate_game')problems.push('PROVIDER_GENERATION_FORBIDDEN:'+call.runId);
   if(calls.some(e=>e.call.runId===call.runId))throw Error('Duplicate canonical call identity');
   calls.push({call,response,callBytes,responseBytes});
  }
  sequences.sort((a,b)=>a-b);
  if(!Number.isInteger(session.lastSequence)||session.lastSequence!==sequences.length||sequences.some((value,index)=>value!==index+1))problems.push('CANONICAL_SEQUENCE_GAP:'+session.sessionId);
  if(!readFileSync(safe(sessionPath)).equals(sessionBytes))problems.push('CANONICAL_SESSION_CHANGED_DURING_CHECK:'+session.sessionId);
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.receipt.json'))){
   if(!existsSync(join(directory,file.replace('.receipt.json','.call.json'))))problems.push('CANONICAL_METADATA_MISSING:'+file);
  }
 }
 if(!sessions)problems.push('BOUND_CANONICAL_SESSION_MISSING');
 return {calls,problems};
}
