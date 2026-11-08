# 旧版首页说明

本页保留整理前的内容，仅用于查阅历史。当前功能和进度请看[项目首页](../../README.md)。

# A2Game 1.0.0 — 独立游戏 JSON 播放器与共享 Runtime

A2Game Skill 是指导宿主模型创作游戏的知识与流程包。宿主模型负责“自然语言需求 → GamePlan设计 → GameSpec编写 → 根据MCP诊断修复”，MCP/共享Runtime负责准入、测试和执行；作品还需实际试玩与质量复核。GamePlan属于Agent创作阶段，不增加客户端运行协议。同一Skill可在不同Agent/模型中使用，产物统一遵循GameSpec `0.1.0`；各宿主和模型的实际效果分别验证。详见[创作流程](../../integrations/skill/a2game/references/authoring.md)。

当前主线：真实 Agent 宿主接入与验证。Qoder、TRAE、WorkBuddy、ZCode 可按[显式全通路任务](../../docs/host-agent-pilot.md)执行；项目Skill安装、同会话MCP链与原始证据归档入口已备齐，真实宿主独立Pilot仍待验。

2026-10-31 顺序推进结果：Batch A/B/C保留工程参考；Batch D的5任务×2模式已真实执行10/10，30次调用含1次宿主中止，9/10工程及来源输入通过。H01规划模式原稿仍失败；宿主修正版与HUD调整已通过双SDK桌面/窄屏4/4参考验证，真实模型重测未运行。参考H01动态数字的320px双SDK局部检查已通过，完整视觉仍待复核；G17仍有画面对比度不足。MCP已有无模型工程和真实Provider历史调用，模型身份尚未独立核实；Skill已有项目级安装和宿主练习，新会话自动触发仍待验。当前源码参考浏览器证据已重验；终局反馈修改后的完整工程回归和覆盖索引尚未重跑。正式G3 0/37、Verified 0/32+0/5，真机、人工和远端CI独立。见[H01修复](../../docs/generator-h01-repair.md)、[实际结果](../../docs/generator-real-findings.md)、[MCP/Skill说明](../../docs/generator-mcp.md)与[台账](../../project/generator-status.json)。

本机MCP：`npm run mcp:install`后`npm run mcp:serve`（默认无模型额度），验证用`npm run mcp:check`；完整`npm run verify`含MCP边界测试，需先安装其独立依赖。Skill只打包：`npm run skill:package`，不自动全局安装。Studio仍可用：`npm run generator:studio`。

从新工作区选择 CLI、MCP 或 Skill 的步骤、验证范围和待验项见 [Generator 使用与交接](../../docs/generator-handoff.md)。

本轮 CLI 入口（准备 UTF-8 的 `prompt.txt`，输出目录必须不存在）：

```powershell
npm run generator -- --help
npm run generator -- probe --provider fixture --json
npm run generator -- generate --prompt-file .\prompt.txt --provider fixture --output .\output\generator-demo
```

fixture 不解释提示内容，固定从零构造明确标记的工程计数夹具；它不满足具体游戏生成任务。真实接入的配置预检使用 `probe --provider codex|model-http|http --config <本机配置文件>`，不调用模型；后续使用真实 Provider 执行 `generate` 会调用模型，需先授权调用预算。调试已验证结果时可在 `/player/inspect.html` 手动导入该结果的 `debug-bundle.json`。

安装源链接命令（先 `npm ci`、`npm run build`，保持源码目录可用；这是本地入口，便携交付仍属 GEN-6）：

```powershell
$a2gameSource = (Get-Location).Path
npm install --prefix .tools/generator-cli --ignore-scripts --no-save --package-lock=false $a2gameSource
npx --prefix .tools/generator-cli --no-install a2game --help
```

`npm run generator:command-smoke` 在临时目录检查安装后的命令；`npm run generator:browser` 检查新建夹具的双 SDK 桌面/窄屏运行、输入、Hash、截图和释放，不计真实模型/G3。

协议资产已按用途分层：`specs/v0.1/capabilities/` 是当前能力目录，`games/` 是参考游戏与候选，`tests/` 是执行合同，`examples/` 仅放格式示例。详见 [协议目录](../../specs/v0.1/README.md) 与 [迁移说明](../../docs/spec-layout.md)；当前可信能力和测试来源见 [绑定索引](../../project/capability-bindings.json)。

**定位**：AI 直接生成 JSON → 全格式/语义校验 → 共享 TypeScript 玩法 Runtime → Canvas2D/CocosAirJS/Three.js 等可替换渲染宿主。

> **版本区别（重要）**：本源码包/`package.json` 的 **项目发行版本为 `1.0.0`**；它是 **Alpha 参考实现，未达到生产发布 Gate**。GameSpec、Capability Manifest、Tick/Rule 和 Conformance 的**协议版本仍为 `0.1.0`**，协议目录为 `specs/v0.1/`，JSON 内 `specVersion` 保持 `0.1.0`。保留旧 V0.3 文档与测试日志作为可审计历史。
>
> **当前阶段：S11 初始兼容扩展工程参考已交付。** 当前 112 份 JSON、127 份 Manifest，必需玩法缺口已降至 0 款（参考验收）；37 份 Gxx/Hxx 候选的真实双 SDK 参考证据见 [项目状态](../../PROJECT-STATUS.md)。完整玩法 DoD、独立 Agent 与真机 Gate 继续单独验收，verified 仍为 0/32、0/5。完整路线见 [PROJECT-PLAN.md](../../PROJECT-PLAN.md)，AI 先读 [AGENTS.md](../../AGENTS.md)。

播放器「游戏」菜单现在列出全部已校验定义，按基础示例、Gxx/Hxx 参考玩法、作者编写的规则变体和机制实验分组；可直接选择 G21/H01 等玩法。`?game=g21-candidate&backend=three` 可直达，仍校验目录 SHA。带资源的内置关卡经过完整资源准入后加载。全部 37 个作者变体可运行 `npm run variants:e2e`；它们不计独立 Agent G3。

P0 逐款 AI 实测与待人工确认项见 [质量清单](../../docs/quality-review.md)，覆盖 37 款双 SDK 和 320/390px 布局。

P2 正式验收档案与登记前检查见 [验收流程](../../docs/final-acceptance.md)。`npm run acceptance:build` 归档现有证据，`acceptance:check` 核对档案；参考通过与正式通过分别计数。

其他 AI 可按 [子 Agent 编排与审查交接](../../docs/g3-agent-orchestration.md) 使用指定模型原生生成或触发模型服务，再交回本会话审查。[两轮运行改进](../../docs/g3-native-improvements.md) 提供统一原生交付合同、原始字节/宿主证据捕获、源码快照与任意生成产物的主输入复核。两轮 G01 各消耗 3/3，双 SDK 键盘补验共 4/4；来源与画面仍待补齐。[多模型 G3 与技能反馈](../../docs/g3-model-evaluation.md) 的厂商兼容、自动调度与正式签收未完成，[编排约定](../../project/g3-agent-orchestration.json) 不授予新增调用预算。

当前优先 [37 款独立 G3](../../docs/independent-g3.md)：当前 Codex CLI 的 37 款均已通过完整准入、正反例和真实双 SDK 工程参考验证；G02 明确使用宿主 Runtime 求解反馈，不算模型自解。正式 G3 仍 0/37；[独立生成索引](../../project/independent-g3-run.json) 保留调用、原始输出、截图及逐项待验。37款浏览器主输入及逐款AI参考审查已复核；[纯源码证据恢复](../../docs/evidence-restoration.md)已通过Node22全量验证。Actions仅手动默认一个任务以控制额度；远端证据托管未配置，CDP/合成传感器与人工作品质量分别记账。`g3:plan` 不调用模型，也保留通用模型 API 入口。

仓库源码与本地产物的边界见 [维护说明](../../docs/repository-maintenance.md)。`reports/` 已移出 Git，本地历史证据继续保留；新检出需恢复相应证据后才能完整核对现有验收状态。

逐款玩法完成标准和剩余缺口见 [完整验收清单](../../docs/gameplay-acceptance.md)。`npm run gameplay:check` 执行 37 款的基础正反例、关键边界及作者变体正反例；完整质量、独立 G3 与真机按原 Gate 单独验收。

G11 按住 Space/长按蓄力后松开，连续跳到两个平台；中心落点奖励连击，偏心落地重置连击，落空失败。G24 支持横竖双斜五连；满盘无胜者时保留 `turn.draw` 和胜者 0，以已有的 `stopped` 状态中立结束，不再接受落子。

G13/H03 使用固定三车道、三段滚动障碍和两个有序检查点；H03 同时支持换道与真实弹丸射击，命中、障碍拦截及临时对象回收均由共享 Runtime 决定。G06 已扩展为 3×3 四向箭头与镜像布局，支持直接点选画布。它们仍须独立完成正式验收 Gate。

G23 合成后解锁工厂，生产扣费并在成熟后收获；H02 三消金币可升级角色，下一 Tick 起实际提高攻击伤害，击败敌人才过关。玩法联动、金币/生命和下次/上次伤害均来自共享状态，真实双 SDK 使用同一份 JSON。

G09 使用空棋盘连续拼块：左右键移动、↑旋转、Space 硬降，也可等待重力落下，消四行获胜，出生被挡即顶出。G12 点击画布或 Space 拍翼，避开上下门柱，完全越柱后计分；作者变体增加第三道门。

## 一、先看能运行什么

| 功能 / 后端 | 现在能否运行 | 说明 |
|---|---|---|
| TypeScript Headless Runtime | **可以** | 计时/事务/回放、益智、整数物理/战斗、经营/回合，Node.js 测试 |
| 浏览器 Canvas2D 预览 | **可以** | 目录共 112 份预校验 JSON；scene2d 使用 Canvas2D，3D Stage 使用真实 SDK |
| Three.js Renderer | **真实 G2 四样例子集 PASS** | 固定 `0.186.1`，HTTP Chromium 实测；见 `reports/g2-threejs-real.json` |
| CocosAirJS Renderer | **真实 G2 四样例子集 PASS** | 固定源码/构建 SHA，HTTP Chromium 实测；见 `reports/g2-cocosairjs-real.json` |
| 32 款完整小游戏、5 个混合玩法、IMU 真机、AI one-shot | **完整 DoD / Agent / 真机未验收** | 保留在路线图，不因版本 1.0.0 改称已完成 |

已包含的可交互游戏（只在当前定义/能力子集内运行）：

| 播放器选项 | 作用 | 控制 |
|---|---|---|
| 点击计分 `tap-target` | 点击触发计分/完成目标 | 点击游戏画布、空格、界面中央 `●` |
| 合并网格 `grid-merge` | 类 2048 网格滑动合并 | 方向键、画布 Swipe、页面方向按钮 |
| 随机补位 `grid-merge-spawn` | 合并后固定种子随机补位 | 同上 |
| 推箱子 `grid-push` | 移动/推箱入目标格 | 同上；附录有 Swipe Trace 回放 |



## 八、当前完成情况和下一个可执行任务

**当前验证**：66/66 Node、13/13 JSON Conformance、7 Schema/30 文档、5 游戏目录 PASS；真实双 SDK HTTP Chromium G2 四样例子集 PASS（16+2 场景，8 组跨引擎 Hash 一致）。新增动态 JSON 变体也通过两端导入、Node Hash、负例恢复、后端切换及实际服务进程重启后加载，见[动态内容回执](../../reports/content-2026-10-24T13-13-36-731Z-49356/summary.json)。原 G2 证据见 [Three.js](../../reports/g2-threejs-real.json)、[CocosAirJS](../../reports/g2-cocosairjs-real.json)。旧隔离环境的 HTTP 策略阻塞记录保留于 [`reports/release-1.0.0-validation.json`](../../reports/release-1.0.0-validation.json)，不代表本次环境。

**未完成/未验证**：远程账户/签名和自动部署、审核目录外资源供应链、多进程存储配额；一般模型/骨骼编辑器和任意 Shader 扩展；三消与塔防/射击完整模块；物理 GPU、多点/IMU 真机；32+5 全量玩法；Agent G3。

**下一步**：实施 S5 益智/休闲标准库，保持 S4 表现能力的真实双 SDK 回归；新增能力继续执行 [PROJECT-PLAN.md §5](../../PROJECT-PLAN.md) 的真实 G2 合同。研发变更时同步 [PROJECT-STATUS.md](../../PROJECT-STATUS.md)、[`project/status.json`](../../project/status.json) 与 `CHANGELOG.md`；不能把失败、未测或 Mock PASS 改成已完成。

生成工程：`npm run agent:fixture -- --browser` 重现明确标注的工程夹具；真实生成器按 `project/agent-provider.example.json` 配置后执行 `npm run agent:run -- <配置.json>`。调试包通过 `/player/inspect.html` 逐步查看，详见 [生成与修复合同](../../specs/v0.1/docs/17-Agent-Workflow-V0.1.md)。

S11：`npm run compat:e2e` 验证真实双 SDK 的公开回合棋桌、虚拟手柄和存档。设置 `$env:A2GAME_ROOMS='1'` 后启动服务可访问 `/player/room.html`；存档、迁移、隔离 Node 矩阵、性能与 CI 边界见 [兼容扩展合同](../../specs/v0.1/docs/18-Compatibility-Extensions-V0.1.md)。Android/物理手柄与独立生成器尚无正式验收，远端 CI 未运行。
