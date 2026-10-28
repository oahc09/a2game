# A2Game GameSpec V0.1

**版本**：`0.1.0`（初始包标记 `0.1.0-draft.1`） · **状态**：现行协议；共享 Headless Runtime 与双 SDK Adapter 已实现，MUST/SHOULD/MAY 条款由 Schema、语义检查与 Conformance 强制（状态更新 2026-10-28，见 [README](../README.md)）。

## 1. 目标、非目标与术语

**目标**：AI 按能力目录生成规范化 JSON，单份内容可由 Headless Runtime、CocosAirJS、Three.js 适配器装载，在约定相同的逻辑/物理服务下执行相同玩法结果。V0.1 的设计覆盖益智、休闲、实时射击、塔防、合成和轻经营；未来棋牌、RPG、联机、AR/传感器扩展不更改 Core 基本形状。

**不是**：Cocos 序列化数据、Three.js `Object3D.toJSON`、通用编程语言、任意 TS/JS 解释器、可替代素材生成器的格式。不能把任意已有 TS 代码无损转成 JSON；新行为通过已审核能力注册。

定义：
- `GameDefinition`：静态、可版本化的游戏内容，解析后不可被实时规则直接改变；`revision` 是创作版本。
- `GameSession`：某一次运行的状态、时钟、随机状态、延时事件/计时器及生命周期；与 Definition 不同。
- `Capability`：注册表中具备 Schema、命令、事件、状态和执行语义的能力。
- `Host`：呈现/设备/资源环境；CocosAirJS/Three.js 属于 Host Adapter，不拥有玩法权威状态。
- `Logical Tick`：共享 Runtime 的离散时钟步，不等于浏览器 `requestAnimationFrame` 或物理引擎内部 substep。

使用 MUST/MUST NOT/SHOULD/MAY 区分规范强度。`0.1.0` 是拟议协议的具体版本；文本状态 `draft.1` 不构成已发布兼容承诺。

## 2. 文档结构（规范）

`format = "a2game"`、`specVersion`、`id`、`revision`、`meta`、`requires`、`world`、`scenes`、`entryScene`、`state`、`inputs`、`rules`、`outcomes`、`presentation` 为必需字段（允许空对象或空数组的字段详见 Schema）；其余为可选。未知顶级字段 MUST 拒绝（`A2G_E_UNKNOWN_FIELD`）；扩展写入 `extensions` 并声明提供者。

| 属性 | 类型与说明 | 关键约束 |
|---|---|---|
| `format` / `specVersion` | 固定 `a2game` / `0.1.0` | 不支持版本报 `A2G_E_SPEC_VERSION`；不得静默降级 |
| `id` / `revision` | 稳定内容标识 / 正整数修订号 | 标识跨改名稳定，修订号严格递增 |
| `meta` | 标题、描述、作者、`genres`、说明 | 分类**不影响运行语义**，分类表开放注册 |
| `requires` | `{all:[CapabilityRef], anyOf:[[CapabilityRef,...],...]}` | 所有 `all` 必须满足；每组 `anyOf` 至少一个满足；空组拒绝 |
| `world` | `dimension`、`coordinateSystem`、`units`、`clock` | V0.1：`2d/3d`、右手 Y 轴向上、米；逻辑 `tickHz` 推荐 60，可为 30/60/120 |
| `assets` | 资源逻辑 ID → `uri/type/integrity?` | 不允许 `javascript:` 或任意远程下载；受宿主白名单约束 |
| `prototypes` | 对象原型字典 | 静态定义；实例化继承后按实例 override，不能覆盖 capability ID |
| `scenes` / `entryScene` | 场景数组 / 入口 ID | 场景 ID 唯一；初始仅一活动场景，切换需释放旧对象 |
| `state` | 全局命名状态字段：`type, initial, constraints?` | 运行时 `state` 值属于 Session，不写回 Definition |
| `inputs` | 语义动作定义与设备绑定 | `source` 用能力 ID/注册源别名，不能引用原生 DOM 回调 |
| `rules` | `id/priority/on/if/do` 数组 | `on` 使用事件类型，`if` 是受限 AST，`do` 为已注册操作 |
| `outcomes` | 终局条件数组 | 仅在 `S_post` 评估，按 `priority`→`id` 确定首个结果 |
| `presentation` | HUD、画面绑定与特效提示 | 只观察逻辑状态，不具备修改玩法状态的隐式权限 |
| `tests` | 相对路径测试文件引用 | 测试不是游戏逻辑；禁止带绝对文件路径 |
| `extensions` | URI/命名空间映射扩展数据 | 必须与 Capability Manifest 的 extension Schema 匹配 |

### 2.1 引用与标识

- `Game.id` 建议反向域名，如 `org.a2game.samples.tap-target`；实体、场景、原型、规则使用稳定、大小写敏感 ID。禁止重复或保留前缀 `_a2game`。
- 外部引用一律通过资源逻辑 ID、实体 ID、能力 ID 或 `sceneId`，不能通过原生 Node/Object3D 内存句柄。
- 全局状态路径使用 RFC 6901 风格 JSON Pointer，例如 `/score`；默认只读已声明字段；数组/对象索引的特殊写入由对应能力提供。
- 稳态路径 `/state`、`/entities` 与 `/flow` 是测试观察协议的固定根；声明期的 `state` 字段定义和运行时 `/state` 数据不是同一个对象。
- 初始实体 ID 与动态生成 ID 分域；动态 ID 由 Runtime 以 `spawn:<prototype>:<tick>:<counter>` 生成（计数在 Session 内单调递增），不得由宿主图形 API 决定。

### 2.2 世界空间、坐标与数值

- 世界空间右手系、`+X` 向右、`+Y` 向上、2D 位于 XY 平面，3D 前方为 `-Z`；线性单位米、角度弧度。
- UI 使用布局坐标；Raw Pointer 使用 Viewport 归一化坐标，原点左上、`u` 向右、`v` 向下，范围 `[0,1]`。两者到世界空间的映射由 Adapter + Camera Contract 提供；不得直接将 screen pixel 当作 world meter。
- `int` 是 `[-(2^53-1), 2^53-1]` 内安全整数；`number` 是有限 IEEE-754 binary64。拒绝 NaN/Infinity、非法类型、溢出到无穷。
- `bool/string/int/number/vec2/vec3/enum/entityRef/array/object` 可由状态 Schema 声明。Core 精确一致性优先覆盖整数、布尔、标识和离散结构；浮点与物理使用显式容差契约。
- 渲染色值建议统一为 sRGB hex/RGBA，线性光照和 HDR 效果由适配器实现，详情进入渲染能力扩展规范。

## 3. 场景、实体与机制

一个 `scene` 声明 `{id, entities:[...]}`；实体形状：`{id, prototype?, tags?, state?, transform?, components?}`。`transform` 可由物理模块拥有写权，禁止渲染节点直接改写玩法 transform。

`prototype` 是对象模板，不是“完整游戏模板”；它声明默认状态、标签与模块。`components[]` 为 `{capability, config}`，其 `config` 由匹配 Manifest 的 `configSchema` 校验。逻辑组件（`merge`、`weapon`、`inventory`）运行在 Shared Runtime；表现组件（`sprite`、`mesh`、`material`）只更新适配器视图。

多个运行实体**允许复用原型定义**，但拥有独立实例状态。含可变对象的 `initial` MUST 深拷贝；渲染组件的本地缓存不得进入 GameSession 的可哈希状态。

## 4. 输入与游戏动作

### 4.1 分层（正式合同）

`Device Source → Normalized Sample → Gesture/Motion Recognizer → Semantic Action → Rule/Module`。输入设备接口不属于 GameSpec 的场景节点。游戏只订阅语义动作（`select`, `move`, `aim`, `fire`, `drag`, `steer`）。

原始输入来源：`pointer`（鼠标/触摸/笔，支持多触点）、键盘、手柄（未来）、IMU（加速度/角速度/姿态）；受权限与设备能力约束。`touch.tap` 等识别器运行在可版本化 Input Capabilities 中。

### 4.2 行为和边沿

动作值类型：`button | axis1 | vec2 | vec3 | pose`。`button` 使用 `press/hold/release/cancel`，`press→release→press` 即使落在同一 tick 也必须保留完整有序事件，不能合并为单个 bool。

- `cancel` 不等于 `release`：不执行“释放成功”“投射物发射”等效果。
- `pointerId` 在一次接触生命周期内稳定；`capture` 后 HUD 与游戏区不可重复消费同一触点。
- `first-ready` 输入优先级仅在设备来源变更或失效时重新选择；替代输入需明确定义于 `bindings`，不能暗中合成触摸/IMU。
- 输入异步请求权限，只允许显式用户激活；拒绝后须发 `A2G_INPUT_PERMISSION_DENIED`，然后根据声明的替代方案处理。
- IMU 适配器明确设备参考系、屏幕方向、角速度 `rad/s`、线性加速度 `m/s²`、零点校准和缺采样状态；`absolute=false` 的相对姿态不得冒充罗盘绝对方向。
- 录制（`InputTrace`）默认关闭且需用户授权；记录标准化样本、时间、版本、设备可用性，不默认上传个人轨迹。

### 4.3 示例：倾斜迷宫的输入回退

```json
{
  "actions": [{
    "id": "steer", "valueType": "vec2", "policy": "first-ready",
    "bindings": [
      {"source": "imu.tilt", "config": {"deadZoneDegrees": 4, "maxAngleDegrees": 25}},
      {"source": "touch.drag", "config": {"region": "playfield"}},
      {"source": "keyboard.axis2d", "config": {"positiveX": "KeyD", "negativeX": "KeyA"}}
    ]
  }]
}
```

这个块只是 `inputs` 的内容；对应 `requires` 至少包含三者中一个可接受能力，并在启动时进行可用性/权限检测。高频感知输入不是跨设备数值相同的保证；测试用标准 InputTrace 重放归一化结果。

## 5. Rule AST（受限语言）

`on` 为 `{type:"input.action",action:"collect",edge:"press"}` 或 `{type:"timer.elapsed", ...}`、`{type:"collision.begin",...}`、`{type:"entity.spawned",...}` 等具备事件 Schema 的订阅条件。事件源筛选、标签筛选也写在 `on`，**不能写任意代码**。

表达式 AST：

```json
{"op": "gte", "args": [{"state": "/score"}, {"state": "/goal"}]}
```

- 叶子：`{"const": VALUE}`、`{"state":"/path"}`、`{"event":"/path"}`、`{"entityState":{"entity":"id","path":"/hp"}}`。
- 基础操作：`eq/ne/lt/lte/gt/gte/and/or/not/add/sub/mul/div/min/max/clamp`，类型和元数由 Expression Manifest 明确；`and/or` 左到右短路；无隐式字符串转数字。
- 除数为零、无效路径、非有限结果 MUST 返回带路径诊断，不得无声变成 0；逻辑异常触发失败策略而不是无限循环。
- 规则 `do[]` 为白名单操作：`state.set/state.add/state.clamp/entity.spawn/entity.despawn/entity.state.set/event.emit/flow.pause/feedback.emit` 等；完整名单来自 Catalog，禁止 `eval` / `Function` / 任意 URL 调用。
- `state.add` 仅适用 number/int；类型和范围在提交时检查。`feedback.emit` 不改变 gameplay state。

## 6. 运行时消息（Definition 与 Session 解耦）

不强制网络协议，仅定义 JSON 消息语义：

| `type` | 目的 | 行为 |
|---|---|---|
| `definition.load` | 加载 GameDefinition | 静态与语义验证成功后建新 Session |
| `definition.patch` | 修改定义 | `baseRevision` CAS；先完整校验，成功则按声明策略提交 |
| `session.command` | pause/resume/restart/stop | 排队到 tick 边界处理，暂停期间不推进游戏时钟 |
| `input.inject` | 注入已归一化动作 |仅可信测试工具或玩家采集适配器可用，按 tick 排序 |
| `session.observe` | 读取状态/事件/诊断 | 不允许隐式改写 Session |
| `capabilities.report` | 播放器声明能力与缺失项 | 绑定 Manifest 版本和 Host 环境 |

`definition.patch` 必须分三类处理：`presentation-safe`（帧边界提交）、`runtime-configurable`（逻辑 tick 边界）、`restart-required`（待下局/重开或迁移器）。修改物理后端、状态 Schema 和规则依赖时默认 `restart-required`；禁止热替换时残留旧的实体句柄和监听。

## 7. Session / 存档 / 重开

Session 状态含：`definitionId/revision`、活动场景、`tickIndex`、业务状态、实体运行状态、随机数生成器内部状态、计时器、待处理事件、生成计数器、Flow 状态、稳定输入动作状态。输入设备指针、GPU、音频句柄和真实壁钟不属于存档。

`restart` 从 Definition `initial` 重建 Session，保留用户显式选择的非玩法偏好（例如音量），并按同一 seed 复位（如果内容指定种子）；`save/load` 必须记录协议/能力版本并验证迁移兼容。撤销功能若被声明，需保存影响下次计算的 RNG、计时器和延迟队列，不能只恢复网格数字。

`flow.status` 取 `ready|playing|paused|won|lost|stopped|error`。首次 `definition.load` 为 ready；`start` 进入 playing；won/lost 后普通 gameplay ticks 停止，但可按专门的 presentation clock 播放结束表现。销毁后不得更新旧 Session。

## 8. 资源、安全与运行限制

- 远程资源必须受 URL scheme、origin allowlist、MIME 和大小限制；建议带 SHA-256 integrity；配置未声明的网络访问不受支持。
- 用户 JSON 不得携带 JS/WASM 可执行字节、HTML、脚本 URL 或任意内部 Host 调用；增强能力由**可信应用部署**注册，而不是由 JSON 下载运行。
- 加载执行分阶段：`parse → structural validate → refs resolve → capability negotiate → semantic validate → prepare resources → compile plan → create session`；任何失败在创建正式运行会话之前返回结构化错误。
- 限制实体数、事件数、动作数、单 tick 规则执行量和表达式深度；达到限制必须有稳定错误码和有界处理，不能静默丢失决定胜负的 gameplay 事件。
- 诊断包含 `code/severity/jsonPointer/entityId?/capabilityId?/tick?/detail`；JSON Pointer 可直接回给 Agent 修复。

## 9. 最小完整 GameSpec

见 [`../samples/games/tap-target.game.json`](../samples/games/tap-target.game.json)：一个点击计分至 2 分结束的无资源小游戏，展示 `Input → Rule → State → Outcome → HUD` 闭环。格式需由 `schemas/game.schema.json` 静态校验，行为由 `samples/tests/tap-target.conformance.json` 给出预期；不宣称播放器已实现。

## 10. 未来扩展兼容规则

- Core 必需字段结构不因添加新游戏类目而修改；类别来自独立 `taxonomy` 注册表，未注册类别可以展示为其他但不改变逻辑。
- 所有扩展采用 `namespace + semver + manifest + conformance`；既有字段含义不随补丁版本改变。
- 若运行时未知**必需**能力：装载失败；未知**可选**表现能力：仅在内容声明降级策略时降级，且报告有效能力集合；未知规则操作必须装载失败。
- 支持新输入硬件、棋类、RPG、网络或 AR 时新增 Capability 和 Service Profile，维持实体/状态/事件/规则核心。
- 未来协议版本变更使用显示的迁移工具，不允许改变 `specVersion` 却悄悄运行旧定义。

## 11. 验收合同

1. 同一 Definition 在 Headless 和两种 Adapter 下拥有相同合法 ID、类型和能力解析结果。
2. 相同规范化动作序列与 exact 逻辑模块下，得到相同事件顺序、离散状态和终局。
3. 任意未知能力/字段、资源越权、无效引用、无限效果级联必须拒绝或受控报错。
4. 增加一种新游戏类别、输入设备或表现组件，不要求修改 GameSpec 根结构。
5. 完成至少一个实际可玩的端到端实例后，才能称为 GameSpec Implementation PASS。

**相关规范**：`02-Capability-Manifest-V0.1.md`（能力）、`03-Runtime-Tick-Rule-Semantics-V0.1.md`（执行）、`04-Conformance-Test-V0.1.md`（测试）。

## 2026-10-27 显式兼容增量

outcomes[].status 除 won/lost 外允许已有的 stopped，用于不指定胜负的中立结束。T9 提交后发 game.stopped 并冻结 gameplay；普通输入、start/resume 被拒绝，只能重开或销毁。游戏保留 winner/draw 等业务字段区分原因；不新增 draw GameStatus。旧 JSON 的裁决和 Hash 不变；旧宿主未更新完整 Schema/Runtime 时必须拒绝这种新定义。
