# A2Game Runtime Tick / Rule Semantics V0.1

**版本**：`0.1.0-draft.1`。本规范是 A2Game **玩法结果的唯一执行合同**；CocosAirJS/Three.js Adapter 不能自定义另一套规则调度。示例 GameSpec 的字段见 `01-GameSpec-V0.1.md`，能力参数由 `02-Capability-Manifest-V0.1.md` 限定。

## 1. 不变量（MUST）

1. **单一玩法权威**：GameSession 是唯一可修改的游戏状态；渲染、音频、设备等不能直接修改它，只能提交规范化命令或服务提案。
2. **固定步长**：`tickHz = 30/60/120`（内容声明，缺省推荐 60）；`dt = 1/tickHz`；逻辑时间 `t = tickIndex*dt`。`rAF`、物理 substep、动画帧不创建第二业务时钟。
3. **同样输入同样状态**：相同 GameDefinition + Capability 版本 + RNG seed + 输入 Trace + exact 模块，离散逻辑状态和事件排序一致。物理/IMU 原始噪声等 host-defined 结果另见容差合同。
4. **规则无隐式递归**：规则的 `event.emit` 不在同 tick 再触发 Rule，默认延迟到下一逻辑 tick；避免自激活死循环。
5. **写入分阶段并原子发布**：模块和 Rule 通过提案/EffectBuffer 修改暂存状态，只有 Commit 成功才向观察者/Adapter 发布。
6. **游戏终局后不继续执行玩法 tick**：展示层可继续独立 presentation animation，但不改变分数、敌人和计时器。
7. **无不受控脚本**：表达式 AST 是类型化纯函数；规则操作必须来自可信 Capability Registry；规则不得执行任意 JavaScript、网络或 DOM。

## 2. Tick 计数与时间模型

- 新 Session 创建时 `tickIndex=0, flow=ready`；`session.start` 在边界提交后 `playing`，随后第一次 `step()` 执行 tick 0；成功执行后 `tickIndex=1`。
- 固定时钟只在 Session `playing` 时前进。暂停时采集层可接收设备样本用于 UI/权限处理，但不向 gameplay 派发业务动作；按规范 `reset(reason=pause)` 清除 held/press 队列，不合成 release 成功边沿。
- 输入事件含 `timeUs`（Session capture epoch 起单调微秒）和 `seq`，真实采集分配到半开区间 `[tΔ, (t+1)Δ)`；端点上的样本属于**下一 tick**。宿主在区间结束后提交该批输入，可能有一个 Tick 的采样延迟。测试可显式指定 `tickIndex`，绕开宿主采样差异。
- `timer` 以**整数 tick**为内部语义；若 GameSpec 用秒，编译时定义 `ticks = ceil(seconds * tickHz)`（`seconds≥0`）。零延时不得在当前 Rule 阶段递归，最早到下一 tick。`repeat` 每次按原始 dueTick + periodTicks 推进而不是按 wall time 重启。
- Catch-up：宿主帧可处理多个逻辑 tick，但 `maxCatchUpTicks` 仅限制一帧工作量；**不能默默跳过逻辑 tick**以追上墙钟。若 backlog 超阈值，报告 stall/slowdown，可暂停并提供恢复策略。无画面测试通过显式 `step(N)` 推进。
- 非暂停下累计逻辑时间与 UI 进度按 `tickIndex` 计算。渲染插值 `alpha` 只改变 Presentation Snapshot 插值，不反向修改玩法状态。

## 3. 状态分区

- `S_t`：tick t 起始的权威状态快照，包括运行实体、全局 state、Timer Queue、RNG、Flow、输入动作状态。
- `S_sim`：处理本 tick 已接受的输入、Timer、行为和 Physics Proposal 后得到的**规则读取快照**。
- `S_post`：在 `S_sim` 上顺序提交 Rule Effects 后的状态；终局判断基于 `S_post`。
- `S_{t+1}`：终局裁决/计数器更新后原子发布的完整状态。Presentation 只消费此视图。

逻辑、UI、GPU/DOM、外部物理服务状态隔离：UI 数据绑定来自 `S_{t+1}`；设备和物理服务有自身的宿主缓存，但不可覆盖 Logic State 真值。

## 4. 单 Tick 的**规范阶段**

| 阶段 | 名称 | 唯一职责 | 写入/输出 |
|---|---|---|---|
| T0 | BoundaryControl | 处理 start/restart/pause/resume/stop/revision；无 gameplay tick 的控制可单独处理 | 生命周期变化 |
| T1 | InputDrain | 按 `tickIndex`、`timeUs`、`seq` 取得所有输入，包括 down/up 近同时发生 | RawInput batch |
| T2 | RecognizeAction | 归一化、手势/体感识别、选定有效 binding；生成 action transitions | ActionEvents |
| T3 | Timers | 发出本 tick 到期的 timer events，更新下次 dueTick | TimerEvents |
| T4 | ModuleSimulate | 按稳定顺序执行被接受的命令/行为（棋盘、运动、武器、波次），得到提案 | Gameplay proposals |
| T5 | PhysicsResolve | 物理服务处理本 tick 的固定步长及必要 substeps；归一化接触/命中结果 | Physics proposals + Contacts |
| T6 | BuildEventBatch | 收集 T2–T5 + 前 tick 延迟事件，固定规范顺序并封存 | Immutable EventBatch |
| T7 | RuleEvaluate | 对 `S_sim` 每条事件匹配规则、查询、条件；生成有序 EffectBuffer | Effects，只读 `S_sim` |
| T8 | CommitEffects | 在 S_sim 临时副本上逐条执行 effects，验证约束，原子提交 | `S_post` |
| T9 | OutcomeResolve | 依据 S_post 评估 outcomes，确定胜/负/状态，生成观察事件 | `S_{t+1}` |
| T10 | ObservePresent | 输出可观察 snapshot、诊断、逻辑事件；推送 Presentation cues | 只读，完全不改变 gameplay |

**T4 与 T5 的顺序**：规则感知本 tick 的已结算运动/碰撞；T7 所有条件共用 S_sim 的一致快照。若模块属于纯离散棋盘机制，T5 可空跑。Physics 不允许直接在 T10 修改任何 gameplay 值。

**T0 控制与 tick**：在 `paused/won/lost` 状态下可以处理 `restart/resume/stop`，但不会执行 T1–T10。`flow.pause` 由规则在 T8/T9 生效，当前 tick 仍正常结束、下 tick 停止。

## 5. 事件完整排序合同

T6 以以下键稳定排序（升序，除另有注明）：

1. 事件通道等级 `channelRank`：`input=0, timer=1, module=2, contact=3, deferred=4`。
2. 通道内 `producerOrder`：Input 按 `(timeUs,seq)`；Timer 按 `(dueTick,timerId)`；Module 按 `(capabilityId,entityId,localIndex)`；接触事件按 `(min(entityIdA,B),max(entityIdA,B),kind)`，重复触点由 Physics Contract 去重；Deferred 按原入队 `sourceTick,localIndex`。
3. 若仍完全相同，按 `eventId` UTF-8 字节序排序；不允许依赖对象遍历顺序或宿主回调竞速。

T6 输出 `eventIndex = 0..N-1` 及 `tickIndex`。当多个设备输入正好同 `timeUs`，必须用规范化适配器生成的稳定 `seq` 解决；跨独立设备存在同序时以稳定 `sourceId` 再排序。未记录源 ID/顺序的 raw trace 不可声称 exact 可复现。

**重要限制**：如果 Physics Service 提供的接触集合不同，即使 T6 排序稳定，跨求解器也不保证得到相同战斗或物理合成结果；兼容测试应绑定 physics profile 或采用不变量验收。

## 6. 规则匹配、优先级与求值

对于每个 `EventBatch[eventIndex]`：

- 找出 `rule.on` 与其匹配的规则，先按 `priority` **升序**（缺省 0），再按 `rule.id` 的 UTF-8 字节序排序。**数值越小越先执行**；不能把“优先级更大”解释成更早执行。
- `rule.if`（如存在）在 `S_sim` 上执行，含 `event` 只读 payload；同 tick 前一条 rule 的 Effects **不会在下一条 rule 条件中可见**。
- 对匹配规则按声明的 `do[]` 顺序构建 effect proposal；表达式的取值环境固定为 `S_sim` + 当前 Event + 上下文；不在效果提交时重新计算。
- 权限检查：Rule 只能写 Manifest 声明的路径/实体状态，未授权写入报错；数组索引、null、未声明属性、错误类型不会自动创建。
- `Rule` 的匹配/求值无副作用；所有计时器/生成/销毁/计分经 Effects commit。

### 6.1 Effect 提交（冲突与覆盖）

T8 按 `eventIndex → priority → ruleId → effectIndex` 排序并逐条应用到同一个临时副本：

- `state.add(x,+a)` 和后续 `state.add(x,+b)` 累加；每条做整数安全/类型校验。
- `state.set(x,a)` 与 `state.set(x,b)`：后执行的有效 set 决定最终值；Manifest 可声明 `conflictPolicy=reject` 作为更严格的模块规则，但默认是顺序写入。
- `state.set` 与 `state.add` 按**实际 effect 顺序**，不交换/折叠，且 `value` 参数来自各自的 S_sim 求值。
- `entity.spawn` 和 `entity.despawn` 作用于临时实体集合；新实体本 tick 不参与新的 T4/T7 规则；`spawned/despawned` 通知下一 tick（终局时仅进入观察日志）。
- 同 tick 重复 `despawn` 已删除实体，必须有明确预定义语义：默认第二次为幂等 no-op，并报告调试 trace；不能生成两份死亡奖励。
- `event.emit` 在 T8 写入**下一 tick**的 deferred queue，不在当前 T7 再匹配；已终局的会话不会再消费这类 gameplay 事件。
- `feedback.emit` 写 presentation cue，一律不改变逻辑 state 和 RNG。

### 6.2 错误提交语义

有任何一个 effect 非法，则本 tick 不发布部分玩法 state；设置会话 `error`，返回 `A2G_E_TICK_COMMIT`（含 `tick/event/rule/effect/path`）。支持 checkpoint 的 Physics Service 必须回滚到 tick 边界；不支持回滚的服务必须标记 `restart-required` 并隔离本轮服务状态，禁止在损坏状态继续游戏。

不能吞掉报错并继续下一 tick；无声的“不扣血”“少加一分”会破坏游戏可解释性。

## 7. Outcome（胜负条件）与终局裁决

T9 以刚提交的 S_post 评估所有 `outcomes[].when`（全部读取同一快照）。多个同时成立时：按 `priority` **升序**，缺省 0；若同优先级按 `id` UTF-8 字节序，**第一个成立的 outcome 唯一生效**。规范不能默认“获胜总优先于失败”或反之。

终局一次且不可逆；重复 `win` 不会再次发奖励。终局观察事件 `game.won/game.lost` 在本 tick T10 发给外部（不是递归触发同 tick gameplay Rule）；随后游戏逻辑冻结。重开产生全新 SessionGeneration，清除旧生成/接触缓存/逻辑计时器/输入 held。

`GameFlow` 处于 `paused` 时不会评估 outcomes；结束后独立 HUD 动画和音频属于 Presentation，不反写 `S_post`。

## 8. RNG：跨语言的确切合同

V0.1 默认使用非加密 PRNG **xoshiro128\*\***；四个 uint32 状态。确定性仅针对明确的 seed、消费顺序及相同算法版本。用于玩法随机，不应用于安全令牌或作弊防护。

**Seed 展开**（所有运算 uint32 wrap）：给定 `seed` 为 `[0,2^32-1]` 整数；令 `x=seed`；重复 4 次 `x += 0x9E3779B9`，并令 `state[i]=fmix32(x)`：

```text
fmix32(x):
  x ^= x >>> 16
  x  = imul(x, 0x85EBCA6B) mod 2^32
  x ^= x >>> 13
  x  = imul(x, 0xC2B2AE35) mod 2^32
  x ^= x >>> 16
  return uint32(x)
```

若全零状态则置 `state = [1,0,0,0]`。下一数：

```text
result = rotl(uint32(s[1] * 5), 7) * 9 mod 2^32
 t = uint32(s[1] << 9)
 s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]
 s[2] ^= t; s[3] = rotl(s[3], 11)
return result
```

`randf() = (next_u32() >>> 8) / 2^24`，严格区间 `[0,1)`。`randomInt(min,maxInclusive)` 用**拒绝采样**避免取模偏差，采用 `limit = floor(2^32/span)*span`，持续抽取 `u32 < limit`，返回 `min + (u32 % span)`；`span` 必须为正且不超过 `2^32`。

- 每次随机调用有且仅有一次全局有序消费（拒绝采样可消耗多次）；读操作本身不得消耗随机数。
- 若模块需要独立随机流，扩展 Manifest 必须明确如何从 Session seed 派生并单独测试；V0.1 基线仅一个共享流。
- `seed` 和完整 `s[4]` 状态属于 Session Snapshot / Undo / SaveState；恢复必须还原它们，否则未来生成结果偏移。
- 随机数 golden vectors 由 Conformance 样例固定；不得以“同一 seed 的随机分布看起来相似”代替逐项相等。

## 9. 输入离散化与可复现回放

`InputTrace` 包括：`traceVersion, gameRevision, inputNormalizerVersion, gestureRecognizerVersions, tickHz, seed, coordinateProfile, events[]`；每条事件至少记录 `tickIndex, seq, source, kind, payload`；需要精确 Raw 手势测试时额外附 `timeUs`、设备姿态参考系和可用性变化。

- Gameplay Rule 使用 `SemanticAction` 流；输入采样装置不能由自身 deltaTime 直接修改玩家坐标。
- 原始 Pointer/IMU 先经权限与参数检查、标准化，再固定版本识别器；压力/加速度缺失不能填入误导默认值。
- 暂停、焦点丢失、设备断开时复位 active source；是否发送 `cancel` 由输入来源策略决定，不能合成“按键 release 成功”。
- 如果游戏要求 IMU 但宿主不可用，装载/运行可按 GameSpec 明确的 fallback 选择 touch / keyboard；回退切换发生在 tick 边界，并记录 Event Trace 以用于复现。
- 测试脚本直接 `injectAction` 是**Headless 语义注入**，不能替代真实触点 hit-test、手势识别和 IMU 权限测试。

## 10. 查询、实体与运动规则

- `Query` 在 T7 基于 S_sim 评估，结果按稳定实体 ID 字节序排序（若模块另提供距离排序，则先距离、后实体 ID）；遍历顺序不能由 JS 对象插入顺序决定。
- Entity 运行 ID 全 Session 唯一；`tag` 过滤是对当前阶段稳定快照的查询，不读 Host Scene Graph。
- `Grid` 是逻辑占用网格；所有多格移动/交换/合并需先验证约束，再以一次模块事务提交，不得先移动一半再发现非法。
- `Physics` 包括算法 profile、积分步长、substeps、碰撞类别/层、触发/接触语义；`contact.begin/stay/end` 必须经去重/排序/过滤。不同 PhysX/Box2D/Rapier 数值不由同一 JSON 保证完全一致。
- `Weapon`、`Damage` 等模块禁止隐式重复命中：攻击实例 ID + 目标逻辑 ID + 命中窗口共同确定一次命中；多碰撞体归一化到所属逻辑实体；无敌时间同样按 tick 推进。

## 11. 性能与安全预算

建议 Base Profile 的**保证下限**：至少 1,000 活跃实体、4,096 事件/tick、4,096 effects/tick、64 层 AST 深度、每帧最多 5 个 catch-up ticks；这些值是**拟议的兼容度下限，不是性能实测**。播放器可声明更高限额，但不得低于通过认证的 Profile 要求。

预算耗尽产生 `A2G_E_BUDGET_EXCEEDED` 并按错误提交策略隔离本 tick；不能静默丢弃关键碰撞或计分事件。对于高数量子弹使用对象池/批处理，优化不得改变事件和逻辑行为。

## 12. 快照、Hash 与诊断

- `snapshot()` 记录所有影响后续逻辑的状态和独立模拟服务的可恢复状态；不记录音频缓冲、GPU 资源和 DOM 元素。
- **核心 exact 状态哈希**：只投影 `global state`、实体离散状态、RNG uint32、Timer Queue、逻辑 tick、flow、spawn 计数、待处理 deferred events（含稳定排序），不含 Host runtime 句柄、时间戳、Renderer cache、host-defined 连续物理浮点值；通过明确的键排序与 RFC 8785 JCS 标准化，再 SHA-256 计算。含容差字段使用数值断言而非强行纳入 exactHash。
- `observation` 至少有 `tickIndex/flow/state/entities/events/diagnostics/exactHash?`；`exactHash` 只有被认证的 exact 投影完整时才能声明，否则标记 unavailable 并给原因。
- 错误结构：`{code, severity, phase, tickIndex, jsonPointer?, ruleId?, entityId?, capabilityId?, message}`。Agent 可用这些诊断修复 JSON，不需要猜控制台文字。

## 13. 分步反例（禁止回归）

**示例 A：快速点击**。tick 0 发生 `press, release, press, release`，T2 必须生成两个独立 press edge，监听 `input.action` 的规则可被触发两次，不能因为 tick 结束按键没按住而丢失。

**示例 B：分数达到目标**。T7 两条收集规则（或两个事件）读取 S_sim.score=0，分别提案 `state.add(1)`；T8 得到 2；T9 使用 S_post.score=2 判胜（**不能**使用 S_sim.score=0 判失败）。

**示例 C：规则竞争**。两个 rule 对同一字段 `state.set`，即使条件读取同一 S_sim，T8 的最终值由 `(eventIndex, priority, ruleId, effectIndex)` 确定；若模块显式 `conflictPolicy=reject` 则应该报受控冲突，而不是随机取值。

**示例 D：事件自激活**。Rule 1 收到 `A`，发出 `B`；规则 2 收到 `B` 发出 `A`。任一逻辑 tick 内 Rule 只执行本 tick 已封存 EventBatch；发出的事件排入下一 tick。即使跨 tick 循环，也有会话级预算与受控停止机制。

**示例 E：暂停**。tick 5 暂停后推进 host frame 100 次，`tickIndex` 仍为 5，Timer/武器 cooldown 不减少；resume 后从 tick 5 继续，不能补算暂停期间 100 帧的 gameplay。

## 14. 运行一致性 Gate

- exact 原语：逐 tick 比对 event log、离散状态与 RNG、terminal outcome、snapshot hash。
- input：含 cancel、同 tick 快速按放、多点 pointer capture、IMU 归一化录制回放与无设备 fallback。
- physics：同算法 profile 要按其明确合同；不同后端只比较语义不变量 + 容差、报告条件，不做无依据 bit-exact 声称。
- lifecycle：start/pause/resume/restart/stop、定义修订 CAS、dispose、回滚失败路径必须实际测试。
- error：未知字段/引用/Manifest/超预算/非法状态/资源拒绝都有稳定 code + JSON Pointer。

**所有 PASS 需要真实运行日志和可复现测试，不是仅靠本设计文本。**
