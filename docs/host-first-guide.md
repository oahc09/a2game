# Host-first 接入与验证

全通路执行入口：[四宿主显式Pilot任务](host-agent-pilot.md)。WorkBuddy项目Skill入口已按官方文档修正为 `.codebuddy/skills/a2game/`；项目安装器可检查四宿主副本。新版MCP记录方法与参数摘要，并保存成功/失败回执；重连后用 `host-agent-run.mjs` 直接归档原字节，避免手抄响应。

本阶段使用真实 Agent 宿主编写 GameSpec，再通过 A2Game Skill/MCP 验证和交付。当前四宿主均记录9个工具；Qoder/TRAE能力查询响应已存档，WorkBuddy/ZCode的原始宿主响应待补，WorkBuddy Skill不可见。现行结论见[统一审查](../project/host-first-review.json)，补证按[四宿主任务](host-first-followup.md)执行。早期UI观察保留为历史，不代表最新连接状态。

- [Qoder 参考](../integrations/hosts/qoder/README.md)：Skill ZIP 与本地 MCP 模板；项目级隔离支持待核实。
- [WorkBuddy 参考](../integrations/hosts/workbuddy/README.md)：MCP + Skill Connector 模板与项目级 MCP 说明。
- [TRAE 参考](../integrations/hosts/trae/README.md)：项目 MCP、Skill 布局及隔离项目示例。
- [ZCode 扩展](../integrations/hosts/zcode/README.md)：当前配置观察与原始证据保存。

WorkBuddy 模板中的 Skill 副本来自共享源码；更新时可用 `npm run skill:package` 生成 ZIP，再解压到全新 Connector 的 `skills/` 目录。已有副本与源码不一致时，先审查差异，不覆盖用户配置。

模板都使用本地 stdio 和 `--max-calls 0`。在实际配置中由用户替换 `<A2GAME_WORKSPACE>`，禁止把密钥或个人配置放入仓库；不能覆盖已有宿主配置。宿主原生模型用量另计，未知写 `UNKNOWN`。

在 A2Game 工作区运行 `node scripts/check-host-first.mjs`，可检查 Skill 副本与模板，并在本机对四份模板执行 stdio 工具发现；该检查不会打开目标宿主或调用模型，不能作为 HOST-G0 或自动触发通过证据。`node integrations/hosts/trae/sync-skill.mjs --check` 可检查 TRAE 样例；存在不同的目标文件时生成器不会覆盖。

先完成四宿主补证；G0保持PARTIAL。Qoder/WorkBuddy目前为用户级连接，项目级隔离支持须按实测记录。随后使用全新会话分别测试隐式/显式触发，再执行独立G01 Pilot。ZCode作为独立扩展，原三宿主与15单元矩阵不变。宿主模型用量单独批准和记录，MCP预算保持0。
