# A2Game 实施约束（本工作区）

按以下顺序阅读并执行：`README.md` → `PROJECT-PLAN.md` → `PROJECT-STATUS.md` → `project/status.json` → 对应 `specs/v0.1/docs/*.md` → 源码与测试。若存在宿主或用户更高优先级指令，优先遵守；不得以此文件绕过权限要求。

1. **版本**：工作区发行 `1.0.0`；实际 npm 版本 `1.0.0`；GameSpec/Capability Protocol `0.1.0`。协议现位于 `specs/v0.1/`；保留历史协议内容和旧 `v03-*` 证据，禁止混淆发行版本与协议版本。
2. **状态**：S3–S7 已有声明范围内的参考 Profile 与真实 SDK 回执，S8 工程/虚拟输入已验证但真机 Gate 待验收，S9 有界独立候选参考已验证，S10 生成/调试与 S11 初始兼容扩展工程已验证；后续为独立验收；S2 四份 scene2d G2 保持独立回执。G1 全目录 PARTIAL；G3、真机 Touch/IMU 仍 NOT_RUN。不得把局部 Profile 或参考样例改写成全量完成，现行状态以 `project/status.json` 为准。
3. **架构**：AI 输出 JSON；全 Schema + Capability 检查；共享 Headless Tick/Rules/State；Host 只消费 PresentationFrame/注入输入。禁止按游戏名在 Adapter 实现玩法、禁止执行 JSON 任意脚本。
4. **范围**：完整范围包括 32 Gxx + 5 Hxx、Touch/IMU、多点触控、2D/3D/物理、Puzzle/Realtime/Combat/Strategy/Economy/Turn-Based、Agent 生成与 Conformance；不能因当前示例有限就删掉未来目标。
5. **实施**：改前看差异；小步增量，保留用户内容；新增 Capability 必须补 Manifest、GameSpec、Schema/语义检查、正反例、Conformance、Host 支持和 Coverage receipt；先证据后升级状态。
6. **验证**：`npm run project:check`、`npm test`、`npm run spec:validate`、`npm run schema:full`、`npm run conformance`、`npm run catalog:build`；真 G2 必须真实 SDK + HTTP 浏览器 E2E，Mock/Canvas2D 不计。
7. **权限**：无明确授权不提交、不推送、不部署、不变更权限、不处理凭据、不删除重要数据。失败按 Engine/Infra/Agent 策略独立归因。
   2026-10-24 用户已授权按现有项目计划持续实施到 S11，每个阶段计划验证完成后本地提交代码，中途无需重复确认。此授权不包含推送、部署、设备权限或凭据操作；不得为满足连续推进而缩减验收要求或伪造阶段完成。
8. **文档更新**：每次代码更改同步 `PROJECT-STATUS.md`、`project/status.json`、`CHANGELOG.md` 的相关内容；不覆盖旧报告/截图/Golden Vector；协议冲突须显式记录并跨文件修复。

## 快速定位

- `src/runtime.ts`：Session、唯一逻辑 Tick、规则事务、暂停/重开/快照；`src/exact-hash.ts` 和 `src/rng.ts` 负责确定性。
- `src/validator.ts`、`src/registry.ts`：语义编译与能力协商；`scripts/preflight.py` 使用完整 Draft 2020-12 Schema。
- `src/presentation.ts`：将只读状态投影成 `PresentationFrame`；`src/input-trace.ts`：规范化输入与 Trace 回放。
- `src/visual-stage.ts`：版本化相机/网格/精灵/动画/粒子/事件音频投影；`player/adapters/*-stage.mjs` 和 `stage-audio.mjs` 管理原生 SDK 对象与释放，`stage:e2e` 验证透视，附加 `--orthographic` 验证正交。
- `src/modules/`：共享玩法；puzzle.ts、realtime.ts、strategy.ts 分别实现有界益智、整数物理/战斗和经营/回合参考机制。
- `player/main.mjs`：HTTP 加载、SHA256 白名单、DOM 输入、唯一生产 Tick 调度；`player/adapters/`：纯表现后端。
- `test/`：Node 与 Mock 合同；`scripts/run-conformance.mjs`：JSON 逻辑套件。Mock 测试不构成 G2 证据。
- `project/sdk-lock.json`：真实 SDK 来源锁定；`scripts/prepare-sdks.mjs` 生成本地 SDK/SHA 清单，`scripts/g2-real.mjs` 通过真实 HTTP 执行跨引擎验收。
- `scripts/content-service.mjs`、`validate-content.py`：本地动态内容完整准入和持久化发布；默认私有数据位于 `.a2game/releases/`，由 `A2GAME_CONTENT_DIR` 覆盖，不入库。恢复记录须重新完整校验，环境不匹配须重新导入。`src/content-release.ts`、`player/content-loader.mjs`：回执及加载完整性检查。API 与宿主策略见 `docs/content-release.md`；`npm run content:e2e` 保留动态导入、真实服务进程重启和双 SDK 证据。
- `specs/v0.1/`：协议、Schema、126 份能力 Manifest、112 份游戏 JSON、32 款候选登记。
- `reports/`：需保留的历史证据；每次真实 SDK 运行使用独立目录，记录来源、SHA、浏览器、输入、截图、Hash 与释放结果。

## 从检出到验证

Node.js 22+、Python 3.10+；PowerShell 下执行：

```powershell
npm ci
python -m pip install -r requirements-dev.txt
npm run verify
npm run player:serve
```

若 Windows 的 `python` 是商店占位程序，可使用已安装的 `uv`：

```powershell
uv venv .venv
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
npm run verify
```

`package-lock.json` 应纳入版本管理；`dist/`、`node_modules/`、`.venv/`、下载的 SDK 和临时浏览器产物不入库。不得删除现有历史报告来整理目录。

真实 SDK 验收：按 `README.md` 准备锁定版本的 CocosAirJS，执行 `npm run sdk:prepare`、`npx playwright install chromium`、`npm run g2:real`。每次运行保留独立目录；`reports/g2-*-real.json` 是当前回执指针。已通过的 G2 会由 `project:check` 检查真实结果、源码指纹与截图，不得沿用代码变更前的 PASS。

## 当前主线与交接

以 `project/status.json` 和本次实际回执为准，避免把本文件中的初始状态当作永久状态。S2 先取得真实 SDK、锁定来源与 SHA，再通过 HTTP 对同一份四游戏 JSON 测试输入、Node/Host Hash、画面、暂停/重开、缩放/DPR、销毁/重建和 context loss。CocosAirJS 的单文档引擎生命周期须遵守上游契约，不擅自重复初始化。环境阻塞与 Adapter/Engine 失败独立记录，不跳过校验冒充 PASS。

仅增加必要的回归测试和可复用 G2 验证，避免过度设计测试用例。提交、推送和部署分别需要授权；授权提交不等于授权推送。

S6 参考扩展：`src/modules/realtime.ts` / `13-Realtime-World-V0.1.md` 定义 `aabb-int-v1`；Manifest physics 模块在 T5 执行，旧 simulate 模块仍在 T4。BodyLayer 是只读整数坐标投影。参考 Profile PASS 不替代完整 Gxx/Hxx、真机或 Agent Gate。

S7：`src/modules/strategy.ts` / `14-Strategy-Turn-V0.1.md`；生产以 Tick 计时，Deck/Hand 使用共享 RNG，路径行为在 T4、物理在 T5。死亡移除路径 Body 后产生 detached 事件，不回写失效对象。参考牌库不提供安全多人隐藏信息。

S8：`src/mobile-input.ts` / `player/mobile-host.mjs` / `15-Mobile-Input-V0.1.md`；共享缓存参与 Snapshot/Hash。传感器只在用户点击后采集，录制独立显式选择；暂停/方向变化需重校准。虚拟 Touch/Orientation、合成 Motion 不计真机，当前无 ADB 设备。

S9：`project/game-candidates.json`、`candidate-evidence.json`、`16-Game-Candidates-V0.1.md`；32+5 独立单关候选，完整 DoD/G3/真机另验。`src/trusted-modules.ts` 是 Node/浏览器统一可信绑定，新增模块同时更新 Manifest 与该绑定。`candidates:e2e` 分批准入、正反例 Node/双 SDK Hash、重开/释放。后续源改动须先重置 `candidateRun.status`，取得当前指纹的新回执后恢复 PASS_REFERENCE。

S10：`scripts/agent-workflow.mjs`、`agent-solver.mjs` 与 `17-Agent-Workflow-V0.1.md`；仅执行宿主配置的 argv，不执行模型输出命令。`test/fixtures/agent-provider.mjs` 及 `agent:fixture` 明确不计独立 Agent/G3。调试入口 `/player/inspect.html` 导入 debug-bundle.json，完整准入后通过真实播放器逐步回放。

S11：`18-Compatibility-Extensions-V0.1.md` / `project/extension-profiles.json`。`src/replay-save.ts` 用有界 Trace 重放和宿主可信迁移，禁止反序列化任意快照/迁移脚本。`scripts/turn-room-service.mjs` + `player/room.*` 是显式启用的同源 loopback 双人公开回合，非互联网/隐藏信息服务。`src/gamepad-input.ts` / `player/gamepad-host.mjs` 仅在显式启用后沿唯一 Tick 采样，断连/暂停/重开/销毁释放；虚拟 Gamepad 不计物理证据。

当前工程交付至 S11；S8/S9/S10 完整 Gate 仍受物理输入、独立 G3 和逐款完整 DoD 约束。`compatibilityRun`、`candidateRun`、`agentWorkflowRun` 的 PASS_REFERENCE 需当前源码指纹。改动后先重置受影响状态；Adapter verified 也必须降为 implemented-unverified，取得新回执后再提升。浏览器验收最多并发 2 个进程，避免 8 秒完整校验的环境竞争；源码冻结后再取证。main 已推送 origin；远端 CI 结果未核实，当前任务不包含部署。

2026-10-25 用户要求继续所有非真机工作；物理设备任务暂不执行。`project/nonphysical-work.json` 跟踪本轮交付；`src/modules/tower-defense.ts` / `19-Tower-Defense-V0.1.md` 为共享塔防与合成所有权合同。G05/G21/H01 revision 2 与旧报告分开；`project/rule-variants.json` 的 37 份作者变体通过 `variants:e2e` 取证，不计独立 G3，修改后须重置 `variantsRun.status`。播放器目录选择仅从已校验目录加载，资源继续完整准入。`scripts/http-generator.mjs` 是宿主配置的可选 HTTP 传输，不执行模型给出的 URL；真实生成器未配置不能伪造 G3。main 已推送至 origin（https://github.com/oahc09/a2game）；远端 CI 结果尚未核实。

2026-10-26 用户要求按逐款完整 DoD 补齐。`project/gameplay-acceptance.json` / `docs/gameplay-acceptance.md` 为 37 款逐项合同与实际缺口；`npm run gameplay:check` 当前生成 190 场景的独立回执（185 基础 + 5 必要补充）。`perGameRun` 参考 PASS 需要当前 Headless、基础/变体双 SDK、边界和画面证据；禁止由作者变体推升 verified/G3。G11/G18 键盘 hold 为显式兼容增量，见 07/13 号规范。

逐款 G2 使用完整 Schema 后的 SHA 内置目录；`content:e2e` 继续独立覆盖动态未入目录 JSON、资源和持久化重启。`scripts/gameplay-presentation.mjs` 仅用于作者生成布局，禁止在 Adapter 依游戏 ID 分支。

2026-10-27 G13/H03 基础 revision 3、作者变体 revision 2：可选 `laneCenters` 固定车道与 `projectileHalfSize` 兼容增量见 13 号规范；滚动波次、检查点、碰撞判负及 H03 击退要求均在共享模块和 GameSpec 中。G06 基础/镜像 revision 2 补齐二维四向射线。`project/runner-work.json` 跟踪本批；CDP 双指属于虚拟 DOM 输入，不能计真机。旧 G13/H03/G06 报告保留，不作为当前定义的证据。

G23/H02 第二批联动由 `project/gameplay-linkage-work.json` 跟踪；基础 revision 3、作者变体 revision 2。G23 成功合成在 T8 解锁工厂、原子替换槽数组；H02 T8 升级映射到现有 `damageBonusPath`，T5 攻击从下一 Tick 消费。不得用规则写数组内部索引，或把 HUD 的 template 放入 scene2d 文本绑定。逐款脚本的可选 `hudIncludes` / `capture` 记录中间 HUD 与画面，仍不计完整人工质量/G3。

G09/G12 第三批由 `project/falling-flappy-work.json` 跟踪。`src/modules/puzzle.ts` 的 falling-piece 在锁定事务中检查下一块出生碰撞，不能让后续输入救出顶出；必要回归在 `test/puzzle-library.test.mjs`。G09 基础/变体 revision 3 为连续四格拼块；G12 基础 revision 3、变体 revision 2 用现有 target 门柱及门后 pickup，角色/门柱 value 必须为 0，避免死亡误加分。所有逻辑仍在共享 Runtime，完整质量/G3/真机单独验收。

G11/G24 第五批由 `project/jump-turn-work.json` 跟踪。`platformLanding:true` 才停止横向漂移并附加实际支撑/落点事件；连击由 GameSpec 规则维护，旧整数世界保持原行为。G24 用已有 stopped 作为中立 Outcome，禁止新增 draw GameStatus；类型、完整 Schema、语义及规范 01/03/14/18 同步。`additionalScenarios` 复用 Headless/双 SDK 验收；治理按合同精确核对场景数、名称、Hash、终局拒绝及截图，不得删除旧五类基础场景。

重新生成逐款定义时依次运行 `build-game-candidates.mjs` → `build-rule-variants.mjs` → `build-gameplay-acceptance.mjs`；最后一步补入必需附加 Conformance，治理会拒绝漏掉这些场景的目录。

2026-10-27 必需玩法缺口目标为 0；`project/zero-gap-work.json` 跟踪三批收口。G15/G28 使用 `src/modules/rigid3d.ts` 与 20 号规范，锁定 cannon-es 0.20.0 的浏览器/Node 双入口 SHA；四子步、完整整数运动状态、世界逐 Tick 释放，Adapter 只消费通用 Stage。参考支持数量为 127 份 Manifest；未声明平台的浮点精确一致性不自动推定。物理设备继续暂缓，完整 verified 与独立 G3 保持单独验收。

2026-10-27 清零第二批：`scripts/full-gameplay-levels.mjs` 为可信作者关卡组合，`project/full-2048-traces.json` 为标准开局的作者搜索动作，不计独立 G3。显式 stalledPath/overflowY+overflowTicks/trajectoryPreview 为兼容增量；无配置的旧 JSON 保持旧状态。G22 显式选择 Trace 录制后保存/重载恢复；H05 两份 CC0 PNG 经宿主 SHA 准入，图像方向/透明由纯表现 Adapter 处理。必需玩法剩余 8 款输入合同继续取证，真机仍暂缓。

2026-10-27 清零第三批参考交付：必需玩法缺口为 0，正式 verified 仍 0/32、0/5。`project/input-gameplay-profiles.json` / `scripts/input-gameplay-browser.mjs` 跟踪 8 款基础/变体的 32 个桌面/CDP/合成输入流程；不得计为真机。显式 trackSample 与 clearLostImu 配套，校准/不可用/重置清除旧施力或瞄准；MobileHost.poll 沿唯一 Tick 在 60 Tick 无样本时注入可回放 reset。cancelClearsPower 显式开启才改变旧取消状态。Runtime.dispose 释放输入/按键/IMU/事件缓存。当前 193 Headless、101 Node、203 Conformance、360 Schema 文档及全部 12 组浏览器回执通过。人工质量、独立 G3、适用物理验收继续单独跟踪。

2026-10-27 P0 质量：`scripts/player-quality.mjs` 复用逐款基础/变体流程检查中文按钮、44px 目标、1100/390/320 布局、显式传感器/录制与结果反馈；`scripts/runner-quality.mjs` 独立使用正式时钟和实际键盘验证 G13/H03 暂停/重开。`project/quality-work.json`、`docs/quality-review.md`、status.qualityRun 跟踪 AI 审查；人工质量仍 NOT_RUN，不得升级正式 verified/G3/物理分子。手动 resize 绘制须等原生 SDK 布局完成，dispose 取消待执行绘制；不可吞掉 SDK 异常或篡改锁定 SDK。

2026-10-27 P2：`npm run acceptance:build/check/ready` 归档现有参考证据、只读审计和检查正式登记前提。`project/acceptance-baseline.json` 冻结 32+5 和 10 款设备要求；`project/final-acceptance.json` 指向独立 reports 档案。37 packet + 74 CoverageResult 完整 Schema，正式均 NOT_RUN。`scripts/final-acceptance-audit.mjs` 不依赖 dist；当前源码、Conformance/证据摘要或 SDK/P0 指针变化须重建。归档状态 PASS 与完整验收 PARTIAL 分开，禁止把作者变体、AI 审查、供应者自报或夹具提升为人工/G3/设备通过；ready 当前按预期非零。未来外部证据接入与正式升级仍待实施，冻结 Registry 不由此工具改写。

2026-10-27 当前优先 37 款独立 G3：`project/g3-tasks.json` / `docs/independent-g3.md`。`g3:plan` 只生成自然语言任务；`g3:run -- <本机配置> [--ids=G01,H03]` 复用完整准入/修复，按显式 maxTasks/maxCalls 有界调用，再由 `g3-browser.mjs` 顺序跑真实双 SDK 任意解法及正反例。`model-generator.mjs` 仅转换宿主配置的 Chat Completions API，密钥只读显式环境变量，配置放 Git 忽略的 `.a2game/`。`g3:fixture` 为本机合成响应工程证据，不计真实模型。来源、玩法语义、质量和适用真机仍须外部签收，engineeringPassed 与 independentG3Passed 分开，当前无正式签收入口，独立 G3 0/37；不得把模型自报、能力声明或无价格的用量记录当正式 PASS/零费用。

2026-10-27 用户指定直接使用当前 Codex CLI。`npm run g3:codex -- .a2game/codex-generator.json [--ids=G01,H03]`：宿主指定已安装可执行文件，继承正常认证和模型路由，不读取认证文件、不传 model 覆盖。`codex-generator.mjs` 在仓库外新临时目录生成，ephemeral/read-only/关闭 shell，工具事件拒绝，保留请求/原始输出/CLI SHA/线程/Token。公共 HostProfile 只补充协议输入源/观察路径/按钮边沿，不提供仓库作者 GameSpec 或解法。CLI 生成单独有界（默认 5 分钟、最多 10 分钟）；生成后原流程仅消费宿主记录的原始输出，保留完整校验与旧进程 60 秒限制。每批每款最多 3 次，跨批重复须显式统计；失败和接入试跑不得隐藏，不把某批第一次当整项从未修复的 one-shot。

2026-10-28：当前 CLI 已实际执行全部 37 款，33 款工程参考通过，G02/G11/G24/G26 保留失败；正式 G3 仍 0/37。`project/independent-g3-run.json` 指向不可变汇总，`node scripts/g3-codex-report.mjs --check` 只读校验 SHA 依赖图、源码与计数。108 次生成调用含试跑/宿主中止/跨批修复，另有 1 次探测，缺失用量和价格不可视为零。原生版本 3 的选定定义 SHA、源码前后摘要与 25 款/50 双 SDK 键盘按钮流程独立留证，8 款 Touch/IMU/模拟量仍待验。`g3-revalidate.mjs`/`g3-browser-retry.mjs` 环境复测不隐藏旧失败；`g3-followup.mjs` 的表现修复须保持玩法、输入、状态、规则、测试与解法不变，不手改模型结果。

2026-10-28 顺序收口修复阶段：37/37 工程参考，累计 115 次生成调用，正式 G3 仍 0。G02 使用宿主 `solve-grid-playthrough.mjs` 在该模型自己的 JSON 上搜索；`a2game-referenced-generation-output@1` 只允许请求中批准的 SHA，`bind-agent-evidence.mjs` 物化标准 JSON，明确标记宿主辅助而非模型自解。32 行解法/2,048 项正例遵守旧预算；实时 Host 重标时间导致的早期 Hash 失败不覆盖。`project/g3-completion-work.json` 跟踪余下输入/AI 质量、CI/证据恢复，真机和人工批准另验。111 Node / 203 Conformance / 360 Schema、Node 22 6/6 及归档通过；25 款原生输入后还需补原 8 款和新四款版本，不能沿用旧定义证据。历史生成器源码已归档，恢复证据后不应依赖本地不可达提交。

2026-10-28 非真机独立参考收口：37工程/37浏览器主输入/37逐款AI参考审查，31桌面来源＋6CDP/合成；正式G3仍0/37。累计168次生成＋1探测，本轮53次，旧失败/缺失用量保留。35份presentation-only不变量由g3-presentation-invariants.mjs核对；G32正常抬指保留已完成机关，取消仅清未完成保持，原始指针ABI正反例留证。G07只对所选牌显示身份，不能直接画原始board泄露牌面。g3-input-profiles.json中G29/H04/G31为宿主主输入验收映射，不计独立模型解法或真机；g3-source-input.mjs每32款轮换独立临时服务，不抬高内容容量，按住触点时截图不得改变视口。当前索引和审查以project/status.json及project/independent-g3-run.json为准。CI/便携证据恢复继续单独验证，不公开私有报告。

2026-10-28 用户确认远端CI旧启动失败源于额度超出，要求减少执行次数。compatibility工作流仅手动触发，默认Ubuntu/Node22一个core；full_matrix才执行原四组合，real_sdk等待core且不重复verify；同分支取消旧运行、产物3天。日常本地全量验证；不要为取远端回执自动触发消耗额度。npm test限定两个文件并发以避免完整Schema校验8秒上限的环境争用，不得因此提高超时或跳过测试。证据恢复见docs/evidence-restoration.md；未配置可信远端包地址不能声称远端CI已通过。
