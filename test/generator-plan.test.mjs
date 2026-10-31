import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildGamePlan,validateGamePlan,generateGame,testGeneratedDirectory} from '../generator/index.mjs';
import {selectCapabilities,closeCapabilities,capabilityKey} from '../generator/catalog.mjs';
import {scopeRequest,checkPlanGame} from '../generator/game-plan.mjs';
import {buildAgentRequest} from '../scripts/agent-workflow.mjs';
import {createFixture} from '../generator/fixture.mjs';
import {classifyFailure} from '../generator/diagnostics.mjs';

test('public mechanism selection closes exact registry dependencies and refuses unsupported intentions',async()=>{
 for(const prompt of ['推箱子，支持撤销','三消','飞机射击','塔防','合成炮台保卫战']){
  const selection=selectCapabilities(prompt),keys=selection.capabilities.map(capabilityKey);
  assert.deepEqual(closeCapabilities(selection.capabilities).map(capabilityKey),keys);
  const scoped=scopeRequest(buildAgentRequest(prompt,1),selection);
  assert.ok(scoped.request.capabilities.length<127);
  assert.equal(scoped.request.gamePlan,undefined);
  assert.match(scoped.request.constraints.referenceHostConformance,/expectError/);
  assert.equal(scoped.measurement.tokens,null);
  for(const manifest of scoped.request.capabilities){assert.ok(manifest.contract);assert.equal(manifest.testSuites,undefined);}
 }
 for(const prompt of ['做点好玩的','联网对战 counter','a2game.future.teleport','a2game.puzzle.grid-push@99.0.0'])assert.throws(()=>selectCapabilities(prompt));
 const selected=selectCapabilities('独立设计推箱子。不能以任意按钮计数替代真实玩法。');
 assert.deepEqual(selected.mechanisms.map(m=>m.id),['grid-push']);
 assert.deepEqual(selectCapabilities('Sokoban. Do not replace it with a counter.').mechanisms.map(m=>m.id),['grid-push']);
 assert.ok(selectCapabilities('塔防').capabilities.some(c=>c.id==='a2game.visual.body-style'));
 const {plan}=await buildGamePlan('手机三消');
 assert.equal(plan.format,'a2game-game-plan');assert.equal(plan.unmetCapabilities.length,0);
 assert.equal('solution' in plan,false);assert.equal('game' in plan,false);
});

test('GamePlan full schema, strict JSON, references and dependency conflict checks precede generation',async()=>{
 const {plan}=await buildGamePlan('counter');
 const cases=[
  [p=>{p.version=2;},'A2G_GEN_PLAN_SCHEMA'],
  [p=>{p.mechanisms[0].entities=['missing'];},'A2G_GEN_PLAN_REFERENCE'],
  [p=>{p.mechanisms[0].stateRefs=['missing'];},'A2G_GEN_PLAN_REFERENCE'],
  [p=>{p.controls[0].capability.id='a2game.input.touch.tap';},'A2G_GEN_PLAN_REFERENCE'],
  [p=>{p.hostProfile.inputSources=[];},'A2G_GEN_PLAN_REFERENCE'],
  [p=>{p.capabilities=p.capabilities.filter(c=>c.id!=='a2game.core.state');},'A2G_GEN_PLAN_DEPENDENCY'],
  [p=>{p.unmetCapabilities=['teleport'];},'A2G_GEN_UNSUPPORTED_CAPABILITY'],
  [p=>{p.capabilities.push({id:'a2game.core.state',version:'99.0.0'});},null]
 ];
 for(const [mutate,code] of cases){const changed=structuredClone(plan);mutate(changed);await assert.rejects(validateGamePlan(changed),code?{code}:undefined);}
 await assert.rejects(validateGamePlan(JSON.stringify(plan).replace('{','{"version":1,')),{code:'A2G_GEN_PLAN_SCHEMA'});
 const {plan:push}=await buildGamePlan('推箱子');
 assert.throws(()=>checkPlanGame(push,createFixture().game),{code:'A2G_GEN_PLAN_GAME'});
 const outputDirectory=join(mkdtempSync(join(tmpdir(),'a2game-invalid-plan-')),'output');
 const rejected=await generateGame({prompt:'counter',mode:'game-plan',gamePlan:{},outputDirectory});
 assert.equal(rejected.status,'BLOCKED');assert.equal(rejected.fixtureCalls,0);assert.equal(existsSync(outputDirectory),false);
});

test('native tower merge/cost/reward satisfy keyword intent without redundant service markers',()=>{
 // Public authored fixture is unit-test data only; never exported to generation context.
 const game=JSON.parse(readFileSync(new URL('../specs/v0.1/games/h01-candidate.game.json',import.meta.url),'utf8'));
 const selection=selectCapabilities('合成炮台保卫战，经济消耗与奖励');
 const plan={mechanisms:selection.mechanisms,capabilities:closeCapabilities([...selection.capabilities,...game.requires.all]),controls:[],stateModel:[],entities:[],concept:{dimension:'2d'}};
 const evidence=checkPlanGame(plan,game);assert.ok(evidence.mechanismBindings.some(m=>m.mechanism==='merge'&&m.source==='PUBLIC_NATIVE_COMPOSITION'));
 const absent=structuredClone(game);for(const s of absent.scenes)for(const e of s.entities)for(const c of e.components??[])if(c.capability.id==='a2game.strategy.tower-defense')c.config.actions=c.config.actions.filter(a=>a.kind!=='merge');
 assert.throws(()=>checkPlanGame(plan,absent),{code:'A2G_GEN_PLAN_GAME'});
 const noRewards=structuredClone(game);for(const s of noRewards.scenes)for(const e of s.entities)for(const c of e.components??[])if(c.capability.id==='a2game.strategy.tower-defense')for(const wave of c.config.waves)wave.reward=0;
 assert.throws(()=>checkPlanGame(plan,noRewards),{code:'A2G_GEN_PLAN_GAME'});
});

test('direct and plan compile the same fixture through authoritative admission and lifecycle gates',async()=>{
 const base=mkdtempSync(join(tmpdir(),'a2game-plan-compile-'));
 let expected;
 for(const mode of ['direct-json','game-plan']){
  const outputDirectory=join(base,mode),report=await generateGame({prompt:'Counter',mode,outputDirectory});
  assert.equal(report.status,'PASS_REFERENCE',JSON.stringify(report));
  const game=JSON.parse(readFileSync(join(outputDirectory,'game.json'),'utf8'));
  if(expected)assert.deepEqual(game,expected);else expected=game;
  assert.equal(existsSync(join(outputDirectory,'game-plan.json')),mode==='game-plan');
  const life=JSON.parse(readFileSync(join(outputDirectory,'tests/lifecycle.json'),'utf8'));
  assert.equal(life.status,'PASS_REFERENCE');assert.equal(life.checks.restart,'PASS');assert.equal(life.hostResources,'NOT_RUN');
  assert.equal(report.generationCalls,0);assert.equal(report.fixtureCalls,1);assert.equal(report.G3,'NOT_RUN');
  assert.ok(report.contexts[0].selectedCapabilities<127);
  if(mode==='game-plan'){
   assert.equal((await testGeneratedDirectory(outputDirectory)).status,'PASS_REFERENCE');
   const plan=JSON.parse(readFileSync(join(outputDirectory,'game-plan.json'),'utf8'));plan.stateModel=['missing'];
   writeFileSync(join(outputDirectory,'game-plan.json'),JSON.stringify(plan));
   assert.equal((await testGeneratedDirectory(outputDirectory)).code,'A2G_GEN_PLAN_GAME');
  }
 }
 assert.equal(classifyFailure('A2G_E_PROVIDER_JSON'),'GENERATION_FORMAT');
 assert.equal(classifyFailure('A2G_E_CAP_UNKNOWN'),'CAPABILITY_SEMANTICS');
 assert.equal(classifyFailure('A2G_E_AGENT_RUNTIME',null,'A2G_E_AGENT_SOLUTION: invalid'),'GAMEPLAY_CONFORMANCE');
 assert.equal(classifyFailure('A2G_GEN_TIMEOUT'),'PROVIDER_INFRA');
});
