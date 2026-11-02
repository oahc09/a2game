# A2Game Host-first 执行 Agent 启动指令

**主计划**：`A2Game-HOST-FIRST-Development-Plan-2026-10-31.md`。请先完整阅读主计划；本文件只是便于粘贴给 Agent 的入口，不替代 Gate 与 DoD。

请在已授权的 `oahc09/a2game` 本地工作区，按 Host-first 主线实施，**先执行 HOST-0 / HOST-1，不要跳批次**。

1. 先看 `git status --short`、`git rev-parse HEAD`，按 `AGENTS.md → PROJECT-PLAN.md → PROJECT-STATUS.md → project/status.json → project/generator-status.json` 读取现有合同，再检查 `generator/`、`integrations/mcp/`、`integrations/skill/a2game/`、测试与官方宿主文档。不得覆盖未提交用户文件。
2. 保留已有 CLI/MCP/Skill/Generator Core、双真实 SDK、GameSpec `0.1.0`、G01–G32/H01–H05、S0–S11 与全部旧 Gate；本轮不重建平行 Runtime，不改模型路由，不修改安全准入来迁就模型。
3. 生成 Qoder、WorkBuddy、TRAE **项目级** Skill + 本地 stdio MCP 安装参考包，分别根据实际宿主版本验证安装、Tool 发现、Skill 显式/自动触发。不要擅自修改宿主全局配置；实际安装和授权如需用户操作，给出准确步骤并标 `BLOCKED_USER_ACTION`。
4. 验证无模型通道：Skill → MCP `list/get → validate → test → inspect/preview → export`。宿主自身模型创作 JSON 时，MCP Provider 调用必须为 0；不继承 Generator Benchmark 已用完的 30 次额度。
5. 三宿主分别在全新会话执行 G01 Pilot；保留原始需求/模型 JSON/Conformance/修复链/工具轨迹与 SHA。严禁复制已有 G01 参考答案或用 fixture 代替真实创作。对失败先报告结构化诊断，再做同一 Agent 内有界修复；不得无限重试。
6. 只有 Pilot Gate 成立后，才开展 G01、G03、G17、G21、H01 × 三宿主的 15 单元真实评测，并分别在 CocosAirJS/Three.js 实际输入、Node/Host Hash、暂停重开、截图、视觉质量与资源释放中验收。真机、人工、正式 G3、远端 CI 均独立标识。
7. 每批输出实际代码差异、执行命令/回执、当前 HEAD/SDK/MCP/Skill/宿主版本、通过/未验证/失败/阻塞 Gate，更新 `project/host-first-status.json`（新增）、`PROJECT-STATUS.md` 和必要的文档，保持原 `project/status.json` 的历史计数真实。未经新授权不 commit/push/deploy、不操作凭据/权限、不删除重要文件。

**当前目标：** 完成真实 AI Agent 与 A2Game Skill/MCP 的可信使用闭环，而不是把 CLI 做成云端替身。第一批完成后再按主计划推进下一批，无需为了未授权模型调用而阻塞所有无模型工程任务。
