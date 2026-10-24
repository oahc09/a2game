# A2Game 项目变更记录

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
