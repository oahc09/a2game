# A2Game Skill 能力改进（2026-11-07）

2026-11-08 [skill-checker修复收口](skill-checker-repair.md)：按用户确认MIT补元数据、Codex界面/隐式匹配策略和许可证；同步支持精确YAML/许可文件的8文件分发与指纹，历史3/6文件capsule可读。源码和ZIP解压目录codex检查均0严重/0一般、静态安全allow；56项相关回归通过、2平台跳过。最新包/报告见status.skillPolicyRepairRun；旧报告不改写，未增加Provider调用或正式Gate通过。

本轮更新技能与分发链路，没有追加真实宿主创作、Generator Provider、物理设备或远端 CI 执行。真实效果与技能实现分开记录，正式计数不升级。

后续增量已有两次当前宿主原生创作工程参考：[星隙快递](host-native-star-courier.md)和使用其反馈版Skill创作的[潮汐铸防](host-native-tidal-foundry.md)。后者实际验证生产资金、合成所有权、击杀奖励回投和伤害提升，双SDK包含不同建设路线；失败和反馈后Skill版本分别记账。下文首次技能改进的NOT_RUN为当时范围记录，不将两款参考样例升级成强隔离独立G3、跨宿主自动触发或跨模型质量通过。

2026-11-08又完成[光弧巡游](host-native-arc-drifter.md)实时射击成长实跑：补充正常键盘/虚拟多指移射、实质释放位移、成长前后弹丸快照与1/2/3真实命中、原生绘制后截图的证据。原Schema失败、驱动通关后的释放误判和黑图保留，反馈后Skill另包，不覆盖生成时版本；正式来源/跨宿主/真机边界仍独立。

## 宿主模型设计与修复链路

2026-11-07 根据用户澄清，Skill定位为指导宿主模型的知识和流程包，采用“自然语言需求→模型GamePlan→GameSpec/测试/解法→MCP验证→模型修复→实际试玩交付”。不同Agent/模型共用GameSpec `0.1.0`与共享Runtime；生成质量仍取决于模型设计能力、Skill指导和验证反馈的共同作用，跨模型效果不能由文档一致性推定。

GamePlan是当前宿主模型的创作规划，简单任务可用几行笔记，复杂任务展开机制联动、状态时序、输入/表现和验证路线；逐项对应需求、实际GameSpec与可复核证据。它不增加客户端协议或MCP参数。现有`plan_game`仍是无模型关键词草案，不能算模型设计；内部`game-plan.json`仅供显式选择原有`--plan-file`流程，普通MCP创作不依赖该格式。

新增反馈分层指引：按结构、能力语义、正反例/解法/生命周期、真实需求/画面问题和工具/基础设施问题定位根因。每轮保留原稿、重新取得artifact并重验，核对先前需求没有退化；诊断不证明全部自然语言语义，不能靠删负例、改需求或无限重试得到通过。

本次增量只改Skill及说明，同步五处已有副本、重新打包；未改MCP/Runtime实现、模型路由、调用预算或GameSpec。frontmatter、引用、ZIP/各副本SHA及真实公开capsule搬运检查按当前内容验证；上轮56项回归属于上轮代码变更记录，本次不冒充新跑。新版包与本次验证见`project/status.json.skillAuthoringChain`，旧包及回执保留。

| 用户提出的缺口 | 已实施 | 仍需实际证明 |
|---|---|---|
| 自动发现与触发 | 描述加入中文自然语言创作/改进触发词、A2Game 工作区范围及其他引擎排除；新增隐式/显式/不触发的观察办法 | 各宿主新会话读取/选择技能及工具发现，不能从本地副本推定 |
| 自然语言独立生成 | 需求→玩法循环→能力/状态/输入→原创三件套→失败留证→完整准入/双端试玩/交付；保留来源与隔离边界 | 真实宿主原生独立创作、完整失败链与来源证明；共享仓库练习不算隔离通过 |
| 高质量游戏 | 正常时钟与读屏期、视觉层次/窄屏/命中、素材审核与接收依赖、节奏/终态/重开、Agent试玩修复与主审复核 | 实际作品按新指南创作和试玩后的改进效果；文档不能代替画面或素材 |

唯一源码为 [Skill](../integrations/skill/a2game/SKILL.md)，按需加载 [发现](../integrations/skill/a2game/references/discovery.md)、[创作](../integrations/skill/a2game/references/authoring.md)、[质量](../integrations/skill/a2game/references/quality.md)。当前项目采用 Agent 质量评价，不新增真人批准门，历史报告保留。

现有九个 MCP 工具没有审核资源目录入口。素材清单由可信控制端提供；缺少清单时记素材 `NOT_RUN/BLOCKED`，不猜 URI、不增加付费制作调用、不改白名单。内容包仍需要接收方兼容的宿主、SDK 和审核资源。

分发同步了现有 `.agents`、`.trae`、`.codebuddy` 三处项目副本和两个连接器样例；未新增全局安装或修改宿主配置。公开创作 capsule 新建时携带完整六文件 Skill，校验继续接受历史三文件 v2 capsule，但拒绝半套新指南、额外文件、篡改或缺失。已有 run 的源码/Skill 指纹保持原始绑定，不重签历史证据。

校验发现旧 CLI 示例使用不存在的 `a2game.puzzle.grid-push`，已改为实际 Registry 的 `a2game.puzzle.push@0.1.0` 并查询成功。`skill:package` 接入现有 Python 解析桥，沿用显式环境/仓库 venv/PATH 顺序，不改变依赖锁。

验证范围：

- Skill frontmatter 校验通过；原仓库 venv 缺 PyYAML，校验工具改用 `uv run --no-project --with pyyaml --python .venv/Scripts/python.exe python -X utf8` 临时环境执行，未改项目依赖。
- ZIP 生成、完整性与入口引用检查通过，六个文件 SHA 留在包回执；各项目副本和 TRAE 样例 SHA 一致。
- `test/host-public-workspace.test.mjs`：12 通过、2 个文件 symlink 场景因平台权限显式跳过；目录 junction 拒绝实际通过。
- `test/host-agent-run.test.mjs`、`test/simulated-host-acceptance.test.mjs`、`test/host-first-audit.test.mjs`：44/44 通过。未运行新模拟批次；只复用现有回归。首次运行暴露两处旧夹具未携带新指南，补齐后通过，未放宽生产检查。
- 按 `skill-creator` 做一次只读独立行为复核：手机新游戏、已有作品改进、指定 Phaser 三种请求路由符合预期；反馈的素材清单入口缺口已补说明。这是显式加载后的指南复核，不是真实宿主自动触发或新作品生成验收；子 Agent 会话本身使用模型，额外 Generator Provider 调用为 0。

实际包和后续检查结果见 `project/status.json` 的 `skillCapabilityImprovement`。本轮未运行全量 Runtime/浏览器矩阵；仓库既有证据陈旧项按原台账独立保留。

本次 `npm run project:check` 仍报告既有 `G3: invalid preparation evidence: A2G_E_ACCEPTANCE_STALE: scripts/agent-workflow.mjs`，日志为 `output/skill-project-check-20261107.log`。未重签或修补该旧证据，不将局部验证写成仓库全量通过。
