# A2Game Game Coverage Registry V0.1（扩展附件）

**状态**：32 个拟议验证样例，不代表完成开发或通过测试。CoverageRegistry 用于评估协议是否能组合出更多小游戏，避免因为只支持既有样例而把具体游戏写死进 Core。

## 1. 32 个代表玩法覆盖矩阵

| ID | 参考玩法 | 运行模型 | 必需逻辑机制（缩写） | 关键测试 | 输入 Profile |
|---|---|---|---|---|---|
| G01 | 推箱子 | 离散 | Grid/Occupancy/Push/Goal/Undo | 非法推动原子回滚 | Swipe/Key |
| G02 | 2048 | 离散 | Slide/Merge/RNG/Spawn/Undo | 多合并只合一次、随机回滚 | Swipe/Key |
| G03 | 三消 | 离散+阶段动画 | Swap/MatchN/Cascade/GravityFill | 交换验证/连锁顺序 | Drag |
| G04 | 堆叠三消（羊类） | 离散 | LayeredStack/Tray/Capacity/MatchN | 被遮挡不可选、槽满失败 | Tap |
| G05 | 麻将叠牌配对 | 离散 | Occlusion/Selectable/PairMatch | 遮挡规则、移除次序 | Tap |
| G06 | 箭头迷宫消除 | 离散 | Direction/Occupancy/Remove/Goal | 射线阻挡、方向路径 | Tap |
| G07 | 翻牌配对 | 离散+计时 | Reveal/PairMatch/Timer | 快速点击和延时翻回 | Tap |
| G08 | Block Puzzle | 离散 | Polyomino/Placement/LineClear | 多格放置校验 | Drag |
| G09 | 俄罗斯方块 | 混合 | Polyomino/RotatePiece/Gravity/LineClear | 旋转/锁定/消行 | Tap/Key |
| G10 | 找物整理 | 离散 | Select/Drag/Placement/Goal | 错误放置与完成目标 | Touch |
| G11 | 跳一跳 | 实时 | Hold/Charge/Jump/Landing/Combo | 按压时长→跃距 | Hold |
| G12 | Flappy 类 | 实时 | Tap/Velocity/TriggerZone/Score | 重复碰撞计分去重 | Tap |
| G13 | 换道跑酷 | 实时 | LaneMove/AutoScroll/Spawner/Checkpoint | 障碍与暂停恢复 | Swipe |
| G14 | 打砖块 | 实时物理 | Collider/Bounce/Health/LevelFlow | 碰撞反弹/漏检 | Touch/Key |
| G15 | 弹球 | 实时物理 | RigidBody/Constraint/Trigger | 物理不变量 | Touch |
| G16 | 物理合成 | 混合物理 | RigidBody/Contact/Merge/Spawn | 重复接触不重复合并 | Drag |
| G17 | 纵版飞机 | 实时战斗 | Axis2D/Weapon/Projectile/Wave | 子弹回收和武器节奏 | Touch/Key |
| G18 | 俯视射击 | 实时战斗 | Aim/Health/Targeting/Damage | 移动瞄准分离 | TwinStick/Touch |
| G19 | 僵尸生存 | 实时战斗 | AutoTarget/Horde/Upgrade/Skill | 自动索敌确定顺序 | Touch |
| G20 | 泡泡龙/弹射 | 混合物理 | Aim/Trajectory/Bounce/ConnectedMatch | 轨迹和接触消除 | Drag |
| G21 | 塔防 | 实时战斗+经济 | Placement/PathFollow/Weapon/Wave/Resource | 路径/发射/结算 | Tap |
| G22 | 农场 | 计时经营 | Production/Timer/Collect/Inventory | 收获计时与保存 | Tap |
| G23 | 合成经营 | 混合 | Merge/Production/EconomyLoop/Unlock | 合成后生产链 | Drag |
| G24 | 五子棋/棋类 | 回合 | Board/Turn/LegalMove/Goal | 非法落子、轮流/终局 | Tap |
| G25 | 水果切割 | 轨迹实时 | TouchPath/Intersection/Score | 低采样/高频轨迹 | TouchPath |
| G26 | 双指旋转拼图 | 触摸+离散 | MultiTouch/Pinch/Rotate/Placement | 稳定触点归属 | MultiTouch |
| G27 | 重力迷宫 | IMU+物理 | IMUTilt/Collision/Goal | 校准、权限和桌面替代 | IMU或Drag |
| G28 | 平衡堆叠 | IMU+离散 | IMUTilt/Tap/Balance/Placement | IMU+Touch 并发输入 | IMU+Tap |
| G29 | 摇一摇机关 | IMU+离散 | IMUShake/Timer/Unlock | 去抖、失联、回退 | IMU或Tap |
| G30 | 弹弓打靶 | 触摸物理 | Drag/Charge/Projectile/Hit | 弹射力度与释放一致 | Drag |
| G31 | 姿态打靶 | IMU+战斗 | Orientation/Aim/Hitscan/Score | 屏幕方向变化和姿态零点 | IMU+Tap |
| G32 | 多指机关 | 多点离散 | MultiHold/Timer/Trigger/Goal | cancel 后不算成功 | MultiTouch |

候选表提供归类和主测试意图，不替代能力定义及具体关卡验收；`G24` 是接口验证，未约定完整象棋/斗地主规则实现。未来可以新增 `G33+` 而不改变已冻结 `G01..G32` 的身份。

## 2. 跨类型组合验收（另立 ID，不偷换 32 计数）

| ID | 玩法组合 | 检查的问题 |
|---|---|---|
| H01 | 合成炮台保卫战（Merge+TowerDefense） | 实体替换/旧武器引用/经济与实时更新冲突 |
| H02 | 三消+角色升级 | 规则状态与战斗技能的跨域协作 |
| H03 | 跑酷+射击 | 触摸移动与开火输入并发、不重复消费 |
| H04 | 物理合成+IMU 倾斜 | 独立物理服务与体感控制、位置同步 |
| H05 | 找物+限时关卡 | 资源加载、hit test、游戏时间与 HUD 同步 |

Hxx 必须有独立 GameSpec/Conformance；样例数和通过率分别统计，不把组合场景误作为 Gxx 基础样例。

## 3. 扩展字段设计

`GameCoverageManifest` 结构示范：

```json
{
  "id": "g27-tilt-maze",
  "version": "0.1.0",
  "name": "重力迷宫",
  "taxonomy": {"genres": ["puzzle", "casual"], "mechanics": ["tilt", "collision", "goal"]},
  "executionModels": ["realtime"],
  "dimensions": ["2d", "3d"],
  "requiredCapabilities": {
    "all": [{"id":"a2game.core.state", "version":"0.1.0"}],
    "anyOf": [[
      {"id":"a2game.input.imu.tilt", "version":"0.1.0"},
      {"id":"a2game.input.touch.drag", "version":"0.1.0"}
    ]]
  },
  "optionalCapabilities": [],
  "testSuites": ["tilt-maze-rules", "tilt-maze-input"],
  "profiles": ["headless", "mobile-web", "desktop-web"],
  "extensions": {}
}
```

唯一 ID / version / taxonomy / requiredCapabilities / testSuites 是主要扩展钩子。`sourceLinks` 可记录榜单、开源参考、视频/截图；**来源不能替代验收条件**。`extensions` 必须有 Schema 注册，未知必需扩展拒绝，未知非必需记录但不执行。

**实现注意**：`samples/coverage/games.json` 的 `requiredCapabilities.all` 已显式包括每个候选玩法的机制能力 ID，而不只是 Core + Input。`taxonomy.mechanics` 仅供分类和检索；不能代替能力依赖或被用于自动声称可运行。对需要双指或 IMU+Tap 并行的内容，相关输入列入 `all`；允许 IMU→Touch 降级的内容通过 `anyOf` 明确列出替代。当前绝大多数依赖能力只有候选 ID、尚没有实现，因此 32 条依旧全部 planned。

`testSuites` 中 `COVERAGE-Gxx` 是**待实现的测试套件标识**，不是已交付的实际 test 文件；只有 `samples/tests/*.conformance.json` 中存在的套件具有机器可读的结构样例。未来补齐时必须提供用例、数据与运行回执。

## 4. 覆盖计算与基线冻结

- 目标分母来自冻结的 CoverageRegistry commit/digest；新加入游戏必须形成新版本分母，而不是偷偷修改旧历史报告。
- `Game Verified Coverage` 只能纳入完成 G0/G1 和目标 G2/G3 的游戏，按目标 HostProfile 分开；G01..G32 目前全部为 `NOT_RUN`。
- 要报告“具备某玩法生成能力”，需要：该玩法最少一个 GameSpec + 正向/负向逻辑测试 + 重开与生命周期 + 用户操作到游戏结果的 E2E + 至少一次 Agent 规则变体测试。
- `documented-only`、`planned`、`BLOCKED` 明确列出，不能计入 verified；指标详见 `04-Conformance-Test-V0.1.md`。

## 5. 后续游戏/设备/引擎加入流程

1. 以 `Gxx` / `Hxx` 或新 namespace 登记游戏类型、机制、输入和参考来源。
2. 将期望用到的每个能力 ID 解析到 Manifest；缺失机制成为独立 capability proposal，而不是在 GameSpec 加特殊游戏字段。
3. 为新能力定义算法、状态、命令/事件、时序、作用域、性能预算和测试向量。
4. 更新 Capability/Adapter Registry；若新输入设备，补 Source Adapter 和 Trace 格式，不触碰 Rule Core。
5. 用同一 GameSpec 跑 Headless 和目标 Host Adapter，再更新 CoverageResult。
6. 记录 Schema/协议版本兼容与迁移，不因新增项目改变旧内容含义。

**当前状态**：覆盖模型和 32 候选完成设计；尚未对 32 玩法生成完整 GameSpec、完成算法实现或运行验收。

## 2026-10-27 实施记录：P2 验收归档

当前候选/能力和真实 SDK 参考实现状态以 `project/status.json` 为准，上述初始设计状态保留为历史。宿主工具 `scripts/final-acceptance.mjs` 将 37 款的参考证据归集为独立档案，并生成 74 份按 Adapter/Profile 区分的正式待验 CoverageResult。此宿主档案 v1 不改变协议 0.1.0、冻结 32+5 分母或既有 GameSpec；缺少人工质量/独立 G3/适用真机时保持 NOT_RUN，登记检查不得自动升级 verified。详见根目录 `docs/final-acceptance.md`。
