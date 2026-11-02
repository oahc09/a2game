# Qoder 的 A2Game 接入参考

本目录提供无凭据的连接模板。最新回执已记录9个工具及宿主能力查询响应；当前MCP为用户级配置，Skill可见但未执行。项目级隔离与完整G0仍待验，补证按[统一任务](../../../docs/host-first-followup.md)执行。

显式全通路入口见[四宿主Pilot任务](../../../docs/host-agent-pilot.md)。`.agents/skills/a2game/` 可由 `node scripts/install-host-skill.mjs qoder` 校验/补齐。保留当前已工作的MCP与模型路由，不为了切换配置范围阻塞功能验证；范围仍如实记录USER_LEVEL。

最新回执披露本地路由密钥曾打印进会话。开始新的原生模型生成前，用户需按宿主方式重置；本项目工具不读取、复述或自动处理该密钥，也不扫描宿主配置/会话来取证。

## 准备

在 A2Game 工作区准备 Node.js 22+、Python 和已构建的 Runtime；执行 `npm ci`、`npm run mcp:install`、`npm run build`。真实双 SDK 预览还需锁定的 SDK 与 Chromium。执行 `npm run skill:package` 生成包含唯一 Skill 来源 `integrations/skill/a2game/` 的 ZIP；打包不会自动安装。

`connection.example.json` 是本地 stdio 的示例，将 `<A2GAME_WORKSPACE>` 替换为实际 A2Game 工作区绝对路径。`--max-calls 0` 禁止 MCP 代调用模型，宿主 Agent 自己的推理另计；不要在模板中放密钥或用户配置。

## 实际宿主操作

1. 先确认 Qoder 具体产品、版本和是否支持项目级隔离导入。官方文档提到 Skill ZIP 导入与自定义 MCP，但其示例使用用户级设置；项目级支持未经核实，**不得自动修改用户级设置**。
2. 如目标版本支持项目级隔离，由用户在宿主界面导入 Skill ZIP 并按其流程添加本地 stdio MCP；已有配置需要人工合并。若只支持用户级设置，记录 `BLOCKED_USER_ACTION`，由用户决定是否手动启用。
3. 在新会话确认 Skill 通过 `/` 显式可见，再分别检查自然语言自动触发、九个 `a2game.*` 工具发现及调用顺序；留存版本和非敏感日志。宿主自身模型使用及费用写实际值，未知为 `UNKNOWN`。
4. `list_capabilities → get_capability → validate_game → test_game → inspect_game → preview_game → export_game` 使用宿主自己编写的 JSON；不调用 `generate_game`。预览后关闭会话；不能发现 SDK 或宿主时如实标注。

官方参考：[Skills](https://docs.qoder.com/qoder/skills)、[自定义扩展与 MCP](https://docs.qoder.com/qoder/extension-publishing)。实际项目级路径、Tool 列表、自动触发、双 SDK 输入及资源释放均须按安装版本另验，不能由样例或本地脚本替代。
