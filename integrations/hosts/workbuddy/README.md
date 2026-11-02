# WorkBuddy 的 A2Game 接入参考

此目录提供 **MCP + Skill** 连接器模板。当前用户级MCP已能调用；本轮发现此前Skill只检查了错误的项目路径，已从唯一源码安装到 `.codebuddy/skills/a2game/`。宿主需新会话重新发现，安装布局检查不能代替实际触发。全通路按[显式Pilot任务](../../../docs/host-agent-pilot.md)执行。

## 项目 Skill（2026-11-01 官方核实）

WorkBuddy在代码项目中支持 `.codebuddy/skills/<名称>/SKILL.md`，见[官方项目配置说明](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)。此前仅检查 `.workbuddy/skills/` 不能证明项目Skill不可用。

```powershell
node scripts/install-host-skill.mjs workbuddy
node scripts/install-host-skill.mjs workbuddy --check
```

当前项目位于 exFAT 格式的 E:，2026-11-01 实测创建目录软链接失败（Node `EISDIR`；PowerShell“指定的路径不支持符号链接”），因此 `.codebuddy/skills/a2game/` 仍保留逐文件一致的副本，没有替换或删除。若将来在支持符号链接的文件系统（如 NTFS）上使用，目标应为相对路径 `../../integrations/skill/a2game`，以便唯一源码修改直接同步。安装器已支持保留并检查这个指定链接；其他目标链接仍拒绝，入口不存在时仍创建副本，遇到已有不同内容会停止，不能自动覆盖旧副本。

安装器不修改用户级配置、不操作凭据、不调用模型。更换入口后需新建代码项目会话，核实Skill注册表；宿主是否跟随软链接仍需实际会话确认，不能由本地布局检查代替。

## 原始响应与后续调用

最新WorkBuddy报告的 `modelCalls` 被移动到响应根部，与同runId的服务端回执不同；当前服务合同仍为 `data.modelCalls`，不放宽Schema迁就错误副本。使用 `host-agent-run.mjs capture` 保存服务端原字节与调用元数据，避免手工复制改写。宿主自身返回能导出时另存并比较，不能冒充服务端原文。

## 模板和准备

`connector-example/` 含官方 Connector 结构：`connector-meta.json`、`mcp.json`、`icon.svg` 和从 `integrations/skill/a2game/` 同步的 `skills/a2game/`。Skill 以原目录为唯一内容来源；修改 Skill 后须重新生成副本并校验 SHA，不手工维护不同版本。

在 A2Game 工作区准备 Node.js 22+、Python、依赖和构建；真实预览还需锁定 SDK 与 Chromium。将模板复制到**全新的**隔离目录，若已有目录或配置先人工合并；把 `mcp.json` 中的 `<A2GAME_WORKSPACE>` 改为本机 A2Game 绝对路径。该文件不含凭据，`--max-calls 0` 保持 MCP 代调用预算为零。

若只需项目级 MCP，官方文档还列出项目目录 `.workbuddy/mcp.json`；Skill 的项目发现和 Connector 导入是否支持隔离项目，需要在实际版本核实，不能因为该路径存在就认定整套 Connector 已安装。

## 用户手动核实

1. 在 WorkBuddy 里确认版本、项目模式和连接器导入入口；本模板元数据使用 `minWorkbuddyVersion: 4.24.0`，具体本地导入是否支持未验证。如需用户级设置、插件或权限变更，先记录 `BLOCKED_USER_ACTION`。
2. 在用户确认后导入隔离副本，确保只选择 MCP + Skill，不混入 CLI + Skill。已有配置不覆盖；仅在本地任务中使用 stdio，不配置公网服务。
3. 确认宿主实际显示九个 `a2game.*` 工具和 Skill；分别在全新会话检查显式与自动触发，并记录非敏感版本和日志。官方建议单次工具请求约 30 秒内响应，慢速预览须按实际宿主表现记录超时，不能据此宣称通过。
4. 宿主直接编写 GameSpec/Conformance 后，按 `list/get → validate/test → inspect/preview → export` 验证并关闭预览。MCP Provider 调用应为 0；宿主模型用量未知时标 `UNKNOWN`。

官方参考：[Connector 结构与字段](https://open.workbuddy.cn/docs/connector)、[项目级 MCP](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)。示例配置和文件校验不构成实际宿主握手或正式 G3 验收。
