# A2Game 项目完整实施路线图（1.0.0 基线）

> **性质**：项目目标、技术边界与验收合同；不是“已经开发完成”的功能列表。  
> **项目发行基线**：`1.0.0`（参考实现 / Alpha，不代表生产稳定）。  
> **独立协议**：GameSpec / Capability Manifest / Tick/Rule / Conformance `0.1.0`（部分源规范文档标记 draft）。  
> **当前执行阶段**：优先实施第 9–15 节 Generator 本地产品化 Batch A（GEN-0–GEN-2），当前部分完成。S11 初始兼容扩展工程已交付；完整 Gxx/Hxx DoD、独立 G3、物理设备和远端 CI 分别待验。原回执与范围以 PROJECT-STATUS.md / project/status.json 为准，Generator 独立记录于 project/generator-status.json。

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

**执行顺序**以 Tick/Rule 规范为准；不得通过渲染帧率控制玩法得失。状态 Hash 仅对 exact logical projection 负责，屏幕像素和宿主碰撞结果不自动计入 exact 比对。

## 3. 全阶段实施范围（全部必须纳入计划，不使用 P0/P1/P2 删减）

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

## 9. 优先级切换：A2Game Generator 本地产品化（本轮主线）

### 9.1 商业/技术目标与明确不做

**唯一主要用户路径**：一个不了解 GameSpec 的人输入自然语言要求 → 选择模型/本地生成方式 → 获得可加载的 GameSpec 及测试 → 自动校验和修复 → Headless + 真实 Host 验证 → 在本地播放器中玩到游戏 → 可导出可重放产物。

- **最高优先级**：独立、可本地运行的 A2Game Generator（CLI + 本地 Studio），依赖现有共享 Runtime 和真实 Host；模型可以是本地模型或通过本机 CLI/HTTP 访问远端模型，但 *Generator 运行在本地*。
- **第二优先级**：将经过上述验证的 Player/Protocol 拆成公开稳定 SDK，保留共享 Runtime；后续可以附 Agent Skill。
- **第三优先级**：Cloud Generation API、MCP Server、在线资源托管、远端队列、多租户/计费；当前**仅预留可替换接口，不实施线上服务**。
- **本轮不做**：新游戏引擎、更换 CocosAirJS/Three.js 路由、重写 Tick 语义、整体迁移为 monorepo、任意 JS/TS 代码生成执行、凭据托管、联网部署、用人工样例当独立生成结果。
- **离线含义**：不联网也能使用 `fixture`/预先安装的本地模型；如调用 Codex CLI 或远程模型，需用户已有的宿主配置和网络。**不得声称所有模式纯离线**。

### 9.2 现状与实施起点（来源：2026-10-29 main 基线 `7493ff7` 与状态台账）

| 已有可复用能力 | 权威入口 | 判定与本轮处理 |
|---|---|---|
| Capability Registry / Manifest | `src/registry.ts`, `scripts/registry.mjs` | **已有**；新增能力检索与 context 截断/版本身份，不另造规则目录 |
| 生成、修复、Schema/Conformance、解法与重放 | `scripts/agent-workflow.mjs`, `scripts/agent-solver.mjs`, `scripts/content-service.mjs` | **已有工程链**；包装为统一 Generator API/CLI，不更改现有安全门禁 |
| 真实模型/宿主接入 | `scripts/codex-generator.mjs`, `scripts/model-generator.mjs`, `scripts/http-generator.mjs`, `scripts/g3-native-*.mjs` | **已有独立入口**；抽象公共 Provider 合同，保留原有模型选择与隔离约束 |
| 游戏预览与调试 | `player/index.html`, `player/inspect.html`, `scripts/agent-browser.mjs` | **已有**；接本地 Studio 和产物，一份 JSON 两个 Host |
| Content Release / 可信资源 | `src/content-release.ts`, `scripts/content-service.mjs`, `docs/content-release.md` | **已有本地可信发布**；复用，不通过写临时白名单绕过准入 |
| 版本与分发 | `package.json` 1.0.0 (`private: true`)、协议 `specs/v0.1` | **当前仅 Alpha 参考工作区**；不要现在改为生产发布或升级 GameSpec 版本 |
| 参考评测 | 37/37 有界 Gxx/Hxx 工程生成参考；最近本地报告 122 Node、203 Conformance、360 Schema | 仅作为已记录**本地参考证据**，本轮未重跑；正式 G3 为 0/37 |
| 远端 CI 与外部证据 | `.github/workflows/compatibility.yml`, `docs/evidence-restoration.md` | Actions 已改手动；证据恢复源未远端托管。新增 Generator CI 不能依赖遗失报告而默默跳过 Gate |

**状态来源约束**：`project/status.json` 和 `PROJECT-STATUS.md` 优先于过时 README 文末数字。Generator 工程通过不自动修改 `coverage.verifiedGames`、`verifiedHybridCases` 或 `gates.G3GameplayAgent`。已有 `reports/` 不在 Git，正式证据恢复/远端 CI 属独立交付门禁；纯源码新检出的 Generator smoke 需有可复现独立测试，不得删除既有依赖证据的严格门禁。

## 10. Generator 产品接口与运行边界

### 10.1 完整本地链路

```text
prompt / prompt-file
    ↓
Generator CLI / Studio
    ↓ ProviderResolver（由宿主显式配置；不让 JSON 任意执行命令）
    ↓ CatalogSearch → SelectCapabilities → FreezeContext
    ↓ Direct JSON 生成 或 GamePlan → GameSpec 编译
    ↓ Strict Parser + Schema 2020-12 + Capability/语义/资源 Policy
    ↓ Conformance 正反例 → Headless Replay → 解法/可玩性基础检查
    ↓ Diagnostic Feedback（至多配置的重试预算）
    ↓ 可信本地 Release Receipt / Immutable Artifact
    ↓ Browser Inspector → Three.js + CocosAirJS 对照 → 本地游玩
    ↓ Generation Evidence + Quality Review（与正式 G3 分开）
```

**唯一事实来源**：`specs/v0.1/` 的 GameSpec/Capability/Tick/Conformance 规范；最终客户端内容仍为 `GameSpec 0.1.0`。`GamePlan` 仅是云/本地生成工具内部的结构化规划产物，不能在 Player 中运行，也不得作为第二套独立的 GameSpec 方言。

### 10.2 建议的 API（提议，不冒充当前已存在）

新增导出优先放在 `src/generator/` 或 `generator/`；已有 `scripts/*` 保持兼容代理。第一阶段建议的可编程接口：

```ts
interface GeneratorProvider {
  readonly id: string;
  probe(): Promise<ProviderProbe>;
  generate(request: ModelGenerationRequest, context: FrozenContext): Promise<ProviderOutput>;
}
interface GeneratorOptions {
  provider: GeneratorProvider; mode: 'direct-json' | 'game-plan';
  hostProfile: string; maxAttempts: number; deadlineMs: number;
  outputDirectory: string; seed?: number;
}
interface GeneratorResult {
  status: 'PASS_REFERENCE' | 'FAIL' | 'BLOCKED';
  gameFile?: string; conformanceFile?: string; receiptFile?: string;
  generationReport: string; previewUrl?: string;
}
```

接口形状为实施目标，不是对现有 `runAgentWorkflow` 的破坏性修改。应优先引入 adapter/wrapper，保持现存 JSON `a2game-generation-request/output` v1 和其它脚本可运行。`ProviderProbe` 仅识别模型接入能力、身份来源和兼容性，不访问/展示密钥；真正模型 ID 与宿主回传身份分开记录。Provider 失败与生成内容失败要区别处理，不能静默换模型。

### 10.3 最终 CLI UX（待开发，命令名作为产品验收要求）

```powershell
# 只示例目标命令，现有仓库尚未提供统一 a2game 命令
npx --no-install a2game generate --prompt-file .\prompts\plane-shooter.md --provider codex --mode direct-json --output .\output\plane-shooter
npx --no-install a2game generate --prompt-file .\prompts\plane-shooter.md --provider codex --mode game-plan --output .\output\plane-shooter-plan
npx --no-install a2game validate .\output\plane-shooter\game.json
npx --no-install a2game test .\output\plane-shooter
npx --no-install a2game preview .\output\plane-shooter --backend air
npx --no-install a2game inspect .\output\plane-shooter
```

要求同时支持安装后 `a2game ...` 和仓库本地 `npm run generator -- ...` 的等价入口；**不能为了 UX 直接将 `package.json` 私有工作区改成对外发布**。`preview` 在 `127.0.0.1` 随机可用端口启动本地服务，返回实际 URL；资源和 JSON 由现有内容服务验证。`validate`/`test` 在无模型、无 SDK 时也能执行 Headless；`preview --backend air/three` 缺 SDK 必须报告明确的阻塞与准备命令，不静默退化为 Canvas2D。

CLI 最低约束：非交互可脚本化、稳定退出码和错误码、`--json` 机器可读日志、`--help`、`--version`、`--provider`、`--mode`、`--output`、`--max-attempts`、`--timeout-ms`；中断后进程与 HTTP 监听关闭，输出目录不可覆盖旧证据。安全路径校验、输出尺寸预算与默认本机端口绑定。

### 10.4 生成产物格式（一个游戏独立目录）

```text
output/<game-id>/<generation-id>/
  game.json                  # 最终 GameSpec 0.1.0（准入通过后才有效）
  conformance.json           # 由生成器提出的正反例；要实际执行
  game-plan.json             # 仅 game-plan 模式；不发送给 Player
  solution.json              # 可选；模型自解与宿主求解必须可区别
  assets/manifest.json       # 有素材才生成；记录来源/哈希/政策
  release-receipt.json       # 经可信本地 Validator 签发的摘要与兼容 Profile
  generation-report.json     # provider/model/request/context/调用/修复/归因
  tests/                     # 自身测试回执与重复回放
  preview/                   # 截图、浏览器运行回执和人工/AI 观察
```

`game.json` 不能包含 API key、任意 JS、shell/DOM 代码；`generation-report` 不能回显任何认证信息。产物采用不覆盖/不变更既有 SHA 的新 run ID，并保留原始生成回复与失败诊断在受控本地私有目录（不公开上传）。报告引用的文件可以在结果目录内用相对路径解析，防止依赖个人绝对路径。敏感/大型原始输出默认不随公开游戏包分发。

## 11. Generator 实施工作包（GEN-0–GEN-8；完成后才进入下一波）

下面工作包按依赖顺序执行；不要求一步把所有步骤打包成一个大型 PR。每次采用**契约与负例 → 最小代码 → 实际回归 → 独立回执**，避免代码完成但入口无法给用户使用。

| 工作包 | 必须实现 | 依赖 | 最低验收（DoD） |
|---|---|---|---|
| **GEN-0** 基线与可复现性 | 冻结 `main` SHA/已有版本、检查工作区差异、分类当前失败；制定新检出不依赖历史巨型报告的 Generator smoke | 无 | 本地原环境 `project:check`/既有测试；全新检出精简 smoke 真实可跑；不通过跳过旧完整门禁达成 |
| **GEN-1** Generator 核心 API/CLI | 新增统一 CLI、稳定错误码/退出码、Provider 接口、输出布局与无模型 smoke | GEN-0 | 本地 fixture 生成→校验→测试→保存可运行；CLI 帮助/取消/超时/覆盖拒绝/失败报告通过 |
| **GEN-2** Provider 插件与预检 | 兼容 Codex CLI、原生模型 API、可选本地 HTTP/本地模型、宿主适配；保留身份/上下文/凭据隔离 | GEN-1 | probe 与 mock/fixture 回归；至少一种已授权真实 Provider 端到端成功；真实模型不存在时 `BLOCKED`, 不记 PASS |
| **GEN-3** Capability 检索与 GamePlan | 自然语言→玩法机制匹配→依赖闭包→精简目录；direct 与 plan 两条编译路径 | GEN-1/2 | 两种模式在同一游戏生成合法 GameSpec；Planner 所需字段/引用、缺失能力/冲突负例通过；无具体关卡答案泄漏 |
| **GEN-4** 自动校验修复和可玩性 | 复用完整 Schema、Content Release、Conformance、Solver、重复回放；有界诊断修复 | GEN-3 | 正反例/终局/重开/释放/随机种子稳定；拒绝未知能力、错误 JSON、循环规则、恶意/超限资源和伪造 PASS；有分类失败回执 |
| **GEN-5** 本地 Generator Studio | 自然语言输入、模式/模型配置、逐阶段进度、错误展示、真实双 SDK 预览、资源/状态/Hash Inspect、导出 | GEN-4、实际 SDK | 浏览器真实点击/键盘验证；两 Host 各启动/结束/重开/销毁，截图证据；无外网服务亦能访问本地 Studio（模型可选） |
| **GEN-6** 可移植游戏交付 | 标准不可变内容目录、素材 Manifest、SHA/来源与审核、导入/导出、兼容声明 | GEN-4/5 | 解压至另一独立工作区不修改 JSON 即可完整校验并运行；禁任意 URL/脚本；缺资源 fail-closed |
| **GEN-7** Generator Benchmark | 5 款跨类任务、两种模式、至少 1 个真实模型、固定上下文/预算、视觉与人工质量维度 | GEN-5/6 | 5 个任务分别保存首次生成、修复链、JSON/测试、双 SDK、输入、截图、哈希、成本/用量；正式 G3 单独判断 |
| **GEN-8** 文档/稳定入口/交接 | README 一键上手、实例项目、CLI/API 契约、故障排查、版本和工作包状态自动摘要 | GEN-7 | 新用户从干净源码按 README 不修改源码完成一个游戏生成→预览→导出；状态/文档/回执一致 |

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

### 11.5 GEN-5 本地 Studio 最小可用功能

页面至少包括：文本需求输入、模型 Provider/模式配置、生成开始/取消与进度、诊断面板、当前 `game.json`/GamePlan 差异、已验证结果列表、两 Host 选择/同屏对照（如实现成本高，可分别切换但每边独立截图）、浏览器实时操作与重开、初始/进行中/胜利/失败截图、Conformance/Hash、导出按钮。

交互闭环必须是：**用户点击生成 → 本地 Generator 执行 → 回执进入可加载目录 → 游戏真实启动并可操作**，不能用静态预置游戏替代生成结果；如果模型未配置，提供明确的 fixture 演示但标注 `DEMO_FIXTURE`。本地 Studio 只能访问 Loopback；异步子进程超时/用户取消要释放资源，不能残留端口或无界日志。

### 11.6 GEN-6 素材与独立交付的边界

第一批支持内置 Primitive、可信纹理/音效/字体及资源包中的受审核文件；资源可以是人类预设或经过审核的本地生成资产，但 JSON 不能要求任意远程脚本执行。未审核的 URL、脚本、文件系统越界和内容大小超限在发布前拒绝。把 `GameDefinition` 与 `ReleaseManifest` 分开：前者表示玩法，后者记录资源版本/哈希/依赖与目标 Host；未发布新规范时先在 Generator 内部用受控 bundle/receipt，避免破坏性更改 GameSpec 0.1.0。

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

## 13. 按批次执行与项目交接规则

### Batch A：CLI 闭环（GEN-0 / GEN-1 / GEN-2）

交付：独立 `a2game generate`、配置与 provider probe、fixture 正反例、新检出 smoke 与回执。可在不改变 GameSpec 和 Runtime Tick 的情况下使用已存在的 `scripts/agent-workflow.mjs`。先完成 Batch A 验收，再进入下一批。

### Batch B：生成质量（GEN-3 / GEN-4）

交付：CapabilitySearch、GamePlan 内部 Schema、两生成模式、完整准入/诊断/修复、重复回放与负例。不得通过加入预制解法提高所谓模型独立成功率。

### Batch C：本地体验（GEN-5 / GEN-6）

交付：Studio/Inspector 真实动态 JSON、双 SDK 预览、资源包、安全导出和新工作区恢复。复用 `scripts/serve.mjs`/现有 `player`，保持现有客户端安全边界。

### Batch D：正式测评与文档（GEN-7 / GEN-8）

交付：5 任务 × 2 模式的可复核运行材料、模型身份/上下文指纹、失败分类、可玩性/视觉、README/AGENTS/status 同步和完整交付报告。受外部模型、设备、额度等限制时分别标记 BLOCKED；不要以未执行的测试阻塞所有可独立完成工作，也不要宣称未运行 Gate PASS。

**并发原则**：每批最多三个互不冲突的子任务并行（如 CLI 命令、Provider 预检测试、文档），同一个核心文件例如 `src/runtime.ts`、`src/registry.ts`、`scripts/agent-workflow.mjs` 同时只能有一个修改者；合并统一由主 Agent 审查并运行回归。无外部运行时，不允许凭生成器 mock 对 G2/G3 结论进行升级。

**每批交付物**：源文件清单与差异、回归结果、实际运行命令、成功/失败/未运行 Gate、产物摘要、原有能力兼容性结论、下一批入口。保留失败诊断和历史已验证档案，不能删除旧规范/状态来“收口”。

## 14. 下一次 Agent 启动提示（直接使用）

> 请在 `https://github.com/oahc09/a2game` 当前 `main` 工作区实施 **A2Game Generator 本地产品化 Batch A**，按 `PROJECT-PLAN.md` 的 GEN-0 → GEN-1 → GEN-2 工作包推进，完成一批验证后再进入后续 Batch B/C/D。先读取 `README.md`、`AGENTS.md`、`PROJECT-PLAN.md`、`PROJECT-STATUS.md`、`project/status.json`、`specs/v0.1/docs/01~04` 和 `17-Agent-Workflow-V0.1.md`，检查 `git status`/当前 HEAD，保留所有用户文件与既有工作区差异。现有 S0–S11、G0–G3、32 Gxx+5 Hxx、Touch/IMU、双 SDK、真机/质量/远端 CI 全部必须保留。发行 `1.0.0` 与协议 `0.1.0` 不得混淆。复用 `scripts/agent-workflow.mjs`、Provider adapters、Capability Registry、Content Service、Headless/Player/Inspector，不重写第二套 Runtime，不让模型输出任意可执行代码。先完成 Generator API/CLI 和真实本地可复现链，提供 `generate/validate/test/preview` 的可执行入口、失败/取消/预算/安全测试、稳定回执和 README 上手说明。后续按 GamePlan、Studio、5 任务 × 2 模式 Benchmark 的 Gate 逐批推进；每步留下运行证据并更新状态，失败与 NOT_RUN 不得标 PASS。未经授权不推送/部署、不操作密钥、不更改权限、不删除重要数据。正式 G3、人工作品质量、真机和远端 CI 保持独立验收。

## 15. 本计划更新的边界与待决项

- **已确认、已核对（仅源码/仓库状态）**：基线 `7493ff7` 的旧 Agent/Codex/Model/HTTP 接入、既有 Registry/Content/Player、旧阶段与正式 G3 未完成事实。统一 Generator 入口属于本轮新增实现，验收以独立 Generator 状态为准。
- **本文件新增的实现要求**：Generator 产品统一 API/CLI、可选 GamePlan、Studio、可携带发行包、独立 GEN Gate/Benchmark、优先级变更。Batch A 已进入实施，其余仍是未来交付标准；不得将计划描述当已验收功能。
- **不更改**：历史回执、原 32+5 Coverage、任何实际测试结果及旧 S0–S11 Gate；`specs/v0.1/` 现有协议不因产品入口改变。实施状态同步至 `PROJECT-STATUS.md` 和 `project/generator-status.json`，`project/status.json` 仅增加独立工作流指针。
- **明确待验**：新检出 + 本地生成器 CLI、真实模型 Provider/身份、正式 AI 生成质量与 G3、两 Host 上新生成游戏的实际表现、物理 Touch/IMU、远端证据恢复与 CI。

### 15.1 本轮落地记录（2026-10-29）

基线为本地 `main` 提交 `7493ff7`（完整 SHA、环境见 [Generator 基线](project/generator-baseline.json)）。最终源码独立完成安装、构建、fixture 生成→完整准入→测试，无旧报告和 Renderer SDK，源码指纹一致，GEN-0 为 `PASS_LOCAL`。本轮完整 `npm run verify` 通过：125 Node、203 Conformance、360 Schema，旧回执恢复。GEN-1 的 API/CLI、fixture 和负例已验证，双 SDK 预览 HTTP 与监听关闭通过，实际浏览器渲染 `NOT_RUN`，状态 `PARTIAL`；GEN-2 适配已实现，真实 Provider E2E 受预算 0 阻塞。Batch A 维持 `PARTIAL`，未进入 Batch B，见 [Generator 台账](project/generator-status.json)。fixture 不属于独立模型生成，正式 G3 和旧 Gate 不升级。
