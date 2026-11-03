# 本地 MCP 与可分发 Skill

MCP 是现有 Generator/Content Service 的窄适配层，不新增 GameSpec 方言，不修改 Runtime 或模型路由。`mcpToolContractVersion: 1` 与工作区1.0.0、协议0.1.0分别记录。使用锁定的 `@modelcontextprotocol/sdk@1.32.2`（MIT）、`zod@4.6.7`（MIT）和`integrations/mcp/package-lock.json`；依赖安装禁用生命周期脚本。初次依赖审查发现旧Zod集合验证内存漏洞，已升级修复版本，最终audit无已知漏洞；保留检查日志。MCP依赖独立安装，根Runtime的package-lock保持原字节，避免把集成依赖混入旧游戏证据的环境。

SDK采用[官方 stdio transport / registerTool](https://ts.sdk.modelcontextprotocol.io/server)，客户端使用[官方 Client / StdioClientTransport](https://ts.sdk.modelcontextprotocol.io/client)。本轮实际握手协议2025-11-25；不声称全部历史或未来版本兼容。

从项目根目录启动（由宿主以本机Node22+拉起，stdout仅MCP消息）：

```powershell
npm ci
npm ci --prefix integrations/mcp --ignore-scripts
npm run build
node scripts/mcp-server.mjs
```

默认没有Provider调用额度，list/get/plan/validate/test/preview/inspect/export均不调用模型。宿主Agent自己生成JSON时直接传入validate，不再委托生成器二次调用模型。客户端配置示意，路径需换成本机已有Node和仓库；此文档不自动修改全局配置：

```json
{"mcpServers":{"a2game":{"command":"node","args":["E:/path/to/a2game/scripts/mcp-server.mjs"],"cwd":"E:/path/to/a2game"}}}
```

已获授权需要代调用时，由启动者配置 `--provider codex --provider-config .a2game/codex-generator.json --max-calls 3`；示例不是本会话追加授权。Provider和配置不能通过Tool入参更改，默认模型路由继承原CLI。单元默认最多3尝试；MCP不开放本轮Benchmark特殊的第4次续修接口。

| Tool | 主要输入 | 行为 |
|---|---|---|
| a2game.list_capabilities | query、offset、limit≤20 | 当前受信Registry的Headless参考能力列表；平台支持仍需Host协商 |
| a2game.get_capability | id、version | 完整公开能力合同/依赖 |
| a2game.plan_game | prompt | 宿主关键词草案，无模型 |
| a2game.generate_game | prompt、provider、mode、maxAttempts≤3 | 仅固定Provider和显式可用额度 |
| a2game.validate_game | gameJson，可附conformanceJson+solutionJson | 完整准入，创建不可变artifactId |
| a2game.test_game | artifactId | 完整Conformance、自解、Hash和生命周期 |
| a2game.preview_game | action=open、artifactId、backend；close用previewId | 返回真实SDK loopback URL；显式关闭 |
| a2game.inspect_game | artifactId | SHA/测试/初始与完成Hash/活动预览摘要 |
| a2game.export_game | artifactId、format=package | 测试通过后新建内容包，拒绝覆盖 |

Artifact只在当前服务会话可引用；内容仍保存在`output/mcp/<sessionUUID>/`，重启后不自动信任旧ID。`validate_game`的JSON字段为原始字符串，保持完整Validator的重复键检查。每次请求返回runId/状态/诊断；业务诊断为受控中文说明和错误码，不回显凭据/本机绝对路径。工具Schema错误、未知Tool属于SDK协议层拒绝，可能没有业务structuredContent，客户端应先检查isError。

接口无任意路径、shell、HTTP fetch、凭据或Git操作。所有artifact通过UUID映射并重检文件SHA和符号链接；导出仅返回仓库相对路径。输入帧≤1MiB，业务输入≤768KiB，结果≤256KiB；单会话最多256请求、32签发artifact、约32MiB内容区（单次准入有界超出至下一次检查），最多1个操作、2个预览。默认操作120秒、预览120秒自动关闭；启动者可将操作时间设为100–600000ms。取消/断开会中止本会话worker，关闭预览监听；不影响其他运行。私有Generator工作目录仍沿用Generator自身限制，不是自动清理历史证据。

预览关闭保留原始原因 `closeReason`（explicit/expired/cancelled/shutdown）；重复关闭同一实例返回 `alreadyClosed:true`，不将到期回收改写成显式关闭。生命周期事件单独保存在该服务会话目录，关闭返回 `lifecyclePath` 供审查；只表示预览服务的回收，浏览器SDK对象释放仍需独立证据。仅启动者可用 `--preview-ttl-ms` 在100–300000ms内配置TTL，默认不变，模型Tool参数不能调整。宿主30秒客户端超时与服务端操作时间独立：不要盲目重开预览，先核对已有服务端回执并处理实例；本实现不修改宿主用户设置或8秒完整准入上限。

`npm run mcp:check`运行官方SDK客户端与标准库Python独立客户端，交付外部JSON、CLI对照、真实双SDK来源输入/Hash/重开/释放及负例。练习JSON明确为宿主编写，不是模型验收。`npm run generator:smoke`在无SDK、无旧报告的新源码环境复验MCP无模型闭环，缺SDK必须BLOCKED。测试回执不等于两个真实Agent产品界面均已完成接入。

`npm run mcp:check -- output/<已经生成的目录>`可原样复验外部模型JSON，记录原生成报告与JSON的SHA；不调用Provider、不改变原成绩。当前按钮/等待解法有真实键盘或可见DOM按钮逐步Hash比对；raw/analog不冒充物理输入。完整Node测试按文件串行执行，以减少本机多Validator进程争用导致的8秒完整校验超时；不增加超时、不跳过失败或更改门禁。

Skill源码在`integrations/skill/a2game/`，`python scripts/package-a2game-skill.py`生成不覆盖旧文件的ZIP及SHA，只打包不全局安装。已有 ZCode 项目级 `.agents/skills/a2game/` 安装记录和宿主编写 JSON 的无模型流程回执；[宿主回执](../reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/host-integration-receipt.json)明确新会话的自动发现和触发仍未验证。宿主练习、Skill 自动触发和真实 Provider 分别计数，不互相替代；不自行追加真实模型预算。

2026-11-01 原始证据：成功与失败响应保存到 output/mcp/<sessionUUID>/<runId>.receipt.json，配套.call.json记录方法、会话、已验证的artifact/preview/backend参数、参数SHA及预算，不保存原始参数正文或环境。重连后生效。node scripts/host-agent-run.mjs capture <run> <runId>只归档已有服务端原字节，不另发工具或模型调用；宿主返回另存比较，不能把服务端回执冒充宿主导出。modelCalls仍位于响应data内，不增加根部字段。完整操作见[四宿主显式Pilot](host-agent-pilot.md)。


## Host-first 增量合同（Tool contract 1 兼容扩展）

仍为原9个Tool，旧参数/返回基础字段保留。新增可选诊断字段 `jsonPointer/capabilityId/ruleId/caseId/expected/actual/repairHint`：CLI与MCP共享白名单投影，最多20项，只公开有界安全标量，未知值省略，不回传provider正文/stack/任意对象。支持完整Schema、语义、Conformance/解法与基础设施归因，真实宿主自主修复仍需独立验收。

`resources/list` 提供固定只读URI，`resources/read` 拒绝任意路径、未知版本和未注册URI：
- `a2game://spec/0.1.0/game.schema.json`
- `a2game://spec/0.1.0/test-suite.schema.json`
- `a2game://spec/0.1.0/capability.schema.json`
- `a2game://spec/0.1.0/host-profile.json`
- `a2game://spec/0.1.0/contract-fragments.json`

返回JSON envelope包含版本、URI、`content`原文、UTF-8 `bytes`和`sha256`（绑定原文，不是envelope），内容最大256KiB。片段不可执行、不含基准关卡或正确解法。不能加载Resources的客户端应明确记录限制，不把规范缺失归罪于模型。

`export_game.data.format` 与实际包一致为 `a2game-generator-package`；接收端仍须完整重验。严格Host归档需启动参数 `--host-run-id <UUID>`；未绑定的历史客户端继续可用，但不能证明本轮完整调用链。具体run隔离和归档见 `host-agent-pilot.md`。
