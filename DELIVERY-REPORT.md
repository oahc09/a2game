# A2Game 1.0.0 — 版本统一、文档与治理交付报告

日期：2026-10-24。**本次基于 `A2Game-V0.3-Presentation-Gameplay.zip` 在全新隔离目录增量完成，没有修改原 ZIP 或远程 GitHub 仓库。**

## 完成内容

1. **版本**：`package.json.version` 从 `0.1.0-alpha.1` 改为 `1.0.0`；新增 `src/release-version.ts` 和导出常量；播放器标题与版本标签统一改为 `Release 1.0.0`。为防误导，技术成熟度仍定义为 `Alpha reference`。**协议 GameSpec/Capability Manifest `0.1.0` 保持原样**，没有破坏既有 JSON 与 Schema。
2. **README**：新增 Windows PowerShell 自解压、Node/Python/TypeScript 安装、完整构建与测试、Canvas2D 运行、Three.js SDK 引入、CocosAirJS SDK 构建部署、JSON 校验/白名单、Chromium 可选回归、常见问题与阶段说明。`typescript` 版本固定 `5.8.3`；`requirements-dev.txt` 固定 `jsonschema==4.26.0`。当前包不包含 `package-lock.json`，本地首次用 `npm install`，需联网。
3. **完整长期计划**：`PROJECT-PLAN.md` 提供 S0–S11 阶段、32 款 Gxx、5 个混合 Hxx、完整 Gameplay Catalog、Touch/IMU、2D/3D、策略经营/回合、AI 生成/修复、真实 G2、G3、资源/安全、DoD 与变更规则。
4. **实施状态和防漂移**：`PROJECT-STATUS.md` 与 `project/status.json` 锁定当前 S2、G0/G1 子集、G2/G3 未测；`AGENTS.md` 规定后续 Agent 入口及验收、权限边界；`scripts/check-project.mjs` 逐项核查版本、阶段、覆盖分母、文档、SDK G2 回执；`CHANGELOG.md` 追踪发行改动。新增版本/协议隔离测试。保留旧 `IMPLEMENTATION-*` 文档与旧 `v03-*` 日志并显式标明历史属性。
5. **浏览器回归脚本移植**：`scripts/browser-smoke.py` 现在支持使用本地 TypeScript CLI、已安装系统 Chromium 或 Playwright 管理的 Chromium；不再硬编码 Linux `/usr/bin/chromium`。

## 实际复验结果（2026-10-24）

| 项目 | 本轮结果 | 证据 |
|---|---|---|
| TypeScript 构建 | PASS | `reports/release-1.0.0-full-verify.log` |
| 项目治理检查 | PASS | `reports/release-1.0.0-governance.log` |
| Node 自动化测试 | **55/55 PASS** | `reports/release-1.0.0-node-tests.tap` |
| Conformance | **6 套、12/12 PASS** | `reports/release-1.0.0-conformance.log` |
| 完整 Schema 2020-12 | **7 类、27 文档 PASS** | `reports/release-1.0.0-schema.log` |
| 规范/能力/覆盖引用 | **11 Capability、4 GameSpec、32 候选 PASS** | `reports/release-1.0.0-spec.log` |
| 白名单目录 | 4 份 GameSpec PASS | `reports/release-1.0.0-catalog.log` |
| Chromium + Canvas2D `set_content` | **5/5 PASS**，截图已人工检查 | `reports/release-1.0.0-browser-smoke.log` |
| Node ↔ Chromium ExactHash | **5/5 PASS** | `reports/release-1.0.0-parity.log` |
| 本地 Node HTTP 静态服务 | index.html 和 game.json 均 **HTTP 200** | 以本轮 localhost curl 实测 |
| 真实 Chromium HTTP 页面导航 | **BLOCKED（INFRA）** | `ERR_BLOCKED_BY_ADMINISTRATOR`，不能作为全页面 E2E PASS |
| 真 CocosAirJS / Three.js G2 | **NOT_RUN** | 无实际 SDK 验收回执 |
| 32 个目标游戏 / 5 个混合玩法 / 真机 IMU / Agent G3 | **NOT_RUN / PLANNED** | Coverage 分母未变，完整验收 0/32、0/5 |

机器可读验收回执：`reports/release-1.0.0-validation.json`。

## 下一阶段与待决项

- **当前 S2**：本地提供真实 CocosAirJS build JS 和 Three.js ESM，在真实浏览器加载四份游戏，验输入、Hash、截图、资源生命周期、DPR 等 G2；详见 `PROJECT-PLAN.md §5`。
- **后续所有计划**：继续 S3–S11，覆盖动态 AI JSON 安全校验、通用表现、三消/射击/塔防、Touch/IMU、32+5 游戏以及 Agent 生成/修复。不能将部分样例 PASS 计入完整覆盖率。
- **本轮没有** Git 提交、推送、部署、引擎仓库修改或权限变更。

## 本地最短执行

在 Windows 解压后，进入含 `package.json` 的目录：

```powershell
npm install
python -m pip install -r requirements-dev.txt
npm run verify
npm run player:serve
```

浏览器访问 `http://127.0.0.1:8765/player/index.html`，默认 Canvas2D。更完整步骤见 `README.md`，跨引擎实验见其第三节。
