# A2Game 1.0.0 — 独立游戏 JSON 播放器与共享 Runtime

**定位**：AI 直接生成 JSON → 全格式/语义校验 → 共享 TypeScript 玩法 Runtime → Canvas2D/CocosAirJS/Three.js 等可替换渲染宿主。

> **版本区别（重要）**：本源码包/`package.json` 的 **项目发行版本为 `1.0.0`**；它是 **Alpha 参考实现，未达到生产发布 Gate**。GameSpec、Capability Manifest、Tick/Rule 和 Conformance 的**协议版本仍为 `0.1.0`**，所以 `A2Game-V0.1-Spec/` 和 JSON 内 `specVersion` 不需要也不能直接改为 `1.0.0`。保留旧 V0.3 文档与测试日志作为可审计历史。
>
> **当前阶段：S2——真实 CocosAirJS + Three.js G2 验证准备。** 目前 Headless/Canvas2D 子集可运行；两份真实 SDK 均**未通过 G2**。完整全阶段计划见 [PROJECT-PLAN.md](PROJECT-PLAN.md)，真实进度见 [PROJECT-STATUS.md](PROJECT-STATUS.md)，后续 Agent 先读 [AGENTS.md](AGENTS.md)。 本轮操作和验收汇总见 [DELIVERY-REPORT.md](DELIVERY-REPORT.md)。

## 一、先看能运行什么

| 功能 / 后端 | 现在能否运行 | 说明 |
|---|---|---|
| TypeScript Headless Runtime | **可以** | 计时/规则/状态/回滚、合并、推箱子，Node.js 测试 |
| 浏览器 Canvas2D 预览 | **可以** | 4 份预校验 JSON 游戏，无外部游戏引擎 SDK |
| Three.js Renderer | **有源码，真实 G2 未验证** | 需要安装固定版本 ESM；第一次本机运行需单独核验 |
| CocosAirJS Renderer | **有源码，真实 G2 未验证** | 需要已有 CocosAirJS 引擎构建；不能凭 Mock 判 PASS |
| 32 款完整小游戏、5 个混合玩法、IMU 真机、AI one-shot | **未实现/未验收** | 保留在路线图，不因版本 1.0.0 改称已完成 |

已包含的可交互游戏（只在当前定义/能力子集内运行）：

| 播放器选项 | 作用 | 控制 |
|---|---|---|
| 点击计分 `tap-target` | 点击触发计分/完成目标 | 点击游戏画布、空格、界面中央 `●` |
| 合并网格 `grid-merge` | 类 2048 网格滑动合并 | 方向键、画布 Swipe、页面方向按钮 |
| 随机补位 `grid-merge-spawn` | 合并后固定种子随机补位 | 同上 |
| 推箱子 `grid-push` | 移动/推箱入目标格 | 同上；附录有 Swipe Trace 回放 |

## 二、Windows PowerShell：从解压到第一个游戏（推荐）

**环境要求**：Windows 10/11、Node.js **22+**（同时包含 npm）、Python **3.10+**、Chrome/Edge。Node/npm/Python 请先从各自官方发行渠道安装；设置 PATH 后打开**新的 PowerShell**。`npm install` 和 `pip install` 首次可能需要正常网络访问；不需要 WSL2、Docker、Cocos Creator。

### 第 1 步：解压与进入项目

1. 将交付 ZIP 解压，例如 `D:\dev\A2Game-1.0.0`。
2. 打开 PowerShell，进入**有 `package.json` 的目录**：

```powershell
Set-Location 'D:\dev\A2Game-1.0.0'
Get-Item .\package.json
node --version
npm --version
python --version
```

如果解压后还有一层同名目录，则进入**内层**，直到 `Get-Item .\package.json` 成功。

### 第 2 步：安装开发依赖

```powershell
npm install
python -m pip install -r requirements-dev.txt
```

- 仓库已纳入 `package-lock.json`，从 Git 检出后推荐 `npm ci`，安装固定的 `typescript@5.8.3`。基础 Runtime 不依赖 CocosAirJS、Three.js；真实 SDK 需按第三节准备。
- `jsonschema==4.26.0` 提供**完整 Draft 2020-12** 的校验器，缺它会使 `schema:full` 失败。Windows 没有 `python` 命令时可以使用 `py -3 -m pip install -r requirements-dev.txt`，并按本机情况为后续脚本设置 Python 别名。
- 若因代理/断网导致安装失败，这是 **INFRA BLOCKED**；不能以跳过 Schema 校验的方式继续发布新 JSON。

### 第 3 步：构建与校验

```powershell
npm run build
npm run project:check
npm run verify
```

`npm run verify` 将依次执行 `project:check`、Node 单测、静态规范校验、完整 Schema、JSON Conformance 和 `catalog:build`（会重建 `player/validated-games.json`）。全部完成再启动游戏。可以单独执行：

```powershell
npm test                  # 构建 + Node 自动化测试
npm run spec:validate    # 原规范内容/引用静态校验
npm run schema:full      # 7 种 Draft 2020-12 Schema 完整校验
npm run conformance      # JSON 一致性套件
npm run catalog:build    # 更新已验证样例白名单和内容哈希
```

旧 V0.3 测试基线是 **54/54 Node、6 套 12/12 JSON Conformance**；在你的本机应以**实际命令输出**为准，不能因为旧报告写 PASS 就认为新环境验证通过。

### 第 4 步：启动本地播放器

```powershell
npm run player:serve
```

服务默认**只监听 `127.0.0.1:8765`**。浏览器打开：

- [http://127.0.0.1:8765/player/index.html](http://127.0.0.1:8765/player/index.html)
- 明确选择预览后端：[http://127.0.0.1:8765/player/index.html?backend=preview](http://127.0.0.1:8765/player/index.html?backend=preview)

默认 `tap-target` 可直接点击画布或按空格；顶部“游戏”切换其他 JSON，方向键/滑动/页面方向键控制网格玩法。右侧显示状态、Tick 与 SHA-256 exact 状态哈希。“重新开始”重置一局，“暂停/继续”控制游戏时间。

**退出：** PowerShell 中按 `Ctrl+C`。如果端口被占用，可在启动前使用：

```powershell
$env:A2GAME_PORT='8766'
npm run player:serve
# 改为访问 http://127.0.0.1:8766/player/index.html
```

不要双击 `player/index.html` 用 `file://` 打开：页面通过 HTTP 加载 JSON、模块和白名单。对于不信任的 AI JSON，**不得**跳过完整格式/引用/能力校验直接在页面动态加载。

## 三、让 Three.js / CocosAirJS 真实运行（实验性 G2）

先确保第二节的 Canvas2D 已通过，再开始本节；两者仍需在你的机器上完成独立 G2 E2E 验收。

### 方式 A：Three.js（首次需要联网）

在项目根目录：

```powershell
npm install --no-save three@0.186.1
Copy-Item .\node_modules\three\build\three.module.js .\player\vendor\three.module.js
Copy-Item .\node_modules\three\build\three.core.js .\player\vendor\three.core.js
npm run player:serve
```

浏览器访问：`http://127.0.0.1:8765/player/index.html?backend=three`。

**注意：** `three.module.js` 会相对导入 `three.core.js`，必须复制**相同版本的两份文件**。`npm install --no-save` 只用于取得 SDK，本项目基础 Runtime 不依赖它；请记录实际 Three.js 版本/文件 SHA 并运行 G2 检查。这个步骤不是宣布 G2 已通过。

### 方式 B：CocosAirJS（需要你的引擎 SDK）

1. 在已有的 `oahc09/cocosairjs` 构建目录中取得实际 `build/cocosair.module.js`；必要时参考 [CocosAirJS 官方仓库 README](https://github.com/oahc09/cocosairjs) 执行 `npm ci`、`npm run build:all`。这是**另一个仓库**，不要在当前 A2Game 目录内执行它的构建命令。
2. 从 CocosAirJS 构建目录复制主 JS 到 `player/vendor/cocosair.js`，保持页面只使用这**同一份引擎入口**：

```powershell
$airBuild = 'D:\dev\cocosairjs\build\cocosair.module.js'  # 根据实际路径修改
Copy-Item $airBuild .\player\vendor\cocosair.js
npm run player:serve
```

3. 浏览器访问 `http://127.0.0.1:8765/player/index.html?backend=air`。

仅在 SDK 文件存在后尝试此后端。该演示采用 CocosAirJS `createAirApp`/容器模式，不依赖 WebGPU、Box2D3 或 Spark 额外资源。具体依赖布局参见 [`player/vendor/README.md`](player/vendor/README.md)。首次可能暴露 Adapter 错误；记录引擎 SHA、浏览器 Console、截图、输入轨迹和资源释放结果，不能把失败默认为通过。

### G2 的实际完成标准

对**同一份 JSON**在两个真实 SDK 中验证：启动并绘制、键盘/Pointer 操作、暂停/继续、重开、释放/二次初始化约束、不同 DPR/尺寸、报错归因、Node↔Host `exactHash`。保存真实截图/浏览器/SDK SHA/Trace/日志；各自成功再把 `PROJECT-STATUS.md` 的对应 Gate 改为 PASS。**Canvas2D/Mock/Headless 的成功不算真实 G2。**

## 四、开发 / 验证新 AI 游戏 JSON

1. 读取 `A2Game-V0.1-Spec/docs/01-GameSpec-V0.1.md`、`02-Capability-Manifest-V0.1.md`，从 `samples/games/*.game.json` 复制合法最小例子；确保 `specVersion` 仍符合当前协议 `0.1.0`。
2. 基于已**实现**的 Capability 而不是候选目录生成游戏、资源和测试；禁止 `eval`、脚本 URL 或任意 TS 函数注入。
3. 先在本地进行**完整 Schema** 验证（命令中把路径换成真实文件路径）：

```powershell
python scripts/validate-one.py game 'D:\dev\a2game-custom\my-game.game.json'
```

4. 再进行 `compileGame` 的引用、版本、依赖和语义检查；为新玩法提交单元测试与 Conformance（只通过 Schema 并不等于可运行）。
5. 把经过完整评审的游戏 JSON 添加到 `A2Game-V0.1-Spec/samples/games/`；如果需在内置播放器选择器中出现新的游戏，还必须更新 `player/index.html` 的 `#game` 选项及 `player/main.mjs` 的白名单/加载路由（目前尚不是通用动态游戏浏览器）。运行 `npm run verify` 重建可信 SHA256 白名单后，才允许页面加载该文件。
6. 如果能力缺失，按 `PROJECT-PLAN.md` 的 Capability DoD 新增模块与 Manifest/测试/Adapter，而不是把实现藏在 JSON 里或直接调用某一个引擎接口。

## 五、可选：Chromium 截图与 Node↔Browser 哈希对照

这是 **Canvas2D + 共享 TS Runtime** 的独立浏览器回归测试，**不涉及真实 Three.js/CocosAirJS**。额外安装：

```powershell
python -m pip install playwright
python -m playwright install chromium
python scripts/browser-smoke.py
node scripts/verify-browser-parity.mjs
```

产生/更新 `reports/browser-actual-core-*.png`、`reports/browser-core-smoke.json`、`reports/browser-node-parity.json`。需要 Chromium；在受限网络或不可启动浏览器的机器上明确标记 **BLOCKED**，不能保留旧日志而宣称本次通过。移动设备真实 IMU、触摸硬件不属于上述脚本范围。

## 六、目录地图与全部计划

```text
A2Game-1.0.0/
├── README.md                   # 你正在阅读：完整操作说明
├── AGENTS.md                   # 其他 Agent 的持续执行约束
├── PROJECT-PLAN.md             # 全部阶段、32 游戏、5 组合、DoD、变更纪律
├── PROJECT-STATUS.md           # 当前所在阶段与实际 Gate
├── CHANGELOG.md                # 发行变化与历史追溯
├── project/status.json         # 机器可读状态；project:check 守护
├── A2Game-V0.1-Spec/          # 0.1.0 GameSpec/Capability/Tick/Conformance 正式协议及样例
│   ├── docs/01-...04-*.md      # 四份主规范
│   ├── docs/05-...07-*.md      # 32 游戏扩展、Presentation、Touch/Trace
│   ├── schemas/               # 7 个 JSON Schema
│   └── samples/               # GameSpec、Capability、Coverage、Conformance、Trace
├── src/                       # 共享 TypeScript 玩法/表现/输入参考实现
├── test/                      # Node 单元和 Mock Adapter 测试
├── player/                    # Canvas2D/Three/AIR 浏览器播放器和 SDK vendor 布局
├── scripts/                   # build checks、Conformance、Browser smoke 和静态服务器
├── dist/                      # TypeScript 构建产物（可重建）
└── reports/                   # 历史及本轮验收日志、Canvas2D 实际截图
```

全部计划包括：Core、Puzzle、Realtime、Combat、Strategy/Economy、TurnBased、2D/3D Presentation、Touch/IMU、真实 SDK/物理服务、32 个基础玩法（G01–G32）和 5 个跨类型场景（H01–H05）、Agent JSON 生成/修复、Headless/Host/移动端 Conformance、产品化与未来 Host 接入。每个工作流的输入、输出、Gate 和 DoD 在 [`PROJECT-PLAN.md`](PROJECT-PLAN.md) 固定；**当前进度不能只看 README 宣传内容**，必须同时核对 [`PROJECT-STATUS.md`](PROJECT-STATUS.md) 和机器可读台账。

## 七、遇到问题先看这里

| 现象 | 常见原因与处理 |
|---|---|
| `node` / `npm` / `python` 找不到 | 未安装或 PATH 未生效；确认新 PowerShell、`node --version`、`python --version` |
| `'tsc' is not recognized` | 先执行 `npm install`；必要时 `npm exec -- tsc --version`，不要手工修改 `src` 绕过构建 |
| `No module named jsonschema` | 执行 `python -m pip install -r requirements-dev.txt`；确认 pip 与执行脚本使用同一 Python |
| `npm ci` 报找不到 lockfile | 确认检出仓库中的 `package-lock.json`；旧源码包首次可执行 `npm install` |
| `EADDRINUSE 8765` | 换端口 `$env:A2GAME_PORT='8766'`，或先关闭占用该端口的进程 |
| 404、CORS、JSON 读取失败 | 用 `npm run player:serve` 通过 HTTP 访问；不要用 `file://` |
| `A2G_E_RELEASE_INTEGRITY` / 游戏未验证 | 修改过 JSON 但未执行 `npm run schema:full` + `npm run catalog:build`；禁止关闭白名单/哈希检查 |
| Three.js 模块找不到 | 复制相同 `0.186.1` 版本的 `three.module.js` 和 `three.core.js` 到 `player/vendor/` |
| CocosAirJS 模块找不到或启动失败 | 先确认真实 SDK 构建及其依赖、浏览器 Console、canvas/container 和资源路径；G2 仍属未验证 |
| `python scripts/browser-smoke.py` 报 Playwright/Chromium | 本脚本是可选真浏览器回归；先装 Playwright/Chromium，平台阻断则记录 BLOCKED |
| 用户新 JSON 的字段通过但游戏不运行 | Schema 只验证结构；还需 Manifest/语义/能力实现、Conformance 与必要资源 |

## 八、当前完成情况和下一个可执行任务

**本轮 1.0.0 隔离复验**：55/55 Node tests、12/12 JSON Conformance、7 Schema/27 文档、4 游戏 JSON、5/5 Node↔Chromium Hash PASS；本地 HTTP 返回 200，但 Chromium `page.goto()` 被环境策略拦截。证据见 [`reports/release-1.0.0-validation.json`](reports/release-1.0.0-validation.json)，真实双引擎 G2 仍 NOT_RUN。

**未完成/未验证**：真实 CocosAirJS 和 Three.js G2；动态 AI JSON 的浏览器全 Schema；Sprite/Mesh/Camera/Particles/Audio；三消与塔防/射击完整模块；多点/IMU 真机；32+5 全量玩法；Agent G3。

**下一阶段**：按 [PROJECT-PLAN.md §5](PROJECT-PLAN.md) 做真实 SDK 的 G2，再逐步推进其他所有规划能力。研发变更时同步 [PROJECT-STATUS.md](PROJECT-STATUS.md)、[`project/status.json`](project/status.json) 与 `CHANGELOG.md`；不能把失败、未测或 Mock PASS 改成已完成。
