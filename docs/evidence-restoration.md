# 源码检出的证据恢复

`reports/` 保留在本地且不入 Git。当前 PASS_REFERENCE 指向的报告、截图、失败生成及旧调用不能凭空重建，也不能通过跳过检查维持 PASS。

维护者在最终源码和回执冻结、工程检查通过后执行：

```powershell
npm run evidence:pack -- output/a2game-evidence-20261028.jsonl.gz
```

工具从当前状态、P2、独立 G3、Adapter 和基础校验指针收集报告依赖，按原始字节压缩；生成纳入源码的 `project/evidence-lock.json`，保存每份证据、整个包及来源指针的 SHA256。历史失败预期未产生的截图可列为 missingReferences，现有严格门禁继续决定哪些证据必需，不能由该清单绕过。

来源文件按字节绑定；`project/status.json` 特别绑定全部 `reports/` 指针的排序集合，允许更新进度文字，但改变任何证据指针都必须重新打包。每份报告和截图仍逐文件绑定原始字节 SHA。

新检出拿到同一证据包后执行：

```powershell
npm ci
# 按 README 安装 requirements-dev.txt；声明已装依赖的解释器。
# 若使用 .venv，可改为该解释器的绝对路径。
$env:A2GAME_PYTHON = 'python'
npm run evidence:restore -- D:/A2GameEvidence/a2game-evidence-20261028.jsonl.gz
npm run verify
node scripts/g3-codex-report.mjs --check
npm run acceptance:check
```

恢复只写 `reports/`，拒绝越界路径、符号链接、大小或 SHA 不符、大小写冲突及重复条目。已有内容相同则保留，内容不同则退出，不覆盖任何历史文件。恢复不执行包内脚本，不恢复依赖、SDK、凭据或私有发布目录；需要实际运行双 SDK 时仍按 README 准备 SDK。

CI 在原有完整验证之前执行恢复，可使用 `workflow_dispatch.evidence_url` 或宿主配置的 `A2GAME_EVIDENCE_URL` 仓库变量。只接受宿主明确配置的 HTTPS 来源，最终仍以源码中锁定的包 SHA 和逐文件 SHA 校验。未提供证据源会明确失败，不降级或略过原有门禁。证据包的远端托管与权限不由工具自动创建或修改；私有证据不得擅自发布为公开下载。

## Actions 额度控制

2026-10-28 用户确认旧任务因额度超出而未启动。工作流改为仅 `workflow_dispatch`，push / pull_request 不自动消耗 Actions；日常完整验证在本地执行。默认只跑 Ubuntu / Node 22 的一个完整 core 任务，选择 `full_matrix` 才跑原有四组合，最多并行两个任务。`real_sdk` 默认关闭且等待 core 成功后才启动，复用 core 结论，不重复执行工程全套。相同分支的新手动运行取消旧运行，产物保留期降为 3 天。

这只减少触发次数和默认组合，不缩减被选任务的检查内容；未运行的系统组合和浏览器任务不能记为本次 PASS。额度恢复、可信证据 URL 配好后再手动运行，不自动重试旧失败。配置使用 GitHub 官方的 [手动输入](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatchinputs) 与 [并发控制](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。

证据恢复通过仅表示存档完整。正式 G3、人工作品质量与物理设备 Gate 仍分别待验。

## 本次实测

`project/evidence-restoration-run.json` 记录源码提交、Node22、独立安装、原始日志SHA及恢复前拒绝/首次/重复/验证后恢复。8,138文件、压缩393,230,709字节，整包SHA为 `2f00dacb2444b43bc26b33251c85601879f76730af83f95c9f5d995569a22c06`。纯源码完整115 Node、203 Conformance、360 Schema以及G3/P2审计通过；全程没有复制现有dist、SDK、依赖或私有目录。新检出仍需维护者提供该包；远端托管未配置，GitHub额度耗尽的原运行不被此本地结果替代。
