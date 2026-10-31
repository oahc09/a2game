# A2Game 1.0.0 — 独立游戏 JSON 播放器与共享 Runtime

2026-10-31 顺序推进结果：Batch A/B/C保留工程参考；Batch D的5任务×2模式已真实执行10/10，30次调用含1次宿主中止，9/10工程及来源输入通过。H01规划模式原稿仍失败；宿主修正版与HUD调整已通过双SDK桌面/窄屏4/4参考验证，真实模型重测未运行。参考H01动态数字的320px双SDK局部检查已通过，完整视觉仍待复核；G17仍有画面对比度不足。MCP已有无模型工程和真实Provider历史调用，模型身份尚未独立核实；Skill已有项目级安装和宿主练习，新会话自动触发仍待验。受共享表现变更影响的当前源码参考浏览器证据和完整工程回归已重验。正式G3 0/37、Verified 0/32+0/5，真机、人工和远端CI独立。见[H01修复](docs/generator-h01-repair.md)、[实际结果](docs/generator-real-findings.md)、[MCP/Skill说明](docs/generator-mcp.md)与[台账](project/generator-status.json)。

本机MCP：`npm run mcp:install`后`npm run mcp:serve`（默认无模型额度），验证用`npm run mcp:check`；完整`npm run verify`含MCP边界测试，需先安装其独立依赖。Skill只打包：`npm run skill:package`，不自动全局安装。Studio仍可用：`npm run generator:studio`。

本轮 CLI 入口（准备 UTF-8 的 `prompt.txt`，输出目录必须不存在）：

```powershell
npm run generator -- --help
npm run generator -- probe --provider fixture --json
npm run generator -- generate --prompt-file .\prompt.txt --provider fixture --output .\output\generator-demo
```

fixture 不解释提示内容，固定从零构造明确标记的工程计数夹具；它不满足具体游戏生成任务。真实接入的配置预检使用 `probe --provider codex|model-http|http --config <本机配置文件>`，不调用模型；后续使用真实 Provider 执行 `generate` 会调用模型，需先授权调用预算。调试已验证结果时可在 `/player/inspect.html` 手动导入该结果的 `debug-bundle.json`。

安装源链接命令（先 `npm ci`、`npm run build`，保持源码目录可用；这是本地入口，便携交付仍属 GEN-6）：

```powershell
$a2gameSource = (Get-Location).Path
npm install --prefix .tools/generator-cli --ignore-scripts --no-save --package-lock=false $a2gameSource
npx --prefix .tools/generator-cli --no-install a2game --help
```

`npm run generator:command-smoke` 在临时目录检查安装后的命令；`npm run generator:browser` 检查新建夹具的双 SDK 桌面/窄屏运行、输入、Hash、截图和释放，不计真实模型/G3。

协议资产已按用途分层：`specs/v0.1/capabilities/` 是当前能力目录，`games/` 是参考游戏与候选，`tests/` 是执行合同，`examples/` 仅放格式示例。详见 [协议目录](specs/v0.1/README.md) 与 [迁移说明](docs/spec-layout.md)；当前可信能力和测试来源见 [绑定索引](project/capability-bindings.json)。

**定位**：AI 直接生成 JSON → 全格式/语义校验 → 共享 TypeScript 玩法 Runtime → Canvas2D/CocosAirJS/Three.js 等可替换渲染宿主。

> **版本区别（重要）**：本源码包/`package.json` 的 **项目发行版本为 `1.0.0`**；它是 **Alpha 参考实现，未达到生产发布 Gate**。GameSpec、Capability Manifest、Tick/Rule 和 Conformance 的**协议版本仍为 `0.1.0`**，协议目录为 `specs/v0.1/`，JSON 内 `specVersion` 保持 `0.1.0`。保留旧 V0.3 文档与测试日志作为可审计历史。
>
> **当前阶段：S11 初始兼容扩展工程参考已交付。** 当前 112 份 JSON、127 份 Manifest，必需玩法缺口已降至 0 款（参考验收）；37 份 Gxx/Hxx 候选的真实双 SDK 参考证据见 [项目状态](PROJECT-STATUS.md)。完整玩法 DoD、独立 Agent 与真机 Gate 继续单独验收，verified 仍为 0/32、0/5。完整路线见 [PROJECT-PLAN.md](PROJECT-PLAN.md)，AI 先读 [AGENTS.md](AGENTS.md)。

播放器「游戏」菜单现在列出全部已校验定义，按基础示例、Gxx/Hxx 参考玩法、作者编写的规则变体和机制实验分组；可直接选择 G21/H01 等玩法。`?game=g21-candidate&backend=three` 可直达，仍校验目录 SHA。带资源的内置关卡经过完整资源准入后加载。全部 37 个作者变体可运行 `npm run variants:e2e`；它们不计独立 Agent G3。

P0 逐款 AI 实测与待人工确认项见 [质量清单](docs/quality-review.md)，覆盖 37 款双 SDK 和 320/390px 布局。

P2 正式验收档案与登记前检查见 [验收流程](docs/final-acceptance.md)。`npm run acceptance:build` 归档现有证据，`acceptance:check` 核对档案；参考通过与正式通过分别计数。

其他 AI 可按 [子 Agent 编排与审查交接](docs/g3-agent-orchestration.md) 使用指定模型原生生成或触发模型服务，再交回本会话审查。[两轮运行改进](docs/g3-native-improvements.md) 提供统一原生交付合同、原始字节/宿主证据捕获、源码快照与任意生成产物的主输入复核。两轮 G01 各消耗 3/3，双 SDK 键盘补验共 4/4；来源与画面仍待补齐。[多模型 G3 与技能反馈](docs/g3-model-evaluation.md) 的厂商兼容、自动调度与正式签收未完成，[编排约定](project/g3-agent-orchestration.json) 不授予新增调用预算。

当前优先 [37 款独立 G3](docs/independent-g3.md)：当前 Codex CLI 的 37 款均已通过完整准入、正反例和真实双 SDK 工程参考验证；G02 明确使用宿主 Runtime 求解反馈，不算模型自解。正式 G3 仍 0/37；[独立生成索引](project/independent-g3-run.json) 保留调用、原始输出、截图及逐项待验。37款浏览器主输入及逐款AI参考审查已复核；[纯源码证据恢复](docs/evidence-restoration.md)已通过Node22全量验证。Actions仅手动默认一个任务以控制额度；远端证据托管未配置，CDP/合成传感器与人工作品质量分别记账。`g3:plan` 不调用模型，也保留通用模型 API 入口。

仓库源码与本地产物的边界见 [维护说明](docs/repository-maintenance.md)。`reports/` 已移出 Git，本地历史证据继续保留；新检出需恢复相应证据后才能完整核对现有验收状态。

逐款玩法完成标准和剩余缺口见 [完整验收清单](docs/gameplay-acceptance.md)。`npm run gameplay:check` 执行 37 款的基础正反例、关键边界及作者变体正反例；完整质量、独立 G3 与真机按原 Gate 单独验收。

G11 按住 Space/长按蓄力后松开，连续跳到两个平台；中心落点奖励连击，偏心落地重置连击，落空失败。G24 支持横竖双斜五连；满盘无胜者时保留 `turn.draw` 和胜者 0，以已有的 `stopped` 状态中立结束，不再接受落子。

G13/H03 使用固定三车道、三段滚动障碍和两个有序检查点；H03 同时支持换道与真实弹丸射击，命中、障碍拦截及临时对象回收均由共享 Runtime 决定。G06 已扩展为 3×3 四向箭头与镜像布局，支持直接点选画布。它们仍须独立完成正式验收 Gate。

G23 合成后解锁工厂，生产扣费并在成熟后收获；H02 三消金币可升级角色，下一 Tick 起实际提高攻击伤害，击败敌人才过关。玩法联动、金币/生命和下次/上次伤害均来自共享状态，真实双 SDK 使用同一份 JSON。

G09 使用空棋盘连续拼块：左右键移动、↑旋转、Space 硬降，也可等待重力落下，消四行获胜，出生被挡即顶出。G12 点击画布或 Space 拍翼，避开上下门柱，完全越柱后计分；作者变体增加第三道门。

## 一、先看能运行什么

| 功能 / 后端 | 现在能否运行 | 说明 |
|---|---|---|
| TypeScript Headless Runtime | **可以** | 计时/事务/回放、益智、整数物理/战斗、经营/回合，Node.js 测试 |
| 浏览器 Canvas2D 预览 | **可以** | 目录共 112 份预校验 JSON；scene2d 使用 Canvas2D，3D Stage 使用真实 SDK |
| Three.js Renderer | **真实 G2 四样例子集 PASS** | 固定 `0.186.1`，HTTP Chromium 实测；见 `reports/g2-threejs-real.json` |
| CocosAirJS Renderer | **真实 G2 四样例子集 PASS** | 固定源码/构建 SHA，HTTP Chromium 实测；见 `reports/g2-cocosairjs-real.json` |
| 32 款完整小游戏、5 个混合玩法、IMU 真机、AI one-shot | **完整 DoD / Agent / 真机未验收** | 保留在路线图，不因版本 1.0.0 改称已完成 |

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
│       ├── samples/           # GameSpec、Capability、Coverage、Conformance、Trace
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

## 八、当前完成情况和下一个可执行任务

**当前验证**：66/66 Node、13/13 JSON Conformance、7 Schema/30 文档、5 游戏目录 PASS；真实双 SDK HTTP Chromium G2 四样例子集 PASS（16+2 场景，8 组跨引擎 Hash 一致）。新增动态 JSON 变体也通过两端导入、Node Hash、负例恢复、后端切换及实际服务进程重启后加载，见[动态内容回执](reports/content-2026-10-24T13-13-36-731Z-49356/summary.json)。原 G2 证据见 [Three.js](reports/g2-threejs-real.json)、[CocosAirJS](reports/g2-cocosairjs-real.json)。旧隔离环境的 HTTP 策略阻塞记录保留于 [`reports/release-1.0.0-validation.json`](reports/release-1.0.0-validation.json)，不代表本次环境。

**未完成/未验证**：远程账户/签名和自动部署、审核目录外资源供应链、多进程存储配额；一般模型/骨骼编辑器和任意 Shader 扩展；三消与塔防/射击完整模块；物理 GPU、多点/IMU 真机；32+5 全量玩法；Agent G3。

**下一步**：实施 S5 益智/休闲标准库，保持 S4 表现能力的真实双 SDK 回归；新增能力继续执行 [PROJECT-PLAN.md §5](PROJECT-PLAN.md) 的真实 G2 合同。研发变更时同步 [PROJECT-STATUS.md](PROJECT-STATUS.md)、[`project/status.json`](project/status.json) 与 `CHANGELOG.md`；不能把失败、未测或 Mock PASS 改成已完成。

生成工程：`npm run agent:fixture -- --browser` 重现明确标注的工程夹具；真实生成器按 `project/agent-provider.example.json` 配置后执行 `npm run agent:run -- <配置.json>`。调试包通过 `/player/inspect.html` 逐步查看，详见 [生成与修复合同](specs/v0.1/docs/17-Agent-Workflow-V0.1.md)。

S11：`npm run compat:e2e` 验证真实双 SDK 的公开回合棋桌、虚拟手柄和存档。设置 `$env:A2GAME_ROOMS='1'` 后启动服务可访问 `/player/room.html`；存档、迁移、隔离 Node 矩阵、性能与 CI 边界见 [兼容扩展合同](specs/v0.1/docs/18-Compatibility-Extensions-V0.1.md)。Android/物理手柄与独立生成器尚无正式验收，远端 CI 未运行。
