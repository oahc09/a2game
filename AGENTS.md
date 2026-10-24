# A2Game 实施约束（本工作区）

按以下顺序阅读并执行：`README.md` → `PROJECT-PLAN.md` → `PROJECT-STATUS.md` → `project/status.json` → 对应 `specs/v0.1/docs/*.md` → 源码与测试。若存在宿主或用户更高优先级指令，优先遵守；不得以此文件绕过权限要求。

1. **版本**：工作区发行 `1.0.0`；实际 npm 版本 `1.0.0`；GameSpec/Capability Protocol `0.1.0`。协议现位于 `specs/v0.1/`；保留历史协议内容和旧 `v03-*` 证据，禁止混淆发行版本与协议版本。
2. **状态**：S2 真实双引擎 G2 已通过四份 `scene2d` 参考 JSON 子集（回执见 `reports/g2-*-real.json`），下一主线为 S3/S4。G0 已交付静态子集 PASS，G1 Headless 子集 PASS 但全目录 PARTIAL；G3、真机 Touch/IMU 仍 NOT_RUN。不得改写成全量完成，现行状态以 `project/status.json` 为准。
3. **架构**：AI 输出 JSON；全 Schema + Capability 检查；共享 Headless Tick/Rules/State；Host 只消费 PresentationFrame/注入输入。禁止按游戏名在 Adapter 实现玩法、禁止执行 JSON 任意脚本。
4. **范围**：完整范围包括 32 Gxx + 5 Hxx、Touch/IMU、多点触控、2D/3D/物理、Puzzle/Realtime/Combat/Strategy/Economy/Turn-Based、Agent 生成与 Conformance；不能因当前示例有限就删掉未来目标。
5. **实施**：改前看差异；小步增量，保留用户内容；新增 Capability 必须补 Manifest、GameSpec、Schema/语义检查、正反例、Conformance、Host 支持和 Coverage receipt；先证据后升级状态。
6. **验证**：`npm run project:check`、`npm test`、`npm run spec:validate`、`npm run schema:full`、`npm run conformance`、`npm run catalog:build`；真 G2 必须真实 SDK + HTTP 浏览器 E2E，Mock/Canvas2D 不计。
7. **权限**：无明确授权不提交、不推送、不部署、不变更权限、不处理凭据、不删除重要数据。失败按 Engine/Infra/Agent 策略独立归因。
8. **文档更新**：每次代码更改同步 `PROJECT-STATUS.md`、`project/status.json`、`CHANGELOG.md` 的相关内容；不覆盖旧报告/截图/Golden Vector；协议冲突须显式记录并跨文件修复。

## 快速定位

- `src/runtime.ts`：Session、唯一逻辑 Tick、规则事务、暂停/重开/快照；`src/exact-hash.ts` 和 `src/rng.ts` 负责确定性。
- `src/validator.ts`、`src/registry.ts`：语义编译与能力协商；`scripts/preflight.py` 使用完整 Draft 2020-12 Schema。
- `src/presentation.ts`：将只读状态投影成 `PresentationFrame`；`src/input-trace.ts`：规范化输入与 Trace 回放。
- `src/modules/`：共享玩法；目前仅网格滑动合并、随机补位、推箱子参考子集。
- `player/main.mjs`：HTTP 加载、SHA256 白名单、DOM 输入、唯一生产 Tick 调度；`player/adapters/`：纯表现后端。
- `test/`：Node 与 Mock 合同；`scripts/run-conformance.mjs`：JSON 逻辑套件。Mock 测试不构成 G2 证据。
- `project/sdk-lock.json`：真实 SDK 来源锁定；`scripts/prepare-sdks.mjs` 生成本地 SDK/SHA 清单，`scripts/g2-real.mjs` 通过真实 HTTP 执行跨引擎验收。
- `specs/v0.1/`：协议、Schema、11 份能力 Manifest、4 份游戏 JSON、32 款候选登记。
- `reports/`：需保留的历史证据；每次真实 SDK 运行使用独立目录，记录来源、SHA、浏览器、输入、截图、Hash 与释放结果。

## 从检出到验证

Node.js 22+、Python 3.10+；PowerShell 下执行：

```powershell
npm ci
python -m pip install -r requirements-dev.txt
npm run verify
npm run player:serve
```

若 Windows 的 `python` 是商店占位程序，可使用已安装的 `uv`：

```powershell
uv venv .venv
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
npm run verify
```

`package-lock.json` 应纳入版本管理；`dist/`、`node_modules/`、`.venv/`、下载的 SDK 和临时浏览器产物不入库。不得删除现有历史报告来整理目录。

真实 SDK 验收：按 `README.md` 准备锁定版本的 CocosAirJS，执行 `npm run sdk:prepare`、`npx playwright install chromium`、`npm run g2:real`。每次运行保留独立目录；`reports/g2-*-real.json` 是当前回执指针。已通过的 G2 会由 `project:check` 检查真实结果、源码指纹与截图，不得沿用代码变更前的 PASS。

## 当前主线与交接

以 `project/status.json` 和本次实际回执为准，避免把本文件中的初始状态当作永久状态。S2 先取得真实 SDK、锁定来源与 SHA，再通过 HTTP 对同一份四游戏 JSON 测试输入、Node/Host Hash、画面、暂停/重开、缩放/DPR、销毁/重建和 context loss。CocosAirJS 的单文档引擎生命周期须遵守上游契约，不擅自重复初始化。环境阻塞与 Adapter/Engine 失败独立记录，不跳过校验冒充 PASS。

仅增加必要的回归测试和可复用 G2 验证，避免过度设计测试用例。提交、推送和部署分别需要授权；授权提交不等于授权推送。
