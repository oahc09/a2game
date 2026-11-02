# ZCode 接入与全通路

ZCode为新增扩展宿主，原三宿主和15单元Benchmark基线不变。已有回执记录 `.zcode/config.json` 的项目MCP及 `.agents/skills/a2game/`，本文件不自动修改配置或模型路由。

执行 `node scripts/install-host-skill.mjs zcode --check` 核对项目Skill；新会话核实实际发现，再按[显式Pilot任务](../../../docs/host-agent-pilot.md)创作、验证、测试、双SDK预览和导出。

最新存档把 `a2game.combat.bubble-grid` 的kind与description改写了，不能视为原始响应。服务端仍提供正确合同；使用 `host-agent-run.mjs capture` 直接保存同runId的服务端回执，并保留宿主原文作差异比较。改动发生在Agent导出还是宿主网关尚未确定，不将其误归因为SDK/玩法失败。

本轮只提供已有版本观察和执行入口，不宣称任意ZCode版本兼容或正式G3通过；宿主原生用量未知填UNKNOWN，MCP代调用预算保持0。
