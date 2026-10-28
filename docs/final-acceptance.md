# P2 正式验收档案与登记检查

本阶段完成可复核的档案归集和登记前检查。完整验收依然是 PARTIAL；当前正式计数为 **0/32＋0/5**，不会由参考 PASS、作者变体或 AI 截图审查自动升级。

## 执行

按 README 准备 Node、Python、依赖和既有参考证据后，在仓库根目录执行：

```powershell
npm run verify:receipt
npm run acceptance:build
npm run acceptance:check
```

`acceptance:build` 先检查当前定义、能力、完整 Schema/Conformance、193 个逻辑场景、双 SDK 正反例、重开/销毁、P0 和来源指纹，随后创建独立的 `reports/acceptance-*/`。成功完成后才更新 [当前索引](../project/final-acceptance.json)。历史档案不会覆盖。

每次输出包含：

- 37 份逐款档案，关联基础定义、作者变体、版本、Capability digest、玩法 DoD、逻辑、两套 SDK 与 AI 质量记录。
- 74 份正式 CoverageResult（每款 × 两套 SDK），目前全部为 `NOT_RUN`；已有的 148 份参考回执另行引用。
- 一份总清单、可读的 README、SHA-256 文件清单以及完整 Draft 2020-12 CoverageResult 校验结果。

当前归档范围是 Windows Chromium 桌面参考证据，不代表其他平台通过。32 款 Gxx、5 款 Hxx 与 10 款适用真机要求都保持冻结，Gxx/Hxx 不互相替代。

## 登记条件

| 条件 | 当前证据 | 正式验收尚缺 |
|---|---|---|
| G0/G1/G2 | 已校验的参考子集、基础/边界/作者变体、Node/Host Hash 与释放回执 | 仍按当前 Profile 限定范围 |
| 完整质量 | P0 AI/浏览器审查 37 款 | 37 款人工交互、视觉和长期游玩确认 |
| 独立 G3 | 已有生成/修复工程夹具 | 37 款真实独立生成器、提示/输出、模型/成本及变体运行与质量证据 |
| 适用设备 | CDP 与合成输入参考 | G25–G32、H03、H04 共 10 款真机证据，按用户要求暂缓 |

本阶段是 `evidence-only`：生成登记所需材料与缺口清单，不接收结果文件里的自报 `PASS`，不写入冻结 CoverageRegistry 的 `verified`。待外部证据具备后，需要另行完成可信证据接入与正式升级；归档完成不等于验收完成。

```powershell
npm run acceptance:ready
```

当前命令会明确以 `A2G_E_ACCEPTANCE_NOT_READY` 和非零退出码拒绝正式登记。这是尚未执行的外部 Gate 导致的预期结果，不属于档案构建或运行时故障。

`acceptance:check` 为只读检查：校验索引/档案/文件摘要、当前源码指纹、37 个身份和目标 SDK、正式计数与缺口，并重跑 74 份 CoverageResult 的完整 Schema。越界路径、被修改的定义/证据、替换的当前 SDK 回执和伪造的正式 PASS 均不得通过。摘要用于追踪修改，不是第三方身份认证或数字签名。

`project:check` 会检查当前档案及源码指纹，允许检出时尚未生成的 `dist/*.js`，其他证据必须存在。新增一次完整工程验证日志不会覆盖已归档证据；定义、Conformance、源码或当前双 SDK/P0 证据变化后必须重新构建档案。
