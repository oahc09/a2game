# A2Game Ultimate Game Coverage v2.0 — 最终目标总纲

> **版本**：目标蓝图 v2.0 / 2026-11-22；**性质**：长期覆盖目标与开发任务拆解基线，不表示已实现。
> **源码基线**：`oahc09/a2game@13c64dc07c0e6dde3816f100216bad9565bb1ed0`（`main`，2026-11-15 最后一次推送）。
> **协议约束**：现有 GameSpec / Capability Protocol `0.1.0` 不因规划升级；本文件 v2.0 是目标版号，**不是** GameSpec 的可执行版本。
> **范围保护**：保留原 G01–G32、H01–H05 的编号、含义、冻结分母与历史验收；新增 G33–G192、H06–H32 采用独立 v2 目标登记。
> **方法**：先补真实玩法能力与交付体验，复用现有测试，不预造过量测试矩阵或新框架；每个新增游戏只证明关键用户循环与关键边界。

## 0. 目标结论与统计口径

### 0.1 最终目标

| 维度 | 最终目标 | 解释 |
|---|---:|---|
| 基础游戏原型 | **192** | G01–G192：原32＋新160。不是192个专属代码模块 |
| 组合/混合玩法 | **32** | H01–H32：原5＋新27；必须有跨机制因果，而非简单拼装 |
| 原型总数 | **224** | 仅“能力覆盖与创作目标”，非当前正式 verified |
| 扩展类型组 | **20** | 多标签分类；不排斥下一代玩法，类型不等于技术模块 |
| Gameplay Capability 家族 | **20** | 本文件梳理 363 个**概念能力点**；并非 363 个已发布 Manifest |
| 平台、表现与交付领域 | **6** | Asset/Player/Device/Release/QA与Gameplay解耦 |
| Agent/Skill 工具链领域 | **5** | 复用当前Skill/MCP/Generator，不额外创建AI模型 |
| 目标游戏执行模式 | 离散、计时、回合、实时、混合 | 可扩本地多人/权威网络、2D/2.5D/3D |

**注意：** Gxx/Hxx 是“代表性游戏原型”，不是市场游戏产品数，也不是预设JSON集合。一个能力应能创建不同布局、规则参数和主题的多个作品。禁止将 `taxonomy.mechanics` 当成现有 Capability API。

### 0.2 目前已有的边界（依据最新仓库）

- 原 `coverage/games.json` 有 32 条 G01–G32；`PROJECT-PLAN.md` 保留 H01–H05。全部仍属于原正式验收口径，不因本计划自动升级。
- 现行代码树在 `specs/v0.1/capabilities/` 含 **128 份 `*.capability.json` 文件**；是静态文件计数，不等于全部能在真实宿主稳定生效，也不等于本目标能力概念数。
- 当前仓库已经有 Generator、MCP、Skill、独立 Player SDK、三款 Phase2 作品、本地创作素材与发布链路的参考工作；应按状态台账与实际运行区分 `PASS_REFERENCE`、`PARTIAL`、`NOT_RUN`。
- 11月15日当前主线以功能收口/已知问题处理为先，正式 G3、实际品牌宿主创作、真机与公开部署另验。先保持这些现行任务，不要求现在立刻启动 224 项生成。

### 0.3 外部分类参考与本文件的区别

- Steam 官方标签体系覆盖 Action、RPG、Survival、Strategy、Racing、Sports、Rhythm、Sandbox、Roguelike、Visual Novel 等；标签可多选，因此本文件采用「主类型＋多机制/空间/操作标签」，而不是单一互斥枚举。
- Godot 官方 Demo 从 2D/3D 场景、导航、物理、音频/节奏、GUI、XR 等维度组织技术示例。启发是 **Gameplay、Presentation、Platform/Device 应分别建模**。
- 参考：<https://store.steampowered.com/tag/browse/en/>；<https://godotengine.github.io/godot-demo-projects/>。外部平台是分类/技术参考，本文件中的G33+与H06+属于新的**设计提案**，并非这些平台对A2Game的验证结果。

## 1. 设计边界与产品形态（不可变）


1. **AI Agent 编写**：Qoder/WorkBuddy/TRAE/其他宿主原生模型理解需求、选机制、写 `GameSpec + Conformance + solution`；A2Game Skill/MCP 提供合同、校验、诊断、预览、包导出。宿主已生成时不做二次模型调用。
2. **Gameplay 不属于 Renderer**：规则/碰撞归因/目标/数值状态在共享 Runtime 或声明的受信服务中，CocosAirJS/Three.js 只消费投影、输入和生命周期。禁止按具体 Gxx 名称分支。
3. **不得执行 AI 输出的任意代码**：GameSpec 不携带可执行 JS/TS、eval、任意网络或文件权限；缺机制必须注册可信 Capability 或显式拒绝，不可假装已支持。
4. **两类物理合同**：离散/整数精确逻辑比较 Hash；连续 3D 物理采用声明的容差、种子与回放 Profile，不宣称不同引擎像素级一致。
5. **多人边界**：单人/local co-op 可在共享 Runtime；在线权威和反作弊由可信服务持有，不把客户端 JSON 当服务端可执行脚本。
6. **表现与玩法双目标**：视觉/声音可用声明式预设、受审核资源；素材来源、许可、SHA 必须可追溯。高画质不是 Schema PASS。
7. **已有项目优先**：保留 `specs/v0.1/`、现有 S0–S11、Generator、HOST、Phase2、Player SDK、各 Gate；不为蓝图重写工程、改路由、扩调用预算或执行部署。
8. **难度边界**：目标是中小型、数据驱动可玩的原型和可扩作品；完整版 MMO、AAA 开放世界、大规模联机电竞、复杂 3D 物理引擎研发不构成当前交付承诺。

## 2. 全局分类轴（决定覆盖而非复制玩法）


| 轴 | 目标值 | 用途 |
|---|---|---|
| Genre | 20扩展主类型＋多标签 | 按玩家实际体验分类，允许一个作品同时是射击/肉鸽/策略 |
| Core Loop | 解谜/闯关/战斗/探索/收集/建造/经营/竞速/叙事/协作 | Agent 必须明确玩家动作→状态变化→反馈→目标 |
| Time | discrete / timed / realtime / turnbased / mixed | Tick/输入消费/暂停与结算合同 |
| Space | 2D / 2.5D / 3D / voxel / isometric | 玩法坐标与渲染镜头独立 |
| Input | tap/drag/swipe/keyboard/gamepad/multitouch/IMU/mic/MIDI | 声明输入来源、权限与回退 |
| Session | single/local-coop/async-online/authoritative-online | 决定状态所有权与网络服务需求 |
| Progression | 单局/多关/局外成长/赛季/存档 | 存档版本与回放要求 |
| Visual | procedural/vector/sprite/3D/PBR/stylized | 只是表现维度；不决定游戏规则 |
| Delivery | Web/WebView/Desktop/native-host/embedded-sdk | 真实平台支持声明/版本签名/资源可用性 |

**分类准则**：标题是一种参考循环，同一 G ID 下的关卡/视觉/难度变体不单独增加代表玩法数；只有出现新的“不可由已有能力组合完成的机制族”才新增 G ID。

## 3. 原始 32 款基础游戏：G01–G32（冻结，不重编号）


| ID | 玩法名称 | 原类型 | 核心循环 | 主要机制（概念） |
|---|---|---|---|---|
| `G01` | 推箱子 | 益智/逻辑 | 网格移位→推箱→所有目标到位 | Grid, Push, Goal, Undo |
| `G02` | 2048 | 益智/逻辑 | 滑动→单次合并→随机补位 | Slide, Merge, RNG, Score |
| `G03` | 三消 | 益智/逻辑 | 交换→匹配→连锁→目标结算 | Swap, MatchN, Cascade, GravityFill |
| `G04` | 堆叠三消 | 益智/逻辑 | 解除遮挡→取牌入槽→匹配 | LayeredStack, Tray, Capacity, MatchN |
| `G05` | 麻将叠牌配对 | 益智/逻辑 | 寻找可见牌→两两消除 | Occlusion, PairMatch |
| `G06` | 箭头迷宫消除 | 益智/逻辑 | 观察方向→判断遮挡→移除 | Direction, Occupancy, Goal |
| `G07` | 翻牌配对 | 益智/逻辑 | 翻牌记忆→配对→计时 | Reveal, PairMatch, Timer |
| `G08` | Block Puzzle | 益智/逻辑 | 拖放拼块→整行清除 | Polyomino, Placement, LineClear |
| `G09` | 俄罗斯方块 | 益智/逻辑 | 下落→旋转→锁定→消行 | FallingPiece, RotatePiece, LineClear |
| `G10` | 找物整理 | 冒险/休闲 | 选择物品→拖拽归位→完成 | Select, Placement, Goal |
| `G11` | 跳一跳 | 平台/街机 | 长按蓄力→跳跃→落点计分 | Charge, Jump, Landing |
| `G12` | Flappy | 平台/街机 | 点击上升→躲避障碍→积分 | Velocity, TriggerZone, Score |
| `G13` | 换道跑酷 | 平台/街机 | 滑动换道→躲避→通关 | LaneMove, AutoScroll, Spawner |
| `G14` | 打砖块 | 平台/街机 | 控制挡板→碰撞反弹→消灭砖块 | Collider, Bounce, Health |
| `G15` | 弹球 | 物理/街机 | 触发弹板→物理碰撞→得分 | RigidBody, Constraint, TriggerZone |
| `G16` | 物理合成 | 物理/街机 | 掉落→物理接触→合并升级 | RigidBody, Contact, Merge |
| `G17` | 纵版飞机 | 射击/战斗 | 移动→开火→波次敌人→胜负 | Weapon, Projectile, Wave |
| `G18` | 俯视射击 | 射击/战斗 | 移动瞄准→攻击→生存 | Aim, Health, Damage |
| `G19` | 僵尸生存 | 生存/Roguelite | 移动→自动索敌→升级→生存 | AutoTarget, Horde, Upgrade |
| `G20` | 泡泡龙弹射 | 益智/逻辑 | 瞄准弹射→碰撞→连通匹配 | Aim, Bounce, ConnectedMatch |
| `G21` | 塔防 | 策略/防守 | 布塔→路径敌人→攻击→守卫 | Placement, PathFollow, Weapon, Wave |
| `G22` | 农场 | 模拟/生活 | 播种→等待→采集→循环 | Production, Timer, Collect |
| `G23` | 合成经营 | 经营/经济 | 合成→生产→回收资源 | Merge, Production, EconomyLoop |
| `G24` | 五子棋 | 桌游/回合 | 轮流落子→合法性→胜负 | Turn, LegalMove, Goal |
| `G25` | 水果切割 | 移动/体感 | 轨迹划过→切割→计分 | TouchPath, Intersection, Score |
| `G26` | 双指旋转拼图 | 移动/体感 | 双指旋转→放置→拼合 | MultiTouch, Rotate, Placement |
| `G27` | 重力迷宫 | 移动/体感 | 倾斜设备→碰撞→到达目标 | IMUTilt, Collision, Goal |
| `G28` | 平衡堆叠 | 移动/体感 | 设备倾斜→调平→叠放 | IMUTilt, Balance, Placement |
| `G29` | 摇一摇机关 | 移动/体感 | 摇晃→解除机关→计时目标 | IMUShake, Timer, Unlock |
| `G30` | 弹弓打靶 | 射击/战斗 | 拖拽蓄力→释放→命中 | Drag, Charge, Projectile |
| `G31` | 姿态打靶 | 移动/体感 | 姿态瞄准→击中目标 | IMUOrientation, Aim, Hitscan |
| `G32` | 多指机关 | 移动/体感 | 多点同时触发→机关解锁 | MultiHold, Timer, Goal |

这些 G01–G32 在原 `coverage/games.json` 中登记为 `planned`；项目有参考样例与部分工程回执，但不代表原冻结正式 Gate 已全部通过。

## 4. 新增 160 个游戏原型：G33–G192（20 类型组，每组8款）


表内“机制”是 **候选能力概念**，落地前必须映射到真实 `a2game.*@version` Manifest、依赖和 Runtime；“难度”只表示新增实现成本，**不是验收通过率**。

复杂度：`S` 小机制组合、`M` 中等新能力、`H` 较高复杂度；波次 A/B/C/D 表示建议推进簇，允许因依赖把个别 3D 原型后移。

### T01｜逻辑推理与空间益智（Puzzle & Logic，G33–G40；建议波次 A）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G33` | 数独 | 填数→约束检查→完成棋盘 | ConstraintGrid, CandidateNotes, LogicSolver | 2D | S |
| `G34` | 数织 Nonogram | 阅读行列线索→填格→还原图案 | RowColumnClues, GridMarks, Hint | 2D | S |
| `G35` | 扫雷 | 揭格/插旗→推断雷区→清空安全格 | NeighborCount, HiddenCell, SafeFirstClick | 2D | S |
| `G36` | 一笔画路径 | 连通边→不重复通过→完成图形 | GraphEdge, PathVisit, WinCheck | 2D | S |
| `G37` | 水管接通 | 旋转管道→连通流路→点亮出口 | RotatePiece, Connectivity, FlowPropagation | 2D | M |
| `G38` | 华容道滑块 | 拖动块体→碰撞阻挡→主块出界 | SlidingBlock, GridOccupancy, ExitGoal | 2D | M |
| `G39` | 镜面激光机关 | 调整镜子→光线反射→激活开关 | GridRaycast, Mirror, SwitchGraph | 2D | M |
| `G40` | 连锁机关密室 | 组合钥匙与机关→解锁→逃脱 | TriggerGraph, ItemFlags, Interaction | 2D | M |

### T02｜休闲街机与微型游戏（Casual & Arcade，G41–G48；建议波次 A）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G41` | 贪吃蛇 | 转向→吃食物→增长与避碰 | GridMovement, BodyTrail, SpawnFood | 2D | S |
| `G42` | 打地鼠 | 目标随机出现→点击→计时计分 | TimedSpawn, HitWindow, ScoreCombo | 2D | S |
| `G43` | 弹幕闪避 | 移动避弹→存活→统计分数 | ProjectilePattern, Hitbox, SurvivalTimer | 2D | M |
| `G44` | 接落物 | 移动容器→分类接取→错误扣分 | FallingItems, Collector, ScoreRule | 2D | S |
| `G45` | 飞刀转盘 | 把握转动时机→投掷→避免命中旧刀 | AngularMotion, Collision, ThrowTiming | 2D | M |
| `G46` | 知识问答闯关 | 题目挑战→限时作答→计分晋级 | QuizBank, AnswerJudge, TimeLimit | 2D | S |
| `G47` | 颜色分拣流水线 | 搬运彩色物品→分道→计件 | Conveyor, ColorRouting, Capacity | 2D | M |
| `G48` | 街机捕鱼 | 瞄准射出→击中目标→资源返还 | Aim, Projectile, TargetValue, Economy | 2D | M |

### T03｜平台跳跃与跑酷（Platformer & Runner，G49–G56；建议波次 A）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G49` | 2D 横版平台闯关 | 跑跳→平台落地→抵达终点 | Kinematic2D, Grounding, Checkpoint | 2D | M |
| `G50` | 二段跳与空中冲刺 | 腾空→复跳/冲刺→通关 | AirJump, Dash, ResourceRecharge | 2D | M |
| `G51` | 墙跳与攀爬 | 贴墙→攀爬→反弹越障 | WallContact, Climb, WallJump | 2D | M |
| `G52` | 机关横版闯关 | 触发按钮→门/升降台变更→通关 | MovingPlatform, TriggerGraph, Gate | 2D | M |
| `G53` | 精确平台解谜 | 控制时序→激活装置→到达出口 | MovingHazard, Checkpoint, TimedSwitch | 2D | M |
| `G54` | 重力翻转平台 | 切换重力→落到新表面→解谜 | GravityDirection, Collision, StateSwitch | 2D | H |
| `G55` | 等距视角跑酷 | 三轴观感→移动跳跃→障碍通关 | IsometricProjection, LaneMove, CameraFollow | 2.5D | M |
| `G56` | 3D 平台跳跃 | 移动视角→跳跃→拾取目标 | CharacterController3D, Camera3D, Grounding | 3D | H |

### T04｜射击、弹幕与载具战斗（Shooter & Combat，G57–G64；建议波次 A）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G57` | 横版清关射击 | 跑跳射击→清理敌人→完成关卡 | PlatformMove, Weapon, EnemyWave | 2D | M |
| `G58` | 弹幕 Boss 战 | 观察弹道→躲避→输出→换阶段 | PatternEmitter, Hitbox, BossPhase | 2D | H |
| `G59` | 双摇杆射击 | 独立移动/瞄准→开火→存活 | TwinStick, Weapon, Targeting | 2D | M |
| `G60` | 狙击解谜射击 | 观察标靶→瞄准→命中弱点 | AimZoom, Raycast, WeakPoint | 2D | M |
| `G61` | 第一人称迷宫射击 | FPS移动→对准→射击→解锁 | CharacterController3D, Hitscan, CameraFPS | 3D | H |
| `G62` | 第三人称竞技场 | 角色机动→锁敌→火力对战 | CharacterController3D, CameraTPS, Projectile | 3D | H |
| `G63` | 阵地炮台射击 | 转动火炮→应对潮汐敌群→守卫 | TurretAim, Wave, AmmoEconomy | 2D | M |
| `G64` | 坦克大战 | 驾驶移动→开炮→墙体/敌人碰撞 | Vehicle2D, Projectile, Destructible | 2D | M |

### T05｜格斗、近战与动作（Fighting & Brawler，G65–G72；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G65` | 2D 一对一格斗 | 防守→招式→命中与受击 | FightingFSM, HitHurtBox, RoundTimer | 2D | H |
| `G66` | 横版清版格斗 | 移动→近战连击→清敌 | BeatEmUpMove, Combo, Knockback | 2.5D | H |
| `G67` | 武器对决 | 格挡/突刺→武器碰撞→判胜 | WeaponReach, Parry, Stamina | 2D | H |
| `G68` | 竞技场乱斗 | 多对象攻防→击退出界→胜利 | ArenaBoundary, Knockback, MultiActor | 2D | H |
| `G69` | 技能连招挑战 | 输入串→派生技能→冷却 | InputCombo, CancelWindow, Cooldown | 2D | M |
| `G70` | 拳击读招 | 预测预告→闪避/格挡→反击 | Telegraph, GuardDodge, HitTiming | 2D | M |
| `G71` | 弹反 Boss 战 | 节奏时机→弹反→破防输出 | ParryWindow, Poise, BossPhase | 2D | H |
| `G72` | 3D 锁定近战 | 镜头锁敌→移动→攻击/闪避 | LockOn3D, AnimationState, HitVolume | 3D | H |

### T06｜肉鸽、生存与闯关（Roguelike & Survival，G73–G80；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G73` | 俯视生存肉鸽 | 探索战斗→拾取升级→坚持生存 | ProceduralRooms, Loot, SkillChoice | 2D | H |
| `G74` | 随机地牢走格 | 随机房间→战斗/机关→出口 | DungeonGen, Encounter, Permadeath | 2D | M |
| `G75` | 波次幸存者升级 | 移动避群→自动攻击→升级构筑 | EnemyDirector, AutoWeapon, UpgradeDraft | 2D | M |
| `G76` | 肉鸽卡牌爬塔 | 构筑牌组→战斗→事件路线 | DeckBuilder, TurnCombat, RewardDraft | 2D | H |
| `G77` | 分支风险事件 | 选择路径→获取资源/遭遇风险→结算 | EventGraph, RiskReward, RunMeta | 2D | M |
| `G78` | 饥饿与采集生存 | 搜集→消耗体力食物→避险 | NeedsMeters, Gathering, DayNight | 2D | M |
| `G79` | Boss 连战 | 战斗→保存资源→连续阶段 | BossSequence, RunLoadout, Checkpoint | 2D | H |
| `G80` | 限区撤离生存 Lite | 搜索战利品→遭遇→到时撤离 | ExtractionZone, InventoryRisk, AIAlert | 2D | H |

### T07｜角色扮演与地牢（RPG & Dungeon，G81–G88；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G81` | JRPG 回合战斗 | 选技能→回合结算→队伍成长 | TurnOrder, SkillEffect, PartyStats | 2D | M |
| `G82` | 实时动作 RPG | 探索→释放技能→掉落装备 | CharacterStats, ActionSkills, Loot | 2D | H |
| `G83` | 队伍养成战斗 | 角色编队→战斗→经验升级 | PartyFormation, XPLevel, Equipment | 2D | M |
| `G84` | 网格 SRPG | 移动布阵→技能行动→结束回合 | TileMove, ActionPoints, RangeTarget | 2D | H |
| `G85` | 词缀装备构筑 | 收集装备→比较词缀→形成流派 | ItemAffixes, StatModifiers, BuildRule | 2D | M |
| `G86` | 地城任务副本 | 接取任务→地牢战斗→领取奖励 | QuestFlags, Combat, RewardClaim | 2D | M |
| `G87` | 技能树养成 | 获取点数→解锁分支→产生实际强化 | SkillTree, Prerequisite, StatEffect | 2D | M |
| `G88` | 3D 地牢探索 | 第一人称探索→寻宝与机关→返回 | Navigation3D, Interaction, Inventory | 3D | H |

### T08｜剧情、冒险与解谜叙事（Adventure & Narrative，G89–G96；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G89` | 点触冒险 | 探索场景→拾取→组合使用 | PointClick, InventoryCombine, SceneTransition | 2D | M |
| `G90` | 交互小说 | 阅读→选项→状态分支 | DialogueGraph, Variables, Branching | 2D | S |
| `G91` | 视觉小说多结局 | 剧情选择→关系变化→结局 | DialogueUI, Affinity, MultipleEndings | 2D | M |
| `G92` | 侦探证据板 | 收集线索→关联→推理结论 | ClueGraph, EvidenceLink, Deduction | 2D | M |
| `G93` | 连锁任务冒险 | 触发任务→完成目标→开放区域 | QuestChain, WorldFlags, Unlock | 2D | M |
| `G94` | 剧情密室逃脱 | 查找道具→机关推理→逃离 | InventoryPuzzle, TriggerGraph, ExitFlow | 2D | M |
| `G95` | NPC 关系经营 | 对话互动→信任变化→新事件 | NPCDialogue, Relationship, EventFlags | 2D | M |
| `G96` | 地图探索冒险 | 探索迷雾→发现地标→完成任务 | MapReveal, POI, QuestTracking | 2.5D | H |

### T09｜战略、战术与回合博弈（Strategy & Tactics，G97–G104；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G97` | 回合制格子战棋 | 行动点移动→攻击→回合结算 | GridTactics, TurnAP, Cover | 2D | H |
| `G98` | 六边形战术 | 六角寻路→控制要地→胜负 | HexGrid, PathCost, ZoneControl | 2D | H |
| `G99` | 小队实时 RTS | 选中单位→下达命令→占领 | UnitSelection, Formation, RTSOrders | 2D | H |
| `G100` | 4X 微型星图 | 探索→扩张→开发→竞争 | FogExploration, TechTree, Diplomacy | 2D | H |
| `G101` | 战争迷雾侦察 | 派兵探路→视野变化→伏击 | FogOfWar, LineOfSight, Ambush | 2D | M |
| `G102` | 兵种阵型克制 | 布置阵型→自动交战→统计 | Formation, CounterMatrix, AutoCombat | 2D | M |
| `G103` | 资源点争夺 | 抢占资源→支援前线→占领胜利 | CapturePoint, ResourceFlow, UnitSpawn | 2D | M |
| `G104` | 自动对战战棋 | 棋盘放置→回合自动战斗→升级 | AutoBattler, Shop, RoundFlow | 2D | H |

### T10｜塔防、自动战斗与阵地（Tower Defense & Auto Battle，G105–G112；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G105` | 多岔路塔防 | 选布塔位→预测路径→守关 | RouteGraph, TowerRange, Wave | 2D | M |
| `G106` | 自由路线塔防 | 搭建塔路→路径重算→进攻 | BuildablePath, Pathfinding, Tower | 2D | H |
| `G107` | 合成进阶塔防 | 合成塔级→改变射程/效果→闯关 | MergeBuilding, TowerStats, Wave | 2D | M |
| `G108` | 元素连锁塔防 | 配元素塔→触发反应→减速击敌 | ElementStatus, ReactionRule, Tower | 2D | H |
| `G109` | 迷宫路径塔防 | 放置墙塔→引导怪物→防守 | MazeRouting, PathValidity, Placement | 2D | H |
| `G110` | 自走棋排兵 | 招募→羁绊搭配→自动战斗 | AutoBattler, UnitSynergy, Shop | 2D | H |
| `G111` | 卡牌指令塔防 | 抽牌建塔→支付费用→应对波次 | CardDeck, Economy, Tower | 2D | M |
| `G112` | 弹幕基地防守 | 放置护盾→密集弹幕→修复基地 | PatternEmitter, BaseHealth, Repair | 2D | H |

### T11｜生活、角色与生态模拟（Life & Simulation，G113–G120；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G113` | 虚拟宠物养成 | 喂食互动→需求变化→成长 | PetNeeds, Relationship, DailyEvent | 2D | M |
| `G114` | 餐厅经营 | 接单→制作菜品→上菜评价 | OrderQueue, Recipe, ServiceTimer | 2D | M |
| `G115` | 便利店经营 | 进货→陈列→收银→升级 | Stocking, CustomerAI, Checkout | 2D | M |
| `G116` | 小屋生活模拟 | 布置家具→作息→生活事件 | DailySchedule, HomeDecor, Needs | 2D | M |
| `G117` | 微型城市交通 | 规划路口→车辆流动→优化拥堵 | TrafficGraph, SignalFSM, VehicleFlow | 2D | H |
| `G118` | 动物园生态管理 | 栖息地布局→照顾动物→游客反馈 | HabitatNeeds, Population, VisitorAI | 2D | H |
| `G119` | 四季农场 | 作物生长→季节更替→加工 | SeasonCycle, CropGrowth, Processing | 2D | M |
| `G120` | 太空殖民舱 | 调配氧气/能源→处理事件→存活 | LifeSupport, ResourceNetwork, Incident | 2D | H |

### T12｜经济、物流、放置与管理（Economy & Idle，G121–G128；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G121` | 放置增量经营 | 产出→投资升级→增加产率 | Incremental, Automation, Prestige | 2D | S |
| `G122` | 工厂生产线 | 连接机器→加工→库存 | ProductionGraph, Conveyor, Recipe | 2D | M |
| `G123` | 物流配送调度 | 接单→分配车辆→准时配送 | Dispatch, RoutePlanning, Deadline | 2D | M |
| `G124` | 商店定价模拟 | 进货→定价→满足顾客→盈亏 | SupplyDemand, PricePolicy, CustomerFlow | 2D | M |
| `G125` | 虚构市场博弈 | 观察随机需求→生产交易→经营积分 | SyntheticMarket, TradingRule, RiskMeter | 2D | H |
| `G126` | 矿场资源循环 | 采矿→冶炼→建设采矿设施 | Gathering, Processing, Upgrade | 2D | M |
| `G127` | 多货币科技发展 | 运营→研发→解锁新链 | MultipleCurrency, TechTree, Unlock | 2D | M |
| `G128` | 订单排产经营 | 计划工序→管理队列→按时交付 | JobQueue, Capacity, ProductionSchedule | 2D | H |

### T13｜建造、沙盒与创造（Building & Sandbox，G129–G136；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G129` | 方块自由建造 | 放置/挖掘→保存造物→试玩 | VoxelBlocks, BuildRules, WorldSave | 3D | H |
| `G130` | 桥梁结构搭建 | 布设梁柱→受力模拟→车辆通过 | StructureConstraints, LoadTest, Physics | 2D | H |
| `G131` | 关卡编辑与试玩 | 摆放规则组件→验证→分享关卡 | LevelEditor, DataBinding, UGCPackage | 2D | M |
| `G132` | 逻辑电路沙盒 | 连接开关/门→信号传播→装置动作 | CircuitGraph, SignalFlow, Actuator | 2D | H |
| `G133` | 管道流体工厂 | 布置输送管网→分配流量→完成目标 | PipeNetwork, CapacityFlow, FlowRule | 2D | H |
| `G134` | 生态造景沙盒 | 放置植物动物→生态变化→观察 | BiomeRule, Population, SeasonCycle | 2D | H |
| `G135` | 积木车辆拼装 | 组合部件→驾驶测试→优化 | AssemblyGraph, VehiclePhysics, Parts | 3D | H |
| `G136` | 小型体素世界 | 生成地形→开采与搭建→保存 | VoxelTerrain, ChunkLoading, Persistence | 3D | H |

### T14｜赛车、驾驶与交通（Racing & Driving，G137–G144；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G137` | 俯视街机赛车 | 转向加减速→圈速→排名 | Vehicle2D, TrackLap, Checkpoint | 2D | M |
| `G138` | 漂移竞速 | 控制侧滑→积累漂移分→完赛 | DriftModel, Traction, ComboScore | 2D | H |
| `G139` | 卡丁车道具赛 | 追逐竞速→使用道具→名次变化 | KartPhysics, Pickup, Ranking | 3D | H |
| `G140` | 计时挑战赛 | 穿越计时门→冲线→重播Ghost | LapTimer, TimeTrial, GhostReplay | 2D | M |
| `G141` | 交通穿行 | 变道超车→躲车→完成距离 | TrafficSpawner, LaneMove, Collision | 2D | M |
| `G142` | 越野障碍驾驶 | 爬坡→轮胎抓地→越过障碍 | VehicleSuspension, TerrainContact, Checkpoint | 3D | H |
| `G143` | 3D 高速追逐 | 驾驶→转弯→躲避追踪 | Vehicle3D, CameraChase, AIChase | 3D | H |
| `G144` | 低空飞行竞速 | 控制俯仰/偏航→穿越航点 | FlightController, Waypoint, Timer | 3D | H |

### T15｜体育、技巧与派对（Sports & Party，G145–G152；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G145` | 足球点球 | 控制角度与力度→射门/扑救 | BallTrajectory, GoalkeeperAI, Score | 2D | M |
| `G146` | 篮球投篮 | 拖拽控制投篮→碰撞入筐 | ThrowArc, BallCollision, Score | 2D | M |
| `G147` | 乒乓球 | 击球反弹→比分与回合 | PaddleControl, BallSpin, MatchRules | 2D | M |
| `G148` | 保龄球 | 投球→物理碰撞→倒瓶计分 | RigidBody3D, PinCollision, BowlingScore | 3D | H |
| `G149` | 迷你高尔夫 | 选择方向/力度→克服障碍→入洞 | BallPhysics, StrokeCounter, CupTrigger | 3D | H |
| `G150` | 网球对打 | 移动→击球→回合计分 | CourtBounds, Serve, ScoreRules | 2.5D | H |
| `G151` | 小游戏运动会 | 多项目挑战→成绩统计→奖杯 | MiniGameFlow, Scoreboard, TimeTrial | 2D | M |
| `G152` | 本地派对小游戏 | 交替/同步输入→短回合→积分 | LocalMultiplayer, GameRounds, InputPartition | 2D | M |

### T16｜棋类、卡牌与桌面规则（Board, Card & Tabletop，G153–G160；建议波次 B）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G153` | 国际象棋 | 合法走子→将军/将死→和棋 | ChessMoves, CheckState, TurnClock | 2D | H |
| `G154` | 中国象棋 | 棋子路径→将军→胜负 | XiangqiRules, PieceMove, Turn | 2D | H |
| `G155` | 黑白棋 | 合法落子→夹击翻转→结算 | ReversiFlip, LegalMove, Turn | 2D | M |
| `G156` | 四连棋 | 落子占格→连线判胜 | ConnectN, GravityDrop, Turn | 2D | S |
| `G157` | 斗地主规则单局 | 叫牌→合法出牌→压制/过牌→结算 | CardTrick, TrickCompare, Turn | 2D | H |
| `G158` | 轻量对战式卡牌 | 组牌→抽牌→支付→攻防 | DeckBuilder, CardEffect, EnergyCost | 2D | H |
| `G159` | 骰子资源桌游 | 掷骰→行动路线→资源转移 | DiceRNG, BoardTrack, Resource | 2D | M |
| `G160` | 区域控制桌游 | 布置棋子→争夺区域→回合得分 | ZoneControl, ActionPoints, Scoring | 2D | M |

### T17｜音乐、节奏与声音交互（Rhythm & Music，G161–G168；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G161` | 四轨下落节奏 | 节拍判定→连击→评分 | BeatTimeline, HitWindow, Judgement | 2D | M |
| `G162` | 鼓点节奏 | 单/双击鼓点→判定→连击 | RhythmNotes, InputJudge, Combo | 2D | M |
| `G163` | 舞蹈按键 | 节拍方向输入→时机得分 | ArrowNotes, TimingCalibration, Accuracy | 2D | M |
| `G164` | 虚拟鼓组 | 选择鼓件→演奏→记录节拍 | InstrumentPad, AudioScheduler, LoopRecorder | 2D | M |
| `G165` | 音准跟唱 | 麦克风音高→与目标比较→得分 | MicrophonePermission, PitchDetect, NoteJudge | 2D | H |
| `G166` | 节奏跑酷 | 按节拍跳/滑→躲障→通关 | BeatTimeline, RunnerMove, SyncObstacle | 2D | H |
| `G167` | MIDI 键盘练习 | MIDI输入→谱面判定→训练反馈 | MIDIBinding, NoteChart, TimingJudge | 2D | H |
| `G168` | 本地合奏 | 多用户分轨演奏→节拍对齐→评分 | LocalPlayers, MusicSync, SessionScore | 2D | H |

### T18｜恐怖、潜行与调查（Horror, Stealth & Detective，G169–G176；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G169` | 潜行巡逻 | 观察守卫→躲避视野→抵达目标 | GuardAI, VisionCone, StealthState | 2D | M |
| `G170` | 动态视锥迷宫 | 避开探照灯→关闭机关→过关 | VisionCone, AlertMeter, SwitchGraph | 2D | M |
| `G171` | 暗室手电恐怖解谜 | 探索暗区→光源揭示→解锁 | LightVisibility, Atmosphere, InventoryPuzzle | 2D | M |
| `G172` | 证物现场调查 | 搜寻证物→验证时间线→结案 | ClueCollection, TimelineGraph, Resolution | 2D | M |
| `G173` | 多嫌疑人推理 | 询问→对照矛盾→得出结论 | DialogueGraph, EvidenceLink, Deduction | 2D | M |
| `G174` | 巡逻追逐逃生 | 噪声吸引→追逐→隐藏脱离 | NoisePropagation, EnemyAlert, HideSpot | 2D | H |
| `G175` | 限时逃脱 | 在倒计时内联动多个机关→逃脱 | Timer, TriggerGraph, FailureFlow | 2D | M |
| `G176` | 生存恐怖资源管理 | 省弹药→探索→躲避危险 | ScarceAmmo, FearFeedback, Inventory | 2D | H |

### T19｜3D 空间、物理与探索（3D Spatial & Physics，G177–G184；建议波次 C）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G177` | 第一人称 3D 迷宫 | 自由视角→探索→找出口 | CameraFPS, Navigation3D, Collision3D | 3D | H |
| `G178` | 3D 刚体叠塔 | 拾取方块→堆叠→保持稳定 | RigidBody3D, GrabJoint, StableScore | 3D | H |
| `G179` | 3D 台球 | 瞄准击球→碰撞→进袋计分 | BallPhysics3D, CueAim, Rules | 3D | H |
| `G180` | 3D 弹珠机关 | 启动球→轨道碰撞→触发开关 | RigidBody3D, TriggerChain, Constraint | 3D | H |
| `G181` | 3D 物理桥梁 | 拼装结构→负载穿越→评分 | StructureGraph, Constraint3D, VehicleLoad | 3D | H |
| `G182` | 潜航水体探险 | 推进游动→浮力/阻力→采集 | Buoyancy, UnderwaterNav, Collect | 3D | H |
| `G183` | 轻量飞行模拟 | 控制姿态→动力→穿越航线 | FlightModel, ControlAxis, Waypoint | 3D | H |
| `G184` | 3D 场景探索收集 | 镜头导航→寻物交互→完成 | SceneTraversal, RayPicking, QuestState | 3D | H |

### T20｜多人、合作与 UGC（Multiplayer, Co-op & UGC，G185–G192；建议波次 D）

| ID | 代表玩法 | 玩家核心循环 | 主要机制（概念） | 空间 | 难度 |
|---|---|---|---|---|---|
| `G185` | 同屏双人对战 | 不同输入源→交替攻防→比分 | LocalMultiplayer, InputPartition, MatchFlow | 2D | M |
| `G186` | 局域网贪吃蛇对战 | 同步移动→抢食→碰撞胜负 | NetInputSync, ServerTick, ConflictRule | 2D | H |
| `G187` | 双人合作机关 | 分工按按钮→同步解谜→出口 | CoopRoles, MultiPlayerTrigger, SharedGoal | 2D | M |
| `G188` | 多人协作闯关 | 多角色配合→解锁关卡→共享奖励 | CoopSession, TeamState, Checkpoint | 2D | H |
| `G189` | 权威小队竞技 | 移动战斗→服务器裁定→赛果 | ServerAuthority, StateReplication, AntiCheat | 2D | H |
| `G190` | 异步棋类对局 | 轮到玩家→提交回合→同步进度 | AsyncTurn, ServerValidate, ConflictHandling | 2D | M |
| `G191` | 排行榜挑战赛 | 完成独立单局→可信比分→排名 | ScoreSubmission, ReplayAudit, Leaderboard | 2D | M |
| `G192` | 轻量 UGC 地图社区 | 创作关卡→审核发布→他人游玩 | UGCManifest, Moderation, VersionedLoad | 2D | H |

## 5. 混合玩法 32 项：H01–H32（独立于 G 类统计）


Hxx 必须验证 **跨机制因果**，例如生产的资源真实支付攻击、合成后旧武器不能继续命中、剧情选择真实改变地图；只是同时装两个模块不算完成。

| ID | 组合目标 | 能力组合 | 关键跨域因果 | 波次 | 来源 |
|---|---|---|---|---|---|
| `H01` | 合成炮台保卫战 | Merge + TowerDefense + Economy | 炮台替换后旧武器停止攻击，按 Tick 结算经济 | B | 原有 |
| `H02` | 三消 + 角色升级 | Match / Cascade + Upgrade + Combat | 消除奖励真实改写战斗伤害 | B | 原有 |
| `H03` | 跑酷 + 射击 | Runner + Weapon + Shared Tick | 移动与开火并发输入，弹丸回收 | B | 原有 |
| `H04` | 物理合成 + IMU 倾斜 | Physics + IMU + Merge | 传感器校准回退、物理合并去重 | C | 原有 |
| `H05` | 找物 + 限时关卡 | Placement + Timer + Goal | HitTest 与倒计时终局一致 | A | 原有 |
| `H06` | 肉鸽射击升级 | Shooter + Roguelite + Upgrade | 波次升级真正改变武器与生存能力 | B | 新增 |
| `H07` | 平台跳跃机关解谜 | Platformer + TriggerGraph + Puzzle | 玩家移动、机关、闸门因果闭环 | A | 新增 |
| `H08` | 卡牌战棋 | Deck + GridTactics + TurnAP | 卡牌效果决定单位位置和攻击 | B | 新增 |
| `H09` | 塔防物流供给 | Factory + TowerDefense + Inventory | 弹药由真实产线供应并消耗 | B | 新增 |
| `H10` | 动作格斗肉鸽 | Brawler + Roguelite + SkillTree | 连招与关卡间构筑有真实数值效果 | B | 新增 |
| `H11` | 剧情平台冒险 | Platformer + Dialogue + Quest | 任务选择实际改变地图机关 | A | 新增 |
| `H12` | 种田烹饪经营 | Farming + Recipe + CustomerAI | 收成进入真实配方并完成订单 | B | 新增 |
| `H13` | 城市交通经济 | CityBuilder + Traffic + Economy | 交通吞吐影响税收和人口满意度 | B | 新增 |
| `H14` | 机甲组件射击 | Shooter + Assembly + Damage | 装配组件实际改变弹丸/护甲 | B | 新增 |
| `H15` | RPG 卡组构筑 | RPGStats + DeckBuilder + Loot | 装备词缀实际作用于卡牌伤害 | B | 新增 |
| `H16` | 战争迷雾潜行战棋 | TurnTactics + FogOfWar + Stealth | 可见性影响合法攻击和潜伏 | B | 新增 |
| `H17` | 4X 回合外交 | 4X + Diplomacy + Turn | 外交状态真实限制交易和行动 | B | 新增 |
| `H18` | ARPG 采集锻造 | ActionRPG + Craft + Loot | 采集材料→锻造装备→增加战力 | B | 新增 |
| `H19` | 节奏近战 Boss | Rhythm + Parry + BossPhase | 节拍判定影响弹反伤害与阶段 | C | 新增 |
| `H20` | 载具战斗竞速 | Racing + Weapon + VehicleDamage | 碰撞、道具和路线共同影响成绩 | C | 新增 |
| `H21` | 体育战术卡牌 | Sports + Deck + Turn | 卡牌策略影响回合进攻与得分 | B | 新增 |
| `H22` | 棋盘技能对战 | BoardGame + Skill + Cooldown | 合法走棋与技能争夺统一结算 | B | 新增 |
| `H23` | 天气与解谜冒险 | Weather + Puzzle + Quest | 环境变化实际改变道路可用性 | B | 新增 |
| `H24` | 钓鱼与市场经营 | Fishing + Economy + Inventory | 捕获物品真实入库出售与升级 | B | 新增 |
| `H25` | 3D 物理机械建造 | RigidBody3D + Assembly + Goal | 造物能承载负载并完成目标 | C | 新增 |
| `H26` | 3D 叙事探索 | Scene3D + Dialogue + Inventory | 探索取得物品触发真实叙事分支 | C | 新增 |
| `H27` | 3D 幽灵竞速 | Racing3D + GhostReplay + TimeTrial | 同地图Ghost轨迹与计时可回放 | C | 新增 |
| `H28` | 协作双人解谜 | Coop + Puzzle + SharedGoal | 两人同时或顺序操作真正解锁 | D | 新增 |
| `H29` | 多人权威塔防 | TowerDefense + ServerAuthority + Coop | 多用户放塔与资源冲突由权威端裁定 | D | 新增 |
| `H30` | 多人派对回合赛 | PartyGame + Matchmaking + TurnSync | 断线/重连仍保留真实局面 | D | 新增 |
| `H31` | 3D UGC 共创世界 | VoxelWorld + UGC + Moderation | 受控地图资源/权限/版本可安全加载 | D | 新增 |
| `H32` | 生存建造昼夜循环 | Survival + Crafting + DayNight | 夜间危险/建设防护对资源产生真实影响 | C | 新增 |

## 6. Capability 终极目标目录（20 个 Gameplay 家族）


本章登记 **363 个概念能力点 / 20 个家族**。它们是能力需求字典，不代表 363 个已实现的 Manifest，也不强制一项对应一个独立 API；应优先合并为泛化程度高且可测的可信机制。

**新能力落地顺序**：检查既有 `128` 份 Manifest / 源码→能参数组合就复用→确有缺口才定义新 `a2game.<domain>.<capability>@version`→说明配置、状态、命令、事件、依赖、Tick 阶段→加最小玩法正反例→对目标 Host 做真实操作。所有新名称都要在实际 Registry 登记后才能供模型使用。

### C01｜Game Core / 生命周期与规则（17 项）

- **已有可复用方向**：已有 core/rules。
- **能力点（概念）**：`Entity`, `Component`, `StateSchema`, `RuleGraph`, `EventBus`, `TickScheduler`, `Timer`, `RNG`, `Transaction`, `Priority`, `FlowFSM`, `GoalFailure`, `Score`, `Snapshot`, `ExactHash`, `Replay`, `ErrorAttribution`。
- **关键边界**：全玩法基本规则；必须保留现有 Tick/Hash 与禁止任意脚本。

### C02｜空间、坐标与地图（16 项）

- **已有可复用方向**：部分已有 visual/physics。
- **能力点（概念）**：`Scene2D`, `Scene3D`, `TileMap`, `HexGrid`, `IsometricGrid`, `NavGraph`, `Region`, `SpatialQuery`, `GridRaycast`, `RayPicking`, `WorldOrigin`, `Portal`, `CameraSpace`, `WorldChunk`, `LOD`, `SceneTransition`。
- **关键边界**：地图多维；不允许地图坐标参与宿主差异规则。

### C03｜输入与玩家控制（19 项）

- **已有可复用方向**：已有 touch/keyboard/gamepad/IMU 子集。
- **能力点（概念）**：`KeyEdge`, `KeyHold`, `PointerTap`, `PointerDrag`, `PointerPath`, `MultiTouch`, `PinchRotate`, `GamepadAxis`, `GamepadButton`, `IMUTilt`, `IMUShake`, `Orientation`, `VirtualJoystick`, `TwinStick`, `ContextAction`, `InputMapping`, `InputRebind`, `InputTrace`, `CancelOnBlur`。
- **关键边界**：低延迟与权限降级；真实设备单独验证。

### C04｜逻辑益智与棋盘（25 项）

- **已有可复用方向**：已有 puzzle 子集。
- **能力点（概念）**：`GridOccupancy`, `MovePush`, `SlidingTile`, `Swap`, `Merge`, `MatchN`, `Cascade`, `GravityFill`, `Polyomino`, `RotatePiece`, `LineClear`, `PairMatch`, `Occlusion`, `LogicConstraint`, `GraphConnectivity`, `PathVisit`, `LaserReflection`, `MinesweeperReveal`, `SudokuRule`, `NonogramClue`, `WordPuzzle`, `TriviaQuiz`, `QuizBank`, `AnswerJudge`, `Undo`。
- **关键边界**：先复用已有 puzzle；新增规则要通用与可参数化。

### C05｜动作与移动控制（17 项）

- **已有可复用方向**：已有 realtime 子集。
- **能力点（概念）**：`KinematicBody`, `Velocity`, `Acceleration`, `Jump`, `CoyoteTime`, `JumpBuffer`, `AirDash`, `WallJump`, `Climb`, `MovingPlatform`, `LaneMove`, `AutoScroll`, `FollowPath`, `Chase`, `KnockbackMotion`, `CharacterController3D`, `FlightControl`。
- **关键边界**：定时、边缘输入和镜头责任明确。

### C06｜物理与碰撞（19 项）

- **已有可复用方向**：已有 bounded realtime + rigid3d Profile。
- **能力点（概念）**：`AABB`, `CircleCollision`, `Trigger`, `ContinuousCollision`, `Contact`, `Bounce`, `Friction`, `Restitution`, `RigidBody2D`, `RigidBody3D`, `Joint`, `Constraint`, `Ragdoll`, `Buoyancy`, `VehicleSuspension`, `Rope`, `SoftBody`, `Breakable`, `SleepWake`。
- **关键边界**：确定性逻辑/声明容差物理 Profile 分离。

### C07｜武器与伤害战斗（21 项）

- **已有可复用方向**：已有 combat 子集。
- **能力点（概念）**：`Health`, `Shield`, `Team`, `DamageType`, `Resistance`, `Armor`, `Invulnerability`, `Weapon`, `Projectile`, `Hitscan`, `Beam`, `Explosion`, `AreaDamage`, `Knockback`, `StatusEffect`, `Cooldown`, `Ammo`, `PatternEmitter`, `BossPhase`, `DeathDrop`, `HitDedup`。
- **关键边界**：击中/效果/奖励时序与对象所有权可追溯。

### C08｜NPC、敌人和策略 AI（18 项）

- **已有可复用方向**：已有部分 auto-target/path。
- **能力点（概念）**：`FiniteStateMachine`, `BehaviorTreeProfile`, `Patrol`, `Perception`, `VisionCone`, `Hearing`, `TargetSelect`, `Navigation`, `Steering`, `Threat`, `Cover`, `FormationAI`, `Flee`, `BossTelegraph`, `EnemyDirector`, `DifficultyDirector`, `CompanionAI`, `FactionRelation`。
- **关键边界**：运行时使用可信规则型 NPC AI；不是每 Tick 调 LLM。

### C09｜回合、棋类与博弈（16 项）

- **已有可复用方向**：已有 turnbased 子集。
- **能力点（概念）**：`TurnOwner`, `LegalMove`, `PlayerOrder`, `ActionPoints`, `TurnClock`, `BoardPiece`, `CheckState`, `MoveGenerator`, `ZoneControl`, `CaptureRule`, `FogState`, `SimultaneousPlan`, `WinDraw`, `RoundFlow`, `AsynchronousTurn`, `UndoPolicy`。
- **关键边界**：复杂棋类需专门可信规则模块，不允许模型自定义脚本。

### C10｜卡牌、牌堆与骰子（19 项）

- **已有可复用方向**：已有 deck/hand/cards。
- **能力点（概念）**：`Deck`, `Hand`, `Draw`, `Discard`, `Shuffle`, `CardEffect`, `CardTarget`, `EnergyCost`, `CardUpgrade`, `CardTag`, `Combo`, `TrickTaking`, `CardCompare`, `DiceRNG`, `DiceModifier`, `HiddenInfo`, `DeckDraft`, `Exhaust`, `Retain`。
- **关键边界**：隐藏信息权威端校验，客户端不泄露牌面。

### C11｜RPG 成长与角色（18 项）

- **已有可复用方向**：已有 upgrade/health 等子集。
- **能力点（概念）**：`CharacterStats`, `XP`, `Level`, `SkillTree`, `Talent`, `Equipment`, `ItemAffix`, `BuffStack`, `Debuff`, `Stamina`, `Mana`, `Party`, `Class`, `LootTable`, `QuestReward`, `ProgressionCurve`, `DifficultyScale`, `Respawn`。
- **关键边界**：真实数值效果而非仅界面显示等级。

### C12｜库存、经济和商业规则（19 项）

- **已有可复用方向**：已有 strategy 子集。
- **能力点（概念）**：`Inventory`, `Wallet`, `Resource`, `Cost`, `Reward`, `Shop`, `Price`, `SupplyDemand`, `Exchange`, `DebtPolicy`, `Production`, `Collection`, `CraftRecipe`, `Trade`, `MarketSimulation`, `OrderQueue`, `Budget`, `ResourceTransaction`, `CurrencyConversion`。
- **关键边界**：必须是虚构游戏内经济，默认无真钱交易。

### C13｜建设、生产与自动化（18 项）

- **已有可复用方向**：已有 tower/placement/production 子集。
- **能力点（概念）**：`BuildGrid`, `BuildValidity`, `BuildingStats`, `ProductionGraph`, `Recipe`, `Conveyor`, `PipeNetwork`, `ElectricityGrid`, `RoadNetwork`, `Storage`, `Capacity`, `Workforce`, `Maintenance`, `Upgrade`, `Demolish`, `Assembly`, `StructuralLoad`, `Settlement`。
- **关键边界**：地图建造与生产网络可声明，边界预算可控。

### C14｜战术、RTS 与防守（19 项）

- **已有可复用方向**：已有 tower-defense/path 子集。
- **能力点（概念）**：`Pathfinding`, `RouteGraph`, `Tower`, `TowerRange`, `Wave`, `SpawnBudget`, `UnitControl`, `CommandQueue`, `FogOfWar`, `LineOfSight`, `Formation`, `CounterMatrix`, `TacticalGrid`, `HexMap`, `CapturePoint`, `AutoBattler`, `UnitSynergy`, `TechTree`, `Diplomacy`。
- **关键边界**：由可复用策略规则组合，不在 Adapter 写战斗。

### C15｜剧情、对话和任务（17 项）

- **已有可复用方向**：新增提案为主。
- **能力点（概念）**：`DialogueGraph`, `Choice`, `DialogueCondition`, `QuestGraph`, `Objective`, `WorldFlag`, `ItemUsage`, `Evidence`, `Timeline`, `Relationship`, `Reputation`, `BranchEnding`, `NarrativeEvent`, `SceneUnlock`, `CutsceneTimeline`, `Subtitle`, `Localization`。
- **关键边界**：叙事文本为内容数据，不可注入脚本或命令。

### C16｜生存、肉鸽与世界事件（18 项）

- **已有可复用方向**：已有 Spawn/Upgrade 可复用。
- **能力点（概念）**：`Needs`, `Hunger`, `Thirst`, `Fatigue`, `DayNight`, `Season`, `Weather`, `SurvivalHazard`, `LootDraft`, `Permadeath`, `MetaProgress`, `RunSeed`, `Encounter`, `EventRisk`, `Extraction`, `SafeZone`, `ResourceDecay`, `ProceduralRoom`。
- **关键边界**：随机种子可回放，持久成长与单局状态隔离。

### C17｜音乐节拍与音频玩法（16 项）

- **已有可复用方向**：新增提案为主。
- **能力点（概念）**：`BeatTimeline`, `BPMClock`, `AudioLatency`, `HitWindow`, `Judgement`, `ComboScore`, `LongNote`, `SlideNote`, `NoteChart`, `MusicSync`, `InstrumentPad`, `AudioScheduler`, `MidiInput`, `MicPermission`, `PitchDetection`, `InputCalibration`。
- **关键边界**：音画时钟与 Tick 不可混用；音频输入有权限边界。

### C18｜竞速、体育与技巧（18 项）

- **已有可复用方向**：新增提案为主。
- **能力点（概念）**：`Vehicle2D`, `Vehicle3D`, `Steering`, `AccelerationCurve`, `Drift`, `Traction`, `Suspension`, `Track`, `Lap`, `Checkpoint`, `TimeTrial`, `GhostReplay`, `Ranking`, `BallFlight`, `Spin`, `CourtRules`, `GoalScore`, `MatchTimer`。
- **关键边界**：物理与评分规则分开，可 replay。

### C19｜程序化内容与 UGC（15 项）

- **已有可复用方向**：已有 RNG/Stage/发布子集。
- **能力点（概念）**：`SeededGenerator`, `LayoutConstraint`, `GrammarRule`, `BiomeGen`, `DungeonGen`, `LootGen`, `EncounterGen`, `LevelEditor`, `VersionedLevel`, `UGCManifest`, `ContentModeration`, `AssetWhitelist`, `RuntimeBudget`, `AssetLicense`, `DiffPatch`。
- **关键边界**：生成是受控数据/规则，不接受脚本与任意资源 URL。

### C20｜多人协作与联网（18 项）

- **已有可复用方向**：已有 loopback turn-room 参考。
- **能力点（概念）**：`LocalPlayers`, `InputPartition`, `NetSession`, `ServerAuthority`, `InputPrediction`, `StateReplication`, `Reconciliation`, `SnapshotDelta`, `AsyncTurn`, `Matchmaking`, `Room`, `Spectator`, `Reconnect`, `PlayerRole`, `CoopGoal`, `Leaderboard`, `AuditReplay`, `AntiCheat`。
- **关键边界**：服务端权威 Profile 独立，避免把浏览器 local Host 当服务器权威。

### 6.1 现有 Manifest 方向与新增缺口的差异表（待逐项代码核实）

下面的现有名称只是当前树中可见的 **Manifest/参考实现线索**，不意味着整条机制已产品可用；右侧缺口属于技术推断，落地前仍需读取真正的组件 ABI 与测试。
| 家族 | 当前可复用线索（省略 `a2game.` 前缀） | 新增高价值缺口 |
|---|---|---|
| `C01` | core.state / rules.state-set / core.flow | 复杂全局任务图、跨场景状态 |
| `C02` | visual.scene2d / visual.stage | HexGrid、导航世界、体素与大地图 |
| `C03` | input.touch.drag / input.gamepad.axis2 | Mic/MIDI、精细设备回退、可重绑输入 |
| `C04` | puzzle.grid / puzzle.match-n / puzzle.undo | 数独/数织/扫雷/连通与推理约束 |
| `C05` | realtime.jump / realtime.lane-move | 完整平台动作、墙跳/冲刺/3D角色控制 |
| `C06` | physics.rigid3d / realtime.collider | 车辆、布料/绳索、连续碰撞和浮力 |
| `C07` | combat.weapon / combat.wave | 复杂Boss、多阶段技能及元素协同 |
| `C08` | combat.auto-target / strategy.path | 可信NPC决策、感知、队伍/守卫AI |
| `C09` | turnbased.turn / turnbased.legal-move | 完整国际象棋/中国象棋与战棋规则 |
| `C10` | turnbased.deck / turnbased.cards | 高级CardEffect/目标/资源结算 |
| `C11` | strategy.upgrade / combat.health | RPG经验、职业、属性和装备掉落 |
| `C12` | strategy.economy / strategy.shop | 订单/市场/多货币经济与调度 |
| `C13` | strategy.production / strategy.placement-grid | 工厂生产图、道路/管线/结构装配 |
| `C14` | strategy.tower-defense / strategy.path-follow | RTS指令、迷雾/视野/协同兵种 |
| `C15` | core.rules / core.flow（通用底层） | 任务/对话/关系/剧情分支独立规则 |
| `C16` | core.rng / realtime.spawner | 局内Meta、随机地牢、昼夜和生存需求 |
| `C17` | visual.stage（事件音频） | 节奏判定、延迟校准、Mic/MIDI |
| `C18` | realtime.velocity / physics.rigid3d | 赛车与运动专用模型和计分规则 |
| `C19` | core.rng / 受控内容发布链路 | 受信地牢/地形生成和UGC审核机制 |
| `C20` | turnbased.turn / 本地turn-room参考服务 | 权威服务器、复制/重连/反作弊 |

## 7. 表现、平台与交付：6 个非玩法支撑域


这些是 Profile / Player / Asset / Service 合同，不应全部塞进 GameSpec 玩法规则或假装都是 Gameplay Capability。

| ID | 支撑域 | 目标能力 |
|---|---|---|
| `P01` | 二维视觉与动画 | Sprite, Atlas, Tilemap, Particle, Trail, Tween, ScreenShake, 2DLighting, HUD, Text, Mask |
| `P02` | 三维表现与特效 | Mesh, Material, PBR, Lighting, Shadow, Camera3D, Skeleton, Animation, PostFX, Instancing, LOD |
| `P03` | 素材生成与版权追踪 | PresetLibrary, AssetManifest, License, Source, Hash, Package, Texture, Audio, Model, Font, Fallback |
| `P04` | 多设备与可访问性 | Web, WebView, Desktop, Touch, Keyboard, Gamepad, IMU, WebXR, Resize, DPR, Language, Accessibility |
| `P05` | 交付、存档与可信分发 | Save, Migration, Versioning, Rollback, Integrity, Cache, Import, Export, Update, Permission, Audit |
| `P06` | 性能、稳定性与安全 | Budget, CPU/GPUProfile, Memory, GC, Pool, ContextLoss, ErrorBoundary, ResourceRelease, NoScripts, FailClosed |

### 跨平台与体验最低功能目标

- **2D 优先**：可点击/可拖动/可重开/暂停/切换游戏；移动布局清晰；手柄与键盘与游戏规则一致。
- **3D 逐步进阶**：相机/投影/场景/碰撞与对象生命周期；骨骼/粒子/材质/水体等按受审 Stage Profile 扩展，不以画面效果突破可信执行边界。
- **真实设备**：Android WebView 触摸/输入/音频/生命周期优先；IMU、麦克风、MIDI、WebXR 需要权限和机型适用性，不支持时明确标记并允许声明的回退。
- **资产供应**：内建图元与主题先行，复用 `creation-library.json`，加入受审 Sprite/Atlas/Audio/3D Model 清单；来源/许可证与体积预算可检查，不做不可信资源自动加载。
- **发布交付**：GameSpec 与 ReleaseManifest 分离；独立 Player SDK 能接收可信包，版本可回退，内容增量不得破坏旧局和已启动 Session。
- **在线多人**：权威状态放服务端，协议以声明数据传递规则配置；隐私、封禁/匹配/同步/断线恢复单独作为可信服务能力与资源预算。

## 8. 让 Agent 真正生产新游戏：5 个工作能力


| 编号 | Agent 支撑 | 完成的产品能力 |
|---|---|---|
| `A01` | Agent Skill | 需求→玩法设计→Capability检索→GameSpec→本机测试→修复→作品交付 |
| `A02` | MCP工具 | list/get/resource→validate/test→inspect/preview→export；默认0次内部模型调用 |
| `A03` | 本地Generator/CLI | 仅显式使用模型Provider；可接受已有模型JSON直接准入 |
| `A04` | 审查与可追溯 | 录制关键输入、保存原始生成/版本/截图与来源，不重复铺设大型测试框架 |
| `A05` | Benchmark与学习反馈 | 真实缺陷聚类→Skill/Manifest/Runtime归因→保留集验证；不靠累计数字代替质量 |

推荐创作链：**需求意图 → 当前模型编写简短设计计划 → 读取实际 Capability 合同 → 创作 GameSpec/测试/解法 → MCP 完整准入/反馈修复 → Headless → 实际双 Host 试玩 → 资源包导出 → 客户端接收**。

GamePlan/设计笔记只在创作阶段使用，不新增一套 Client 能执行的 DSL。Skill 应支持先做核心循环再补视觉反馈；不能为了让作品通过 Schema 而把用户要求的复杂玩法简化成点击加分。

## 9. 分阶段实施方案：只按可用能力推进，不按数量造假


| 波次 | 核心方向 | 优先补齐 | 代表交付标准 |
|---|---|---|---|
| **阶段 F0：现有功能收口** | 沿用2026-11-15现行功能/服务任务 | Air/Player 已知问题、持久生成与发布、信任和单管理员边界，原32+5不重跑假验收 | 现有功能可靠、已知缺陷闭环并记录真实阻塞 |
| **阶段 A：2D高复用基本盘** | 逻辑益智/街机/平台/简单射击 | 图/约束、通用输入、平台控制、角色/地图/预设 UI，优先 G33–G64 中不依赖3D的原型 | Agent 生成 3–5 款新机制可玩作品并成功导出，确认泛化 |
| **阶段 B：规则系统与内容创作** | 近战、肉鸽、RPG、剧情、策略、塔防、生活经营、卡棋与组合作品 | NPC/任务/卡牌/动作经济、跨模块因果，逐步覆盖 G65–G128、G153–G160 和适用 Hxx | 玩家循环完整、组合能力真实生效，不为单一作品硬编码 |
| **阶段 C：3D/物理/媒体/创作** | 沙盒建造、赛车体育、节奏、潜行、3D空间 | Physics3D Profile、结构建造、camera、audio timing、资产和性能，覆盖 G129–G184 的适用项 | 针对目标设备的 3D/节奏作品真实可玩，失败按支持范围说明 |
| **阶段 D：多人/UGC/高级组合** | 联机、同步、协作、UGC、跨服务内容 | 权威状态、会话、冲突、可信资源、关卡社区，覆盖 G185–G192及高级Hxx | 至少一个真实双人/协作流程和可信升级/恢复链路，不声称可运行大型MMO |

**排序规则**：某一原型若所需核心机制未登记，先补共享 Capability；若同类原型已有几个可用作品，优先解决它们暴露的创作/素材/输入问题，而不是机械生产新截图。当前优先用户要求的功能和已知问题收口；不在没有授权时自动调用宿主模型。

### 9.1 首轮建议交付的高价值新增作品（按增益选择而非简单选前几项）

| 顺序 | 原型 | 为什么优先 | 最可能补齐的共享机制 |
|---|---|---|---|
| `G35` | 扫雷 | 经典逻辑规则，能快速检验难度和随机布局 | Reveal/Neighbor/Seed+推理规则 |
| `G41` | 贪吃蛇 | 极简实时行为，与既有益智体系互补 | 增长身体/连续移动与碰撞 |
| `G49` | 2D 横版平台闯关 | 2D平台基础可衍生数十种作品 | 角色控制/平台检测/摄像机 |
| `G73` | 俯视生存肉鸽 | 验证程序化地图、战斗与局外成长组合 | 随机图/战利品/技能选择 |
| `G81` | JRPG 回合战斗 | 补齐RPG回合制，复用现有卡牌与属性 | 多单位回合、技能效果 |
| `G90` | 交互小说 | 低成本扩展到叙事/教育玩法 | 剧情分支/文本状态 |
| `G97` | 回合制格子战棋 | 补充战棋、策略通用规则 | 范围/行动点/合法移动 |
| `G121` | 放置增量经营 | 验证经济成长与离线累计的可控边界 | 增量经济/生产自动化 |
| `G155` | 黑白棋 | 验证规则模板能表示完整桌面棋类 | 棋盘合法移动/翻转 |
| `H08` | 卡牌战棋 | 验证卡牌+空间战棋的真实跨机制联动 | 打牌消耗→单位行动/伤害 |

这些是第一批建议**候选**，并非要求立即全部开发。优先安排 3 个互不冲突的子任务并发；每个作品结论通过后再换下一项。

## 10. 定义“能力真正覆盖”的最低标准（克制测试设计）


**按影响范围最小验证，而不是建立224×全平台×全窗口组合矩阵。** 每个原型应具有：

1. 明确的一句话玩法循环、初始/成功/失败条件、必需能力 Manifest 版本与资源来源；缺能力就记录 `UNSUPPORTED`。
2. Agent 真正生成新的 GameSpec；完整 Schema/能力/语义准入与至少一条可以执行的胜利路径，以及一个本玩法关键边界（失败、非法输入或未完成）。
3. 在目标 Host 实际操作完成一局，确认输入到游戏结果的因果、画面可辨、重开/暂停/销毁有效；新增或改变跨 Host 逻辑时才做两端详细对照。
4. 复用既有 Conformance 与受影响回归；修复实际发现的问题，不能为了通过而删真实负例、换计数游戏、把 Mock 当原生。
5. `FULL_VERIFIED` 必须另外满足原 `G0–G3` 和适用设备/独立创作/质量审查要求；目标登记/局部试玩不能改写旧正式统计。

**质量评价要分三件事**：`ENGINEERING_PLAYABLE`（工程逻辑可玩）、`AGENT_QUALITY_REVIEWED`（Agent 独立试玩并有实际发现）、`FORMAL_VERIFIED`（对应正式 Gate 全通过）。Agent 替代人工质量评价时沿用用户现行项目规则，不因此自动满足独立性或 G3 的其他条件。

### 10.1 新版本覆盖指标与不重复计算

- 原固定分母：`G01–G32` / `H01–H05` 不变，历史回执不重算。
- 新提案分母：`G33–G192` 160款、`H06–H32` 27款，新增为独立 `v2` 目标登记；正式覆盖的分母需在新 Registry 定稿/冻结 SHA 后才启用。
- 真实指标：每个类别 `capability_supported / gameplay_playable / agent_authored / agent_quality / formal_verified` 分列；已完成/在做/受阻也分列。禁止 “128个 Manifest = 128款游戏” 或 “224项规划 = 224项支持”。
- 单人/本地双人/在线权威的验证互不替代；物理与视听按声明的 Host Profile 归因，未支持平台不占已支持的分子。

## 11. 建议代码与文档落地（开发 Agent 可直接拆解）


```text
docs/A2Game-Ultimate-Game-Coverage-v2.0.md     # 本目标总纲（独立）
project/coverage-v2-target.json                 # 仅目标清单，不覆盖现有 coverage/games.json
project/coverage-v2-progress.json               # 后续可选的最小进度，真正执行后才写
specs/v0.1/capabilities/                         # 现有 Manifest，仅按需求增量追加
src/modules/                                     # 可信共享机制，不因G ID逐款硬编码
integrations/skill/a2game/                      # 单一Skill源，按真实创作缺陷更新
integrations/mcp/                               # 只扩确实需要的公共工具/资源
packages/player-sdk/                            # 复用已存在的独立Player SDK
packages/content-delivery/                      # 复用已有版本/内容包管道
games/                                            # 逐波次新增的可玩作品/关卡数据
```

**注意**：以上 v2 文档、目标登记路径是拟议交付位置，当前未检查是否已经有同名未提交文件。落地前先检查工作区差异，采用新增文件，不能覆盖用户编辑或历史证据。

### 11.1 推荐给开发 Agent 的启动任务

> 请以 `oahc09/a2game` 当前 `main` 为基线，执行 A2Game Ultimate Game Coverage v2.0 的**目标登记与第一批能力覆盖**。先检查工作区差异，阅读 `AGENTS.md`、最新 `PROJECT-PLAN.md`、`PROJECT-STATUS.md`、`project/status.json`、`specs/v0.1/coverage/games.json` 与当前 128 份能力 Manifest；以现有功能收口任务优先，避免与其他 Agent 修改相同文件。
> 本计划新 G33–G192/H06–H32 属未来目标，不改原 G01–G32/H01–H05 的 frozen denominator、已有GameSpec 0.1.0或历史回执。先创建独立目标 Registry，自动核对 192+32 ID 唯一、类别和机制字段；此检查仅是数据一致性，不升级玩法支持。
> 然后只挑具有代表性、可复用能力缺口明确的最多 3 项启动实现：优先真正可玩的游戏和共享 Capability，调用现有 Skill/MCP、Runtime/Player/资源系统；一个成功路径、一个关键失败路径、真实画面和受影响回归即可，不预设计全覆盖测试矩阵。未授权不得调用模型、提交、推送、部署、修改凭据、权限或全局配置；完成/未验证/阻塞如实记录。

## 12. 明确不在本终极目标中假定已完成的能力


| 项目 | 处理方式 |
|---|---|
| 完整AAA开放世界/MMORPG/1000人同屏/全平台原生端 | 作为外部引擎与服务的长期生态，不列当前必须研发规模 |
| 通用可执行脚本/AI任意Shader代码直接执行 | 明确不支持；新增表现必须由受信预设或安全受控扩展承接 |
| 任意第三方资源自动抓取并发布 | 不支持；需来源/许可证/内容审核及运行预算 |
| Real-time LLM 驱动每个NPC逻辑Tick | 非默认；实时行为先用确定性可信组件，LLM仅在创作/对话外部服务经权限/成本管理使用 |
| 完整对外模型API/云多租户/收费部署 | 既有方向保留，但非新增游戏能力的前置条件 |
| 全游戏×全设备×全版本大规模穷举测试 | 不作为交付前提；局部必需回归+目标场景真实试玩，正式发布另按旧Gate审查 |

## 13. 权威来源和更新纪律


- 当前官方源码与执行状态：[A2Game main](https://github.com/oahc09/a2game)、[PROJECT-PLAN.md](https://github.com/oahc09/a2game/blob/main/PROJECT-PLAN.md)、[PROJECT-STATUS.md](https://github.com/oahc09/a2game/blob/main/PROJECT-STATUS.md)。
- 原始目标：[coverage/games.json](https://github.com/oahc09/a2game/blob/main/specs/v0.1/coverage/games.json)、[Coverage Registry说明](https://github.com/oahc09/a2game/blob/main/specs/v0.1/docs/05-Coverage-Registry-V0.1.md)。
- 当前第二阶段：[Game Creation & Delivery](https://github.com/oahc09/a2game/blob/main/docs/A2Game-Game-Creation-Delivery-Phase2.md)、[功能收口台账](https://github.com/oahc09/a2game/blob/main/project/function-closure-work.json)。
- 产业分类参考：[Steam Popular Tags](https://store.steampowered.com/tag/browse/en/)、[Godot Demo Projects](https://github.com/godotengine/godot-demo-projects)。
- 每次新玩法或能力合入：先复用现有实现与ID、说明范围和真实演示；失败材料和历史验收不可覆盖。Skill与真实Agent行为按更新后的源码重新评估，不将旧模型成绩冒充新版本能力。
