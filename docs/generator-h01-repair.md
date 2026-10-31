# H01 终局测试修复与生成提示

H01 规划模式第四次模型原稿的游戏和解法能够获胜，但一条一致性用例在断言 `won` 后直接注入 `build-a` 的按下和释放；运行时按合同以 `A2G_E_FLOW` 拒绝，原始结果仍为 **FAIL**。

本轮另存宿主修正版：仅在上述两次输入前分别加入 `{"op":"expectError","code":"A2G_E_FLOW"}`，游戏、模型解法、原稿和其余用例步骤不变。修正版通过完整准入、4/4 一致性用例、模型自带解法以及 Headless 生命周期；真实 Three.js/CocosAirJS 桌面和 390px 浏览器 4/4 输入、逐步 Hash、暂停、重开与宿主资源释放参考通过。修正版不是新模型输出，不改变历史 Benchmark 的 9/10，也不计正式 G3。

原始 Provider 回复为 `.a2game/generator/4df7c56d-0ace-4207-a089-faaa89b71a51/attempt-4/response.raw.json`，SHA256 为 `34c7c4343e8b60ceaee11193e6cef12add64a6a6e086ad3298475b1e5cc1ad0d`；其解析内容与修复回执引用的验证器副本一致。

- [宿主修正版回执](../reports/h01-conformance-repair-1d47fb41-b18c-417f-ab7a-28a1d9d4f99c/summary.json)：包含原稿与修正版 SHA、差异和验证记录。
- [双 SDK 浏览器回执](../reports/generator-game-review-eb51f126-dcae-496f-8712-7e5cc475f10a/summary.json)：记录输入、截图、Hash 与释放。
- [修正版目录](../output/h01-conformance-repair-1d47fb41-b18c-417f-ab7a-28a1d9d4f99c/)：只作为宿主纠正后的独立产物。

生成请求现明确终局/暂停时的输入拒绝和 `expectError` 的逐操作语义；同类验证失败的自动修复反馈附带该合同说明，不自动修改生成 JSON。普通生成与原生上下文均覆盖该提示。针对窄屏，普通生成请求补充文字对比度、可辨识棋子和避免展示内部编号的要求。原始错误、调用上限、准入标准和证据身份保持不变。

修复前的截图显示 `build-a` 等内部动作标识及 `merged: false/true`，原因是 Player 未读取游戏已声明的 `hud.text`/`bind.action` 和 `bind.state`。Player 现读取按钮文字、可访问名称和多条进度绑定；窄屏隐藏覆盖游戏标题的引擎角标。[新双 SDK 回执](../reports/generator-game-review-4ca86c40-bfe4-4d41-bdc5-4b8476baf3c7/summary.json)记录桌面/390px 共 4/4，实际输入、Hash、暂停、重开和释放通过；截图显示“金币：6”“击破：0 / 3”及中文按钮。该结果仍是宿主修正版的工程参考，未进行真人验收；新生成提示的真实模型成功率仍未验证，历史 Benchmark 成绩、真机、正式 G3 和远端 CI 不升级。

终局提示修复时的 11 项 Node 测试和[干净源码 smoke](../output/generator-source-smoke-bd87118b-53ba-489b-8910-c8f5da374d55/receipt.json)为历史记录；其中部分源码随后已变化，不能作为当前源码一致性的证明。

后续的[干净源码 smoke](../output/generator-source-smoke-b6ba310a-c1f4-4c7a-8094-f232ab4d7d43/receipt.json)当时通过，但源码随后再次变化；最新 smoke 以 Generator 台账为准。四样例的[当前播放器源码 G2 回执](../reports/g2-2026-10-31T09-33-59-272Z-25720/summary.json)记录两个真实 SDK、桌面和窄屏 16 个场景及两项原生时钟/上下文恢复通过；这不替代逐款或人工验收。

2026-10-31 复查参考目录的 H01（不是上述模型修正版）：[320px Three.js 截图](../reports/candidates-2026-10-31T09-54-43-316Z-23888/three-H01-quality-320.png)与 [CocosAirJS 截图](../reports/candidates-2026-10-31T09-54-43-316Z-23888/air-H01-quality-320.png)中画布文字过小、留白较多，仍需视觉优化。自动布局和输入通过不代表该项质量通过。

2026-10-31 后续调整：参考 H01 基础关卡（revision 4）及作者变体（revision 3）放大画布标题、槽位数字和中文提示，未改变输入、玩法及状态。局部双 SDK 的胜负、边界、暂停/重开、释放通过，新旧正反例状态 Hash 一致；[基础回执](../reports/candidates-2026-10-31T10-46-54-490Z-15624/summary.json)和[变体回执](../reports/variants-2026-10-31T10-47-10-332Z-25888/summary.json)包含 320/390px 截图。37 款 193 个 Headless 场景及 148 个基础/变体双 SDK 实例已复验，参考 CoverageResult 索引已刷新。动态炮台/敌人的数值仍随实体尺寸缩放，在 320px 下偏小，不能将 H01 完整视觉质量标为通过。原始模型失败与 9/10 Benchmark 结论不变，本轮新增模型调用 0。

2026-10-31 动态数字后续修复：参考基础关卡 revision 5 和作者变体 revision 4 显式启用最小字号及绘制形状尺寸，并调整槽位编号位置；未启用该配置的旧关卡沿用原有投影。两个真实 SDK 在 320px 的基础/变体共 4/4 检查中，动态数字约 17.88 CSS px，槽位无测得遮挡；输入后的旧版/新版状态 Hash 一致，宿主资源和监听已释放。[局部回执与截图](../reports/h01-narrow-6a2013e1-952e-4bcf-b6c1-42b95a53119e/summary.json)。37 款基础与变体、共享机制及兼容性参考回执已重新收集，完整回归 159 Node、360 Schema 和 203 Conformance 通过。此处是参考关卡，不是上文模型原稿；完整视觉、人工和真机仍待验。
