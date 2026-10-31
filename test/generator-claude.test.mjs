import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {probeProvider} from '../generator/providers.mjs';
import {parseClaudeReply} from '../scripts/claude-generator.mjs';

test('claude provider probe validates executable, explicit model and bounded timeout',async()=>{
 const base=join(tmpdir(),'a2game-claude-probe-');
 const config={executable:process.execPath,model:'glm-5.3',generationTimeoutMs:300000};
 writeFileSync(base+'ok.json',JSON.stringify(config));
 const ok=await probeProvider({id:'claude',configFile:base+'ok.json'});
 assert.equal(ok.status,'READY');
 assert.equal(ok.requestedModelId,'glm-5.3');
 assert.equal(ok.identityStatus,'UNVERIFIED');
 // Model selection is an explicit host-configured value, never inherited or silently substituted.
 assert.equal(ok.supportsJsonMode,false);
 for(const broken of [{...config,executable:'Z:/missing/claude.exe'},{...config,model:''},{...config,generationTimeoutMs:600000+1}]){
  writeFileSync(base+'bad.json',JSON.stringify(broken));
  const probe=await probeProvider({id:'claude',configFile:base+'bad.json'});
  assert.equal(probe.status,'BLOCKED');assert.equal(probe.code,'A2G_GEN_CONFIG');
 }
 rmSync(base+'ok.json');rmSync(base+'bad.json');
});

test('claude response errors preserve their failure code when result is absent or invalid',()=>{
 for(const raw of ['null','[]','{}','{"is_error":true}','{"result":42}','not json']){
  const result=parseClaudeReply(raw,{code:0});
  assert.equal(result.failure,'A2G_E_CLAUDE_OUTPUT');
  assert.equal(result.output,null);
 }
 const success=parseClaudeReply('{"result":"{}","num_turns":1,"subtype":"success"}',{code:0});
 assert.equal(success.failure,undefined);
 assert.equal(success.output,'{}');
 assert.equal(parseClaudeReply('',{code:null,error:'A2G_E_CLAUDE_TIMEOUT'}).failure,'A2G_E_CLAUDE_TIMEOUT');
});
