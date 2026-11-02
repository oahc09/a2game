# MCP / CLI 双通道

MCP 先 `tools/list` 确认工具真的可用。先调用 `a2game.list_capabilities`（query、limit、offset），再用完整 id/version 调用 `a2game.get_capability`。`a2game.plan_game({prompt})` 不调用模型。

编写前使用客户端的 `resources/list` / `resources/read` 读取 `a2game://spec/0.1.0/` 下的 GameSpec、Conformance、Capability Schema、HostProfile 与非可执行片段。只选择服务实际列出的 URI；核对 envelope 的 specVersion、bytes、sha256（绑定 content 原文）。客户端不支持 Resources 时如实记录，由可信控制端提供公开 capsule，不读取基准关卡或解法。

验证失败按 `diagnostics` 的 `stage/jsonPointer/capabilityId/ruleId/caseId/expected/actual/repairHint` 修同一稿，保留失败，缺失字段不猜。严格评测先由可信控制端创建run并以 `--host-run-id` 绑定专用服务；所有失败计入三次候选上限。旧未绑定服务可用但不能成为完整run证明。公开目录并非强隔离，必须实际通过受控沙箱/宿主边界验证才能声称答案不可读。

已有 JSON 的最小闭环：

1. `a2game.validate_game({gameJson, conformanceJson, solutionJson})`，三个字段均为原始 JSON 字符串。
2. 取得返回的 `data.artifactId`，调用 `a2game.test_game({artifactId})` 与 `a2game.inspect_game({artifactId})`。
3. `a2game.preview_game({action:"open",artifactId,backend:"air"})`，另一端使用 `three`；在返回的 loopback URL 实际操作。使用后 `a2game.preview_game({action:"close",previewId})`。
4. `a2game.export_game({artifactId,format:"package"})`，取路径及 SHA。会话 artifactId 不跨服务进程重启保存。

需要代调用时单独 `a2game.generate_game({prompt,provider,mode,maxAttempts})`。Provider/配置/总额度由启动者固定；默认无调用额度。不要把 API key、命令或配置文件路径传入 Tool。

CLI 降级，在项目根目录执行（也可用实际已安装的 `a2game`）：

```powershell
node generator/cli.mjs --help
node generator/cli.mjs capabilities --query puzzle --json
node generator/cli.mjs capability --id a2game.puzzle.grid-push --cap-version 0.1.0 --json
node generator/cli.mjs validate output/my-game/game.json --json
node generator/cli.mjs test output/my-game --json
node generator/cli.mjs preview output/my-game --backend air
node generator/cli.mjs preview output/my-game --backend three
node generator/cli.mjs export-package output/my-game --output output/my-game.package.json --json
```

`output/my-game/` 含 `game.json`、`conformance.json`、`solution.json`，可附 `game-plan.json`。命令没有授权模型调用，不能自行增加 generate。预览命令持续占用终端，结束时正常中断以关闭监听。只有校验不需要自行补充第三方模型。

若要创建独立练习，可要求“设计一个有清晰目标和至少一个未完成反例的单屏小游戏”，自行查询能力并写新 JSON；不使用冻结 Benchmark/G3 的作者标准答案。明确标注练习的作者和实际生成来源。
