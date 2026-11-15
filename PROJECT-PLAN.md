# A2Game 开发计划

## 先看当前要做什么

2026-11-15用户明确调整优先级：**先完成功能与已知问题收口，再开展实际验证与正式验收**。当前执行队列见 `project/function-closure-work.json`：先追查Air历史异常和播放器问题，再补生成任务/发布版本的持久化恢复、账户与发布权限、鉴权和生产部署准备。开发中保留必要回归；实际宿主新生成、设备测试和集中验收后置，不提前追加模型调用或部署。未知异常须取得复现或诊断证据，不能以未复现登记为已修复。

当前进入第二阶段：把“Agent能生成游戏”推进到“Agent能制作质量更好、应用能直接加载的游戏包”。

| 顺序 | 工作 | 希望交付的结果 |
| --- | --- | --- |
| 1 | 改善三款代表游戏 | 推箱子、射击、合成炮台都有清楚的玩法、操作和反馈 |
| 2 | 丰富素材与效果 | Agent可以选择主题、角色、道具、动画和声音 |
| 3 | 完善独立播放器 | 业务网页无需携带整个仓库就能加载游戏 |
| 4 | 完善版本管理 | 能修改游戏、增加关卡、保存旧版并回退 |
| 5 | 接入实际客户端 | 先网页，再Android WebView；有设备后检查实际运行 |
| 6 | 开发云端服务 | 本地流程稳定后，再处理生成接口、发布和分发 |

部分工作已经有本地实现，表格不是“全部从零开始”的任务清单。完成项与剩余项见[当前进展](PROJECT-STATUS.md)，本轮详细安排见[第二阶段计划](docs/A2Game-Game-Creation-Delivery-Phase2.md)。

## 本文件怎样阅读

下面保留完整技术范围、协议约束、历史阶段和验收要求。它用于开发和追溯；只想了解产品或开始试玩，可以先看[项目首页](README.md)。

常见缩写：`Gate`是验收条件；`DoD`是完成标准；`Capability`是游戏可声明使用的能力；`Conformance`是检查玩法规则的步骤文件。出现“参考通过”时，表示指定范围的检查通过，不表示全部质量已经达标。

<details>
<summary>展开此前的计划调整记录</summary>

> **2026-11-08 第二阶段实施中**：[Game Creation & Delivery](docs/A2Game-Game-Creation-Delivery-Phase2.md)已有 G01三关、G17纵版和H01策略作品、3个受审2D主题、通用机体图元、实验独立SDK与本地版本交付。H01质量、G17 Air和Android WebView定向收口推进中；展示质量、丰富素材和真机仍有缺项，不宣称整阶段完成。历史Host-first/正式G3口径保留。

> **2026-11-07 Skill创作链路定位**：由宿主模型执行自然语言需求→GamePlan设计→GameSpec→MCP验证→模型修复→可玩交付。GamePlan为Agent创作规划，不增加客户端运行协议；既有plan_game为关键词草案，不能记成模型设计。保持各Agent/模型共用GameSpec 0.1.0与Runtime，后续真实跨模型效果需独立验证，不追加调用额度。

> **2026-11-07 用户质量口径调整**：当前产品及正式G3的质量评价环节以Agent质量替代真人质量：Worker实际试玩/截图/问题记录→修复→主审复核。G21/H01 revision3已完成本轮质量复核，G01/G03/G17待补，不从功能通关直接推定质量通过。下文历史人工/真人要求保留历史描述，与本条冲突时以本条为准；来源、独立性、调用链、真机和其他正式G3条件及计数不因改名自动升级。

> **2026-11-07 问题修复后收口**：G21格位输入及G21/H01炮台重叠已提供独立工程修正版，相关双SDK操作复核通过；下一步按精简计划HF-N5整理五款交付入口，完成一份包的接收方导入使用路径，再收集人工试玩反馈。保留所有旧失败/expired及正式Gate，不扩展矩阵。

> **2026-11-06 下一步**：WorkBuddy G01绑定补验已收口；按[精简计划的最新顺序](docs/A2Game-HOST-FIRST-Lean-Execution-2026-11-04.md)先准备G03三消，再按真实失败修复，依次推进G17→G21→H01并穿插交付说明。Qoder/TRAE待定；不重跑G01、不扩展矩阵，新模型执行需对应明确额度，历史正式验收不升级。

> **2026-11-04 执行调整**：当前按用户[Host-first精简执行计划](docs/A2Game-HOST-FIRST-Lean-Execution-2026-11-04.md)仅推进HF-N0→HF-N1→HF-N2；先真实可玩游戏，复用现有工具和最小相关验证，不再扩展模拟矩阵或新测试体系。下方历史目标及正式验收标准不重置。
> **性质**：项目目标、技术边界与验收合同；不是“已经开发完成”的功能列表。  

> **当前主线（Host-first）**：先推进 HOST-0/1 的宿主基线与项目级接入，再依真实宿主 Pilot Gate 进入后续批次；原 S0–S11 和 Generator 验收范围保持不变。见 [Host-first 计划](docs/A2Game-HOST-FIRST-Development-Plan-2026-10-31.md) 和 [状态](project/host-first-status.json)。

> **项目发行基线**：`1.0.0`（参考实现 / Alpha，不代表生产稳定）。  

> **独立协议**：GameSpec / Capability Manifest / Tick/Rule / Conformance `0.1.0`（部分源规范文档标记 draft）。  

> **当前执行阶段（2026-10-31）**：Batch A/B/C保留工程参考；Batch D已执行10/10、30次额度用尽，9/10工程及来源输入通过。H01规划模式原稿仍失败，宿主修正版及HUD已完成局部双SDK参考复验，真实模型重测未运行。Batch E已有MCP无模型工程、真实Provider历史调用和项目级Skill宿主练习；Provider模型身份尚未独立核实，Skill新会话自动发现与触发仍待验。播放器终局反馈已局部验证；当前源码的37款基础及作者变体共148个双SDK参考实例通过，完整回归及覆盖索引未重跑。正式G3 0/37和Verified 0/32+0/5不变，真机、人工与远端CI独立。见project/generator-status.json和最新实际回执。

> **下一步**：后续按需补全当前源码的工程回归和覆盖索引，继续 Skill 新会话自动触发及独立模型身份核验；真实模型复测需要另行授权预算。

</details>

## 0. 项目目标与不可变边界
**目标**：AI 直接生成引擎无关的 JSON，经过可信能力目录、结构校验与语义检查后，由同一份游戏逻辑运行时执行；CocosAirJS、Three.js 或未来 Host 只负责表现、平台输入与受控服务。先覆盖益智、小游戏、休闲、射击，并包含塔防、合成经营、棋牌/回合能力与 Touch/IMU；未来可扩展游戏、设备、物理后端和 2D/3D。

- **GameSpec 不含可执行任意 JS/TS、DOM/URL 脚本或引擎特有节点类**；新玩法先定义版本化 Capability、可信实现与测试。

- **玩法逻辑共用**：状态/规则/随机数/胜负/网格/战斗必须在 A2Game Runtime，不能在 Renderer 中按 `game.id` 硬编码逻辑。

- **精确语义和宿主相关语义分层**：相同初态 + 相同规范化输入 + 相同已定义 exact 服务 ⇒ 相同 exact logical hash；宿主物理、音频、材质按可审计的功能与容差合同检查，不能宣称逐像素一致。

- **单时钟**：正式游戏只由一个 Tick 调度器推进；GUI 事件只能入队。快进/录制/暂停/恢复明确消费时序与追帧预算。

- **游戏定义 / Session 状态 / Renderer 资源所有权严格分离**；重开、销毁、场景释放不可残留输入、计时器或 GPU 句柄。

- **能力可用性、权限与降级显式声明**：未实现的 IMU 或外部 SDK 不得标为支持；未知必需能力拒绝加载。

- **审计口径真实**：`planned`、`documented-only`、`BLOCKED`、`NOT_RUN` 不能进入 verified 分子；Mock/Canvas2D 不冒充真实 CocosAirJS/Three.js G2。

- 不擅自提交/推送/部署/开启权限、不操作密钥或删除重要数据；增量修改保留历史规范与用户文件。

## 1. 规范、实现和测试的唯一位置
| 内容 | 权威文件 | 不应混淆的事项 |
|---|---|---|
| GameSpec JSON 结构 | `specs/v0.1/docs/01-GameSpec-V0.1.md` + `schemas/game.schema.json` | 项目 1.0.0 ≠ JSON `specVersion: 1.0.0` |
| 能力、版本和宿主协商 | `.../docs/02-Capability-Manifest-V0.1.md` + `schemas/capability.schema.json` | 计划 Capability ≠ 已注册实现 |
| Tick/Rule 执行与随机数 | `.../docs/03-Runtime-Tick-Rule-Semantics-V0.1.md` | 不允许实现任意改变 Tick 顺序 |
| 验收口径 / Gate | `.../docs/04-Conformance-Test-V0.1.md` | PASS 必须有可复现回执 |
| 32 个玩法及未来登记规则 | `.../docs/05-Coverage-Registry-V0.1.md` + `coverage/games.json` | G01..G32 全部仍为 planned |
| 表现和输入增量规范 | `.../docs/06-Presentation-Slice-V0.1.md`, `07-Touch-Swipe-InputTrace-V0.1.md` | 只覆盖目前声明子集 |
| 已有参考实现 | `src/`, `player/`, `scripts/`, `test/` | 只能按实际执行测试记录确认功能 |
| 当前阶段和证据 | `PROJECT-STATUS.md` + `project/status.json` | 对外报进展只引用这里的现行回执 |
| 本计划与未来迭代 | **本文件** + `AGENTS.md` | 变更必须遵循第 8 节 |
| Generator 工程和批次记录 | `project/generator-status.json`、`docs/generator-*.md`（存在时） | Batch A/B/C 参考完成不代表 MCP/Skill 完成 |
| MCP / Skill 契约 | `integrations/mcp/`、`integrations/skill/` 及对应测试 | 本地工程已存在；发布及新会话自动触发仍需独立验证 |

若规范之间存在矛盾：记录为 `SPEC_CONFLICT`，同步更新相关规范、Schema、测试向量后才能关闭；不能单边以实现覆盖协议。`docs/08-*`、`09-*` 与旧 `reports/v03-*` 是历史证据，只读保留，不是当前路线图。

## 2. 技术架构（长期不变的责任边界）
```text
Natural Language / AI Agent
   ↓ 读取 Capability Manifest、范例与约束
GameSpec JSON + tests (禁止任意脚本)
   ↓ 完整 JSON Schema 2020-12 + manifest/ref/版本检查
Compiled Game Plan
   ↓
Headless Shared Runtime ── Gameplay Library (Grid/Match/Combat/Economy/...)
   ├── Normalized Input (Pointer/Keyboard/IMU/未来设备)
   ├── Rule/Tick/Events/Transactions/RNG/Hash
   ├── 可替换的确定性或声明容差 Physics/Navigation Service
   ├── Conformance/Replay/Save/Observe
   └── PresentationFrame（只读）
          ├── Canvas2D 预览（参考）
          ├── CocosAirJS Host Adapter（四样例 scene2d 真实 G2 PASS）
          ├── Three.js Host Adapter（四样例 scene2d 真实 G2 PASS）
          └── 后续新 Host
```

**对外入口补充（2026-10-30）**：CLI / MCP / Skill 均只访问同一 Generator Service；无模型 `validate/test/preview/export` 不能隐式调用 Provider。下方共享 Runtime/Host 边界不变。

**执行顺序**以 Tick/Rule 规范为准；不得通过渲染帧率控制玩法得失。状态 Hash 仅对 exact logical projection 负责，屏幕像素和宿主碰撞结果不自动计入 exact 比对。

## 3. 全阶段实施范围（全部必须纳入计划，不使用 P0/P1/P2 删减）
下表的参考 PASS 均以限定范围为准；完整回归与覆盖索引待验，当前源码状态以 project/status.json 为准。
| 阶段 | 交付范围 | 依赖与执行重点 | 完成定义 / Gate | 当前状态 |
|---|---|---|---|---|
| **S0** 协议与样例基线 | 四份主规范、7 Schema、Capability/Adapter/Coverage 样例、32 候选 | 版本语义、静态交叉引用 | G0 格式/引用基线证据可复现 | **完成设计；实现仍将扩展** |
| **S1** Headless 共享逻辑 | 事件规则、状态事务/回滚、计时、RNG、exact hash、快照、输入轨迹、网格合并与推箱子 | 通过正反例与并发冲突测试 | G1 参考子集 PASS；完整标准库另算 | **子集通过，整体 PARTIAL** |
| **S2** 真双引擎适配 | 获取并锁定 SDK、在真实 HTTP 浏览器分别启动、绘制、触摸/键盘、暂停/重开/释放、同 JSON 哈希对照 | 不能用 Mock、Canvas2D 代替真实 SDK | CocosAirJS 和 Three.js 各自真实 G2 PASS，含截图与回执 | **四样例 scene2d 子集真实 PASS；真机/其他能力另验** |
| **S3** 内容安全与交付流水线 | 任意 AI JSON 完整 Schema 2020-12、语义/版本安全校验、资源引用/完整性/来源策略、编译计划与缓存、错误修复反馈 | 浏览器或服务端使用等效完整校验，不降低为手写子集 | 未信任内容拒绝、负例和篡改测试，安全发布 Gate | **当前宿主 Profile PASS（审核资源、内容包交付、完整重验与回执）** |
| **S4** 通用表现 | Sprite、Texture、Mesh、Camera、Text、Animation、Particle、Audio、UI/HUD、Shader 扩展、资源生命周期；2D/2.5D/3D | 版本化 Manifest，Host 受控映射 | 不按游戏 ID 分支；双引擎截图/坐标/性能/释放 Gate | **当前版本化 Stage PASS（2D/2.5D/3D、材质、动画、粒子、事件音频与释放）** |
| **S5** 益智与休闲标准库 | Grid、Push、Slide、Merge、Swap、MatchN、Cascade、GravityFill、Tray、Layer/Occlusion、Sort、Polyomino、Rotate、LineClear、Undo、Find/Placement | 玩法契约与回合/混合时间语义；每机制测试变体 | G01–G10、G20、G24 对应能力/玩法验收 | **参考标准库 Profile PASS；逐 Gxx / Agent 另验** |
| **S6** 实时玩法、物理与战斗 | Movement、Jump/Charge/Runner、Collider/Contact/Physics、Weapon/Projectile/Hitscan/Damage/Status/Wave/Target/AI、导航、对象池 | 命中去重、物理服务 Profile、终局、性能 | G11–G21、G30/G31 对应目标 + 不同 Host 对照 | **aabb-int-v1 参考 Profile PASS；非任意 3D 物理** |
| **S7** 经营、策略、回合 | Economy/Inventory/Production/Shop/Upgrade/Unlock/PlacementGrid/PathFollow/Turn/Deck/Hand/LegalMove | 持久化及回合/实时混合 | G21–G24 和机制变体，跨域状态一致 | **经营/路径/回合参考 Profile PASS；Gxx / G3 另验** |
| **S8** Mobile Touch/IMU | Raw pointer 多点/轨迹、Tap/Hold/Drag/Swipe/Pinch/Rotate、IMU Tilt/Shake/Orientation、校准/权限/滤波/回退、InputTrace | 真机权限、坐标、输入冲突、暂停与隐私 | G25–G32 真机与合成 Trace 双重验证 | **工程/虚拟输入 PASS；真机仍 NOT_RUN** |
| **S9** 全玩法覆盖与混合 | 冻结 G01–G32；增加 H01–H05 组合验证；32 分母可扩版本 | 每种完整 GameSpec、玩法正反例、E2E、Agent 变体 | 32 款分别出 verified receipt，Hxx 独立统计 | **37 个独立有界候选参考通过双 SDK；完整 DoD/G3/真机未完成覆盖 Gate** |
| **S10** Agent 生成与产品化 | 自然语言→JSON、能力目录查询、报错修复、关卡生成/Solver、难度评估、可视化调试、模型无关流程 | 自动化评测无画面 + 实浏览器；不可将人工样例当 one-shot | G3 生成、可玩性、修复闭环及质量门禁 | **生成/修复/求解/双 SDK 调试工程参考通过；独立模型 G3 NOT_RUN** |
| **S11** 持续兼容和扩展 | 新 Host、设备、网络多人、存档迁移、性能和文档发布 | 独立 Extension/Profile，变更兼容审计 | 多版本回归、可复现 CI、兼容性发布说明 | **初始参考 Profile PASS：存档/本机公开回合/Gamepad/Node 多版本/性能/CI 配置；物理、完整 G3、远端 CI 另验** |

阶段之间可以并行实施互不冲突的能力包，但**不能越过对应 Gate**，例如 S4 增加 Mesh 并不能将 S2 真 SDK G2 判为通过。

### 3.1 32 款游戏按工作组分配（全部保留）
| 工作组 | 注册 ID | 重点机制与验收（完整细节见 coverage registry） |
|---|---|---|
| 棋盘与匹配 | G01–G05 | 推动、单次合并、连锁、层叠/遮挡、槽位容量 |
| 解谜与拼图 | G06–G10 | 方向阻挡、翻牌、Polyomino、旋转锁定、物品归位 |
| 休闲实时 | G11–G16 | 跳跃/蓄力、Flappy、跑酷、反弹、弹球、物理合成 |
| 战斗与塔防 | G17–G21 | 飞机、俯视射击、僵尸生存、泡泡弹射、塔防 |
| 经营和回合 | G22–G24 | 农场、合成经营、五子棋/合法回合（不暗示完整棋牌 AI） |
| 移动输入 | G25–G32 | 切割轨迹、双指旋转、IMU 重力/平衡/摇晃、弹弓、姿态瞄准、多指机关 |

**五个独立混合验收 H01–H05**（各自单独 GameSpec/Conformance/回执，不能与 Gxx 互相替换）：

| ID | 混合玩法 | 跨域合同与重点故障 |
|---|---|---|
| H01 | 合成炮台保卫战 | Merge + TowerDefense；实体替换后旧武器引用、波次、经济时序 |
| H02 | 三消 + 角色升级 | Match/Cascade + Upgrade；阶段提交、HUD/伤害效果协调 |
| H03 | 跑酷 + 射击 | Runner + Weapon；并发 Touch 输入、单时钟、弹丸回收 |
| H04 | 物理合成 + IMU 倾斜 | Physics + IMU；权限/校准/回退、碰撞与合并去重 |
| H05 | 找物 + 限时关卡 | Placement + Timer；HitTest、计时冻结、成功/失败裁决 |

### 3.2 Gameplay Capability 家族（规划目录，不等于已实现）
- `core`: Entity, State, Tag, Relation, Query, Event, Rule, Timer, Counter, RNG, Spawn, Destroy, Flow, Level, Save, Score, Goal/Failure。

- `input`: Tap, DoubleTap, Hold, Swipe, Drag/Drop, MultiTouch, TouchPath, Pinch/Rotate, Axis2D, Aim/Fire, Raw Touch, Acceleration, Gyroscope, Orientation, Tilt, Shake, Calibration。

- `puzzle`: Grid, Occupancy, Neighbor, Select, Swap, Slide, Push, Merge, MatchN, ConnectedMatch, Cascade, GravityFill, Tray, Capacity, Layer, Occlusion, Sort, Placement, Direction, LineClear, Polyomino, Rotate, Reveal, Pair, Undo, MoveBudget。

- `realtime/physics`: Velocity, Acceleration, Follow, Seek, Patrol, LaneMove, Jump, Charge, Landing, Boundary, Trigger, Checkpoint, AutoScroll, Spawner, DifficultyCurve, RigidBody, Collider, Contact, Bounce, Constraint, Breakable。

- `combat`: Health, Shield, Team, Target, AutoTarget, Weapon, Cooldown, Ammo, Projectile, Hitscan, Spread, Burst, Pierce, Homing, Explosion, Damage, Invulnerability, StatusEffect, Knockback, Death, Drop, Wave, Horde, BossPhase。

- `economy/strategy/turn`: Resource, Cost, Reward, Inventory, Production, Collect, Upgrade, Unlock, Shop, PlacementGrid, Path, PathFollow, Tower, Range, Turn, PlayerOrder, ActionPhase, Deck, Hand, Draw, Discard, LegalMove, PieceMove, Capture, HiddenInfo。

- `presentation`: Sprite, Mesh, Material, Animation, Particle, Trail, Camera, ScreenShake, UI, Text, Audio, Haptic。

目录新增机制时，必须同时定义：参数 Schema、状态字段、命令、事件、依赖、Tick 阶段、资源预算、重启/释放、负例、随机/确定性约束、Host 支持和 Conformance 测试。

## 4. 基线 Gate 与正式验收制度
| Gate | 检查 | 达到 PASS 的最低证据 |
|---|---|---|
| **G0** 静态完整性 | GameSpec/Capability/Adapter/Trace/Coverage Schema、引用、精确版本、来源和白名单哈希 | 真实检查日志 + 输入清单 + 失败样例；不以字段数量代表语义完整 |
| **G1** 共享玩法 | Tick/Rule、事务、RNG、回放、各已声明逻辑能力 | 所有目标能力的正反例 + Conformance + 重开/暂停/边界 + 状态 Hash |
| **G2** Host E2E | 真实 CocosAirJS / Three.js GPU 或 UI、输入、资源、退出重建 | 固定 SDK SHA、浏览器版本、URL、截图、输入 Trace、Hash、资源回收和异常归因 |
| **G3** 游戏与 Agent | 完整代表玩法、规则变体、AI one-shot/修复、交互体验 | 每个 Gxx/Hxx 的玩法 DoD、Agent 提示和输出、运行/可玩性证据 |
| **Mobile** | 真机 Touch/IMU | 设备/系统/浏览器、权限结果、姿态校准、Trace 与回放、不同方向/焦点测试 |

覆盖率**按固定分母**：`Game Verified Coverage = 通过目标 G0/G1/G2/G3 的 Gxx 数 / 冻结 Gxx 总数`；按 HostProfile 分别统计。新增 G33+ 必须发布新登记版本，旧基线分母保持可复现。`documented-only`、`planned`、`NOT_RUN`、`BLOCKED` 不算 verified。Capability verified / Adapter coverage / Agent gate 分开报告，禁止混为一个百分比。Engine/INFRA/Agent Strategy 失败归因分开。

### 新增单个游戏的最小 DoD
1. 游戏玩法说明、交互、失败/胜利、核心视觉效果、禁用与边界行为明确。

2. 绑定全部必需 Capability，有符合 Schema 的 GameSpec、合法资源与使用方式。

3. 无画面正反例，确定性回放（或声明的物理语义容差）、重开与失效清理通过。

4. 真实目标 Host 手动交互和自动 E2E：启动、胜负、重试、暂停、画面截图、资源释放。

5. AI 从自然语言生成至少一次规则变体并通过验证，记录模型/提示/输出/修复成本。

6. 写入对应 `CoverageResult` 证据和版本；否则保持 `planned` 或 `PARTIAL`。

## 5. S2 可复用验收合同（四样例 scene2d 已执行；扩展须重验）
2026-10-24 实际回执：`reports/g2-threejs-real.json`、`reports/g2-cocosairjs-real.json`。命令 `npm run sdk:prepare`、`npm run g2:real`；16 游戏/视口场景及 2 原生时钟/context loss 场景通过。下列合同继续约束后续新能力；不意味着整个 32+5 或 S4 已完成。

1. 在独立本地工作区安装本 README 锁定的 Three.js 版本和真实 CocosAirJS SDK 构建，记录来源、SHA、构建方式。**不得伪造 vendor 文件**。

2. 运行 G0/G1 基线，保证和当前 Headless 结果一致；进入浏览器以前检查实际输出。

3. 同一 HTTP 域下运行 `?backend=three`、`?backend=air`，至少覆盖四个已交付游戏 JSON、键盘/Pointer、重开/暂停/销毁。分别截屏与捕获 JavaScript 错误。

4. 使用相同标准化输入对照 Node 与两个 Host 的 `exactHash`、Tick 数、胜负与动作消费；发现差异提交最小复现。

5. 检查 DPR、窗口缩放、横竖屏（如适用）、WebGL context loss、连续切换/释放和内存/监听器泄漏。

6. 只有两端真实 SDK 均产生成功回执，才将 G2 对应 Host 标为 PASS。阻塞只能记录 `BLOCKED`/`NOT_RUN` 和明确阻塞条件。

## 6. S3–S11 扩展的默认交付结构
新增能力的 PR/patch 或独立交付包应包含：

```text
src/modules/<capability>.ts
specs/v0.1/capabilities/<id>.capability.json
specs/v0.1/games/<reference>.game.json
specs/v0.1/tests/<reference>.conformance.json
test/<capability>.test.mjs
reports/<gate-receipt>.json
PROJECT-STATUS.md + project/status.json (仅在真实验收后更新)
```

如改变原协议结构，另需同一变更内更新对应主规范/Schema、迁移脚本、兼容性测试及 release notes。不要修改历史样例语义来让新实现“通过”。

## 7. 风险、前提和不保证的内容
| 风险 | 控制措施 |
|---|---|
| 新表现能力或设备缺乏真实 SDK 验证 | 既有 G2 只覆盖四样例 scene2d；新增能力/平台必须有独立真实回执，不沿用旧 PASS |
| `1.0.0` 误认成稳定正式产品 | 每份入口写明“参考工作区发行版本；技术成熟度 Alpha”；协议独立版本 `0.1.0` |
| 动态内容超出当前准入范围 | 本地可信服务已执行完整 Draft 2020-12；资源/多场景/未支持宿主特性拒绝，后续按独立 Profile 扩展并重验 |
| 玩法核心与 Renderer 相互污染 | Adapter 接口仅消费 PresentationFrame/标准平台事件，禁止按游戏 ID 分支 |
| 物理和输入产生宿主差异 | 独立服务 Profile；按 Exact/Host-defined 约束和容差进行测试 |
| IMU 权限/硬件缺失 | 首先能力探测、用户授权、校准、声明式回退；记录 NOT_AVAILABLE |
| 创作素材版权、安全和资源体积 | 可信素材来源、资源 manifest、下载预算、错误处理，禁止任意 URL 脚本执行 |
| 游戏样例数量造成虚高覆盖率 | 32 冻结分母，Hxx 单独计数，目标 Host G2/G3 都要过 |
| AI JSON 输出质量不稳定 | 生成 JSON 同时输出 tests，Agent Gate 独立衡量成功率、回修次数和失效类型 |

## 8. 变更控制（防止后续迭代偏航）
1. 修改前读 `AGENTS.md`、本文件、`PROJECT-STATUS.md`，并检查工作区差异；留存基线 SHA/打包摘要。

2. 将变更分类为 **实现补齐**、**新增 Capability**、**协议兼容增量**、**协议破坏性变更**、**验收证据更新**。

3. 不删除已有目标与约束；若调整 scope，须在 `CHANGELOG.md` 明确旧口径、新口径、迁移和影响的 Gate / Coverage 分母。

4. 新 Capability 一律先写 Manifest/测试契约再写实现；改规则执行顺序必须同步更新 Tick/Rule 文档、Golden Vector、跨引擎回放测试。

5. 对同一个阶段，只在实际执行并留下路径可复现的 Gate receipt 后修改状态；`Mock PASS`、`not run` 不得升级。

6. 每次交付运行 `npm run verify`（缺环境须记录 BLOCKED），以及 `npm run project:check`，同步版本、README、状态和变更日志。

7. 禁止未经用户授权提交、推送、部署；所有改动在可检查的工作区或独立补丁包内交付。

## 9. 优先级确认：Generator CLI Core → MCP Server → Skill（本轮主线）

### 9.1 对外产品形态与阶段顺序

**产品定义**：A2Game Generator 是**本地可运行的 AI 游戏创作工具链**，最终产出可信的 GameSpec `0.1.0`、测试与资源回执；客户端的 A2Game Runtime / CocosAirJS / Three.js 负责播放。CLI、MCP、Skill 只是访问同一套 Generator Core 的不同入口，不得各写一套生成和校验实现。

| 阶段 | 对外交付 | 当前优先级 | 重要边界 |
|---|---|---|---|
| **核心产品** | `a2game` CLI + Generator Core + Validator / Headless / Player | 已有 Batch A/B/C 工程参考，继续稳定 | 所有后续入口复用 CLI 对应的可编程 Service，不通过 shell 拼接命令重复实现业务 |
| **AI Agent 工具入口** | **本地 MCP Server（stdio）** | **当前最高新增开发任务：GEN-9** | 提供能力发现、接收已有 JSON、校验、测试、可选代调用 Provider 生成及预览；默认不触发模型调用 |
| **Agent 使用说明** | **A2Game Skill** | **与 MCP 联动：GEN-10** | Skill 仅提供能力选择、工具操作/安全/验收工作流；不得将规则实现、模型密钥或游戏答案复制进 Skill |
| **辅助体验** | 本地 Studio / Inspector | Batch C 已有工程参考，维护兼容，**非 MCP/Skill 前置 Gate** | 复用既有 localhost Player 和双 Host，不另造 Generator API |
| **独立部署能力** | Player/Protocol 独立 SDK 包 | 后续产品化，不删除原计划 | 需单独包、版本/兼容/全新安装测试，不因 CLI 可运行就认为 SDK 发布完成 |
| **云端服务** | Cloud API、在线生成队列、资源托管、账号/计费 | **明确后置，仅保留 Service 扩展接口** | 本轮不实施服务、域名、线上发布、远端凭据管理 |

**两种等价用户路径必须同时支持**：

- **外部 Agent 自己生成 JSON**：Agent 读取 Capability → 产生 GameSpec/Conformance → MCP/CLI `validate`、`test`、`preview`、`export`。**此路径不调用第二个模型**。
- **由 A2Game Generator 调用模型**：用户/Agent 明确选择 Provider → CLI/MCP `generate` → 已有受限重试和验证链路 → 返回可测试内容。模型不可用时报告 `BLOCKED_PROVIDER`，不偷偷改用其他模型、不调用 fixture 冒充生成。

第三种受控流程是人工提供现有 JSON，直接 validate/test/preview，无须模型或 Skill。CLI 与 MCP 的无模型命令必须可以在离线、干净源码工作区执行；GPU/SDK 或真机相关 Gate 仍按实际环境计量。

**本轮仍不做**：新增引擎、修改 CocosAirJS/Three.js 路由、重写 Tick/Rule、变更 GameSpec 协议、任意脚本执行、整体 monorepo 迁移、云服务部署、自动安装全局 Skill、凭据托管及外部授权操作。`1.0.0` 是参考工作区版本，不是发布稳定性证明。

### 9.2 现有基线与本轮变化（以上传文档历史 15.1–15.6 为准）

| 基础能力 | 现有入口/记录 | 处理原则 |
|---|---|---|
| Capability Registry / Manifest | `src/registry.ts`、`scripts/registry.mjs`、`specs/v0.1/` | MCP 只读暴露真实注册能力与依赖闭包，不能凭宣传目录声称已实现 |
| Generator / Provider | `scripts/agent-workflow.mjs`、`scripts/codex-generator.mjs`、`scripts/model-generator.mjs`、`scripts/http-generator.mjs` | 保留调用预算、模型来源、输出字节、错误码与现有路由；通过 Core/Service 复用 |
| 游戏校验与运行 | `scripts/content-service.mjs`、`src/validator.ts`、`src/runtime.ts`、`src/conformance.ts` | MCP/CLI/Studio 调用同一权威实现和 Policy；不放宽完整 JSON Schema 2020-12 |
| 无模型工具与输出 | 既有 CLI、`player/inspect.html`、`scripts/agent-browser.mjs` | 新 MCP 以这些能力为后端，不复刻浏览器和 Runtime |
| 已有本地 Studio | 第 15.6 节 Batch C 记录 | **已有参考实现，保留不删**；不追加为下一阶段的开发焦点 |
| 工程记录 | 第 15.6 节：137 Node、203 Conformance、360 Schema；Batch C 参考通过 | **仅是附件中的历史本地记录**，本轮未重新跑；未来以实际测试证据与台账为准 |
| 尚未完成 | H01真实模型重测、产品质量、Skill新会话自动触发及独立宿主、GEN-8完整交接、正式G3/真机/远端CI | Batch D已执行10/10，9/10工程通过，30次额度用尽；未验项目不升级 |

本计划及早期设计记录本身**不是新增 MCP/Skill 实现证据**；后续工程和宿主练习以实际回执及独立台账为准，新会话自动触发等未验项保持 `NOT_RUN`。

## 10. Generator 产品接口与运行边界

### 10.1 单一可信调用核心与对外拓扑

```text
Codex / Claude Code / 其它 AI Agent / 人类开发者
      ├── CLI: a2game ...
      ├── MCP Client → 本地 A2Game MCP Server（stdio）
      └── Skill: 指导模型选择、发现能力、调用 CLI/MCP
                    │
                    ▼
             Generator Service（唯一）
      ├─ CatalogQuery / Capability Dependency Closure
      ├─ GamePlan（仅用于生成准备；非 GameSpec 方言）
      ├─ Provider Resolver（明确配置；可选，不隐式调用）
      ├─ GameSpec + Conformance Parser / Compiler
      ├─ JSON Schema 2020-12 + Content Admission / Asset Policy
      ├─ Headless Tick / Rule / Solver / Replay / Exact Hash
      ├─ Local Immutable Release / Receipts / Diagnostics
      └─ Preview / Inspector → CocosAirJS / Three.js
                    │
                    ▼
   游戏包 GameSpec 0.1.0 + tests + approved assets
```

**唯一事实来源**为 `specs/v0.1/`、现有受信能力 Registry/Runtime 和现有 Content Service。MCP 不直接执行 GameSpec 里的 JS/TS、脚本、URL、shell，不直接读取模型凭据。`GamePlan` 是 Generator 内部结构化规划，不可以直接交给播放器运行。

**统一 Service 接口（拟议，实施前对齐现有函数签名）**：

```ts
interface GeneratorService {
  listCapabilities(query?: CapabilityQuery): Promise<CapabilityList>;
  getCapability(ref: CapabilityRef): Promise<CapabilityDetail>;
  plan(request: PlanRequest): Promise<GamePlanResult>;
  generate(request: GenerateRequest): Promise<GenerationResult>;
  validate(request: ValidateRequest): Promise<ValidationResult>;
  test(request: TestRequest): Promise<ConformanceResult>;
  preview(request: PreviewRequest): Promise<PreviewResult>;
  exportGame(request: ExportRequest): Promise<ExportResult>;
  inspect(request: InspectRequest): Promise<InspectionResult>;
}
```

这仅是**设计契约**，不是当前已稳定导出的 API。所有操作返回 `runId`、状态和可定位的错误信息；涉及文件输出时由受控 workspace 签发相对路径或 artifact ID，不向远端请求返回不受限的本地绝对路径。

### 10.2 CLI：正式稳定入口（与现有已实现命令保持兼容）

```powershell
# 以下是目标使用方式；Agent 必须先运行 --help 核对当前已实现命令
# Agent 已有 JSON：绝不隐式二次调用模型
a2game capabilities --query "puzzle grid merge" --json
a2game validate .\games\sample\game.json --json
a2game test .\games\sample --json
a2game preview .\games\sample --backend air
# 用户明确委托 Generator 调用模型时才生成
a2game generate --prompt-file .\prompts\shooter.md --provider codex --mode direct-json --output .\output\shooter
a2game generate --prompt-file .\prompts\shooter.md --provider codex --mode game-plan --output .\output\shooter-plan
a2game inspect .\output\shooter
a2game export .\output\shooter --format bundle
```

要求兼容已有 `a2game` 命令、仓库内命令脚本和旧 `a2game-generation-request/output` v1；不可直接删除或更名旧 Provider。新增参数按正常 semver 兼容纪律处理，`--json` 模式 stdout 只返回机器可读结果，日志/进度归 stderr；定义稳定退出码与 `A2G_E_*` 错误，严格参数/目录/超时/预算/中断处理。缺少 SDK 的 `--backend air/three` 不得伪装为 Canvas2D 通过。无需改变当前 `private: true` 即可进行本地 CLI 的独立安装/执行验收。

### 10.3 MCP Server V0.1（本轮新增主要交付）

**传输优先**：本机 `stdio`，由支持 MCP 的宿主启动，遵循实际采用版本的 MCP 协议与 SDK。首版不提供公网 Streamable HTTP、自动外网暴露或 OAuth 服务。MCP 是 CLI/Service 的窄适配层，不能把所有命令简单包装为任意 shell 执行工具。

| MCP Tool（拟议） | 入参约束 | 输出/副作用 | 是否调用模型 |
|---|---|---|---|
| `a2game.list_capabilities` | 可选 `query`、领域、分页/数量上限 | 返回真实可用 Capability ID@version、摘要和能力状态 | 否 |
| `a2game.get_capability` | 单个已注册 ID@version | 参数、依赖、命令、事件、输入/输出 Schema，缺失则可诊断拒绝 | 否 |
| `a2game.plan_game` | 自然语言需求、目标 HostProfile、可选模式 | 返回 GamePlan/选用能力与未满足项；模型型规划需显式选择 Provider | **默认否**（本地规则方案），请求模型时显式配置 |
| `a2game.generate_game` | prompt、显式 `provider`、模式、预算、输出 workspace | 调用现有 Generator，返回 `runId`、artifact 引用、参考级回执 | **是，仅显式调用** |
| `a2game.validate_game` | 受限 `gameJson` 或安全的 workspace artifact ID | 完整 Schema、Manifest、语义与内容 Policy 诊断 | 否 |
| `a2game.test_game` | 已批准的游戏定义及 test suite / artifact ID | 正反例、Headless、Hash、终局与可玩性基础报告 | 否 |
| `a2game.preview_game` | 已准入 artifact ID、`air|three`、指定视口 | 在已有本地 Player 打开或返回受限 loopback URL；记录 SDK 和回放情况 | 否 |
| `a2game.inspect_game` | 已验证的 artifact ID、可选 Trace/测试结果引用 | 状态、事件、诊断、Hash/截图证据摘要 | 否 |
| `a2game.export_game` | 已验证 artifact ID、目的 workspace、格式 | 不可变 game/test/approved assets bundle；拒绝覆盖 | 否 |

**禁止性边界**：`generate_game` 不得在 `validate_game`、`test_game`、`preview_game` 中隐式触发；不提供 `execute_shell`、任意 HTTP Fetch、任意文件浏览、权限修改、git push/部署等高风险工具。传入的游戏 JSON 是不受信内容，绝不能改变工具行为或视为系统指令。若模型自己已在宿主上下文生成 JSON，必须能直接走**无模型工具链**完成游戏交付。

**MCP 协议/工程合同**：

1. 声明独立 `mcpToolContractVersion: 1`，与工作区 `1.0.0` 及 GameSpec `0.1.0` 分开；使用具体 SDK 和协议版本的锁定依赖，不凭空声称协议兼容。
2. 每个 Tool 提供严格 `inputSchema` / 可检查的结构化 `output`，结果状态统一为 `PASS_REFERENCE | FAIL | BLOCKED | NOT_RUN`，诊断包括 `code`、`stage`、`message`、`jsonPointer?`、`attribution?`；未知字段与超限输入拒绝。
3. Tool 名为宿主约定的公开标识符，文档同时记录所用 MCP SDK 实际公开方法名；内容引用 `artifactId` 或受控 workspace 相对路径，拒绝目录穿越、符号链接越界和任意本机路径读取。
4. `stdio` 的 stdout 仅用于 MCP 协议消息，不输出调试日志、ANSI banner 或测试结果；诊断走 stderr；启动/握手/退出/客户端断开释放子进程与浏览器资源。
5. 生成、预览等可能较长的任务先保证同步受限执行能工作；如果增加异步任务 API，则显式实现 `get_run_status`、`cancel_run`、状态持久化、超时及清理，不允许只返回成功占位任务 ID。
6. 并发数、单次响应大小、Token/调用次数、预览端口、磁盘配额及输出文件数量均配置有界；取消时不能留下执行中的模型进程或 HTTP 监听。
7. 日志和回执不包含 API Key、Bearer、环境变量原文、宿主隐私目录；模型身份通过宿主授权信息与返回值分开记录，`provenance` 自报不是独立证明。
8. MCP 能力发现可同时暴露只读规范/示例资源，但**仅显示当前 host profile 真正实现**的能力，不能把 127 份参考声明无条件计为可执行能力。

**MCP V0.1 最低发布矩阵**：

- 协议握手、`tools/list`、每个 Tool 的 `tools/call` 正常调用；未知 tool、畸形参数、取消、并发请求、进程异常、无效 JSON、目录越界、超时和无 SDK 场景都有负例。
- 用两个独立 MCP 客户端环境进行连接和执行；若某宿主不支持，需要报告兼容性 `NOT_RUN`，不能归因于 GameSpec。
- 核查 CLI↔MCP 在同一 JSON、同一 Seed、同一 Headless Trace 下得到相同 exactHash 和 Conformance；真实 `air/three` 仍按原 G2 合同收取独立回执。
- 无 Provider 也能 list/get/validate/test；有 Provider 时只有显式 `generate_game` 才可能发生模型调用，记录调用计数。

### 10.4 A2Game Skill V0.1（独立分发，薄工作流）

建议新目录 `integrations/skill/a2game/`，包含 `SKILL.md`、`references/`、`examples/` 和可选 `scripts/`，仅当宿主实际支持且用户完成安装时才启用。**不得把 Skill 视为新的 Runtime、Agent 子进程或 GameSpec 标准**。

Skill 内容必须覆盖：何时使用、Capability 查询、direct-json / game-plan 选择、何时跳过模型生成、调用 CLI/MCP 的规则、错误诊断、视觉检查、真实双 Host、可下载交付、预算与来源记录、`NOT_RUN` 的处理。示例是正反例和通用机制，不得包含冻结 G3 任务的标准答案、旧私有输出或引擎实现源码。

Skill 推荐给 Agent 的默认流程：`discover → plan? → generate? → validate → test → preview → inspect → export`。问号表示**可选**，不意味着隐式执行；当 Agent 已生成合规 JSON 时直接 `validate → test → preview → export`。任何访问模型/安装软件/新公网资源/发布操作仍服从宿主权限，不因 Skill 指令自动获得授权。

Skill 应兼容两条通道：优先已有 MCP Tool；MCP 不可用时使用实际安装的 CLI。对同一已验证游戏，两个通道的逻辑结果应一致；没有安装工具时明确提示缺失，不臆造成功。

### 10.5 内容产物和本地导出规范（保留现有格式，新增统一索引）

```text
output/<game-id>/<generation-id>/
  game.json                  # 唯一客户端 GameSpec 0.1.0
  conformance.json           # 真实执行过的正反例
  game-plan.json             # 可选内部产物，不发送给 Player
  solution.json              # 可选；模型自解与宿主辅助分开登记
  assets/manifest.json       # 存在审核素材时必需
  release-receipt.json       # 权威 Content Service 的不可变校验回执
  generation-report.json     # provider/model/context/修复次数/失败归因
  tests/                     # Headless、Hash、断言等执行证据
  preview/                   # 双 Host 截图与交互/生命周期验收
  artifact-index.json        # 新增目录索引、版本、SHA、可携带相对路径
```

原始模型响应、密钥相关上下文和大型日志留在受控本地私有记录，不随公共发行包分享。不得伪造签名；SHA 仅保证内容一致性，不表示第三方认证。新产物必须新 run ID，拒绝覆盖旧输出，支持移动到第二个工作区时再校验并运行。

### 10.6 与 Cloud / SDK 的未来衔接（本轮不实现）

Generator Service 的能力调用保持本机无网络、授权 Provider 外联可选。未来 Cloud API、MCP HTTP Transport、SDK 发布可以复用同一 Core，但它们各自需要身份、鉴权、配额、日志隔离、第三方安装和安全发布的独立协议/验收。**不能因为 MCP stdio 已实现就宣称已有公网云服务**。

## 11. Generator 实施工作包（保留 GEN-0–GEN-8；新增 GEN-9/GEN-10）

旧 GEN-0–GEN-8 原职责不删除、不重新编号。**GEN-5 的 Studio 是已完成参考工程，不因优先级变更改称 MCP**；新 MCP/Skill 采用独立 ID，保证历史验收记录和批次证据不混淆。

| 工作包 | 交付范围与禁止事项 | 本附件记录的阶段 | 新的完成条件 |
|---|---|---|---|
| GEN-0 | 基线、新检出精简 smoke 与证据追踪；不弱化旧 Gate | Batch A 工程参考完成 | 可独立构建并重跑无模型 smoke |
| GEN-1 | Generator Core / CLI 统一入口 | Batch A 参考通过 | 生成/验证/测试/预览/导出与错误边界可用 |
| GEN-2 | Codex / Model API / 本地 Provider | 真实模型单例参考通过，全面兼容待验 | 显式路由、预检、模型来源、失败/预算归因 |
| GEN-3 | Capability 搜索、GamePlan、两生成模式 | Batch B 工程参考通过 | 规划/参数/依赖闭包、两模式和负例 |
| GEN-4 | 受信准入、修复、求解、重放 | Batch B 工程参考通过 | 不降低 Schema、安全、Hash/终局 Gate |
| GEN-5 | 本地 Generator Studio / Inspector | Batch C 工程参考通过；**非当前主线** | 继续保持双 SDK 本地 UI 可用，不重复实现 Generator 逻辑 |
| GEN-6 | 安全内容包、独立宿主导入 | Batch C 工程参考通过 | 不覆盖发行回执、不携带未审资源和可执行脚本 |
| GEN-7 | 5 任务×2 模式 Benchmark | 已执行10/10、工程9/10，30次用尽，PARTIAL | 单独记录真实模型、解法辅助、视觉/质量、双 Host；无预算先完成预备材料 |
| GEN-8 | 稳定入口/README/验收交接 | 本机交接参考通过，独立宿主与 E3 仍 PARTIAL | CLI + MCP + Skill 使用说明一致，新检出部署/验证和例子完整 |
| **GEN-9（新增）** | **MCP Server stdio / Tool API / 安全模型路由 / 会话与资源生命周期** | **无模型工程参考通过；已有真实Provider历史调用，模型身份待核实** | 可被独立 MCP Client 真实发现与调用；CLI↔MCP 同行为；权限/路径/取消/模型零额外调用负例通过 |
| **GEN-10（新增）** | **可安装 A2Game Skill / MCP-CLI 双路使用工作流与范例** | **源码/ZIP和项目级宿主练习已记录；新会话自动触发待验** | 在至少一种支持 Skill 的宿主和 CLI 降级通道实际执行；使用非预置 JSON 完成生成/校验/预览，记录来源与运行证据 |

**后续执行顺序**：保留Batch A/B/C与已完成的Batch D实际数据收集 → Batch E的E3真实Agent宿主 → GEN-8集成交接；H01和质量修复须另有明确调用预算。执行顺序调整不代表 Gate 放宽：没有独立模型预算时，可先完成 MCP/Skill 的无模型工具验收，不得自行追加真实模型调用。

### 11.1 GEN-0 基线约束：优先解决不可信的“红绿灯”
- `reports/` 已移出仓库；目前本地证据包约 393 MB、8,138 份报告，尚无可信远端存储 URL。全量验收继续使用 `npm run evidence:restore` + `npm run verify` 等原门禁；Generator 新 smoke 测试不能暗中修改这些历史门禁或把历史参考状态改成新的 PASS。

- `GitHub Actions` 最近可见矩阵执行未通过（仓库将原因为额度/基础设施），当前只允许 `workflow_dispatch`，默认 Ubuntu/Node 22；无可用额度时本地测试标 `PASS_LOCAL`，远端 CI 标 `NOT_RUN/QUOTA_BLOCKED`，不能用后者阻塞本地研发，但不可正式发布。

- `GEN-0` 输出 `project/generator-baseline.json`（建议新文件）、固定 SHA/环境/已有测试结果/待验、执行回执；后续生成器产品化状态独立记录 `project/generator-status.json`。旧 `project/status.json` 仍然是原 S0–S11 与 G0–G3 的唯一权威状态。

### 11.2 GEN-1/2 Provider 的关键执行约束
- 保留 `runAgentWorkflow()`、`codex-generator.mjs`、`model-generator.mjs`、`http-generator.mjs` 的现有入口、认证传递、模型选择和安全策略；新增 CLI Provider Adapter 对其进行适配，不删除旧功能。

- 新增 Provider 时显式声明 `providerId`, `requestedModelId`, `reportedModelId`, `hostIdentityEvidence`, `supportsJsonMode`, `contextLimit`, `timeout`, `costReporting`；不能依赖模型返回的 `provenance` 自报判断身份。

- Provider 兼容性检查是适配器能力，不是成绩；不可把旧 Codex/HTTP 不同系统提示、技能、ABI 直接汇总成多模型对比。若设备未安装 CLI 或端点未配置，应返回可操作的诊断和 BLOCKED，而不是自动选择其他模型。

- 默认最多 3 次完整生成尝试（含失败尝试），失败重试只回传允许的错误/当前模型自己的旧结果，不能传入作者标准答案、其他模型生成内容或泄漏私有参考关卡。`--timeout-ms`/Token/输出大小均受配置上限约束。

### 11.3 GEN-3 GamePlan 规范（生成中间层，不是新 Runtime）
建议规划结构（实现前须补内部 Schema 与版本，示意字段）：

```json
{
  "format": "a2game-game-plan",
  "version": 1,
  "concept": {"genre": "vertical-shooter", "dimension": "2d", "orientation": "portrait"},
  "mechanisms": ["movement", "weapon", "projectile", "wave", "health"],
  "controls": ["pointer-drag", "keyboard-fallback"],
  "entities": ["player", "enemy", "bullet"],
  "stateModel": ["hp", "score", "waveIndex"],
  "gameFlow": {"win": "waveIndex reaches 3", "lose": "hp reaches 0"},
  "presentation": {"style": "cartoon-tech", "resources": "trusted-presets"},
  "testIntent": ["one-win", "one-negative", "restart", "input-cancel"]
}
```

必须同时输出：必要 Capability `id@version` + 依赖闭包、每个机制的可用参数和命令、未满足的能力与降级原因、选定 HostProfile/输入来源。**规划不应该发明 Registry 未注册的能力**；找不到支持时优先明确 `UNSUPPORTED_CAPABILITY`，不得将复杂玩法静默降级成点击加分。

上下文精简不能弱化验证。Catalog 选择可从全部 `127` 份参考 Manifest/注册实现检索，但生成时仅传实际选中的能力、依赖及必要 Schema 片段；完整 Validator 仍用权威全量 Schema，生成后验证不能使用模型简化 Schema。实现前基准测量 Prompt 字节、Token、成功率；不要仅因文件更小就宣称效率提升。

### 11.4 GEN-4 安全与调试的失败分类
| 分类 | 必须区分的失败 | 处理原则 |
|---|---|---|
| `INPUT_SPEC` | 无效提示、目标设备/游戏 Profile 不支持 | 提前返回说明，不调用模型 |
| `PROVIDER_INFRA` | Provider 不可用、超时、429/网络中断、输出截断 | 有界重试/中止；不可算生成模型玩法失败 |
| `GENERATION_FORMAT` | 无效 JSON、重复键、协议版本不符、遗漏必要字段 | 原始字节留存；返回 JSON Pointer / Schema 诊断 |
| `CAPABILITY_SEMANTICS` | 引用缺失、版本冲突、运行规则不合法 | 根据 Manifest 做最小修复，不修改受信 Runtime 来迁就模型 |
| `GAMEPLAY_CONFORMANCE` | 正反例、终局、解法、状态哈希失败 | 精确重现 Tick、Seed、输入；诊断中记录状态差异 |
| `HOST_ENGINE` | CocosAirJS / Three.js 输入、坐标、资源或渲染失败 | 保留相同 JSON 并做两 Host 最小差异复现 |
| `VISUAL_QUALITY` | 目标显示缺失、UI 越界、素材不足、可读性差 | 截图/页面元素检查，必要时由生成器做受控修复 |
| `HUMAN_REVIEW` | 手感、长期游玩质量、难度、美观的人工判定 | 默认待验，不可根据截图或 solver 自动 PASS |
| `SECURITY_POLICY` | 未授权资源、任意脚本、危险路径或鉴权泄露 | **拒绝**，不能以放宽安全规则生成通过 |

提供可追踪的 `generation-id/attempt-id`、错误码、阶段、最小诊断、素材/输入 SHA、模型身份来源、真实调用次数与耗时。生成返回的游戏即使已通过工程参考，也只能 `PASS_REFERENCE`，除非另行完成正式 G3/人工验收。

### 11.5 GEN-5 Studio：保留已完成工作、不再作为当前开发主线

第 15.6 节记录 Batch C Studio/Inspector 的本地 Loopback 生成、取消、双 SDK 预览、JSON 和受控包导入导出工程参考通过。保留已实现页面和脚本，后续 CLI/MCP 共享一套 Service 与 Content Service，不复制 UI/浏览器/Runtime 状态机，也不以继续打磨 Studio 为 GEN-9 的完成前置条件。出现 Studio 回归则修复并在本地/真实浏览器重验；本轮无须新开发大型可视化编辑器。

### 11.6 GEN-6 素材与独立交付的边界
第一批支持内置 Primitive、可信纹理/音效/字体及资源包中的受审核文件；资源可以是人类预设或经过审核的本地生成资产，但 JSON 不能要求任意远程脚本执行。未审核的 URL、脚本、文件系统越界和内容大小超限在发布前拒绝。把 `GameDefinition` 与 `ReleaseManifest` 分开：前者表示玩法，后者记录资源版本/哈希/依赖与目标 Host；未发布新规范时先在 Generator 内部用受控 bundle/receipt，避免破坏性更改 GameSpec 0.1.0。

### 11.7 GEN-9 MCP 的文件与任务拆解（当前 Agent 应执行）

建议路径（可依赖当前仓库实际结构增量调整，须说明原因）：

```text
src/generator/              # 单一 Service/API；已存在同等模块则复用
integrations/mcp/            # MCP Server 与 tool schema、参数/结果适配
scripts/mcp-server.mjs       # 入口（若 repo ESM 脚本布局适配）
test/mcp-*.test.mjs          # 握手/Tool/异常/对照回归
project/generator-status.json
reports/generator-mcp-<run-id>/
```

**按四个子任务实施，最多三个互不冲突任务并行**：

1. **Tool Contract**：先冻结 Tool 清单、输入输出 Schema、错误映射、权限和文件路径方案；根据当前 CLI/Service 实际接口设计适配，不改 GameSpec/Runtime，编写正反例。
2. **stdio MCP Server**：实现初始化/列举/调用；只读能力查询 + 无模型 validate/test 先通过，再接 generate/preview/inspect/export；保留取消和超时语义，所有 subprocess 可被关闭。
3. **双通道对照**：为相同新建 JSON 通过 CLI/MCP 各跑一次 validate/test，比较 exactHash、错误码、Artifact SHA；使用现有真实 Player 复验 air/three，缺 SDK 记录 `NOT_RUN`。
4. **Host 接入**：在两个独立兼容客户端验证 tools/list/call；无法连接的明确说明原因和实际软件版本，不提供伪造截图；记录 Tool 数据在结果目录，不能保存/展示密钥。

**可提前验收的无模型最小闭环**：MCP 连接 → list/get → 模型外部提供 JSON → validate → test → export；`generate_game` 不调用时 Provider 调用计数必须为 0。模拟 Provider 只能作为负例/fixture，不是独立模型 G3。实际安装不允许擅自变更用户全局 MCP 配置。

### 11.8 GEN-10 Skill 的文件与任务拆解

建议结构：

```text
integrations/skill/a2game/
  SKILL.md
  references/usage.md
  references/capabilities.md
  references/troubleshooting.md
  examples/puzzle-request.md
  examples/shooter-request.md
```

Skill 的文案必须明确：何时触发、如何发现真实 Capability、何时使用 `direct-json`/`game-plan`、已具备 JSON 时跳过模型、先做哪些验证、如何启动/关闭预览、如何判断视觉质量、什么证据才可以登记 G3、失败时怎么修复、哪些动作需要用户确认、在宿主不支持 MCP 时如何使用 CLI。示例不得泄露 5+37 冻结题目的完整解法或历史模型私有输出。

验收：Skill 文件格式/引用检查；安装到至少一个真实支持 Skill 的宿主后执行**不包含现成答案的独立练习题**；交付新 JSON、Conformance、真实运行/截图和 Tool/CLI 轨迹。MCP 断开时 CLI 模式必须仍可独立完成；仅粘贴 Skill 或显示宣传截图不算完成。

### 11.9 与既有状态台账、CI 的同步

- 新增 `project/generator-status.json` 中的 `gen9Mcp`、`gen10Skill` 与相应 Gate 字段，**仅在运行后更新为 PASS**；原 GEN-5 与 Batch C 状态保持不变。
- `PROJECT-PLAN.md` 是计划，不是执行记录；`project/status.json` 原 S0–S11 与正式 G0–G3 不改计算口径。
- 可用的无模型 smoke 设计成**全新源码可执行**，不要为取得 PASS 绕开现有依赖证据、`npm run verify` 或 `acceptance:ready` 的检查逻辑。CI 额度耗尽则本地通过和远端 `BLOCKED` 分开报告。
- 若新增 MCP 协议依赖，锁定可复现版本并保留许可证说明；引入新的第三方包须经过安全/依赖审查，不修改已存在模型路由与默认 Provider。

## 12. 首批 Generator Benchmark / 验收矩阵
### 12.1 冻结的五个任务（均不得提供现成答案或解法）
| ID | 生成目标 | 必须体现的核心行为 | 典型反例 / 防作弊检查 |
|---|---|---|---|
| **G01** | 推箱子 | 网格合法移动、连带推箱、全目标、撤销 | 推不动不得修改状态；不会变成按一下就赢 |
| **G03** | 三消 | 交换、匹配、连锁/补位、有限目标 | 非法交换、未完成匹配、下落结算的正确阶段 |
| **G17** | 纵版飞机射击 | 连续移动/开火、弹丸命中、波次、胜负 | 命中去重、暂停冻结、对象销毁后不再命中 |
| **G21** | 塔防 | 防御塔放置、经济、路径、波次、攻击/胜负 | 非法位置、余额不足、漏怪扣血、实体释放 |
| **H01** | 合成炮台保卫战 | Merge + TowerDefense + Economy/Weapon 联动 | 合并后的旧炮台不能继续攻击，经济与冷却按 Tick 提交 |

固定任务文本可纳入 `project/generator-benchmark-tasks.json`（新增文件），并关联旧 `project/g3-tasks.json`，不更改旧 37 任务冻结身份；可另设未见任务做泛化评测。每项都执行 **direct-json / game-plan 两种模式**，所有任务使用相同冻结公共上下文、游戏/HostProfile、随机种子、反馈规则、调用上限。模型或模式不同需独立登记，不合并成“整体成功率”。

### 12.2 Generator Gate（独立于原有 G0–G3）
| Gate | 标准 | 自动通过的边界 |
|---|---|---|
| `GEN-G0` | 干净检出安装、生成器 CLI/配置/文档可用；fixture smoke/负例 | 不需要外部模型/SDK，允许本地 PASS；不替代已有完整版 `npm run verify` |
| `GEN-G1` | 至少一个经核实身份的真实 Provider 完成任务文本→非预置新 JSON→完整校验与正反例 | 真实模型未授权/不可用则 BLOCKED；fixture 不能算模型生成成功 |
| `GEN-G2` | 5 个代表任务各生成能通过完整 G0/G1、双真实 SDK 实际输入/Hash/胜负/重开/释放的结果；两模式分别登记 | 允许失败回修但不得伪造；缺 SDK 时按 Host 标 NOT_RUN |
| `GEN-G3` | 五项产品可玩性检查（布局、输入、胜负、资源反馈、运行稳定）分别存截图+游玩记录；独立评测指标、模型调用/成本可追溯 | AI 视觉审查属于参考，人工质量及正式原 G3 仍独立待验 |
| `GEN-G4` | 完整输出目录可携带到另一个工作区，导入播放器不改核心代码；README 一键操作和 CI smoke | 新机复现或明确基础设施 BLOCKED，远端 CI 需要单独 PASS 才能宣称可发布 |

最短产品演示 Gate 为 `GEN-G0 + GEN-G1 + 一款 G01 的 GEN-G2`，可称 **local preview ready**；`GEN-G0–GEN-G4` 全部达标才可称 **Generator Beta candidate**。正式 G3 0/37、人工作品质量和真机缺口在原台账内维持真实状态，不能由 Generator Beta 自动清零。

### 12.3 视觉与玩法质量验收不可降级
- Generator 应从需求中提取可执行的 **Visual Intent**：画面比例、主色调、层次、界面布局、可读字体、主要动画和反馈时序；不要求模型凭空生成全部素材，但不能默默用只有纯色矩形/文字的简陋占位演示满足“高品质”要求。

- **初始、进行中、成功、失败**四种状态必须检查；至少桌面与 390px 竖屏规格，明确实际目标设备时附加对应比例。自动截图审查布局越界、遮挡、重要文本可读性、按钮目标区域、视觉资源缺失；AI 判断只写 `AI_REFERENCE_REVIEWED`。

- 截图视觉质量与游戏逻辑是**并列验收**：即使 Hash/Conformance PASS，页面丑陋、元素看不清、技能没有反馈时仍为 `VISUAL_QUALITY_PARTIAL`。素材/风格参考来源与授权应可查；没有来源的素材不得自动公开发布。

- 射击类检查连续运行与资源释放；益智类检查失败/重试与死局；混合玩法检查状态跨域联动，禁止只把几个按钮放在一起就算完成玩法组合。

- 最终人工审查至少记录是否像预期玩法、能否无指导完成第一局、目标是否清楚、是否有明显卡顿/误触/意外终局。人类未评审即 `HUMAN_REVIEW: NOT_RUN`。

### 12.4 必须统计的指标
- `one_shot_pass`: 首次生成不修复通过的数量 / 有效真实生成尝试数量；另外报告所有计划数/未运行/受阻数。

- `pass_within_budget`: 最多配置次数修复后工程通过数量 / 已执行任务数量，明确分母。

- `independent_solution_pass` 与 `host_assisted_pass`：模型提供的解法与宿主求解器辅助**单独**登记。

- `schema_pass`, `conformance_pass`, `headless_hash_pass`, `host_three_pass`, `host_air_pass`：按任务/模式/模型与版本分别给出。

- `visual_gate`, `human_review`, `playtime`, `stuck_rate`, `resource_cleanup`, `token_usage`, `elapsed_ms`, `estimated_cost`：没有数据就 `UNKNOWN`/`NOT_RUN`，不按零。

- 生成过程不得使用 repo 中的候选 GameSpec/标准答案作为评测输出；默认只公开标准 Capability、Schema、通用机制说明；同一测试集不能既用于 Prompt 调参又声称完全未见。

### 12.5 回归与负例矩阵
必须有自动化测试：空 Prompt、无 provider、错误模型路由、CLI 不存在、模型返回非 JSON/重复键/被截断、未知 Capability/版本、无胜利负例、假胜利步骤、随机结果不一致、生成器超时/退出、取消、输出路径穿越、覆盖旧运行目录、未授权素材、跨 Host Hash 不一致、未释放监听/资源、断网后本局仍正常、模型凭据不出现在日志。模型未配置时测试 fixture + mock failure adapters，并明确 fixture 来源。

### 12.6 新增 MCP/Skill Gate（独立于 GEN-G0–G4、G0–G3）

| Gate | 证据与 PASS 条件 | 明确不能替代的部分 |
|---|---|---|
| `MCP-G0` | 锁定 SDK、stdio 握手、列举工具/资源，干净工作区无模型测试及错误结构测试 | 不是独立模型生成，也不是双引擎 G2 |
| `MCP-G1` | 外部 Agent 已产生的新 JSON 通过 MCP validate/test/export；与 CLI 对照 hash/回执一致、0 次额外 Provider 调用 | 不能以 fixture 当真实生成 |
| `MCP-G2` | 显式 generate 模式经已授权真实 Provider 返回新内容、严格准入；取消、超时、费用/模型来源和诊断留证 | 未授权真实模型调用时保持 `BLOCKED` |
| `MCP-G3` | 两独立客户端接入、双真实 SDK 的可玩预览/释放、未知 tool、目录穿越、输入超限、协议污染、敏感信息负例通过 | 不等于 Gxx/Hxx 正式 verified |
| `SKILL-G0` | 文档完整、引用有效、无答案/密钥、不覆盖原 AGENTS/模型选择 | 仅静态检查不等于能用 |
| `SKILL-G1` | 至少一种真实宿主从用户需求调用 MCP 或 CLI，生成/校验/测试/预览/导出；失败条件和成本记录 | 不替代正式 G3 的独立、公平和人工质量 Gate |

分开统计 MCP 本机工具成功率、Provider 调用成功率、CLI↔MCP 行为一致性、Host 可用率、Skill 成功调用率；没有实际运行的全部为 `NOT_RUN`。CI `QUOTA_BLOCKED`、模型预算 0 和设备缺失均须独立归因，不把单一阻塞扩大为全部工作包失败。

## 13. 按批次执行与项目交接规则（保留历史、切换当前入口）

| 批次 | 工作包 | 基于本附件的状态 | 说明 |
|---|---|---|---|
| **Batch A** | GEN-0/1/2 | **PASS_REFERENCE（有约束）** | CLI/真实 Provider 单例已记录；不代表所有模型可用 |
| **Batch B** | GEN-3/4 | **PASS_REFERENCE** | Capability 检索、GamePlan 与两模式工程链已记录；Batch D 已执行两模式，混合模型与质量结果仍须分别解读 |
| **Batch C** | GEN-5/6 | **PASS_REFERENCE** | Studio 与便携内容包保留，后续维护不作为首要开发 |
| **Batch E（新，当前）** | **GEN-9/10** | **PARTIAL：MCP工程及宿主练习参考通过，Skill自动触发待验** | MCP Server stdio 与可安装 Skill；真实Provider历史调用的模型身份未独立核实 |
| **Batch D（保留）** | GEN-7 | **10/10已执行、9/10工程通过，PARTIAL** | 5 类任务 × direct/game-plan，保留真实模型预算门禁 |
| **交付收口** | GEN-8 | **PARTIAL：本机交接参考通过，独立宿主待验** | CLI/MCP/Skill 文档、安装、全新工作区、可移植产物与风险说明 |

**当前 Batch E 推进顺序**：E0 冻结 Tool 契约与 CLI 对照基线 → E1 MCP stdio read-only/validate/test → E2 generate/preview/export + 负例 → E3 Skill 与两个独立宿主验收 → GEN-8 文档及状态交接。已有E2真实Provider历史调用，但模型身份尚未独立核实；E3已有项目级安装及宿主练习，新会话自动触发和另一独立宿主仍待验。Batch D预算已耗尽，后续真实模型复测需明确新额度，不允许偷用模型或默认替换 Provider。

**并发原则**：最多三个互不冲突的工作单元同时推进，例如 MCP Tool Schema、Skill 文档、测试夹具。`src/runtime.ts`、`src/registry.ts`、`scripts/agent-workflow.mjs` 和新 Service 核心由同一所有者顺序修改，其他 Agent 不并发写入相同文件。集成由主 Agent 审查、测试和更新状态。

**每批交付**：源码差异、命令与终端输出、测试与版本指纹、真实或明确缺失的 Host/模型证据、独立回执、失败与未运行项目、README/AGENTS/CHANGELOG/状态台账更新。保留 S0–S11、32+5、Touch/IMU 与历史 G3/CI 缺口，不删除旧证据。

**是否可以继续下一步的判据**：前一 E 子任务的必需本地 Gate 通过才推进依赖子任务；与模型预算/真机/远端 CI 独立的工作可继续，但需在状态文件记录对应 `BLOCKED` 而不是修改已定义验收条件。不得因 E 工程完成自动升级正式 G3 或 `verifiedGames`。

## 14. 下一次 Agent 启动提示（可直接交给开发 Agent）

> 以本地工作区最新 `main` 为执行基线，**继续A2Game Generator交接：先读最新台账，复用已交付的MCP/Skill源码，从E3真实Agent宿主与GEN-8待验项继续，不能重复消耗已经用尽的30次预算**。本计划不是最新源码状态，请先执行 `git status`、`git rev-parse HEAD`，阅读 `README.md`、`AGENTS.md`、`PROJECT-PLAN.md`、`PROJECT-STATUS.md`、`project/status.json`、`project/generator-status.json`，以及对应的 `specs/v0.1/docs/01–04`、`17-Agent-Workflow-V0.1.md` 和现有 `scripts/agent-workflow.mjs`、Provider、CLI/Studio 源码及测试。保留用户文件和现有工作区修改。
>
> **先核实 Batch A/B/C 的实际结果，不重复实现**：Generator Service、CLI、Validator、Conformance、Solver、Player、双 Host 与 Content Service 均应尽量复用；禁止新建平行 Runtime、另写一套模型路由、改变默认触发条件或让 JSON 执行代码。工作区发行 `1.0.0`、GameSpec/Capability `0.1.0`，与新增 MCP Tool 合同版本分开。原 S0–S11、G0–G3、32 Gxx + 5 Hxx、Touch/IMU、真机、正式 G3、AI 视觉和远端 CI 所有约束继续有效。
>
> **本轮必须交付**：① MCP Tool Schema 与明确的安全/文件/进程约束；② `stdio` MCP Server，可实际完成 list/get、validate/test、显式 generate、preview/inspect/export；③ CLI↔MCP 使用相同新 JSON 的 Hash/错误/产物对照与完整负例；④ 可安装但不自动全局安装的 A2Game Skill，优先 MCP、回退 CLI，能指导一个 Agent 直接生成 JSON 后无额外模型调用地完成验证与游玩；⑤ 独立 MCP Client 真实调用截图/日志和 README/状态台账更新。新增 GEN-9/10 Gate 和报告，不改变已有 32+5 分母。
>
> **执行次序**：E0 Tool 契约 → E1 无模型 stdio 和 validate/test → E2 生成/预览/导出与异常路径 → E3 Skill + 双宿主 → GEN-8 文档与交接。真实模型只在显式授权且额度存在时调用；当前Batch D已执行10/10、9/10工程通过，30次预算耗尽；H01规划模式未过，严禁继续调用或以fixture补成绩。无预算仍可交付不调用模型的 MCP/Skill 部分，并如实记 `BLOCKED`。
>
> **验收与权限**：按影响范围执行 `npm run project:check`、`npm test`、`npm run spec:validate`、`npm run schema:full`、`npm run conformance`、`npm run verify`；MCP 真实握手/工具调用和干净源码 smoke 必需。真实 CocosAirJS/Three.js E2E 使用锁定 SDK 与独立回执，不用 Mock/Canvas2D 冒充。更新 `project/generator-status.json`、`PROJECT-STATUS.md`、`CHANGELOG.md` 和用户指南时只根据本轮实测填写结果。无显式授权不得推送、部署、修改全局 Skill/MCP 设置、权限或凭据、删除重要数据。最终交付完成/未验证/失败列表与可复现命令；如果需提交 Git，请遵照当前会话的明确权限，不沿用历史授权作推送许可。

## 15. 本计划更新的边界与待决项

- **保留来源**：本计划的历史记录 15.1–15.6 为用户提供的截至 2026-10-30 的原有工程记录。本次只作**文档设计更新**，不把这些记录改写为新实测，不删除旧报告或猜测远端状态。
- **本轮确定的变更**：Generator 产品入口改为**CLI Core → MCP Server → Skill**；Studio 为已有可用辅助工具，云端 API 明确后置。原 GEN-0–GEN-8 编号与历史记录不变，新增 GEN-9/GEN-10 和 Batch E，防止旧证据指向不同功能。
- **状态来源**：正式 S0–S11、G0–G3 的进度以 `project/status.json`、`PROJECT-STATUS.md` 为准；Generator/Batch/新 MCP/Skill Gate 以 `project/generator-status.json` 新增字段及后续真实回执为准。
- **不变的范围**：协议版本、确定性规则、两个真实 Host、32 Gxx + 5 Hxx、Touch/IMU、物理与质量、严格准入、原 G3 和证据归档。Generator 工程 PASS 不能提升正式 verified。
- **待验证**：Skill 新会话自动触发与独立宿主兼容性、真实 Provider 模型身份、H01 真实模型修复复测、完整产品质量、正式独立 G3、真人/真机及远端 CI。已有真实矩阵和本机工程证据须保留范围；未取得证据的项目保持 `NOT_RUN` 或对应 `BLOCKED`。

### 15.1 本轮落地记录（2026-10-29）
基线为本地 `main` 提交 `7493ff7`（完整 SHA、环境见 [Generator 基线](project/generator-baseline.json)）。最终源码独立完成安装、构建、fixture 生成→完整准入→测试，无旧报告和 Renderer SDK，源码指纹一致，GEN-0 为 `PASS_LOCAL`。本轮完整 `npm run verify` 通过：125 Node、203 Conformance、360 Schema，旧回执恢复。GEN-1 的 API/CLI、fixture 和负例已验证，双 SDK 预览 HTTP 与监听关闭通过，实际浏览器渲染 `NOT_RUN`，状态 `PARTIAL`；GEN-2 适配已实现，真实 Provider E2E 受预算 0 阻塞。Batch A 维持 `PARTIAL`，未进入 Batch B，见 [Generator 台账](project/generator-status.json)。fixture 不属于独立模型生成，正式 G3 和旧 Gate 不升级。

### 15.2 Batch A 浏览器工程收口（2026-10-30）
2026-10-30 Generator Batch A 继续收口：新增 `npm run generator:browser`，新建 fixture 通过公开预览入口在真实 Three.js/CocosAirJS、桌面/390px 窄屏完成 4/4 输入、Headless Hash、未达目标/通关、暂停/重开、零 ownedResources 和监听关闭；12 张截图及 SDK 版本/SHA、来源指纹分别留证。最终源码 smoke 与完整回归通过（125 Node、360 Schema、203 Conformance），旧报告恢复；正式 G3、人工/真机不升级。一次运行因验证期间脚本变更被指纹检查拒绝，失败材料保留，最终定稿运行通过。真实调用 0；安装后 `a2game` 命令已通过独立前缀安装、帮助/版本、生成与校验，依赖锁不变；最终源码重新通过干净安装 smoke。GEN-1 为 PASS_REFERENCE，GEN-2 的真实 Provider 验收受预算 0 阻塞，Batch A 保持 PARTIAL，未进入 Batch B。见 [Generator 台账](project/generator-status.json)。

### 15.3 GEN-2 原生 Terra 实测（2026-10-30）
2026-10-30 GEN-2 真实模型工程验收通过：按用户指定以原生子 Agent 运行 gpt-6.1-terra / medium，新生成“双灯之锁”，3 次生成、2 次格式修复，非 one-shot，无宿主补解。完整准入、3/3 Conformance、模型自拟 3 步双 Session 解法、双 SDK 回放与 4/4 桌面/窄屏源输入、胜负 Hash/重开/释放通过。新增原生上下文构建与 SHA 绑定导入入口，修复 root envelope/solution 类型说明歧义。完整回归 127 Node、360 Schema、203 Conformance 及最终源码 smoke 通过，旧报告恢复。身份限定为实际宿主请求路由，服务端构建/用量/费用未导出；窄屏小字和英文 HUD 使视觉质量为 PARTIAL，人工/真机/正式 G3 不升级。Batch A 工程为 PASS_REFERENCE，Batch B 尚未开始；本轮预算 3 次已用尽。见 [GEN-2 记录](docs/gen2-native-acceptance.md) 与 [Generator 台账](project/generator-status.json)。

### 15.4 窄屏视觉优化（2026-10-30）
2026-10-30 窄屏视觉优化完成：为“双灯之锁”创建明确标记的宿主表现副本（revision 2），原始 Terra JSON/评分保持不变。360×420 紧凑画布、最小设计字号26、中文机会HUD和按钮对应说明；390px画布最小字约9.4→23.2 CSS px，320×568约16.9px。两真实 SDK、320/390/桌面6/6输入/胜负/重开/释放、原版/新版 Hash及3项正反例完全一致；普通CLI validate/test、原样Skill客户端两端通关、127 Node/360 Schema/203 Conformance与最终源码smoke均通过。新增模型调用0，真机/人工/正式G3不升级。当前窄屏条目为宿主副本AI参考通过，见 [优化说明](docs/gen2-narrow-visual.md) 与 [Generator 台账](project/generator-status.json)。

### 15.5 Batch B 工程交付与 Batch C 启动
2026-10-30 Batch B 工程参考完成：公开能力检索/精确依赖闭包、内部 GamePlan v1 完整 Schema、direct-json/game-plan 两路径、规划引用/组件一致性、有界分类修复及 Headless 生命周期回执。133 Node、360 Schema、203 Conformance、两模式双 SDK 桌面/390px 共8/8与两模式干净源码smoke通过，旧报告恢复。默认规划仅为宿主关键词草案，真实模型两模式/完整玩法语义仍 NOT_RUN；新增真实调用0，不升级正式G3/人工/真机。按用户顺序要求进入 Batch C，见 [Batch B](docs/generator-batch-b.md) 和 [Generator 台账](project/generator-status.json)。

### 15.6 Batch C 工程交付与 Batch D 预算边界
2026-10-30 按顺序完成 Batch B/C 工程参考：能力检索、内部GamePlan、两模式有界修复；Loopback Studio的生成/取消/双SDK/状态/导出导入；单文件受控内容包在独立源码宿主原样复验。最终137 Node、360 Schema、203 Conformance通过；Studio桌面/390px双SDK4/4、独立宿主2/2、最终干净源码两模式/包/矩阵准备与新浏览器worker桥接通过。一次smoke汇总漏返回stdout导致的失败已保留并修复。内容包仍需兼容宿主/SDK/审核资源，不嵌入Runtime或资源二进制。Batch D已冻结5任务×2模式和入口，真实矩阵0/10，因新预算0为BLOCKED；GEN-8最终交接未完成。新增真实调用0，正式G3/人工/真机/远端CI不升级，未提交/推送。见 [Studio说明](docs/generator-studio.md)、[Benchmark说明](docs/generator-benchmark.md) 和 [Generator台账](project/generator-status.json)。

### 15.7 CLI/MCP/Skill 产品定位修订（2026-10-30，计划变更，非实施证据）

本次以用户上传的现行 `PROJECT-PLAN.md` 为基线，只刷新实施优先级和未来接口：明确保留已经工程交付的 Batch A/B/C 与 Studio、原 S0–S11、32+5 玩法和历史测试数字；**新增 GEN-9 MCP stdio、GEN-10 Skill 及 Batch E**，下一 Agent 从这里实施。Batch D 5×2 真实 Benchmark 的 `0/10 / 预算 0 BLOCKED` 不变，GEN-8 最终交接仍待完成。未来 Cloud API 和公共 SDK 仍在长期产品路线，不要求当前实现。


### 15.8 实际Benchmark与隔离MCP/Skill交付
2026-10-31 顺序推进结果：Batch A/B/C保留工程参考交付；Batch D的5任务×2模式已真实执行10/10，30/30调用含1次宿主中止，29份完整回复，最终9/10通过完整准入、双SDK回放与36路来源输入。H01规划模式仍失败；直接模式原始输出经宿主组合误判修正后原样复验通过，G17规划模式已修复方向键与窄屏字号，实际画面仍有对比度不足；严格产品/人工验收不计通过。MCP新增9个受限stdio工具，官方SDK与独立Python客户端、CLI同JSON/Hash、真实双SDK输入/重开/释放通过；Skill已打包，真实Agent宿主安装/执行及MCP真实Provider待验。完整回归143 Node、360 Schema、203 Conformance及新源码MCP/两模式/包复验通过。MCP依赖独立锁定，根Runtime锁原字节恢复；旧证据不改写。正式G3 0/37、Verified 0/32+0/5、真机/人工/远端CI不升级，未提交/推送。见[实际结果](docs/generator-real-findings.md)、[MCP/Skill说明](docs/generator-mcp.md)、[台账](project/generator-status.json)。
