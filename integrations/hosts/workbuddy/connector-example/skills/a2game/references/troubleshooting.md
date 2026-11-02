# 诊断和记录

| 情况 | 下一步 |
|---|---|
| MCP 未连接 | 用 CLI `--help` 核实本机入口；不要伪造 Tool 调用 |
| A2G_MCP_BUDGET | 继续无模型 validate/test；由启动者提供已授权预算后才能代调用 |
| A2G_MCP_ARTIFACT / INTEGRITY | 确认是当前会话签发的 artifact，重新准入原始 JSON；不绕过 SHA |
| A2G_MCP_TEST_INPUTS | 同时提供 Conformance 和自解；有正例也需未完成/失败反例 |
| A2G_MCP_BUSY | 当前操作结束或取消后再试，不并发扩充预算 |
| A2G_GEN_INPUT_PROFILE | 检查实时方向动作的 hold 绑定并重新做实际来源输入复核 |
| 缺 SDK/资源/许可 | 按可信项目准备说明补齐；不自动下载任意 URL、不谎报双端通过 |

记录每种模式的独立 runId、任务文本、Provider/模型身份范围、Seed、上下文 SHA、真实调用数、修复次数、测试/截图和已知限制。模型自报身份不能替代宿主路由证据。无终局或无法来源输入操作时保持失败/待验，不修改验收阈值。
