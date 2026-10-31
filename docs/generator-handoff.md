# Generator 使用与交接

A2Game Generator 提供 CLI、MCP 和 Skill 三个入口，共用同一套准入与运行时。项目为 1.0.0 Alpha 参考实现，生成的 GameSpec 协议版本为 0.1.0。

## 准备工作

在项目根目录准备 Node.js 22+、Python 3.10+ 和依赖；真实双 SDK 预览还需按 [README](../README.md) 准备锁定的 SDK 与浏览器。Windows PowerShell 示例：

```powershell
npm ci
npm run mcp:install
python -m pip install -r requirements-dev.txt
npm run build
```

Python 虚拟环境如为 `.venv`，运行验证前可执行 `$env:PATH = (Join-Path (Get-Location) ".venv/Scripts") + ";" + $env:PATH`。`reports/` 不在 Git 中，历史回执需按 [证据恢复说明](evidence-restoration.md) 恢复；未恢复时不要将历史验收视为本机已复现。

## 选择入口

| 入口 | 使用方式 | 默认行为 |
|---|---|---|
| CLI | `node generator/cli.mjs --help` | 显式选择 Provider；`fixture` 是固定工程夹具，不理解需求 |
| MCP | `npm run mcp:serve` | 本地 stdio，默认真实模型额度为 0 |
| Skill | `npm run skill:package` | 仅打包；宿主配置和安装按其流程另行完成 |

CLI 无模型演示（准备 UTF-8 的 `prompt.txt`，输出目录必须不存在）：

```powershell
node generator/cli.mjs generate --prompt-file .\prompt.txt --provider fixture --output .\output\handoff-demo --json
node generator/cli.mjs validate .\output\handoff-demo\game.json --json
node generator/cli.mjs test .\output\handoff-demo --json
node generator/cli.mjs preview .\output\handoff-demo --backend three
```

预览持续运行，结束时正常中断以关闭监听；`--backend air` 使用另一真实 SDK。需代调用模型时另行配置 Provider 并获得调用预算；`probe` 只检查配置，不发起模型生成。Provider、模型和预算由启动者指定，不自动切换。MCP 工具与 Skill 流程见 [MCP / Skill 说明](generator-mcp.md)，Studio 和内容包见 [Studio 说明](generator-studio.md)。

## 验证与边界

`npm run generator:command-smoke` 检查隔离前缀中的源码链接 CLI；`npm run generator:smoke` 在独立源码副本检查安装、无模型生成、MCP、两种模式和包导入，复用本机 Python，不携带 SDK 或历史报告。`npm run mcp:check` 检查两个独立客户端及真实双 SDK；`npm run verify:receipt` 收集完整工程回归并保留既有回执。

内容包需要接收方具备兼容宿主、SDK 和审核资源，不包含 Runtime 或资源二进制。工程参考通过不等于正式 G3、人工质量、真机或远端 CI 通过；当前实测与未验事项以 [Generator 台账](../project/generator-status.json) 和 [项目状态](../PROJECT-STATUS.md) 为准。
