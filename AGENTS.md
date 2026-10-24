# A2Game 实施约束（本工作区）

按以下顺序阅读并执行：`README.md` → `PROJECT-PLAN.md` → `PROJECT-STATUS.md` → `project/status.json` → 对应 `specs/v0.1/docs/*.md` → 源码与测试。若存在宿主或用户更高优先级指令，优先遵守；不得以此文件绕过权限要求。

1. **版本**：工作区发行 `1.0.0`；实际 npm 版本 `1.0.0`；GameSpec/Capability Protocol `0.1.0`。协议现位于 `specs/v0.1/`；保留历史协议内容和旧 `v03-*` 证据，禁止混淆发行版本与协议版本。
2. **状态**：S3–S7 已有声明范围内的参考 Profile 与真实 SDK 回执，S8 工程/虚拟输入已验证但真机 Gate 待验收，S9 有界独立候选参考已验证，S10 生成/调试与 S11 初始兼容扩展工程已验证；后续为独立验收；S2 四份 scene2d G2 保持独立回执。G1 全目录 PARTIAL；G3、真机 Touch/IMU 仍 NOT_RUN。不得把局部 Profile 或参考样例改写成全量完成，现行状态以 `project/status.json` 为准。
3. **架构**：AI 输出 JSON；全 Schema + Capability 检查；共享 Headless Tick/Rules/State；Host 只消费 PresentationFrame/注入输入。禁止按游戏名在 Adapter 实现玩法、禁止执行 JSON 任意脚本。
4. **范围**：完整范围包括 32 Gxx + 5 Hxx、Touch/IMU、多点触控、2D/3D/物理、Puzzle/Realtime/Combat/Strategy/Economy/Turn-Based、Agent 生成与 Conformance；不能因当前示例有限就删掉未来目标。
5. **实施**：改前看差异；小步增量，保留用户内容；新增 Capability 必须补 Manifest、GameSpec、Schema/语义检查、正反例、Conformance、Host 支持和 Coverage receipt；先证据后升级状态。
6. **验证**：`npm run project:check`、`npm test`、`npm run spec:validate`、`npm run schema:full`、`npm run conformance`、`npm run catalog:build`；真 G2 必须真实 SDK + HTTP 浏览器 E2E，Mock/Canvas2D 不计。
7. **权限**：无明确授权不提交、不推送、不部署、不变更权限、不处理凭据、不删除重要数据。失败按 Engine/Infra/Agent 策略独立归因。
   2026-10-24 用户已授权按现有项目计划持续实施到 S11，每个阶段计划验证完成后本地提交代码，中途无需重复确认。此授权不包含推送、部署、设备权限或凭据操作；不得为满足连续推进而缩减验收要求或伪造阶段完成。
8. **文档更新**：每次代码更改同步 `PROJECT-STATUS.md`、`project/status.json`、`CHANGELOG.md` 的相关内容；不覆盖旧报告/截图/Golden Vector；协议冲突须显式记录并跨文件修复。

## 快速定位

- `src/runtime.ts`：Session、唯一逻辑 Tick、规则事务、暂停/重开/快照；`src/exact-hash.ts` 和 `src/rng.ts` 负责确定性。
- `src/validator.ts`、`src/registry.ts`：语义编译与能力协商；`scripts/preflight.py` 使用完整 Draft 2020-12 Schema。
- `src/presentation.ts`：将只读状态投影成 `PresentationFrame`；`src/input-trace.ts`：规范化输入与 Trace 回放。
- `src/visual-stage.ts`：版本化相机/网格/精灵/动画/粒子/事件音频投影；`player/adapters/*-stage.mjs` 和 `stage-audio.mjs` 管理原生 SDK 对象与释放，`stage:e2e` 验证透视，附加 `--orthographic` 验证正交。
- `src/modules/`：共享玩法；puzzle.ts、realtime.ts、strategy.ts 分别实现有界益智、整数物理/战斗和经营/回合参考机制。
- `player/main.mjs`：HTTP 加载、SHA256 白名单、DOM 输入、唯一生产 Tick 调度；`player/adapters/`：纯表现后端。
- `test/`：Node 与 Mock 合同；`scripts/run-conformance.mjs`：JSON 逻辑套件。Mock 测试不构成 G2 证据。
- `project/sdk-lock.json`：真实 SDK 来源锁定；`scripts/prepare-sdks.mjs` 生成本地 SDK/SHA 清单，`scripts/g2-real.mjs` 通过真实 HTTP 执行跨引擎验收。
- `scripts/content-service.mjs`、`validate-content.py`：本地动态内容完整准入和持久化发布；默认私有数据位于 `.a2game/releases/`，由 `A2GAME_CONTENT_DIR` 覆盖，不入库。恢复记录须重新完整校验，环境不匹配须重新导入。`src/content-release.ts`、`player/content-loader.mjs`：回执及加载完整性检查。API 与宿主策略见 `docs/content-release.md`；`npm run content:e2e` 保留动态导入、真实服务进程重启和双 SDK 证据。
- `specs/v0.1/`：协议、Schema、125 份能力 Manifest、75 份游戏 JSON、32 款候选登记。
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

S6 参考扩展：`src/modules/realtime.ts` / `13-Realtime-World-V0.1.md` 定义 `aabb-int-v1`；Manifest physics 模块在 T5 执行，旧 simulate 模块仍在 T4。BodyLayer 是只读整数坐标投影。参考 Profile PASS 不替代完整 Gxx/Hxx、真机或 Agent Gate。

S7：`src/modules/strategy.ts` / `14-Strategy-Turn-V0.1.md`；生产以 Tick 计时，Deck/Hand 使用共享 RNG，路径行为在 T4、物理在 T5。死亡移除路径 Body 后产生 detached 事件，不回写失效对象。参考牌库不提供安全多人隐藏信息。

S8：`src/mobile-input.ts` / `player/mobile-host.mjs` / `15-Mobile-Input-V0.1.md`；共享缓存参与 Snapshot/Hash。传感器只在用户点击后采集，录制独立显式选择；暂停/方向变化需重校准。虚拟 Touch/Orientation、合成 Motion 不计真机，当前无 ADB 设备。

S9：`project/game-candidates.json`、`candidate-evidence.json`、`16-Game-Candidates-V0.1.md`；32+5 独立单关候选，完整 DoD/G3/真机另验。`src/trusted-modules.ts` 是 Node/浏览器统一可信绑定，新增模块同时更新 Manifest 与该绑定。`candidates:e2e` 分批准入、正反例 Node/双 SDK Hash、重开/释放。后续源改动须先重置 `candidateRun.status`，取得当前指纹的新回执后恢复 PASS_REFERENCE。

S10：`scripts/agent-workflow.mjs`、`agent-solver.mjs` 与 `17-Agent-Workflow-V0.1.md`；仅执行宿主配置的 argv，不执行模型输出命令。`test/fixtures/agent-provider.mjs` 及 `agent:fixture` 明确不计独立 Agent/G3。调试入口 `/player/inspect.html` 导入 debug-bundle.json，完整准入后通过真实播放器逐步回放。

S11：`18-Compatibility-Extensions-V0.1.md` / `project/extension-profiles.json`。`src/replay-save.ts` 用有界 Trace 重放和宿主可信迁移，禁止反序列化任意快照/迁移脚本。`scripts/turn-room-service.mjs` + `player/room.*` 是显式启用的同源 loopback 双人公开回合，非互联网/隐藏信息服务。`src/gamepad-input.ts` / `player/gamepad-host.mjs` 仅在显式启用后沿唯一 Tick 采样，断连/暂停/重开/销毁释放；虚拟 Gamepad 不计物理证据。

当前工程交付至 S11；S8/S9/S10 完整 Gate 仍受物理输入、独立 G3 和逐款完整 DoD 约束。`compatibilityRun`、`candidateRun`、`agentWorkflowRun` 的 PASS_REFERENCE 需当前源码指纹。改动后先重置受影响状态；Adapter verified 也必须降为 implemented-unverified，取得新回执后再提升。浏览器验收最多并发 2 个进程，避免 8 秒完整校验的环境竞争；源码冻结后再取证。CI 已配置但远端未跑，用户未授权推送/部署。
