import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {capabilityManifestDigest} from '../dist/content-release.js';
import {makeRegistry,spec} from './registry.mjs';

const catalog=JSON.parse(await readFile('docs/history/A2Game-Three-Game-Business-Test-Catalog-2026-11-22.json','utf8'));
const cases=catalog.cases.filter(item=>/^AI-0[1-6]$/.test(item.id));
assert.equal(cases.length,6);
const manifests=makeRegistry().list();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=`output/three-games-agent-preparation-${Date.now()}`;
await mkdir(output,{recursive:true});

async function save(file,value){
  const bytes=JSON.stringify(value,null,2)+'\n';
  await writeFile(join(output,file),bytes,{flag:'wx'});
  return {file,sha256:sha(bytes)};
}

const context=await save('public-context.json',{
  specVersion:'0.1.0',
  capabilityManifestDigest:capabilityManifestDigest(manifests),
  capabilities:manifests,
  gameSchema:JSON.parse(await readFile(join(spec,'schemas/game.schema.json'),'utf8')),
  conformanceSchema:JSON.parse(await readFile(join(spec,'schemas/test-suite.schema.json'),'utf8')),
  inputTraceSchema:JSON.parse(await readFile(join(spec,'schemas/input-trace.schema.json'),'utf8')),
  inputTraceSessionExample:{
    gameId:'example-game',gameRevision:1,tickHz:60,seed:42,
    inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1',recognizers:{}
  },
  pointerTraceExample:{
    source:'pointer',kind:'down',tickIndex:0,seq:0,timeUs:0,
    payload:{pointerId:1,pointerType:'touch',u:0.5,v:0.75,viewportAspect:0.625}
  },
  host:{protocol:'0.1.0',engineBackends:['three','cocosairjs'],collectionVersion:2,
    collectionLevelFields:['id','title','hint','par','game','sha256'],optionalCollectionScoreField:'baseScore',
    scoreSession:{
      extension:'x-a2game-score-session',
      scorePath:'Both extensions.x-a2game-score-session.scorePath and scoreAcceptance.scorePath resolve inside the logical state object. For GameSpec state.flight.initial.score = 0, use /flight/score. Use /state/flight/score only in Conformance observation assertions.',
      bodyAssertions:'The integer world sorts surviving bodies by ID, not spawn order. For a JSON Pointer into bodies, derive the index from all surviving bodies at the assertion Tick, including the player, projectiles and pickups.',
      traceSession:'Copy gameId, gameRevision, tickHz and seed from the generated GameSpec. Keep inputNormalizerVersion and coordinateProfile exactly as in inputTraceSessionExample. If the last player input precedes the expected death, append a system checkpoint with an empty payload at or after the expected terminal Tick so replay advances far enough.',
      traceTiming:'For every event, including system checkpoints, use integer timeUs = ceil(tickIndex * 1000000 / tickHz). The last valid integer is ceil((tickIndex + 1) * 1000000 / tickHz) - 1. At 60 Hz, Tick 14 starts at 233334 µs. Events on the same Tick may share timeUs if seq strictly increases.'
    },
    resources:'原创程序化表现，或宿主明确批准的资源引用。当前任务包无额外批准的资源 ID。'},
  output:{
    content:'单局提供 game.json。多关同时提供版本 2 collection.json 和全部引用的关卡定义。',
    tests:'提供可复验的 Conformance。有限目标关卡提供合法通关输入和必要失败输入；得分游戏提供正常死亡、预期得分和输入轨迹。',
    evidence:'提供完整原始输出、失败诊断与修复记录。运行时与 Adapter 保持冻结，不提供作者版内容或解法。'
  }
});

const requirements={
  'AI-01':'制作原创连续得分飞机游戏。自动射击，三种敌机和三个难度阶段，末段持续刷敌。包含双发、炸弹、死亡结算、重开和本地最高分。',
  'AI-02':'制作原创叠牌教学与主挑战。教学 18 张、3 类、2 层。主挑战 144 张、12 类、至少 6 层真实遮挡，七格槽。移出、撤回和洗牌各一次，提供合法胜负输入与局中恢复。',
  'AI-03':'制作原创交换三消 12 个主关及 3 个组合变体。覆盖普通匹配、四连、T/L、五连、冰层、箱体、孔洞与出口和六种组合。每关给出目标、步数、星级门槛和通关见证。包含道具、失败重试、续关和最佳成绩。',
  'AI-04':'基于 AI-01 的独立输出调整敌机配比、速度曲线和原创主题。继续支持原计分和终局流程。',
  'AI-05':'基于 AI-02 的独立输出改造主挑战的遮挡图和牌分布，保留七格槽和三张消除。提交实际可达解。',
  'AI-06':'基于 AI-03 的独立输出新增不同棋盘形状、障碍和双目标组合。包含无效交换、连锁、最后一步达标和合法失败。'
};
const tasks=[];
for(const item of cases){
  const index=Number(item.id.slice(-2));
  const requiresIndependentOutput=index>3?`AI-0${index-3}`:undefined;
  const artifact=await save(item.id+'.json',{
    id:item.id,title:item.title,scope:item.scope,
    ...(requiresIndependentOutput?{requiresIndependentOutput}:{}),
    request:requirements[item.id],expected:item.expected,evidence:item.evidence,
    publicContext:context,status:'PREPARED_NOT_RUN'
  });
  tasks.push({id:item.id,...artifact,status:'NOT_RUN'});
}
await save('index.json',{status:'PREPARED_NOT_RUN',publicContext:context,tasks,providerCalls:0});
console.log(JSON.stringify({output,tasks:tasks.length,publicCapabilities:manifests.length,providerCalls:0}));
