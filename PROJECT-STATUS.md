# A2Game 当前实施状态（1.0.0 工作区）

> **截至**：2026-10-24。此页与 [`project/status.json`](project/status.json) 是进度单一入口；**不能**根据历史报告推断后续阶段已完成。工作区版本 `1.0.0` 属于 **Alpha 参考实现**；GameSpec/Capability 协议仍为 `0.1.0`。

## S6 固定 Tick 物理与战斗参考 Profile（2026-10-24）

Bounded aabb-int-v1 shared 2D motion/physics/combat reference profile; not full Gxx/3D/device coverage.

- 20 个真实双 SDK 场景、10 组 Node/Three/AIR Hash 对照通过；数值断言、实际输入、暂停/重开、画面与自有资源释放均已验证。[回执](reports/realtime-2026-10-24T14-33-52-314Z-36852/summary.json)。
- 仓库验证：72 Node、35 Conformance、130 Schema 文档全部通过。[日志](reports/verify-2026-10-24T14-29-42-449Z-42488/verify.log)。
- S2/S4/S5 现行源码回归已通过；旧报告全部保留。32 Gxx / 5 Hxx、Agent 和真机 Gate 分别验收。

## 当前处于哪个阶段？

目录调整：协议包现位于 `specs/v0.1/`，docs/schemas/samples、版本工具及旧协议内容完整保留。旧报告和历史文档里的 `A2Game-V0.1-Spec/` 是当时路径；本次迁移同步更新运行入口和白名单，并重新执行真实 SDK G2，现行回执以 `project/status.json` 为准。

迁移复验已通过：49 文件完整迁移，36 个 Schema/样例文件与四份游戏内容哈希不变；`npm run verify`（55 Node、12 Conformance、7 Schema/27 文档）及真实 G2（16+2 场景、8 组跨引擎 Hash）通过。迁移证明见 [`layout-check-final.json`](reports/spec-layout-2026-10-24T12-06-54-319Z/layout-check-final.json)，本轮日志见 [`verify.log`](reports/spec-layout-2026-10-24T12-06-54-319Z/verify.log)。463 份既有历史证据内容未改，最新 G2 指针单独更新。

**S3 — 当前宿主 Profile 的完整准入、审核资源与可传输内容包已交付；下一主线 S7。** S0 的协议/测试设计已具备；S1 的 Headless 参考子集已通过，但完整 Gameplay Library 和完整 G1 都未完成。真实 Three.js / CocosAirJS 已在 HTTP Chromium 中执行相同四份 JSON，并核对输入、exactHash、画面与资源生命周期。S4–S11 均不得默认为已实现；32 Gxx/5 Hxx verified 仍为 0。

## S5 益智与休闲机制交付（2026-10-24）

共享库增加交换匹配/级联补位、遮挡托盘、麻将/记忆翻牌、方向射线、拼块旋转/消行/下落、目标归位、颜色分类、连通消除及推箱/滑动撤销。所有逻辑在 Runtime，Host 仅通用绘制和输入。合同见 [Puzzle Library](specs/v0.1/docs/12-Puzzle-Library-V0.1.md)。

- 12 份参考 JSON、28 份新 Manifest（共 17 游戏/40 Manifest）；70/70 Node、25/25 Conformance（19 套）、7 Schema/82 文档通过。日志：[verify.log](reports/verify-2026-10-24T14-20-52-831Z-16536/verify.log)。
- 真实 Three.js/CocosAirJS 各 12 场景通过，共 24 场景/12 组跨引擎 Hash；输入、暂停、胜利、重开与自有资源释放均验证，截图已查看。[回执](reports/puzzles-2026-10-24T14-22-27-662Z-50412/summary.json)。首轮夹具缺少必填 genres 的拒绝记录保留，归因 AGENT_FIXTURE_SCHEMA，已修复生成器并完整重跑。
- 本版既有内容/资源/包交付、透视/正交 Stage 及四游戏 G2 16+2 场景均复验通过。RNG 撤销限单行为场景；组合使用整 Session 快照。格子按钮不构成拖动/真实 Touch 验收，32+5 verified 仍为 0。

## S4 版本化通用表现交付（2026-10-24）

S5 参考机制交付及本版 S2/S4 回归均已通过；当前回执以 `project/status.json` 为准。

仓库验证全部 PASS：66/66 Node、13/13 Conformance、7 Schema/30 文档。日志：[reports/verify-2026-10-24T13-43-12-540Z-46612/verify.log](reports/verify-2026-10-24T13-43-12-540Z-46612/verify.log)；能力覆盖：[reports/visual-stage-capability-2026-10-24T13-46-15-262Z.json](reports/visual-stage-capability-2026-10-24T13-46-15-262Z.json)。

- 新增 `a2game.visual.stage@0.1.0`，原 `scene2d` 不变；完整 Schema/语义/能力约束涵盖 Camera、Sprite/Texture、Mesh、unlit/PBR Shader 预设、HUD、Tick 旋转动画、有界粒子和事件音频。规范见 [Visual Stage](specs/v0.1/docs/11-Visual-Stage-V0.1.md)。
- 两端均使用真实 SDK 原生对象，单 Canvas/单 SDK 渲染器。动画由共享逻辑 Tick 投影，暂停冻结、不消耗玩法 RNG；表现不进入 exact logical hash。
- 透视与正交/2.5D 各在真实 Three.js 和 CocosAirJS 通过：实际纹理/网格像素、动画像素变化、输入和 Node Hash、DPR/缩放、原生 AudioBufferSourceNode 与运行音频时钟、内容包、进程重启、context loss 与自有资源释放。回执：[透视](reports/visual-stage-2026-10-24T13-39-53-470Z-57792/summary.json)、[正交](reports/visual-stage-2026-10-24T13-40-18-542Z-59544/summary.json)，截图已人工查看。
- context loss 的暂停按既有契约清空输入源缓存；恢复 Hash 与 Node 的同一 pause/resume 序列一致。AIR 受控重载，Three 重建 GPU 资源后显式继续。SDK 共享缓存不计入实例所有权，不声明引擎总内存零泄漏。
- 本次新增 1 Manifest、1 参考 JSON、1 Conformance 和 2 条必要 Node 回归；参考数为 5 游戏/12 Manifest，32+5 完整 verified 仍为 0。S4 PASS 限本版本声明能力；一般模型/骨骼编辑器和任意 Shader 解释不在此能力中，扩展须独立版本与验收。

## S3 阶段交付（2026-10-24）

`npm run verify` 全部通过：64/64 Node、12/12 Conformance、7 Schema/27 文档。日志：[reports/verify-2026-10-24T13-16-53-498Z-45848/verify.log](reports/verify-2026-10-24T13-16-53-498Z-45848/verify.log)。

- 新 Profile `scene2d-trusted-assets-v1`：完整 Draft 2020-12、语义/版本/能力、宿主策略、隔离 Headless 检查、持久化回执与错误反馈。旧 Profile 保留历史记录，以原 JSON 重新导入升级。
- 部署方资源白名单记录类型、来源、许可、字节数和 SHA256；服务与浏览器分别核对实际字节。上传不能注册资源或访问任意外网/服务器文件。Session 统一拥有位图/对象 URL，退出释放。
- 可传输内容包通过文件和 HTTP API 导出/导入，接收方独立完整校验并使用自己已审核的资源；不信任发送者 PASS。此交付不包含远程账户、签名或自动部署。
- 真实双 SDK 验证包括资源下载/解码、内容包导出再导入、输入与 Node Hash、错误恢复、服务重启和资源释放。回执：[summary.json](reports/content-2026-10-24T13-13-36-731Z-49356/summary.json)；原 G2 16+2 场景复验通过。审核资源来自仓库生成的 CC0 PNG/WAV。
- S3 PASS 限当前宿主 Profile；未知/未实现 Capability 仍拒绝。S4、32+5、Agent G3 和真机 Gate 分别验收，不因此升级。

## S3 本地持久化回执（历史，2026-10-24）

- 默认将回执和 JSON 保存到私有 `.a2game/releases/<contextDigest>/<sha256Jcs>.json`，可用 `A2GAME_CONTENT_DIR` 指定目录；运行数据不入库、不经静态 HTTP 公开。临时文件同步后在同目录原子重命名，兼容本机 exFAT；同目录限定单服务写入。
- 服务重启后，首次读取再次执行完整 Schema、语义/能力、宿主策略与隔离 Headless 检查。内容或回执不一致拒绝；旧环境记录返回 `A2G_E_RELEASE_STALE`，需要显式重新导入，旧目录保留。存储失败不退化为内存发布。
- 真实双 SDK 的导入、Hash、负例恢复、后端切换及实际 HTTP 服务进程退出/重启均 PASS；原回执和初始 Hash 保持一致，重启后输入正常。回执：[summary.json](reports/content-2026-10-24T13-03-06-871Z-54276/summary.json)。桌面及移动尺寸截图已人工检查，原 G2 的 16+2 场景、8 组 Hash 复验通过。
- 本轮增加 2 条必要存储回归，覆盖恢复、完整重验、容量、损坏/伪造记录、旧环境与不可写目录；`npm run verify` 全部 PASS：63/63 Node、12/12 Conformance、7 Schema/27 文档及 4 游戏白名单。日志：[verify.log](reports/s3-persistence-2026-10-24T12-57-26-272Z/verify.log)。
- S3 仍 PARTIAL：资源下载/来源/完整性、远程签名分发、多写入者协调仍待实施；不声明断电持久性、G3 或真机完成。使用与恢复契约见[说明](docs/content-release.md)。

## S3 首次动态准入交付（历史，2026-10-24）

- 播放器可导入未加入内置白名单的 JSON；同源服务执行完整 Draft 2020-12、组件/绑定配置、引用/能力与宿主策略检查，再创建带内容/能力/环境 SHA 的进程内回执。校验失败保留当前游戏，错误码和 JSON Pointer 可用于修复。
- 当前 Profile 为 `scene2d-local-release-v1`：单场景、已有能力、Keyboard/Tap/Swipe；256 KiB、最多 32 份发布，服务重启后重新导入。不包含资源、远程/持久化发布、3D 或真实输入录制。
- 真实 Three.js 桌面与 CocosAirJS 移动尺寸均通过：新三次点击变体、键盘/Pointer、Node Hash 对照、负例后恢复及切后端；截图已人工检查。回执：[summary.json](reports/content-2026-10-24T12-36-07-539Z-56252/summary.json)。原四样例 G2 重新执行 16+2 场景、8 组跨引擎 Hash 全部 PASS。
- 显式修复 `SPEC_CONFLICT INPUT-CONFIG-001`：Tap/Keyboard 的旧 Manifest 仅允许空 config，与样例和 Runtime 冲突；同步 Manifest、生成器和输入规范，仍拒绝未知配置字段。协议保持 `0.1.0`。
- `npm run verify` 全部 PASS：61/61 Node、12/12 Conformance、7 Schema/27 文档及 4 游戏白名单；日志：[verify.log](reports/s3-2026-10-24T12-36-05-780Z/verify.log)。完整 S3、32 Gxx/5 Hxx、Agent G3、真机 Touch/IMU 均未宣称完成。

## 当前真实 SDK 验收（2026-10-24）

- Three.js `0.186.1`；CocosAirJS `1.0.0`，固定源码 `fa54a3f6942bfb3035d5c92d174a054ec4ab55ab`，本地执行 `npm ci --ignore-scripts`、`npm run build` 得到 Build 209；SDK 文件 SHA 随回执保存。
- Chromium `156.0.8078.4` / Windows / 实际 WebGL2，驱动为 ANGLE Vulkan SwiftShader。真实 SDK、真实 HTTP/浏览器执行；不等于物理 GPU 或移动真机验收。
- 四游戏 × 桌面 DPR 1/移动尺寸 DPR 2 × 两引擎，**16/16 PASS**；原生时钟、暂停恢复和 context loss，**2/2 PASS**。
- 8 组相同 JSON/操作序列在 Node、Three.js、CocosAirJS 的 initial/keyboard/pointer/restart 检查点 exactHash 一致；绘制、横竖视口缩放、截图像素探针通过，截图已人工查看。
- Three.js 连续三次重建后资源计数稳定，销毁后 ownedMeshes/geometries/textures 均为 0；context loss 时清理旧资源后恢复重建，无 `INVALID_OPERATION` 清理警告。
- AIR 官方 `close()` 释放场景、暂停 SDK 时钟、移除布局/上下文观察；回执 pending/failures 均为空。保留 runtime/scheduler/builtin/shared caches；关闭后同文档初始化按上游报 `AIR_E_APP_CLOSED`，须重载。context loss 后显示重新加载入口，不声称 GPU 自愈或总内存零泄漏。
- 回执指针：[Three.js](reports/g2-threejs-real.json)、[CocosAirJS](reports/g2-cocosairjs-real.json)。最终运行：[summary.json](reports/g2-2026-10-24T13-41-28-255Z-47612/summary.json)。运行前后源码指纹一致，浏览器与临时 HTTP 服务已关闭；失败运行保留并在[交付记录](reports/g2-implementation-20261024.md)归因。

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
| G0 浏览器动态 AI JSON | **PASS（本地 scene2d Profile）** | 完整 Draft 2020-12、组件/绑定配置、语义/能力与宿主策略；同源持久化回执及重启后完整校验，见本轮 S3 证据；资源和远程发布待做 |
| G1 Headless 参考子集 | **PASS（子集）** | 历史 54/54 Node、6 套 12/12 Conformance；本次重验见 `reports/release-1.0.0-validation.json`（生成后） |
| G1 完整能力目录 | **PARTIAL** | 益智参考机制已交付；实时/策略及全 Gxx/Hxx 仍需验收 |
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
| 已交付样例游戏 JSON | 27 | 当前 Headless/Canvas2D/真实双 SDK 的 scene2d 参考验证 |
| 已声明参考 Capability | 68 | Capability Manifest 数量不代表标准库完成度 |

## 下一轮的具体执行目标（S3/S4）

S3 已完成当前 Profile 的资源准入与内容包交付，审核范围外的资源及未知能力拒绝。S4 已交付版本化 Stage 与双引擎证据；下一步 S5 补齐益智/休闲机制，之后按既有 S6–S11 范围持续实施。详见[本地准入契约](docs/content-release.md)。

只有真实 SDK 的全流程证据存在且 PASS，才能调整 `project/status.json.gates` 与本页状态。之后继续 S3/S4、Gameplay/Touch/IMU、32+5 全量计划，不得因 G2 完成缩减其余目标。完整任务与分阶段 DoD 见 [PROJECT-PLAN.md](PROJECT-PLAN.md)。

## 进展更新要求

2026-10-24 工程基线整理：补充 `AGENTS.md` 快速导航，纳入 npm 锁文件和 `.gitignore`；本机使用项目内 Python 环境运行 `npm run verify` 全部通过（55/55 Node、12/12 Conformance、7 Schema/27 文档、4 游戏目录）。日志：`reports/workspace-baseline-20261024.log`。此次不升级真实 SDK G2，后续在基线提交后推进。

每轮都记录：执行日期、仓库或源码包基线、变更文件、实际运行命令、PASS/FAIL/BLOCKED、未完成原因、覆盖分母与证据文件。同步维护本页、`project/status.json`、`CHANGELOG.md`，并运行 `npm run project:check`。历史 `IMPLEMENTATION-REPORT.md`、`IMPLEMENTATION-NEXT.md` 和 `reports/v03-*` 保留以便审计。
