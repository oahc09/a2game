# A2Game 项目变更记录

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
