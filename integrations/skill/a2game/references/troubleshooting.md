# 诊断和记录

| 情况 | 下一步 |
|---|---|
| MCP 未连接 | 用 CLI `--help` 核实本机入口；不要伪造 Tool 调用 |
| A2G_MCP_BUDGET | 继续无模型 validate/test；由启动者提供已授权预算后才能代调用 |
| A2G_MCP_ARTIFACT / INTEGRITY | 确认是当前会话签发的 artifact，重新准入原始 JSON；不绕过 SHA |
| A2G_MCP_TEST_INPUTS | 同时提供 Conformance 和自解；有正例也需未完成/失败反例 |
| A2G_MCP_BUSY | 当前操作结束或取消后再试，不并发扩充预算 |
| A2G_GEN_INPUT_PROFILE | 检查实时方向动作的 hold 绑定并重新做实际来源输入复核 |
| validate/test通过但动态提示不显示 | 核对HUD使用bind.state而非bind.path；对照Runtime提示与实际可见文字，细节见workflow的动态HUD指引 |
| 释放检查失败但适配器已disposed | 区分resources.ownedResources、Air的adapter.ownedNodes和Three的adapter.ownedMeshes；保留原失败，不把缺字段当0或宣称GPU零泄漏 |
| 升级/通关已完成但HUD仍要求旧操作 | 限定reward提示的真实条件，核对升级后及终态文字；跨事件覆盖不能仅靠提高priority解决 |
| 多动作游戏在手机出现空方向垫/长按钮列 | 检查参考Player的action ID布局选择，区分协议语义与Host便捷布局；按workflow同步更名并重验 |
| 有多个模块但不能证明联动 | 按authoring核对生产、消费、时序、对象所有权和实际效果；局部反例不证明某机制全局必要 |
| injectRaw被Conformance Schema拒绝 | 将输入放到step.raw对象；solution的raw数组是另一种外层，不删除输入/释放断言 |
| 按住Space只有一枪或松开仍失控 | 核对模块press/hold消费、fireRequest桥接和实际release/cancel；不要靠永远autoFire绕过停止要求 |
| 虚拟多指能通关但松指后继续滑动 | 检查实际pointerup/capture事件及后续位移；vx归零可能只是撞墙，先核实浏览器驱动 |
| 手动Tick截图黑/旧帧但逻辑PASS | 等待原生绘制帧并核对固定视口捕获，保留原图与补拍；不将日志PASS当视觉PASS |
| 卡牌被消费但资源不足/分数不对 | 核对原生cards是按位置消费、score为牌值总和；自定义费用/订单/回合由游戏合同另行实现，勿猜隐藏cost字段 |
| 连续出牌后索引路径不存在 | T7看到模块处理后的最终手牌；不要用旧handCount推断仍有该索引，按played.card处理效果并用实际数组投影 |
| 目标已达标却判负难理解 | 核对资源/风险/次数的同时约束和优先级，实测交叉边界并让界面明确显示越界原因 |
| 素材入口和旧指引不一致 | 以当前resources/list为准；creation-library是只读资源而非新Tool，按kind/版本与许可处理，不假定旧capsule也包含它 |
| 源码/SDK/内容指纹与回执不同 | 保留原始不一致，核对具体变动与执行范围；不修改旧摘要、重签历史或将局部工程结果升级为正式Gate |
| 缺 SDK/资源/许可 | 按可信项目准备说明补齐；不自动下载任意 URL、不谎报双端通过 |

记录每种模式的独立 runId、任务文本、Provider/模型身份范围、Seed、上下文 SHA、真实调用数、修复次数、测试/截图和已知限制。模型自报身份不能替代宿主路由证据。无终局或无法来源输入操作时保持失败/待验，不修改验收阈值。

发生并发修改时区分游戏原字节、Skill版本、执行实现/合同与SDK身份。相关路径改变后，用冻结的新稿和当前实现重新验证，旧报告留作历史；无法取得全局冻结时如实保留漂移。即使已证实变动在未调用路径，也只报告可证实的工程范围，不能把全局false改成true，或豁免正式验收的指纹规则。更新Skill本身也不使旧游戏报告自动成为新版Skill的生成证据。
