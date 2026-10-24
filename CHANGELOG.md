# A2Game 项目变更记录

## S4 版本化 2D/3D Visual Stage — 2026-10-24

- 新增独立 Manifest、增量 Schema、语义检查、参考游戏和 Conformance；保留旧 scene2d 语义。支持 Camera、审核纹理/Sprite、原生 Mesh、unlit/PBR Shader 预设、HUD、Tick 动画、有界粒子和事件音频。
- Three.js/CocosAirJS 均使用原生对象和一个 SDK 渲染器；适配器拥有 GPU/音频对象，Session 资源作用域拥有字节/位图/URL，按顺序释放。初始化失败也执行清理。
- 透视与正交/2.5D 两组真实双 SDK 验证通过：实际像素、原生音频节点/时钟、输入/Node Hash、缩放、服务重启、context loss 和释放。暂停 Hash 按相同 Node 操作序列比较，未修改哈希算法。
- 新完整准入 Profile 为 `trusted-reference-host-v1`，允许已声明 Stage 的 3D 定义；旧 Profile 重新导入升级，协议仍为 `0.1.0`。下一步 S5；全 32+5、Agent 和真机 Gate 不升级。

## S3 审核资源与内容交付 — 2026-10-24

- 完成当前宿主 Profile 的资源白名单、来源/许可与字节级 SHA 校验、资源预算和统一释放；新增可复现的 CC0 PNG/WAV 参考资源。上传不能注册资源或发起任意下载。
- 新 Profile `scene2d-trusted-assets-v1` 增加资源清单摘要；旧记录保留，原 JSON 重新完整准入。GameSpec/Capability 仍为 `0.1.0`。
- 新增内容包导出/导入与接收方完整重验，提供文件/HTTP 交付；接收方需要自己审核的匹配资源，发送者元数据不授予信任。未部署远程服务，不包含账户/签名。
- 真实双 SDK 的资源解码/释放、包迁移、Node Hash 与重启通过；原 G2 16+2 场景复验通过。S3 按当前宿主 Profile 交付，后续 S4–S11 与完整覆盖 Gate 不变。

## S3 本地回执持久化 — 2026-10-24

- 播放器服务默认保存按校验环境/内容 SHA 寻址的本地发布记录；服务重启后首次读取重新完整校验，原回执与内容不变。可用 `A2GAME_CONTENT_DIR` 指定私有存储目录，默认数据不入库。
- 使用独占临时文件、文件同步和同目录原子重命名，兼容当前 exFAT 工作盘；损坏记录、环境失配、存储故障和容量满时明确拒绝，保留旧环境记录。当前限定单服务写入，无远程签名或断电持久性声明。
- 增加 2 条必要存储回归；扩展真实双 SDK `content:e2e`，验证实际 HTTP 进程退出/重启、回执和初始 Hash 不变及继续输入。回执：[summary.json](reports/content-2026-10-24T13-03-06-871Z-54276/summary.json)；原 G2 16+2 场景复验通过。
- S3 保持 PARTIAL，后续为资源来源/完整性与远程交付，再扩展 S4。

## S3 本地动态 JSON 准入 — 2026-10-24

- 新增同源 `POST/GET /api/releases`、完整 Draft 2020-12 校验、配置/语义/能力与宿主策略检查，以及带内容、Manifest 和环境 SHA 的进程内回执；校验器缺失或环境变化时拒绝发布。
- 播放器增加 JSON 文件导入、错误诊断与失败后恢复；动态内容可在真实 Three.js/CocosAirJS 间切换，内置样例保留原 SHA 白名单。
- 修复 `SPEC_CONFLICT INPUT-CONFIG-001`，使 Tap/Keyboard Manifest 配置与已有样例/运行时契约一致；同步生成器与规范并增加正反例。GameSpec/Capability 仍为 `0.1.0`。
- 新增 6 条必要回归与可复用 `content:e2e`。新三次点击变体在两端与 Node Hash 一致，负例恢复、画面、切换与释放通过；原 G2 16+2 场景、8 组 Hash 复验通过。详见[准入契约](docs/content-release.md)、[动态内容回执](reports/content-2026-10-24T12-36-07-539Z-56252/summary.json)和[项目状态](PROJECT-STATUS.md)。
- S3 保持 PARTIAL：当前仅单场景 scene2d、已有能力、无资源的本地进程回执；资源管理与持久化/远程发布仍待实施，未增加全目录 verified 数。

## 协议目录迁移 — 2026-10-24

- 将协议包从 `A2Game-V0.1-Spec/` 迁移到 `specs/v0.1/`，保留 docs/schemas/samples、版本工具及历史协议内容；GameSpec/Capability 版本仍为 `0.1.0`。
- 同步规范校验、Headless 注册、播放器 HTTP URL、SHA 白名单、测试、文档导航与 CoverageRegistry 路径；旧报告/Trace 和历史文档中的原始路径保留，不改写历史证据。
- 迁移后重新采集真实 SDK G2：16 个游戏/视口场景、2 个原生时钟/context loss 场景及 8 组跨引擎哈希全部通过；`npm run verify` 通过。49 文件完整迁移，36 个 Schema/样例文件及 4 份游戏白名单内容哈希不变。
- 迁移校验与仓库日志见 `reports/spec-layout-2026-10-24T12-06-54-319Z/`；旧报告/Trace 内容保持原样，当前 G2 指针更新至新目录运行。

## S2 真实双引擎 G2 参考子集 — 2026-10-24

- 使用真实 Three.js `0.186.1`、CocosAirJS `fa54a3f6942bfb3035d5c92d174a054ec4ab55ab` 本地构建（Build 209）、Chromium `156.0.8078.4`，通过 HTTP 加载相同的四份预验证 JSON。
- 16 个游戏/视口/DPR 场景、2 个原生时钟/context loss 场景通过；8 组 Node/Three/AIR exactHash 一致。保存截图、像素探针、DOM 输入操作、Trace、SDK SHA、源码指纹及物理关闭回执。
- 修复 Three.js 长文本裁切、指令绘制顺序、重建时绘制已释放实例、context loss 后旧 WebGL 资源清理；修复 AIR 容器尺寸、缩放和矢量/文本顺序。首帧预热后再启动玩法时钟。
- 显式 `clock=manual` 测试模式替换玩法时钟并支持 `advanceTime`，渲染仍随 rAF 更新；普通页面保留单一生产 Tick。监听器可统一撤销，销毁幂等，AIR 使用官方 `close()` 并按契约受控重载。
- 新增 `sdk:prepare`、`g2:real`、SDK 来源锁与证据检查；失败和已被新修复取代的历史运行全部保留。
- 验收范围是 `scene2d` 四样例；实际 WebGL2 使用 ANGLE/SwiftShader，未验证物理 GPU/真机 Touch/IMU、完整玩法目录及 Agent G3。AIR 运行时/内置缓存由上游保留，不声称总 GPU 内存零泄漏。
- 当前回执：`reports/g2-threejs-real.json`、`reports/g2-cocosairjs-real.json`；详细交付见 `reports/g2-implementation-20261024.md`。

## 工程基线整理 — 2026-10-24

- 补充 `AGENTS.md` 的源码导航、安装/验证入口和真实 G2 交接约束。
- 新增 `.gitignore`，排除依赖、可重建 `dist/`、本地 Python 环境、下载 SDK 和临时浏览器产物；保留所有既有规范与验收证据。
- 纳入 npm 锁文件；Git 检出可使用 `npm ci`。真实 SDK 阶段在工程基线提交后继续推进，不据此升级 Gate。

## 1.0.0 — 2026-10-24（当前参考发行版本）

- 将原 V0.3 实施包作为 `1.0.0` **参考工作区版本**重新发布；`package.json` 和播放器展示统一使用 `1.0.0`。
- **不修改** GameSpec / Capability Manifest `0.1.0` 协议含义与版本；旧 V0.1/V0.2/V0.3 文档与日志保留为历史资料。
- 重写 README 为 Windows PowerShell 优先的完整上手、构建、测试、运行、SDK 安装、问题排查指南。
- 新增 `PROJECT-PLAN.md`（全部长期计划）、`PROJECT-STATUS.md`（当期真实 Gate）、`project/status.json`（机器可读阶段状态）、`AGENTS.md`（Agent 不偏航约束）、`scripts/check-project.mjs`（状态与覆盖一致性检查）。
- 无新玩法或新 SDK 通过声明；项目成熟度仍为 Alpha/Reference，CocosAirJS/Three.js 实际 G2 仍未执行。

## 历史基线（仅供追溯）

- V0.3：声明式 `scene2d`、GridPush、Swipe/InputTrace、Canvas2D Chromium 预览、双适配器 Mock 合同。
- V0.2：JCS/SHA256 状态哈希、完整静态 Schema、浏览器桥接预览。
- V0.1：Rule/State/Tick/Headless/初版 Conformance 与 GridSlideMerge。

历史实施报告：`IMPLEMENTATION-REPORT.md`；历史未来清单：`IMPLEMENTATION-NEXT.md`；原规范：`A2Game-V0.1-Spec/`。
