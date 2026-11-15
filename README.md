# A2Game：让 AI 创作游戏，用 JSON 交付和运行

A2Game 让 AI Agent 根据需求编写游戏，再检查、试玩并导出游戏包。应用加载通过检查的游戏包后，就能运行游戏，不需要在游玩时再次调用 AI。

同一份游戏 JSON 可以交给 CocosAirJS 或 Three.js 显示。移动、战斗、计分等玩法由同一套运行程序处理。

**当前是开发中的试用版本，不是已经完成全部验收的正式产品。** 项目发行版本为 A2Game 1.0.0，游戏 JSON 的协议版本为 `0.1.0`。

## 从这里开始

| 你想做什么 | 阅读入口 |
| --- | --- |
| 先玩现有游戏 | [三款游戏与启动方法](games/phase2/README.md) |
| 了解已经做到哪一步 | [当前进展](PROJECT-STATUS.md) |
| 让其他 AI Agent 创作游戏 | [Agent 使用任务](docs/host-agent-pilot.md) |
| 把游戏放进自己的网页 | [Player SDK 使用说明](packages/player-sdk/README.md) |
| 在本机生成作品并切换、回退交付版本 | [生成与版本交付服务](packages/delivery-service/README.md) |
| 配置管理员、持久化队列和重启恢复 | [单管理员服务运维说明](docs/service-operations.md) |
| 保存新版、导出或回退游戏 | [本地版本管理](packages/content-delivery/README.md) |
| 查看后续开发安排 | [第二阶段计划](docs/A2Game-Game-Creation-Delivery-Phase2.md) |

## 一、现在可以做什么

- **创作和检查游戏**：Agent 编写 GameSpec（游戏 JSON），通过现有工具检查格式、能力和玩法规则，再按错误提示修改。
- **在浏览器玩游戏**：已有推箱子、纵版射击、合成炮台作品；具体玩法和测试范围见各自说明。
- **复用素材**：提供三个 2D 主题，以及树、岩石和货箱的基础 3D 组合，见[素材使用说明](docs/creation-library.md)。
- **嵌入网页**：可以打包独立播放器，支持按钮、持续按键、暂停、重开和关闭。接口仍在试用阶段。
- **管理版本**：可保留旧包、核对SDK并在同源网页切换和回退；启用持久化后可恢复任务与发布记录。
- **运行创作服务**：可配置单管理员登录和发布权限，使用有界单Worker持久化生成队列；HTTPS代理入口已提供配置约束，实际部署和TLS验收待执行。
- **准备 Android 接入**：WebView 示例已能编译，但还没有在 Android 设备上验证运行。

目前仍需完善游戏质量和素材。正式 G3 验收、37 款游戏的完整验收，以及真机测试分别记录，不能把某次通关视为全部通过。详细结果见[当前进展](PROJECT-STATUS.md)。

## 常用名称

| 名称 | 在项目中表示什么 |
| --- | --- |
| Agent / 宿主 | 执行创作任务的 AI，以及承载它的工具，例如 WorkBuddy |
| Skill | 给 Agent 阅读的创作说明和操作步骤 |
| MCP | Agent 查询能力、检查游戏、预览和导出时使用的工具接口 |
| GameSpec | 描述玩法、输入和画面的游戏 JSON |
| Runtime | 负责推进游戏、处理规则和保存状态的运行程序 |
| Player SDK | 供业务网页嵌入游戏的播放器代码 |
| G3 | 项目规定的正式独立生成验收，和普通试玩分开统计 |

## 本地开发前先了解

下面保留完整安装与运行步骤。只想试玩第二阶段作品，可先看[作品入口](games/phase2/README.md)。AI 开发助手还需阅读 [AGENTS.md](AGENTS.md)。

历史测试结果仅说明当时的代码和环境；当前是否可用，以实际运行结果为准。[旧版首页说明](docs/history/readme-overview-before-plain-language-2026-11-08.md)保留供查阅。

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
- 若因代理/断网导致安装失败，属于运行环境问题；应先修复网络或依赖，不能跳过格式检查后发布新 JSON。

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

点击“导入游戏 JSON”可运行未加入内置白名单的新定义。文件先由同源本地服务完成完整 Draft 2020-12、组件/绑定配置、引用/能力及宿主策略校验，再按带 SHA256 的回执加载；失败显示错误码与 JSON Pointer，并保留当前游戏。当前支持声明范围内的单场景 scene2d/Stage、键盘、Touch/IMU 和 Gamepad 输入参考 Profile，未审核资源或未实现能力明确拒绝。文件上限 256 KiB，回执默认保存在 `.a2game/releases/`（不入库）；相同环境下服务重启后仍可加载，环境改变须重新导入。自定义目录和恢复规则见[本地内容准入](docs/content-release.md)。

**退出：** PowerShell 中按 `Ctrl+C`。如果端口被占用，可在启动前使用：

```powershell
$env:A2GAME_PORT='8766'
npm run player:serve
# 改为访问 http://127.0.0.1:8766/player/index.html
```

不要双击 `player/index.html` 用 `file://` 打开：页面通过 HTTP 加载 JSON、模块和白名单。对于不信任的 AI JSON，**不得**跳过完整格式/引用/能力校验直接在页面动态加载。

## 三、让 Three.js / CocosAirJS 真实运行和复验 G2

先完成第二节的构建与校验，再开始本节。2026-10-24 已在 Windows/Chromium `156.0.8078.4`、WebGL2 ANGLE SwiftShader 上通过四样例 G2；新机器或 SDK/源码变化后应重新运行，不能沿用这次 PASS。

### 方式 A：Three.js（首次需要联网）

在项目根目录：

```powershell
npm ci
Copy-Item .\node_modules\three\build\three.module.js .\player\vendor\three.module.js
Copy-Item .\node_modules\three\build\three.core.js .\player\vendor\three.core.js
npm run player:serve
```

浏览器访问：`http://127.0.0.1:8765/player/index.html?backend=three`。

`three.module.js` 会相对导入 `three.core.js`，两者必须为相同版本。Three.js 和浏览器工具已作为固定版本开发依赖锁定；基础 Headless Runtime 没有新增生产依赖。完整双引擎验证建议使用下面的 `sdk:prepare` 自动复制并记录 SHA。

### 方式 B：CocosAirJS（需要可访问的真实引擎 SDK）

源码版本固定在 `project/sdk-lock.json`。首次准备时，在独立的 `.tools/cocosairjs` 工作副本中执行：

```powershell
git clone https://github.com/oahc09/cocosairjs.git .tools/cocosairjs
git -C .tools/cocosairjs checkout --detach fa54a3f6942bfb3035d5c92d174a054ec4ab55ab
Push-Location .tools/cocosairjs
npm ci --ignore-scripts
$env:NODE_OPTIONS = '--max-old-space-size=6144'
npm run build
Pop-Location
npm run sdk:prepare
npm run player:serve
```

浏览器访问 `http://127.0.0.1:8765/player/index.html?backend=air`。如果已有相同版本的引擎工作副本，可设置 `$env:A2GAME_AIR_ROOT='D:\dev\cocosairjs'` 后运行 `npm run sdk:prepare`。脚本检查真实版本和源代码提交，生成本地 `player/vendor/sdk-provenance.json`；SDK JS 不入库。

该演示采用 CocosAirJS `createAirApp`/容器模式，不依赖 WebGPU、Box2D3 或 Spark 额外资源。具体布局见 [`player/vendor/README.md`](player/vendor/README.md)。引擎关闭后按官方契约重载文档；context loss 后提供“重新加载”入口开始新一局。

### 自动复验

```powershell
npx playwright install chromium
npm run g2:real
```

脚本自行启动本地临时端口 HTTP 服务和真实 Chromium，关闭后保存独立 `reports/g2-<时间>-<进程>/`。包括 16 个游戏/视口场景、2 个原生时钟/context loss 场景、8 组 Node/Three/AIR Hash 对照、SDK SHA、截图像素、DOM 输入日志、浏览器 Trace、资源与关闭回执。当前指针为 `reports/g2-threejs-real.json` / `reports/g2-cocosairjs-real.json`；失败尝试保留。

验证页面使用显式 `clock=manual` 接管玩法 Tick，渲染继续随 rAF 更新；另有正常时钟的实际交互验收。普通页面不记录输入操作。移动尺寸/DPR 模拟不等于移动真机 Touch/IMU，WebGL2 软件驱动不等于物理 GPU；不保证两个 SDK 文字逐像素相同或总 GPU 内存零泄漏。

### G2 的实际完成标准

对**同一份 JSON**在两个真实 SDK 中验证：启动并绘制、键盘/Pointer 操作、暂停/继续、重开、释放/二次初始化约束、不同 DPR/尺寸、报错归因、Node↔Host `exactHash`。保存真实截图/浏览器/SDK SHA/Trace/日志；各自成功再把 `PROJECT-STATUS.md` 的对应 Gate 改为 PASS。**Canvas2D/Mock/Headless 的成功不算真实 G2。**

## 四、开发 / 验证新 AI 游戏 JSON

1. 读取 `specs/v0.1/docs/01-GameSpec-V0.1.md`、`02-Capability-Manifest-V0.1.md`，从 `games/*.game.json` 复制合法最小例子；确保 `specVersion` 仍符合当前协议 `0.1.0`。
2. 基于已**实现**的 Capability 而不是候选目录生成游戏、资源和测试；禁止 `eval`、脚本 URL 或任意 TS 函数注入。
3. 先在本地进行**完整 Schema** 验证（命令中把路径换成真实文件路径）：

```powershell
python scripts/validate-one.py game 'D:\dev\a2game-custom\my-game.game.json'
```

4. 再进行 `compileGame` 的引用、版本、依赖和语义检查；为新玩法提交单元测试与 Conformance（只通过 Schema 并不等于可运行）。
5. 新 JSON 可直接通过“导入游戏 JSON”或 `POST /api/releases` 完成服务端全量校验及回执加载，无需改动内置样例。若要纳入仓库内置白名单，再将评审后的 JSON 加入 `specs/v0.1/games/`、更新选择器与加载路由并运行 `npm run verify`。完整准入流程见 [content-release.md](docs/content-release.md)，浏览器复验命令为 `npm run content:e2e`。
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
a2game/
├── README.md                   # 你正在阅读：完整操作说明
├── AGENTS.md                   # 其他 Agent 的持续执行约束
├── PROJECT-PLAN.md             # 全部阶段、32 游戏、5 组合、DoD、变更纪律
├── PROJECT-STATUS.md           # 当前所在阶段与实际 Gate
├── CHANGELOG.md                # 发行变化与历史追溯
├── project/status.json         # 机器可读状态；project:check 守护
├── specs/
│   └── v0.1/                  # GameSpec/Capability/Tick/Conformance 协议 0.1.0
│       ├── docs/              # 主规范、表现/输入契约及历史基线
│       ├── schemas/           # 7 个 JSON Schema
│       ├── capabilities/      # 可用能力说明
│       ├── games/             # 参考游戏与候选作品
│       ├── tests/             # 玩法检查文件
│       ├── examples/          # JSON 格式示例
│       └── tools/             # 此版本的规范构建与静态校验工具
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
| CocosAirJS 模块找不到或启动失败 | 运行 `sdk:prepare` 核对锁定源码；检查 Console、canvas/container、资源路径；本机以新 G2 回执为准 |
| `python scripts/browser-smoke.py` 报 Playwright/Chromium | 本脚本是可选真浏览器回归；先装 Playwright/Chromium，平台阻断则记录 BLOCKED |
| 用户新 JSON 的字段通过但游戏不运行 | Schema 只验证结构；还需 Manifest/语义/能力实现、Conformance 与必要资源 |

## 八、接下来做什么

当前工作是改善三款游戏的体验、丰富素材，并推进独立播放器和客户端使用。具体完成项、已知问题和后续顺序见[当前进展](PROJECT-STATUS.md)及[第二阶段计划](docs/A2Game-Game-Creation-Delivery-Phase2.md)。

`reports/` 保存本地运行记录，`output/` 保存生成的包；它们不随 Git 源码交付。新检出的仓库缺少旧报告时，应区分“历史记录没有恢复”和“当前功能运行失败”，不要补写不存在的测试结果。见[仓库维护说明](docs/repository-maintenance.md)。
