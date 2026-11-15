# A2Game V0.1 — 现行协议与实现资产（协议 0.1.0）

- 版本：`0.1.0`（初始包标记 `0.1.0-draft.1`，2026-10-24）
- 日期：2026-10-24 初版；目录说明更新于 2026-10-29
- 目标：AI 直接生成引擎无关 JSON，由共享 Game Runtime 解释，CocosAirJS / Three.js 作为可替换适配器；覆盖益智、休闲、轻量射击、塔防、合成、经营，Touch / IMU 是正式输入通道。
- 状态（2026-10-28）：本目录是**现行协议 0.1.0 的规范与机器可读资产**。共享 Runtime、双 SDK Adapter、输入规范化与 Conformance 均已实现，持续通过 `npm test`、`spec:validate`、`schema:full`、`conformance` 验证。项目整体仍为 **Alpha 参考实现**：正式 verified（0/32＋0/5）、正式独立 G3（0/37）、人工质量与真机 Gate 独立验收，不代表官方标准发布。

## 阅读顺序及规范层级

| 顺序 | 文件 | 规范对象 |
|---|---|---|
| 1 | [`docs/01-GameSpec-V0.1.md`](docs/01-GameSpec-V0.1.md) | GameSpec 内容结构与语义 |
| 2 | [`docs/02-Capability-Manifest-V0.1.md`](docs/02-Capability-Manifest-V0.1.md) | 能力目录、版本协商、Touch / IMU / 模块扩展 |
| 3 | [`docs/03-Runtime-Tick-Rule-Semantics-V0.1.md`](docs/03-Runtime-Tick-Rule-Semantics-V0.1.md) | Tick、规则、冲突、随机、状态与生命周期 |
| 4 | [`docs/04-Conformance-Test-V0.1.md`](docs/04-Conformance-Test-V0.1.md) | 基线测试、黄金样例、跨引擎适配验收 |
| 附录 | [`docs/05-Coverage-Registry-V0.1.md`](docs/05-Coverage-Registry-V0.1.md) | 32 个候选游戏 + 未来扩展覆盖数据模型 |

## 机器可读资产

2026-10-29 起按用途直接分层，原 `samples/` 不再是运行时资产入口。目录名称描述资产用途；项目成熟度仍为 Alpha 参考实现，不能由重命名升级验收状态。

```text
specs/v0.1/
├── docs/           # 规范与扩展合同
├── schemas/        # 结构 Schema
├── capabilities/   # 运行时实际使用的能力 Manifest
├── adapters/       # 宿主支持范围声明
├── games/          # 参考游戏、逐款候选和作者变体
├── tests/          # 可执行 Conformance、黄金向量和负例
├── coverage/       # 32 款冻结登记数据
├── examples/       # 回执格式演示、合成输入录制示例
└── tools/          # 静态检查和生成工具
```

- `schemas/`：采用 JSON Schema Draft 2020-12 的 7 份结构 Schema；跨字段语义约束由 `src/validator.ts`、`src/registry.ts` 与 `scripts/preflight.py`（`npm run schema:full`）执行。
- `games/`：113 份现行游戏 GameSpec JSON（`specVersion` 均为 `0.1.0`），由共享 Runtime 解释执行。
- `capabilities/`：128 份能力 Manifest；能力协商与可信绑定见 `src/registry.ts`、`src/trusted-modules.ts`。
- [`project/capability-bindings.json`](../../project/capability-bindings.json)：128 项当前可信绑定、依赖闭包与测试声明索引。可执行用例引用、规范编号和未解析声明分别标识，均不自动成为逐能力正式验收回执；由 `npm run catalog:build` 同步生成。
- `tests/`：Conformance 套件、RNG 黄金向量、InputTrace 与负例（含 `negative-fixtures.json`）；实际执行由 `scripts/run-conformance.mjs`（`npm run conformance`）完成并通过。
- `examples/input-traces/touch-imu.input-trace.json`：Touch + IMU 标准化录制格式样例（采样数据为合成示例；真机采集 Gate 独立验收）。
- `coverage/games.json`：32 个候选玩法的登记数据；真实验收回执指针在 `project/` 与 `reports/`。
- `examples/coverage/not-run.receipt.json`：NOT_RUN 回执的**格式样例**（历史格式演示，非当前状态描述）。
- `adapters/*.adapter.json`：CocosAirJS / Three.js / 公开回合房间的适配器声明；原生 Adapter 实现见 `player/adapters/`，真实 SDK 证据见 `reports/`。
- `tools/validate_specs.py`：JSON / Schema / 静态交叉引用校验（`npm run spec:validate`），不启动游戏。
- `tools/build_artifacts.py`：初始 Schema / 基础数据生成器；会重建初始资产，不能作为保留当前扩展合同的日常构建入口。日常校验沿用根目录 `npm run verify`。

迁移保持全部 362 个资产的原始字节、游戏 ID、能力版本和 GameSpec 逻辑不变。旧回执路径由严格迁移映射读取；当前 HTTP 与工具使用新路径。兼容规则和验证见 [目录迁移说明](../../docs/spec-layout.md)。

### 离线验证

```bash
python -m pip install jsonschema
python tools/validate_specs.py
```

注意：`spec:validate` PASS 仅证明静态格式与引用规则；玩法与跨引擎兼容由 `npm test`、`npm run conformance`、真实 SDK G2（`npm run g2:real`）及逐款验收链路证明。

## 当前状态（2026-10-28）

- 规范文档已扩展至 20 份（`docs/01` ~ `docs/20`，含 Puzzle/Realtime/Strategy 库、Mobile Input、Game Candidates、Agent Workflow、Compatibility Extensions、Tower Defense、Rigid3D 等）。
- `games/` 113 份、`capabilities/` 128 份、32 款候选登记；Conformance、完整 Schema、Node/Host Hash 与真实双 SDK 浏览器结果按各次回执记录，旧版通过不自动适用于当前源码（见 `project/status.json` 与 `reports/`）。
- 正式验收维度独立：正式 verified 0/32＋0/5、正式独立 G3 0/37、人工质量与真机 NOT_RUN；项目整体为 Alpha 参考实现。

## 初始交付范围（2026-10-24 draft.1，历史记录）

1. 统一 `specVersion = 0.1.0`、能力精确版本引用与可扩展的 CoverageRegistry。
2. 提供 7 份结构 Schema、1 份最小 GameSpec、7 份能力 Manifest、2 份 Conformance Suite、RNG 黄金向量、Touch/IMU InputTrace、32 条候选玩法以及未运行回执。
3. 提供静态交叉校验（已测试）；初始包**未包含**游戏运行时与 Adapter，后续阶段已补齐。

## 四层边界

```mermaid
flowchart TB
    AI[AI Agent] --> JSON[GameSpec JSON]
    C[Capability Catalog] --> AI
    JSON --> V[Validator / Loader]
    C --> V
    V --> R[Shared Game Runtime]
    P[Physics Service Profile] --> R
    I[Input Normalization] --> R
    R --> H[Headless / Conformance]
    R --> CA[CocosAirJS Adapter]
    R --> TH[Three.js Adapter]
```

- A2Game 拥有：逻辑状态、规则解释、时钟、事件、随机、玩法模块和测试标准。
- 适配器拥有：画面、材质、粒子、声画呈现、设备事件采样和宿主资源生命周期。
- 物理/导航属于独立服务，尽可能同一实现；不能因共享 JSON 就假定不同求解器数值一致。

## 规范冲突处理

- 这四份文件共同构成 `0.1.0-draft.1`，不存在以“某份文档默认值”为由覆盖另一份的规则。
- 结构字段以 GameSpec 和 Manifest 文档为准；Tick/Rule 行为以 Runtime 文档为准；验证结果判定以 Conformance 文档为准。
- 如出现冲突，属于**规范缺陷**，必须修改两份文档和相关 test vector 后才能标记已解决；不允许实现自行择一。

## 明确不在 V0.1 已实现范围内

多人网络同步、任意用户脚本执行、独立视觉编辑器、跨物理后端 bit-exact、任意已有 TS 游戏的无损反向导出。有界例外：S11 提供显式启用的同源 loopback 双人公开回合（`scripts/turn-room-service.mjs`，非互联网/隐藏信息服务）；`/player/inspect.html` 是调试回放入口而非视觉编辑器；参考物理锁定 cannon-es 0.20.0，未声明平台的浮点精确一致性不自动推定。可以通过扩展能力进行未来设计，但不默示这些能力已提供。

## 来源与原创边界

协议是本项目的设计稿。参考 [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)、[Yume 的世界模型/一致性契约](https://github.com/kamwoh/yume/blob/dev/docs/guideline/30_framework_primitives.md)、[JSON Schema 2020-12](https://json-schema.org/draft/2020-12)、[W3C Pointer Events 3](https://www.w3.org/TR/pointerevents3/)、[MDN DeviceMotionEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent)，而非复用其协议或宣称兼容。
