# G3 主 Agent、子 Agent与审查交接

让其他 AI Agent 调度子 Agent，由本轮明确选定的模型实际生成，再统一进行 G3 验证和本会话审查。目标是收集 Qwen、MiniMax、GLM、DeepSeek 等模型的真实结果，用可复现的失败改进技能体系。模型比较条件、结果指标和技能反馈见 [多模型评测](g3-model-evaluation.md)。最初为 **DESIGN_ONLY**；2026-10-28 用户显式授权首轮执行：仅 G01、原生子 Agent 模式、新增生成预算 3（实际用满 3：Conformance 失败、输出格式失败、第三次工程 PASS_REFERENCE），批次 `reports/g3-native-subagent-2026-10-28T13-46-38-616Z-21276/`，审查与正式验收计数不变（正式 G3 仍 0/37）。

2026-10-28 首轮执行补充：最小原生导入入口为 `scripts/g3-native-subagent.mjs`（prepare/ingest/repair/handoff + 严格回放 shim），生成发生在子 Agent 会话、验证仍由未改动的 `runAgentWorkflow`/`verifyGeneratedBrowser` 消费宿主记录的原始字节；公共任务包（协议/Schema/能力合同/公共 ABI@2）随批次冻结并记 SHA。主 Agent 转写子 Agent 最终消息时出现过笔误并在解析前修正（见批次 `orchestrator-notes.md`），该转写风险为原生路线已知限制。宿主身份证据（ListModels `[current]`、无 `.zcode/agents` 覆盖）为宿主路由声明而非服务端确认；隔离为指示级未强制。

## 角色与顺序

2026-10-28 两轮运行后的当前执行说明见 [原生子 Agent 改进](g3-native-improvements.md)：优先使用 `g3-subagent.mjs` 的 `public-task-pack-v2`，统一原始字节捕获、源码快照和独立主输入复核。下文“原生导入尚未实现”等表述记录早期设计边界；当前已有两套最小导入器，跨宿主自动调度、来源自动确认和正式签收仍未实现。GLM 宿主声明与 qfmodel 路由两轮各已消耗 3/3，本轮改进未追加调用授权。

| 角色 | 职责 | 交付 |
| --- | --- | --- |
| 主 Agent | 冻结源码、管理队列和跨批预算，每次派发一款 | 调用账本、子 Agent 执行记录、审查交接 |
| 子 Agent | 按获准模式，由自身指定模型生成，或触发明确指定的模型服务/CLI | 原始输出、真实来源记录、全部尝试 |
| 验证宿主 | 完整准入、正反例、解法、双 SDK；不帮模型改写结果 | 原始批次路径、验证和资源生命周期回执 |
| 本会话审查 Agent | 核对来源、玩法、边界、变体、主输入、画面和释放 | AI 参考审查结论及修复项 |

**主 Agent → 指定模型的一款子 Agent → 统一工程验证 → 本会话审查 → 下一款/模型。** 子 Agent 退出且收到实际审查结论后，才派下一款，不一次创建37个子 Agent。

宿主没有创建子 Agent 的能力时返回 `BLOCKED_NO_SUBAGENT_SUPPORT`，不要静默改为主 Agent 自己生成。本项目不假定其他宿主的工具名称，也不伪造子 Agent 创建结果。其他会话不会自动通知本会话；主 Agent 必须把交接记录发到这里，由本会话实际读取后才算已审查。

## 隔离边界

- 任务来自 `project/g3-tasks.json`；逐款完成标准、变体和能力由现有 `buildG3Plan()` 组合。
- 调度模型、实际生成模型和审查模型分别记录，不能因为主 Agent 是 Qwen 就将其调用 Codex 的结果标成 Qwen。每个实验显式选择 provider、精确 model ID/版本与接入模式；只切换该实验的宿主配置，不修改现有默认路由、用途、认证或触发条件。指定模型不可用或无法选择时停止，不静默回退 Codex/其他模型。
- 可用接入模式和证据要求见多模型评测文档。原生子 Agent 模式允许指定模型直接生成JSON；API/CLI模式由子 Agent触发指定服务。原生最小导入已实现，已有HTTP适配器不代表已实测兼容各厂商；跨宿主自动调度尚未实现。
- 独立生成只接收同一份版本化公共任务包：协议/Schema/能力ABI/技能及合法修复诊断。CLI保留现有仓库外、关闭shell的隔离；原生子Agent需新会话、不继承仓库上下文和工具，不能保证则标记隔离未验证。主Agent不得把作者GameSpec、测试、解法或预存轨迹传给生成模型。
- 子 Agent可以生成初次及修复回复；宿主必须原样保存，不手工改写成通过。不能修改Runtime、Adapter、Schema、Manifest、生成器、状态或旧报告，不执行模型返回的命令、脚本或URL。
- 主 Agent 记录源码提交和相关指纹；发生变化则标记 `STALE_SOURCE`，不能沿用旧 PASS。每次使用新报告目录，保留旧失败和原始输出。

## 预算与触发

[机器可读约定](../project/g3-agent-orchestration.json) 的新增生成预算为0，表示设计完成但没有授权立即开跑。

实际启动前，主Agent明确本轮模型、任务范围与获准新增预算。历史Codex索引记录为168次生成、1次探测，不能当作其他模型已执行的结果；各模型账本分别初始化，并保留总体新增调用账本。历史索引的SHA和计数在启动时重新读取。

同一模型/任务/变体/技能版本的单元，跨子Agent、配置、批次合计最多3次生成；所有模型共享获准的全轮总预算。失败、修复和中止均记账。原生子Agent生成本身就是生成调用，后续验证重放不重复算生成；调度和审查模型的消耗另记。缺失价格或用量保持未知。

主Agent为显式选定模型创建单款本机配置：`maxTasks: 1`，`maxCalls`、`maxAttempts`不超过单元与全轮剩余预算，均不超过3；不改全局默认配置。不能直接复用全目录/111次的示例。每次一个子Agent，浏览器仍最多同时2个进程。

仅在预算与对应服务的配置、兼容预检就绪后执行；HTTP兼容服务的现有入口是：

```powershell
# 环境、依赖和真实 SDK 按 README 准备，明确 A2GAME_PYTHON。
npm run g3:run -- .a2game/g3-delegation/PROVIDER-MODEL/G01.json --ids=G01
```

上述位置是本机配置约定；provider配置须包含真实模型及宿主批准的argv。只有实际评测Codex CLI时才使用原来的 `g3:codex` 入口。原生子Agent使用 [交付、capture、validate 与主输入入口](g3-native-improvements.md)，不将读取已有回复的验证进程记为新模型调用。配置放入忽略的 `.a2game/`，认证仅沿宿主批准的机制处理，不读取或复制认证文件，不在任务或报告填写密钥。

达到预算、来源缺失或发生未明确归因的引擎/宿主失败时停止派发。源码和原输出不变的 INFRA 复测与新生成分开；不得通过新子 Agent、新批次归零重试数，或把新批第一次称为该款从未修复的 one-shot。

## 给主 Agent 的可复制任务

```text
按 docs/g3-agent-orchestration.md 和 project/g3-agent-orchestration.json 调度 G3。
先核对实际任务范围和已获准新增调用预算；没有预算就只准备队列，不创建生成子 Agent、不调用模型。
按 project/g3-tasks.json 顺序，每次创建一个只负责一款的子 Agent。
为每个实验明确实际生成模型、版本和模式；不得将其他模型的任务转交Codex后仍挂原模型名。
原生子Agent可直接生成；API/CLI子Agent触发指定模型。提供统一公共任务包、单款配置及预算，冻结源码。
分开记录调度/生成/审查模型，保留真实宿主执行记录和跨模型/跨批调用账本。
每款结束后把交接记录发给本会话审查 Agent，等待实际结论后再派下一款。
工程 PASS、子 Agent 自报和模型自报均不能标成正式 G3 PASS。
```

## 给单款子 Agent 的可复制任务

```text
你只负责 {MODEL_ID}/{GAME_ID}/{VARIANT_ID}/{SKILL_VERSION}，使用 {EXECUTION_MODE}。
主Agent提供公共任务包、宿主批准的模型配置、源码摘要和预算；核对实际模型，无法选择或核验时如实回报。
原生模式在隔离上下文直接生成JSON并由宿主原样保存；API/CLI模式只触发主Agent给出的指定模型命令。
不得调用其他模型代答或读取作者关卡/解法；不手改保存后的原始输出，不修改源码、状态、旧报告或认证。
保留全部成功/失败尝试，命令结束后不要另开批次继续重试。
返回真实批次summary路径、退出码、实际生成次数、全部尝试与证据清单。
你只能回报工程状态和待审材料，不能代替审查 Agent 或人工签收。
```

## 每款交接

主 Agent 在新报告目录保存记录，包含以下字段：

```json
{
  "format": "a2game-g3-subagent-handoff",
  "version": 1,
  "gameId": "G01",
  "sourceCommit": "<actual commit>",
  "experiment": {"id": "<actual id>", "variantId": "<actual id>", "mode": "<native-subagent|http-provider|codex-cli>", "taskSha256": "<actual SHA256>", "contextSha256": "<actual SHA256>", "skillVersion": "<actual version>", "skillSha256": "<actual SHA256>"},
  "models": {"orchestrator": "<actual id or unknown>", "requestedGenerator": "<exact provider/model/version>", "observedGenerator": null, "identityEvidence": null, "reviewer": "<actual id or unknown>"},
  "host": {"name": "<actual host>", "parentSession": "<actual id>", "workerSession": "<actual id>", "toolRecord": "<actual execution record>"},
  "budget": {"baselineSummarySha256": "<actual SHA256>", "baselineGenerationCalls": 168, "approvedAdditionalCalls": 0, "roundCallsBefore": 0, "taskCallsBefore": 0, "newGenerationCalls": 0},
  "batchSummary": "<actual batch summary path>",
  "batchSummarySha256": "<actual SHA256>",
  "commandExitCode": 0,
  "attempts": [],
  "engineeringStatus": "NOT_RUN",
  "reviewStatus": "AWAITING_REVIEW",
  "formalG3": "NOT_RUN"
}
```

占位值、0预算和空attempts不是已执行记录。每次尝试列出真实目录、状态、归因及CLI回执，并给出请求/原始输出、CLI SHA与线程/事件/用量、校验summary、Conformance、解法、两SDK回执和截图的路径及SHA；失败也必须交接。成功候选绑定具体GameSpec SHA与原始调用。

宿主没有提供的session、用量或身份材料保持未知。执行记录缺失则来源为 `UNVERIFIED`，不能进入已核验模型的对比统计；模型的provenance只是声明。原生模式尚未生成统一batch时保持batch字段未知并标记 `BLOCKED_INGESTION`，不能填写其他批次冒充。

## 本会话的审查标准

1. **来源与预算**：读取实际新批次，核对请求、原始输出、CLI及宿主记录、源码指纹和跨批账本。旧全局索引的PASS不能证明本次通过；不能隐藏旧失败、答案泄露或未批准辅助。
2. **工程与边界**：完整准入、正反例、获胜解法、playing初态、实际交互、两SDK当前定义Hash、暂停/重开、owned资源归零与监听器关闭。Cocos 共享缓存和不可测的完整 GPU 用量须单列，不声称整个引擎零泄漏。当前回执充分时不机械重跑，有具体缺口再定向复验。
3. **玩法与变体**：按逐款完整标准核对核心机制、胜负、失败路径、关键边界和指定变化。能力声明或随意按钮判胜不能代替玩法；宿主求解、预存轨迹、作者布局与输入映射单独标记。
4. **主输入与画面**：核对真实输入来源和两SDK初始/过程/终局截图，检查说明、进度反馈、裁切及隐藏信息泄露。动作注入解法不替代主输入；CDP/合成传感器不计真机。
5. **结论**：返回 `AI_REFERENCE_ACCEPTED`、`NEEDS_REVISION`、`BLOCKED_INFRA` 或 `REJECTED_EVIDENCE`，绑定batch和定义SHA，列出依据、问题、已用预算与下一步。

修复必须保留尝试链、携带原诊断并占用剩余预算，使用现有且由宿主批准的修复入口。没有适用入口就交接阻塞项，不重开全新生成冒充续跑；没有预算就不追加调用。

AI参考接受不自动推进正式G3、人工质量、物理Gate或Registry。正式签收入口当前尚未接入，人工签收仍需独立记录；真机继续暂缓。本规范不自动提交、推送、部署或触发Actions。
