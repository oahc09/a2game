# A2Game 项目变更记录

- 2026-11-02：修复已准入 realtime 约束目标死亡/退役后被误报配置错的生命周期问题；以每个 Runtime 私有冻结声明来源允许休眠约束，保留默认严格校验、配置错配拒绝和初态/边界负控。补公开 aimPath 方向向量及 state.set 路径与提交时序；仅核心、必要状态及合成回归，旧实验不重签，不升级真实 Host/OS/人工或正式验收。

- 2026-11-02：终局结果与重开区移出画布为正常文档流，取消窄屏 fixed 遮挡；保持输入、画布尺寸和运行规则不变。新增结构负控及双 SDK/WPE 多视口终局、暂停、HUD 几何与生命周期合成回归，不代表生成作品视觉或真实宿主验收。

- 2026-11-02：公开创作capsule v2纳入同源Skill、固定HostProfile/非执行片段与冻结任务摘要；保留v1兼容，目录准备不等于OS隔离。补expectError必需code/顺序安全诊断和公开操作说明；模拟验收profile增加独立Session重放、适用输入清理及控制台/性能观察覆盖，不自动判语义、视觉或真实宿主PASS。

- 2026-11-02：补充无起始按下hold/声明判负失败的安全诊断、可选MCP窄屏数值反馈与精确冷却Tick说明和合成边界回归；保持合法输入/Hash/既有Tool调用兼容。反馈不认证浏览器或替代视觉审查，旧实验不重签。

- 2026-11-02：修复 realtime 波次单对象校验错误套用完整世界约束；保留真正缺失约束目标、重复 ID 和容量拒绝。补全公开机制状态合同与受控语义诊断，新增合成回归；不改变协议 0.1.0 或 MCP Tool contract 1，不自动修复作者输出，不将旧模拟证据升级为当前版本通过。

- 2026-11-02：新增用户选定的独立 SIMULATED_HOST_ACCEPTANCE profile及只读15格账本检查器；neutral A/B/C不冒充真实客户端。完整controller证据仅产出待语义复核状态，原真实Host矩阵/正式Gate不改，实际实验不入库。

- 2026-11-02：修复真实 stdio tools/call 在 SDK 参数预校验处漏记失败的账本缺口；保留九工具 Schema、输入上限和受控诊断。关闭 MCP 等待活动调用及最终回执再完成清理；非法协议报文/未协商 task 不计游戏候选。仅工程回归，不升级真实宿主或正式 Gate。

- 2026-11-02：增加可独立执行的非法方向动作后撤销检查与公开生成测试要求；增加实时 canvas 投影下的文字 CSS 像素预检，仅作可解释 warning。通用 MCP 参数保持兼容，不把诊断或模拟结果升级为人工/真实宿主验收。
- 2026-11-02：修复Host run漏记失败候选、完整账本预算/来源指纹、结构化诊断和受控规范发现、导出格式契约与硬编码Windows测试路径；增加白名单公开capsule和fail-closed Linux沙箱路径及合成回归。9 Tool合同保持兼容；不升级任何真实宿主/模型/人工/真机Gate。

- 2026-11-01：修复宿主检查器漏存调用、只选成功候选和补开预览掩盖关闭缺口的问题；新增预览幂等关闭、真实回收原因与生命周期原字节归档。启动入口支持有界preview TTL配置，默认值不变，未修改播放器。

- 2026-11-01：安装器支持WorkBuddy项目Skill入口链接到唯一源码，其余链接检查保留。本机E:为exFAT，不支持符号链接，替换未完成，原副本保留。

- 2026-11-01：补齐四宿主项目Skill布局、受控调用记录和原字节证据归档，新增显式G01全通路任务；真实双SDK与归档链工程参考通过。保留WorkBuddy/ZCode宿主导出差异，不放宽Schema。

- 2026-11-01：统一四宿主G0证据审查、响应ID/文件摘要核对和补证交付格式；修正过时连接状态，记录WorkBuddy Skill缺失及通道证据错配。ZCode独立扩展，G0保持PARTIAL，不升级旧Gate。

- 2026-10-31：启动 Host-first 无模型接入工作，建立环境基线、独立状态台账与三宿主项目级模板；4 份模板本地发现 9 个工具，双 SDK MCP 参考通过，三宿主实际发现和正式验收仍待验证。

- 2026-10-31：播放器增加通用终局提示和重开按钮，窄屏在视口内显示；G17 胜负和 G24 和局双 SDK 局部检查通过，37 款基础和作者变体共 148 个双 SDK 参考实例通过；完整回归与覆盖索引待验。

- 2026-10-31：新增只读 `model-http` 证据审计，检查逐次服务自报模型、私有响应摘要与用量；区分缺失、未返回、不匹配和篡改，不复制私有回复、不调用模型。GLM 已有两轮分别审计 3 次返回和 1 次未返回，旧汇总额外 2 次仍无证据；必要回归 2/2 通过。

- 2026-10-31：新增 G17 宿主表现副本的可复现构建和双 SDK 320px 复验；消除游戏中终局文字残影、精简重复 HUD 并增大画布字号。完整回归 159 Node、360 Schema、203 Conformance 通过。原模型原稿与评分保留，模型调用 0，胜负提示仍位于画布下方，人工和正式 G3 未升级。

- 2026-10-31：补齐 CLI 帮助中已有的 `claude` Provider，并新增 Generator 使用与交接说明；隔离安装、源码副本、MCP 双客户端/双 SDK、Skill 打包及完整回归通过，不改变模型路由和调用预算。独立宿主、新会话触发与模型身份仍待验。

- 2026-10-31：为参考 H01 动态实体增加可选的只读最小字号和形状尺寸；新增 Schema、语义及兼容检查，旧配置行为不变。基础/作者变体在 320px 双 SDK 4/4 数字、遮挡、Hash 和资源释放参考检查通过；193 个 Headless 场景、148 个双 SDK 实例及覆盖索引重验，完整回归 159 Node、360 Schema、203 Conformance 通过。人工视觉和真实模型重测仍待验，新增模型调用 0。

- 2026-10-31：改进 H01 基础关卡与奖励升级变体的窄屏标题、槽位编号和中文提示，保持输入和玩法状态；两真实 SDK 局部验收及修改前后状态 Hash 对照通过。37 款基础与变体共 148 个双 SDK 参考实例和 148 份 CoverageResult 已复验；完整回归 157 Node、360 Schema、203 Conformance 通过。动态实体数值在窄屏仍偏小，未提升正式验收。

- 2026-10-31：修复 Claude CLI 错误信封缺少正文时的二次异常，保留原错误及失败回执；模型选择只记录为宿主配置，不自动声称授权已认证。修复完整回归中途失败时沿用旧 Schema/Conformance 计数的问题，并补必要回归。默认 Python 缺少 `jsonschema` 的失败日志已保留；切换项目 `.venv` 后完整回归通过。已复查参考 H01 窄屏小字，视觉质量仍待优化。本轮真实模型调用 0。

- 证据口径补充：下方 Claude 单次成功仅说明该次修订后的功能链参考通过；服务端返回模型身份缺失，单次对照不能确定全部失败根因或证明模型普遍成功率。

- 2026-10-31（生成合同改进与单次参考验证）：按用户指令系统归因。**基础对话通路**：T1/T2/T3 探针全 PASS（claude CLI+glm-5.3 路由健康；发现用户环境向每次调用注入 ~13K 系统上下文）。**失败现象**：生成输出前言/围栏；与环境注入的因果关系未确认；T4 用原始 150KB 生成 prompt 实证 `--append-system-prompt` 硬化可产出纯裸 JSON（9335 字节，envelope 完整）。**合同缺口**：`A2G_E_CAP_CONFIG`/`A2G_E_RULE_EXPR` ← 生成合同缺组装词表（`game.schema.json` 规则 op 无 enum、请求上下文无操作符/组件 kind 词表；子 Agent 当时参考了 Runtime 源码）。**修复**：① 适配器固定硬化 system prompt；② `scopeRequest` 增补 `referenceHostRuleAssembly`（表达式 14 ops+叶形式、效果 10 ops 精确字段、组件 kind 白名单，均提取自 `src/expression.ts`/`src/validator.ts` 受信实现），新增 `test/generator-contract-vocab.test.mjs` 锁定词表与 Runtime 同步（plan 回归 8/8）。**闭环**：请求 glm-5.3 的 claude CLI 重跑（服务端未返回模型身份）——**单发 one-shot 通过完整准入**（1 次调度 50.5K/16.8K tokens、repairCount 0、模型自供解法），test/air/three 预览/export 全链路 PASS（SHA 核验），exactHash `76a5ea4b…`。单次结果支持继续验证合同改进，但不能确定此前失败的全部根因或验证返回模型身份。回执：`real-provider-claude.json`（循环 2）与 `real-provider-claude-cycle1.json`（修复前对照）；正式 G3 不升级，未提交/推送。

- 2026-10-31（Claude Code CLI 适配器与 glm-5.3 实测）：按用户指令新增 `claude` Provider 适配器（`scripts/claude-generator.mjs`：print 模式单回合、禁工具清单、stdin 传大 prompt、隔离临时目录、复用 codex 协议上下文构建——已重构为导出 `buildGenerationPrompt`），接线 `generator/providers.mjs`（探针+白名单）、`generator/worker.mjs`、`integrations/mcp/service.mjs` 与 `contract.mjs`（zod enum），新增 `test/generator-claude.test.mjs`；相关回归 17/17。用户 claude 设置已路由 GLM Coding Plan（`open.bigmodel.cn/api/anthropic`），认证继承、工作区不碰凭据。3 次真实调度（`--model glm-5.3`）：#1 40s 返回中文前言+Markdown 围栏 JSON（GENERATION_FORMAT 正确拒绝）；#2 175s 返回但规则用未注册操作符 `<`（CAPABILITY_SEMANTICS，应 `lt`）；#3 思考超 300s（PROVIDER_INFRA）。遥测含 model/usage/cost（观察 $0.86）/sessionId；`pass_within_budget 0/1`，MCP 管线与归因验证正确。至此三条生成路由（codex 限额阻断 / model-http 0/1 / claude 0/1）与子 Agent direct-json（1/1）对照完整。回执：`reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/real-provider-claude.json`；正式 G3 不升级，未提交/推送。

- 2026-10-31（同模型双路径对照，子 Agent direct-json 验证）：按用户指令以当前会话子 Agent（宿主声明 GLM-5.3-Flash，服务端身份未独立核实）执行 Skill 的 direct-json 路径：研读规范与 8 份 Manifest 后手写"计数开锁"（org.a2game.glm-subagent.count-unlock），CLI validate/test **均首次 PASS_REFERENCE（零诊断）**，MCP 全链路 validate→test→inspect→air/three 双 SDK 预览（资源释放/监听关闭/无 pageerror/截图）→export（SHA 核验一致）PASS_REFERENCE 且 providerCalls=0；主会话独立核验：playSolution 复算 exactHash `d4315ec4496c99c38a30112bbf79fcff` 与 MCP 一致、导出包重算 SHA 一致、截图人工查看、仓库源码 mtime 扫描零改动。与同任务同模型的 `generate_game` 单发（0/3 准入）形成对照：两种路径结果不同，单次对照不足以判断普遍优劣；两路径数据分开登记，单发 0/1 不改写。子 Agent 全程未读 `.a2game/`、无 git 操作；MCP 阶段 providerCalls=0，创作阶段仍消耗模型资源（2.31M tokens、59 工具调用、约 12 分钟）。回执：`reports/generator-glm-subagent-run/`（mcp/mcp-verify-summary.json、exercise/ 三份 JSON、authoring-notes.md）；正式 G3 不升级，未提交/推送。

- 2026-10-31（GLM 真实矩阵首格与适配器增量）：按用户指定切换 GLM Coding Plan（`https://open.bigmodel.cn/api/coding/paas/v4`，模型 `glm-5.3-flash`，密钥仅存 git 忽略的 `.a2game/glm-coding.key` 并经环境变量注入，工作区不读取内容）。适配器两项兼容增量：HTTP 超时上限 55s→300s（`scripts/http-generator.mjs`、`generator/providers.mjs`）、有界 `extraBody`（≤4KiB/键名受 pattern 约束/`model/stream/response_format/messages` 不可覆盖，telemetry 记录 `extraBodyKeys`）；方言测试扩至 9/9。两份循环回执可核对 4 次真实调度（旧汇总写 6 次，差异待查）：thinking off 3/3 完整返回（~36s/次）但均被严格准入拒绝（A2G_E_SCHEMA/A2G_E_UNKNOWN_FIELD/A2G_E_RULE_EFFECT，修复链诊断正确回传）；thinking on 非流式 >300s 超时（PROVIDER_INFRA）。工程口径 `pass_within_budget 0/1`；MCP 全链路管道（显式 generate→真实内容→严格准入→有界修复→归因→usage 记账）验证通过，回执身份 `glm-5.3-flash` 一致。探针同时实证 codex ChatGPT 计划限额未变（2026-11-05 15:03 重置）。累计：codex 2+1 探针（0 计费）、GLM 回执可核对 4 次（费用未完整导出）。见 [多模型矩阵](docs/generator-multi-model.md) 与 `reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/real-provider-glm-cycle1/2.json`；正式 G3 不升级，未提交/推送。

- 2026-10-31（宿主接入与多模型适配层）：a2game Skill 安装至 ZCode 项目级发现路径 `.agents/skills/a2game/`（与 `integrations/skill/a2game/` SHA 一致），并在 `.zcode/config.json` 注册项目级 MCP Server（预算默认 0，重启会话生效）；MCP Provider 接线验证 4 例 PASS（真实配置+零预算闸门/Provider 不匹配/非法启动拒绝/干净退出）。新增 `test/generator-model-dialects.test.mjs`：model-http 适配层对 Qwen/DeepSeek/GLM/MiniMax Chat Completions 方言的离线一致性 7/7（mock fetch，无网络无凭据），配套 `docs/generator-multi-model.md` 兼容矩阵与真实端点实测计划。已授权的 MCP 单例真实模型验证（≤3 次调度）执行 2 次均确定性失败，经最小探针定位根因为 ChatGPT 计划用量上限耗尽（2026-10-30 GEN-7 25 次调度所致，2026-11-05 15:03 重置），归因 PROVIDER_INFRA，0 token 计费；MCP 管道（probe READY→调度→BLOCKED 归因→预算闸门）验证通过。当时四厂商真实端点矩阵仍 NOT_RUN，后续 GLM 回执见上文。宿主执行回执见 `reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/`；正式 G3/人工/真机不升级，未提交/推送。

- 2026-10-31：H01 原始规划结果保持失败记录，单独宿主修正版为终局输入声明预期错误并完成准入、4/4 逻辑和双 SDK 浏览器输入参考验证。生成上下文和失败反馈补充输入拒绝语义，普通生成上下文补充画面可读性要求；未新增模型调用，生成效果及人工质量仍待验证。见 [H01 修复](docs/generator-h01-repair.md)。

- 2026-10-31 顺序推进结果：Batch A/B/C保留工程参考交付；Batch D的5任务×2模式已真实执行10/10，30/30调用含1次宿主中止，29份完整回复，最终9/10通过完整准入、双SDK回放与36路来源输入。H01规划模式仍失败；直接模式原始输出经宿主组合误判修正后原样复验通过，G17规划模式已修复方向键与窄屏字号，实际画面仍有对比度不足；严格产品/人工验收不计通过。MCP新增9个受限stdio工具，官方SDK与独立Python客户端、CLI同JSON/Hash、真实双SDK输入/重开/释放通过；Skill已打包，真实Agent宿主安装/执行及MCP真实Provider待验。完整回归143 Node、360 Schema、203 Conformance及新源码MCP/两模式/包复验通过。MCP依赖独立锁定，根Runtime锁原字节恢复；旧证据不改写。正式G3 0/37、Verified 0/32+0/5、真机/人工/远端CI不升级，未提交/推送。见[实际结果](docs/generator-real-findings.md)、[MCP/Skill说明](docs/generator-mcp.md)、[台账](project/generator-status.json)。

2026-10-30 按顺序完成 Batch B/C 工程参考：能力检索、内部GamePlan、两模式有界修复；Loopback Studio的生成/取消/双SDK/状态/导出导入；单文件受控内容包在独立源码宿主原样复验。最终137 Node、360 Schema、203 Conformance通过；Studio桌面/390px双SDK4/4、独立宿主2/2、最终干净源码两模式/包/矩阵准备与新浏览器worker桥接通过。一次smoke汇总漏返回stdout导致的失败已保留并修复。内容包仍需兼容宿主/SDK/审核资源，不嵌入Runtime或资源二进制。Batch D已冻结5任务×2模式和入口，真实矩阵0/10，因新预算0为BLOCKED；GEN-8最终交接未完成。新增真实调用0，正式G3/人工/真机/远端CI不升级，未提交/推送。见 [Studio说明](docs/generator-studio.md)、[Benchmark说明](docs/generator-benchmark.md) 和 [Generator台账](project/generator-status.json)。

2026-10-30 Batch B 工程参考完成：公开能力检索/精确依赖闭包、内部 GamePlan v1 完整 Schema、direct-json/game-plan 两路径、规划引用/组件一致性、有界分类修复及 Headless 生命周期回执。133 Node、360 Schema、203 Conformance、两模式双 SDK 桌面/390px 共8/8与两模式干净源码smoke通过，旧报告恢复。默认规划仅为宿主关键词草案，真实模型两模式/完整玩法语义仍 NOT_RUN；新增真实调用0，不升级正式G3/人工/真机。按用户顺序要求进入 Batch C，见 [Batch B](docs/generator-batch-b.md) 和 [Generator 台账](project/generator-status.json)。

2026-10-30 窄屏视觉优化完成：为“双灯之锁”创建明确标记的宿主表现副本（revision 2），原始 Terra JSON/评分保持不变。360×420 紧凑画布、最小设计字号26、中文机会HUD和按钮对应说明；390px画布最小字约9.4→23.2 CSS px，320×568约16.9px。两真实 SDK、320/390/桌面6/6输入/胜负/重开/释放、原版/新版 Hash及3项正反例完全一致；普通CLI validate/test、原样Skill客户端两端通关、127 Node/360 Schema/203 Conformance与最终源码smoke均通过。新增模型调用0，真机/人工/正式G3不升级。当前窄屏条目为宿主副本AI参考通过，见 [优化说明](docs/gen2-narrow-visual.md) 与 [Generator 台账](project/generator-status.json)。

2026-10-30 GEN-2 真实模型工程验收通过：按用户指定以原生子 Agent 运行 gpt-6.1-terra / medium，新生成“双灯之锁”，3 次生成、2 次格式修复，非 one-shot，无宿主补解。完整准入、3/3 Conformance、模型自拟 3 步双 Session 解法、双 SDK 回放与 4/4 桌面/窄屏源输入、胜负 Hash/重开/释放通过。新增原生上下文构建与 SHA 绑定导入入口，修复 root envelope/solution 类型说明歧义。完整回归 127 Node、360 Schema、203 Conformance 及最终源码 smoke 通过，旧报告恢复。身份限定为实际宿主请求路由，服务端构建/用量/费用未导出；窄屏小字和英文 HUD 使视觉质量为 PARTIAL，人工/真机/正式 G3 不升级。Batch A 工程为 PASS_REFERENCE，Batch B 尚未开始；本轮预算 3 次已用尽。见 [GEN-2 记录](docs/gen2-native-acceptance.md) 与 [Generator 台账](project/generator-status.json)。

2026-10-30 Generator Batch A 继续收口：新增 `npm run generator:browser`，新建 fixture 通过公开预览入口在真实 Three.js/CocosAirJS、桌面/390px 窄屏完成 4/4 输入、Headless Hash、未达目标/通关、暂停/重开、零 ownedResources 和监听关闭；12 张截图及 SDK 版本/SHA、来源指纹分别留证。最终源码 smoke 与完整回归通过（125 Node、360 Schema、203 Conformance），旧报告恢复；正式 G3、人工/真机不升级。一次运行因验证期间脚本变更被指纹检查拒绝，失败材料保留，最终定稿运行通过。真实调用 0；安装后 `a2game` 命令已通过独立前缀安装、帮助/版本、生成与校验，依赖锁不变；最终源码重新通过干净安装 smoke。GEN-1 为 PASS_REFERENCE，GEN-2 的真实 Provider 验收受预算 0 阻塞，Batch A 保持 PARTIAL，未进入 Batch B。见 [Generator 台账](project/generator-status.json)。

- 2026-10-29：按用户附件更新计划第 9–15 节，启动本地 Generator Batch A；保留原 0–8、S0–S11 与验收分母。新增 API/CLI、Provider 预检和有界 worker，确定性 DEMO_FIXTURE 仅用于工程验证；真实模型预算 0、状态 BLOCKED，其他后续工作未执行。独立 Generator 状态不升级正式 G3、真机、人工质量或远端 CI。

- 2026-10-29：拆分 `specs/v0.1/samples/` 为能力、适配器、游戏、执行测试、登记和格式示例目录，362 份资产原字节保留；同步加载/白名单/生成/校验/文档。新增可信能力与测试来源索引，以及严格可逆路径迁移审计；旧审计工具来源单独保留，正式验收计数不变。

- 2026-10-28：根据两批原生 G01 实测改进交付和取证：统一任务请求/交付合同、原始载荷只写一次、最小宿主导出、源码快照、失败归因与空回复记账；新增任意成功 workflow 的主输入入口。沿用两批原始输出，实际键盘双 SDK 4/4 通过，本轮无新生成调用；不升级模型来源、视觉质量、正式 G3 或真机，不覆盖历史证据。

- 2026-10-28：同步 `specs/v0.1` 描述与现状：README 从「设计稿，尚未实现」更新为现行协议 0.1.0 状态（20 份规范文档、112 份游戏 JSON、127 份 Manifest，Conformance 与真实 SDK 验证已通过），机器可读资产清单、初始交付范围（保留为历史记录）与有界例外（turn-room、调试回放、锁定物理）一并修正；更正 01 号文档「尚未有符合实现」的过时状态声明。正式验收、G3、人工质量与真机边界不变。

- 2026-10-28：应用户确认执行彻底仓库瘦身：`git filter-repo --invert-paths --path reports/` 重写本地全部历史，`.git` 由 13 GiB 降至 8 MB，main tip 由 `a158e55c` 改写为 `178f30fe`。原完整历史（含 `archive/local-history-20261028` tip `97d56daf` 与全部报告 blob）经 `git bundle verify` 后保留于 `output/a2game-full-history-20261028.bundle`；未提交改动备份于 `output/pre-rewrite-dirty-20261028/` 并按 SHA256 校验还原，工作区 `reports/` 证据未动。旧 `sourceCommit`（如 `12c2b026`）指向重写前提交，可经 bundle 找回。origin/main 已经用户明确批准强推，远端 tip `178f30fe` 与本地一致。

- 2026-10-28：只读复查四款修复、剩余8款主输入及37款当前语义/画面记录，3,332文件SHA审计通过；纠正已完成AI参考审查仍显示进行中的状态。未新增生成调用，G02宿主辅助、虚拟输入、人工作品质量及正式G3边界不变。

- 2026-10-28：新增多模型G3主/子Agent与本会话审查设计，支持显式选定模型的原生生成或外部服务模式；保留既有Codex路径，区分真实生成模型和调度模型，冻结任务/上下文/技能/辅助条件，定义结果指标、预算与技能回归/保留集闭环。仅设计，目标厂商未实测，原生导入、统一上下文、聚合和自动回传未实现，未新增调用或正式签收。

- 2026-10-28（收口进行中）：新增独立生成版本的浏览器主输入复核与逐款画面审查辅助，区分实际鼠标/键盘、CDP 虚拟多指、合成 IMU/Motion；12 款/24 双 SDK 初始输入参考通过。37 款原始画面已审查，继续模型画面修复；G32 正常松手清空第一机关的主输入缺口已单独留证，正式 G3/人工/设备未提升。

- 2026-10-28（工程准备）：SHA 字面量引用支持批准测试与模型 presentation-only 修复，机械保留逻辑/解法；新增证据包收集与安全恢复工具及必要拒绝测试，仍需最终冻结后的全量恢复和 CI 配置。未覆盖历史报告、未公开私有证据。

- 2026-10-28：按用户要求顺序收口非真机工作，新增独立 G3 完成计划；G24/G26/G11 根据实际错误由当前 CLI 修复并通过双 SDK。新增使用公共 Runtime 转移的有界滑动棋盘搜索工具，区分宿主求解反馈与模型自解，不改变玩法或正式 Gate；追加调用预算与历史生成器源码归档单独校验。

- 2026-10-28：G02 原独立定义在宿主 Runtime 搜索出 1,021 步，模型选择批准的 SHA 引用并编写负例；字面量绑定展开为标准 JSON，32 行解法、2,048 项正例及原传输/Tick 上限保持。未来输入被实时 Host 重标时间导致的 Hash 失败保留，最终当前 Tick 批次通过 Node/两 SDK。37/37 工程参考通过，累计 115 次生成调用；宿主辅助与正式 G3 分开标记。

- 2026-10-28：四款修复阶段 111 Node / 203 Conformance / 360 Schema 文档、Node 22 相关 6/6、1,734 文件归档和双 SDK 8 次技能客户端短操作通过；截图已查看，G02 裁切/G11 小字/G24 结果反馈继续列为质量修复，不把工程或短控件探测当完整质量。

- 2026-10-28：按用户确认采用源码交付方式更新 main；原本地 main 的全部历史保留于 `archive/local-history-20261028`，原 tip 为 `97d56daf`。源码快照 `b42ccf27` 与归档 tip 文件树一致，以原远端 main 为父提交；后续仅补充交付记录，不上传超限本地报告历史、不 force push。

- 2026-10-28：整理源码/本地产物边界，明确 `reports/` 本地保留且不再纳入 Git；新增维护说明及新检出证据恢复前提。清理已结束验收的临时内容存储与日志，使用 `git prune-packed` 清理已打包重复对象；保留 SDK、依赖、私有配置/发布数据及全部本地历史证据，不改动 Runtime 或验收口径。

- 2026-10-28：使用现有 Codex CLI 实际执行全部 37 款独立生成，33 款通过完整准入、正反例、通关及真实双 SDK 工程验证；G02/G11/G24/G26 失败保留。新增有界后续修复、原始输出校验/浏览器单独复测与 SHA 依赖汇总；G01/G05 仅表现修复强制保持玩法、输入、状态、规则、测试与解法。108 次生成调用及 1 次探测均纳入统计；费用未知。正式 G3/verified 不提升，真机仍按用户要求暂缓。

- 2026-10-28：选定独立版本的真实桌面键盘/按钮及按住输入 25 款、50/50 双 SDK 流程通过，复核 Node/Host Hash、重开与零资源释放；原生工具版本 3 保存源码、前后摘要和逐款定义 SHA。8 款 Touch/IMU/模拟量解法待验，未借用旧版或作者关卡证明。

- 2026-10-28：本阶段 106 Node / 203 Conformance / 360 Schema 文档、Node 22 相关回归 5/5、1,576 文件独立生成归档 SHA 和既有 P2 档案复查通过。未重跑无源码变化的 12 组参考浏览器套件，正式门禁与旧证据保持原范围。

- 2026-10-27：独立变体原生键盘/按钮双 SDK 16/16 通过，和规范化 API 回放分别留证。HostProfile v2 公开可信库初态/配置 ABI 与 scene2d 中心坐标合同，仍不提供作者关卡或解法；新批次归档生成器源码，支持调度前 stopFile。旧调用/中止/失败保留并分上下文统计，Runtime、播放器、Manifest 与正式门禁均未放宽。

- 2026-10-27：按用户指定接入现有 Codex CLI，继承当前认证/模型，独立临时目录、只读/无 shell、记录真实调用与 Token；新增有界生成 → 原始输出完整准入 → 双 SDK 的 CLI Profile，原 HTTP/stdio 60 秒预算保持。初始试跑的 3 次失败保留，补充公共宿主输入源与观察合同后继续执行；不手改生成结果，不自动提升正式 G3。

- 2026-10-27：CLI 接入验证通过，106 Node / 203 Conformance / 360 Schema 文档 PASS。G01 真实独立输出通过完整准入、正反例及双 SDK 工程回放，但截图显示越界/字体问题，独立记录为 CHANGES_REQUIRED，正式 G3 仍 NOT_RUN；其余 36 款分两批继续执行。

- 2026-10-27：优先 37 款独立 G3。新增首轮自然语言任务、通用 Chat Completions JSON 适配、显式调用/任务预算、逐款检查点及任意长度解法/正反例的真实双 SDK 取证。五步本机模型接口夹具通过，批处理拒绝其进入独立候选；105 Node / 203 Conformance / 360 Schema 文档及 Node 22 新增回归通过。来源、人工质量及适用真机保持独立审查，真实生成器未配置，独立 G3 仍 0/37。未改 Runtime/播放器/GameSpec，未调用云端付费模型。

- 2026-10-27：P2 归档与登记前检查落地。37 份逐款档案、74 份正式 NOT_RUN 回执及完整 Schema 通过；冻结 32+5 身份和 10 款设备要求，检查定义/版本/Capability、逻辑/双 SDK/P0 证据、SHA 与源码时效。伪造 PASS 和修改摘要拒绝；102 Node / 203 Conformance / 360 Schema 文档通过。人工/G3/设备未齐，正式验收仍 PARTIAL、0/32＋0/5；未改 Runtime/播放器/GameSpec。

- 2026-10-27：清零目标第一批完成。G15/G28 使用锁定 cannon-es 的共享真实三维刚体求解器，验证反弹/有序双触发、三/四块碰撞堆叠和实际倾覆；Node 22/24 与浏览器状态哈希一致，逐 Tick 世界释放为零。127 份 Manifest，99 Node / 200 Conformance / 360 Schema 文档及 12 组当前浏览器回执通过。必需玩法缺口 17 → 15，继续后两批。

## 2026-10-27 — 连续平台与中立终局

- G11 基础 revision 3、变体 revision 2：连续三平台，中心落点连击奖励、偏心重置和坠落；可选 `platformLanding` 报告实际支撑/偏移并停止漂移。只新增一条必要 Node 回归。
- G24 基础/变体 revision 3：横竖双斜、满盘和棋、同 Tick 终局后落子拒绝；Outcome 允许已有的 `stopped` 中立结束，同步类型/Schema/语义及 01/03/14/18 号规范，不新增 draw GameStatus。
- 5 个必要附加场景由现有 Headless/双 SDK/Conformance 脚本复用；逻辑场景 190、Conformance 200，治理按合同精确核对名称、计数、Hash 与终局/截图证据。148 双 SDK 基础/变体实例及 12 组当前浏览器回执通过；完整质量/G3/真机仍单独待验，正式 verified 仍为 0/32、0/5。

## 2026-10-27 — 三车道跑酷与四向箭头

- G13/H03 基础 revision 3：固定三车道、三段滚动波次、两个有序检查点；H03 真实弹丸击敌、solid 障碍拦截和 TTL/命中回收。可选 `laneCenters`/`projectileHalfSize` 显式兼容增量同步 Manifest、语义、规范及一条必要回归，旧 JSON 行为保持。
- G06 基础 revision 2：3×3 四向射线，含上下阻挡、出界移除和空格重选；三款作者变体 revision 2，仍独立于 G3。
- 185 逐款逻辑场景、148 真实双 SDK 基础/变体实例、虚拟 DOM 双指、G06 实际画布点选、12 组当前浏览器回执与 148 CoverageResult Schema 通过。必需玩法缺口从 22 降至 19 款；完整质量/G3/真机继续分别待验，正式 verified 维持 0/32、0/5。

## 2026-10-27 — 连续拼块与 Flappy 门柱

- 共享 falling-piece 修复出生重叠的判负时序：硬降/重力锁定时即判定顶出，后续输入不能救出；新增一条覆盖硬降、重力和初态重叠的必要回归。
- G09 空 4×8 棋盘连续四格拼块、四行目标及加速/换序变体；G12 真实门柱碰撞、完全越过门柱才计分、死亡不加分与三道门变体。复用现有 Capability，保持完整质量/G3/真机口径。

## 2026-10-26 — 合成生产与三消战斗联动

- G23/H02 revision 3、对应作者变体 revision 2：合成解锁生产/双倍产量，三消付费升级实际影响角色攻击；同 Tick 不透支奖励或提前消费升级。
- 使用现有规则、经济和战斗能力；补充中间数值、提前/重复收集、失败升级和 HUD 检查，保留真实双 SDK 中间画面。独立 G3、完整人工质量与真机口径不变。

## 2026-10-26 — 逐款玩法边界与作者变体

- 37 份独立作者变体、37 个关键边界合同、185 场景 Headless 回放，以及 148 个真实双 SDK 实例回执；完整 verified/G3 不据此升级。
- 增量键盘 hold、屏幕按钮来源 OR、取消/暂停清理、二维移动与 AIR capture 阶段输入；默认点击式绑定保持原行为。
- 逐款棋盘、目标槽、物理/输入区域、标题/数字/HUD 和初始投影可见性修正；变更定义递增 revision。作者布局仅在生成 JSON 时执行，Adapter 继续只消费 PresentationFrame。
- 逐款 G2 复用完整 Schema 后的 SHA 内置目录；动态完整准入/资源/服务重启路径仍独立取证。保留所有失败尝试与历史截图。

## 非真机玩法与接入补齐（2026-10-25）

- 共享塔防固定 Tick、放置/升级/合成、唯一 ID 与武器所有权、冷却继承、路径波次与延后消费奖励；G05/G21/H01 revision 2。
- 9 个作者编写的规则/关卡变体、双 SDK 变体验收入口，以及 HTTP JSON 生成器传输与完整错误边界。93 Node、139 Conformance、303 Schema 文档及当前真实双 SDK 参考证据通过；Node 22/24 各 55/55。独立 G3 与物理设备不据此升级。
- 播放器按目录列出全部 84 份已校验 JSON，支持直接选择/链接进入玩法；带资源关卡继续完整准入。

## S11 初始兼容扩展（2026-10-25）

- 有界重放存档/精确迁移、公开回合本机双人 Host、Gamepad/回退、Node 22/24 回归、Headless 性能与固定 CI。88 Node/121 Conformance/284 Schema 文档及当前真实双 SDK 参考证据通过。
- 修复 UTF-8 子进程区域兼容、G24 任一席位胜利并递增 revision、手柄提示布局、Adapter 状态静态冲突；历史日志和截图保留。物理设备、完整 Gxx/Hxx DoD、独立 G3 和远端 CI 不计完成。


## S10 生成工程（2026-10-25）

- 生成器标准接口、严格 JSON/完整准入、正反例、诊断修复、有界求解与真实双 SDK 逐步调试；82 Node/119 Conformance 通过。工程夹具不计独立 G3。


## S9 参考候选（2026-10-25）

- 32+5 独立 JSON、74 正反例及真实 SDK 场景，命中选择、控制/几何、泡泡、绑定画面与跨域计时；80 Node/119 Conformance 通过。完整 G3/真机与逐款 DoD 不计完成。


## S8 移动输入与回放参考交付（2026-10-24，真机待验收）

- 14 个移动识别 Manifest、静态 state.set 合同及实验 JSON；78 Node、45 Conformance、186 Schema 文档通过。[日志](reports/verify-2026-10-24T15-00-59-220Z-8512/verify.log)。
- 真实 SDK 两端通过 CDP 虚拟触控/姿态、合成 Motion、权限拒绝及临时虚拟上下文授权、校准、停止/暂停、Trace 下载与 Node/浏览器 exactHash 回放、监听器/资源释放；截图已查看。[回执](reports/mobile-2026-10-24T15-04-43-944Z-63356/summary.json)。
- 录制需 JSON 声明及用户显式选择，仅内存保存；结束等待已排队输入消费，4096 样本上限，销毁释放。原 Tap/Swipe 路径和 Trace 金向量保留。详情见 [Mobile Input](specs/v0.1/docs/15-Mobile-Input-V0.1.md)。
- 首两次虚拟姿态运行因 Chromium 默认拒绝权限失败，记录保留，归因 TEST_ENV_PERMISSION；生产拒绝路径正确。测试授权仅作用于销毁即失效的虚拟浏览器上下文。
- ADB 未连接设备，[探测](reports/mobile-device-probe-2026-10-24T15-16-50-835Z.json)。S8 保持 PARTIAL，真机 Gate NOT_RUN，继续不依赖设备的 S9–S11；不把合成输入或 Manifest 注册计为真机完成。

## 2026-10-24 — S7 经营、策略与回合参考机制

- Shared bounded economy/path/turn/card mechanisms; full Gxx and Agent coverage remain separate.
- 18 个真实 SDK 场景、75 Node、44 Conformance 通过；现行证据见 project/status.json。

## 2026-10-24 — S6 固定 Tick 物理与战斗参考 Profile

- Bounded aabb-int-v1 shared 2D motion/physics/combat reference profile; not full Gxx/3D/device coverage.
- 20 个真实 SDK 场景、72 Node、35 Conformance 通过；现行证据见 project/status.json。

## 2026-10-24 — S5 参考库与真实双引擎验收

- 28 份版本化 Manifest、12 份参考 JSON/Conformance；共享匹配、遮挡、翻牌、拼块、分类、方向和单行为 RNG 撤销。旧 JSON/Hash 合同保持不变。
- 70 Node、25 Conformance、82 Schema 文档及 24 个真实 SDK 益智场景通过；12 组 Node/Three/AIR Hash 一致，S2/S4 回归通过。单独游戏/Agent/真机 Gate 不升级。
- 新的浏览器能力索引和通用 Action 按钮，避免按游戏名编写 Adapter。

## S5 益智库（开发中）— 2026-10-24

- 新增三消/连锁、遮挡槽位、配对/翻牌、方向消除、多格放置/落块、整理与连通消除合同和共享算法，补充推箱/滑动的有界撤销与 RNG 恢复；正在收集全套验证与真实 Host 回执，阶段尚未升级。
- 通用动作按钮按 JSON 的语义动作生成，支持嵌套状态 HUD；Adapter 不按游戏名实现玩法。RNG 恢复仅交给可信模块，撤销限定单行为场景，多行为使用完整 Session 快照。

## S4 版本化 2D/3D Visual Stage — 2026-10-24

- 新增独立 Manifest、增量 Schema、语义检查、参考游戏和 Conformance；保留旧 scene2d 语义。支持 Camera、审核纹理/Sprite、原生 Mesh、unlit/PBR Shader 预设、HUD、Tick 动画、有界粒子和事件音频。
- Three.js/CocosAirJS 均使用原生对象和一个 SDK 渲染器；适配器拥有 GPU/音频对象，Session 资源作用域拥有字节/位图/URL，按顺序释放。初始化失败也执行清理。
- 透视与正交/2.5D 两组真实双 SDK 验证通过：实际像素、原生音频节点/时钟、输入/Node Hash、缩放、服务重启、context loss 和释放。暂停 Hash 按相同 Node 操作序列比较，未修改哈希算法。
- 新完整准入 Profile 为 `trusted-reference-host-v1`，允许已声明 Stage 的 3D 定义；旧 Profile 重新导入升级，协议仍为 `0.1.0`。下一步 S5；全 32+5、Agent 和真机 Gate 不升级。

## S3 审核资源与内容交付 — 2026-10-24

- 完成当前宿主 Profile 的资源白名单、来源/许可与字节级 SHA 校验、资源预算和统一释放；新增可复现的 CC0 PNG/WAV 参考资源。上传不能注册资源或发起任意下载。
- 新 Profile `scene2d-trusted-assets-v1` 增加资源清单摘要；旧记录保留，原 JSON 重新完整准入。GameSpec/Capability 仍为 `0.1.0`。
- 新增内容包导出/导入与接收方完整重验，提供文件/HTTP 交付；接收方需要自己审核的匹配资源，发送者元数据不授予信任。未部署远程服务，不包含账户/签名。
- 真实双 SDK 的资源解码/释放、包迁移、Node Hash 与重启通过；原 G2 16+2 场景复验通过。S3 按当前宿主 Profile 交付，后续 S4–S11 与完整覆盖 Gate 不变。

## S3 本地回执持久化 — 2026-10-24

- 播放器服务默认保存按校验环境/内容 SHA 寻址的本地发布记录；服务重启后首次读取重新完整校验，原回执与内容不变。可用 `A2GAME_CONTENT_DIR` 指定私有存储目录，默认数据不入库。
- 使用独占临时文件、文件同步和同目录原子重命名，兼容当前 exFAT 工作盘；损坏记录、环境失配、存储故障和容量满时明确拒绝，保留旧环境记录。当前限定单服务写入，无远程签名或断电持久性声明。
- 增加 2 条必要存储回归；扩展真实双 SDK `content:e2e`，验证实际 HTTP 进程退出/重启、回执和初始 Hash 不变及继续输入。回执：[summary.json](reports/content-2026-10-24T13-03-06-871Z-54276/summary.json)；原 G2 16+2 场景复验通过。
- S3 保持 PARTIAL，后续为资源来源/完整性与远程交付，再扩展 S4。

## S3 本地动态 JSON 准入 — 2026-10-24

- 新增同源 `POST/GET /api/releases`、完整 Draft 2020-12 校验、配置/语义/能力与宿主策略检查，以及带内容、Manifest 和环境 SHA 的进程内回执；校验器缺失或环境变化时拒绝发布。
- 播放器增加 JSON 文件导入、错误诊断与失败后恢复；动态内容可在真实 Three.js/CocosAirJS 间切换，内置样例保留原 SHA 白名单。
- 修复 `SPEC_CONFLICT INPUT-CONFIG-001`，使 Tap/Keyboard Manifest 配置与已有样例/运行时契约一致；同步生成器与规范并增加正反例。GameSpec/Capability 仍为 `0.1.0`。
- 新增 6 条必要回归与可复用 `content:e2e`。新三次点击变体在两端与 Node Hash 一致，负例恢复、画面、切换与释放通过；原 G2 16+2 场景、8 组 Hash 复验通过。详见[准入契约](docs/content-release.md)、[动态内容回执](reports/content-2026-10-24T12-36-07-539Z-56252/summary.json)和[项目状态](PROJECT-STATUS.md)。
- S3 保持 PARTIAL：当前仅单场景 scene2d、已有能力、无资源的本地进程回执；资源管理与持久化/远程发布仍待实施，未增加全目录 verified 数。

## 协议目录迁移 — 2026-10-24

- 将协议包从 `A2Game-V0.1-Spec/` 迁移到 `specs/v0.1/`，保留 docs/schemas/samples、版本工具及历史协议内容；GameSpec/Capability 版本仍为 `0.1.0`。
- 同步规范校验、Headless 注册、播放器 HTTP URL、SHA 白名单、测试、文档导航与 CoverageRegistry 路径；旧报告/Trace 和历史文档中的原始路径保留，不改写历史证据。
- 迁移后重新采集真实 SDK G2：16 个游戏/视口场景、2 个原生时钟/context loss 场景及 8 组跨引擎哈希全部通过；`npm run verify` 通过。49 文件完整迁移，36 个 Schema/样例文件及 4 份游戏白名单内容哈希不变。
- 迁移校验与仓库日志见 `reports/spec-layout-2026-10-24T12-06-54-319Z/`；旧报告/Trace 内容保持原样，当前 G2 指针更新至新目录运行。

## S2 真实双引擎 G2 参考子集 — 2026-10-24

- 使用真实 Three.js `0.186.1`、CocosAirJS `fa54a3f6942bfb3035d5c92d174a054ec4ab55ab` 本地构建（Build 209）、Chromium `156.0.8078.4`，通过 HTTP 加载相同的四份预验证 JSON。
- 16 个游戏/视口/DPR 场景、2 个原生时钟/context loss 场景通过；8 组 Node/Three/AIR exactHash 一致。保存截图、像素探针、DOM 输入操作、Trace、SDK SHA、源码指纹及物理关闭回执。
- 修复 Three.js 长文本裁切、指令绘制顺序、重建时绘制已释放实例、context loss 后旧 WebGL 资源清理；修复 AIR 容器尺寸、缩放和矢量/文本顺序。首帧预热后再启动玩法时钟。
- 显式 `clock=manual` 测试模式替换玩法时钟并支持 `advanceTime`，渲染仍随 rAF 更新；普通页面保留单一生产 Tick。监听器可统一撤销，销毁幂等，AIR 使用官方 `close()` 并按契约受控重载。
- 新增 `sdk:prepare`、`g2:real`、SDK 来源锁与证据检查；失败和已被新修复取代的历史运行全部保留。
- 验收范围是 `scene2d` 四样例；实际 WebGL2 使用 ANGLE/SwiftShader，未验证物理 GPU/真机 Touch/IMU、完整玩法目录及 Agent G3。AIR 运行时/内置缓存由上游保留，不声称总 GPU 内存零泄漏。
- 当前回执：`reports/g2-threejs-real.json`、`reports/g2-cocosairjs-real.json`；详细交付见 `reports/g2-implementation-20261024.md`。

## 工程基线整理 — 2026-10-24

- 补充 `AGENTS.md` 的源码导航、安装/验证入口和真实 G2 交接约束。
- 新增 `.gitignore`，排除依赖、可重建 `dist/`、本地 Python 环境、下载 SDK 和临时浏览器产物；保留所有既有规范与验收证据。
- 纳入 npm 锁文件；Git 检出可使用 `npm ci`。真实 SDK 阶段在工程基线提交后继续推进，不据此升级 Gate。

## 1.0.0 — 2026-10-24（当前参考发行版本）

- 将原 V0.3 实施包作为 `1.0.0` **参考工作区版本**重新发布；`package.json` 和播放器展示统一使用 `1.0.0`。
- **不修改** GameSpec / Capability Manifest `0.1.0` 协议含义与版本；旧 V0.1/V0.2/V0.3 文档与日志保留为历史资料。
- 重写 README 为 Windows PowerShell 优先的完整上手、构建、测试、运行、SDK 安装、问题排查指南。
- 新增 `PROJECT-PLAN.md`（全部长期计划）、`PROJECT-STATUS.md`（当期真实 Gate）、`project/status.json`（机器可读阶段状态）、`AGENTS.md`（Agent 不偏航约束）、`scripts/check-project.mjs`（状态与覆盖一致性检查）。
- 无新玩法或新 SDK 通过声明；项目成熟度仍为 Alpha/Reference，CocosAirJS/Three.js 实际 G2 仍未执行。

## 历史基线（仅供追溯）

- V0.3：声明式 `scene2d`、GridPush、Swipe/InputTrace、Canvas2D Chromium 预览、双适配器 Mock 合同。
- V0.2：JCS/SHA256 状态哈希、完整静态 Schema、浏览器桥接预览。
- V0.1：Rule/State/Tick/Headless/初版 Conformance 与 GridSlideMerge。

历史实施报告：`IMPLEMENTATION-REPORT.md`；历史未来清单：`IMPLEMENTATION-NEXT.md`；原规范：`A2Game-V0.1-Spec/`。

- 2026-10-27：清零第二批完成 G02/G16/G18/G19/G20/G22/H05。标准 2048/4096 整局与无路失败、支撑链/持续越线、绕墙瞄准、三波技能到期、反弹吸附预览、农场 JSON 持久化/真实重载和找物资源拖放倒计时通过双 SDK；修正两端图片上传方向与透明边缘。100 Node / 200 Conformance / 360 Schema 文档、12 组当前浏览器证据通过。必需缺口 15 → 8。

- 2026-10-27：完整长局避免重复读取完整 Observation 来取 Tick，并消除手动模式的空闲绘制；真实时钟调度保持原合同。对照脚本只重放最近一次完整重开后的操作，并以完整游戏/输入摘要缓存已算出的 Node 状态。

- 2026-10-27：H05 窄屏实际拖放增加 `camera.fitSize` 正交范围适配，两个 SDK 保持图片/2D 命中框一致；画布获得焦点时不滚动页面，修正首次拖动目标偏移。

- 长作者回放保留全部逐步 Hash/状态断言、原始操作及显式画面，关闭可选的逐操作 Playwright DOM/视频缩略快照；避免调试附件放大为数千份重复页面记录。

- 2026-10-27：清零第三批完成。8 款基础/变体 × 双 SDK 的 32 个原始输入流程、193 逻辑场景、101 Node / 203 Conformance / 360 Schema 文档及 12 组当前浏览器回执通过。trackSample/clearLostImu/cancelClearsPower 为显式兼容增量；唯一 Tick 失联、重校准清零、动态水果漏果和 Runtime 输入/事件缓存释放均已补齐。必需玩法缺口 8 → 0；完整质量、独立 G3 与物理设备继续分别验收，正式 verified 仍 0/32、0/5。

- 2026-10-27：P0 共用体验修正及 37 款 AI/浏览器质量实测完成。基础双 SDK 222 个布局检查、148 基础/变体实例、32 原始输入流程，G13/H03 正式时钟 4 流程及 12 组当前浏览器回执通过。补中文按钮/状态与结果重试说明、画面邻近操作区、44px 目标、缩放、按声明展示传感器/录制、折叠诊断及手动 resize 布局时序；不改变玩法 JSON 或 Hash 语义。人工质量、独立 G3、真机仍独立待验，正式 verified 保持 0/32、0/5。

- P2 归档可移植性修正：将两份新脚本的本地换行统一为 LF 并生成新档案，保留旧档案；实际 Git clean-filter 与工作区摘要一致性检查通过，避免换机检出后误报证据变化。

- 2026-10-28：37款独立版本的真实双SDK主输入及逐款AI参考审查收口；35份纯表现不变量、G32原始多指规则修复、G07背面隐藏、G31转屏重校准及按钮回退分别留证。累计168次生成与1次探测；3,332文件SHA档案通过，正式G3/人工/设备未提升。

- 2026-10-28：输入/AI参考阶段工程115/115 Node、203/203 Conformance、360份Schema文档通过，日志 reports/verify-2026-10-28T11-28-16-892Z-28720/verify.log。首次全并发内容发布503保留，测试文件并发限制为2后完整复测通过；未提高8秒校验上限或删减测试。Actions额度超出由用户确认，改为手动默认单任务、可选四组合/SDK、取消旧运行及3天产物；证据恢复工具3项回归已纳入。

2026-10-28 源码恢复实测完成：全新源码目录独立npm ci，Node22.23.4，恢复前门禁拒绝；8,138份原始证据（679,838,647字节，压缩393,230,709字节）SHA恢复、重复恢复与验证后再恢复通过。完整115 Node/203 Conformance/360 Schema、G3 3,332文件及P2只读审计通过。详见 `project/evidence-restoration-run.json` 与 `project/evidence-lock.json`。正式G3仍0/37，verified仍0/32＋0/5；远端未重跑，额度与可信证据托管仍为外部前提。

2026-10-29 Generator Batch A 回归：最终源码独立 smoke 通过；完整 `npm run verify` 通过（125 Node、360 Schema、203 Conformance），旧回执恢复。双 SDK 预览 HTTP 与关闭监听通过，实际渲染仍 NOT_RUN；真实模型调用 0，Batch A 保持 PARTIAL。详见 [Generator 台账](project/generator-status.json)。
