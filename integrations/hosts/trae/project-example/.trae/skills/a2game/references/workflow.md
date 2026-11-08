# MCP / CLI 双通道

MCP 先 `tools/list` 确认工具真的可用。先调用 `a2game.list_capabilities`（query、limit、offset），再用完整 id/version 调用 `a2game.get_capability`。`a2game.plan_game({prompt})` 不调用模型，仅返回关键词草案；不是宿主模型已经完成的 GamePlan。模型规划及需求对应关系见 [独立创作](authoring.md)。

编写前使用客户端的 `resources/list` / `resources/read` 读取 `a2game://spec/0.1.0/` 下的 GameSpec、Conformance、Capability Schema、HostProfile 与非可执行片段。只选择服务实际列出的 URI；核对 envelope 的 specVersion、bytes、sha256（绑定 content 原文）。客户端不支持 Resources 时如实记录，由可信控制端提供公开 capsule，不读取基准关卡或解法。

验证失败按 `diagnostics` 的 `stage/jsonPointer/capabilityId/ruleId/caseId/expected/actual/repairHint` 修复，缺失字段不猜。每次准入或测试前将本次输入的原始字节与 SHA 保存在独立快照，修复另存新稿；保留失败响应及其对应快照，无法取得原稿时如实标记缺失，不以重建内容冒充。严格评测先由可信控制端创建run并以 `--host-run-id` 绑定专用服务；所有失败计入三次候选上限。旧未绑定服务可用但不能成为完整run证明。公开目录并非强隔离，必须实际通过受控沙箱/宿主边界验证才能声称答案不可读。

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
node generator/cli.mjs capability --id a2game.puzzle.push --cap-version 0.1.0 --json
node generator/cli.mjs validate output/my-game/game.json --json
node generator/cli.mjs test output/my-game --json
node generator/cli.mjs preview output/my-game --backend air
node generator/cli.mjs preview output/my-game --backend three
node generator/cli.mjs export-package output/my-game --output output/my-game.package.json --json
```

`output/my-game/` 含 `game.json`、`conformance.json`、`solution.json`，可附符合内部 Schema 的 `game-plan.json`。模型自由规划可另存 `design-plan.md`，不会作为游戏执行或替代上述 JSON。命令没有授权模型调用，不能自行增加 generate。预览命令持续占用终端，结束时正常中断以关闭监听。只有校验不需要自行补充第三方模型。`validate` 与 `test` 可加 `--evidence-dir DIR`：准入运行前把本次输入的原始字节与 SHA256 清单以不可覆盖（wx）方式写入该目录的新子目录，PASS 与 FAIL 同样留证；目录须可写，已有字节绝不覆盖，也不修改源文件。

能力目录查询的 `query` 最多 120 字符、`offset` 为 0..1000、`limit` 为 1..20；需要更多结果时用 `offset` 分页。

## 动态 HUD 的可见反馈

HUD 文本读取全局状态使用 `{"id":"notice","kind":"text","bind":{"state":"/message"}}`，其中 `/message` 必须已在 GameSpec.state 声明；按钮标签用 `{"id":"go","kind":"button","text":"开始","bind":{"action":"go"}}`，action必须实际存在。`bind.path` 不是文本读取语法，观察路径的 `/state` 前缀也不能放进此处。scene2d 的文字则使用节点 `text:{state:"/message"}`，不要把 HUD 的结构混进去。

HUD的bind容器较宽，完整准入/test通过仍可能出现绑定不生效。实际触发一次合法动作和一次有意义的无效动作后，把当前 Runtime 状态提示与**页面可见进度文字**对照；只看到状态更新不算反馈可见。保持初始/过程/终态截图，区别描述性文案和实时状态，不通过改测试预期掩盖缺失提示。

当前参考Player还会按action ID选择控件布局：例如`collect`可能启用固定方向垫，在多动作经营游戏中挤压其他按钮。它不是协议保留字，也不意味着这个名字总是错误；按实际Host检查布局，必要时选择清楚的领域ID（如`claimOre`），保留用户操作键和标签。重命名需同步inputs、规则/组件动作、HUD、Conformance、solution与试玩脚本，并重新取证，不只改中文标签。

修订器按结构化字段更新，避免全文件字符串替换同时改掉规则ID/查找键。写稿失败先停止下游validate/test，确认三件套已完整写入、原字节和SHA已留证后再执行；准备失败后的ENOENT应归控制流程/基础设施，不能当模型玩法或能力验证失败。保留原失败，修复另记。

若要创建独立练习，可要求“设计一个有清晰目标和至少一个未完成反例的单屏小游戏”，自行查询能力并写新 JSON；不使用冻结 Benchmark/G3 的作者标准答案。明确标注练习的作者和实际生成来源。


独立 mechanics gate（仅显式选择上述工程 Profile）：作者另写 `mechanics.json`，控制端使用 `check-illegal-undo.mjs`，不是第十个 MCP Tool。声明严格字段为 `format/version/profile/sceneId/entityId/componentIndex/coreStatePaths/legalPrefix/illegalAction/illegalKind/undoAction`；format=`a2game-illegal-undo-check`，version=1，profile=`grid-push-illegal-undo-v1`。`legalPrefix` 是 1–128 个真实方向 action ID，每项按 press→release→1 Tick；`illegalKind` 为 blocked-push 或 blocked-move，控制端要求 blocked-push 时前者才合格。coreStatePaths 必须完整等于所选组件配置的四条 playerPath/boxesPath/movesPath/solvedPath，history 与 undo 从真实组件绑定，不猜字段名字。

报告中的 `trace` 为实际执行的 `{action,ticks:1,phase,expectedHash,flowStatus}`，包括 legal-prefix/illegal/undo；失败也保留已执行前缀，不丢弃。将它用作控制端衍生的双 SDK 验证轨迹，明确记录不是模型自报结果。`implementationSha256` 与 `implementationSha256After` 必须相等；旧源码结果或不同 JSON 不能沿用。

## 输入、判负与画面反馈（兼容增量）

- `expectError` 必须带字符串 `code`，紧接下一条预期被拒绝的操作；暂停/终局玩法输入的合同码为 `A2G_E_FLOW`。不能嵌套、悬空，也不能删除负例以规避失败。公开 HostProfile 的 `conformance.operations` 列出运行操作必需字段；Schema 准入不等于执行成功。
  终局后 `press` 与 `release` 均是独立输入操作；若两者都要测试拒绝，各自都需要紧邻的 `expectError`。

- `a2game.puzzle.sort` 的 `width` 是管数，`selectActions` 按管索引对应，`tubes` 的数组末尾是管顶，容量默认为 `height`。选择非空源管和同色或空的未满目标后，倒入顶部连续同色段；非法选择可能清除选中状态，但不产生成功移动。成功倒液后 `moves` 加一，`score` 统计已满且全同色的管，不统计空管；默认 `won` 要求每管为空或满且同色。配置 `targetScore` 时达到分数也会置 `won`。计分和默认胜利条件在成功倒液后更新，不要把 `score` 当作总管数。

- `injectAction` 的 `hold` 不是起始按下：同一 action/sourceId 必须已有未释放的 `press`；`release/cancel` 结束持有，暂停清空持有来源。原始键盘用 `down/up` 且绑定 `config.hold:true`；solution 的普通 action 行是 press→release 的点击，不是持续按住。失败用例的 `input.hold-without-press` 是有界诊断，不改变游戏状态、Hash 或输入接受语义。
- Conformance 的原始输入是 `{"op":"injectRaw","raw":{"source":"keyboard","kind":"down","payload":{"code":"KeyD"}}}`，另用step推进，结束用同样封装的up。不要把source/kind/payload直接摊在step上。solution则是 `{"raw":[{"source":"keyboard","kind":"down","payload":{"code":"KeyD"}}],"ticks":6}` 这样的行，后续行up才结束持有；两种外层结构不可互换。
- 不要依赖浏览器键盘repeat来实现连射。确认实际模块消费press还是hold；当前reference realtime.world的fire直接消费press，持续射击可显式用独立fireRequestPath与持有规则驱动。T5消费请求、T7/T8重建的桥接可能在松开边界完成一个已排队Tick，必须实测其停止边界；不能偷偷改成autoFire永远开启来掩盖失控。
- 失败路线若声称失败，必须真实执行并显式断言 `/flow/status` 等于 `lost`。`conformance.loss-status-mismatch` 给出实际状态；检查判负条件、优先级和输入时序，不为过测把原本要求失败的场景改成 `playing`。没有失败机制的游戏可保留合理 `playing` 负例，不强制发明 `lost`。
- 执行逻辑 Tick `n` 后，观察值 `tickIndex` 是 `n+1`（初始为0）。塔防仅在有目标且 `nextFire <= n` 时开火，成功后设为 `n + cooldownTicks`；无目标不消耗冷却。合成先于武器阶段，新冷却取当前Tick与两旧值的最大值；已到期可同Tick开火，未到期不能提前。用实际事件/状态验证，不能把作者预计的Tick当事实。

实际预览的结构化文字反馈：

1. 每次调整viewport后重新读取 `window.__a2game.getTextReadability({referenceCssPx:16})` 并实际查看初始/中间/终态截图。结果是名义CSS字号，不测真实字形/遮挡/美观；16只是提示参考，不是自动通过阈值。
2. 可选调用 `a2game.inspect_game({artifactId,textReadability})`。`textReadability` 含当前会话的 `previewId`、`backend`、`gameSha256`（`inspect.data.files["game.json"]`），`viewport:{width:innerWidth,height:innerHeight}`；从测量结果只复制 `status/referenceCssPx/measuredCanvasRect/scene` 和 `texts.map(({fontScene,nominalTextCssPx})=>({fontScene,nominalTextCssPx}))`。不要发送text/id/paths/截图/任意额外字段。最多256条文字，超量会拒绝而非截断算通过；`UNAVAILABLE` 用null几何与空texts。
3. 返回 `data.textReadability`，包含数值位置索引warning及静态修复建议。来源恒为 `HOST_REPORTED_UNVERIFIED`，`visualAcceptance` 恒为 `NOT_RUN`；身份绑定不证明实际浏览器执行、新鲜度或测量正确，无warning也不代表视觉通过。旧 `inspect({artifactId})` 不变。
4. 把建议和作者自己真实截图反馈给原作者；仅作者在预算内另写不可变修订稿，重新validate/test，再以新artifact/新preview重测双SDK与各viewport。旧SHA或旧/关闭/到期/跨会话预览不能绑定新稿。不得自动改游戏，不得只扩大字体后跳过实际审图，也不得隐藏失败候选。
