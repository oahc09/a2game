# A2Game 项目完整实施路线图（1.0.0 基线）

> **性质**：项目目标、技术边界与验收合同；不是“已经开发完成”的功能列表。  
> **项目发行基线**：`1.0.0`（参考实现 / Alpha，不代表生产稳定）。  
> **独立协议**：GameSpec / Capability Manifest / Tick/Rule / Conformance `0.1.0`（部分源规范文档标记 draft）。  
> **当前执行阶段**：`S2 — 真实双引擎 G2 四样例 scene2d 子集已通过`，下一主线为 S3/S4；`S1` 已有 Headless 参考子集，但整个 G1 尚不完整。证据与更新规则见 [PROJECT-STATUS.md](PROJECT-STATUS.md)。

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
| GameSpec JSON 结构 | `A2Game-V0.1-Spec/docs/01-GameSpec-V0.1.md` + `schemas/game.schema.json` | 项目 1.0.0 ≠ JSON `specVersion: 1.0.0` |
| 能力、版本和宿主协商 | `.../docs/02-Capability-Manifest-V0.1.md` + `schemas/capability.schema.json` | 计划 Capability ≠ 已注册实现 |
| Tick/Rule 执行与随机数 | `.../docs/03-Runtime-Tick-Rule-Semantics-V0.1.md` | 不允许实现任意改变 Tick 顺序 |
| 验收口径 / Gate | `.../docs/04-Conformance-Test-V0.1.md` | PASS 必须有可复现回执 |
| 32 个玩法及未来登记规则 | `.../docs/05-Coverage-Registry-V0.1.md` + `samples/coverage/games.json` | G01..G32 全部仍为 planned |
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
| **S3** 内容安全与交付流水线 | 任意 AI JSON 完整 Schema 2020-12、语义/版本安全校验、资源引用/完整性/来源策略、编译计划与缓存、错误修复反馈 | 浏览器或服务端使用等效完整校验，不降低为手写子集 | 未信任内容拒绝、负例和篡改测试，安全发布 Gate | **PARTIAL（目前仅预校验白名单）** |
| **S4** 通用表现 | Sprite、Texture、Mesh、Camera、Text、Animation、Particle、Audio、UI/HUD、Shader 扩展、资源生命周期；2D/2.5D/3D | 版本化 Manifest，Host 受控映射 | 不按游戏 ID 分支；双引擎截图/坐标/性能/释放 Gate | **PARTIAL（仅 rect/circle/text/repeat）** |
| **S5** 益智与休闲标准库 | Grid、Push、Slide、Merge、Swap、MatchN、Cascade、GravityFill、Tray、Layer/Occlusion、Sort、Polyomino、Rotate、LineClear、Undo、Find/Placement | 玩法契约与回合/混合时间语义；每机制测试变体 | G01–G10、G20、G24 对应能力/玩法验收 | **PARTIAL（两种网格子集）** |
| **S6** 实时玩法、物理与战斗 | Movement、Jump/Charge/Runner、Collider/Contact/Physics、Weapon/Projectile/Hitscan/Damage/Status/Wave/Target/AI、导航、对象池 | 命中去重、物理服务 Profile、终局、性能 | G11–G21、G30/G31 对应目标 + 不同 Host 对照 | **未实现核心模块** |
| **S7** 经营、策略、回合 | Economy/Inventory/Production/Shop/Upgrade/Unlock/PlacementGrid/PathFollow/Turn/Deck/Hand/LegalMove | 持久化及回合/实时混合 | G21–G24 和机制变体，跨域状态一致 | **计划中** |
| **S8** Mobile Touch/IMU | Raw pointer 多点/轨迹、Tap/Hold/Drag/Swipe/Pinch/Rotate、IMU Tilt/Shake/Orientation、校准/权限/滤波/回退、InputTrace | 真机权限、坐标、输入冲突、暂停与隐私 | G25–G32 真机与合成 Trace 双重验证 | **Swipe/合成 Trace 已做；其余计划中** |
| **S9** 全玩法覆盖与混合 | 冻结 G01–G32；增加 H01–H05 组合验证；32 分母可扩版本 | 每种完整 GameSpec、玩法正反例、E2E、Agent 变体 | 32 款分别出 verified receipt，Hxx 独立统计 | **全部 planned（未完成覆盖 Gate）** |
| **S10** Agent 生成与产品化 | 自然语言→JSON、能力目录查询、报错修复、关卡生成/Solver、难度评估、可视化调试、模型无关流程 | 自动化评测无画面 + 实浏览器；不可将人工样例当 one-shot | G3 生成、可玩性、修复闭环及质量门禁 | **NOT_RUN** |
| **S11** 持续兼容和扩展 | 新 Host、设备、网络多人、存档迁移、性能和文档发布 | 独立 Extension/Profile，变更兼容审计 | 多版本回归、可复现 CI、兼容性发布说明 | **规划范围，不冒充已支持** |

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
A2Game-V0.1-Spec/samples/capabilities/<id>.capability.json
A2Game-V0.1-Spec/samples/games/<reference>.game.json
A2Game-V0.1-Spec/samples/tests/<reference>.conformance.json
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
| 仅在 Python 构建时完整校验 | 浏览器动态 AI JSON 前，部署等效 Schema 2020-12 校验或可信后端预验证服务 |
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

## 9. 下一次 Agent 启动提示（可直接使用）

> 先阅读 `AGENTS.md`、`README.md`、`PROJECT-PLAN.md`、`PROJECT-STATUS.md` 与 `project/status.json`，依据其中的单一版本约定和 Gate 合同开展本轮工作。不要将项目发行 `1.0.0` 错写为 GameSpec 协议版本；不要将 Mock/Canvas2D 算作真实双引擎 G2。检查差异后，以 S2 的真实 CocosAirJS/Three.js E2E 为当前主线，独立工作可并行，但保持所有 32 Gxx、5 Hxx、Touch/IMU、Headless/Conformance/Agent Gate 在计划内。更新实现时提供测试、证据、项目状态和回归，不擅自提交或部署。
