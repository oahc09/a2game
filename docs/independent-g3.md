# 37 款独立 G3

已按用户指定使用当前 Codex CLI 完成37款独立定义及有界修复。当前 **37/37工程参考、37/37浏览器主输入、37/37逐款AI参考审查**，含31款桌面鼠标/键盘和6款明确标记的虚拟/合成来源。74份当前定义的双SDK主输入证据绑定JSON SHA，核对输入回放、Hash、重开与零资源释放；另留G31按钮回退。G02使用宿主Runtime求解辅助，不计模型自解。正式G3仍 **0/37**，最终verified仍 **0/32＋0/5**。

累计168次生成调用，另有1次探测；初始108次、四款修复7次、本轮输入/画面53次分别记账。本轮预算最多74次，未耗尽预算继续空跑。所有原始失败、跨批修复与2次缺失用量保留，价格未知；不宣称统一提示的一次成功率。纯表现修复保持玩法/输入/状态/正反例/解法，G32主输入规则修复单独记录。

首轮历史桌面输入为25款、50/50流程；该历史范围不覆盖后来的定义修改，当前口径见上方索引。[版本 3 回执](../reports/g3-native-2026-10-27T16-35-57-549Z-26772/summary.json) 绑定实际定义 SHA 和工具源码，覆盖实际输入、精确 Hash、重开及释放；仅为独立变体的工程参考。

四款原始诊断与处理如下；正式来源/人工/设备验收继续独立：

| 游戏 | 原始诊断 | 本轮处理 |
| --- | --- | --- |
| G02 | `A2G_E_AGENT_ENVELOPE`，输出合同字段缺失 | 宿主对该模型定义搜索，模型选择字面量引用并编写负例，标准 JSON 完整准入及双 SDK 通过 |
| G11 | 短蓄力反例 `/state/combo` 预期 0，实际 1 | 关卡/负例修复，解法改为与正例一致的真实按住/松开，双 SDK 通过 |
| G24 | 终局后继续注入玩法输入，得到 `A2G_E_FLOW` | 终局冻结使用 expectError 验证拒绝，保留胜负/平局机制，双 SDK 通过 |
| G26 | 获胜例 `/state/returnedCorrectly` 预期 true，实际 false | 修复双姿态达标后的归还顺序，取消及提前归还负例和双 SDK 通过 |

## 需要什么服务

### 2026-10-28 有界宿主求解反馈

G02 在标准两块低值数字开局上，由 `solve-grid-playthrough.mjs` 对其先前独立模型定义进行有界共享 Runtime 搜索，取得 1,021 次滑动。搜索只选择已声明动作，不实现第二套移动/补位规则，不读取作者关卡或 `full-2048-traces.json`，不执行模型脚本。搜索失败/预算耗尽不代表无解。

`a2game-referenced-generation-output@1` 是宿主 Agent 工具 Profile，允许模型选择本次请求已批准的 GameSpec/解法 SHA 引用，并编写自己的 Conformance 负例。`bind-agent-evidence.mjs` 只展开这些字面量；未知引用、摘要不符、换种子、越预算均拒绝。原始模型回复、引用 Registry、物化标准 JSON、binding 与源码分别保存。不是 GameSpec/Conformance 协议升级，也不允许模型指定路径、URL 或命令。

这条轨迹封装为 32 行、每行最多 64 个当前 Tick 原始按键样本；Conformance 将各行放到其原始 Tick 偏移后统一推进，正例总计 2,048 项。保留原来的 256 行解法、2,048 项用例、12,000 Tick 和 768 KiB 紧凑传输上限。包含未来时间戳的调试输入会被浏览器实时入口重标时间，相关 Hash 失败已保留；最终回复明确选择当前 Tick 批次并重新通过 Node/两套 SDK。

G02 标记 `HOST_RUNTIME_SEARCH_LITERAL_REFERENCE`，不能算模型自解。37 款工程参考和正式 G3 继续分开；追加调用预算以旧汇总的 SHA/已用次数为基准，旧试跑、中止、失败、重试都计入。历史生成器源码另存 SHA 归档，纯源码检出恢复证据后不依赖不可达的本地提交对象。

2026-10-27 用户已指定直接使用本机现有 Codex CLI。使用下面的 CLI 入口即可，无需配置 HTTP 接口或另外提供 API 密钥。HTTP 路径仍保留供其他宿主选用。

普通大模型 API 即可，无需另建游戏服务器。可以是云端接口，也可以是本机模型服务；本次新增适配器接受 **Chat Completions 格式**，将项目提示、完整 Schema、127 份 Capability 合同和修复诊断转换为 `messages`。返回的文本仍须通过原有严格 JSON、完整 Schema 和共享 Runtime，不能因启用 JSON mode 就跳过校验。

服务需要支持非流式调用、JSON 对象输出，以及足够容纳协议请求与完整游戏输出的上下文。当前一份首轮请求约 152 KB；确切 Token 数由模型 tokenizer 决定。输出默认上限 16384 Token，HTTP 默认 50 秒、外层进程最多 60 秒。截断、拒绝、网络失败均记录失败，不拼接或擅自修复返回正文。

准备以下信息：

- 完整接口地址，例如本机 `http://127.0.0.1:8000/v1/chat/completions`，或供应者的 HTTPS 地址。
- 实际模型 ID。配置中的 `replace-with-*` 只是占位文本，不代表选定模型。
- 本轮最多执行几款、最多调用几次，以及每次输出 Token 上限。每款最多 3 次，失败修复也占调用次数。
- 如需认证，只在本机配置 `bearerTokenEnv` 指定已有环境变量名称。不要在聊天、参数、URL 或配置中填写密钥本身。

字段依据 [OpenAI Docs：Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。兼容接口是否支持同名字段须以实际服务为准。HTTP 接入夹具阶段未调用付费模型；后续真实 Codex CLI 用量实际记录，不能推断费用为零。

## 配置和执行

### 直接使用现有 Codex CLI

将 [CLI 配置示例](../project/codex-generator.example.json) 复制为 `.a2game/codex-generator.json`，`executable` 指向已安装的 Codex。当前机器使用 Cindy 自带的 `codex-cli 0.159.2`；不修改 PATH、不安装第二份 CLI、不读取或复制认证文件，沿用当前 `CODEX_HOME` 的正常认证和模型设置，不传 `--model` 覆盖路由。

```powershell
npm run g3:codex -- .a2game/codex-generator.json --ids=G01
# 单款通路验证后，去掉 --ids 执行全目录；也可明确列出剩余任务。
```

生成运行于仓库外新建的临时目录，使用 `--ephemeral --json --sandbox read-only`，关闭 shell 工具。只提供任务、Schema、能力合同和上次诊断；检测到命令执行、文件修改、MCP 或搜索调用则拒绝作为隔离生成证据。既有作者 GameSpec/解法不提供给 CLI。

HostProfile v2 另提供 11 份公共 `src` 库实现的状态类型、初态工厂与配置约束，以及 06 号表现规范的中心原点/坐标合同。它们是可信机制库的公开 ABI，不是任何 Gxx/Hxx 作者关卡、预存解法或测试。这样可补足部分 Manifest 的宽泛 `stateSchema: object`；JSON 准入及 Runtime 仍按原规则执行。实际公共文本及 SHA 保存在每次请求中，新批次同时归档当时的生成器源码。生成时限仍由配置显式限制，本轮 ABI 批次为 10 分钟。

配置可指定 `stopFile`；文件出现后在下一次生成前停止调度。两个上下文更新前主动终止的调用保留 `A2G_E_CODEX_EXIT`，另标记为宿主主动中止，不计模型能力失败；其他已完成输出亦不覆盖。统计需同时保留旧上下文与新上下文的调用数，不能把新批第一次称作整项从未修复的 one-shot。

CLI 的生成阶段单独限制为每次最多 5 分钟（配置可选 1 秒至 10 分钟），每款最多 3 次、全目录最多 111 次。生成完成后，原始结果由原有 `agent-workflow.mjs` 完整准入、Conformance、解法与重复 Hash 校验，验证阶段保留 60 秒的原进程预算。浏览器再对同一份输出运行两套真实 SDK。这是独立的宿主 CLI Profile，不提高旧 HTTP/stdio 模型调用的时限，也不改变 GameSpec 协议。

每次产生 `reports/g3-codex-*/`，按款/尝试记录请求、原始结果、可执行文件 SHA、线程 ID、事件类型、实际 Token 用量、时限和失败归因。费用未知仍标记 `NOT_REPORTED`；仅 CLI 进程真实执行并不证明玩法语义、完整质量或适用物理 Gate 已通过。正式 G3/verified 继续单独计数。

已通过规范化回放的结果还需复核真实键盘/按钮入口。`scripts/g3-native.mjs <批次 summary.json>...` 重放桌面键盘、按钮和有记录的按住/释放操作，核对预期状态、实际归一化 Trace 的 Node/Host Hash、重开与释放；Touch/IMU/Gamepad raw 或模拟量解法明确 `NOT_RUN`，该桌面 Profile 不替代物理验收。版本 3 保存自身源码及前后摘要，每份回执绑定定义 SHA；旧版本/不同定义的通过不能转用。只选择没有重复任务的批次，浏览器总并发仍最多 2。

`g3-revalidate.mjs` 只复测 SHA 绑定的 INFRA 输出，可选的后续模型修复另计调用；`g3-browser-retry.mjs` 只重跑原始准入成功内容的浏览器。`g3-followup.mjs` 每款只允许一次明确选定的修复；早期两组回执继承了上下文的 limits 元数据，实际分别执行 2/3 次调用，driver-source 和逐次 cli.json 保留真实行为，旧回执不覆盖。

宿主选择配置交给 `node scripts/g3-codex-report.mjs <配置>` 可汇总 37 款，按原始调用目录去重，分开统计试跑、历史修复与探测，并校验原始请求/输出、源码、SDK、原生输入与截图。`node scripts/g3-codex-report.mjs --check` 只读复核当前索引、全部归档 SHA、当前源码和计数。它不会批准正式 G3 或修改冻结 Registry。

参考 [OpenAI Docs：非交互执行](https://learn.chatgpt.com/docs/non-interactive-mode)。

### HTTP 或其他 stdin/stdout 接口

先把 [模型配置示例](../project/model-generator.example.json) 和 [批次配置示例](../project/g3-provider.example.json) 复制到 Git 忽略的 `.a2game/`，分别命名 `model-generator.json`、`g3-provider.json`，填写地址、真实模型及本轮预算。配置文件由宿主指定，不接受模型返回的命令或 URL。

```powershell
npm run build
npm run g3:plan
npm run g3:run -- .a2game/g3-provider.json --ids=G01
```

示例预算为 1 款、最多 3 次调用。单款通路确认后，将 `maxTasks` 改为 37，明确 `maxCalls`（37–111）并去掉 `--ids`，按同一批次顺序执行全部任务。也可指定 `--ids=G13,H03`，对应增加任务/调用预算。达到调用预算或生成基础设施失败后，不再调用后续任务。

每次使用独立 `reports/g3-batch-*/`；逐款完成即写检查点，中断后保留已有材料。再次执行不会覆盖旧批次，也不会自动复用旧 PASS 或合并重复任务；用 `--ids` 选择尚需执行的任务，避免重复调用。生成器未配置时只执行 `g3:plan`，不会自动猜测服务或读取凭据。

已有返回项目 generation-output 合同的 HTTP 服务或 stdin/stdout 生成命令，也可直接填写 `command`，继续复用既有 `http-generator.mjs` / `agent-workflow.mjs`。

## 验收和记录

[任务清单](../project/g3-tasks.json) 只提供自然语言要求和必须的能力版本，不向模型提供现有作者 GameSpec、正反例或解法。每款均保留提示、原始输出、错误及有限修复、完整内容准入、Conformance 和独立 Session 解法回放。夹具来源、作者定义原样复用、缺失必需能力、初态已经胜利、无交互解法均拒绝进入独立候选。

生成通过后，新的 `g3-browser.mjs` 对任意长度解法及全部有界正反例运行真实 Three.js/CocosAirJS HTTP 浏览器。记录 Node/Host Hash、画面、暂停冻结、回到初态、重开及零资源释放；双 SDK 顺序执行。可单独重查某次生成：

```powershell
npm run g3:e2e -- reports/某批次/G01/generation
```

模型适配器保存供应者返回的模型/请求 ID、请求设置和实际报告的 Token 用量；未返回的用量与费用保持未知，不估算成零。自定义生成命令没有用量回执时标记 `NOT_REPORTED`。外层进程失败属于 INFRA；内容/规则/解法失败属于 AGENT_STRATEGY；浏览器失败保留独立材料，未诊断前不直接判成模型能力不足。

**批次工程通过不自动等于 G3 PASS。** 必需能力声明不证明机制被正确使用，供应者/模型自报也不证明独立性。批次分别记录 `engineeringPassed` 与 `independentG3Passed`；当前无可信外部签收入口，后者固定为 0。真实来源、变体符合任务、质量/难度/可玩时间及适用设备须独立审查，再接入正式档案；不会修改冻结 Registry 或减少人工/物理 Gate。

## 本轮工程验证

```powershell
npm run g3:fixture
```

该命令用本机合成的 Chat Completions 响应，完成五步解法（等待＋四次点击）、成功/负例、真实双 SDK Hash 与释放验证，输出独立回执。它明确标记 `fixture`，只验证工具链，**不计 37 款独立生成、真实模型费用或 G3 通过**。

## 当前主输入与画面核对

`node scripts/g3-source-input.mjs --selection=<选定回执JSON>` 执行已声明鼠标/键盘、CDP多指和显式合成IMU/Motion，不直接注入获胜状态。G29/H04以宿主配置把原解法中的回退动作映射为主传感器来源；G31另验转屏清除旧瞄准及重新校准。这些是宿主验收夹具，不计新的模型解法或物理证据。每32份定义使用新的临时内容存储，保持服务既有容量上限；按住多指时的中间截图保持视口不变。

`node scripts/g3-presentation-invariants.mjs <选定回执JSON>` 核对35份纯表现修复的不变量。逐款AI记录绑定实际workflow与四张SDK图；部分不活动提示仍有低对比字影，难度和持续游玩尚未人工标定，AI_REFERENCE_REVIEWED不等于正式质量PASS。
