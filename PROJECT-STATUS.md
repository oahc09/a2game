# A2Game 当前实施状态（1.0.0 工作区）

2026-10-31：GEN-8 本机交接参考通过：CLI 帮助补列现有 `claude` Provider，新增 [CLI/MCP/Skill 交接说明](docs/generator-handoff.md)；隔离安装命令、独立源码副本、MCP 双客户端/双 SDK 和 Skill 打包均通过，新增模型调用 0。完整回归 159 Node、360 Schema、203 Conformance 通过；Skill 新会话自动触发、独立宿主和真实模型复测仍待验。

2026-10-31：参考 H01 基础关卡和作者变体的动态数字在 320px 下经两个真实 SDK 复验，4/4 数字约 17.88 CSS px、槽位不遮挡，旧版/新版状态 Hash 一致且资源释放通过。[回执](reports/h01-narrow-6a2013e1-952e-4bcf-b6c1-42b95a53119e/summary.json)不代表人工视觉验收。37 款共 193 个 Headless 场景、148 个双 SDK 实例及 148 份参考 CoverageResult 已刷新；完整回归 159 Node、360 Schema、203 Conformance 通过。完整视觉、模型重测、人工、真机和远端 CI 仍待独立确认。

2026-10-31 H01 窄屏调整：基础及作者变体的 320/390px 文案字号已提升；双 SDK 胜负、边界、重开、释放和修改前状态 Hash 对照通过。37 款基础及作者变体的 148 个双 SDK 参考实例与 148 份 CoverageResult 已复验并刷新索引；动态炮台和敌人数值仍偏小，视觉质量继续 PARTIAL。完整回归 157 Node、360 Schema、203 Conformance 通过，详见 [H01 记录](docs/generator-h01-repair.md) 和 [日志](reports/verify-2026-10-31T11-20-30-017Z-29216/verify.log)。

2026-10-31 当前源码复验：37 款基础及作者变体共 148 个双 SDK 参考实例、148 份 CoverageResult Schema 和 G13/H03 正式时钟 4/4 已通过；完整回归为 157 Node、360 Schema 文档、203 Conformance。参考 H01 的 320px 画布文字仍过小，完整视觉质量继续 PARTIAL。MCP 真实 Provider 历史调用与项目级 Skill 宿主练习已有回执，但返回模型身份和 Skill 新会话自动触发待验；未追加模型调用。详见 [Generator 台账](project/generator-status.json) 和 [H01 记录](docs/generator-h01-repair.md)。

2026-10-31 H01 本地修复：模型第四次原稿仍 FAIL；保留游戏与解法，仅在独立副本补两条终局输入预期错误后，完整准入、4/4 Conformance 和双 SDK 桌面/390px 4/4 输入/Hash/重开/释放参考通过。生成请求及同类错误反馈已补终局合同，普通生成提示补可读性要求；Player 已读取 HUD 按钮文字和进度绑定，窄屏隐藏覆盖标题的角标。新增模型调用 0，真实模型改善效果未验；视觉质量仍为 PARTIAL，正式 G3、人工、真机和 CI 不升级。播放器变更后基础和变体双 SDK 参考回执已重验；完整视觉质量及正式验收仍待复核。见 [H01 修复说明](docs/generator-h01-repair.md)。

2026-10-31 顺序推进结果：Batch A/B/C保留工程参考交付；Batch D的5任务×2模式已真实执行10/10，30/30调用含1次宿主中止，29份完整回复，最终9/10通过完整准入、双SDK回放与36路来源输入。H01规划模式仍失败；直接模式原始输出经宿主组合误判修正后原样复验通过，G17规划模式已修复方向键与窄屏字号，实际画面仍有对比度不足；严格产品/人工验收不计通过。MCP新增9个受限stdio工具，官方SDK与独立Python客户端、CLI同JSON/Hash、真实双SDK输入/重开/释放通过；Skill已打包，真实Agent宿主安装/执行及MCP真实Provider待验。完整回归143 Node、360 Schema、203 Conformance及新源码MCP/两模式/包复验通过。MCP依赖独立锁定，根Runtime锁原字节恢复；旧证据不改写。正式G3 0/37、Verified 0/32+0/5、真机/人工/远端CI不升级，未提交/推送。见[实际结果](docs/generator-real-findings.md)、[MCP/Skill说明](docs/generator-mcp.md)、[台账](project/generator-status.json)。

2026-10-30 按顺序完成 Batch B/C 工程参考：能力检索、内部GamePlan、两模式有界修复；Loopback Studio的生成/取消/双SDK/状态/导出导入；单文件受控内容包在独立源码宿主原样复验。最终137 Node、360 Schema、203 Conformance通过；Studio桌面/390px双SDK4/4、独立宿主2/2、最终干净源码两模式/包/矩阵准备与新浏览器worker桥接通过。一次smoke汇总漏返回stdout导致的失败已保留并修复。内容包仍需兼容宿主/SDK/审核资源，不嵌入Runtime或资源二进制。Batch D已冻结5任务×2模式和入口，真实矩阵0/10，因新预算0为BLOCKED；GEN-8最终交接未完成。新增真实调用0，正式G3/人工/真机/远端CI不升级，未提交/推送。见 [Studio说明](docs/generator-studio.md)、[Benchmark说明](docs/generator-benchmark.md) 和 [Generator台账](project/generator-status.json)。

2026-10-30 Batch B 工程参考完成：公开能力检索/精确依赖闭包、内部 GamePlan v1 完整 Schema、direct-json/game-plan 两路径、规划引用/组件一致性、有界分类修复及 Headless 生命周期回执。133 Node、360 Schema、203 Conformance、两模式双 SDK 桌面/390px 共8/8与两模式干净源码smoke通过，旧报告恢复。默认规划仅为宿主关键词草案，真实模型两模式/完整玩法语义仍 NOT_RUN；新增真实调用0，不升级正式G3/人工/真机。按用户顺序要求进入 Batch C，见 [Batch B](docs/generator-batch-b.md) 和 [Generator 台账](project/generator-status.json)。

2026-10-30 窄屏视觉优化完成：为“双灯之锁”创建明确标记的宿主表现副本（revision 2），原始 Terra JSON/评分保持不变。360×420 紧凑画布、最小设计字号26、中文机会HUD和按钮对应说明；390px画布最小字约9.4→23.2 CSS px，320×568约16.9px。两真实 SDK、320/390/桌面6/6输入/胜负/重开/释放、原版/新版 Hash及3项正反例完全一致；普通CLI validate/test、原样Skill客户端两端通关、127 Node/360 Schema/203 Conformance与最终源码smoke均通过。新增模型调用0，真机/人工/正式G3不升级。当前窄屏条目为宿主副本AI参考通过，见 [优化说明](docs/gen2-narrow-visual.md) 与 [Generator 台账](project/generator-status.json)。

2026-10-30 GEN-2 真实模型工程验收通过：按用户指定以原生子 Agent 运行 gpt-6.1-terra / medium，新生成“双灯之锁”，3 次生成、2 次格式修复，非 one-shot，无宿主补解。完整准入、3/3 Conformance、模型自拟 3 步双 Session 解法、双 SDK 回放与 4/4 桌面/窄屏源输入、胜负 Hash/重开/释放通过。新增原生上下文构建与 SHA 绑定导入入口，修复 root envelope/solution 类型说明歧义。完整回归 127 Node、360 Schema、203 Conformance 及最终源码 smoke 通过，旧报告恢复。身份限定为实际宿主请求路由，服务端构建/用量/费用未导出；窄屏小字和英文 HUD 使视觉质量为 PARTIAL，人工/真机/正式 G3 不升级。Batch A 工程为 PASS_REFERENCE，Batch B 尚未开始；本轮预算 3 次已用尽。见 [GEN-2 记录](docs/gen2-native-acceptance.md) 与 [Generator 台账](project/generator-status.json)。

2026-10-30 Generator Batch A 继续收口：新增 `npm run generator:browser`，新建 fixture 通过公开预览入口在真实 Three.js/CocosAirJS、桌面/390px 窄屏完成 4/4 输入、Headless Hash、未达目标/通关、暂停/重开、零 ownedResources 和监听关闭；12 张截图及 SDK 版本/SHA、来源指纹分别留证。最终源码 smoke 与完整回归通过（125 Node、360 Schema、203 Conformance），旧报告恢复；正式 G3、人工/真机不升级。一次运行因验证期间脚本变更被指纹检查拒绝，失败材料保留，最终定稿运行通过。真实调用 0；安装后 `a2game` 命令已通过独立前缀安装、帮助/版本、生成与校验，依赖锁不变；最终源码重新通过干净安装 smoke。GEN-1 为 PASS_REFERENCE，GEN-2 的真实 Provider 验收受预算 0 阻塞，Batch A 保持 PARTIAL，未进入 Batch B。见 [Generator 台账](project/generator-status.json)。

2026-10-29 Generator Batch A 已实现统一 API/CLI、Provider 本地探测与有界 worker；最终源码独立安装、构建、fixture 生成→完整准入→测试 `PASS_LOCAL`，无旧报告和 Renderer SDK，指纹一致。本轮完整回归通过：125 Node、203 Conformance、360 Schema，旧回执恢复。GEN-1 工程 `PARTIAL`、实际浏览器渲染 `NOT_RUN`；GEN-2 适配已实现、真实 E2E 因预算 0 为 `BLOCKED`。Batch A 保持 `PARTIAL`，未进入下一批，见 [上手说明](generator/README.md)、[独立状态](project/generator-status.json) 与 [基线](project/generator-baseline.json)。正式 G3、人工质量、真机和远端 CI 不升级。

2026-10-29 协议资产目录分层：`samples/` 中 362 份 JSON 按能力、适配器、游戏、执行测试、登记和格式示例分离，原始字节、ID 与版本不变；运行时/浏览器加载、校验、生成器和文档使用新路径。新增 127 项可信绑定/依赖/测试来源索引，明确规范编号与实际可执行用例的区别。旧报告按严格可逆路径映射核验，不将算法变化当迁移，不升级完整 verified/G3/人工/真机；见 [迁移说明](docs/spec-layout.md)。

2026-10-28 两轮原生子 Agent 反馈改进：统一 `native-delivery-v2` 和 canonical context，新增原始载荷/宿主导出捕获、不可覆盖检查、准备时源码快照、空回复记账及 INFRA 独立归因；任意已验证产物可经 `g3:subagent:input` 复用实际浏览器主输入验证。两批 G01 第三次原始输出已补实际键盘与双 SDK，共 4/4 PASS_REFERENCE，Node/Host Hash、重开和 ownedResources=0 通过；本轮新增生成调用 0。来源/隔离原始导出、手机画面和 Cocos 字形仍待补，正式 G3 与 verified 不变。新回执仅本地保存，未并入旧便携包；旧报告不覆盖，说明见 [运行改进](docs/g3-native-improvements.md)。

2026-10-28 仓库历史瘦身：应用户确认，`git filter-repo` 从本地全部历史剥离 `reports/`（`.git` 13 GiB → 8 MB），历史提交 SHA 全部改变（main tip `178f30fe`）；原完整历史（含 `97d56daf` 与全部报告 blob）保留于已校验的 `output/a2game-full-history-20261028.bundle`，未提交改动经 SHA256 校验还原，工作区 `reports/` 证据与验收计数不变。`archive/local-history-20261028` 分支已由 bundle 取代后删除；这变更了此前「保留归档分支、不使用 force push」的交付方式。远端 origin/main 已经用户明确批准强推，远端 tip `178f30fe` 与本地一致；旧 `sourceCommit` 引用经 bundle 可找回。

2026-10-28 按四款修复与剩余8款输入任务复查：当前G3索引的3,332文件SHA和源码审计通过，G02/G11/G24/G26均为PASS_REFERENCE；G25/G26/G27/G29/G30/G31/G32/H04的浏览器主输入均通过，37份当前定义SHA逐一匹配语义/画面AI参考审查。纠正遗留的 `g3CompletionRun.qualityReviewStatus: IN_PROGRESS` 为 `AI_REFERENCE_REVIEWED`，不修改旧报告或重复生成。G02保留宿主求解辅助标记；低对比提示字影、难度、持续游玩和完整人工质量仍是已注明限制，正式G3仍0/37，真机继续暂缓。

2026-10-28 新增 [G3 子 Agent 编排设计](docs/g3-agent-orchestration.md) 与 [多模型/技能反馈规范](docs/g3-model-evaluation.md)：其他AI调度指定模型的原生子Agent或模型服务，本会话逐款审查；调度/生成/审查模型分别留证，任务、上下文、技能版本、辅助条件和预算分别绑定。目标含Qwen、MiniMax、GLM、DeepSeek，尚无精确版本与服务兼容实测；统一上下文导出、原生导入、聚合及自动回传待实施。状态 `DESIGN_ONLY`、新增预算0，现有37款参考状态、168次历史Codex生成及正式计数不变。

2026-10-28 输入与逐款 AI 参考审查已收口：**37/37 工程、37/37 浏览器主输入、37/37 AI 参考审查**；其中 31 款为真实桌面鼠标/键盘来源，6 款包含明确标记的 CDP/合成传感器，不能算真机。74 份当前定义/双 SDK 主输入回执核对 Hash、重开和零资源释放；G31 按钮回退另存回执。35 份 presentation-only 修复通过玩法/输入/状态/正反例/解法不变量审计，G32 的正常松手/取消计时规则由 CLI 单独修复；G07 的牌面泄露也已由生成器修复。累计 **168 次生成＋1 次探测**，本轮追加53次，旧失败与缺失用量保留。3,332文件归档 SHA 核对通过；[当前索引](project/independent-g3-run.json)、[逐款审查](project/independent-g3-review.json)。**正式 G3 仍0/37、verified仍0/32＋0/5**，难度、持续游玩和完整人工作品质量另验。

证据恢复工具已实现 SHA 锁定、依赖收集、只恢复 reports/、冲突拒绝和重复恢复，相关测试通过；完整源码检出恢复已通过Node22全量验证与G3/P2审计，证据包尚未远端托管。远端 CI `40651288303` 的四个任务均在执行步骤前失败，日志返回 `BlobNotFound`；2026-10-28 用户确认原因为额度超出。Actions 已改为仅手动触发、默认一个 Ubuntu / Node 22 完整任务；原四组合和真实 SDK 按需选择，同分支取消旧运行，产物保留 3 天，不自动重试消耗额度。详见 [证据恢复及额度控制](docs/evidence-restoration.md)。

2026-10-28 顺序收口：`project/g3-completion-work.json` 跟踪独立生成修复 → 输入/逐款 AI 质量 → CI/证据恢复。四款修复后 **37/37 工程参考通过**，[新汇总](reports/g3-codex-review-2026-10-28T09-13-42-309Z-50808/summary.json)。累计 115 次生成调用、1 次探测；G02 的独立模型原 JSON 不变，显式使用宿主公共 Runtime 搜索反馈与 SHA 字面量引用，不能计模型自解。1,021 次滑动封装为 32 行解法，正例 2,048 项，原上限未提高。原始失败、来源与物化标准 JSON 分别留证。桌面输入暂为 25 款，另需补原 8 款及本轮新通过版本的输入；正式 G3/verified 不变。

2026-10-28 仓库维护：保留 `713e9d9f` 将 `reports/` 移出 Git 的决定；本地验收证据、私有发布数据、SDK 和依赖保留。已清理完成验收的临时目录与日志，Git 已打包的重复松散对象使用原生命令处理；详见 `project/status.json` 的 `repositoryMaintenanceRun` 与 [维护说明](docs/repository-maintenance.md)。源码、玩法与正式验收计数未变。按用户选择，超限旧历史保留于本地 `archive/local-history-20261028`，`main` 使用以远端原基线为父提交的源码快照 `b42ccf27`，正常快进交付，不使用 force push。

本次修复阶段 **111/111 Node、203/203 Conformance、360 份 Schema 文档通过**，[工程日志](reports/verify-2026-10-28T09-14-51-691Z-38868/verify.log)；[Node 22 相关 6/6](reports/g3-completion-phase1-node22.log)、[1,734 文件归档核对](reports/g3-completion-phase1-archive-check.log)与[两 SDK 共 8 次技能客户端控件探测](reports/g3-completion-skill-2026-10-28T09-20-53-553Z/summary.json)通过。控件探测只覆盖短操作；截图发现的 G02 裁切、G11 小字和 G24 结束反馈纳入下一阶段，不计完整质量通过。

## 独立 G3 首轮阶段记录（33/37 工程参考，已由上方本轮状态接续）

按用户指定直接使用现有 `codex-cli 0.159.2`，沿用当前认证和默认模型。37 款均已实际生成，**33/37 工程参考通过**完整准入、有界正反例、通关解法和真实 Three.js/CocosAirJS 回放。G02 输出合同不完整；G11、G24、G26 正反例失败，保留原始输出及诊断。原始生成调用共 108 次（含 3 次失败试跑与 2 次宿主主动中止），另有 1 次连通探测；费用未知，缺失的用量不按零统计。

G01/G05 的画面由生成器单独修复，额外强制核对玩法、输入、规则、状态、测试和解法保持一致；未直接修改模型输出。G12/H03 的完整校验超时、H01/G21 的本地 HTTP 503 均另存复测记录，不隐藏原始失败，也不把基础设施问题计为模型能力结论。最新选定版本、原生输入、截图观察与完整 SHA 依赖图见 [独立生成索引](project/independent-g3-run.json) 和 [接入/复测说明](docs/independent-g3.md)。

各轮公共宿主上下文与反馈不同，33/37 不是统一提示的一次成功率。正式 **独立 G3 仍 0/37，verified 仍 0/32＋0/5**；玩法语义、难度、持续游玩、来源签收、人工质量和适用物理验收继续独立。Runtime、播放器、Schema、Manifest 未变，既有 12 组参考证据继续只读复核。

选定版本的原生桌面复核 **25 款、50/50 双 SDK 流程通过**：实际键盘/按钮及按住/释放 → 原生宿主输入 → Node Trace/Host Hash、重开、零资源释放。另 8 款解法含 Touch/IMU/模拟量，保持 NOT_RUN；4 款生成失败亦不计入原生通过。版本 3 绑定每款定义 SHA，保存自身源码且前后摘要一致，[原生回执](reports/g3-native-2026-10-27T16-35-57-549Z-26772/summary.json)。这 25 款不等于正式 G3 通过。

本阶段工程 **106/106 Node、203/203 Conformance、360 份 Schema 文档通过**，[完整日志](reports/verify-2026-10-27T16-41-24-803Z-32064/verify.log)；[Node 22 相关回归 5/5](reports/g3-node22-final-20261028.log)、[P2 原档案只读复查](reports/g3-p2-audit-20261028.log)通过。独立生成归档 1,576 个文件的 SHA 与当前源码已只读核对通过。

### CLI 接入阶段记录（2026-10-27）

用户现已指定直接使用本机 Codex CLI。`codex-cli 0.159.2` 沿现有认证及默认模型成功完成连通测试，新增隔离 CLI Profile，真实 G01 接入试跑保留 3 次失败输出（输入 source / 观察路径）。已补充公共 HostProfile 的输入源映射、`/flow/status`、按钮边沿与宿主范围，继续真实生成及修复；不提供现有关卡/解法。CLI 生成与原有 60 秒准入阶段分开，运行记录见 `project/status.json`，正式 G3 尚未提升。

CLI 接入阶段已完成：**106 Node / 203 Conformance / 360 Schema 文档 PASS**；G01 在补充宿主合同后的批次首次通过完整准入、正反例、解法、真实双 SDK Hash/暂停/重开/释放。[实跑回执](reports/g3-codex-2026-10-27T14-28-31-578Z-20456/summary.json)。AI 查看四张截图发现棋盘越界与字体问题，已记入 [独立变体质量记录](project/independent-g3-review.json)，正式 G3 不提升。其余 36 款已分两批运行，最多两个浏览器进程；跨批调用和失败均保留。

上下文升级与原生输入阶段：前 8 款工程通过结果（G01/G03/G04/G06/G07/G09/G22/G23）均通过实际键盘/按钮的双 SDK 流程，**16/16 原生输入回执通过**，[实测](reports/g3-native-2026-10-27T15-07-29-752Z-50384/summary.json)。宽泛 stateSchema 导致的初态字段缺失已通过公开可信库 ABI 补入 HostProfile v2；保留旧试跑 49 次调用及两个主动中止的记录，剩余 20 款按新上下文继续，G28 已新增工程通过。不同上下文分别统计，原始游戏/输出不手改，正式 G3 仍为 NOT_RUN。

已准备 32＋5 份独立自然语言变体任务，新增 Chat Completions API 适配、显式任务/调用预算和逐款检查点。通用浏览器入口覆盖任意长度获胜解法、完整有界正反例、Node/Host Hash、初始/通关画面、暂停/重开及释放；[五步双 SDK 工程夹具](reports/g3-fixture-2026-10-27T14-04-09-132Z-32648/summary.json)通过，不计独立模型。未修改 Runtime、播放器、GameSpec 或已有 SDK 证据。当前已选用本机 Codex CLI，正式 **独立 G3 0/37、verified 0/32＋0/5**；质量、来源及适用真机仍分开验收。配置与服务要求见 [接入说明](docs/independent-g3.md)。

工程 **105 Node / 203 Conformance / 360 Schema 文档 PASS**，[验证日志](reports/verify-2026-10-27T14-05-35-694Z-47232/verify.log)；新增 3 项在 Node 22 亦通过。实际批处理以 `A2G_E_G3_FIXTURE` 拒绝夹具，1 次调用、0 个独立通过，见 [拒绝回执](reports/g3-batch-2026-10-27T14-07-29-119Z-46000/summary.json)。原 P2 档案只读复查通过，无需重跑未变化的 12 组 SDK 参考证据。

## P2 正式验收档案（2026-10-27，归档通过，正式验收待外部证据）

已归档 **37 份逐款档案、74 份分 SDK 的正式 NOT_RUN 回执**，完整 CoverageResult Schema 通过。来源摘要、当前源码/回执、冻结身份与适用设备要求、读路径和正式计数检查通过；自洽摘要的伪造 PASS 仍被拒绝。工程 **102 Node / 203 Conformance / 360 Schema 文档 PASS**，[日志](reports/verify-2026-10-27T13-00-31-812Z-11208/verify.log)。本轮复用原范围内的真实 SDK 证据，未修改 Runtime、播放器或 GameSpec。37 款人工确认、37 款独立 G3 与 10 款真机证据仍待验，登记门禁按预期返回 A2G_E_ACCEPTANCE_NOT_READY；正式 verified 保持 **0/32、0/5**。见 [P2 流程](docs/final-acceptance.md)、[逐款档案目录](reports/acceptance-2026-10-27T13-10-03-797Z-14948/README.md)。

## P0 质量验收（2026-10-27，AI 实测通过，人工确认待验）

37 款的基础/变体双 SDK 148 实例通过，其中基础关卡 222 个桌面/390px/320px 布局检查；已实际查看两套 SDK 的初始/通关画面。G13/H03 正式时钟键盘、暂停冻结、恢复和重开 4 流程通过。中文按钮/反馈、邻近操作区、显式传感器/录制、可折叠诊断、缩放及 resize 时序已修正。101 Node / 203 Conformance / 360 Schema 文档、12 组当前浏览器回执通过。见 [质量回执](reports/quality-review-2026-10-27T11-59-56-311Z.json)、[本轮清单](docs/quality-review.md)。完整人工质量、独立 G3 与适用真机保持待验，正式 verified 仍 0/32、0/5。

## 必需玩法缺口清零目标（2026-10-27，参考达成）

**必需玩法缺口 17 → 0 款。** 三批分别补真实三维刚体、7 款完整玩法/存档/资源、8 款原始输入与回退。当前 **101 Node、203 Conformance、193 逐款逻辑场景、148 基础/变体双 SDK 实例、32 个逐款原始输入流程**，7 种 Schema / 360 文档及 12 组当前浏览器回执通过。[交付证据](project/zero-gap-work.json)、[工程日志](reports/verify-2026-10-27T06-52-11-692Z-12540/verify.log)。人工完整质量、独立 G3 和适用真机保持独立 Gate，正式 verified 仍为 **0/32、0/5**。

## G11 连续跳跃与 G24 终局第五批（2026-10-27，参考验收通过）

- G11 基础 revision 3、远距变体 revision 2：连续三平台，中心落地形成连击并加分，偏心落地清零连击、保留最佳连击，过度蓄力落空失败。显式 `platformLanding` 才停止横向漂移并附加实际支撑/落点事件，旧整数世界语义保持。
- G24 基础/四连变体 revision 3：横竖双斜、满盘和棋、中立 `stopped` 及终局拒绝。只扩展 Outcome 允许已有 stopped，GameStatus 集合保持；类型、Schema、语义、宿主表现及 01/03/14/18 号规范同步。
- 新增 5 个必要场景，逐款 Headless 共 190 个；148 个真实双 SDK 基础/变体实例、全部附加场景、12 组当前浏览器回执及 148 份 CoverageResult 完整 Schema 通过。Node 22/24 选定合同各 55/55。[本批证据](project/jump-turn-work.json)、[浏览器索引](reports/nonphysical-current-refresh-2026-10-27T03-46-17-424Z.json)。
- 已查看实际键盘跳跃、中心/偏心 HUD、和棋中立状态、竖线/斜线与作者变体画面。[AI 参考检查](reports/jump-turn-visual-review-2026-10-27T03-43-47-728Z.json)。必需玩法缺口由 19 降至 17 款；完整人工质量、独立 G3、适用真机仍单独待验，完整 verified 保持 **0/32、0/5**。
- 最终工程验证 **98/98 Node、200/200 Conformance、7 种 Schema / 359 文档 PASS**，[日志](reports/verify-2026-10-27T03-47-08-553Z-7824/verify.log)；本批本地提交，未推送。

## G13/H03 跑酷与 G06 穿插收口第四批（2026-10-27，参考验收通过）

- G13/H03 基础 revision 3、镜像变体 revision 2：固定三车道首尾钳制，三段滚动障碍、两个有序检查点；H03 同 Tick 双区输入经下一 Tick 请求消费，真实弹丸击敌、被障碍拦截及全部临时对象回收。唯一 Tick 的检查点中途暂停 5000 Tick 不推进滚动世界。
- G06 基础/镜像 revision 2：3×3 四向箭头，上方出界与下方阻挡、空格重选及逐格真实画布点选；作者变体镜像方向与解法。
- 185 个逐款逻辑场景、148 个真实双 SDK 基础/变体实例及 12 组当前浏览器参考验收通过；148 份 CoverageResult 完整 Schema 通过。Node 22/24 选定兼容合同各 55/55。[本批证据](project/runner-work.json)、[当前浏览器索引](reports/nonphysical-current-refresh-2026-10-27T03-01-35-377Z.json)。
- 已查看检查点/碰撞 HUD、两端实际弹丸、虚拟 DOM 双指通关与三款变体画面。[AI 参考画面检查](reports/runner-visual-review-2026-10-27T02-58-40-484Z.json)。弹丸显式半尺寸 64，默认 16 的旧 JSON 保持兼容；只新增一条必要 Node 回归。必需玩法缺口由 22 降至 19 款，完整人工质量、独立 G3 与适用真机继续单独待验，完整 verified 仍为 **0/32、0/5**。
- 最终工程验证 **97/97 Node、195/195 Conformance、7 种 Schema / 359 文档 PASS**，[日志](reports/verify-2026-10-27T03-02-32-967Z-13524/verify.log)；本批本地提交，未推送。

## 连续拼块与门柱碰撞第三批（2026-10-27，参考验收通过）

- G09 空棋盘连续四个 tetromino、重力锁定、旋转消行与即时顶出；基础/变体 revision 3。修复锁定后新块被占用却能被后续移动救出的时序缺陷。
- G12 上下门柱实际碰撞、门后计分及三道门变体；基础 revision 3、变体 revision 2。角色/门柱 value 为 0，只有通过触发线得分。
- 185 个逐款逻辑场景、148 个真实双 SDK 基础/变体实例及 12 组当前浏览器参考验收通过；148 份 CoverageResult 完整 Schema 通过。Node 22/24 选定兼容合同各 55/55。完整 verified 仍为 **0/32、0/5**；真机继续暂缓，完整人工质量及独立 G3 单独验收。
- 已查看实际按键、重力锁定、顶出、门柱/门后计分及初始变体画面。[本批证据](project/falling-flappy-work.json)、[AI 参考画面检查](reports/falling-flappy-visual-review-2026-10-26T23-37-50-636Z.json)。最终工程验证 **96/96 Node、195/195 Conformance、7 种 Schema / 359 文档 PASS**，[日志](reports/verify-2026-10-26T23-41-21-186Z-11144/verify.log)；本批本地提交，未推送。

## 逐款联动补齐第二批（2026-10-26，参考验收通过）

- G23 合成实际解锁工厂并提高收获产量，H02 三消奖励实际支付角色升级、影响下一 Tick 攻击伤害与 HUD。基础 revision 3、作者变体 revision 2；详情见 [逐款合同](docs/gameplay-acceptance.md)。
- 185 个逐款逻辑场景、148 个真实双 SDK 基础/变体实例、12 组当前浏览器参考验收通过；148 份 CoverageResult 完整 Schema 通过。Node 22/24 选定兼容合同各 55/55。只刷新受源码/目录指纹影响的回执，保留失败与中断记录。
- 已查看两端合成产量、升级同 Tick 旧伤害和下一 Tick 增伤、敌人移除、初始变体画面；收集按钮不再挤成两行，390px 检查覆盖全部动作按钮。[本批证据](project/gameplay-linkage-work.json)、[AI 参考画面检查](reports/gameplay-linkage-visual-review-2026-10-26T15-34-20-051Z.json)。
- 本批补齐 G23/H02 两项必需玩法联动；完整人工质量、独立 G3 仍待验，完整 verified 保持 **0/32、0/5**，真机继续暂缓。最终工程验证 **95/95 Node、195/195 Conformance、7 种 Schema / 359 文档 PASS**，[日志](reports/verify-2026-10-26T15-36-39-519Z-11012/verify.log)；本批本地提交，未推送。

## 逐款完整验收第一批（2026-10-26，参考批次通过）

- 全部 32+5 身份有各自的完成标准和关键边界；作者变体从 9 扩展至 37，目录共 112 JSON、126 Manifest。[逐款合同](docs/gameplay-acceptance.md)、[机器清单](project/gameplay-acceptance.json)。必需缺口与额外内容建议分开记录，后者不增设验收门槛。
- 185 个 Headless 场景检查基础/变体正反例、边界、暂停、快照、重开和逐操作 Hash 回放。[Headless 回执](reports/gameplay-2026-10-26T14-18-29-942Z-54696/summary.json)。
- 37 基础 + 37 变体，共 148 个真实 SDK 实例检查通过；基础另验逐款边界，全部检查 390px 布局、HUD、非空画面、失败后重试、Node/Host/跨引擎 Hash 和释放。[基础](reports/candidates-2026-10-26T14-19-32-356Z-41092/summary.json)、[变体](reports/variants-2026-10-26T14-20-12-514Z-43608/summary.json)。148 份有明确参考范围的 CoverageResult 已通过完整 Schema。
- 修复键盘/屏幕按钮持续按住、OR 来源去重、取消蓄力、暂停后停止移动，以及 AIR 画布焦点吞键。G18 可独立二维移动与瞄准/射击；对应 GameSpec 修订号已递增。
- 逐款画面检查修正标题重叠、四位数字挤压、空棋盘/放置区域/目标槽、角色配色、砖块形状、初始拼块和泡泡投影及 HUD。[AI 参考画面检查](reports/gameplay-visual-review-2026-10-26T14-25-50-346Z.json)；不替代完整人工质量与独立 G3。
- 当前 12 组源码冻结后的真实 SDK 参考回执已刷新，[证据索引](reports/nonphysical-current-refresh-2026-10-26T14-29-58-328Z.json)。完整 verified 仍为 **0/32、0/5**；逐款必需玩法缺口、人工完整质量、独立 G3 与适用真机单独待验，物理任务按用户要求暂缓。
- 完整工程验证 **95/95 Node、195/195 Conformance、7 种 Schema / 359 文档 PASS**，[日志](reports/verify-2026-10-26T14-36-02-941Z-63544/verify.log)。新增治理检查在模拟未生成 dist 的条件下通过，保持检出后可先执行 project:check。
- main 先前已推送至 origin 的 b910c16；本批新增改动验证后本地提交，未执行新推送或部署。远端 CI 结果尚未核实。

## 非真机主线补齐（2026-10-25，参考验收通过）

- G05 实际层叠遮挡；G21/H01 建塔、升级、波次、经济、合成实体和旧武器回收。新增 9 份作者编写的关卡/规则变体，独立于 G3。
- HTTP 生成器接入完成有界传输与拒绝回归；真实独立服务未提供，G3 保持 NOT_RUN。当前 84 JSON、126 Manifest；93 Node、139 Conformance、303 Schema 文档通过，[验证](reports/verify-2026-10-25T04-31-12-769Z-56140/verify.log)。所有受影响的真实双 SDK 证据已刷新，[候选](reports/candidates-2026-10-25T04-25-48-300Z-31432/summary.json)、[9 个变体](reports/variants-2026-10-25T04-26-44-000Z-63900/summary.json)、[证据索引](reports/nonphysical-current-refresh-2026-10-25T04-30-32-408Z.json)。
- 按用户要求跳过物理设备任务，继续其他实施；不推送、不部署。Node 22/24 选定合同各 55/55，[矩阵](reports/node-matrix-2026-10-25T04-24-36-847Z-47352/summary.json)。
- 播放器完整目录选择与链接直达已接通，资源仍经完整准入；G05/G21 增加真实浏览器 PointerEvent 命中验收。390px 窄屏、长按钮与玩法说明已检查；[首轮指纹失效归因](reports/nonphysical-source-iteration-2026-10-25T04-25-04-918Z.json) 保留。


## S11 初始兼容扩展工程交付（2026-10-25）

- 重放存档 v1/v2、可信精确版本迁移、未知版本拒绝；本机双席位权威回合 Host；显式启用的 Gamepad 按钮/双轴及键盘回退。[合同](specs/v0.1/docs/18-Compatibility-Extensions-V0.1.md)。
- 真实双 SDK 的同局状态/Hash、断开恢复、非法/越权拒绝、存档重放、虚拟手柄和释放通过，截图已检查。[扩展回执](reports/compat-2026-10-24T17-17-06-323Z-46128/summary.json)。
- 当前 88 Node、121 Conformance、284 Schema 文档通过。[完整验证](reports/verify-2026-10-24T17-19-05-070Z-25176/verify.log)。跨主版本选定合同：v24.14.0 50/50；v22.23.4 50/50。[矩阵](reports/node-matrix-2026-10-24T17-15-04-327Z-48572/summary.json)。128 Body Headless 固定负载 P95 1.539ms，非 GPU/最坏碰撞帧率承诺。[测量](reports/performance-2026-10-24T17-18-55-241Z-63920/summary.json)。
- 所有受影响的 G2/内容/Stage/益智/实时/经营/移动输入/候选/生成调试浏览器证据已按当前源码刷新；见 [现行状态](project/status.json)。修订号 G24 升至 2；Windows Python 子进程显式 UTF-8，并回归父环境 ASCII。
- 修复静态 Adapter 规则与既有 Schema 的冲突 ADAPTER-STATUS-002；实现态有界声明，verified 需当前源码回执。CI 配置已按官方 commit 固定，**远端未执行、未推送、未部署**。
- 本轮交付至 S11 的参考工程；完整项目仍为 Alpha。真实 Android、物理手柄、独立生成器 G3、逐款完整 DoD 与远端 CI 分开待验收，verified 仍为 **0/32、0/5**。[设备探测](reports/mobile-device-probe-2026-10-24T17-18-55-694Z.json)。

## S10 生成与调试工程交付（2026-10-25）

- 模型无关 stdin/stdout 合同、严格 JSON、完整准入及 Conformance、最多三次诊断修复、预算化按钮求解和第二 Session 回放。[流程](reports/agent-2026-10-24T16-20-01-545Z-64376/summary.json)。本次明确为确定性工程夹具，G3 NOT_RUN。
- 真实 SDK 的调试包导入、前进/回退/重开、Node Hash、资源释放和 390px 窄屏通过，截图已检查。[浏览器](reports/agent-browser-2026-10-24T16-20-13-673Z-39272/summary.json)。修复隐藏 iframe 导致的 CocosAirJS 启动尺寸问题，失败报告保留。
- 82 Node、119 Conformance、279 Schema 文档通过。[验证](reports/verify-2026-10-24T16-20-13-918Z-46000/verify.log)。使用 [Agent 合同](specs/v0.1/docs/17-Agent-Workflow-V0.1.md)、配置示例和 /player/inspect.html；未配置的真实独立生成器不被夹具替代。继续 S11。

## S9 独立候选参考交付（2026-10-25）

- 32 Gxx、5 Hxx 各有独立 JSON 和正反例；总计 74 JSON、123 Manifest。80 Node、119 Conformance、279 Schema 文档通过。[验证](reports/verify-2026-10-24T16-04-27-463Z-35684/verify.log)。
- 两套真实 SDK 共 74 场景、37 组正反例 Hash 对照，含暂停、重开、释放与 G03 原生桌面命中输入；已抽查旋转绑定、泡泡、五子棋和混合失败截图。[回执](reports/candidates-2026-10-24T16-05-30-615Z-61728/summary.json)。
- 新增声明式命中选择、扫掠位移/切割、手势驱动控制、泡泡格网、数值 Stage 绑定和一次性关卡启动；T4/T5/T8 跨域顺序与 H05 暂停计时有独立正反例。
- 逐款回执见 [候选证据](project/candidate-evidence.json)，合同见 [16-Game-Candidates](specs/v0.1/docs/16-Game-Candidates-V0.1.md)。这是有界单关候选，完整玩法 DoD、独立 G3、真机继续验收，verified 仍为 **0/32、0/5**。继续 S10。

## S8 移动输入与回放参考交付（2026-10-24，真机待验收）

- 14 个移动识别 Manifest、静态 state.set 合同及实验 JSON；78 Node、45 Conformance、186 Schema 文档通过。[日志](reports/verify-2026-10-24T15-00-59-220Z-8512/verify.log)。
- 真实 SDK 两端通过 CDP 虚拟触控/姿态、合成 Motion、权限拒绝及临时虚拟上下文授权、校准、停止/暂停、Trace 下载与 Node/浏览器 exactHash 回放、监听器/资源释放；截图已查看。[回执](reports/mobile-2026-10-24T15-04-43-944Z-63356/summary.json)。
- 录制需 JSON 声明及用户显式选择，仅内存保存；结束等待已排队输入消费，4096 样本上限，销毁释放。原 Tap/Swipe 路径和 Trace 金向量保留。详情见 [Mobile Input](specs/v0.1/docs/15-Mobile-Input-V0.1.md)。
- 首两次虚拟姿态运行因 Chromium 默认拒绝权限失败，记录保留，归因 TEST_ENV_PERMISSION；生产拒绝路径正确。测试授权仅作用于销毁即失效的虚拟浏览器上下文。
- ADB 未连接设备，[探测](reports/mobile-device-probe-2026-10-24T15-16-50-835Z.json)。S8 保持 PARTIAL，真机 Gate NOT_RUN，继续不依赖设备的 S9–S11；不把合成输入或 Manifest 注册计为真机完成。

> **截至**：2026-10-25。此页与 [`project/status.json`](project/status.json) 是进度单一入口；**不能**根据历史报告推断后续阶段已完成。工作区版本 `1.0.0` 属于 **Alpha 参考实现**；GameSpec/Capability 协议仍为 `0.1.0`。

## S6 固定 Tick 物理与战斗参考 Profile（2026-10-24）

Bounded aabb-int-v1 shared 2D motion/physics/combat reference profile; not full Gxx/3D/device coverage.

- 20 个真实双 SDK 场景、10 组 Node/Three/AIR Hash 对照通过；数值断言、实际输入、暂停/重开、画面与自有资源释放均已验证。[回执](reports/realtime-2026-10-24T14-33-52-314Z-36852/summary.json)。
- 仓库验证：72 Node、35 Conformance、130 Schema 文档全部通过。[日志](reports/verify-2026-10-24T14-29-42-449Z-42488/verify.log)。
- S2/S4/S5 现行源码回归已通过；旧报告全部保留。32 Gxx / 5 Hxx、Agent 和真机 Gate 分别验收。

## S7 经营、策略与回合参考机制（2026-10-24）

Shared bounded economy/path/turn/card mechanisms; full Gxx and Agent coverage remain separate.

- 18 个真实双 SDK 场景、9 组 Node/Three/AIR Hash 对照通过；数值断言、实际输入、暂停/重开、画面与自有资源释放均已验证。[回执](reports/strategy-2026-10-24T14-40-52-735Z-43000/summary.json)。
- 仓库验证：75 Node、44 Conformance、169 Schema 文档全部通过。[日志](reports/verify-2026-10-24T14-39-27-745Z-51524/verify.log)。
- S2/S4/S5 现行源码回归已通过；旧报告全部保留。32 Gxx / 5 Hxx、Agent 和真机 Gate 分别验收。

## 当前处于哪个阶段？

目录调整：协议包现位于 `specs/v0.1/`，docs/schemas/samples、版本工具及旧协议内容完整保留。旧报告和历史文档里的 `A2Game-V0.1-Spec/` 是当时路径；本次迁移同步更新运行入口和白名单，并重新执行真实 SDK G2，现行回执以 `project/status.json` 为准。

迁移复验已通过：49 文件完整迁移，36 个 Schema/样例文件与四份游戏内容哈希不变；`npm run verify`（55 Node、12 Conformance、7 Schema/27 文档）及真实 G2（16+2 场景、8 组跨引擎 Hash）通过。迁移证明见 [`layout-check-final.json`](reports/spec-layout-2026-10-24T12-06-54-319Z/layout-check-final.json)，本轮日志见 [`verify.log`](reports/spec-layout-2026-10-24T12-06-54-319Z/verify.log)。463 份既有历史证据内容未改，最新 G2 指针单独更新。

**S8 工程与虚拟输入参考已验证；真机验收待设备，持续推进 S9。** S0 的协议/测试设计已具备；S1 的 Headless 参考子集已通过，但完整 Gameplay Library 和完整 G1 都未完成。真实 Three.js / CocosAirJS 已在 HTTP Chromium 中执行相同四份 JSON，并核对输入、exactHash、画面与资源生命周期。S4–S11 均不得默认为已实现；32 Gxx/5 Hxx verified 仍为 0。

## S5 益智与休闲机制交付（2026-10-24）

共享库增加交换匹配/级联补位、遮挡托盘、麻将/记忆翻牌、方向射线、拼块旋转/消行/下落、目标归位、颜色分类、连通消除及推箱/滑动撤销。所有逻辑在 Runtime，Host 仅通用绘制和输入。合同见 [Puzzle Library](specs/v0.1/docs/12-Puzzle-Library-V0.1.md)。

- 12 份参考 JSON、28 份新 Manifest（共 17 游戏/40 Manifest）；70/70 Node、25/25 Conformance（19 套）、7 Schema/82 文档通过。日志：[verify.log](reports/verify-2026-10-24T14-20-52-831Z-16536/verify.log)。
- 真实 Three.js/CocosAirJS 各 12 场景通过，共 24 场景/12 组跨引擎 Hash；输入、暂停、胜利、重开与自有资源释放均验证，截图已查看。[回执](reports/puzzles-2026-10-24T14-22-27-662Z-50412/summary.json)。首轮夹具缺少必填 genres 的拒绝记录保留，归因 AGENT_FIXTURE_SCHEMA，已修复生成器并完整重跑。
- 本版既有内容/资源/包交付、透视/正交 Stage 及四游戏 G2 16+2 场景均复验通过。RNG 撤销限单行为场景；组合使用整 Session 快照。格子按钮不构成拖动/真实 Touch 验收，32+5 verified 仍为 0。

## S4 版本化通用表现交付（2026-10-24）

S5 参考机制交付及本版 S2/S4 回归均已通过；当前回执以 `project/status.json` 为准。

仓库验证全部 PASS：66/66 Node、13/13 Conformance、7 Schema/30 文档。日志：[reports/verify-2026-10-24T13-43-12-540Z-46612/verify.log](reports/verify-2026-10-24T13-43-12-540Z-46612/verify.log)；能力覆盖：[reports/visual-stage-capability-2026-10-24T13-46-15-262Z.json](reports/visual-stage-capability-2026-10-24T13-46-15-262Z.json)。

- 新增 `a2game.visual.stage@0.1.0`，原 `scene2d` 不变；完整 Schema/语义/能力约束涵盖 Camera、Sprite/Texture、Mesh、unlit/PBR Shader 预设、HUD、Tick 旋转动画、有界粒子和事件音频。规范见 [Visual Stage](specs/v0.1/docs/11-Visual-Stage-V0.1.md)。
- 两端均使用真实 SDK 原生对象，单 Canvas/单 SDK 渲染器。动画由共享逻辑 Tick 投影，暂停冻结、不消耗玩法 RNG；表现不进入 exact logical hash。
- 透视与正交/2.5D 各在真实 Three.js 和 CocosAirJS 通过：实际纹理/网格像素、动画像素变化、输入和 Node Hash、DPR/缩放、原生 AudioBufferSourceNode 与运行音频时钟、内容包、进程重启、context loss 与自有资源释放。回执：[透视](reports/visual-stage-2026-10-24T13-39-53-470Z-57792/summary.json)、[正交](reports/visual-stage-2026-10-24T13-40-18-542Z-59544/summary.json)，截图已人工查看。
- context loss 的暂停按既有契约清空输入源缓存；恢复 Hash 与 Node 的同一 pause/resume 序列一致。AIR 受控重载，Three 重建 GPU 资源后显式继续。SDK 共享缓存不计入实例所有权，不声明引擎总内存零泄漏。
- 本次新增 1 Manifest、1 参考 JSON、1 Conformance 和 2 条必要 Node 回归；参考数为 5 游戏/12 Manifest，32+5 完整 verified 仍为 0。S4 PASS 限本版本声明能力；一般模型/骨骼编辑器和任意 Shader 解释不在此能力中，扩展须独立版本与验收。

## S3 阶段交付（2026-10-24）

`npm run verify` 全部通过：64/64 Node、12/12 Conformance、7 Schema/27 文档。日志：[reports/verify-2026-10-24T13-16-53-498Z-45848/verify.log](reports/verify-2026-10-24T13-16-53-498Z-45848/verify.log)。

- 新 Profile `scene2d-trusted-assets-v1`：完整 Draft 2020-12、语义/版本/能力、宿主策略、隔离 Headless 检查、持久化回执与错误反馈。旧 Profile 保留历史记录，以原 JSON 重新导入升级。
- 部署方资源白名单记录类型、来源、许可、字节数和 SHA256；服务与浏览器分别核对实际字节。上传不能注册资源或访问任意外网/服务器文件。Session 统一拥有位图/对象 URL，退出释放。
- 可传输内容包通过文件和 HTTP API 导出/导入，接收方独立完整校验并使用自己已审核的资源；不信任发送者 PASS。此交付不包含远程账户、签名或自动部署。
- 真实双 SDK 验证包括资源下载/解码、内容包导出再导入、输入与 Node Hash、错误恢复、服务重启和资源释放。回执：[summary.json](reports/content-2026-10-24T13-13-36-731Z-49356/summary.json)；原 G2 16+2 场景复验通过。审核资源来自仓库生成的 CC0 PNG/WAV。
- S3 PASS 限当前宿主 Profile；未知/未实现 Capability 仍拒绝。S4、32+5、Agent G3 和真机 Gate 分别验收，不因此升级。

## S3 本地持久化回执（历史，2026-10-24）

- 默认将回执和 JSON 保存到私有 `.a2game/releases/<contextDigest>/<sha256Jcs>.json`，可用 `A2GAME_CONTENT_DIR` 指定目录；运行数据不入库、不经静态 HTTP 公开。临时文件同步后在同目录原子重命名，兼容本机 exFAT；同目录限定单服务写入。
- 服务重启后，首次读取再次执行完整 Schema、语义/能力、宿主策略与隔离 Headless 检查。内容或回执不一致拒绝；旧环境记录返回 `A2G_E_RELEASE_STALE`，需要显式重新导入，旧目录保留。存储失败不退化为内存发布。
- 真实双 SDK 的导入、Hash、负例恢复、后端切换及实际 HTTP 服务进程退出/重启均 PASS；原回执和初始 Hash 保持一致，重启后输入正常。回执：[summary.json](reports/content-2026-10-24T13-03-06-871Z-54276/summary.json)。桌面及移动尺寸截图已人工检查，原 G2 的 16+2 场景、8 组 Hash 复验通过。
- 本轮增加 2 条必要存储回归，覆盖恢复、完整重验、容量、损坏/伪造记录、旧环境与不可写目录；`npm run verify` 全部 PASS：63/63 Node、12/12 Conformance、7 Schema/27 文档及 4 游戏白名单。日志：[verify.log](reports/s3-persistence-2026-10-24T12-57-26-272Z/verify.log)。
- S3 仍 PARTIAL：资源下载/来源/完整性、远程签名分发、多写入者协调仍待实施；不声明断电持久性、G3 或真机完成。使用与恢复契约见[说明](docs/content-release.md)。

## S3 首次动态准入交付（历史，2026-10-24）

- 播放器可导入未加入内置白名单的 JSON；同源服务执行完整 Draft 2020-12、组件/绑定配置、引用/能力与宿主策略检查，再创建带内容/能力/环境 SHA 的进程内回执。校验失败保留当前游戏，错误码和 JSON Pointer 可用于修复。
- 当前 Profile 为 `scene2d-local-release-v1`：单场景、已有能力、Keyboard/Tap/Swipe；256 KiB、最多 32 份发布，服务重启后重新导入。不包含资源、远程/持久化发布、3D 或真实输入录制。
- 真实 Three.js 桌面与 CocosAirJS 移动尺寸均通过：新三次点击变体、键盘/Pointer、Node Hash 对照、负例后恢复及切后端；截图已人工检查。回执：[summary.json](reports/content-2026-10-24T12-36-07-539Z-56252/summary.json)。原四样例 G2 重新执行 16+2 场景、8 组跨引擎 Hash 全部 PASS。
- 显式修复 `SPEC_CONFLICT INPUT-CONFIG-001`：Tap/Keyboard 的旧 Manifest 仅允许空 config，与样例和 Runtime 冲突；同步 Manifest、生成器和输入规范，仍拒绝未知配置字段。协议保持 `0.1.0`。
- `npm run verify` 全部 PASS：61/61 Node、12/12 Conformance、7 Schema/27 文档及 4 游戏白名单；日志：[verify.log](reports/s3-2026-10-24T12-36-05-780Z/verify.log)。完整 S3、32 Gxx/5 Hxx、Agent G3、真机 Touch/IMU 均未宣称完成。

## 当前真实 SDK 验收（2026-10-24）

- Three.js `0.186.1`；CocosAirJS `1.0.0`，固定源码 `fa54a3f6942bfb3035d5c92d174a054ec4ab55ab`，本地执行 `npm ci --ignore-scripts`、`npm run build` 得到 Build 209；SDK 文件 SHA 随回执保存。
- Chromium `156.0.8078.4` / Windows / 实际 WebGL2，驱动为 ANGLE Vulkan SwiftShader。真实 SDK、真实 HTTP/浏览器执行；不等于物理 GPU 或移动真机验收。
- 四游戏 × 桌面 DPR 1/移动尺寸 DPR 2 × 两引擎，**16/16 PASS**；原生时钟、暂停恢复和 context loss，**2/2 PASS**。
- 8 组相同 JSON/操作序列在 Node、Three.js、CocosAirJS 的 initial/keyboard/pointer/restart 检查点 exactHash 一致；绘制、横竖视口缩放、截图像素探针通过，截图已人工查看。
- Three.js 连续三次重建后资源计数稳定，销毁后 ownedMeshes/geometries/textures 均为 0；context loss 时清理旧资源后恢复重建，无 `INVALID_OPERATION` 清理警告。
- AIR 官方 `close()` 释放场景、暂停 SDK 时钟、移除布局/上下文观察；回执 pending/failures 均为空。保留 runtime/scheduler/builtin/shared caches；关闭后同文档初始化按上游报 `AIR_E_APP_CLOSED`，须重载。context loss 后显示重新加载入口，不声称 GPU 自愈或总内存零泄漏。
- 回执指针：[Three.js](reports/g2-threejs-real.json)、[CocosAirJS](reports/g2-cocosairjs-real.json)。最终运行：[summary.json](reports/g2-2026-10-24T13-41-28-255Z-47612/summary.json)。运行前后源码指纹一致，浏览器与临时 HTTP 服务已关闭；失败运行保留并在[交付记录](reports/g2-implementation-20261024.md)归因。

## 当前具备的可运行功能

- `src/runtime.ts`：Session / Tick / Rule / 事务与回滚 / 定时与暂停 / 事件 / Snapshot。
- `src/rng.ts`、`src/exact-hash.ts`：参考随机数与 exact logical state Hash。
- `src/modules/grid-slide-merge.ts`、`grid-push.ts`：网格滑动合并、随机补位及推箱子的参考算法。
- `src/presentation.ts`：`scene2d` 的 `rect/circle/text/repeat` → `PresentationFrame` 只读投影。
- `src/input-trace.ts`：规范化 Swipe / InputTrace 合成回放（不等于真实设备输入）。
- `player/`：4 份 JSON 预览、Canvas2D Renderer、经真实 G2 验收的 Three/CocosAirJS `scene2d` 适配器及 Mock 契约。
- `scripts/`：静态验证、发布前白名单、Conformance、浏览器模拟和 Node↔Chromium Hash 校验。

**四份完整样例 JSON**：`tap-target`、`grid-merge`、`grid-merge-spawn`、`grid-push`。它们是参考样例，不直接等于 G01/G02 已完成全部玩法 DoD。

## 1.0.0 初始隔离复验（历史环境记录；保留原结论）

- **项目治理**：`npm run project:check` PASS（版本、12 阶段、32 Gxx、5 Hxx、计划/状态约束）。
- **Node 自动化测试**：**55/55 PASS**（历史基线 54，新增 1 条发行版本隔离回归）。
- **完整 Schema 与规范校验**：7 类 Schema 对 27 份 JSON、11 Manifest、4 游戏、32 候选、6 套 Conformance 引用 PASS。
- **Conformance**：6 套、12/12 PASS；发布白名单重建成功（4 个游戏 JSON）。
- **Chromium Canvas2D（隔离 set_content）**：5 个场景均运行并截图，Node↔Chromium 5/5 ExactHash 相同。
- **初始隔离环境的 HTTP 服务**：`/player/index.html`、`grid-push.game.json` 均返回 HTTP 200；Chromium `page.goto()` 当时被 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻断，历史结果为 INFRA BLOCKED，不可算该次 URL E2E PASS。
- **该历史时点的真实 G2**：CocosAirJS、Three.js 尚为 NOT_RUN；现行结果见本页上方真实 SDK 验收。全 32 Gxx/5 Hxx、真机 Touch/IMU 与 Agent G3 仍未验收。

本轮机器可读证据：[`reports/release-1.0.0-validation.json`](reports/release-1.0.0-validation.json)；原始日志见 `reports/release-1.0.0-*.log`、`reports/release-1.0.0-node-tests.tap`。以上只确认当前环境真实执行的测试，不推断其他平台结果。

2026-10-24 G2 实现后的仓库复验：`npm run verify` 全部通过，55/55 Node、12/12 Conformance、7 Schema/27 文档。完整日志：[`g2-workspace-verify-20261024.log`](reports/g2-workspace-verify-20261024.log)；独立保存的逻辑回执：[`g2-workspace-conformance-20261024.json`](reports/g2-workspace-conformance-20261024.json)，不覆盖基线报告。技能浏览器脚本在两个真实 SDK 中完成推箱子获胜，最终状态与 Hash 相同。

## Gate 状态（不得跨域冒用证据）

| Gate | 现行状态 | 可复现证据与界限 |
|---|---|---|
| G0 预校验样例 | **PASS（样例范围）** | 7 Schema / 27 文档历史回执；每次发布重新 `npm run schema:full` |
| G0 浏览器动态 AI JSON | **PASS（本地 scene2d Profile）** | 完整 Draft 2020-12、组件/绑定配置、语义/能力与宿主策略；同源持久化回执及重启后完整校验，见本轮 S3 证据；资源和远程发布待做 |
| G1 Headless 参考子集 | **PASS（子集）** | 历史 54/54 Node、6 套 12/12 Conformance；本次重验见 `reports/release-1.0.0-validation.json`（生成后） |
| G1 完整能力目录 | **PARTIAL** | 益智参考机制已交付；实时/策略及全 Gxx/Hxx 仍需验收 |
| Browser + Canvas2D | **PASS（历史 5 场景）** | `reports/browser-core-smoke.json`；不是实际 SDK G2 |
| Node↔Chromium ExactHash | **PASS（历史 5 场景）** | `reports/browser-node-parity.json`；不包含物理/GPU 验收 |
| G2 CocosAirJS 真 SDK | **PASS（四样例 scene2d）** | `reports/g2-cocosairjs-real.json`；8 场景 + 原生时钟/context loss；不包括真机输入或完整引擎卸载 |
| G2 Three.js 真 SDK | **PASS（四样例 scene2d）** | `reports/g2-threejs-real.json`；8 场景 + 原生时钟/context loss、连续重建与释放 |
| G3 游戏/Agent | **NOT_RUN** | 32 款仍 planned；尚未做模型独立 one-shot、玩法完整验收 |
| 真机 Touch/IMU | **NOT_RUN** | 合成 Trace 可以回放；IMU 采集、权限/校准尚未实现 |

## 覆盖统计与冻结口径

| 指标 | 当前 | 解释 |
|---|---:|---|
| CoverageRegistry 候选游戏 | 32 | G01–G32，`status: planned`，保留冻结分母 |
| 已完整 verified 游戏 | 0/32 | 实现参考功能不替代 G0+G1+G2+G3 玩法 Gate |
| 独立混合玩法 | 0/5 | H01–H05 尚未创建各自完整 GameSpec/Conformance |
| 已交付样例游戏 JSON | 37 | 当前 Headless/Canvas2D/真实双 SDK 的 scene2d 参考验证 |
| 已声明参考 Capability | 104 | Capability Manifest 数量不代表标准库完成度 |

## 下一轮的具体执行目标（S3/S4）

S3 已完成当前 Profile 的资源准入与内容包交付，审核范围外的资源及未知能力拒绝。S4 已交付版本化 Stage 与双引擎证据；下一步 S5 补齐益智/休闲机制，之后按既有 S6–S11 范围持续实施。详见[本地准入契约](docs/content-release.md)。

只有真实 SDK 的全流程证据存在且 PASS，才能调整 `project/status.json.gates` 与本页状态。之后继续 S3/S4、Gameplay/Touch/IMU、32+5 全量计划，不得因 G2 完成缩减其余目标。完整任务与分阶段 DoD 见 [PROJECT-PLAN.md](PROJECT-PLAN.md)。

## 进展更新要求

2026-10-24 工程基线整理：补充 `AGENTS.md` 快速导航，纳入 npm 锁文件和 `.gitignore`；本机使用项目内 Python 环境运行 `npm run verify` 全部通过（55/55 Node、12/12 Conformance、7 Schema/27 文档、4 游戏目录）。日志：`reports/workspace-baseline-20261024.log`。此次不升级真实 SDK G2，后续在基线提交后推进。

每轮都记录：执行日期、仓库或源码包基线、变更文件、实际运行命令、PASS/FAIL/BLOCKED、未完成原因、覆盖分母与证据文件。同步维护本页、`project/status.json`、`CHANGELOG.md`，并运行 `npm run project:check`。历史 `IMPLEMENTATION-REPORT.md`、`IMPLEMENTATION-NEXT.md` 和 `reports/v03-*` 保留以便审计。

## 清零第二批（参考验收通过）

G02/G16/G18/G19/G20/G22/H05 取得当前 190 场景、148 双 SDK 基础/变体及 12 组浏览器证据；农场在真实页面重载后恢复并续玩，找物使用审核 PNG 与实际拖放。100 Node / 200 Conformance / 360 Schema 文档 PASS，[日志](reports/verify-2026-10-27T05-56-51-748Z-35480/verify.log)。必需玩法缺口由 15 降至 8 款，继续逐款虚拟输入收口；完整质量/G3/真机仍单独待验。

完整 2048 长局补充性能修正：宿主改用只读 Runtime.tickIndex 生成输入时间，手动时钟仅在操作/推进/缩放时绘制，避免空闲帧重复复制事件历史；玩法、Hash 和逐步断言保持。受影响源码指纹重新取证。

## 清零第三批（参考验收通过）

G25/G26/G27/G29/G30/G31/G32/H04 基础/变体的 32 个真实 SDK 原始输入流程通过。动态水果漏果、双指重抓（含 ±π 等价）、60 Tick 样本失联停止、失联施力/瞄准清零、摇动去抖、弹弓取消/多指/一次释放、多指 cancel/blur 重试均有逐款状态、Node 回放和截图；真机继续暂缓。

本轮输入/AI参考阶段最终工程验证：**115/115 Node、203/203 Conformance、360份Schema文档 PASS**，日志 `reports/verify-2026-10-28T11-28-16-892Z-28720/verify.log`。首次全并发内容发布503记录保留；只将测试文件并发限制为2，原8秒完整校验与全部测试不变。

2026-10-28 源码恢复实测完成：全新源码目录独立npm ci，Node22.23.4，恢复前门禁拒绝；8,138份原始证据（679,838,647字节，压缩393,230,709字节）SHA恢复、重复恢复与验证后再恢复通过。完整115 Node/203 Conformance/360 Schema、G3 3,332文件及P2只读审计通过。详见 `project/evidence-restoration-run.json` 与 `project/evidence-lock.json`。正式G3仍0/37，verified仍0/32＋0/5；远端未重跑，额度与可信证据托管仍为外部前提。

2026-10-29 Generator Batch A 回归：最终源码独立 smoke 通过；完整 `npm run verify` 通过（125 Node、360 Schema、203 Conformance），旧回执恢复。双 SDK 预览 HTTP 与关闭监听通过，实际渲染仍 NOT_RUN；真实模型调用 0，Batch A 保持 PARTIAL。详见 [Generator 台账](project/generator-status.json)。
