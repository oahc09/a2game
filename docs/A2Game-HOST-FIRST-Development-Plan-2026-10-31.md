# A2Game Host-first 开发与验收任务计划书

> 文档日期：2026-10-31
> 项目：[`oahc09/a2game`](https://github.com/oahc09/a2game)
> 审查基线：`main@06a4939cc92febc20fe363f8b55df3a3d7cba7be`，2026-10-31 14:01:09 UTC；执行时重新检查 HEAD 和工作区差异
> 类型：**下一阶段执行合同**，不是已完成验收报告
> 发行 / 协议 / MCP 工具合同：A2Game `1.0.0`（Alpha reference）/ GameSpec & Capability `0.1.0` / MCP `1`
> 核心决定：**Qoder / WorkBuddy / TRAE 原生 Agent → A2Game Skill + MCP → GameSpec / Conformance → 双真实 SDK 播放**。现有 Generator CLI、模型 Provider 和 Studio 保留，但不作为本阶段的产品研发主线。云端 API 后置。

---

## 0. 结论、目标和执行边界

### 0.1 目标用户旅程

用户在已安装 A2Game Skill/MCP 的 Qoder、WorkBuddy 或 TRAE 内，直接输入自然语言：

> 制作一个竖屏飞机射击小游戏：玩家拖动飞机、自动开火、3 波敌人、失败后能重开。使用 A2Game GameSpec 生成，不要生成引擎专有脚本；完成规则正反例、CocosAirJS/Three.js 试玩、手机窄屏检查并导出游戏包。

**成功链路：** 宿主自行调用其已有模型 → 发现 Skill 和 MCP → 查询能力与规范 → **宿主模型直接编写** GameSpec `0.1.0` + Conformance + 解法/输入轨迹 → MCP `validate_game` → `test_game` → 两个真实 SDK 的 `preview_game` 和实际操作 → 审查画面/输入/终局 → `export_game` → 交付可复核回执。

**禁止混淆：** 已由宿主模型生成的内容，后续 MCP 的 `validate/test/preview/export` 期间 **不得再次调用 Generator Provider**。MCP `generate_game` 仅作为另一个经用户显式授权的 *代调用模型* 模式，不是主路径。模型在 Qoder/WorkBuddy/TRAE 的日常对话推理不等于 MCP Provider 调用；两个计数分开登记。

### 0.2 本轮交付目标

1. 三个真实 Agent 宿主都能接入 A2Game，**在新会话中实际触发**已安装的 Skill 和 MCP；测试显式调用、自然语言自动触发两种情况。
2. 至少完成 **3 宿主 × 1 个简单玩法**的可信 Pilot，再开展 **3 宿主 × 5 个代表玩法 = 15 个独立生成单元**；不是同一 JSON 换宿主重放。
3. 每个单元必须走完整 Schema/能力/语义准入、正反例、Headless 和真实输入的双 SDK 验证，记录修复链、来源与视觉质量；缺设备/SDK 如实标记。
4. 从真实失败中增强 Skill、MCP 结构化诊断和受控规范发现，不改动共享 Runtime 的原有规则与引擎路由来迁就模型。
5. 输出**宿主接入参考包 + 可复现评测包 + 错误归因与 Skill 版本演进报告**。不以模型排名、截图数量或 Agent 自报成功替代正式质量验收。

### 0.3 不实施和不越界

- **不重新造** Generator Core、CLI、MCP 服务、Skill、Content Service、Headless Runtime、CocosAirJS/Three.js Adapter；增量改已有源码。
- 本轮不建设在线 API、远程任务队列、在线账号、计费、模型密钥托管、全局 Skill 发布市场、MCP 远程公网部署；独立 npm CLI/MCP 分发可在 Host-first 收口后评估。
- 不自动覆盖任何宿主的全局配置；先生成项目级样例和安装指导，实际安装/启用、权限变更由宿主用户明确操作。
- 不修改默认模型选择、已有供应商路由、原生 Agent 的工具权限；不切换模型来让失败任务表面通过。
- 不执行 GameSpec 里的任意 JS/TS、脚本/命令、未审核远程资源；Host 可以理解不可信游戏数据，但不得将其当系统指令。
- 不擅自提交、推送、部署、删旧报告、改凭据、安装插件或改安全权限。本文件只做计划，不授权任何真实模型额外调用或宿主配置操作。

---

## 1. 最新可信基线与保留的历史目标

### 1.1 已有工程资产：必须复用

| 范围 | 现有入口 | 记录状态 / 边界 |
|---|---|---|
| CLI / Generator | `generator/cli.mjs`、`generator/index.mjs`、`generator/providers.mjs`、`generator/game-plan.mjs` | `generate/validate/test/preview/inspect`、GamePlan、Provider、修复链已有工程参考 |
| MCP | `integrations/mcp/{contract,server,service}.mjs`、`scripts/mcp-server.mjs` | `@modelcontextprotocol/sdk@1.32.2`；**9 个**受限工具，默认真实模型预算 0 |
| Skill | `integrations/skill/a2game/SKILL.md`、`references/`、`scripts/package-a2game-skill.py` | 可打包；新会话自动发现/触发和真实产品宿主未全部验收 |
| 严格准入与玩法 | `src/`、`scripts/content-service.mjs`、`scripts/run-conformance.mjs` | GameSpec `0.1.0`，保持精确 Tick/Hash/生命周期和完整 Schema |
| 双渲染 Host | `player/`、`scripts/g2-real.mjs`、`scripts/mcp-smoke.mjs` | CocosAirJS/Three.js 参考范围已有回执，不等于所有设备/玩法通过 |
| 参考验收 | `project/generator-status.json`、`project/status.json` | 最近记录 Node **159**、Conformance **203**、Schema **360**；这些是项目本地回执，**不是本轮重新实跑** |
| Generator Benchmark | `project/generator-benchmark-tasks.json`、`docs/generator-real-findings.md` | 5 玩法×2 模式全部 10/10 已执行，**9/10 工程参考通过**，H01 `game-plan` 原生生成仍 FAIL；旧 30 次授权已用尽 |

### 1.2 永久保留的主项目边界

以下范围和 Gate **不因 Host-first 调整而删除、弱化或改变分母**：

- S0–S11 的完整计划、G0/G1/G2/G3、Mobile 真机 Gate、源代码/测试/证据链；原 `PROJECT-PLAN.md`、`AGENTS.md`、`PROJECT-STATUS.md` 和状态台账继续生效。
- 冻结 **G01–G32（32）** 与 **H01–H05（5）**，按原口径验证；当前正式 `verifiedGames=0/32`、`verifiedHybridCases=0/5`，独立 G3 仍 `NOT_RUN`。
- `GameSpec 0.1.0` ≠ 工作区 `1.0.0` ≠ `mcpToolContractVersion:1`；GamePlan 是生成中间层，不是新的运行协议。
- 真实 CocosAirJS/Three.js E2E 不得以 Canvas2D、Mock、CDP 虚拟输入或宿主自报替代；真机 Touch/IMU 独立验收。
- `reports/` 不入 Git，当前证据由 `project/evidence-lock.json`/受信恢复流程关联；无远端证据来源和 GitHub Actions 额度时必须分别记录 `BLOCKED_EVIDENCE`、`QUOTA_BLOCKED`，不得把本地结果宣称成远端 CI PASS。

### 1.3 最新源码基线刷新要求

执行 Agent 开工**先**记录 `git rev-parse HEAD`、`git status --short`、GitHub 默认分支最新提交、依赖锁 SHA、SDK SHA、浏览器版本、宿主版本和被选模型身份。历史审查基线 `06a4939…` 只作对照，不能假设执行当日未变化。最近一次完整本地 `verify` 记录发生在该基线最后提交之前，因此本轮变更影响范围的测试必须重新运行。

---

## 2. 目标架构与责任边界

```text
Qoder Agent        WorkBuddy Agent        TRAE Agent       其他 Agent
    │                    │                   │                 │
    └────────────────────┴───────────────────┴─────────────────┘
                             │
               Host-native 模型直接创作游戏
                             │
                   A2Game Skill（工作流）
                             │
                   A2Game MCP（stdio）
                ┌────────────┼──────────────┐
                │            │              │
          Capability /   Validate /       Preview /
          Schema read    Test / Diagnose   Export
                └────────────┼──────────────┘
                             │
                 已有 Generator / Runtime
                             │
              GameSpec + Tests + Assets/Receipt
                             │
                    CocosAirJS / Three.js
```

**主路径模型路由的责任**在宿主 Agent，**逻辑规则的责任**在共享 Runtime，**校验/版本/安全的责任**在 A2Game Validator，**渲染/输入的责任**在 Host Adapter。MCP 是受限调用桥，不实现另一套模型路由或游戏规则。已有 `generate_game` 只作为用户显式要求由 A2Game 再调用模型时的次级入口。

第一阶段只测试**本机/本地任务可启动 stdio MCP** 的宿主。遇到仅提供云端运行的宿主模式，应记录 `HOST_LOCAL_STDIO_UNAVAILABLE`，不可为了让测试通过而擅自开放远程 HTTP 服务。

---

## 3. 宿主适配矩阵（项目级、最小权限）

| 宿主 | 已有官方能力依据 | 优先安装与测试方法 | 必须在本地核实的事项 |
|---|---|---|---|
| **Qoder** | 支持导入 Skill ZIP/`SKILL.md` 与自定义 MCP Connector；可按描述选择 Skill，也支持显式 `/` 选择 | 以**项目/本机隔离**的方式安装 A2Game Skill、连接本地 stdio MCP；新会话测试隐式和显式触发 | 版本、Skill 优先级与发现路径、stdio 子进程和 Tool Schema 加载、工具实际调用日志 |
| **WorkBuddy** | 官方 Connector 支持 **MCP + Skill** 或 **CLI + Skill**，一次 Connector 只允许一种方式；本轮采用 MCP + Skill | 为本地连接器生成 `connector-meta.json`、`mcp.json`、`skills/a2game/SKILL.md` 和文档；仅在使用者确认后安装 | 当前产品版本的本地连接器导入流程、是否允许本机 stdio、重启/新会话是否自动加载、30 秒响应建议与长流程组织 |
| **TRAE** | 支持项目级 `.trae/mcp.json` 及项目 Skill；本地 stdio | 在**隔离实验项目**生成 `.trae/mcp.json` 与 `.trae/skills/a2game/SKILL.md` 的例子；由用户显式启用项目 MCP | 用户的 TRAE 版本/项目模式、Tool 描述是否被上下文裁剪、Skill 自动/显式调用、预览是否在本机运行 |

官方参考（本文件编写时核查；若宿主版本不同，执行方必须以该版本实测为准）：

- Qoder 自定义 Skill/MCP：https://docs.qoder.com/qoder/extension-publishing ；Skill 发现：https://docs.qoder.com/qoder/skills
- WorkBuddy Connector：https://open.workbuddy.cn/docs/connector ；WorkBuddy 项目级 MCP：https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide
- TRAE 项目级 MCP：https://docs.trae.cn/ide_add-mcp-servers ；项目 Skill：https://docs.trae.cn/ide_skills ；MCP Tool 描述/数量限制：https://docs.trae.cn/ide_troubleshoot-mcp-server-related-issues

**重要兼容规则：** 不复制同一份配置 JSON 到三个宿主假定可用；需要宿主特定的 `connection recipe`。TRAE 官方说明工具描述总长和工具数存在上下文限制，应记录**实际被模型看到的工具集合**，缺少 Tool 不算模型选择错误。WorkBuddy 的 Connector 单元选 MCP + Skill 后不得再混用 CLI + Skill 类型；CLI 可作为本地诊断手段但不是该 Connector 的另一传输。

---

## 4. 新执行批次与验收 Gate

| 批次 | 阶段 | 核心交付 | 外部依赖 | 判定方式 |
|---|---|---|---|---|
| **HOST-A** | HOST-0 / HOST-1 | 基线、三个宿主的项目级连接参考包、无模型安装检查 | Node/Python、用户本机已安装宿主 | `HOST-G0` |
| **HOST-B** | HOST-2 / HOST-3 | 新会话 Skill/MCP 自动发现，**3×1** 宿主独立游戏 Pilot | 三宿主可用的模型/会话权限 | `HOST-G1`、`HOST-G2-PILOT` |
| **HOST-C** | HOST-4 | MCP 精确诊断与自主修复循环、规范/模板只读发现 | 已有 Validator/Skill；可用的 Pilot 失败样例 | `HOST-G3` |
| **HOST-D** | HOST-5 | 真实双 SDK、输入、视觉、可玩性与资源释放 | 真实 SDK/浏览器、用户可审查画面 | `HOST-G4` |
| **HOST-E** | HOST-6 | **3×5=15** 单元 Benchmark、Skill A/B 和保留集验证 | 三宿主真实 Agent 调度、已批准模型用量 | `HOST-G5` |
| **HOST-F** | HOST-7 | 项目级集成包、版本兼容、交付文档和发布候选 | 前面 Gate、回执归档 | `HOST-G6` |

> **批次推进规则：** 一批内部可以并行独立宿主、独立测试，但每个 Gate 的正式状态必须根据回执决定。若 WorkBuddy/某宿主无法安装，可在另两个宿主继续工程工作并将总体 Gate 记 `PARTIAL`；不能补一个 mock 当成第三宿主成功。模型用量、费用、设备/宿主访问受阻时，记录 `BLOCKED`，不降低其他可做工作的验收要求。

### Gate 定义（新增 HOST 系列，不替代现有 G0–G3）

| Gate | PASS 的最低证据 | 不可替代的部分 |
|---|---|---|
| **HOST-G0** 安装发现 | 三个宿主各有项目级连接清单、Skill/MCP 可见性、原始工具列表、启动日志和版本指纹；无 Provider 调用 | 仅源码文件/插件安装截图不等于实际握手 |
| **HOST-G1** 自动触发 | 每宿主**两个全新会话**：不显式点名 A2Game 的自然语言请求触发、显式点名 A2Game 的控制请求；每次记录 Tool 使用顺序与 Skill 发现证据 | 只给提示词“请调用 Skill”不证明自动触发 |
| **HOST-G2-PILOT** 原生生成 | 每宿主 1 款 G01 新关卡：宿主生成原始 GameSpec/Conformance/解法，MCP validate/test 成功，来源与模型调用有证据，MCP Provider 额外调用 **0** | 复制现有 `G01` 标准 JSON/fixture 或宿主改写输出不能算独立生成 |
| **HOST-G3** 诊断修复 | 至少 6 类真实/注入故障可经 MCP 返回受控 `code/stage/jsonPointer` 等字段；Agent 在同一模型自身产物上 ≤3 次修复成功或明确失败 | 泛化“验证失败”不能算诊断可用；代码未实际执行不算 PASS |
| **HOST-G4** 双 SDK 产品预览 | 每个选定单元在当前真实 CocosAirJS/Three.js、实际键盘/Pointer 上获得初始/进行中/赢/输（若游戏定义有输）画面、Node/Host Hash、暂停/重开/销毁/资源回收回执 | Mock/Canvas2D、仅点 UI 按钮而核心移动无效、仅最终成功 Hash 都不够 |
| **HOST-G5** 交叉评测 | 冻结 5 任务、3 宿主各自**独立生成**15 个单元；原始输入/输出、3 次内修复、真实运行、质量反馈与失败归因齐全；分母和预算真实 | 9/10 历史 Benchmark、不同宿主分享同一结果不能抵作 15 单元 |
| **HOST-G6** 项目级交付 | 新工作区按文档启用 Skill/MCP、完成至少 1 个真实 Agent→游戏包交付；回执/文档/状态/SHA 一致，安全边界和旧 Gate 不变 | 本地项目安装不等于公共 npm 发布、远端 CI PASS 或正式 G3 |

每个 Gate 可取 `PASS` / `PASS_REFERENCE` / `PARTIAL` / `BLOCKED` / `NOT_RUN` / `FAIL`，必须同时填写 **scope、sourceSHA、hostVersion、receipt、limitations**。工程参考与人工/正式验收单独列账。

---

## 5. 详细开发任务（可直接拆给 Agent）

### HOST-0：冻结基线与环境可复现

**输入：** 最新 `main`、`PROJECT-PLAN.md`、`AGENTS.md`、`PROJECT-STATUS.md`、`project/status.json`、`project/generator-status.json`、当前 `package-lock.json`、MCP 独立锁、已有 `reports/` 的可信恢复说明。

**动作：**

1. 一次性读取关键上下文，执行 `git status --short`、`git rev-parse HEAD`、核对 Node/Python/浏览器/SDK/宿主版本与本地依赖是否已安装；检查未提交的用户改动，不能覆盖。
2. 在独立副本执行 `npm ci`、`npm run mcp:install`、Python 依赖、`npm run build`、`npm run generator:smoke`、`npm run mcp:check`（后者要求已准备真实 SDK），并根据受影响源码执行 `npm run verify`。缺历史证据按现有恢复机制处理，不通过删除检查脚本“修绿”。
3. 冻结 `host-baseline.json`：HEAD、Schema/Manifest、MCP/Skill SHA、原有测试回执、SDK/browser、三宿主版本/安装状态、已知阻塞、历史正式 Verified 数字。
4. 明确生成用量策略：**新一轮不继承已用完的 30 次 Generator Provider 预算**；宿主模型调用受其自身账户/配额与本次明确批准的测试单元约束，不在后台批量调用。

**DoD：** 本地无模型链能从干净源码独立运行；`reports` 证据是否恢复明确；最新源码受影响测试有本轮回执。若未实际运行，状态保持 `NOT_RUN`。

### HOST-1：三个宿主的项目级 Skill/MCP 接入适配

**必须交付（建议路径）：**

```text
integrations/hosts/
  qoder/
    README.md                 # 官方 UI/实际版本的导入步骤，Skill ZIP + custom MCP
    connection.example.json   # 仅模板；不写入用户全局设置
  workbuddy/
    README.md
    connector-example/
      connector-meta.json
      mcp.json
      skills/a2game/SKILL.md  # 与共享 Skill 来源关联/生成，不人工复制漂移
  trae/
    README.md
    project-example/
      .trae/mcp.json
      .trae/skills/a2game/SKILL.md
  host-compatibility.json     # 版本、MCP/Skill 发现、阻塞清单
```

- 三宿主安装步骤与配置均**基于它们当前版本实测**；`command`、`args`、`cwd` 指向用户授权的工作区内现有 Node 和 `scripts/mcp-server.mjs`，stdout 必须仅为 MCP 协议。
- MCP **启动时默认 `maxCalls=0`**，不将 API Key、Token、密钥路径、用户环境转储放入连接包；任何 `.mcp.json` 只提供不含秘密的示例，用户个人配置不提交 Git。
- Skill 的唯一内容来源仍为 `integrations/skill/a2game/`。需要宿主特有包装时仅生成 adapter metadata 和安装布局，不维护三个不同语义版本。
- WorkBuddy Connector 固定使用 MCP + Skill，CLI 仅供命令行自测；TRAE 验证本地项目 MCP 开关、实际 Tool 裁剪；Qoder 验证 Skill 的描述匹配和 `/` 显式触发。

**DoD：** 每宿主 Tool 实际列举 9 个、Skill 可被发现、无模型调用、进程退出无残留，原始截图/日志入独立 receipt。**不允许仅依据官方支持文档标为 PASS。**

### HOST-2：新会话自动发现与真实 Agent Pilot

**Pilot 顺序：** Qoder G01 → TRAE G01 → WorkBuddy G01（每个独立任务/独立新工作区；可在环境互不冲突时并行）。G01 原始 JSON 和获胜轨迹不得提前放在模型可读工作区；Agent 仅可读通用 Schema/能力说明/接口合同。仓库原游戏参考和 solver 答案作为验证保留集，不给生成端。

每个宿主开展四种检查：

1. **新会话隐式触发：** 用户只说“制作一个可玩的推箱子小游戏，支持方向输入、非法推动、获胜和重开”，不提 Skill/MCP。记录是否自动发现 A2Game，还是先写专属引擎代码。失败也照实记。
2. **新会话显式触发：** “使用 A2Game Skill/MCP，严格生成 GameSpec 0.1.0；不要代调用第二模型”。对照工具发现、操作顺序与输出质量。
3. **独立生成：** 宿主原生模型写出 `game.json`、`conformance.json`、`solution.json`；随后执行 MCP `validate_game`、`test_game`、`inspect_game`、`export_game`，确保 provider 调用计数=0。
4. **可玩预览：** 用真实两个 Host `preview_game`，操作输入、比对 Hash、查看胜负、暂停、重开、关闭预览；缺 SDK 与宿主无法打开本地页面分别归因。

**DoD：** 每宿主生成**不同的新 JSON SHA**；两个真实会话分别留自然语言指令、Skill 可见/调用、MCP Tool 轨迹、模型请求身份来源（不信模型自报）、原始 JSON 和全部验证结果；不能为通过测试直接编辑生成稿。如果宿主 Agent 自己使用其代码工具修改原稿，记录为相应修复尝试而不是 one-shot。

### HOST-3：MCP 诊断与规范自发现改进

**现有差距：** `integrations/mcp/service.mjs` 的 `validate_game/test_game` 失败多只回 `code`，丢失 Validator 的字段路径、测试断言及规则归因。当前只有工具列表和能力查询，未系统提供按版本发现的完整 GameSpec Schema/受控示例资源。

**实施：**

1. 扩充**白名单结构化诊断**：`code`、`stage`、`jsonPointer`、`capabilityId`、`ruleId`、`caseId`、`expected`、`actual`（仅安全且有长度上限时），以及 `repairHint`；既有返回合同增加字段须进行版本/兼容测试，不能让旧客户端崩溃。
2. 所有错误路径都有可追溯来源（完整 Schema、语义编译、Conformance、玩法 Solver、宿主图形、基础设施）；同一错误的 CLI 与 MCP 分类一致。
3. 为 MCP 新增**只读可枚举的版本化规范入口**（优先 MCP Resources：例如 GameSpec schema、Conformance schema、HostProfile 说明、受控小型示例），或者在确认客户端不支持 Resources 时设计兼容工具。只读资源严格白名单、SHA/版本/长度、无任意路径参数、无作者目标关卡或正确解法泄漏。
4. 提供失败样例：重复键、错 `specVersion`、缺 requires、未知能力、Rule/Schema 失配、负例无效、终局后非法输入、内容越权、误触发 `generate_game`。每项重复调用都得到一致且安全的修复建议。
5. 处理 Tool 描述文本预算：特别核验 TRAE 的已加载工具数与描述字符限制；若裁剪，缩短描述或根据用途拆组，不能为了兼容单宿主删除其他宿主已需的能力。

**DoD：** 6+ 失败分类都有可机器处理的真实错误回执；至少各选一种错误在两个真实宿主内完成基于诊断的 ≤3 次修复，保留原始失败/修复差异/模型身份和调用成本。无模型的注入负例不记 Agent 实测成功。

### HOST-4：真双引擎的实际可玩性与画面门禁

对 Pilot 和后续 15 单元，执行：

- **逻辑**：正反例/Conformance、同 Seed、完整操作轨迹、Tick、胜负、暂停冻结、重开、第二 Session 重放与 exactHash；输入后不再可操作、边界、持续运行。
- **输入**：键盘/Pointer 真正操作在画布上的游戏核心，而不是只按诊断按钮；Hold、Drag、取消、离焦、重开后输入状态清空；模拟 Touch/IMU 与真实设备独立标记。
- **视觉**：桌面 `1280×800`、窄屏 `390×844`、小屏 `320×568`（视实际宿主调整并记录 DPR）；初始、进行中、成功、失败（仅适用于有失败状态的玩法）截图；画布裁切、布局与触控区域、对比度、中文排版、关键数值可辨识、角色反馈/动画。建议设计验收目标为关键文字 ≥16 CSS px、触控目标 ≥44×44 CSS px；特殊排版必须记录例外，且不将视觉参考自动判成人工质量 PASS。
- **引擎**：真实 CocosAirJS 与 Three.js SDK 来源/版本/SHA、Node↔Host Hash（仅 exact 服务）、宿主错误/控制台错误、`ownedResources`、监听器释放、预览关闭与服务端口消失；不宣称 GPU 内部全部缓存为零。
- **业务观感**：核心玩法和图像/音效反馈须符合需求；纯色几何占位、数值堆叠、UI 信息直接泄漏谜题答案不应通过“视觉满足要求”。AI 截图审查与人工主观体验分开记。

**DoD：** 每个单元有双 Host 可回放的输入和画面证据、逻辑一致性、性能/清理记录；任何一端失败时结果应是 `PARTIAL` 并附最小复现，不得用另一个 Host 代替。

### HOST-5：代表性游戏与跨 Agent Benchmark

**固定五任务（由 `project/generator-benchmark-tasks.json` 拷贝/关联，不将原参考答案提供给 Agent）：**

| ID | 用户级目标 | 必要机制与反作弊负例 |
|---|---|---|
| G01 推箱子 | 方向移动、推动箱子、目标格、可重开 | 无法推动时状态不可变化；需要实际操作而非按钮加分 |
| G03 三消 | 合法交换、匹配/掉落/连锁、关卡目标 | 非法交换、阶段结算/目标达成、不能一键获胜 |
| G17 纵版射击 | 连续移动、自动发射、3 波敌人、失败重试 | Hold/Drag 可达、弹丸/命中去重、波次与释放 |
| G21 塔防 | 建塔、成本、路径/波次、漏怪扣生命、获胜 | 非法选位/余额不足/死亡清理；塔防不是点击扣分 |
| H01 合成炮台保卫战 | 合成旧炮台→新炮台、冷却与经济、路径敌人 | 旧武器不再攻击、合成/经济时序、终局非法输入 |

**矩阵**：`Qoder / WorkBuddy / TRAE × {G01,G03,G17,G21,H01}` = 15 个新生成单元；原 Batch D 的 10 单元作为**历史对照**，不得代替新分母，也不得将两个宿主使用同一 JSON 的重验计为两个独立生成成功。

**统一条件：** 同一冻结 GameSpec 版本、Capability 目录 SHA、规范/受控示例、任务文本、HostProfile、允许的资产集合、生成尝试上限（建议**3 个有完整原始回复的版本**，明确宿主何时产生候选），相同测试与视觉门禁。宿主模型版本、system prompt 不可控时真实登记 `UNKNOWN`，不把混合宿主环境的一次成功率称为纯模型能力排名。

**必须保留指标（按宿主×任务分别展示分母）：**

- Skill `auto_trigger` / `explicit_trigger`、Tool discover/load、模型实际请求路由的证据级别。
- 第一次完整生成 `one_shot_pass`、≤3 尝试 `within_budget_pass`、Provider 调用次数（本路径 MCP 应为 0）、宿主模型实际消耗/费用（可见才填写）。
- `schema`, `conformance`, `solution`, `headless_hash`, `three_host`, `air_host`, `primary_input`, `restart_dispose` 的独立状态。
- 画面布局、文字/触控可读性、动画/反馈、难度与无指导试玩，分 `AI_REFERENCE_REVIEWED` / `HUMAN_APPROVED` / `NOT_RUN`；失败原因按照 INPUT / SKILL / MCP / SCHEMA / CAPABILITY / RUNTIME / ADAPTER / HOST / PROVIDER / VISUAL / INFRA 分类。
- **禁止**把 G01/G03 正式参考 JSON、已有获胜轨迹、别的宿主输出放入生成上下文；迭代 Skill 后用**独立未见任务**作保留集，不用已调优样例冒充泛化证明。

**DoD：** 15 份真实独立任务至少全部拥有可判断结果（PASS/PARTIAL/FAIL/BLOCKED）；`15/15 attempted` 只是完成尝试，不代表 `15/15 passed`。只在真正有未见任务与版本比较时给 Skill 提升收益结论。

### HOST-6：基于证据迭代 Skill / Capability，禁止随机扩大实现

真实问题先聚类归因，再按以下优先级处理：

1. **Skill 内容不足**：触发不准、工具调用顺序错误、遗漏 Capability 选择、错误修复指导不明确 → 修 Skill，并记录 SHA、旧/新触发结果。
2. **MCP API 信息不足**：没 Schema/例子、错误丢 JSON Pointer、无法接收测试/解法、超时无法追踪 → 增量补只读资源与诊断字段，兼容既有 Tool 契约。
3. **Capability 真缺失**：先写版本化 Manifest + GameSpec/Conformance/Host 需求，再实现可信模块，**不得**在游戏 JSON 里动态生成运行脚本，也不得将复杂玩法替换成计数器。
4. **Player 视觉/交互缺陷**：修通用投影、布局、输入生命周期，测试新旧游戏 Hash 不变；宿主做的表现修复只能另存衍生版本，不冒充模型生成质量。
5. **模型侧失败**：输入足够且 Validator 无 bug 时保留失败，不为得到高分删掉必需玩法、放宽终局 Gate 或隐藏负例。

每次 Skill 迭代都做 `diff → 新版本SHA → 回归旧失败 → 未见任务 → 三宿主回归`，报告改善与退化。此阶段的结论属于工程技能评价，不能自动提升原 G3 或 `verifiedGames`。

### HOST-7：项目级交付、状态对齐与回归收口

**交付包建议：**

```text
integrations/hosts/            # 三宿主只读安装配置和说明，禁止硬编码用户凭据
integrations/skill/a2game/     # 单一 Skill 源码与引用
integrations/mcp/             # 原 MCP 实现及契约
project/host-first-tasks.json  # 本轮冻结任务单元、版本/Host/Skill 适配约束
project/host-first-status.json # 仅本轮 Host-first Gate 状态及证据指针
reports/host-first-<runId>/    # 实际执行时产生、保持 git-ignored
 docs/host-first-guide.md      # 上手、升级、冲突/失败排查
 docs/host-first-results.md    # 15 单元指标、已确认/未验/失败
```

- 以实际代码和当前 Git 规则检查/修正目录，不删除旧证据。`project/status.json` 只增加**新工作流引用**；`project/generator-status.json` 可增 `hostFirst` 指针，但不可无根据改原历史 PASS 与预算计数。
- README 顶部新增“**当前主线：真实 Agent 宿主验证**”及三宿主文档入口，修正仍写“下一步 S5”的过时章节；对历史数据保留日期标记。
- 最小可复制环境：Node.js 22+、Python 校验依赖、隔离 MCP npm 依赖；真实预览另外准备锁定 SDK 和 Chromium。项目级安装包不含凭据，不修改用户全局设置。
- 准备单独的**发行后置清单**：独立 npm tgz、CLI 打包、MCP 远端 Transport、云端 Generator API、资源 CDN、账号/配额和版本迁移；本轮不实现这些独立服务。

**DoD：** 新实验工作区按文档可安装并在至少一个真实宿主自动触发生成、MCP 验证和双 SDK 预览；其余宿主按实际测试情况逐一记录。所有输出/本地报告路径存在、摘要吻合、失败保留且旧 Gate 无变化。

---

## 6. 执行批次、并发与权限

### 6.1 批次顺序

1. **Batch HOST-A：HOST-0 → HOST-1**。只做环境/配置/无模型验收；可并行编写三宿主适配文档，但不能多人改 `integrations/mcp/service.mjs`。
2. **Batch HOST-B：HOST-2 Pilot**。每宿主单独打开新会话做 G01；若 HOST-G1/G2-PILOT 有可复现缺口，进入 HOST-C 修工具与 Skill 后再继续；不要直接投入所有 15 单元。
3. **Batch HOST-C：HOST-3 → HOST-4**。先诊断/规范发现，再校验真实 SDK/视觉；无法用真实模型的受影响项目标记阻塞，继续无模型工具测试。
4. **Batch HOST-D：HOST-5 → HOST-6**。冻结环境之后开展 15 单元真实任务；分析根因、进行有版本的 Skill 改进，另做保留集验证。
5. **Batch HOST-E：HOST-7**。文档、工程打包、复现、状态与后续产品化交接。

### 6.2 Agent 并行规则

最多 3 个互不冲突的工作单元并行，例如三个宿主各自安装文档/集成测试。主 Agent 负责唯一 Gate 台账和最终报告；同一共享核心文件（例如 `integrations/mcp/service.mjs`、`generator/index.mjs`、`src/runtime.ts`）同时只能有 1 个修改者。并发模型任务必须明确本轮宿主预算和隔离目录，不能读取或借用另一宿主的结果。按依赖与证据先后推进，不因子任务宣称完成就跳过主 Agent 复核。

### 6.3 模型调用额度与计账

- 本轮文档**不授予新的模型调用额度**。已有 Generator Benchmark 的 30/30 已消耗，不可继续以该预算代调用 Codex/GLM/Claude。
- 将 **宿主原生推理**（Qoder / WorkBuddy / TRAE 自身 Agent）和 **A2Game MCP `generate_game`** 分开记账，首要路径后者必须为 **0**。宿主通过正常对话执行的任务应记录实际模型/推理配置/对话回合和可用量；没有用量返回时是 `UNKNOWN` 而不是 0。
- 如果测试涉及消耗额度、切换模型、产生费用或外部请求，先按宿主既有权限/用户明确约束执行；不默认无限批量。任何未授权或额度不足记 `BUDGET_BLOCKED`，其他无模型任务照常完成。
- 不允许使用模型返回的 `provenance.model` 自报当作真实宿主身份；应保存宿主控制面实际请求路由，服务返回身份缺失时明确 `HOST_RECORDED_REQUEST_NOT_SERVER_ATTESTATION`。

### 6.4 失败归因与停止条件

- `HOST_DISCOVERY`：Skill/MCP 不能发现或自动触发；先查配置、宿主版本、Tool 描述裁剪，不归因到 GameSpec。
- `SCHEMA/CAPABILITY/RULE`：JSON 不合法、Manifest 缺失、Tick/终局合同错误，修同一生成稿；切勿修改 Validator 让不合法内容变合法。
- `ENGINE/INPUT/VISUAL`：Host 加载或画面/输入问题，冻结相同 JSON/Trace 对照，保留独立引擎截图与最小复现。
- `MODEL/PROVIDER`：宿主模型编写错误或授权/额度/超时等，分策略问题与基础设施问题，不静默换模型。
- `INFRA/QUOTA/EVIDENCE`：运行环境、SDK、浏览器、CI、受信历史回执受阻；不以 mock 结果升级真实 Gate。

单单元最多 3 次候选修复；达到预算仍失败则保留 `FAIL/PARTIAL` 进入下一任务/技术分析，不无限重试直到通过。改变任务文字、共享 Skill 或 Tool 描述要冻结新版本，不得覆盖旧指标。

---

## 7. 必需测试命令与验收证据

> 以下为当前仓库已有命令（新工作流文件名尚未实现）。实际执行前用 `npm run` / `--help` 核对当前可用性；在已授权环境运行。

```powershell
# 宿主工具链基础安装（不含系统级/全局 Agent 配置更改）
npm ci
npm run mcp:install
python -m pip install -r requirements-dev.txt
npm run build

# 无模型与接口合同
npm run generator:smoke
npm run generator:command-smoke

# 已准备真实 SDK 和 Playwright Chromium 时
npm run sdk:prepare
npx playwright install chromium
npm run mcp:check
npm run generator:browser

# 恢复受信历史证据后执行完整回归（缺证据如实记录）
npm run project:check
npm run verify
```

**严格报告原则：** 上述命令只有真正运行且留有日志、当前 HEAD 和输入/工具/SDK SHA 才能标本轮 PASS；从 README 复制的旧测试计数只是历史事实。

### 7.1 每单元必需的原始与结构化交付

```text
reports/host-first-<runId>/<host>/<taskId>/
  session.json             # host名称/版本/模式/模型身份来源/Skill SHA/MCP SHA
  natural-language.txt     # 用户原始需求及是否显式点名Skill
  discovery.json           # Tool 列表、Skill发现/触发、工具调用顺序
  generation.raw.json      # 原始模型输出（私有）；不可手工覆盖
  game.json / conformance.json / solution.json
  attempts.json            # 原始输出SHA、每轮失败/修复、宿主原生调用记账
  schema-and-logic.json   # Schema/Conformance/Headless与诊断
  three.json / air.json   # 真实Host/输入/Hash/暂停重开与释放
  screenshots/            # 初始/进行中/胜利/失败及窄屏
  visual-review.json       # AI参考与人工验收独立
  result.json              # Gate、范围、来源SHA、未验证项与归因
```

不应将宿主内部敏感上下文、令牌、认证文件、用户个人隐私或完整密钥日志存入 Git/共享回执；在受限本地目录单独保存审计原始材料，公开报告只保留允许的 SHA、统计和非敏感错误信息。

### 7.2 `result.json` 推荐最小结构（提议，落地前补 Schema）

```json
{
  "format": "a2game-host-first-result",
  "version": 1,
  "taskId": "G01",
  "host": "qoder",
  "sourceSha": "<git-sha>",
  "skillSha256": "<sha256>",
  "mcpContractVersion": 1,
  "generationMode": "host-native-authoring",
  "autoTriggered": "NOT_RUN",
  "modelIdentity": {
    "requested": "UNKNOWN",
    "observed": "UNKNOWN",
    "evidence": "NOT_AVAILABLE"
  },
  "hostModelUsage": "UNKNOWN",
  "mcpProviderCalls": 0,
  "attempts": [],
  "checks": {
    "schema": "NOT_RUN",
    "conformance": "NOT_RUN",
    "headless": "NOT_RUN",
    "three": "NOT_RUN",
    "air": "NOT_RUN",
    "visual": "NOT_RUN",
    "human": "NOT_RUN"
  },
  "formalG3": "NOT_RUN",
  "receipt": null
}
```

所有校验字段初始为 `NOT_RUN`；不能因生成报告中有字符串 `PASS` 就直接更改对应结果。模型输出中的测试、解法、署名是*输入声明*，不是可信验收结果。

---

## 8. 可交付范围与“完成”的准确表述

| 条件 | 对外允许的结论 |
|---|---|
| HOST-G0/G1 + G01 Pilot 部分通过 | **Host integration pilot ready**（列明哪两个/哪三个宿主，哪些 Gate 未过） |
| 三宿主 Pilot、诊断、双 Host、15 单元有可复核结果 | **Host-first engineering reference completed**；必须展示真实分子/分母，不宣称所有模型生成成功 |
| 视觉、人类试玩和正式 G3 未签收 | 仍为 `Alpha reference`；即使 15 单元工程全部 PASS 也不是产品正式发布 |
| 已准备真实客户端 SDK + Content Package | 可以在**受信且兼容的目标宿主**运行；不是无需 Runtime 的完整 APK/独立游戏应用 |
| 后续 `CLI/API` | 作为已通过 Host-first 的可替代调用入口发展，复用单一 Runtime/Validator，不另建第二套游戏协议 |

**关键交付：** 一个不认识 GameSpec 的普通用户，在 Qoder/WorkBuddy/TRAE 的真实新会话中提出需求，宿主 Agent 能自动发现 A2Game、完成自己的 JSON 创作并用 MCP 闭环验证，在 CocosAirJS/Three.js 实际玩到生成的游戏。失败必须能分清是 Agent、Skill、MCP、Capability、Runtime、引擎还是视觉素材问题。

---

## 9. 直接交给执行 Agent 的启动任务

> 请在已有的 `oahc09/a2game` 本地工作区按本文件实施 **A2Game Host-first**。首先检查 `git status --short` 与当前 HEAD；一次性读取 `AGENTS.md`、`PROJECT-PLAN.md`、`PROJECT-STATUS.md`、`project/status.json`、`project/generator-status.json`、`integrations/mcp/`、`integrations/skill/a2game/`、`generator/`、对应测试和 `docs/generator-handoff.md`。保存用户未提交改动，不改默认模型路由或现有安全门禁。
>
> **不要重新开发 CLI/MCP/Skill。** 复用现有 9 Tool stdio Server、原 Skill 源码、严格 Validator/Conformance/Headless 和两个真实渲染 Host。当前主线是：**HOST-A 环境与三宿主项目级配置 → HOST-B 在 Qoder/WorkBuddy/TRAE 新会话真实自动触发与 G01 Pilot → HOST-C MCP 诊断/资源发现与修复 → HOST-D 双引擎真实输入与视觉 → HOST-E 3×5 真实独立生成 Benchmark → HOST-F 工程交付与状态收口**。先将工作拆成不冲突的小批次，每批必须留下当前源码 SHA 的证据，Gate 通过后再推进依赖任务；最多三个独立子任务并行，核心共享文件只能单所有者改动。
>
> **最初只实施 HOST-0/HOST-1 的无模型部分；若实际宿主可用，再在用户已许可的会话与额度内进行各宿主 G01 Pilot**。本计划不授权额外模型 Provider 调用；MCP 默认 `maxCalls=0`，宿主自己生成时不得隐式使用 `generate_game`。固定原 G01–G32/H01–H05、GameSpec `0.1.0`、S0–S11、G0–G3、正式 G3/真机/远端 CI 的全部边界，所有参考与正式 Gate 分开登记。历史 Batch D 的 30 次预算已耗尽，H01 原始模型失败不允许被宿主修正版改写为模型成功。
>
> 每批交付最新改动清单、运行命令/日志、当前 HEAD/SDK/Skill/MCP/宿主版本、真实与缺失的证据、修复前后差异、失败归因、状态台账和下一批入口。不得擅自 commit/push/deploy、修改全局宿主配置、安装扩展、操作凭据或删除用户数据；需要人类安装/授权的步骤生成准确的项目级指导并标记相应 `BLOCKED_USER_ACTION`。不需要反复追问已经明确的项目范围。

---

## 10. 后续但非本轮的路线

- **产品化 CLI 与本地独立包**：在 Host-first 定义的 Tool/Schema/质量合同稳定后，将同一 Generator Core 封成独立可安装产物，保证无原仓库依赖的真实运行。
- **Model Provider API**：只有明确需要由 A2Game 本身代调用模型时才提供，不替代 Agent 已有模型；新模型适配先协议兼容实测，再记录身份/用量/预算。
- **云端 Generator API**：保留相同验证器、GameSpec、Capability Catalog、Release Manifest 和可复现用例；不要构建平行服务端 Runtime。
- **客户端产品 SDK**：可拆 CocosAirJS/Three.js 接口和 A2Game Player 的稳定安装包；Android 真机与宿主平台新能力独立验收。

## 11. 参考文件与官方文档

- 当前仓库计划：`PROJECT-PLAN.md`；状态：`PROJECT-STATUS.md`、`project/status.json`、`project/generator-status.json`；Generator 接入：`docs/generator-handoff.md`、`docs/generator-mcp.md`；真实失败：`docs/generator-real-findings.md`、`docs/generator-h01-repair.md`；证据恢复：`docs/evidence-restoration.md`。
- Qoder：https://docs.qoder.com/qoder/extension-publishing ，https://docs.qoder.com/qoder/skills
- WorkBuddy：https://open.workbuddy.cn/docs/connector ，https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide
- TRAE：https://docs.trae.cn/ide_add-mcp-servers ，https://docs.trae.cn/ide_skills ，https://docs.trae.cn/ide_troubleshoot-mcp-server-related-issues

> **文档实施状态：** 本轮交付任务计划，不代表上述 HOST 阶段已经执行。所有工具、宿主与模型的实际 PASS 只能由执行 Agent 在真实用户环境留下回执后登记。
