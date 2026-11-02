# TRAE 项目级 A2Game Skill + MCP 接入参考

本目录是 **TRAE 的项目级接入样例与中文使用说明**，属于HOST-1。最新复测已记录9个工具及宿主能力查询响应；早期项目级开关关闭为历史观察。当前版本/启动记录及Skill实际执行待补，详见[统一任务](../../../docs/host-first-followup.md)。

## 1. 官方依据（2026-10-31 检索 docs.trae.cn）

| 结论 | 出处 |
|---|---|
| 项目级 MCP 配置为项目根 `.trae/mcp.json`，保存后 TRAE 自动加载；仅在该项目生效 | [添加 MCP Server](https://docs.trae.cn/ide_add-mcp-servers) |
| stdio 配置格式 `{"mcpServers":{"<名称>":{"command","args","env"}}}`；`command` 必须在系统 PATH 中或使用完整路径，**不能含空格**；`args`/`env` 值必须全为字符串 | 同上 |
| 支持变量 `${workspaceFolder}`（目前唯一），启动时替换为项目根路径 | 同上 |
| 项目级 MCP 需用户在「设置 > MCP」打开显示为 `****` 的开关并确认；官方提示务必确保项目文件来源可信 | 同上 |
| 超时通过 `env` 设置：`START_MCP_TIMEOUT_MS`（启动）、`RUN_MCP_TIMEOUT_MS`（工具调用） | 同上 |
| 本地（stdio）Server 仅用于本地/工作树任务，云端任务不适用 | 同上 |
| 项目 Skill 位于项目路径下 `.trae/skills/` 目录；必须文件 `SKILL.md`；YAML frontmatter 需 `name`、`description`；支持手动显式调用与按描述自动加载（按需加载） | [Skills](https://docs.trae.cn/ide_skills) |
| TRAE 亦支持 Agent Skills 规范的 `.agents/skills/` 目录（需在「设置 > 技能与命令」开启）；与 `.trae/skills/` 重名时优先 `.trae/skills/` | 同上 |
| 全部 MCP Server 合计：工具数量上限 **40**、描述字符上限 **8,000**；超限按工具维度整条丢弃描述；模型上下文约 45K | [MCP 问题排查](https://docs.trae.cn/ide_troubleshoot-mcp-server-related-issues) |
| npx 启动要求 Node.js ≥ 20（本样例直接用 PATH 中的 `node`，同样受此环境约束） | 同上 |

以上为官方文档结论；本机仅完成界面可见性观察，实际接入行为仍须核实（见 §7）。

## 2. 目录内容与生成方式

```text
integrations/hosts/trae/
  README.md                               # 本文件
  sync-skill.mjs                          # 从唯一来源生成并校验安装布局（勿手改副本）
  project-example/
    .trae/mcp.json                        # 形态 A 模板：${workspaceFolder} 写法
    .trae/skills/a2game/SKILL.md          # 由 sync-skill.mjs 生成，禁止手改
    .trae/skills/a2game/references/*.md   # 同上
    mcp-isolated-workspace.example.json   # 形态 B 模板：绝对路径写法（复制后改名/合并使用）
```

- Skill 的**唯一内容来源**是 `integrations/skill/a2game/`（SKILL.md + references/）。`project-example/.trae/skills/a2game/` 下的副本一律由脚本生成，不存在第三份手工语义版本。
- 生成缺失的副本（不会清空或覆盖已有文件；目标内容与源不同时先人工检查）：

```powershell
node integrations\hosts\trae\sync-skill.mjs          # 生成并完整校验
node integrations\hosts\trae\sync-skill.mjs --check  # 只校验不写入
```

- 脚本校验口径与 `scripts/package-a2game-skill.py` 一致（frontmatter、相对链接、仅 `.md`、≤64KiB、禁符号链接），另做 §6 的结构性安全检查，并输出逐文件 SHA256 回执。

## 3. 前置条件（a2game 工作区，与 HOST-0 一致）

- Node.js 22+、Python 3.10+（按 `AGENTS.md`）；TRAE 侧 `command` 用的 `node` 必须能在其环境 PATH 中解析。
- `npm ci`、`npm run mcp:install`（安装 `integrations/mcp` 独立依赖）、`npm run build`（MCP service 依赖 `dist/index.js`）。
- `preview_game` 的真实双 SDK 预览另需 `npm run sdk:prepare` 与 Chromium；缺 SDK 时 preview 返回 `BLOCKED`，不影响 `list/get/validate/test`。
- **运行目录说明**：服务端全部路径按模块位置解析（`scripts/registry.mjs` 的 `root = import.meta.dirname/..`，源码已核实），与 TRAE 以哪个 cwd 拉起进程无关；会话产物（artifact、预览）固定写入 **a2game 工作区** 的 `output/mcp/<sessionId>/`，即使安装在隔离实验项目里也不落在实验项目目录。

## 4. 两种接入形态

### 形态 A：a2game 仓库本身作为 TRAE 项目（最直接）

```powershell
# 在 a2game 仓库根执行；随后用 TRAE 打开该仓库
if (Test-Path .trae) { throw '已有 .trae，请先人工合并配置，不要覆盖。' }
Copy-Item -Recurse integrations\hosts\trae\project-example\.trae .
```

`.trae/mcp.json` 使用 `${workspaceFolder}/scripts/mcp-server.mjs`：TRAE 打开的就是 a2game 工作区，变量替换后即为正确脚本路径。注意：仓库根会多出未跟踪的 `.trae/`，是否入库由维护者决定（含本机绝对路径时不要提交）。

### 形态 B：隔离实验项目（主计划推荐）

```powershell
# 示例路径可换；只在全新目录中创建，避免覆盖已有配置
if (Test-Path D:\labs\a2game-trae-pilot) { throw '实验目录已存在，请更换路径。' }
New-Item -ItemType Directory D:\labs\a2game-trae-pilot
Copy-Item -Recurse integrations\hosts\trae\project-example\.trae D:\labs\a2game-trae-pilot\
# 再把 D:\labs\a2game-trae-pilot\.trae\mcp.json 的内容替换为
# integrations\hosts\trae\project-example\mcp-isolated-workspace.example.json 的写法，
# 并把 <A2GAME_WORKSPACE> 改成你的实际 a2game 工作区绝对路径（正斜杠或双反斜杠）。
```

- 实验项目里 `${workspaceFolder}` 指向实验项目自身，**不能**再用它定位 a2game 仓库，所以必须换成仓库绝对路径（唯一官方变量只有 `${workspaceFolder}`）。
- Skill 副本随 `.trae/skills/` 一起进入实验项目；已知限制：实验项目内没有 `generator/cli.mjs`，Skill 中的 CLI 降级命令不可用，实验项目会话以 MCP 工具为主通道；CLI 降级仅在 a2game 工作区内的会话可用。

## 5. 用户显式操作步骤（BLOCKED_USER_ACTION，不由脚本代办）

1. 在 TRAE 中打开目标项目（形态 A 的仓库或形态 B 的实验项目目录）。
2. 「设置 > MCP」→ 打开显示为 `****` 的项目级开关 → 在弹窗中确认；确认项目文件全部来源可信（官方安全提示）。
3. Agent 窗口使用**本地/工作树**任务模式（本地 stdio Server 不用于云端任务）。
4. 安装可见性检查（纯 UI/配置层，无模型消耗）：
   - MCP 面板出现 `a2game` Server 且状态正常，工具清单为 9 个，名称均以 `a2game.` 开头：`list_capabilities / get_capability / plan_game / generate_game / validate_game / test_game / preview_game / inspect_game / export_game`；
   - 项目技能目录 `.trae/skills/a2game/SKILL.md` 就位（TRAE 按描述自动匹配加载）。
5. 无模型冒烟（会话内让宿主 Agent 调一次工具；这是宿主自身模型推理，A2Game MCP 侧 Provider 调用仍为 0）：显式要求“用 a2game 的 list_capabilities 查询能力前 5 项”，确认返回能力清单且未触发 `A2G_MCP_BUDGET`。
6. 本样例**不修改 TRAE 全局设置**；个人 `.trae/mcp.json` 含本机路径/个人信息时不要提交 Git。

## 6. 预算与安全合同（`sync-skill.mjs` 结构性强制）

- `args` 显式携带 `--max-calls 0`：A2Game MCP 默认模型调用预算为 0；宿主自身模型创作不消耗该预算，`generate_game` 在无预算时返回 `A2G_MCP_BUDGET` 拒绝。
- 样例禁止出现 `--provider` / `--provider-config`（不接入任何模型 Provider 与凭据）；`env` 仅允许两个官方超时变量且必须为数字字符串（当前 60000 / 120000，与服务端默认 `--timeout-ms 120000` 对齐）。
- 仅允许 TRAE 官方 stdio 字段 `command/args/env`；`command` 不得含空格；`mcpServers` 必须且仅含 `a2game`。
- 全目录密钥模式扫描（API Key / Bearer / token=… 等）；样例不含任何密钥，用户真实密钥只应写在**不入库**的个人配置中。
- 服务端 stdout 仅为 MCP 协议；宿主启动选项（provider 等）从不作为工具参数接受。
- 上下文预算：a2game 9 个工具、描述合计约 368 字符（2026-10-31 按当前源码实测），远低于 40 工具 / 8,000 字符上限；但上限按**全部 MCP Server 合计**计算，若同时启用其他 Server 需统筹，超限工具的描述会被整条丢弃（模型将看不到该工具，不视为模型选择错误）。

## 7. 未核实事项与核实步骤（当前 NOT_RUN / BLOCKED_USER_ACTION）

| 事项 | 当前状态 | 核实步骤 |
|---|---|---|
| 本机 TRAE 版本与项目模式实际行为 | 历史UI版本3.4.9；最新宿主查询已成功，当前回执版本与启动证据不全 | 按统一补证任务记录当前版本与启动日志 |
| `${workspaceFolder}` 在 `args` 字符串中的实际替换 | 未在本机证实（官方仅声明变量支持，未见字段级说明） | 形态 A 启动后看 MCP 面板 Server 状态/日志；若启动失败改用形态 B 绝对路径 |
| `.trae/skills/` 对 `references/` 子目录及链接的加载 | 未证实（官方推荐结构为 examples/templates/resources） | 安装后在会话中要求转述 workflow.md 内容验证；不生效则改用 `.agents/skills/` 入口（需在设置开启） |
| Skill 自动触发（自然语言）与显式触发 | `NOT_RUN`（属 HOST-G1） | 两类全新会话测试：不点名自然语言请求 / 显式点名 A2Game，记录工具顺序与 Skill 加载证据 |
| 工具描述裁剪的实际表现 | `NOT_RUN` | 对照 MCP 面板实际加载的工具数与上述 9 工具清单 |
| 项目级 mcp.json 是否支持 `cwd` 等非官方字段 | 不依赖（服务端路径解析与 cwd 无关，源码已核实） | 无需核实；如官方文档将来给出 `cwd`，可再评估 |
| GUI 环境继承 PATH（`node` 解析失败） | 未遇到（未实测） | 若报“您必须提供一个命令”，改用完整路径；路径含空格时 TRAE 会解析失败，需用无空格路径或 8.3 短路径 |

## 8. 边界

- 本目录只提供项目级参考布局，不安装插件、不改任何宿主全局配置、不调用模型、不操作凭据；实际安装/开关/授权均为用户显式操作。
- Skill 内容演进只改 `integrations/skill/a2game/` 源，先人工检查已有副本，再运行 §2 命令补齐并校验；两处不一致以源为准，`--check` 会报错。
- HOST-G0 起的正式状态、版本指纹与回执由总集成登记，不以本样例存在即视为通过。
