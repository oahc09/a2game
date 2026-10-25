# 模型无关生成与修复工作流

本工程合同 `a2game-generation-request/output` v1 独立于 GameSpec `0.1.0`。它提供生成与修复工具，不自行声称已通过 G3。

调用：`node scripts/agent-workflow.mjs <本机生成器配置.json>`。配置包含 `prompt`、`command`（可执行文件及参数数组）、可选 `maxAttempts`（1–3）、`timeoutMs`（100–60000）、`solverBudget`。命令由操作者配置，不能来自 GameSpec 或模型输出；以 `shell:false` 启动。不得在配置、提示、参数中填写密钥；认证由生成器自己的宿主环境管理，核心工作流不读取或公开凭据。

生成器从 stdin 接收单个 JSON 请求，stdout 返回单个 UTF-8 JSON 输出。请求包含提示、协议版本、能力及精确版本、依赖和参数合同、完整 GameSpec/Conformance Schema、上一次错误及最多 20 条 JSON Pointer 诊断。stdout 最大 768 KiB、游戏 256 KiB、每次进程最多 60 秒。stderr 只记录字节数；不回显其中可能含的环境数据。进程启动/超时/退出归 INFRA；内容、规则、解法失败归 AGENT_STRATEGY；真实 Host 失败另归 Engine/Host。

输出包含 `format: "a2game-generation-output"`、`version:1`、`game`、`conformance`、`provenance:{kind,model}`，可选 `solution`。`kind` 只能为 `fixture` 或 `independent-model`。该身份是供应者自报，不能单独成为独立性或 G3 的证明。

先走内容服务的完整 Draft 2020-12、能力与语义准入，再完整校验 Conformance Schema。至少需要成功及负例的终局断言；随后在共享 Runtime 执行。没有解法时，可用按钮 BFS 在最多 1024 节点、16 深度内搜索。预算用尽输出 `BUDGET_EXHAUSTED`，不能断言无解。提供的解法最多 256 步、12000 Tick，执行后必须获胜，并由第二个 Session 重放得到相同 Hash。不会执行模型提供的脚本、命令、URL 或自定义断言代码。

每次使用新 reports 目录，保留提示/输出、错误、修复次数、耗时、内容回执、正反例和解法。输出 `debug-bundle.json` 可在 `/player/inspect.html` 导入，按操作逐步回放或重开后跳转，显示 Tick/状态/Hash，并可切换真实 SDK。HTML 调试器导入仍走完整准入。

解法长度、Tick 数和搜索成本仅是未校准的难度代理；不代替人类可玩性、视觉交互或完整游戏质量评估。仓库 `test/fixtures/agent-provider.mjs` 专门验证有界修复链，明确为确定性夹具，不计 one-shot 独立模型证据。正式 G3 仍需操作者提供独立生成器、保留模型/提示/变体/成本，并完成每款完整 DoD 及适用真机验收。真实生成器未配置时保持 `NOT_RUN`。

## HTTP 生成器接入

已有 HTTP 服务可以直接使用 `scripts/http-generator.mjs`，无需另写 stdin/stdout 包装。将 `project/http-generator.example.json` 复制为本机配置，填写返回上述 output 合同的 endpoint；随后在工作流配置的 command 中使用 `["node", "scripts/http-generator.mjs", "本机HTTP配置.json"]`。接口接收完整 generation-request，原样保留修复上下文，返回单个 JSON。

远端仅允许 HTTPS，本机允许 loopback HTTP；不跟随重定向。URL 禁止用户名/密码，限制请求 2 MiB、响应 768 KiB、HTTP 总耗时最多 55 秒（默认 50 秒，需小于外层进程预算），严格检查 UTF-8 与 JSON 媒体类型。原始正文交给既有严格解析器处理，禁止传输层悄悄修复重复键。可选 `bearerTokenEnv` 只能填写调用方显式提供的环境变量名称，适配器只在运行时读取这一项，不写入回执；密钥本身不得写入配置。供应者仍需返回真实 provenance，传输方式不改变独立性或 G3 判定。

本机 HTTP 测试仅验证中文与修复上下文、响应原文、HTTP/重定向/大小/超时/编码拒绝，不计独立生成器证据。当前没有已提供的真实生成服务地址，G3 保持 NOT_RUN。
