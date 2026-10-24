# A2Game 当前实施状态（1.0.0 工作区）

> **截至**：2026-10-24。此页与 [`project/status.json`](project/status.json) 是进度单一入口；**不能**根据历史报告推断后续阶段已完成。工作区版本 `1.0.0` 属于 **Alpha 参考实现**；GameSpec/Capability 协议仍为 `0.1.0`。

## 当前处于哪个阶段？

目录调整：协议包现位于 `specs/v0.1/`，docs/schemas/samples、版本工具及旧协议内容完整保留。旧报告和历史文档里的 `A2Game-V0.1-Spec/` 是当时路径；本次迁移同步更新运行入口和白名单，并重新执行真实 SDK G2，现行回执以 `project/status.json` 为准。

迁移复验已通过：49 文件完整迁移，36 个 Schema/样例文件与四份游戏内容哈希不变；`npm run verify`（55 Node、12 Conformance、7 Schema/27 文档）及真实 G2（16+2 场景、8 组跨引擎 Hash）通过。迁移证明见 [`layout-check-final.json`](reports/spec-layout-2026-10-24T12-06-54-319Z/layout-check-final.json)，本轮日志见 [`verify.log`](reports/spec-layout-2026-10-24T12-06-54-319Z/verify.log)。463 份既有历史证据内容未改，最新 G2 指针单独更新。

**S2 — 真实双引擎 G2 四样例参考子集已通过，下一主线为 S3/S4。** S0 的协议/测试设计已具备；S1 的 Headless 参考子集已通过，但完整 Gameplay Library 和完整 G1 都未完成。真实 Three.js / CocosAirJS 已在 HTTP Chromium 中执行相同四份 JSON，并核对输入、exactHash、画面与资源生命周期。S3–S11 均不得默认为已实现；32 Gxx/5 Hxx verified 仍为 0。

## 当前真实 SDK 验收（2026-10-24）

- Three.js `0.186.1`；CocosAirJS `1.0.0`，固定源码 `fa54a3f6942bfb3035d5c92d174a054ec4ab55ab`，本地执行 `npm ci --ignore-scripts`、`npm run build` 得到 Build 209；SDK 文件 SHA 随回执保存。
- Chromium `156.0.8078.4` / Windows / 实际 WebGL2，驱动为 ANGLE Vulkan SwiftShader。真实 SDK、真实 HTTP/浏览器执行；不等于物理 GPU 或移动真机验收。
- 四游戏 × 桌面 DPR 1/移动尺寸 DPR 2 × 两引擎，**16/16 PASS**；原生时钟、暂停恢复和 context loss，**2/2 PASS**。
- 8 组相同 JSON/操作序列在 Node、Three.js、CocosAirJS 的 initial/keyboard/pointer/restart 检查点 exactHash 一致；绘制、横竖视口缩放、截图像素探针通过，截图已人工查看。
- Three.js 连续三次重建后资源计数稳定，销毁后 ownedMeshes/geometries/textures 均为 0；context loss 时清理旧资源后恢复重建，无 `INVALID_OPERATION` 清理警告。
- AIR 官方 `close()` 释放场景、暂停 SDK 时钟、移除布局/上下文观察；回执 pending/failures 均为空。保留 runtime/scheduler/builtin/shared caches；关闭后同文档初始化按上游报 `AIR_E_APP_CLOSED`，须重载。context loss 后显示重新加载入口，不声称 GPU 自愈或总内存零泄漏。
- 回执指针：[Three.js](reports/g2-threejs-real.json)、[CocosAirJS](reports/g2-cocosairjs-real.json)。最终运行：[summary.json](reports/g2-2026-10-24T12-07-53-439Z-48524/summary.json)。运行前后源码指纹一致，浏览器与临时 HTTP 服务已关闭；失败运行保留并在[交付记录](reports/g2-implementation-20261024.md)归因。

## 当前具备的可运行功能

- `src/runtime.ts`：Session / Tick / Rule / 事务与回滚 / 定时与暂停 / 事件 / Snapshot。
- `src/rng.ts`、`src/exact-hash.ts`：参考随机数与 exact logical state Hash。
- `src/modules/grid-slide-merge.ts`、`grid-push.ts`：网格滑动合并、随机补位及推箱子的参考算法。
- `src/presentation.ts`：`scene2d` 的 `rect/circle/text/repeat` → `PresentationFrame` 只读投影。
- `src/input-trace.ts`：规范化 Swipe / InputTrace 合成回放（不等于真实设备输入）。
- `player/`：4 份 JSON 预览、Canvas2D Renderer、经真实 G2 验收的 Three/CocosAirJS `scene2d` 适配器及 Mock 契约。
- `scripts/`：静态验证、发布前白名单、Conformance、浏览器模拟和 Node↔Chromium Hash 校验。

**四份完整样例 JSON**：`tap-target`、`grid-merge`、`grid-merge-spawn`、`grid-push`。它们是参考样例，不直接等于 G01/G02 已完成全部玩法 DoD。

## 1.0.0 初始隔离复验（历史环境记录；保留原结论）

- **项目治理**：`npm run project:check` PASS（版本、12 阶段、32 Gxx、5 Hxx、计划/状态约束）。
- **Node 自动化测试**：**55/55 PASS**（历史基线 54，新增 1 条发行版本隔离回归）。
- **完整 Schema 与规范校验**：7 类 Schema 对 27 份 JSON、11 Manifest、4 游戏、32 候选、6 套 Conformance 引用 PASS。
- **Conformance**：6 套、12/12 PASS；发布白名单重建成功（4 个游戏 JSON）。
- **Chromium Canvas2D（隔离 set_content）**：5 个场景均运行并截图，Node↔Chromium 5/5 ExactHash 相同。
- **初始隔离环境的 HTTP 服务**：`/player/index.html`、`grid-push.game.json` 均返回 HTTP 200；Chromium `page.goto()` 当时被 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻断，历史结果为 INFRA BLOCKED，不可算该次 URL E2E PASS。
- **该历史时点的真实 G2**：CocosAirJS、Three.js 尚为 NOT_RUN；现行结果见本页上方真实 SDK 验收。全 32 Gxx/5 Hxx、真机 Touch/IMU 与 Agent G3 仍未验收。

本轮机器可读证据：[`reports/release-1.0.0-validation.json`](reports/release-1.0.0-validation.json)；原始日志见 `reports/release-1.0.0-*.log`、`reports/release-1.0.0-node-tests.tap`。以上只确认当前环境真实执行的测试，不推断其他平台结果。

2026-10-24 G2 实现后的仓库复验：`npm run verify` 全部通过，55/55 Node、12/12 Conformance、7 Schema/27 文档。完整日志：[`g2-workspace-verify-20261024.log`](reports/g2-workspace-verify-20261024.log)；独立保存的逻辑回执：[`g2-workspace-conformance-20261024.json`](reports/g2-workspace-conformance-20261024.json)，不覆盖基线报告。技能浏览器脚本在两个真实 SDK 中完成推箱子获胜，最终状态与 Hash 相同。

## Gate 状态（不得跨域冒用证据）

| Gate | 现行状态 | 可复现证据与界限 |
|---|---|---|
| G0 预校验样例 | **PASS（样例范围）** | 7 Schema / 27 文档历史回执；每次发布重新 `npm run schema:full` |
| G0 任意浏览器 AI JSON | **NOT_IMPLEMENTED** | 页面只接收预验证 SHA256 白名单；不能绕过校验直接载入 |
| G1 Headless 参考子集 | **PASS（子集）** | 历史 54/54 Node、6 套 12/12 Conformance；本次重验见 `reports/release-1.0.0-validation.json`（生成后） |
| G1 完整能力目录 | **PARTIAL** | 目前仅两种棋盘机制 + 点击参考，其余仍需实现 |
| Browser + Canvas2D | **PASS（历史 5 场景）** | `reports/browser-core-smoke.json`；不是实际 SDK G2 |
| Node↔Chromium ExactHash | **PASS（历史 5 场景）** | `reports/browser-node-parity.json`；不包含物理/GPU 验收 |
| G2 CocosAirJS 真 SDK | **PASS（四样例 scene2d）** | `reports/g2-cocosairjs-real.json`；8 场景 + 原生时钟/context loss；不包括真机输入或完整引擎卸载 |
| G2 Three.js 真 SDK | **PASS（四样例 scene2d）** | `reports/g2-threejs-real.json`；8 场景 + 原生时钟/context loss、连续重建与释放 |
| G3 游戏/Agent | **NOT_RUN** | 32 款仍 planned；尚未做模型独立 one-shot、玩法完整验收 |
| 真机 Touch/IMU | **NOT_RUN** | 合成 Trace 可以回放；IMU 采集、权限/校准尚未实现 |

## 覆盖统计与冻结口径

| 指标 | 当前 | 解释 |
|---|---:|---|
| CoverageRegistry 候选游戏 | 32 | G01–G32，`status: planned`，保留冻结分母 |
| 已完整 verified 游戏 | 0/32 | 实现参考功能不替代 G0+G1+G2+G3 玩法 Gate |
| 独立混合玩法 | 0/5 | H01–H05 尚未创建各自完整 GameSpec/Conformance |
| 已交付样例游戏 JSON | 4 | 当前 Headless/Canvas2D/真实双 SDK 的 scene2d 参考验证 |
| 已声明参考 Capability | 11 | Capability Manifest 数量不代表标准库完成度 |

## 下一轮的具体执行目标（S3/S4）

S3：实现任意 AI JSON 的完整 Draft 2020-12 校验、语义/版本/资源来源检查和发布回执，继续保持未知必需能力拒绝，不绕过现有预验证 SHA 白名单。S4：按版本化 Capability 扩展 Sprite/Texture/Mesh/Camera 等表现和所有权管理；每项附双引擎 G2 证据。尚未开始实现这些增量。

只有真实 SDK 的全流程证据存在且 PASS，才能调整 `project/status.json.gates` 与本页状态。之后继续 S3/S4、Gameplay/Touch/IMU、32+5 全量计划，不得因 G2 完成缩减其余目标。完整任务与分阶段 DoD 见 [PROJECT-PLAN.md](PROJECT-PLAN.md)。

## 进展更新要求

2026-10-24 工程基线整理：补充 `AGENTS.md` 快速导航，纳入 npm 锁文件和 `.gitignore`；本机使用项目内 Python 环境运行 `npm run verify` 全部通过（55/55 Node、12/12 Conformance、7 Schema/27 文档、4 游戏目录）。日志：`reports/workspace-baseline-20261024.log`。此次不升级真实 SDK G2，后续在基线提交后推进。

每轮都记录：执行日期、仓库或源码包基线、变更文件、实际运行命令、PASS/FAIL/BLOCKED、未完成原因、覆盖分母与证据文件。同步维护本页、`project/status.json`、`CHANGELOG.md`，并运行 `npm run project:check`。历史 `IMPLEMENTATION-REPORT.md`、`IMPLEMENTATION-NEXT.md` 和 `reports/v03-*` 保留以便审计。
