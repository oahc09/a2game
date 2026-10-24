# A2Game V0.1 · Browser Bridge Slice 2

**状态：隔离工作区实现，未提交 GitHub**。此文档为本轮增量交付与下一实施 Gate 的执行说明，协议仍为 `0.1.0`。

## 1. 实际完成

1. `src/exact-hash.ts`: 按 RFC 8785 字符串/键排序/ECMAScript 数值格式规范化，提供同步 SHA-256；`observe()` 返回 64 位十六进制 `exactHash`，版本为 1。投入实际校验的 projection 包含逻辑状态、实体 ID/Tag/离散 state、RNG、Timer、Deferred、源输入保持态等；不包含 GPU/表现缓存/宿主物理浮点转换，不能因此宣称物理跨引擎一致。
2. `scripts/preflight.py`: 使用 Python `jsonschema.Draft202012Validator` 校验原规范包所有 7 类 Schema 和实例；不是自制 JSON Schema 子集。`scripts/validate-one.py` 支持按单文件 Schema 校验和 JSON Pointer 错误回执。`compileGame()` 原有的运行时语义校验继续执行，二者是互补关系。
3. `scripts/create-validated-catalog.mjs`: 在 G0 全量结构校验 PASS 后，为 3 份当前受支持的游戏定义生成 JCS SHA-256 白名单；Web 演示页面加载时二次核对哈希和 revision，篡改的 JSON 不能进入播放器。这是一种针对随包发布的有限样例的发布门禁，**不是**一套通用的浏览器端 Draft 2020-12 Validator。
4. `player/index.html`、`player/main.mjs`: 浏览器播放器入口，三份已有游戏共享同一 Runtime；键盘、指针与方向按钮；固定步长和显式追帧超限暂停（不静默跳 tick），状态、Hash、HUD、暂停与重开可观察。
5. `player/adapters/`: Canvas2D 预览渲染器、真实 Three.js WebGL API 调用适配器、真实 CocosAirJS 场景/UI API 调用适配器的源码。两种外部 SDK 并未包含在 ZIP，真实 G2 仍为 `NOT_RUN`。
6. `test/exact-hash.test.mjs`、`test/adapters.test.mjs`、`test/schema-and-catalog.test.mjs`：哈希、事务/恢复、运行时 Schema 发行门禁、两种适配器 Mock Contract。
7. `scripts/browser-smoke.py`: 本机 Chromium 通过 `set_content()` 隔离执行编译自同一 TS 源码的 Runtime，浏览器 Canvas2D 预览绘制三款游戏；`scripts/verify-browser-parity.mjs` 比对其 Node.js 中相同序列的 exactHash。实际 HTML 网络导航受沙箱策略限制，不能以此冒充真实页面加载完整链路。

## 2. 快速运行

要求 Node.js 22+、TypeScript (`tsc`)；需要完整 Schema 校验时，Python 安装 `jsonschema>=4`。

```bash
npm run build
npm test
npm run spec:validate
npm run schema:full
npm run conformance
npm run catalog:build
npm run player:serve
```

随后在自己的可访问本地浏览器中打开：`http://127.0.0.1:8765/player/index.html`，默认 Canvas2D 预览。

选择 `backend=three` 需要将 **同一版本** Three.js 的 `three.module.js` 和 `three.core.js` 一并复制到 `player/vendor/`。选择 `backend=air` 需要将 CocosAirJS 官方 SDK `build/cocosair.module.js` 复制为 `player/vendor/cocosair.js`。不允许出现两份 AIR 主引擎实例。详细参考 `player/vendor/README.md`。

如需检查一份新 AI 输出的 JSON：

```bash
python scripts/validate-one.py game path/to/ai-generated.game.json
```

这只是 G0 结构校验；必须继续执行 `compileGame()` 的类型/引用/Capability 检查和相应玩法测试，才允许登记为可用内容。新游戏不在发布白名单中时，先扩展样例/能力并执行 `catalog:build`，不可通过禁用白名单绕过。

## 3. 状态与证据边界

| Gate | 结果 | 证据 | 未覆盖 |
|---|---|---|---|
| G0 JSON Schema | 当前 7 类 Schema/样例 PASS | `reports/schema-preflight.json`, `reports/g0-static.log` | 动态用户生成任意 JSON 的浏览器端 Full Schema 运行校验 |
| G1 Headless | 已实现子集 PASS | `reports/node-tests.tap`, `reports/conformance.json`, `reports/browser-node-parity.json` | 32 游戏全量能力、3D/物理/IMU/复杂输入 |
| G2 Browser Preview | 三款游戏基于同一 TS 运行时和 Canvas2D 绘制 PASS（**非 G2 双引擎**） | `reports/browser-core-smoke.json`, `reports/browser-actual-core-*.png` | 真实页面完整网络加载链路 |
| G2 CocosAirJS | `NOT_RUN` | `test/adapters.test.mjs` 仅 Mock Contract | SDK、实际材质/Canvas/触摸、重启、画面 |
| G2 Three.js | `NOT_RUN` | `test/adapters.test.mjs` 仅 Mock Contract | 真实 WebGL2 SDK、GPU/输入/尺寸/资源释放 |
| G3 玩法和 Agent | `NOT_RUN` | 未提供 | 32款玩法、AI one-shot 和可玩性 |

### 原因

真实网址在当前容器中的 Playwright/Chromium 因环境网络策略返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`，包括 `127.0.0.1`；没有从 GitHub 拉取或安装发行 JS SDK。尽管利用隔离页面验证了 Chromium 中的同源 TS Core 与 Canvas2D 绘制，但不能将这种测试等同于任何真实 SDK 的端到端验证。

## 4. 下一轮必须解决

- 在能正常使用 Web SDK 的 CI 环境，采用相同三份游戏文件跑两个独立浏览器地址，记录 `runId/commit SHA/截图/输入 Trace/状态 Hash`；确定 renderer 和摄像机坐标、颜色、生命周期接口一致。
- 将 Capability Manifest 的 `presentation` 声明映射补充成受约束的形状、文字、Sprite/Mesh/Transform，而不是当前例子的演示层按状态名字自动识别棋盘。引擎适配应由规范驱动，而非根据 `state.board` 做游戏种类判断。
- 完成浏览器全量 Draft 2020-12 校验（例如通过已验证的 Ajv 2020 构建），或将远程 AI JSON 的入口严格限定在后端/构建时全量验证之后。
- 继续完善 Touch（多指、拖动、取消与 hit-test）、IMU（授权、采样单位、归一化、回退）、物理 Profile 以及基于新游戏类型的 Capability 扩展。
- 32 玩法保持 `planned`，不能由本轮三份演示样例推算覆盖率达标。
