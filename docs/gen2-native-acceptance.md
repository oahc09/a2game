# GEN-2 原生子 Agent 真实模型验收

2026-10-30，用户指定 `GPT-6.1 Terra Middle`，宿主实际以 `collaboration.spawn_agent` 的 `model=gpt-6.1-terra`、`reasoning_effort=medium`、`fork_turns=none` 启动生成 Agent。任务是新设计的“双灯之锁”：切换两灯、确认目标、错误扣机会、三错失败。没有向生成 Agent 提供作者 GameSpec、关卡测试、答案或历史报告；只提供公开 Schema、Capability 和通用可信模块/ABI。此隔离是指令约束，宿主未提供 OS 沙箱或完整工具轨迹证明。

本轮只执行该任务的 GEN-2 工程验收，不是 37 款正式 G3，也不是多模型 Benchmark。

## 实际生成与修复

| 次数 | 结果 | 留证 |
|---|---|---|
| 1 | FAIL：最外层缺 `format/version` | 原始回复、完整验证失败、独立 game/suite Schema 诊断 |
| 2 | FAIL：solution 误用 `{seed,steps}` | 完整准入、Conformance 3/3 已通过，模型解法形状被拒绝 |
| 3 | PASS_REFERENCE | 完整准入、3/3 正反例、模型自拟 3 步解法、双 Session Hash |

共 3 次完整生成尝试、2 次修复，`oneShot=false`；底层模型 API 请求次数、Token 与费用未导出，不填 0。验证和原始交付导入不再次调用模型，不重复计生成次数。主 Agent 只提供通用格式诊断，没有修改模型 JSON 或用宿主求解器补解。

原生 overlay 未保留基础合同中完整的 solution 数组类型，也未明确把 root format/version 纳入 required。这两处上下文歧义与模型输出问题一并留证。新增 `buildNativeContext()` 明确 root required、solution 数组 Schema、预算和执行含义，并加回归检查。后续模型比较必须固定修订后的上下文 SHA，不能把此次带格式反馈的运行当未见测试或一次通过。

## 交付和验证

新增 `admitNativeGeneration()` / `import-native`，对 context/raw/宿主记录做 SHA 绑定，复用既有完整 Validator、Conformance 和重复回放；原始材料保存在私有目录，公共游戏目录只包含游戏、模型解法、测试与回执。公开元数据使用字段白名单，导入不自动认证宿主记录签发者。

- 公开产物：`output/gen2-terra-addc99af-70e3-4dda-a88e-a10f5fe1bbf3-release/`。
- 原始三次输出与宿主观测：`.a2game/gen2-native-addc99af-70e3-4dda-a88e-a10f5fe1bbf3/`。
- 双 SDK 解法/正反例/Hash/重开/释放：`reports/g3-browser-2026-10-30T06-45-30-705Z-18680/summary.json`。
- 公开预览入口的桌面键盘/390px 按钮输入：`reports/gen2-terra-input-e1b456a0-3de7-4fe2-9f0d-b748a7bc4142/summary.json`，4/4 PASS_REFERENCE，分别留初始/进行中/成功/失败截图、浏览器与 Headless Hash、零 ownedResources、关闭监听。
- 本轮汇总：`reports/gen2-terra-acceptance-addc99af/summary.json`；最新状态与验证回执见 [Generator 台账](../project/generator-status.json)。上述大型/私有本地材料不加入 Git。

视觉已做 AI 参考审查：两灯、目标、剩余机会和胜负可见；390px 说明字偏小，HUD 暴露 `chances/confirmed` 英文字段，按钮使用通用方向文案。视觉质量为 `PARTIAL`，人工手感、长期游玩与真机保持 `NOT_RUN`，不能升级整款质量验收。

模型身份依据是本次真实宿主调度参数，不采用生成 JSON 的模型自报。宿主记录的是请求路由；服务端实际构建版本、完整会话工具轨迹、用量/费用没有导出。此限制与正式独立来源/隔离验收分别登记，不把 `HOST_RECORDED_REQUEST_NOT_SERVER_ATTESTATION` 改写成服务端认证。

## 后续窄屏修复

窄屏问题已在明确标记的宿主表现副本中优化，新增模型调用0，原始模型 JSON 与本文件上述原生视觉评分保留。参见 [窄屏表现优化](gen2-narrow-visual.md)；不将宿主修改后的表现计入模型独立成绩。
