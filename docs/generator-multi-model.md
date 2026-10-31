# 多模型兼容性：适配层实测与真实端点矩阵

**范围口径**：本文档区分两层——① `model-http` 适配器对 Chat Completions 方言的离线 mock 测试；② 真实厂商端点实测。GLM 已有真实调用记录，Qwen、DeepSeek、MiniMax 仍未实测。新增真实调用需要独立的显式预算（GEN-7 的 30/30 已用尽且不可复用）；Fixture 与离线 mock 不是真实模型证据。

## 1. 适配器实际发出的方言（四厂商必须接受的最小合同）

```json
POST <endpoint>  content-type: application/json  authorization: Bearer <来自 bearerTokenEnv 指定的环境变量>
{"model":"<config.model>","stream":false,"max_completion_tokens":<256..65536,默认16384>,
 "response_format":{"type":"json_object"},"messages":[{"role":"system","content":"…"},{"role":"user","content":"<request JSON>"}]}
```

适配器判定：`choices[0].message.content` 非空字符串 + `finish_reason==='stop'` + 无 `tool_calls` + 无 `refusal`；`usage.prompt_tokens/completion_tokens/total_tokens` 有则记账；**模型正文原样透传**（含重复键/Markdown 包裹，交给有界修复链 `parse-agent-output.py` 诊断）。错误码：`A2G_E_PROVIDER_HTTP/JSON/TYPE/INCOMPLETE/REFUSAL/TIMEOUT/NETWORK/AUTH/SIZE`。

## 2. 离线方言一致性结果（2026-10-31，全部 mock fetch，无网络）

| 方言场景 | 结果 |
|---|---|
| 严格 OpenAI 兼容（DeepSeek-chat / GLM-4.x / MiniMax-M2+ 快乐路径） | PASS：telemetry 映射（requested/returned model、requestId、usage、finishReason）正确 |
| DeepSeek `reasoning_content` 与正文分离 | PASS：推理文本不进入正文 |
| Qwen thinking 模式非流式报错（HTTP 400） | PASS：映射为 `A2G_E_PROVIDER_HTTP`，不误判为玩法失败 |
| Qwen 默认 thinking 下 JSON 被 Markdown/思考包裹 | 透传保持原字节（含重复键）；由下游修复链报 `GENERATION_FORMAT`，重试可控 |
| 截断（finish_reason=length）/ refusal / tool_calls / 空正文 | PASS：四种有界失败各自独立可辨 |
| HTTP 429、text/html 响应、非 JSON 信封、缺 usage | PASS：分别 `HTTP`/`TYPE`/`JSON`/usage=null，正文不外泄 |
| Bearer 仅经命名环境变量 | PASS：值进入 header 但从不进入回执；缺失 → `A2G_E_PROVIDER_AUTH` |
| SSE 流式响应 | PASS：按 `A2G_E_PROVIDER_TYPE` 拒绝（适配器合同为非流式） |

## 3. 真实端点矩阵（GLM 首格已实测；其余待授权后按下表逐格执行）

| 厂商 | 端点形态 | `max_completion_tokens` | `response_format json_object` | 主要风险点 / 实测必查 |
|---|---|---|---|---|
| **GLM（智谱 Coding Plan，2026-10-31 实测 ✅）** | OpenAI 兼容 `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions`，Bearer | **接受**（实测） | **接受**（实测输出纯 JSON） | 实测：① `reasoning_content` 与正文分离、正文干净；② 思考默认开启，`extraBody {"thinking":{"type":"disabled"}}` 可关闭；③ 思考开启时非流式复杂任务 >300s（触发适配器上限），关闭后单次 ~36s；④ 生成质量：glm-5.3-flash 关闭思考 3/3 未过完整准入（`A2G_E_SCHEMA` 文本节点结构 / `A2G_E_UNKNOWN_FIELD` / `A2G_E_RULE_EFFECT`），`pass_within_budget 0/1`；回执身份 `model:"glm-5.3-flash"` 一致 |
| Qwen（DashScope/Model Studio 兼容模式） | OpenAI 兼容 | 支持 | 支持；**thinking 模式下不可靠**，需 `enable_thinking:false` | 适配器现已支持有界 `extraBody`（本轮增量），`{"enable_thinking":false}` 可直接配置；真实端点仍 NOT_RUN |
| DeepSeek | OpenAI 兼容 | 文档以 `max_tokens` 为主，`max_completion_tokens` 接受度待测 | 支持（提示须含 "json"，系统提示已含） | reasoning 模型正文为空/仅 reasoning 的失败形态；截断 `finish_reason:length` 必须可辨 |
| MiniMax | M2/M3 起官方 OpenAI 兼容（api.minimax.io/v1） | 待测（历史方言用 `max_tokens`） | 待测 | 旧版 `base_resp` 包装方言已弃用与否需实测确认 |

**两条路径的单任务参考结果（2026-10-31）**：同一计数开锁任务，`generate_game` 3 次调度未通过准入；另有宿主声明使用 GLM-5.3-Flash 的子 Agent 直接编写 JSON，CLI validate/test 与 MCP 验证、双 SDK 预览和导出通过参考检查。后者 MCP 阶段 `providerCalls=0` 不表示此前 Agent 创作没有消耗模型资源；两种路径分别记账。子 Agent 的模型身份由宿主声明，单个任务不足以证明路径之间的普遍优劣。回执：`reports/generator-glm-subagent-run/`。

**Claude Code CLI 路由（2026-10-31 实测，新 Provider `claude`）**：用户设置的 CLI 路由请求 `glm-5.3`。第一轮 3 次调度分别出现格式错误、未注册操作符和超时，结果 `0/1`。之后增加系统提示约束和规则组装词表，第二轮 1 次调度的产物通过完整准入、测试、双 SDK 预览和导出参考检查；[回执](../reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/real-provider-claude.json)记录 50.5K/16.8K tokens、模型自供解法，但返回模型身份和费用均未提供。该单次结果支持继续验证修复效果，不足以单独判定之前失败的全部原因。

**适配器兼容增量（2026-10-31，随 GLM 实测交付）**：① HTTP 超时上限 55s→300s（`scripts/http-generator.mjs`、`generator/providers.mjs`，与 MCP 服务层 600s 预算对齐）；② 有界 `extraBody`（≤4KiB、键名受 pattern 约束；`model/stream/response_format/messages` 四个合同键不可覆盖；telemetry 记录 `extraBodyKeys` 供审计）。测试 `test/generator-model-dialects.test.mjs` 9/9。

**判定规则**：每厂商至少 1 次最小生成 + 1 次截断/错误注入（如超短 max_completion_tokens），记录 requestedModel/returnedModel、usage、错误码；返回模型身份缺失或与请求不符时记 `UNVERIFIED_IDENTITY`，不作为该厂商身份验证 PASS。上述 Claude 路由的成功回执仅有 `requestedModelId`、`reportedModelId: null`，所以是功能链路参考通过，模型身份未验证。真实矩阵结果**只升级工程参考口径**，正式 G3/人工/真机不受影响。

## 4. 授权后的执行步骤（供有预算会话使用）

1. 由调用方在环境中提供密钥（如 `DASHSCOPE_API_KEY`/`DEEPSEEK_API_KEY`/`ZHIPU_API_KEY`/`MINIMAX_API_KEY`），仓库只写 `bearerTokenEnv` 名称。
2. 配置放 Git 忽略的 `.a2game/model-<vendor>.json`：`{"endpoint":"https://.../chat/completions","model":"<id>","bearerTokenEnv":"<NAME>","maxCompletionTokens":16384,"timeoutMs":50000}`。
3. 先 `node generator/cli.mjs probe --provider model-http --config .a2game/model-<vendor>.json`，再按 GEN-2 同口径跑单次真实生成并完整准入；每厂商记录独立 receipt。
4. 若 Qwen 需 `enable_thinking:false`：先做适配器兼容增量（有界 `extraBody` 白名单字段 + 正反例测试），不得为通过而放宽 JSON 模式校验。

## 5. 本轮真实调用计数（2026-10-31 更新）

MCP 真实 Provider 验证已获用户授权（≤3 次调度）并执行：2 次 a2game 调度均确定性失败（`A2G_E_CODEX_EXIT`，exit 1、0 事件、0 token 计费）；经最小直连探针定位根因为 **ChatGPT 计划用量上限耗尽**（2026-10-30 GEN-7 的 25 次调度所致），重置时间 2026-11-05 15:03。MCP 管道本身已验证（probe READY→调度→BLOCKED/PROVIDER_INFRA 归因→预算闸门 'A2G_MCP_BUDGET'）。回执：`reports/generator-skill-exercise-af02b9ba-79c5-45e2-a7f0-88784fd8010e/real-provider.json`。

**GLM 真实矩阵首格（2026-10-31）**：循环 1 的回执记录 3 次返回且未通过准入；循环 2 的回执及 generation-report 记录 1 次调度后超时。两份回执合计可核对 **4 次**，旧汇总写 6 次，若有其他调用须补充证据后再计；费用未完整导出。工程口径仍为 `pass_within_budget 0/1`。两轮失败不因后续不同 Provider 的成功而改写。回执：`real-provider-glm-cycle1.json`、`real-provider-glm-cycle2.json`。
