# A2Game 当前实施状态（1.0.0 工作区）

> **截至**：2026-10-24。此页与 [`project/status.json`](project/status.json) 是进度单一入口；**不能**根据历史报告推断后续阶段已完成。工作区版本 `1.0.0` 属于 **Alpha 参考实现**；GameSpec/Capability 协议仍为 `0.1.0`。

## 当前处于哪个阶段？

**S2 — 真实 CocosAirJS / Three.js G2 浏览器端到端验收准备阶段。** S0 的协议/测试设计已具备；S1 的 Headless 参考子集已通过，但完整 Gameplay Library 和完整 G1 都未完成。S2 已有 Adapter 源码和 Mock 测试，**真实 SDK G2 尚未执行**。S3–S11 均不得默认为已实现；部分通用机制有先行子集。

## 当前具备的可运行功能

- `src/runtime.ts`：Session / Tick / Rule / 事务与回滚 / 定时与暂停 / 事件 / Snapshot。
- `src/rng.ts`、`src/exact-hash.ts`：参考随机数与 exact logical state Hash。
- `src/modules/grid-slide-merge.ts`、`grid-push.ts`：网格滑动合并、随机补位及推箱子的参考算法。
- `src/presentation.ts`：`scene2d` 的 `rect/circle/text/repeat` → `PresentationFrame` 只读投影。
- `src/input-trace.ts`：规范化 Swipe / InputTrace 合成回放（不等于真实设备输入）。
- `player/`：4 份 JSON 预览、Canvas2D Renderer、Three/CocosAirJS 适配器源码与 Mock 契约。
- `scripts/`：静态验证、发布前白名单、Conformance、浏览器模拟和 Node↔Chromium Hash 校验。

**四份完整样例 JSON**：`tap-target`、`grid-merge`、`grid-merge-spawn`、`grid-push`。它们是参考样例，不直接等于 G01/G02 已完成全部玩法 DoD。

## 本轮 1.0.0 实际复验（2026-10-24）

- **项目治理**：`npm run project:check` PASS（版本、12 阶段、32 Gxx、5 Hxx、计划/状态约束）。
- **Node 自动化测试**：**55/55 PASS**（历史基线 54，新增 1 条发行版本隔离回归）。
- **完整 Schema 与规范校验**：7 类 Schema 对 27 份 JSON、11 Manifest、4 游戏、32 候选、6 套 Conformance 引用 PASS。
- **Conformance**：6 套、12/12 PASS；发布白名单重建成功（4 个游戏 JSON）。
- **Chromium Canvas2D（隔离 set_content）**：5 个场景均运行并截图，Node↔Chromium 5/5 ExactHash 相同。
- **本地 HTTP 服务**：`/player/index.html`、`grid-push.game.json` 均返回 HTTP 200；**Chromium 直接 `page.goto()` 被当前环境的 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻断**，这项仅可记为 INFRA BLOCKED，不可算浏览器 URL E2E PASS。
- **真实 G2**：CocosAirJS、Three.js 仍 NOT_RUN；全 32 Gxx/5 Hxx、真机 Touch/IMU 与 Agent G3 均未验收。

本轮机器可读证据：[`reports/release-1.0.0-validation.json`](reports/release-1.0.0-validation.json)；原始日志见 `reports/release-1.0.0-*.log`、`reports/release-1.0.0-node-tests.tap`。以上只确认当前环境真实执行的测试，不推断其他平台结果。

## Gate 状态（不得跨域冒用证据）

| Gate | 现行状态 | 可复现证据与界限 |
|---|---|---|
| G0 预校验样例 | **PASS（样例范围）** | 7 Schema / 27 文档历史回执；每次发布重新 `npm run schema:full` |
| G0 任意浏览器 AI JSON | **NOT_IMPLEMENTED** | 页面只接收预验证 SHA256 白名单；不能绕过校验直接载入 |
| G1 Headless 参考子集 | **PASS（子集）** | 历史 54/54 Node、6 套 12/12 Conformance；本次重验见 `reports/release-1.0.0-validation.json`（生成后） |
| G1 完整能力目录 | **PARTIAL** | 目前仅两种棋盘机制 + 点击参考，其余仍需实现 |
| Browser + Canvas2D | **PASS（历史 5 场景）** | `reports/browser-core-smoke.json`；不是实际 SDK G2 |
| Node↔Chromium ExactHash | **PASS（历史 5 场景）** | `reports/browser-node-parity.json`；不包含物理/GPU 验收 |
| G2 CocosAirJS 真 SDK | **NOT_RUN** | `player/adapters/cocosairjs-adapter.mjs` 存在，Mock 合同 ≠ G2 |
| G2 Three.js 真 SDK | **NOT_RUN** | `player/adapters/three-adapter.mjs` 存在，Mock 合同 ≠ G2 |
| G3 游戏/Agent | **NOT_RUN** | 32 款仍 planned；尚未做模型独立 one-shot、玩法完整验收 |
| 真机 Touch/IMU | **NOT_RUN** | 合成 Trace 可以回放；IMU 采集、权限/校准尚未实现 |

## 覆盖统计与冻结口径

| 指标 | 当前 | 解释 |
|---|---:|---|
| CoverageRegistry 候选游戏 | 32 | G01–G32，`status: planned`，保留冻结分母 |
| 已完整 verified 游戏 | 0/32 | 实现参考功能不替代 G0+G1+G2+G3 玩法 Gate |
| 独立混合玩法 | 0/5 | H01–H05 尚未创建各自完整 GameSpec/Conformance |
| 已交付样例游戏 JSON | 4 | 可用于当前 Headless/Canvas2D 参考验证 |
| 已声明参考 Capability | 11 | Capability Manifest 数量不代表标准库完成度 |

## 下一轮的具体执行目标（S2）

以真实 SDK 对 `tap-target`、`grid-merge`、`grid-merge-spawn`、`grid-push` 逐项运行：锁定依赖版本/SHA → 启动真实 HTTP 页 → Pointer/Keyboard 输入 → 状态 Hash 与 Node 对照 → 正确截图/缩放 → 暂停重开 → dispose 资源 → 输出两端独立 G2 回执。失败归因必须区分 Engine、Infra、输入/表现、Agent 策略。

只有真实 SDK 的全流程证据存在且 PASS，才能调整 `project/status.json.gates` 与本页状态。之后继续 S3/S4、Gameplay/Touch/IMU、32+5 全量计划，不得因 G2 完成缩减其余目标。完整任务与分阶段 DoD 见 [PROJECT-PLAN.md](PROJECT-PLAN.md)。

## 进展更新要求

2026-10-24 工程基线整理：补充 `AGENTS.md` 快速导航，纳入 npm 锁文件和 `.gitignore`；本机使用项目内 Python 环境运行 `npm run verify` 全部通过（55/55 Node、12/12 Conformance、7 Schema/27 文档、4 游戏目录）。日志：`reports/workspace-baseline-20261024.log`。此次不升级真实 SDK G2，后续在基线提交后推进。

每轮都记录：执行日期、仓库或源码包基线、变更文件、实际运行命令、PASS/FAIL/BLOCKED、未完成原因、覆盖分母与证据文件。同步维护本页、`project/status.json`、`CHANGELOG.md`，并运行 `npm run project:check`。历史 `IMPLEMENTATION-REPORT.md`、`IMPLEMENTATION-NEXT.md` 和 `reports/v03-*` 保留以便审计。
