# 两轮原生子 Agent 运行后的改进

2026-10-28：GLM 宿主声明批次与 qfmodel 路由批次都在第 3 次通过 G01 工程参考。它们分别消耗 3 次，正式 G3 均未签收。本轮改进不调用生成模型、不修改默认路由或新增预算，不改写两批原始输出与失败记录。

## 已落地的规则

| 实际问题 | 处理 |
| --- | --- |
| 主 Agent 转写 JSON 后修正笔误，无法确认原始消息 | 子 Agent 当回合 Write；无法 Write 时由宿主捕获完整 JSON 字节。新增 `capture` 入口，保留宿主原始载荷、副本 SHA 和最小导出；已有字节不同则拒绝覆盖 |
| 只承诺“生成并落盘”，实际没有产物；或输出解释文字 | `native-delivery-v2` 明确完整 JSON、同回合交付、无解释/围栏；空回复保留失败项并计入已派发调用 |
| 模型断言坐标与自身运行结果不符 | 提示要求按输入顺序逐步推演，再形成断言，核对状态路径/类型；不通过放松断言逃避必需玩法，不向生成者泄露作者答案 |
| 公共包 SHA 包含报告路径，不能跨入口比较 | 两套原生入口使用同一 `context.json` 请求、相同交付合同，以 canonical JSON 计算 `contextSha256`；文件清单另用包内相对路径。修复诊断改变上下文时仍产生新 SHA |
| 导入器修复后缺失旧源码 | 准备时保存 `source-snapshot/` 原始源码与逐文件 SHA；源码变化按 INFRA/STALE_SOURCE 处理，不能将其记成模型失败 |
| 没有宿主记录却宣称来源已确认 | 导出只标为 `PENDING_INDEPENDENT_REVIEW`；请求模型、实际路由别名、公开版本与模型自报分开；单个 identity 文件存在不等于核验通过 |
| “第三次生成”被误读成 one-shot | 批次 `generationOneShot` 与单次 read-output 验证分开；首次、失败、修复与 INFRA 重放分别记录 |
| action 回放被误当实际输入 | 新增对任意已验证 workflow 的主输入复核入口，复用真实浏览器验证器，不使用历史游戏专用输入解法 |

`public-task-pack-v2` 只作用于后续原生实验；旧 `public-task-pack-v1` 与旧 GLM 文件包保留原样。新的上下文/交付版本不可与旧轮直接混合排名。公共合同不含本次发现的关卡解法。

## 给其他 Agent 的执行顺序

1. 先读 `docs/g3-agent-orchestration.md` 与 `project/g3-agent-orchestration.json`，核对本轮显式授权。两次历史轮各 3/3 已用完，本改进没有新增调用许可。
2. 后续获准原生实验优先使用 `scripts/g3-subagent.mjs`。配置维持单款 G01、`maxCalls`/`maxAttempts` 不超过获准余量，`runDir` 使用 `reports/g3-evaluations/<路由或模型>/<UTC时间-UUID>`，不能复用旧目录。
3. `prepare` 产生 `context.json`、`worker.txt`、`pack.json`、源码快照；原生子会话只接收公共 context 和 worker 交付要求，不能继承源码快照、作者定义、旧报告或解法。
4. 子 Agent 直接 Write 指定 `output.raw.json`，不让主 Agent 转写。最终回复可以是路径和 SHA；此时被捕获的生成原始载荷应是 Write 的 JSON 字节，不能声称它等于“仅含路径的最终消息”。没有 Write 能力时，捕获最终完整 JSON 消息字节。
5. 宿主将原始 Write 载荷或原始 JSON 消息，以及模型配置/会话事件的最小导出放在明确位置。不要将全量聊天、凭据或无关内容放入证据。导出缺失可继续工程诊断，但来源保持未核验。
6. 执行 `capture`（不修改字节）和 `validate`。只用该模型自己的上一份输出与真实诊断修复，使用新 attempt 且消耗剩余生成预算；模型失败与宿主失败分开。不要给子 Agent 本文中的审查结果作为作者答案。
7. 工程成功后执行主输入复核，再交接玩法/变体、输入、画面、身份/隔离审查。两个工程 PASS 不会自动提升质量或正式 G3。

以下命令均为入口说明，不构成新调用授权；`prepare`、`capture`、`validate`、`g3:subagent:input` 本身不调用生成模型。

```powershell
# 沿 README 准备 Python / SDK；配置与路径由宿主明确给出。
node scripts/g3-subagent.mjs <本机配置.json> prepare G01 1
# 子 Agent 写入后，宿主导出原始 JSON 载荷及最小执行记录。
node scripts/g3-native-contract.mjs capture --attempt-dir=<attempt目录> --reply=<宿主原始载荷.bin> --record=<最小宿主导出.json>
node scripts/g3-subagent.mjs <本机配置.json> validate G01 1
npm run g3:subagent:input -- <attempt目录/validation> --id=G01
```

`capture` 会将证据复制到该 attempt 的 `host-evidence/` 并创建 `generation.json`，默认拒绝覆盖已有执行记录。它不解析、纠正或美化模型 JSON，也不自动扫描任何宿主会话目录。直接 Write 的 raw 已存在时，必须与宿主导出原始载荷逐字节相同。

最小宿主导出示意（占位 SHA 不可执行）：

```json
{
  "format": "a2game-native-host-export",
  "version": 1,
  "host": "<actual host>",
  "parentSession": "<actual id>",
  "workerSession": "<actual id>",
  "modelEvidence": {"requested": "<actual requested id>", "observed": "<host-observed id or UNKNOWN>", "publicVersion": "UNKNOWN"},
  "isolation": {"provablyEnforced": false, "mode": "INSTRUCTION_LEVEL"},
  "replySha256": "<SHA256 of original Write payload or complete JSON message>",
  "files": [
    {"role": "model-config", "path": "model-config.json", "sha256": "<actual SHA256>"},
    {"role": "session-events", "path": "session-events.json", "sha256": "<actual SHA256>"}
  ]
}
```

原始载荷究竟来自 Write 还是最终消息，应在 `session-events.json` 中标明，记录其关联会话/工具调用及结束原因。`capture` 验证文件 SHA 和副本一致性，真实性、读取边界与路由仍由独立审查者判断。缺失版本、用量、价格继续记 UNKNOWN；不要猜测 qfmodel 等路由的公开模型名称。

遗留 `g3-native-subagent.mjs` 继续支持已有宿主：同样补齐公共 context、源码快照、原始输出只写一次与失败归因；其 `--no-generation-call` 不再允许创建免记账的新尝试。遗留导入仍需要宿主另存来源证据，不会因工程通过自动核验身份。既有 Codex CLI/API 生成路线不变。

## 本轮实际补验

主输入入口已对两批原来的第三次成功输出分别执行实际键盘操作；每批 Three.js / CocosAirJS 各一流程，共 **4/4 PASS_REFERENCE**。均绑定原定义 SHA、保存浏览器操作 Trace，并与独立 Node 重放的 exactHash 一致；重开、监听器关闭和 ownedResources=0 通过。本次没有覆盖旧批次、旧审查或 37 款 Codex 索引。

| 生成来源 | 输入复核回执 | 范围 |
| --- | --- | --- |
| qfmodel（路由别名） | `reports/g3-subagent-review-2026-10-28T15-01-18-427Z-fbfa9337-d92f-43c9-a898-061de1c8288a/review.json` | 第三次原始 13 步解、实际键盘、双 SDK |
| GLM-5.3（宿主声明） | `reports/g3-subagent-review-2026-10-28T15-01-55-790Z-3597d68a-faeb-43f4-928d-a7f8db390a37/review.json` | 第三次原始 8 步解、实际键盘、双 SDK |

以上是本地新证据，未加入既有便携证据包。主输入回执只补齐键盘，不声称触屏滑动、真机、完整质量或正式 G3 通过。新终局整页截图已显示宿主“已通关”，不再将缺少终局整页证据列为当前缺口；旧画布色条仍不能单独代替完整反馈。

## 仍未完成

验证：项目治理检查通过；沿项目虚拟环境与 Node 22 执行完整 119 项 Node 测试通过。最终记账收口后，4 项针对交付合同、字节保真、源码快照、空回复与上下文失败的回归再验通过。初次完整运行因系统 `python` 指向 WindowsApps 占位程序而有一项失败，调整本次命令的 PATH 后已通过；没有修改系统 Python 或全局配置。

- 两批的宿主原始执行导出尚未提供，旧轮人工转写风险不能靠新工具追溯消除。
- 手机画布文字、实现标识按钮与 Cocos 中文重影仍待专项表现修复；本轮改进了后续交付要求，没有改写旧模型输出或锁定 SDK。
- 新合同尚未用新增模型调用评测；当前只做已有产物回放与回归，不能宣称提升了模型成功率。
- 正式 G3、人工作品质量、真机及 Registry 不升级；后续新生成仍需显式预算。
