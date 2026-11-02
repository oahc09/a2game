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


独立 mechanics gate（仅显式选择上述工程 Profile）：作者另写 `mechanics.json`，控制端使用 `check-illegal-undo.mjs`，不是第十个 MCP Tool。声明严格字段为 `format/version/profile/sceneId/entityId/componentIndex/coreStatePaths/legalPrefix/illegalAction/illegalKind/undoAction`；format=`a2game-illegal-undo-check`，version=1，profile=`grid-push-illegal-undo-v1`。`legalPrefix` 是 1–128 个真实方向 action ID，每项按 press→release→1 Tick；`illegalKind` 为 blocked-push 或 blocked-move，控制端要求 blocked-push 时前者才合格。coreStatePaths 必须完整等于所选组件配置的四条 playerPath/boxesPath/movesPath/solvedPath，history 与 undo 从真实组件绑定，不猜字段名字。

报告中的 `trace` 为实际执行的 `{action,ticks:1,phase,expectedHash,flowStatus}`，包括 legal-prefix/illegal/undo；失败也保留已执行前缀，不丢弃。将它用作控制端衍生的双 SDK 验证轨迹，明确记录不是模型自报结果。`implementationSha256` 与 `implementationSha256After` 必须相等；旧源码结果或不同 JSON 不能沿用。

## 输入、判负与画面反馈（兼容增量）

- `injectAction` 的 `hold` 不是起始按下：同一 action/sourceId 必须已有未释放的 `press`；`release/cancel` 结束持有，暂停清空持有来源。原始键盘用 `down/up` 且绑定 `config.hold:true`；solution 的普通 action 行是 press→release 的点击，不是持续按住。失败用例的 `input.hold-without-press` 是有界诊断，不改变游戏状态、Hash 或输入接受语义。
- 失败路线若声称失败，必须真实执行并显式断言 `/flow/status` 等于 `lost`。`conformance.loss-status-mismatch` 给出实际状态；检查判负条件、优先级和输入时序，不为过测把原本要求失败的场景改成 `playing`。没有失败机制的游戏可保留合理 `playing` 负例，不强制发明 `lost`。
- 执行逻辑 Tick `n` 后，观察值 `tickIndex` 是 `n+1`（初始为0）。塔防仅在有目标且 `nextFire <= n` 时开火，成功后设为 `n + cooldownTicks`；无目标不消耗冷却。合成先于武器阶段，新冷却取当前Tick与两旧值的最大值；已到期可同Tick开火，未到期不能提前。用实际事件/状态验证，不能把作者预计的Tick当事实。

实际预览的结构化文字反馈：

1. 每次调整viewport后重新读取 `window.__a2game.getTextReadability({referenceCssPx:16})` 并实际查看初始/中间/终态截图。结果是名义CSS字号，不测真实字形/遮挡/美观；16只是提示参考，不是自动通过阈值。
2. 可选调用 `a2game.inspect_game({artifactId,textReadability})`。`textReadability` 含当前会话的 `previewId`、`backend`、`gameSha256`（`inspect.data.files["game.json"]`），`viewport:{width:innerWidth,height:innerHeight}`；从测量结果只复制 `status/referenceCssPx/measuredCanvasRect/scene` 和 `texts.map(({fontScene,nominalTextCssPx})=>({fontScene,nominalTextCssPx}))`。不要发送text/id/paths/截图/任意额外字段。最多256条文字，超量会拒绝而非截断算通过；`UNAVAILABLE` 用null几何与空texts。
3. 返回 `data.textReadability`，包含数值位置索引warning及静态修复建议。来源恒为 `HOST_REPORTED_UNVERIFIED`，`visualAcceptance` 恒为 `NOT_RUN`；身份绑定不证明实际浏览器执行、新鲜度或测量正确，无warning也不代表视觉通过。旧 `inspect({artifactId})` 不变。
4. 把建议和作者自己真实截图反馈给原作者；仅作者在预算内另写不可变修订稿，重新validate/test，再以新artifact/新preview重测双SDK与各viewport。旧SHA或旧/关闭/到期/跨会话预览不能绑定新稿。不得自动改游戏，不得只扩大字体后跳过实际审图，也不得隐藏失败候选。
