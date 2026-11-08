# 潮汐铸防：港湾守望（revision 3）

在 15 秒准备期熔炼两批矿石，每批耗 2 秒，收取 3 币。建塔每座 3 币，抵挡三波来敌；漏掉一艘即败。塔位 A 是靠前的前哨，塔位 B 覆盖中段；炮台旁数字是单发伤害，红艇旁数字是剩余生命。击退首艇可得 6 币，二级升三级需 6 币。

- 合成路线：R 熔炼、H 收取两次；1 建 A、2 建 B、3 选 A、M 合到 B；首杀后 U 升 B。
- 直升路线：同样取得 6 币后，2 建 B、U 升 B；首杀后再次 U 升三级。两条均消耗 6 币建立二级 B，合成路线可先利用 A 提前覆盖，但需额外操作；直升只需占用 B。分散购买的炮台若不及时合成或集中升级，末波可能漏过。

R/H、1/2/3、M/U/V 也可使用页面按钮；V 升级 A。合成只接受不同格同级炮台，成功后旧塔及旧武器退出，新塔继承较晚的射击冷却。暂停可用于规划，重新开始会恢复开局。

在已安装依赖及可信锁定 SDK 的项目工作区启动：

```powershell
node generator/cli.mjs preview games/phase2/turret-defense --backend three --ready
```

打开命令输出 URL，先阅读说明，再点击开始；重开并准备可重新读屏。结束时 Ctrl+C 关闭预览。也可用 `--backend air`；接收方须具备兼容 A2Game 宿主及可信 SDK。内容包见本次独立 output 目录；它不是独立 Player SDK。

本作由 Cindy 当前会话的 native subagent 在已有 `output/host-native-tidal-foundry-20261107/attempt-3/` 基础上作者修订：调整 A 位覆盖，更新主题与说明，沿用可信塔防与规则；不是 Qoder、WorkBuddy 或 TRAE 品牌宿主独立新生成，也不是独立 G3。`solution.json` 是作者引导的合成路线；两条路线的完整 Conformance 在 `conformance.json`。正常时钟试玩按作者解法操作，不是独立盲玩或质量签收。

revision 2 为主审在 native subagent 原稿上的内容修订（CONTROLLER_AUTHORED_NON_MODEL）：采用受审 `tidal-turrets` 通用机体图元，区分炮台等级/伤害与敌艇生命；重排标题、HUD、铸造区和底部提示，拒绝操作会给出具体原因。战斗数值、波次和两条经济路线保持原设计。画布格位不是点击购买入口，使用下方按钮或声明的快捷键。

原稿三件套、修订候选和 SHA 保存在 `reports/phase2-h01-lead-repair-20261108/`。`export.log` 为完整准入/Conformance/导出通过记录；`browser.json` 记录真实 Three.js 正常时钟下准备、无钱建塔拒绝且不扣款、熔炼、购买/合成、升级、三波通关和重开，自动暂停为0。这是作者引导的 DOM 操作，不是独立 Agent 盲玩。

共享 Player 的 `feedback=1` 可选事件效果与显式启用的提示音属于宿主增强，不在 JSON 包中；此前 Three 的首次开火/合成效果观察见 `reports/phase2-feedback-20261108/h01-event-browser-three.json`，不等同当前版本整局验证。此前 Air 出现的 `AIR_E_ORTHO_WIDTH` 原始失败保留，最小探针未复现，根因未定；revision 3 的独立 Agent 质量复核仍未验。真机、正式 G3、品牌宿主独立生成不升级。

revision 3 为 native subagent 基于实际画面作的纯表现修订：将伤害与生命数字移向图案边缘，图例改为‘炮台数字=伤害’，不修改玩法规则或作者解法。候选及验证保存在 `reports/phase2-h01-rev3-20261108-terra/`；画面复核者已读作者路线，不是盲玩或正式 G3。


revision 3 的交付包：`output/phase2-h01-rev3-20261108.package.json`，导出/重新准入日志见 `reports/phase2-h01-rev3-20261108-terra/export.log`。这是展示修订，未重复签收整局或更新旧回执。

当前revision3已补一次Air正常时钟作者路线：无钱拒绝且钱包不变、两轮熔炼/合成、升级、三波胜利和重开通过，无追帧暂停；源码指纹前后一致，见 `reports/phase2-h01-air-20261108-terra/browser.json`。未复现历史ORTHO_WIDTH不代表根因排除，受管节点/资源释放不等于SDK全局缓存或整GPU归零。
