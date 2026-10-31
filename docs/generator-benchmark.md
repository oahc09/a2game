# 五任务、两模式的独立模型评测

固定范围：G01 推箱子、G03 三消、G17 纵版飞机射击、G21 塔防、H01 合成炮台保卫战，各执行 `direct-json` 和 `game-plan`。十个单元分别记首次结果、修复、费用/用量、宿主辅助和待验，不合并成跨模型“成功率”。这五个公开过的任务家族不声称完全未见。

```powershell
npm run generator:benchmark -- plan
```

此命令不会调用模型，生成独立的 `reports/generator-benchmark-<UUID>/`，包括固定任务文本、十份公开上下文、SHA、源指纹和 `plan.json`。它只读自然语言任务和公开 Registry/Schema，不读取作者游戏、关卡、解法或旧模型产物。相同任务两模式使用同一提示、Seed、能力目录、参数合同和 Provider，规划模式多出内部 GamePlan。实际 Adapter 的公共 HostProfile 包装继续保留；这里只冻结包装前上下文，跨 Provider 比较还需固定各自实际导出。

执行前需要新的模型/Provider 和调用预算授权。沿用现有 CLI 默认路由的示意命令：

```powershell
npm run generator:benchmark -- run --provider codex --config .a2game/codex-generator.json --max-calls 30 --max-attempts 3
```

示意命令不代表本会话已授权 30 次。十项首轮需要最多 10 次完整生成，每项最多三次修复预算合计上限 30 次；CLI 原有模型选择和认证保持不变。不显式给预算、选择 fixture 或 Provider 不可用时阻止执行；不自动切模型/路由或使用旧输出补齐成绩。原生子 Agent 的 GEN-2 记录属于另一上下文，不自动追记到矩阵。

执行后逐项保存公开报告，私有原始回复和修复链仍按 Generator runId 保存。每次完整生成分配计入全局上限；异常下不知道真实调用数时记 `null`，保守占用预留上限。`knownGenerationCalls`、`budgetConsumed` 和 `unknownCallCounts` 分开；未知费用不是零。模型自报不等于服务身份通过。

通过完整准入的内容还须匹配首次上下文和固定 Seed，再用已有真实双 SDK 工作流回放模型解法和有界正反例、暂停/重开/Hash/释放。此检查主要是 API 回放，不能取代逐款浏览器来源输入、语义、初始/进行中/成功/失败画面、难度和持续游玩质量；这些维度需独立复核；当前9个有效输出已完成36路来源输入，AI质量仍PARTIAL，GEN-G2/G3不自动全部通过。宿主 BFS 成功单独标记 `HOST_ASSISTED`，不计独立模型解法通过。

本轮已按用户授权执行10/10真实单元、累计30次启动（29返回+1宿主中止）。首轮6/10，批准5次续修后8/10，再经宿主组合误判零调用复验后9/10工程/来源输入通过；H01规划模式失败，直接模式原始输出经宿主组合识别修正后通过，质量与变体仍PARTIAL。宿主v1/v2修复及v3续修分开记账，不发布同质one-shot成功率。预算0剩余，不追加调用。逐项回执：`reports/generator-benchmark-delivery-dc060518-6870-4cf9-9775-efa59aca01dd/summary.json`，可读单文件报告：`reports/generator-benchmark-delivery-dc060518-6870-4cf9-9775-efa59aca01dd/index.html`；费用UNKNOWN，29份已报用量仅求和，不代表账单。
