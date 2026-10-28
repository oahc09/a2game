# A2Game Conformance Test V0.1

**版本**：`0.1.0-draft.1` · **范围**：解释器、能力模块、设备 Input Adapter、Headless、CocosAirJS/Three.js Host Adapter、Agent 生成流程的可证伪验收合同。

## 1. 目标和验收策略

目标不是“页面出现了东西”，而是保证：

1. AI 输出可被严格校验的 JSON。
2. Headless 执行的输入 → 状态 → 终局符合 Runtime 语义。
3. CocosAirJS 与 Three.js 读取同一 GameSpec（无需重写 gameplay 规则）。
4. 输入触点/IMU、资源、物理、窗口、生命周期变化不会无声改变规则。
5. 新的游戏类型、新输入设备/适配器能通过 Capability 和 Coverage Registry 加入，不更改基本测试协议。

结果状态：`PASS / FAIL / NOT_RUN / BLOCKED / NOT_APPLICABLE`。`NOT_RUN/BLOCKED` 不算 PASS。每次记录 `gameId/gameRevision/specVersion/capabilitySet/runtimeSha/adapterSha/physicsProfile/platform/browser/device/inputProfile/testCaseId/seed/logs/trace/screenshot?`；没有运行证据不得标为 verified。

## 2. Conformance Suite 文件格式

```json
{
  "format": "a2game-conformance",
  "specVersion": "0.1.0",
  "suiteId": "tap-target-core",
  "subject": {"type": "game", "id": "org.a2game.samples.tap-target", "file": "../games/tap-target.game.json"},
  "cases": [
    {
      "id": "two-taps-win",
      "seed": 42,
      "steps": [
        {"op": "start"},
        {"op": "injectAction", "action": "collect", "phase": "press"},
        {"op": "injectAction", "action": "collect", "phase": "release"},
        {"op": "step", "ticks": 1},
        {"op": "assert", "path": "/state/score", "equals": 1},
        {"op": "injectAction", "action": "collect", "phase": "press"},
        {"op": "injectAction", "action": "collect", "phase": "release"},
        {"op": "step", "ticks": 1},
        {"op": "assert", "path": "/flow/status", "equals": "won"}
      ]
    }
  ]
}
```

`case.seed` 覆盖 GameDefinition.world.clock.seed 但不修改原文件；其用于测试运行，回执必须记录覆盖动作。`subject.file` 仅为可信测试工作区的相对路径；不允许逃逸根目录。测试执行器在独立 Session 中运行每个 case，不能跨 case 复用缓存状态。

### 2.1 测试步骤语义（稳定操作表）

| 操作 | 输入 | 规范效果 |
|---|---|---|
| `start` | 无 | ready → playing，不推进 tick |
| `injectAction` | `action,phase,value?,sourceId?` | 将语义动作放入**当前尚未执行 tick**的输入队列；支持 press/hold/release/cancel；不验证真实设备 hit-test |
| `injectRaw` | 原始标准化 Pointer/IMU 样本 + timeUs | 验证 Normalizer/Recognizer；必须声明 trace 的版本/参考系 |
| `step` | `ticks` 正整数 | 连续推进指定 gameplay tick；若 win/lost/paused，余下步数不执行 gameplay，回执含实际已推进数 |
| `assert` | `path, equals / approximately / matches` | 断言观察视图路径；`approximately` 必须定义 absTol/relTol/units |
| `assertEvent` | `eventType, count, sinceTick?` | 在观察事件日志中检查次数、必要 payload/来源 |
| `pause` / `resume` | 无 | 改变生命周期但不自行推进 tick |
| `restart` | `seed?` 可选 | 重新构造 SessionGeneration，恢复初始状态 |
| `snapshot` / `restore` | `id` | 保存/恢复可确定的逻辑快照（如服务不支持 rollback，明确 BLOCKED） |
| `expectError` | `code,path?` | 声明下一个操作或加载阶段应该失败，错误码和路径匹配；无失败则 FAIL |

**强制规范**：测试不能调用实现私有 API（例如 `cc.director` 或 `THREE.Object3D`）来绕过玩法逻辑。物理 exact 测试必须有相同 Physics Service Profile；否则按照服务不变量与容差测试。

### 2.2 推荐的 Conformance Driver 接口（拟议 TypeScript 合同）

```ts
interface A2GameConformanceDriver {
  load(definition: GameDefinition, profile: RuntimeProfile): Promise<LoadReceipt>;
  start(): void;
  injectAction(action: NormalizedAction): void;
  injectRaw(sample: NormalizedInputSample): void;
  step(ticks: number): Promise<{ requested: number; advanced: number; status: GameStatus }>;
  observe(): Readonly<SessionObservation>;
  snapshot(): SnapshotHandle;
  restore(snapshot: SnapshotHandle): void;
  pause(): void;
  resume(): void;
  restart(seed?: number): void;
  dispose(): Promise<void>;
}
```

`load()` 不得在失败时保留半初始化会话；`step()` 对终局/暂停返回实际推进数；`observe()` 为稳定只读快照。测试执行器不得透传 Cocos/Three 私有对象。UI/E2E 适配测试另增加 `captureFrame()` 和真实 Pointer/IMU 注入能力，不要求 Headless 提供 GPU 句柄。

### 2.3 证据回执与 InputTrace 的机器接口

- `schemas/input-trace.schema.json`：定义采集/回放的标准封套，`samples/tests/touch-imu.input-trace.json` 给出含 pointer down/up 和 IMU 的**合成**样例；跨平台复现时必须声明转换/识别器版本。真实采样须经用户授权，不默认持久化。
- `schemas/coverage-result.schema.json`：定义单个 `(gameId,testCaseId,adapterId,platformProfile,capabilitySetDigest,testRevision)` 的测试结果。`status=PASS` 必须带实际 `runId`、`eventTraceUri`；`BLOCKED/NOT_APPLICABLE` 必须带原因；不能只交一张截图。
- `samples/coverage/not-run.receipt.json`：当前无实现、因此明确 `NOT_RUN` 的范例，不能用此示例作为 PASS 证据。
- `samples/tests/negative-fixtures.json`：列出未知字段、无效版本、缺失场景、未知能力、禁止脚本操作、危险资源 URL、错误状态类型的静态负例；结构/引用检查脚本只验证示例子集，生产 Semantic Validator 应覆盖全量字段。

## 3. 四层验证 Gate

| Gate | 范围 | 判定 |
|---|---|---|
| G0 — Static | JSON Parse、Schema、refs、ID、版本、表达式 AST、资源沙箱、能力协商 | 任何未知必需字段/操作、无效依赖都拒绝 |
| G1 — Core/Headless | Tick/Rule、RNG、交互动作、Session、32 候选中可无画面执行的逻辑 | 预期离散状态、事件序、终局完全吻合 |
| G2 — Adapter | CocosAirJS/Three.js/浏览器/移动设备、渲染、hit-test、音频、Touch/IMU、生命周期 | 按能力 Profile 实际 PASS；同份 GameSpec，无 gameplay 分叉 |
| G3 — Gameplay/Agent | 玩法完成度、难度、可完成性、可玩时间、AI 生成成功率 | 有独立量化基准；不能用 G1 替代可玩性验收 |

G0 PASS 绝不等于 G1 PASS。任何未跑的 G2/G3 不能计作完成。报告按**逻辑失败 / 引擎失败 / 适配器失败 / INFRA 失败 / 策略拒绝**分别记录；只有复现和诊断证据充分，才能进行归因。

## 4. 必需测试集合（Test Taxonomy）

### C-CORE

- `CORE-001`：最小 GameSpec 解析，未知字段/非法版本/重复 ID 拒绝并给 JSON Pointer。
- `CORE-002`：创建状态深拷贝，游戏间不串状态；非法写入/越界状态拒绝。
- `CORE-003`：相同 S_sim 的两条 `state.add` 顺序提交，终局基于 S_post；精确断言。
- `CORE-004`：相同 tick `press/release/press/release` 两次计数，顺序不丢。
- `CORE-005`：规则排序 `eventIndex→priority↑→ruleId↑→effectIndex`，竞争 set 的末写语义。
- `CORE-006`：规则 emit 的事件下一 tick 才触发；循环超限受控停机。
- `CORE-007`：暂停 100 host frame 不推进 tick、计时器、cooldown；恢复继续。
- `CORE-008`：终局 win/lose 同时成立，按 `priority↑, id↑` 唯一选择；得分不重复结算。
- `CORE-009`：snapshot/restore 包含 RNG 和 deferred queue；重开清理 SessionGeneration。
- `CORE-010`：实体 spawn/destroy 状态与逻辑 ID、重复销毁、下 tick 事件归属。
- `CORE-011`：资源访问白名单、非法 URL、CPU/内存/事件预算达到阈值时可控错误。
- `CORE-012`：所有声明过的 state / rules / inputs / outcomes 可通过 Schema + semantic validator，错误可定位。

### C-RNG（固定黄金向量）

定义 xoshiro128** + `fmix32` 按 Runtime 文档：

| Seed | 初始 state[0..3]（uint32） | 前 6 个 `next_u32()` |
|---|---|---|
| 0 | `[2462723854,1020716019,454327756,1275600319]` | `[3809008728,1133695204,53579671,2891528803,139681546,2203266335]` |
| 42 | `[939911724,3948730756,321366731,3317318717]` | `[2837322924,544945897,479756282,3500138142,339756180,113173290]` |

**期望**：Node/浏览器与其他语言实现给出相同 uint32 序列；`randf()` 的高 24 位也必须一致。向量在 `samples/tests/rng-vectors.json` 单独固化；这是本次通过独立脚本计算的**设计参考向量**，尚未由两个生产 Runtime 交叉验证。

### C-INPUT（包含 Touch / IMU）

- `INPUT-001`：Touch pointer down/up 同 tick 保留两边沿；cancel 不触发成功释放。
- `INPUT-002`：两个 pointerId 同时拖动/Pinch，指针归属稳定；第三根手指加入规则明确。
- `INPUT-003`：coalesced move 用于真实切割路径；predicted move 不参与计分/碰撞。
- `INPUT-004`：HUD 捕获的 pointer 不重复被 Gameplay 拾取；视口大小变化坐标映射与 Camera 一致。
- `INPUT-005`：IMU `degree/s → rad/s` 单位换算；屏幕方向旋转后的轴映射验证。
- `INPUT-006`：IMU 授权/拒绝/不可用/样本 stale，按 `first-ready` 选定 touch/keyboard 回退；记录能力变更事件。
- `INPUT-007`：真实触摸录制 Trace 在 Headless 与两个适配器中重放，归一化后动作相同。
- `INPUT-008`：摇晃识别阈值和 cooldown 按能力参数执行，不能无限抖动触发。
- `INPUT-009`：失焦、暂停、关闭 session 时重置 held 输入，不触发假 release。
- `INPUT-010`：新 Input source（如手柄或语音）通过注册接入，不修改 GameSpec 基本 schema。

### C-PUZZLE

- `PUZZLE-001` 推箱子：墙前推动不改变状态，连续推动可原子提交。
- `PUZZLE-002` 2048：同一轮只合并一次；seed 和撤销完整复现新牌。
- `PUZZLE-003` 三消：交换无匹配回退、Cascade 顺序和输入锁。
- `PUZZLE-004` 叠牌消除：Occlusion 选择限制、Tray 满失败、可选择性重算。
- `PUZZLE-005` 俄罗斯方块：旋转/占用/锁定/消行次序；旋转策略版本化。
- `PUZZLE-006` 箭头/找物：合法点击、阻挡、DropZone、完成目标。

### C-REALTIME / C-COMBAT / C-SIM

- `RT-001` 打砖块：高速弹丸不漏碰撞，反弹与失球判定。
- `RT-002` 跑酷：输入/障碍生成/死亡/暂停/重开完整循环。
- `RT-003` 物理合成：同一逻辑对象只合并一次，重复 contact 去重。
- `COMBAT-001` 飞机：武器 tick 冷却、批量子弹、波次与对象池不改变规则。
- `COMBAT-002` 俯视射击：移动/瞄准解耦、同一攻击目标去重、阵营过滤。
- `COMBAT-003` 僵尸生存：自动索敌稳定排序、命中、连续波次、升级选择。
- `COMBAT-004` 塔防：放置+路径+选敌+攻击+经济，合成炮台不会残留旧引用。
- `SIM-001` 农场：生产计时、收取、库存上限、保存和恢复。
- `SIM-002` 合成经营：合并后的生产/经济状态衔接。

### C-ADAPTER

- `ADAPTER-001`：同份 GameSpec 在 CocosAirJS/Three.js 均成功协商，缺少能力显示明确失败（不能静默绕过）。
- `ADAPTER-002`：同一标准输入轨迹，Headless/CocosAirJS/Three.js 离散状态一致。
- `ADAPTER-003`：渲染场景与 UI 的 hit-test 对齐，允许设备像素差异，禁止系统性 X/Y 偏移或坐标轴颠倒。
- `ADAPTER-004`：context lost/pause/resume/restart/close 资源正确释放；无旧回调继续修改新 Session。
- `ADAPTER-005`：物理后端 profile 切换要明确：同一服务 exact 合同，异服务按照不变量/容差；不能隐式 fallback。
- `ADAPTER-006`：Desktop Chrome/Firefox/Safari 与实际移动设备覆盖，IMU 只能在具备能力的真机验证原生采集。

## 5. 覆盖矩阵与未来扩展接口

**CoverageRegistry** 是数据，不是固定游戏类型枚举；每一行包含：

`id, name, taxonomy{genres, mechanics}, dimensions, executionModels, inputs{all/anyOf}, requiredCapabilities{all/anyOf}, optionalCapabilities, profiles, testSuites, acceptance, sourceLinks, extensions`。

### 5.1 扩展规则

- `taxonomy` 的 `genres/mechanics` 为开放字符串集合；新增类目不修改 `GameSpec` 根结构。
- `requiredCapabilities` 使用**能力 ID + 精确版本**；不以游戏名字推断引擎一定支持什么。
- 一个游戏可同时属于 Puzzle/Combat/Strategy，允许交叉机制组合。平台与输入 Profile 独立编码：Desktop Web、Mobile Web Touch、Mobile Web IMU、Host Physics 2D/3D。
- `CoverageRegistry` 的 `expectedSemantics` 与 `ConformanceSuites` 可逐步扩充，但不得将未实现条目记为 verified。
- `CoverageResult` 是 `(gameId, scenarioId, adapterId, platformProfile, capabilitySet, testRevision)` 的独立记录，避免“某游戏 Chrome PASS 就算所有设备 PASS”。

### 5.2 指标定义（必须保持统一）

- **Capability Verified Coverage** = `已实现且其全部必需 conformance PASS 的能力 / 当前已冻结 Catalog 目标能力`。不得包括仅有文档、伪实现或预告的能力。
- **Game Verified Coverage** = `所有必需玩法测试通过且满足目标 Profile 的游戏 / CoverageRegistry 当前目标游戏`。游戏可跨 Adapter 独立统计。
- **Adapter Verified Coverage** = `目标 Adapter/Profile 中已执行且 PASS 的适用场景 / 该 Adapter/Profile 应执行的适用场景`；BLOCKED/NOT_RUN 在分母中，不算 PASS；NOT_APPLICABLE 需具证据且不进入分母。
- **Advanced Coverage**：另外报告 `verified` 与 `documented-only` 两类，不允许用文档覆盖补足 verified。若目标设为 ≥80% verified，仍必须有实际证据和分母固定。
- **Agent Gate** = `从自然语言输入生成 JSON 并通过 G0、G1、目标 G2、G3 完整验收的任务数 / Agent 基准总任务数`；Engine/Adapter/INFRA/策略拒绝分别归因，不以引擎失败直接计入模型能力失败。

报告必须给出完整分子/分母、覆盖矩阵快照版本、测试平台、未执行理由；百分比没有样本数属于无效汇报。

## 6. Agent 生成 Benchmark

建议基于 CoverageRegistry 抽取每个玩法至少 3 个不同语义变体，每次固定 Prompt、Catalog digest、模型设置、资源集合和可用工具。相同描述重试次数固定并分开报告 first-shot success / repaired success。

自动循环：`Prompt → Generated GameSpec → G0 → G1 Headless → G2 Adapter → G3 Gameplay → structured diagnostics → bounded repair → rerun`。Agent 不应拿失败截图作为游戏逻辑修复的唯一证据；应该优先读取 JSON Pointer、事件轨迹、可复现 seed。

建议记录首次生成与修复次数、Schema 错误、逻辑错误、玩法不可完成、资产缺失、输入问题、性能问题，并按机制覆盖维度聚合。

### 6.1 当前执行器参数说明（2026-10-27，文档澄清）

`assertEvent` 使用 `{op:"assertEvent",eventType:"...",count:整数,sinceTick?:整数}`，`count` 是精确次数，不能省略为“至少一次”。终局状态路径为 `/flow/status`，状态字段路径为 `/state/<field>`，不是 `/status`。说明与 `src/conformance.ts` 现有行为一致，不改变 GameSpec/Conformance 版本；正例、负例仍须实际执行并分别断言终局。

## 7. 测试运行、基线与门禁

最小提交门禁应覆盖：Schema 自校验与样例 JSON、所有 Core/RNG golden vectors、Capability 的独立合同用例、若改动影响输入则包含 InputTrace、若影响引擎 Adapter 则两个宿主的同定义验收。每次提交产出：`report.json + manifest-digest + failed-cases + state/event-traces + screenshots(适用时)`。

**现阶段状态**：只有规范、Schema 草案、样例数据及可静态验证的脚本；**没有** Runtime/Adapter 的实际执行器。因此所有 G1/G2/G3 均应标记 `NOT_RUN`，不能声称 32 个玩法已通过。

## 8. 规范验收 / Definition of Done

1. 四份正式规范字段、时间相位、优先级、错误码和测试接口交叉一致；任意冲突必须先修规范。
2. JSON Schema + 自定义 semantic validator 能检查所有已交付示例数据，负例可稳定拒绝。
3. 可运行 Headless 后完成 Core/RNG/Rule/Touch/IMU 合成 Trace 的全部必需测试。
4. 两个 Renderer Adapter 基于**同一份 JSON**，并分别拥有能力协商、生命周期、图形/交互可视化测试。
5. 32 个覆盖候选及其扩展 Registry 具有唯一 ID、可追踪机制、完整测试关联和可审计状态。
6. Agent Gate 与 Engine/Adapter Gate 分离，验收输出不得将 `documented-only`、`BLOCKED`、`NOT_RUN` 记为 PASS。

规范本身完成不等于实现完成；交付后进入具体实现仍需上述门禁逐一通过。
