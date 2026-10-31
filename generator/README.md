# 本地 Generator（Batch A）

在仓库根目录执行 `npm ci`、`npm run build`；Python 环境安装 `requirements-dev.txt` 中的依赖，或通过 `A2GAME_PYTHON` 指定已有环境。所有入口均使用 `npm run generator -- ...`，不需要发布或全局安装。

```powershell
npm run generator -- --help
npm run generator -- probe --provider fixture --json
npm run generator -- generate --prompt-file prompt.txt --provider fixture --output output/my-first-game --json
npm run generator -- validate output/my-first-game/game.json
npm run generator -- test output/my-first-game
npm run sdk:prepare
npm run generator -- preview output/my-first-game --backend three
npm run generator -- inspect output/my-first-game --backend air
npm run generator:smoke
npm run generator:browser
npm run generator:studio
```

`fixture` 总是构造相同的三步计数游戏，只验证工程链，不理解提示词，不属于独立模型生成。`inspect` 打开现有 Inspector，再手动导入产物目录的 `debug-bundle.json`。预览只绑定 `127.0.0.1`，`Ctrl+C` 结束监听；缺 SDK 返回 `BLOCKED`，不会自动改用 Canvas2D。

`generator:browser` 每次新建 fixture 产物，经公开 Generator 预览入口分别启动真实 Three.js/CocosAirJS，在桌面与 390px 窄屏检查初始、未达目标、通关、暂停/重开、键盘/按钮输入、Headless Hash、资源与监听释放；截图和来源指纹保存到独立 `reports/generator-browser-<UUID>/`。它需要已准备的 SDK 和 Playwright Chromium（`npx playwright install chromium`），缺少时明确失败/阻塞，不会改用模拟后端。这项验收仍属于夹具工程参考，不代表自然语言生成质量或真机触控。

真实 provider 必须显式选择，配置通过 `--config <本机文件>` 传入；`probe` 只检查本地配置，不发模型请求、不读取密钥值，也不能证明远端路由和模型身份。真实 `generate` 会消耗服务额度，运行前应先取得本轮模型与调用预算。

支持沿用已有 adapter 的配置：

```json
{"executable":"C:/absolute/path/to/codex.exe","generationTimeoutMs":60000}
```

上述配置用于 `--provider codex`，保留 CLI 已有认证和默认模型路由，不设置模型覆盖。

```json
{"endpoint":"https://your-service.example/v1/chat/completions","model":"your-model-id","timeoutMs":50000,"maxCompletionTokens":16384,"bearerTokenEnv":"A2GAME_MODEL_TOKEN"}
```

上述配置用于 `--provider model-http`；`--provider http` 使用既有原始 JSON 服务合同。只允许命名环境变量引用，禁止配置中嵌入 token、apiKey、password 等字面凭据。配置与原始服务回复不应提交 Git。

每次输出目录必须不存在。成功输出 `game.json`、`conformance.json`、`solution.json`、`release-receipt.json`、`debug-bundle.json`、`tests/` 和 `generation-report.json`。报告用相对路径与 SHA256 标识文件；私有 prompt、原始回复、失败尝试、服务 telemetry 单独保存在 `.a2game/generator/<runId>/`。失败仍保留本次公开报告，不覆盖旧运行。回放会重新检查完整 Schema、正负例、解法及双 Session Hash。

`--max-attempts` 为 1–3，`--timeout-ms` 是整个生成任务的时间上限（100–600000）；取消或超时会清理本次 worker 子进程树。未知费用与用量保持 `null` / `NOT_REPORTED`；宿主求解辅助单独标记。退出码：0 成功，1 验证/生成失败，2 参数或本机操作失败，3 `BLOCKED`，130 取消。直接 `node generator/cli.mjs ... --json` 可获得单个 JSON 结果，避免 npm 自身输出横幅。

支持 `direct-json` 与 `game-plan`，均检索公开 Registry 并复用完整准入；`game-plan` 先创建/校验内部规划，再把规划交给原 Provider 编译。默认规划是关键词匹配的宿主草案（不是模型规划或语义通过），可用 `--plan-file` 提供人工/外部 Agent 编辑的规划。fixture 始终对应计数夹具，不解释需求。[本地 Studio 与内容游戏包](../docs/generator-studio.md)已有入口；[五任务两模式 Benchmark](../docs/generator-benchmark.md)可准备公共上下文，真实执行需要新授权预算。这里的 `PASS_REFERENCE` 不升级既有正式 G3、人工质量或真机验收。

```powershell
npm run generator -- plan --prompt-file prompt.txt --output game-plan.json
npm run generator -- check-plan game-plan.json
npm run generator -- generate --prompt-file prompt.txt --provider fixture --mode game-plan --output output/plan-demo
# 真实 Provider 使用已授权的配置和预算，增加 --plan-file game-plan.json 可编译已编辑规划。
```

规划不含作者关卡、初始棋盘或解法；它记录机制所需能力、完整依赖、控件来源、可选实体/状态引用、目标描述和测试意图。全部采用内部 [GamePlan v1 Schema](game-plan.schema.json)，不会交给 Player，也不修改 GameSpec 协议。未知玩法、能力/版本缺失、依赖不全、悬空引用、3D 缺 Stage、未满足能力均拒绝；不会退回计数游戏。机制匹配是保守启发式，未理解的复合要求仍需审查或显式规划。

生成后核对规划能力、实际组件绑定、输入源与声明的实体/状态引用；这不证明目标描述中的全部玩法语义。每次回执分别记录完整/精简请求字节数（Provider 附加上下文之前）、能力数；未实测 Token 和成功率不宣称效率提升。失败修复只携带本轮当前 Provider 的原始输出和有界诊断，安全拒绝不放宽策略，基础设施失败停止。新增 `tests/lifecycle.json` 检查共享 Headless 的暂停冻结、终局拒绝输入、重开回放、独立 Session Hash 和幂等销毁后拒绝执行；真实 SDK 资源和人工质量独立记录。

可用 `npm run generator:browser -- --mode=game-plan` 复核规划模式夹具的双 SDK 桌面/窄屏。详细边界见 [Batch B](../docs/generator-batch-b.md)。

Studio 默认用 fixture、真实预算 0。页面可生成/取消、实际双 SDK 试玩、检查 JSON/规划/状态和导出/导入受控内容包。`export-package <目录> --output <新文件>` / `import-package <文件> --output <新目录>` 会重走完整准入，包不携带可执行代码或私有原始数据；接收方需要兼容宿主、SDK和审核资源，当前不嵌入 Runtime 或资源二进制。详见 Studio 文档。

`npm run generator:benchmark -- plan` 仅准备 10 个单元，预算 0、不调用模型；真正执行须另给 `run --provider ... --config ... --max-calls ...`。默认不执行、不用夹具或旧 GEN-2 结果填充新成绩。`generator:smoke` 会在干净源码中检查两模式、包导入导出及无调用的矩阵准备，不依赖历史报告和 Renderer SDK。

真实首轮的宿主缺陷、输入与视觉问题见 [运行发现](../docs/generator-real-findings.md)。基础表现目录现包含 `visual.body-style`；使用 circle/value body styles 时仍必须由生成内容显式声明该能力。修复只回传当前单元自己的上一份输出和最多3条已知错误历史，防止修复新错误时回退旧错误。

普通CLI/Studio仍默认最多3次。高级宿主在另有明确预算授权时可用API `generateGame({attemptOffset:3,maxAttempts:1,maxTotalAttempts:4,initialPrevious,...})` 续修一次；必须提供有界的上一份自身输出，默认总上限3不会自动放宽。报告保留`priorAttempts`、新`generationCalls`、`totalAttemptsObserved`、续修上下文SHA和从4开始的编号，不能标one-shot；总调用上限由编排器继续独立约束。`node scripts/generator-status.mjs --json`只读输出记录状态，不重放验收或自动批准Gate。

生成/重验/包导入还检查参考Host的实时方向键配置：`realtime.world`方向动作绑定`keyboard.button`时需要`config.hold:true`。这是避免默认同Tick press/release抵消移动的静态检查，仍需真实浏览器输入复核。

关键词机制检查识别公开`a2game.strategy.tower-defense@0.1.0`组件自带的合成/替换与消耗/奖励：必须实际配置并绑定可操作的place/select/merge，以及正成本/奖励，不能仅出现塔防组件就冒充合成。该合同不要求重复声明`puzzle.merge`/`strategy.economy`服务标记；显式能力、完整Schema和原始Conformance仍严格执行。H01原始输出的宿主误判与零新增调用复验单独留证。

## MCP 与 Skill

`npm run mcp:serve`启动本机stdio的9个受限工具，默认Provider调用额度0。已有JSON直接validate/test，不隐式调用模型。CLI能力查询使用`capabilities --query puzzle --json`和`capability --id a2game.puzzle.grid-push --cap-version 0.1.0 --json`，与MCP共享公开Registry查询。

`npm run mcp:check`通过官方SDK与独立Python客户端执行无模型闭环、CLI对照和真实双SDK输入/Hash/释放；`npm run generator:smoke`另测无SDK的新源码闭环。`npm run skill:package`只创建Skill ZIP和SHA，不安装或更改全局配置。项目级Skill安装及宿主练习、MCP真实Provider历史调用已有参考记录；Skill新会话自动触发和Provider返回模型身份仍待核实。详见[MCP边界](../docs/generator-mcp.md)与[Skill源码](../integrations/skill/a2game/SKILL.md)。

## 原生子 Agent 交付

宿主 Agent 使用 `buildNativeContext(prompt, attempt, previous)` 准备公开上下文，再通过宿主原生调度工具显式选择模型与推理级别。该上下文明确要求最外层 `format/version` 和数组形式的 `solution`，避免把 Conformance 脚本误当解法。生成 Agent 只读这份公开材料、写原始 JSON；失败修复回到同一生成 Agent，主 Agent 不改写模型 JSON、不补预制解法。每次完整回复分别计入最多 3 次的预算。

收到原始交付后，用统一入口执行完整准入：

```powershell
npm run generator -- import-native --context <公开上下文.json> --raw <模型原始回复.json> --host-record <宿主记录.json> --output <新目录> --json
```

对应 API 为 `admitNativeGeneration(...)`。这是原始交付的导入/校验，**不会再次调用模型**；`generationCalls` 来自宿主已发生的生成尝试，`importModelCalls` 固定为 0。多次重新校验同一交付按 `hostRecordSha256` 去重计账，不能把导入次数算成新的模型生成。回执保留全部生成尝试，修复后通过不能标为 one-shot。

宿主记录采用已有 `a2game-native-host-export@1`，额外必需 `contextSha256`、`replySha256`、`generationCalls`（1–3）、顺序对应的 `attempts`（每项 `attempt/status/code/rawSha256`）。记录请求模型、推理级别、原生调度工具、会话标识和可用的宿主观测；最后一次 raw SHA 必须绑定本次导入，路径不允许覆盖或穿越。原始回复、上下文和宿主记录留在私有目录，公开报告只导出允许的字段。

导入器仅校验字节绑定与完整运行，不自动认证记录签发者。`HOST_RECORDED_REQUEST_NOT_SERVER_ATTESTATION` 表示宿主记录的请求路由，服务端实际模型版本、完整工具轨迹、OS 隔离未导出时分别保持未知。模型自报 `provenance.model` 不作为身份依据。宿主必须结合真实调度操作审查来源；正式 G3、人工/视觉质量保持独立。
