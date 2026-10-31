/** A host-selected Claude Code CLI routed to the user's configured endpoint (GLM coding plan via
 * ANTHROPIC_BASE_URL in user settings). Print mode, single turn, tools disallowed, isolated cwd.
 * The model id is an explicit host-configured selection; auth is inherited, never read here.
 */
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {buildGenerationPrompt} from './codex-generator.mjs';
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
export function parseClaudeReply(raw,result){
 let parsed,failure=result.error;
 if(!failure&&result.code!==0)failure='A2G_E_CLAUDE_EXIT';
 if(!failure)try{
  parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('invalid envelope');
 }catch{failure='A2G_E_CLAUDE_OUTPUT';}
 if(!failure&&(parsed.is_error===true||(parsed.subtype&&parsed.subtype!=='success')||typeof parsed.result!=='string'||!parsed.result.trim()))failure='A2G_E_CLAUDE_OUTPUT';
 // Tool use or agentic turns would break isolation evidence; a single text turn is the contract.
 if(!failure&&(typeof parsed.num_turns!=='number'||parsed.num_turns>1))failure='A2G_E_CLAUDE_TOOLS';
 if(!failure&&Buffer.byteLength(parsed.result)>768*1024)failure='A2G_E_CLAUDE_SIZE';
 return {parsed,failure,output:typeof parsed?.result==='string'?parsed.result:null};
}
export async function generateClaude(config,request,directory){
 if(typeof config.executable!=='string'||!existsSync(config.executable)||typeof config.model!=='string'||!config.model.trim()||config.model.length>200||!Number.isInteger(config.generationTimeoutMs)||config.generationTimeoutMs<1000||config.generationTimeoutMs>600000)throw Object.assign(Error('无效的 Claude 路径、模型或生成时限。'),{code:'A2G_E_CLAUDE_CONFIG'});
 const cwd=mkdtempSync(join(tmpdir(),'a2game-claude-generation-'));
 const {prompt}=buildGenerationPrompt(request);
 save(resolve(directory,'request.json'),request);
 // Large protocol prompt goes over stdin; argv stays small. Tools are denied and one turn is allowed.
 // The hardened append-system-prompt suppresses environment-context preambles (validated against the
 // real 150KB generation prompt: raw bare JSON output, see t4 evidence in the host-integration receipt).
 const args=['-p','--output-format','json','--model',config.model,'--max-turns','1','--append-system-prompt','You are a generation pipeline endpoint. Output ONLY the raw JSON object as the entire response: no greetings, no confirmation text, no Markdown fences, no explanation. First byte of output must be \'{\' and last byte must be \'}\'.','--disallowedTools','Bash','Read','Write','Edit','MultiEdit','NotebookEdit','WebFetch','WebSearch','Task','Glob','Grep','TodoWrite','Skill'];
 const started=performance.now();let raw='',stderrBytes=0;const version=execFileSync(config.executable,['--version'],{encoding:'utf8',timeout:5000,windowsHide:true}).trim();
 const result=await new Promise((accept,reject)=>{
  const child=spawn(config.executable,args,{cwd,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});let finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):accept(value);};
  const timer=setTimeout(()=>{child.kill();finish(Object.assign(Error('Claude 生成超时。'),{code:'A2G_E_CLAUDE_TIMEOUT'}));},config.generationTimeoutMs);
  child.once('error',()=>finish(Object.assign(Error('无法启动已配置的 Claude。'),{code:'A2G_E_CLAUDE_START'})));
  child.stdout.setEncoding('utf8');child.stdout.on('data',c=>{raw+=c;if(Buffer.byteLength(raw)>1536*1024){child.kill();finish(Object.assign(Error('Claude 输出超出预算。'),{code:'A2G_E_CLAUDE_SIZE'}));}});
  child.stderr.on('data',c=>stderrBytes+=c.length);child.stdin.on('error',()=>{});
  child.once('close',code=>finish(null,{code}));child.stdin.end(prompt);
 }).catch(e=>({code:null,error:e.code??'A2G_E_CLAUDE_START'}));
 const {parsed,failure,output}=parseClaudeReply(raw,result);
 const telemetry={format:'a2game-claude-call',version:1,status:failure?'FAIL':'PASS',failure,executable:{name:basename(config.executable),version,sha256:hash(readFileSync(config.executable))},model:config.model,modelOverride:true,modelOverrideAuthorization:'HOST_CONFIGURED_NOT_ATTESTED',sandbox:'print-mode single turn, tools disallowed',isolatedDirectory:cwd,requestSha256:hash(JSON.stringify(request)),renderedPromptSha256:hash(prompt),elapsedMs:performance.now()-started,deadlineMs:config.generationTimeoutMs,exitCode:result.code,stderrBytes,usage:parsed?.usage&&Number.isInteger(parsed.usage.input_tokens)?{prompt_tokens:parsed.usage.input_tokens,completion_tokens:parsed.usage.output_tokens??null}:null,cost:typeof parsed?.total_cost_usd==='number'?parsed.total_cost_usd:'NOT_REPORTED',sessionId:typeof parsed?.session_id==='string'?parsed.session_id.slice(0,64):null,outputSha256:output!==null?hash(output):null};
 save(resolve(directory,'cli.json'),telemetry);
 if(output!==null)writeFileSync(resolve(directory,'output.raw.json'),output);
 if(failure)throw Object.assign(Error('Claude 调用未完成，详见 cli.json。'),{code:failure});return telemetry;
}
