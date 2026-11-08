# WorkBuddy 最短游戏交付流程

在 a2game 项目中使用 `.codebuddy/skills/a2game/` 与现有 a2game MCP。此流程不调用第二模型，MCP 启动保持 `--max-calls 0`。

已有五款内容、最终修正版包与接收方命令见[交付入口](workbuddy-delivery.md)。当前采用Agent质量评价，无需新建WorkBuddy生成任务；G21/H01已完成Worker试玩与主审复核，下一步补G01/G03/G17同口径复核。

1. 控制端用 `node scripts/host-agent-run.mjs init workbuddy` 建立独立 RUN，取得 `hostRunId`。给该任务专用 MCP 启动参数追加 `--host-run-id <UUID>`；WorkBuddy 重连后先查询一次能力，并核对对应服务会话绑定，匹配后才创作。新任务不复用上一任务的绑定。
2. Agent 阅读 RUN 的公开合同，输出 GameSpec、Conformance、解法。每个候选在准入前独占创建原始字节快照与 SHA；修复另存版本，最多三版、累计最多三次准入。JSON 表达式使用公开算子，所有输入绑定能力必须在 requires 中声明。
3. 从快照读取原始文本执行 validate，再用同会话 artifact 执行 test、inspect。失败也立即 capture；不得 trim 或手动重构原始 JSON，不能将本地预检修正版计成无修正的一次成功。
4. 先准备操作，再逐个打开 Air、Three 预览。真实 DOM 输入完成一个通关流程和一个相关负例，观察必要截图；每次在 finally 立即显式关闭并归档，再分析问题。不要打开多个诊断预览后长时间调试。已经 expired 的历史记录保留，不用另开实例补成关闭通过。
5. 双端流程完成后 export、capture、check，交付包路径/SHA、回执和未验项。源码变化后的历史回执不自动适用于当前源码；服务重启后 artifact 不跨会话。单端补验不要导出不完整的新会话链以刷全绿。

## 本轮真实内容问题的修法

- 多个格位都用 `touch.tap` 的整画布 region，无法表达不同目标；使用公开 `touch.select` 各自命中区域，并按实际 canvas 边界换算点击坐标。虚拟按钮通过不等于画布或真机触摸通过。
- 塔防 body 固定半宽 150 整数单位，塔位间距小于 300 就可能重叠。按公开范围规划空间尺寸；必要时同比修改空间配置、射程、速度和场景，再重新完整验证，不只放大 CSS 或谎称 Hash 不变。
- 可参考[工程修正版](../integrations/hosts/workbuddy/repaired-games/README.md)，它们有来源 SHA，是主审修订，不能用作下一次独立模型生成的答案。

## 当前五款记录

| 游戏 | 已有工程结果 | 保留限制 |
| --- | --- | --- |
| G01 推箱子 | 双端玩法及专用绑定补验通过 | 独立来源、完整同 Tick Hash 未全面核实 |
| G03 三消 | 修复后双端通关、关键同 Tick Hash、MCP 链通过 | 首个拒绝稿字节丢失，不能补造 |
| G17 射击 | 双端通关；Air 补验 13 个采样 Hash 通过 | 整轮 PARTIAL，历史 expired 和补验链缺项保留 |
| G21 塔防 | 原任务 DOM 按钮可玩；工程修正版双端画布点选及通关通过 | 原任务 PARTIAL，3 个 expired；修正版不是模型原稿 |
| H01 合成炮台 | 原任务修复后 MCP 链通过；工程修正版双端合成/通关且不重叠 | 三次候选已用完；视觉修正版单独记工程验证 |

这些结果均不升级正式 G3、人工质量、真机或隔离验收。Qoder/TRAE 暂缓，模型身份和用量缺证据时记 UNKNOWN。不扩大多宿主矩阵，不为恢复旧门禁重跑全部游戏。
