# 四宿主补证任务

本文件保留G0历史补证合同。当前目标已推进到[四宿主显式全通路](host-agent-pilot.md)；不用继续要求Agent手工重打“原始响应”。新工具直接复制服务端回执，宿主返回另存比较。WorkBuddy项目Skill已安装到官方 `.codebuddy/skills/a2game/`，待新会话实际核实。

2026-11-01 审查以 [统一记录](../project/host-first-review.json) 为准。原始回执保留；新证据写新目录，通过 `previousRun` 关联。四宿主均保持 PARTIAL。ZCode 为扩展宿主，不改原三宿主 Pilot 和 15 单元 Benchmark 基线。

## 当前分工

| 宿主 | 本轮任务 |
|---|---|
| qoder | 保留已成功的能力查询；补实际宿主版本与启动记录。当前 MCP 为用户级，核实项目级支持，无法确认就保留 USER_LEVEL。 |
| trae | 使用成功复测的工具通道；补实际版本、工具列表和启动记录。首轮未连接是历史结果，不用重跑本地 stdio。 |
| workbuddy | 优先补宿主通道原始响应；旧回执 e509… 与保存响应 ed8d… 属不同调用。核实 Skill 可见性，仍缺失则给出安装步骤，不自动更改用户配置。 |
| zcode | 补 d2e83… 对应宿主响应或在新目录执行一次宿主调用；旧 raw/ 仅为本地探测。缺少当前会话启动记录时保持 PARTIAL，不沿用自报 PASS。 |

## 发给各 Agent 的共同任务

先填写宿主标识 `qoder` / `trae` / `workbuddy` / `zcode`，然后发送下列任务及上表对应行。

```text
执行 docs/host-first-followup.md 对应宿主的 HOST-G0 补证任务。

1. 仅阅读本宿主已有回执和通用 Skill/MCP 合同，不读取其他宿主结果。
2. 创建 reports/host-first-evaluations/<小写宿主>/<UTC时间>-<UUID>/。
   已存在则换 UUID。旧回执不覆盖、不搬移；receipt 中记录 previousRun。
3. 使用宿主实际的工具搜索/动态发现入口，记录实际工具别名和来源。
   不能根据服务端名称猜测宿主调用名。记录期望9个工具与实际列表。
4. 通过宿主通道执行一次 list_capabilities({limit:5,offset:0})。
   保存实际请求和宿主返回原文；不得自行启动另一个 stdio 进程冒充宿主。
   已有有效记录能导出原文时直接复用，不重复调用。
5. 输出 request.json、host-response.json（原始宿主返回）、tool-list.json、
   receipt.json、MANIFEST.sha256。工具响应无法导出则 responseFile=null，
   rawCapture=NOT_CAPTURED；不得根据记忆或摘要重建“原始响应”。
   原文需脱敏时另标 redacted=true，说明脱敏字段，不保存凭据。
6. 记录实际宿主版本及来源、Skill是否可见、连接配置范围、当前会话启动记录。
   不支持截图/日志导出就写 NOT_CAPTURED；不扫描无关会话、缓存或凭据。
7. 只写本轮报告目录；不修改源码、计划、台账、宿主配置，不安装依赖，
   不提交/推送。不调用 generate_game、第二模型或自动创建其他 Agent。
8. 本轮只做 G0 补证。缺项保持 PARTIAL；不要为缺失材料无限重试。
   MCP provider调用次数与宿主模型用量分开；未知用量填UNKNOWN。

结束后返回：报告目录、实际调用名、响应runId、成功项、待补项。
```

## receipt.json 共同字段

```json
{
  "format": "a2game-host-g0-receipt",
  "version": 1,
  "host": "workbuddy",
  "runId": "本轮UTC时间-UUID",
  "previousRun": "原回执目录",
  "status": "PARTIAL",
  "hostVersion": {"value": "UNKNOWN", "source": "UNKNOWN"},
  "configurationScope": "UNKNOWN",
  "skillDiscovery": "NOT_VERIFIED",
  "hostCall": {
    "channel": "HOST_MCP",
    "actualToolName": "宿主实际别名",
    "responseRunId": null,
    "responseFile": null,
    "responseSha256": null,
    "rawCapture": "NOT_CAPTURED",
    "redacted": false
  },
  "directProbe": null,
  "startupEvidence": {"status": "NOT_CAPTURED", "file": null},
  "mcpProviderCallsReported": null,
  "hostNativeUsage": "UNKNOWN",
  "limitations": []
}
```

此格式是交付合同，不能填入未观察到的值。`runId` 为报告运行标识，`responseRunId` 为服务响应标识，二者不要混用。直接 stdio 探测单独记入 `directProbe`，不能填写为 `HOST_MCP`。摘要和 SHA 只证明本地文件一致性，不认证模型身份或原文来源。

## 主审入口与后续阶段

主审更新 `project/host-first-review.json`，逐项绑定原文件 SHA 和来源，再执行 `node scripts/audit-host-first.mjs`。脚本检查工具名、文件摘要和已保存响应的 runId；`integrity=PASS` 不等于 `acceptance=PASS`。未补原文的宿主保持 NOT_PRESERVED，不用本地探测填空。

G0 补证后，HOST-G1 隐式和显式触发分别使用全新会话；补证会话已点名 A2Game，不能计为自动触发证据。随后在批准的宿主用量内执行独立 G01 Pilot。宿主自身模型会产生用量；MCP `--max-calls 0` 仅禁止 A2Game 代调用 Provider。
