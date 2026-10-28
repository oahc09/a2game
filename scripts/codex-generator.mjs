/** A host-selected Codex CLI, isolated from repository examples. No model-selected commands. */
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {mobileInputSources,gamepadInputSources} from '../dist/index.js';
const workspace=resolve(import.meta.dirname,'..');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
export function withCodexHostProfile(request){
 const publicPaths=['src/modules/puzzle.ts','src/modules/grid-push.ts','src/modules/grid-slide-merge.ts','src/modules/realtime.ts','src/modules/strategy.ts','src/modules/tower-defense.ts','src/modules/input-control.ts','src/modules/rigid3d.ts','src/modules/bubble-grid.ts','src/modules/bootstrap.ts','src/rng.ts'];
 const publicLibrary=Object.fromEntries(publicPaths.map(path=>{const source=readFileSync(resolve(workspace,path),'utf8');return [path,{sha256:hash(source),source}];}));
 const presentation=readFileSync(resolve(workspace,'specs/v0.1/docs/06-Presentation-Slice-V0.1.md'),'utf8').split('## 4.')[0];
 return {...request,hostProfile:{version:2,publicLibrary,publicPresentationContract:presentation,libraryBoundary:'These are generic trusted library implementations, NOT game definitions, author levels, solutions or tests. Read their initial-state types/factories and config invariants; use the declared capabilities in JSON, never copy executable code into GameSpec.',inputBindingSources:{'keyboard.button':'a2game.input.keyboard.button','touch.tap':'a2game.input.touch.tap','touch.swipe':'a2game.input.touch.swipe',...mobileInputSources,...gamepadInputSources},bindingRule:'binding.source uses the short source name (e.g. keyboard.button), while requires lists the full capability ID. keyboard.button config needs code. Declare capabilities for every binding.',observation:{paths:['/state/<declaredStateKey>','/flow/status','/tickIndex','/exactHash','/entities','/events'],flowStatus:'playing|paused|won|lost|stopped|error',note:'There is NO /status field. Positive case must assert /flow/status equals won; a separate negative case must end asserting playing or lost.'},buttons:'A button action is an edge: injectAction press then release before step. Repeating press without release is held, not a new press.',hostLimits:{scenes:1,presentation:'scene2d required; 3d additionally needs visual.stage capability and stage projection. Scene2d viewport is centered at (0,0), x in [-width/2,width/2], y in [-height/2,height/2], Y up. Keep complete board/title visible and text readable.',extensions:false,externalAssets:false},cases:'2–16 cases, first op start, each advances at least one Tick, at most 2048 ops and 12000 requested Ticks per case. Distinct final won and playing/lost cases required.'}};
}
export function collectCodexEvents(text){
 const events=text.trim().split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
 const tools=events.filter(e=>e.item&&['command_execution','file_change','mcp_tool_call','web_search'].includes(e.item.type));
 const completed=events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message');
 if(tools.length)throw Object.assign(Error('生成过程调用了工具，不能作为隔离生成证据。'),{code:'A2G_E_CODEX_TOOLS'});
 if(events.some(e=>e.type==='error'||e.type==='turn.failed')||!events.some(e=>e.type==='turn.completed')||completed.length!==1)throw Object.assign(Error('Codex 未完整返回单个最终结果。'),{code:'A2G_E_CODEX_OUTPUT'});
 const usage=events.findLast(e=>e.type==='turn.completed')?.usage??null;
 return {text:completed[0].item.text,events:events.map(e=>({type:e.type,...(e.item?{itemType:e.item.type}:{}),...(e.type==='thread.started'?{threadId:e.thread_id}:{}),...(e.type==='turn.completed'?{usage:e.usage}:{})})),usage};
}
export async function generateCodex(config,request,directory){
 if(typeof config.executable!=='string'||!existsSync(config.executable)||!Number.isInteger(config.generationTimeoutMs)||config.generationTimeoutMs<1000||config.generationTimeoutMs>600000)throw Object.assign(Error('无效的 Codex 路径或生成时限。'),{code:'A2G_E_CODEX_CONFIG'});
 const cwd=mkdtempSync(join(tmpdir(),'a2game-codex-generation-'));
 request=withCodexHostProfile(request);const {prompt:task,attempt,previous,...common}=request;
 // Stable protocol prefix is shared across games; task and repair text remain separate at the end.
 const prompt='You are an independent A2Game JSON generator. Do not use tools, read files, or inspect repository examples. Return exactly one JSON object, no Markdown. Follow the gameSchema, conformanceSchema, hostProfile and capability contracts below. Generate a new game and actual winning solution plus meaningful positive/negative cases. Do not substitute one-click score counters for the requested mechanics. provenance.kind must be independent-model; provenance.model must identify the model truthfully, or say inherited-cli-default if unknown. Never claim G3 acceptance.\nPROTOCOL\n'+JSON.stringify(common)+'\nTASK\n'+JSON.stringify({prompt:task,attempt,...(previous?{previous}:{})});
 save(resolve(directory,'request.json'),request);
 const args=['exec','--ephemeral','--json','--sandbox','read-only','--skip-git-repo-check','-c','features.shell_tool=false','-C',cwd,'-'];
 const started=performance.now();let raw='',stderrBytes=0;const version=execFileSync(config.executable,['--version'],{encoding:'utf8',timeout:5000,windowsHide:true}).trim();
 const result=await new Promise((accept,reject)=>{
  const child=spawn(config.executable,args,{cwd,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});let finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):accept(value);};
  const timer=setTimeout(()=>{child.kill();finish(Object.assign(Error('Codex 生成超时。'),{code:'A2G_E_CODEX_TIMEOUT'}));},config.generationTimeoutMs);
  child.once('error',()=>finish(Object.assign(Error('无法启动已配置的 Codex。'),{code:'A2G_E_CODEX_START'})));
  child.stdout.setEncoding('utf8');child.stdout.on('data',c=>{raw+=c;if(Buffer.byteLength(raw)>1536*1024){child.kill();finish(Object.assign(Error('Codex 事件流超出预算。'),{code:'A2G_E_CODEX_SIZE'}));}});child.stderr.on('data',c=>stderrBytes+=c.length);child.stdin.on('error',()=>{});
  child.once('close',code=>finish(null,{code}));child.stdin.end(prompt);
 }).catch(e=>({code:null,error:e.code??'A2G_E_CODEX_START'}));
 let parsed,failure=result.error;
 if(!failure&&result.code!==0)failure='A2G_E_CODEX_EXIT';
 if(!failure)try{parsed=collectCodexEvents(raw);if(Buffer.byteLength(parsed.text)>768*1024)failure='A2G_E_CODEX_SIZE';}catch(e){failure=e.code??'A2G_E_CODEX_OUTPUT';}
 const telemetry={format:'a2game-codex-call',version:1,status:failure?'FAIL':'PASS',failure,executable:{name:basename(config.executable),version,sha256:hash(readFileSync(config.executable))},model:'inherited-cli-default',modelOverride:false,sandbox:'read-only',shellTool:false,isolatedDirectory:cwd,requestSha256:hash(JSON.stringify(request)),renderedPromptSha256:hash(prompt),elapsedMs:performance.now()-started,deadlineMs:config.generationTimeoutMs,exitCode:result.code,stderrBytes,usage:parsed?.usage??null,cost:'NOT_REPORTED',events:parsed?.events??[],outputSha256:parsed?hash(parsed.text):null};
 save(resolve(directory,'cli.json'),telemetry);
 if(parsed)writeFileSync(resolve(directory,'output.raw.json'),parsed.text);
 if(failure)throw Object.assign(Error('Codex 调用未完成，详见 cli.json。'),{code:failure});return telemetry;
}
// Validation consumes only a host-selected recorded output; generation has its own bounded CLI lifetime.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv[2]!=='--read-output')throw Error('用法：codex-generator.mjs --read-output <已记录原始输出>');let bytes=0;for await(const c of process.stdin){bytes+=c.length;if(bytes>2*1024*1024)throw Error('请求超出预算。');}const raw=readFileSync(resolve(process.argv[3]));if(raw.length>768*1024)throw Error('输出超出预算。');process.stdout.write(raw);}
 catch{console.error('A2G_E_CODEX_RECORDED_OUTPUT：无法读取宿主指定的生成结果。');process.exitCode=1;}
}
