# A2Game V0.3 · Presentation + Gameplay 增量实施及验收报告

> **历史证据（V0.3 实施切片）**：这份文档保留当时的结果和命名。项目现行发行版本为 **1.0.0**，当前阶段/完整路线图见 [PROJECT-STATUS.md](PROJECT-STATUS.md) 与 [PROJECT-PLAN.md](PROJECT-PLAN.md)。GameSpec/Capability 协议仍为 `0.1.0`。


日期：2026-10-24；GameSpec / Capability Manifest：`0.1.0`；实现方式：**在隔离目录内增量开发，不更改远程引擎仓库。**

## 结论

本轮交付真实可运行的 **声明式 Presentation 投影器**、第二套独立 **推箱子玩法 Capability**、**Touch Swipe + 规范化输入轨迹回放**，并统一了 Canvas2D/Three.js/CocosAirJS Adapter 所消费的 `PresentationFrame`。游戏逻辑保持在同一个 TypeScript Headless Runtime 中，未在 Renderer 内按游戏名称写分支。

**实际通过**：Node 自动化测试 **54/54**；JSON Conformance **6 套、12/12 用例**；7 种 JSON Schema（Draft 2020-12）验证 **27 份文档**；Chromium 使用同源 TS Runtime 实际绘制 **4 款 JSON 游戏**，Node↔Chromium **5/5** 场景状态 Hash 一致（包含合成 Touch Swipe Trace）。

**明确未完成**：真实 CocosAirJS SDK G2 和 Three.js SDK G2 均 `NOT_RUN`；缺少发行 JS 文件且隔离环境禁止相应完整 URL 导航。没有把 Canvas2D、Mock 测试结果冒充真实双引擎通过。

## 1. 核心实现

| 交付 | 变更位置 | 验收范围 |
|---|---|---|
| `scene2d` 有界 DSL | `src/presentation.ts`、`A2Game-V0.1-Spec/schemas/game.schema.json` | rect/circle/text、静态及重复网格、状态绑定、调色板、帧内 640 条指令上限，纯只读、不允许脚本注入 |
| 统一的 Presenter 接口 | `player/adapters/{canvas-preview,three-adapter,cocosairjs-adapter}.mjs` | 同一 `PresentationFrame`，Adapter 不再窥探 `state.board` 或硬编码某游戏名称；AIR/Three 仅 Mock Contract 测试 |
| 推箱子 | `src/modules/grid-push.ts`、`samples/games/grid-push.game.json` | 玩家和箱子的占用检查、方向移动、推箱子、目标判断、重开回滚、非法移动不计步 |
| Touch Swipe | `src/runtime.ts`、`src/input-trace.ts`、`samples/tests/grid-push-swipe.input-trace.json` | Pointer ID、阈值、方向、取消、多点独立身份、半开 Tick 时间归属、合成轨迹回放 |
| 浏览器播放器 | `player/main.mjs`、`player/index.html` | DOM 输入只入队、正式逻辑 Tick 由单 rAF/accumulator 推进；可选预览/外部 SDK 后端；AIR 模式使用容器布局 |
| 发布门禁 | `scripts/preflight.py`、`scripts/create-validated-catalog.mjs` | 全 Draft 2020-12 校验已发布样例，输出 JCS/SHA-256 精确哈希白名单。未验证的新 JSON 不可直接进入演示播放器 |
| 新增规范 | `A2Game-V0.1-Spec/docs/06-*.md`、`07-*.md` | 表现扩展、输入回放、已实现/未实现的合同边界 |

原 V0.1、V0.2 文档保留为历史基线（`docs/08-*`、`docs/09-*`），协议版本未变。

## 2. 验收回执

| Gate / 指标 | 结果 | 当前证据 |
|---|---|---|
| Node Tests | **54 PASS / 0 FAIL** | `reports/v03-node-tests.tap` |
| Conformance Runner | **6 套 / 12 PASS / 0 FAIL** | `reports/v03-conformance.log`、`reports/conformance.json` |
| Draft 2020-12 Schema | **7 类 / 27 文档 PASS** | `reports/v03-schema-full.log`、`reports/schema-preflight.json` |
| 静态 Manifest 引用校验 | **11 个 Capability、4 游戏、32 候选、6 Suite PASS** | `reports/v03-spec-validate.log` |
| Chromium Core + Canvas2D | **5/5 场景 PASS**，真实 Canvas2D 画面 | `reports/v03-browser-smoke.log`、`reports/browser-actual-core-*.png` |
| Node↔Chromium ExactHash | **5/5 PASS**（4 游戏、1 Touch Trace 回放） | `reports/v03-browser-node-parity.log`、`reports/browser-node-parity.json` |
| G2 真实 Three.js | **NOT_RUN** | SDK 构建缺失；只有 Mock 适配器契约测试 |
| G2 真实 CocosAirJS | **NOT_RUN** | SDK 构建缺失；只有 Mock 适配器契约测试 |
| G3 完整玩法/Agent | **NOT_RUN** | 32 个 Coverage 候选均保持 `planned` |
| 真机 Touch/IMU | **NOT_RUN** | 仅已归一化合成 Touch 回放；IMU 只做数据结构检查 |

浏览器实际验证使用 Playwright/Chromium 的隔离 `set_content` 页面，把**同一份** `src/index.ts` 编译为 AMD 运行，并由 Canvas2D 绘图；它不覆盖 HTTP 导航、真实 Three.js/CocosAirJS 初始化、GPU、真机传感器和资源加载。

## 3. 浏览器结果

| 场景 | 操作来源 | Tick | 最终状态 | Node ↔ Chromium Hash |
|---|---|---:|---|---|
| `tap-target` | 语义动作×2 | 2 | `won`、score=2 | PASS |
| `grid-merge` | 语义左移 | 1 | 棋盘更新 | PASS |
| `grid-merge-spawn` | 语义左移 | 1 | 含固定种子补位 | PASS |
| `grid-push` | 右→上 | 2 | `won`、boxes=[7] | PASS |
| `grid-push-swipe` | Touch Trace（按第 10、27 Tick 识别手势） | 28 | `won`、boxes=[7] | PASS |

状态哈希是 **exact logical projection** 的 hash，不是像素一致性或宿主物理精度证明。五场景 Hash 明细见机器可读 `reports/browser-node-parity.json`。

## 4. 残留风险与工程边界

- 外部 SDK G2 仍未运行。Three.js 和 CocosAirJS 适配器的 GPU 输出、文字布局、响应式尺寸、销毁重建和上下文丢失没有真实验收，不得声明双引擎完全兼容。
- 运行时 `compileGame` 是受控语义校验；全 Draft 2020-12 是**构建时 Python**校验。本轮网站只允许加载预验证 SHA-256 白名单 JSON，未提供任意浏览器 AI JSON 的通用全 Schema 校验。
- `scene2d` 只支持 rect/circle/text/repeat；不支持 Sprite/Mesh/Shader、复杂 UI、动画、粒子、音效、3D。
- `touch.swipe` 只支持 down/up 阈值和方向判断。真正的多点 Pinch/Rotate、绘线、IMU 姿态、权限控制、传感器丢样仍未实现。
- 目前只有两套可复用益智算法模块（slide-merge、grid-push）和一个简单点击样例。32 款目标游戏均未满足完整覆盖门禁。
- 先前已完成的模拟器断言不能替代 Agent 从自然语言生成新 JSON 的验证，G3 应单独执行。

## 5. 下一步实施门禁

按照 `IMPLEMENTATION-NEXT.md`：先在有真实 ESM SDK 的受控浏览器环境执行双引擎 G2，记录引擎构建、输入、状态 hash、截图及释放证据；然后扩展 Sprite/Mesh、Match3、射击/塔防和 Touch/IMU 真机能力；每新增 Capability 同步维护 JSON Schema、Capability Manifest、Conformance Suite 和 Coverage Receipt。

## 6. 交付状态

**完成：** V0.3 独立源码、两份新增规范、4 份游戏 JSON、11 个 Capability Manifest、6 套 Conformance、测试日志、5 张 Chromium 截图、验证摘要和可复现脚本。

**未验证：** 真实 CocosAirJS G2、真实 Three.js G2、完整 32 游戏、物理与 IMU、Agent 自动生成质量。

**失败：** 当前已执行的自动化与静态用例没有失败；真实引擎 G2 由于 SDK 与导航环境条件不满足未能执行，并非通过。

**权限：** 未修改远程仓库，未进行提交、推送、部署或权限变更。
