# A2Game Capability Manifest V0.1

**版本**：`0.1.0-draft.1` · **定位**：AI / Validator / Shared Runtime / Host Adapter 共用的机器可读能力契约。 

## 1. 强制设计原则

1. **Capability ID 不绑定引擎**。`a2game.puzzle.merge` 可以在共享 Runtime 中实现；`a2game.visual.mesh` 是呈现语义，由 CocosAirJS/Three.js Adapter 实现。名称不能含 `cc.Node`、`THREE.Object3D` 等宿主专有类型。
2. **AI 只能引用已注册能力**。`GameSpec.requires` 与实体的 `components[].capability` 在装载阶段解析到 Manifest；失败不得继续执行。
3. **Manifest 描述契约，不提供执行代码**。`id/version` 对应可信宿主部署时注册的实现工厂；从网络接收到的 Manifest JSON 不获得执行权限。
4. **核心玩法的行为逻辑共用**。棋盘、消除、武器、伤害、计时和规则模块运行在 A2Game；渲染与设备在适配器。
5. **每项能力可测试**。最低包含参数 Schema、命令/事件、依赖、可观察状态、时间/副作用语义、清理约定、Conformance 测试引用。
6. **扩展优先于修改旧接口**。新增游戏机制、Touch/IMU 传感器、输出设备、网路能力采用新 ID 或兼容版本。

## 2. 机器可读 Manifest 结构

```json
{
  "format": "a2game-capability",
  "manifestVersion": "0.1.0",
  "id": "a2game.combat.weapon",
  "version": "0.1.0",
  "kind": "behavior",
  "portability": "exact",
  "description": "发射控制器与冷却结算；不负责渲染弹迹",
  "phase": "simulate",
  "dependencies": [{"id": "a2game.core.clock", "version": "0.1.0"}],
  "contract": {
    "configSchema": {"type": "object", "properties": {"rateTicks": {"type": "integer", "minimum": 1}}, "required": ["rateTicks"], "additionalProperties": false},
    "stateSchema": {"type": "object", "properties": {"nextFireTick": {"type": "integer"}}, "required": ["nextFireTick"], "additionalProperties": false},
    "commands": [{"name": "fire", "payloadSchema": {"type": "object"}}],
    "events": [{"name": "weapon.fired", "payloadSchema": {"type": "object"}}],
    "stateWrites": ["component-local"],
    "lifecycle": ["initialize", "tick", "dispose"]
  },
  "testSuites": ["weapon-cooldown-v1"]
}
```

**注**：这是完整字段形状示范，文件仓库中也提供结构 Schema；`weapon` 行为需要独立的详细算法规范和测试，不能仅凭此描述声称已实现。正式模块可以补充细分武器算法的语义参数，不能用自由字符串承载脚本。

### 2.1 字段定义

| 属性 | 类型 | 规则 |
|---|---|---|
| `format` | 常量 | `a2game-capability` |
| `manifestVersion` | semver | Manifest 格式版本，区别于能力自身版本 |
| `id` | 字符串 | `a2game.<domain>.<name>`；外部扩展使用注册命名空间，如 `vendor.example.physics.softbody` |
| `version` | semver | 同一 ID 的行为版本；升级前必须检查兼容性 |
| `kind` | 枚举 | `core / behavior / rule-op / input-source / recognizer / service / presentation` |
| `portability` | 枚举 | `exact / tolerant / host-defined`；不将 `host-defined` 冒充兼容严格数值比较 |
| `description` | 人机可读说明 | 包括前置条件、副作用、典型使用场景 |
| `phase` | 枚举 | `collect / normalize / recognize / simulate / physics / rule / commit / observe / present`，指模块参与的主要阶段，不允许绕过屏障写入 |
| `dependencies` | CapabilityRef 数组 | 传递依赖版本必须闭包完整；循环依赖禁止 |
| `contract.configSchema` | JSON Schema 2020-12 子 Schema | 为模块参数做结构校验；默认必须拒绝未知参数 |
| `contract.stateSchema` | JSON Schema 2020-12 子 Schema | 业务可观察、可快照的内部状态；不含 GPU/DOM 句柄 |
| `contract.commands[]` | `{name,payloadSchema}` | 所有命令具备名称、参数 Schema；定义是否幂等和效果时机 |
| `contract.events[]` | `{name,payloadSchema}` | 事件有效载荷 Schema、何时进入事件队列由语义合同规定 |
| `contract.stateWrites` | 路径/范围列表 | 声明允许修改哪个 Session state slice；超范围写入必须失败 |
| `contract.lifecycle` | 阶段数组 | 初始化、tick、暂停、恢复、重置、销毁钩子；不允许遗漏持有资源的释放 |
| `testSuites` | ID 数组 | 至少一项；无测试能力不得标记 verified |
| `permissions` | 数组，可选 | 如 `motion-sensor`、`audio`、`network`；必须显式授权 |
| `limits` | 对象，可选 | 单 tick 事件上限、实例数量、输入频率；不得超运行时安全基线 |
| `extensions` | 命名空间对象，可选 | 只能被已注册 extension Schema 解释 |

`ConfigSchema` 与 `StateSchema` 不等于引擎组件的序列化 Schema。独立服务 Profile 和 Host Adapter 的注册也受 Manifest 能力约束。

## 3. 能力解析、协商与加载失败

### 3.1 CapabilityRef

使用 `{"id":"a2game.puzzle.merge","version":"0.1.0"}`。V0.1 **采用精确版本引用**，不在 GameSpec 中使用 `^`、`~`、`latest`，确保内容可复现；未来可新增独立解析策略。

装载算法：

1. 校验当前播放器的 `AdapterCapabilityManifest` 与 `RuntimeCapabilityManifest` 是否同协议；取得 `supportedCapabilities` 和 runtime/host 实际可用性。
2. 解析 `requires.all` 和每组 `requires.anyOf`。`all` 全满足；`anyOf` 的每组按作者声明顺序选第一个满足权限/实现/环境的候选。
3. 深度遍历依赖闭包，确认无循环、无版本冲突、实现已受信任注册。
4. 将每个组件、行为、表达式/规则操作解析为白名单的编译后执行对象；验证每项配置和状态初值。
5. 输出 `EffectiveCapabilitySet`、被选中的 fallback、规范版本、运行时 ID、宿主与物理 profile；不允许运行后悄悄改变已选机制。

错误规范：

| 错误码 | 原因 | 行为 |
|---|---|---|
| `A2G_E_CAP_UNKNOWN` | ID 未注册 | 拒绝加载 |
| `A2G_E_CAP_VERSION` | 版本不兼容 | 拒绝加载 |
| `A2G_E_CAP_DEPENDENCY` | 依赖缺失/循环 | 拒绝加载 |
| `A2G_E_CAP_CONFIG` | 配置或状态不符合 Schema | 拒绝加载并指向 JSON Pointer |
| `A2G_E_CAP_NOT_IMPLEMENTED` | Manifest 有，可信执行实现没有 | 拒绝加载 |
| `A2G_E_CAP_PERMISSION` | 必需传感器被拒绝且无回退 | 不启动；提供明确的用户选择 |
| `A2G_E_CAP_PROFILE` | 缺少兼容物理/宿主 Profile | 拒绝或仅在声明语义允许时使用受限替代 |

`EffectiveCapabilitySet` 必须包含实际选择的方案，避免“该设备理论支持 IMU”被混淆为“本次会话已获授权并可用”。

### 3.2 Portability 类型

- `exact`：业务离散状态、事件顺序、整数结果、PRNG 序列等必须相等；额外说明浮点允许/不允许的容差。
- `tolerant`：本算法有量纲清晰的容差上限，譬如路径近似、数值动画；测试必须声明采样点与容差。
- `host-defined`：物理、音频、Shader 等只保证类型、生命周期及明确的语义不变量，如“静态障碍不移动”“子弹命中墙后不穿越”；无未经证明的跨后端绝对误差承诺。

**例外禁止**：纯规则模块不能为了规避失败把 `portability` 随意标成 `host-defined`。

## 4. 目录总览（待实现候选，不是已验证清单）

下面是 **Catalog Candidate Set**。每项需要补齐 Manifest、算法合同和独立测试后才能进入 `verified`。未来类目只增加 Registry 条目，不修改 GameSpec Core Schema。

| 域 | 能力名称（候选 ID 尾缀） | 覆盖目的 |
|---|---|---|
| Core | `entity, state, tags, relation, query, event, rules, clock, timer, rng, spawn, despawn, enable, flow, level, score, goal, inventory-ref, snapshot, restore` | 共享通用状态与执行 |
| Input source | `pointer, keyboard, gamepad, imu.acceleration, imu.gyroscope, imu.orientation` | 设备归一化采集，IMU 需要权限检测 |
| Gesture | `touch.tap, touch.long-press, touch.swipe, touch.drag, touch.pinch, touch.rotate, touch.multi-hold, touch.path, touch.scratch` | 手势识别，动态多触点轨迹 |
| Motion recognition | `imu.tilt, imu.shake, imu.swing, imu.rotation, imu.calibration, imu.filter` | 体感映射，参考系与滤波合同 |
| Puzzle | `grid, occupancy, neighbors, select, swap, slide, push, merge, match-n, connected-match, cascade, gravity-fill, tray, capacity, layered-stack, occlusion, sort, placement, direction, line-clear, polyomino, rotate-piece, reveal, pair-match, undo, move-budget` | 益智/堆叠消除/拼图/数字玩法 |
| RealTime | `velocity, acceleration, follow, seek, patrol, lane-move, jump, charge, landing, boundary, trigger-zone, checkpoint, auto-scroll, spawner, difficulty-curve, rigid-body, collider, contact, bounce, constraint, breakable` | 跑酷/物理/休闲实时玩法 |
| Combat | `health, shield, team, targeting, auto-target, weapon, cooldown, ammo, projectile, hitscan, spread, burst, pierce, homing, explosion, damage, invulnerability, status-effect, knockback, death, drop, wave, horde, boss-phase` | 纵版射击/生存射击/塔防 |
| Strategy | `resource, cost, reward, inventory, production, collect, upgrade, unlock, shop, placement-grid, path, path-follow, tower, range, economy-loop, offline-progress` | 轻经营/塔防/升级 |
| TurnBased | `turn, player-order, action-phase, deck, hand, draw, discard, legal-move, piece-move, capture, hidden-info` | 棋牌扩展接口 |
| Presentation | `sprite, mesh, camera, light, material, animation, particle, trail, screen-shake, ui, text, audio, haptic, feedback` | 引擎 Host Adapter 消费 |

能力的类型边界不意味着所有名字都必须实现成独立类：一个大型模块可以注册多个互不混淆的能力 ID；反过来，一个复杂算法也可以包含多个内部实现，但对 Agent 暴露的 Manifest 必须稳定。

### 4.1 Capability 拆分准则

能独立定义参数、拥有可观察状态、有确定测试向量且能与其他机制组合时，可作为独立能力；完全依赖特定游戏名字、无法抽离的模块不应进入公共核心。比如 `Grid + Merge + Spawn + Goal` 可以构成 2048，不需要 `a2game.game.2048`。`Weapon + Targeting + Wave` 能构成塔防与射击，不应为两个游戏复制一套武器逻辑。

## 5. Touch 契约（设备采集，不等于动作）

Raw Pointer 规范化事件：

```json
{"source":"pointer","phase":"move","pointerId":2,"pointerType":"touch","timeUs":16667,"u":0.48,"v":0.29,"pressure":0.6,"widthNorm":0.018,"heightNorm":0.025,"seq":11}
```

- `phase=down|move|up|cancel`；`pointerId` 仅在当前会话和活跃生命周期内稳定；新接触可重用同一数值但须新 generation。
- `timeUs` 是自 Session input epoch 起单调微秒；`seq` 在同一流内严格递增；禁止以 `Date.now()` 比较 Host 时间跨机器顺序。
- `u,v` 是 Viewport 内归一化值（屏幕外可超出 `[0,1]`，不得静默裁剪轨迹）；屏幕方向变化需要附带坐标配置版本。
- `pressure` 可空（未知），不允许把缺失传感器压力假造为 0。多点 Pinch/Rotate 必须绑定 2 个明确触点。
- `getCoalescedEvents()` 如可用可保留高频轨迹；`predicted` 数据只能用于视觉平滑，**不得作为决定碰撞/得分的权威输入**。
- `cancel` 必须释放 capture 与手势状态，不能触发成功 Drop、Shoot 或完成切割动作。
- 连续 `down→up` 在一个 tick 内必须产生完整 press/release 序列；不能只消费 `held` 最终快照。
- 对所有识别器：Manifest 明确启动阈值、时间窗、移动阈值、优先级、组合是否排斥、事件 payload 和测试 trace。

参考：W3C Pointer Events 3（指针取消、`touch-action`、合并事件）；本规范只定义 A2Game 自己的归一化层，非直接拷贝 Web API。

## 6. IMU 契约（数据精度和可用性分离）

Raw IMU 标准化样本：

```json
{"source":"imu","timeUs":25000,"seq":9,"reference":"device","screenRotationRad":0,"linearAccelerationMps2":[0.1,0.2,0.3],"angularVelocityRadps":[0.0,0.1,0.0],"orientationQuaternion":null,"accuracy":"unknown"}
```

- 单位：线性加速度 `m/s²`，角速度 `rad/s`；姿态 `(x,y,z,w)` 的单位 quaternion，明确相对/绝对坐标系及屏幕旋转。单位转换在采集适配器，不在规则中。
- `IMU` 实际可能缺传感器、浏览器权限、依赖 HTTPS 或受 iframe Permissions Policy 限制。`available` 与 `authorized` 分开，经过用户手势请求权限。
- `Tilt` 是识别器输出，不是原始 IMU 数据；其 deadzone、平滑系数、校准及轴映射在 Manifest/Session 配置冻结。
- 适配器若无样本，按合同发 `unavailable` 或 `stale`，不可复用陈旧姿态伪装新读数。
- 传感器设备、噪声和频率不具备绝对跨浏览器一致性；跨后端测试使用**相同 InputTrace**，检验同一归一化数据能否给出相同动作。
- 记录 IMU / 触摸轨迹有隐私风险；默认禁用录制，明示开启，不默认向 Agent/服务端传原始轨迹。

浏览器资料参考 [MDN DeviceMotionEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent)（原始 `rotationRate` 为度/秒）和 [requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static)（需 transient activation），A2Game 统一为 `rad/s`。

## 7. 模块接口与平台实现的分离

拟议 HostAdapter 接口（仅示意职责，非指定 TS API 最终命名）：

```ts
interface A2GameHostAdapter {
  describeCapabilities(): AdapterCapabilityManifest;
  attachInput(sink: NormalizedInputSink): Disposable;
  prepareAssets(definition: GameDefinition): Promise<AssetLease>;
  present(snapshot: Readonly<PresentationSnapshot>, cues: readonly PresentationCue[]): void;
  pausePresentation(): void;
  release(): Promise<void>;
}

interface A2GameServiceRegistry {
  resolvePhysics(profileId: string): PhysicsService;
  resolveCapability(id: string, exactVersion: string): RegisteredCapability | undefined;
}
```

真实运行时还需声明 Adapter 坐标变换、UI hit-test、资源预算、WebGL/WebGPU、Audio unlock、context loss 恢复策略；**不允许 Host 直接改写逻辑 state**。物理通过 `PhysicsService` 产出可排序的逻辑事件/状态更新，不能把渲染节点的 Transform 当物理权威来源。

Adapter Manifest 记录 `adapterId/adapterVersion/runtimeVersion/platform/capabilities/physicsProfiles/limitations/status`。其中 `status=planned|implemented-unverified|verified`；验证结果应单独存证，不可仅由自报状态认定 PASS。

`SPEC_CONFLICT ADAPTER-STATUS-002`（2026-10-25 修复）：初始静态脚本将所有 Adapter 永久限制为空的 planned 声明，与本节及既有 Schema 的三态合同冲突。当前规则保留 planned 不得自报支持的限制；实现态必须声明已知精确版本的有界能力，verified 必须在 `project/adapter-evidence.json` 关联 PASS 回执，并由 `project:check` 验证当前源码指纹。verified 仅适用于 Manifest limitations 中声明的参考 Profile，不自动提升物理设备或 G3。

## 8. 能力生命周期、热更新和安全

- `register` 发生在加载 GameSpec 前，能力已完成可信实现绑定；加载中的 Session 不可通过内容修改注册表。
- `initialize`：验证 Schema、构造状态、注册监听；`tick`：只能按阶段输出提案；`dispose`：取消所有监听/计时/资源租约；多次 `dispose` 幂等。
- 运行时变更：`mutableConfig` 需显式声明可热改字段；更新经 `definition.patch + baseRevision`，在安全边界提交；否则需要新 Session。
- 限制模块事件风暴、无限循环、过大路径扫描或不安全递归；达到预算产生具名错误，不得直接卡死主线程。
- 扩展能力必须有独立命名空间、owner、许可证声明、测试与审查，不得覆盖 `a2game.*` 官方 ID。

## 9. 静态校验与能力验收

Manifest 必须经 Schema 2020-12 验证，再做语义校验：ID/version 唯一、依赖闭包无环、commands/events 无重名、引用 Schema 可解析、`phase/portability` 相容、实际实现已注册。测试须有：正常参数、非法参数、初始状态、tick 输入/输出、重开、dispose、边界资源/并发事件、Headless/Adapter 兼容矩阵。

`verified` 判定**需要真实执行测试回执**，不能仅以 Manifest 存在、静态 Schema PASS 或 UI 截图替代。

## 10. 交付与验收

- 机器可读的 `CapabilityManifest` JSON Schema。
- Core + Input + Puzzle + Combat + Presentation 的候选 Registry，所有 ID 可追溯到独立模块合同。
- Touch/IMU 输入 Trace、权限/不可用测试向量、坐标与单位转换测试。
- `AdapterCapabilityManifest`：相同 GameSpec 能否运行由能力协商结果决定，未满足则有精确错误。
- 每项 `verified` Capability 至少一套可运行的 Conformance；所有未实现条目保留 `planned`，不得伪造覆盖率。

**依赖**：`01-GameSpec-V0.1.md`；Runtime 顺序见 `03-Runtime-Tick-Rule-Semantics-V0.1.md`。
