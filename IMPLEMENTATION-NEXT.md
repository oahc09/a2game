# A2Game V0.3 — 增量交付、未验证项与下一实施 Gate

> **历史证据（V0.3 实施切片）**：这份文档保留当时的结果和命名。项目现行发行版本为 **1.0.0**，当前阶段/完整路线图见 [PROJECT-STATUS.md](PROJECT-STATUS.md) 与 [PROJECT-PLAN.md](PROJECT-PLAN.md)。GameSpec/Capability 协议仍为 `0.1.0`。


状态：**隔离目录完成；未触及 `oahc09/cocosairjs` 仓库，未提交、推送、部署。** 协议版本保持 `0.1.0`。

## A. 本次已经实现并测试

1. **声明式表现**：在 GameSpec `presentation.scene2d` 增加 `rect/circle/text/repeat` 的只读绑定与 640 条绘制命令预算，产出统一 `PresentationFrame`。四份游戏 JSON 均只靠内容定义完成绘制，无游戏名驱动的 Renderer 分支。全 Schema 与运行时语义双层校验。
2. **第二个可复用玩法**：`a2game.puzzle.grid-push@0.1.0` 提供推箱子的网格占用、推动、非法移动拒绝、步数和目标判定；与显示及输入来源无关。新增一份游戏 JSON + 三条 Conformance 测试。
3. **Touch Swipe + Trace Replay**：`touch.swipe` 声明的方向、位移、持续时间规则，支持 Pointer ID、取消和短距离拒绝；`InputTrace` 校验半开 Tick 时间归属，并可将归一化 Touch 轨迹回放到 Headless。同一合成轨迹在 Node 和 Chromium 上达到相同 `exactHash`。
4. **双 Renderer 代码**：Three.js 和 CocosAirJS 的适配器均只消费通用 PresentationFrame，完成 Mock 接口/资源释放契约。CocosAir 适配器改为容器布局。播放器的 DOM 输入只排队，单一 rAF/accumulator 推进正式 Tick。
5. **真 Chromium Core**：Chrome 隔离页执行由 `src/index.ts` 编译的相同 TypeScript 逻辑，Canvas2D 实际绘制四款游戏，并回放第五个 Swipe Trace 场景。

## B. Gate 回执

| Gate | 状态 | 证据 |
|---|---|---|
| G0 `7` 类 Schema，对 `27` 份数据 | PASS（当前包静态样例） | `reports/v03-schema-full.log` |
| G0 11 Capability / 4 游戏 / 32 候选 / 6 Suite 引用 | PASS | `reports/v03-spec-validate.log` |
| G1 Node Runtime | 54/54 PASS（子集） | `reports/v03-node-tests.tap` |
| G1 Conformance | 6 套 / 12/12 PASS（子集） | `reports/v03-conformance.log`、`reports/conformance.json` |
| Browser Core 与显示 | 5/5 PASS，4 个游戏；非 G2 | `reports/v03-browser-smoke.log`、`reports/browser-actual-core-*.png` |
| Node↔Chromium ExactHash | 5/5 PASS | `reports/v03-browser-node-parity.log`、`reports/browser-node-parity.json` |
| G2 AIR | NOT_RUN | 真实 `cocosair.module.js` 缺失，导航受环境限制 |
| G2 Three | NOT_RUN | 真实 `three.module.js`/`three.core.js` 缺失，导航受环境限制 |
| G3 Gameplay/Agent | NOT_RUN | 32 候选都保留 planned；未做 AI 生成/难度/可玩性实测 |

## C. 真实双引擎 G2 实施合同

在具备合法 SDK 和浏览器 URL 导航条件的隔离 CI 中，运行相同的四份 GameSpec：

- 锁定 Three.js SDK 版本与 CocosAirJS 构建 SHA，记录各自依赖及 hash；按 `player/vendor/README.md` 部署一份 AIR 主引擎。
- 使用真实 HTTP 入口加载 `player/index.html?backend=air` 和 `...?backend=three`，不能用 Mock 替代。
- 通过真实 Pointer 与 Keyboard 事件驱动 `tap-target`、`grid-merge`、`grid-push`；收集各端 `tickIndex`、完整 exact 状态 hash、输入事件数、截图、错误、加载/暂停/重开/销毁回执。
- 区分视觉坐标与文本布局、DPR 改变、横竖屏、context loss、释放后遗留监听或 GPU 资源、第二局重开等失败归因。
- 同样初态/规范化输入时逻辑 hash 必须相同。宿主相关的绘制/物理按 profile 做容差与语义比较，而非用像素 hash 强行一致。
- 任一原生 SDK 报错则记录 `G2 FAIL` 及最小复现，**不可**把截图显示或 Mock PASS 解释成成功。

## D. 继续扩展 Gameplay 和输入

先完善 `Sprite/Texture/Mesh/Camera` 的版本化 Manifest 和受控资源引用，再实施 Match3、层叠槽位消除、实时运动/射击/塔防模块。每增加模块同时提交游戏 JSON、可复现正反例、Conformance Suite、Canvas 或真实引擎证据；动态更新 Coverage Registry，但不能自动将 `planned` 改为 `verified`。

Touch 后续补采样频率、move/coalesced path、真机 Pointer capture、权限化输入轨迹录制；IMU 后续另行实现权限探测、坐标参考、采样滤波、Tilt/Shake、失效回退。当前仅有归一化 IMU 样本校验，**没有**可用的 IMU 操作能力。

现有全 Schema 采用构建时 Python jsonschema，页面只加载哈希白名单中的预验证内容。如果允许用户在浏览器中输入新的 AI JSON，必须另行提供等效完整 Draft 2020-12 校验器，不能降级为只执行 TypeScript `compileGame` 的子集。

## E. 固定边界

- 原有 Spec 主体、Runtime Gate 和历史实现基线全部保留；增量附加详见 `A2Game-V0.1-Spec/docs/06-*.md` 与 `07-*.md`。
- 不允许新游戏协议字段绕过安全注册表加载任意代码。
- Headless 与 Renderer 分离，禁止为了扩展表现重新实现玩法状态。
- 不执行未授权的 GitHub 提交、推送、部署和凭据处理。
