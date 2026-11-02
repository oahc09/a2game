# 四宿主显式全通路任务

执行宿主：由用户填写 `qoder`、`trae`、`workbuddy` 或 `zcode`。

目标：宿主原生 Agent 独立创作一款新的 G01 推箱子，使用现有 A2Game MCP 完成能力查询、完整准入、正反例/解法测试、双 SDK 实际预览、资源关闭和内容包导出。每宿主最多3份候选（含初稿），不使用另一个模型，不调用 `generate_game`。宿主原生用量另计；MCP Provider 预算0。

## 启动条件

- 先在宿主 MCP 面板重连 A2Game，使新版调用记录生效；不修改模型路由、用户级配置或额度。
- 项目 Skill 已从唯一来源安装：WorkBuddy代码项目使用 `.codebuddy/skills/a2game/`；Qoder/ZCode使用 `.agents/skills/a2game/`；TRAE使用 `.trae/skills/a2game/`。新建会话后核实 Skill 可见。WorkBuddy 即使未自动加载，也可显式读取 `integrations/skill/a2game/SKILL.md` 完成操作，但应标记自动发现未过。
- Qoder回执披露的本地路由密钥暴露需用户先按宿主方式重置，再开始新的原生模型生成。本任务不读取、打印或操作该密钥。
- 宿主/模型版本只记录会话界面或可执行文件版本的安全来源，未知填 `UNKNOWN`。禁止扫描宿主路由、认证、完整配置、无关日志或环境变量来补版本；不得输出凭据。

## 建立独立产物目录

在 a2game 根目录执行，替换宿主名：

```powershell
node scripts/host-agent-run.mjs init workbuddy
```

返回新的 `run` 路径，下文用 `<RUN>` 表示。每次运行唯一UTC时间和UUID，四宿主不覆盖彼此。该目录已有公开 `schemas/`，不含作者关卡和解法；`candidate/` 用于本宿主新作品。

如果任务已经提供一个准备好的 `<RUN>` 或你正在读取该目录内的TASK.md，直接复用它，不再执行init。不要复用其他宿主或已完成的运行目录。

本任务是显式触发，不能计作新会话自然语言隐式发现。当前宿主仍有仓库访问权，不能声明强沙箱隔离或独立身份认证。不要阅读已有 G01 JSON、solver答案、旧生成结果及其他宿主产物。

## 通过宿主 MCP 执行

1. 使用当前宿主自己的工具发现/搜索机制，记录真实工具别名。调用 `list_capabilities` 查询推箱子相关能力，再用返回的完整id和版本调用 `get_capability`。可阅读 `<RUN>/schemas/` 和公开能力合同；不要凭空编造能力字段。
2. 独立设计可玩的新推箱子关卡：方向移动、墙壁、箱子、目标格、合法推动、非法推动不改变状态、全部箱子到位后获胜、可重开。必须通过实际输入完成游戏，不使用计数按钮替代玩法。
3. 在 `<RUN>/candidate/attempt-1/` 写 `game.json`、`conformance.json`、`solution.json`，Conformance含成功及未完成/非法推动负例。修复候选另存 attempt-2/3，保留失败稿，不改仓库源码/Schema/参考答案来迁就输出。
4. 调用宿主 `validate_game`，把三个文件的完整原始JSON文本分别作为 `gameJson`、`conformanceJson`、`solutionJson`，不传文件路径。使用服务返回的当前会话 `artifactId` 调用 `test_game`、`inspect_game`。最多3次准入候选，失败按实际诊断修复；用尽仍失败如实停止。
5. 分别调用 `preview_game({action:"open",artifactId,backend:"air"})` 和 `backend:"three"`。预览限时，逐个打开并及时使用。用宿主可用的浏览器工具打开返回的URL，在画布实际执行方向键/Pointer输入，检查非法推动、进行中、获胜、暂停、重开与窄屏可读性，保存截图、状态Hash和控制台错误。
6. 对每个打开的预览在 `finally` 中调用 `preview_game({action:"close",previewId})`，只关闭本轮创建的预览。先准备操作序列再打开，避免默认120秒TTL耗在分析和归档上；成功open即使客户端未收到也要依据服务端回执核对其previewId。到期后补close保留真实 `closeReason:"expired"`，不能当显式关闭成功；另开再关不能补成旧实例的关闭证据。无法实际浏览器交互时标 `browserInputAndVisual=NOT_RUN/BLOCKED`，不能用打开URL或服务READY代替实际试玩。
7. 调用 `export_game({artifactId,format:"package"})`，核对实际包路径和SHA；它是内容包，接收方仍需兼容Runtime、SDK和审核资源。

## 每次调用后保存服务端原始证据

每个 MCP 响应均有 `runId`。直接执行下列命令复制服务端原字节，不手抄、移动字段或重写描述：

```powershell
node scripts/host-agent-run.mjs capture <RUN> <响应runId>
```

该命令不会再调用MCP或模型；它定位已有 `output/mcp/<sessionId>/<runId>.receipt.json`，连同 `.call.json` 复制到本轮 `calls/`，核对操作、会话与预算。成功和失败都保留。它返回规范结果中的 artifactId/previewId/URL/包路径供下一步使用。

若宿主支持直接导出自身返回，把原文先保存在 `<RUN>` 内，再传相对于该目录的文件名：

```powershell
node scripts/host-agent-run.mjs capture <RUN> <响应runId> host-response.txt
```

服务端证据与宿主返回分开标识；无法导出宿主原文时保持 `NOT_CAPTURED`。服务端原文不能冒充宿主原始输出，也不证明模型身份。若提示缺少 `.call.json`，重连MCP后重新开始调用，旧材料不覆盖。

## 检查并交付

```powershell
node scripts/host-agent-run.mjs check <RUN>
```

此检查逐一要求每个已导出artifact的validate/test/inspect/export和两端open/close属于同一服务会话；能力查询也须属于该会话。所有本轮已归档的成功open都必须有同previewId的显式close，不能只选一个成功对掩盖旧实例。检查会核对receipt.json中声明的runId、发现已有服务端同artifact/preview的漏存调用，并报告缺失或尚未完成的capture、宿主响应错配；发现这些缺口时返回PARTIAL。补归档后重跑即可，不需新增模型调用。服务重启后旧artifactId失效，不能拼接不同会话结果。

`check`返回PARTIAL时进程退出码为1。`mcpLoopStatus=PASS_REFERENCE`只表示MCP链路，真实画面/输入/Hash/资源证据仍须单独保存和审查。若需由主审独立重验候选，可执行：

```powershell
node scripts/mcp-smoke.mjs <RUN>/candidate/attempt-1
```

它使用独立本地客户端和真实双SDK，不新增模型调用；不能替代宿主通道来源证明。缺少生成报告可重验，但生成身份保持未认证。只支持当前参考工具覆盖的button动作解法，其他输入须独立验证，不擅自改写候选或缩减需求。

最后在 `<RUN>/receipt.json` 报告实际宿主/模型标签来源、候选次数、每个MCP调用runId、最终包路径及SHA、双SDK浏览器结果、截图路径、失败链、宿主用量（未知为UNKNOWN）和未完成项。只写本轮目录，不改共享源码/台账/配置，不安装依赖，不提交/推送。完成工程闭环不自动升级正式G3、人工、真机或远端CI。
