# A2Game Host-first 精简执行计划

更新：2026-11-04。代码审查基线：`main@3a452c463feadae88bb050ff0c81fb8d4df7ed29`。

根据用户本轮完整“精简执行版”落地。本文调整执行范围与必要验证，不重置历史计划、正式Gate、协议0.1.0或项目1.0.0 Alpha状态。与旧文档测试安排冲突的部分以本轮用户指令为准。

## 当前只执行 HF-N0 → HF-N1 → HF-N2

| 工作包 | 实际交付 | 最小验证 |
| --- | --- | --- |
| HF-N0 基线确认 | HEAD、命令结果、能工作的功能和明确阻塞 | 必要构建、现有generator:smoke、check-host-first各一次；本地无模型MCP能力查询 |
| HF-N1 真实宿主接入 | Qoder、WorkBuddy、TRAE分别记录CONNECTED/PARTIAL/BLOCKED | 实际发现工具及一次list_capabilities；自动/显式Skill各至多一次必要尝试 |
| HF-N2 首个真实G01 | 至少一个宿主原生新游戏、内容包和简短回执 | 正常通关一次、非法推动不改状态、暂停/重开/关闭；同JSON在Air和Three各实际试玩一次 |

本轮按用户最新指令优先WorkBuddy，Qoder/TRAE暂缓、后续待定。ZCode仅独立扩展，不增加必达宿主数。模拟/控制端辅助作品不能替代真实品牌宿主原生生成。当前模拟矩阵停止扩展，既有原始失败和工程记录保留。

## 后续按实际问题推进

- HF-N3（P0）：只修真实使用中发生的Capability选择、诊断、JSON规则、输入或通用表现问题。原问题→最小修复→原问题消失→现有相关回归。
- HF-N4（P1）：稳定宿主依次创作G03/G17/G21/H01；每种一个核心正常流程和一个关键负例，双SDK各试玩一次。15单元Benchmark不是开发前置，不自动追加模型预算。
- HF-N5（P1）：最短安装/使用路径、可玩内容包、宿主差异与未完成事项；不要求先发布npm或上线服务。

## 验证上限

复用Runtime、Generator、CLI、MCP、Skill、Studio及现有证据工具。完整准入不放宽；不新建测试框架、CoverageResult或状态Schema，不为每个字段设计Fixture，不穷举游戏状态×尺寸×引擎，不恢复或重建丢失私有原始证据。界面改动看一次目标视口的启动、操作、结束；明确出现窄屏问题才追加320/390。未触及模块不重复验收。

公共Runtime/协议变更才扩大到相关Conformance及双SDK。旧reports缺失与当前功能故障分开记录，不绕过旧门禁，也不以全绿作为独立开发前提。工程参考不升级正式G3、人工、真机或32+5 verified计数。

## 权限和交付

每个真实宿主新G01最多三个候选，原生模型用量遵守当次授权与实际额度；MCP `--max-calls 0`，不调用generate_game或第二模型，不复用已耗尽Generator预算。Qoder路由历史风险由有权限人员在宿主侧处理；本轮不读取、打印、重置或保存凭据。WorkBuddy exFAT上的一致Skill副本直接复用，不再纠结软链接。

保护所有已有差异和历史证据；不擅自提交、推送、部署、变更权限或全局设置。桌面输入若被宿主保护拒绝，停止界面输入，不用其他渠道绕过。每次交付只说明改动、实际执行、结果、未验和下一步。

## 当前基线记录

2026-11-05补验完成：WorkBuddy专用绑定run的10调用/10规范台账均已归档；主审重新执行现有checkHostRun及文件/包SHA核对通过，missing=[]，两端预览均显式关闭。原JSON和包字节不变，旧PARTIAL不覆盖，旧双SDK试玩仅按相同游戏SHA引用。无需再次重连或重复G01；实际宿主生成来源/用量、独立性、同Tick完整Hash与正式G3继续未验。下段“需重连”描述保留为补验前历史过程。

2026-11-05更新：WorkBuddy旧run已有G01双SDK实际输入通关、关键负例、重开和导出，主审已核对SHA与玩法状态；完整Hash未在同Tick对齐。旧服务hostRunId=null，规范检查保持PARTIAL。已将本机a2game MCP启动args绑定到独立补验run，复用原三个JSON，禁止重新创作。补验入口见 `reports/hf-n0-20261104-lean/workbuddy-binding-followup.json`，仍需宿主重连并执行新TASK.md；旧浏览器结果仅按相同游戏SHA引用，不冒充新预览试玩。桌面重连点击因USER_INPUT_ACTIVE未交付，不能宣称绑定已在实际宿主生效。

HF-N0已执行：HEAD与origin/main一致；build、generator:smoke、check-host-first均退出0，本地stdio的list_capabilities返回PASS_REFERENCE，真实模型调用0。日志在本地 `reports/hf-n0-20261104-lean/`，不等于真实宿主已连接。

HF-N1本轮优先WorkBuddy，尚未取得新能力查询回执：可见旧a2game会话，打开新任务的桌面点击返回foreground_unavailable，已停止输入，未发送新模型任务。之前USER_INPUT_ACTIVE拒绝记录保留。Qoder/TRAE待定。HF-N2未启动新宿主生成，不能把之前模拟G01或旧WorkBuddy稿件计入本轮。

历史依据：[完整计划](../PROJECT-PLAN.md)、[Host-first台账](../project/host-first-status.json)、[现有Pilot工具说明](host-agent-pilot.md)。历史模拟与正式验收继续分开。
