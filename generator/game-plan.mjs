import {closeCapabilities,selectCapabilities,capabilityKey,compactCatalog,digest,fault} from './catalog.mjs';
import {runGeneratorWorker} from './process.mjs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {conformanceInputGuidance} from './diagnostics.mjs';

/** Host draft: conceptual intent only, no initial board, constants or proposed solution. */
export async function buildGamePlan(prompt,options={}){
 const selection=selectCapabilities(prompt);
 const plan={format:'a2game-game-plan',version:1,
  concept:{genre:selection.mechanisms.map(m=>m.id).join('+'),dimension:/3d|三维/i.test(prompt)?'3d':'2d',orientation:/landscape|横屏/i.test(prompt)?'landscape':'portrait'},
  mechanisms:selection.mechanisms,controls:selection.inputSources.map(source=>({source,capability:{id:'a2game.input.'+source,version:'0.1.0'}})),entities:[],stateModel:[],
  gameFlow:{win:'由生成模型根据原始需求给出可执行目标，并以实际正例验证。',lose:'由生成模型明确失败或未完成条件，并以独立负例验证。'},
  presentation:{style:'遵循原始需求；目标、输入和状态须清晰可读。',resources:'primitives'},
  testIntent:['one-win','one-negative','restart','pause','terminal-freeze','determinism','dispose'],capabilities:selection.capabilities,
  hostProfile:{id:'generator-scene2d-v1',inputSources:selection.inputSources,backends:['air','three']},unmetCapabilities:[]};
 await validateGamePlan(plan,options);return {plan,selection};
}
export async function validateGamePlan(input,{signal,timeoutMs=8000}={}){
 const text=typeof input==='string'?input:JSON.stringify(input);
 if(typeof text!=='string'||Buffer.byteLength(text)>64*1024)throw fault('A2G_GEN_PLAN_SCHEMA','','GamePlan 超过 64 KiB。');
 const directory=mkdtempSync(join(tmpdir(),'a2game-plan-check-'));
 const response=await runGeneratorWorker('plan-check',{text,directory},{signal,timeoutMs,maxBytes:128*1024});
 const result=JSON.parse(response.stdout);
 if(result.status==='INFRA'&&result.code==='A2G_E_PYTHON_SCHEMA')throw Object.assign(fault(result.code,'','所选 Python 缺少完整 Draft 2020-12 校验依赖。'),{attribution:'INFRA',stage:'infra'});
 if(result.status!=='PASS')throw Object.assign(fault('A2G_GEN_PLAN_SCHEMA','','GamePlan 格式错误。'),{diagnostics:result.diagnostics});
 const plan=result.plan,keys=plan.capabilities.map(capabilityKey),selected=new Set(keys);
 if(plan.unmetCapabilities.length)throw fault('A2G_GEN_UNSUPPORTED_CAPABILITY','/unmetCapabilities','规划包含尚未满足的能力；不允许静默降级。');
 const closed=closeCapabilities(plan.capabilities);
 if(closed.length!==selected.size||closed.some(ref=>!selected.has(capabilityKey(ref))))throw fault('A2G_GEN_PLAN_DEPENDENCY','/capabilities','必须显式列出完整能力依赖闭包。');
 const mechanismIds=new Set();
 for(const [i,m] of plan.mechanisms.entries()){
  if(mechanismIds.has(m.id))throw fault('A2G_GEN_PLAN_REFERENCE',`/mechanisms/${i}/id`,'机制 ID 重复。');mechanismIds.add(m.id);
  for(const ref of m.capabilities)if(!selected.has(capabilityKey(ref)))throw fault('A2G_GEN_PLAN_REFERENCE',`/mechanisms/${i}/capabilities`,'机制引用了未选能力。');
  for(const id of m.entities)if(!plan.entities.includes(id))throw fault('A2G_GEN_PLAN_REFERENCE',`/mechanisms/${i}/entities`,'实体引用未声明。');
  for(const id of m.stateRefs)if(!plan.stateModel.includes(id))throw fault('A2G_GEN_PLAN_REFERENCE',`/mechanisms/${i}/stateRefs`,'状态引用未声明。');
 }
 const sources=new Set();
 for(const [i,c] of plan.controls.entries()){
  if(c.capability.id!=='a2game.input.'+c.source||!selected.has(capabilityKey(c.capability))||sources.has(c.source))throw fault('A2G_GEN_PLAN_REFERENCE',`/controls/${i}`,'输入源重复、未声明或与能力不符。');sources.add(c.source);
 }
 if(plan.hostProfile.inputSources.length!==sources.size||plan.hostProfile.inputSources.some(s=>!sources.has(s)))throw fault('A2G_GEN_PLAN_REFERENCE','/hostProfile/inputSources','Host 输入来源须与 controls 一致。');
 if(plan.concept.dimension==='3d'&&!selected.has('a2game.visual.stage@0.1.0'))throw fault('A2G_GEN_PLAN_REFERENCE','/concept/dimension','3D 规划必须显式选择 visual.stage 能力及依赖。');
 return plan;
}
export function checkReferenceInputProfile(game){
 const components=[...(game.scenes??[]).flatMap(s=>(s.entities??[]).flatMap(e=>e.components??[])),...Object.values(game.prototypes??{}).flatMap(e=>e.components??[])];
 for(const component of components.filter(c=>c.capability.id==='a2game.realtime.world'))for(const direction of ['left','right','up','down']){
  const id=component.config.actions?.[direction];if(!id)continue;
  const action=game.inputs.actions.find(a=>a.id===id),keyboard=action?.bindings.filter(b=>b.source==='keyboard.button')??[];
  if(keyboard.some(b=>b.config?.hold!==true))throw fault('A2G_GEN_INPUT_PROFILE','/inputs/actions',`realtime.world 的方向动作 ${id} 使用 keyboard.button 时需要 config.hold:true；默认同 Tick 的 press/release 会抵消移动。`);
 }
 return {status:'PASS',scope:'Reference host keyboard binding lint; physical source interaction still requires browser evidence'};
}
export function checkPlanGame(plan,game){
 const required=new Set((game.requires?.all??[]).map(capabilityKey)),allowed=new Set(plan.capabilities.map(capabilityKey));
 const components=[...(game.scenes??[]).flatMap(s=>(s.entities??[]).flatMap(e=>e.components??[])),...Object.values(game.prototypes??{}).flatMap(e=>e.components??[])];
 // Public tower-defense@0.1.0 already implements merge/replacement and cost/reward.
 // Keyword mechanisms describe behavior, not a demand for redundant service markers.
 const defense=components.filter(c=>capabilityKey(c.capability)==='a2game.strategy.tower-defense@0.1.0'&&required.has(capabilityKey(c.capability)));
 const bound=action=>game.inputs.actions.some(a=>a.id===action&&a.bindings?.length);
 const nativeMerge=defense.some(c=>c.config.cells?.length>=2&&c.config.actions?.some(a=>a.kind==='merge'&&bound(a.action)&&c.config.actions.some(b=>b.kind==='select'&&b.index!==a.index&&bound(b.action)))&&c.config.actions.some(a=>a.kind==='place'&&bound(a.action)));
 const nativeEconomy=defense.some(c=>c.config.cost>0&&c.config.waves?.some(w=>w.reward>0)&&c.config.actions?.some(a=>['place','upgrade'].includes(a.kind)&&bound(a.action)));
 const composed=(m,ref)=>ref.version==='0.1.0'&&(m.id==='merge'&&ref.id==='a2game.puzzle.merge'&&nativeMerge||m.id==='economy'&&ref.id==='a2game.strategy.economy'&&nativeEconomy);
 const mechanismBindings=[];
 for(const ref of [...(game.requires?.all??[]),...(game.requires?.anyOf??[]).flat()])if(!allowed.has(capabilityKey(ref)))throw fault('A2G_GEN_PLAN_GAME','/requires','生成内容超出规划能力闭包；请修改规划后重新生成。');
 for(const m of plan.mechanisms)for(const ref of m.capabilities){
  if(required.has(capabilityKey(ref)))mechanismBindings.push({mechanism:m.id,capability:capabilityKey(ref),source:'DECLARED'});
  else if(composed(m,ref))mechanismBindings.push({mechanism:m.id,capability:'a2game.strategy.tower-defense@0.1.0',source:'PUBLIC_NATIVE_COMPOSITION'});
  else throw fault('A2G_GEN_PLAN_GAME','/requires/all',`生成内容遗漏规划机制 ${m.id}。`);
 }
 for(const m of plan.mechanisms)for(const manifest of compactCatalog(m.capabilities).filter(c=>c.kind==='behavior')){
  if(!components.some(c=>capabilityKey(c.capability)===capabilityKey(manifest)))throw fault('A2G_GEN_PLAN_GAME','/scenes',`规划机制缺少可信组件绑定：${manifest.id}`);
 }
 for(const c of plan.controls)if(!game.inputs?.actions?.some(a=>a.bindings?.some(b=>b.source===c.source)))throw fault('A2G_GEN_PLAN_GAME','/inputs','生成内容遗漏规划输入源。');
 checkReferenceInputProfile(game);
 for(const key of plan.stateModel)if(!Object.hasOwn(game.state??{},key))throw fault('A2G_GEN_PLAN_GAME','/state',`生成内容遗漏规划状态 ${key}。`);
 const ids=new Set([...(game.scenes??[]).flatMap(s=>(s.entities??[]).map(e=>e.id)),...Object.keys(game.prototypes??{})]);
 for(const id of plan.entities)if(!ids.has(id))throw fault('A2G_GEN_PLAN_GAME','/scenes',`生成内容遗漏规划实体 ${id}。`);
 if(game.world?.dimension!==plan.concept.dimension)throw fault('A2G_GEN_PLAN_GAME','/world/dimension','生成内容与规划维度不一致。');
 return {status:'PASS',mechanismBindings,scope:'capability/control/reference consistency with public native composition; gameplay intent requires independent review'};
}
export function scopeRequest(request,selection,plan){
 const capabilities=compactCatalog(selection.capabilities),fullBytes=Buffer.byteLength(JSON.stringify(request));
 const constraints={...request.constraints,
  // Trusted Runtime assembly vocabulary, extracted from src/expression.ts + src/validator.ts (locked by test/generator-contract-vocab.test.mjs).
  referenceHostRuleAssembly:'Trusted Runtime contract v0.1.0 (authoritative; never guess syntax). (1) Rule condition expressions are ASTs. Leaf forms: {"const":value}, {"state":"/path"}, {"event":"/path"}, {"entityState":{"entity":"<id>","path":"/path"}}. Operator forms are exactly {"op":op,"args":[...]} with op in: and, or, not, eq, ne, lt, lte, gt, gte, add, sub, mul, div; comparison/math ops take numeric args. Symbols like "<", ">" or "+=" are INVALID ops. (2) rules[].do effects are trusted capability commands with EXACT fields: state.set{op,path,value}, state.add{op,path,value}, state.clamp{op,path,min,max}, entity.state.set{op,entity,path,value}, entity.spawn{op,prototype,id,state}, entity.despawn{op,entity}, event.emit{op,eventType,payload}, feedback.emit{op,cueType,payload}, flow.pause{op}, timer.schedule{op,id,delayTicks,periodTicks,eventType,payload}; each op must be declared by a selected rule-op capability manifest. (3) Entity components accept only capabilities whose manifest kind is behavior, core or presentation; rule-op, recognizer and service kinds must NEVER be bound as scene components. Declare every used capability in requires.all.',
  referenceHostInput:'Default keyboard.button shortcuts emit press+release in one Tick. For realtime.world directional actions, config.hold:true is required so held keys emit real down/hold/up edges and movement is not cancelled.',referenceHostConformance:conformanceInputGuidance,referenceHostPresentation:'Declare a2game.visual.body-style when using circle or value-dependent body styles. At 390px viewport, plan for a canvas around 350x376 CSS px: important text must remain >=16 CSS px after fit scaling. Reflow rather than using tiny labels; render meaningful result words, not raw booleans. Use legible high-contrast text against its actual background and distinguish game pieces visually; do not display internal numeric identifiers as player-facing labels.'};
 const scoped={...request,constraints,capabilities,selection:{catalogDigest:selection.catalogDigest??null,capabilitiesSha256:digest(capabilities),policy:selection.selectionPolicy??'EXPLICIT_PLAN',semanticCompleteness:'NOT_PROVEN'},...(plan?{gamePlan:plan,compilation:{source:'a2game-game-plan@1',planSha256:digest(plan),instruction:'Compile the validated plan into GameSpec JSON; preserve every mechanism and input source. No scripts. Do not substitute a counter for another requested game.'}}:{})};
 return {request:scoped,measurement:{scope:'PRE_PROVIDER_REQUEST; adapter overlays may add public context',fullRequestBytes:fullBytes,selectedRequestBytes:Buffer.byteLength(JSON.stringify(scoped)),selectedCapabilities:capabilities.length,tokens:null,successRate:'NOT_MEASURED'}};
}
