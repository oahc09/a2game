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
```

`fixture` 总是构造相同的三步计数游戏，只验证工程链，不理解提示词，不属于独立模型生成。`inspect` 打开现有 Inspector，再手动导入产物目录的 `debug-bundle.json`。预览只绑定 `127.0.0.1`，`Ctrl+C` 结束监听；缺 SDK 返回 `BLOCKED`，不会自动改用 Canvas2D。本轮尚未执行新游戏的浏览器视觉验收。

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

当前仅支持 `direct-json`；`game-plan` 返回 `BLOCKED`，不进行隐式替代。Studio、便携资源包、两模式评测属于后续批次。这里的 `PASS_REFERENCE` 不升级既有正式 G3、人工质量或真机验收。
