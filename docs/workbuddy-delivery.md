# WorkBuddy 五款游戏交付入口

## 2026-11-08 本地交付压缩包

[下载五款内容包与导入说明](../output/workbuddy-delivery-20261108-b0336a71.zip)（20,491字节），SHA256 `5a8c79eaaa72c33880a88aad6562fef39f7c4b7373baf50cb4d2dd2f0d14361a`。包含G01/G03原候选内容包、G17/G21/H01当前revision3工程修正版包、逐文件SHA清单、索引与README。包内所有定义已与当前交付入口逐项核对，本次仅完整性/版本收口，未重复试玩或新增模型调用。

该压缩包保留在忽略的output目录，不随Git提交自动上传；不包含SDK、依赖、宿主配置或完整私有证据，不是独立应用。解压后按README使用兼容a2game宿主导入。此前接收方导入验证仍按其原revision2范围保留，本次打包不冒充新的接收方复测。

2026-11-07。按用户最新要求，产品质量评价采用 **Agent质量**，由Worker实际操作、截图和问题反馈，加主审复核，不再等待真人评价。原生运行、主审修正版、接收方导入验证分开保留；模型来源、用量、真机和正式G3其他条件不变。

## Agent质量口径

检查操作是否能理解并执行、目标和反馈是否清楚、画面是否遮挡、核心玩法能否完成，以及已发现问题是否修复。保留操作步骤、实际截图和复核结论，不用只有通关的自动脚本代替质量观察。玩法趣味属于Agent评价，不宣称代表真人偏好。正式G3的质量环节也使用此口径，但来源、独立性及完整调用链仍须分别满足。

当前Agent质量为 **5/5款完成本轮参考复核**，其中G17以明确的截图反馈控制方式通过：G21/H01 revision3已修复复核，G01/G03自由试玩与截图主审通过；G17 revision3延长目标驻留/瞄准窗，加入实时剩余秒数（暂停冻结、重开复位）及60秒总限时。Orca Worker正常时钟对话轮次试玩击杀3架但未通关；主审随后用正常时钟截图反馈策略识别画面色块并操作真实方向键/空格，约35.6秒、满生命击杀6架通关，无solution回放/manual clock/内部敌人坐标读取。这证明视觉反馈Agent可以操作，不代表慢轮次LLM或真人难度评价。[Worker修复回执](../reports/g17-agent-quality-unblock-20261107095333.-5f473faf/receipt.json)、[正常时钟截图策略记录](../reports/g17-visual-agent-20261107/summary.json)。原生失败和正式G3状态不改。

旧报告将原1800Tick误算为60秒，现确认tickHz=60、原限时30秒；revision2为35秒，当前revision3为60秒（均含15秒准备期）。历史humanReview字段保持原事实，不再作为当前真人门槛。

## 游戏与证据

下列报告和 `output/` 包保留在本机忽略目录，不随 Git 提交自动分发；接收方需获得实际包文件、兼容可信宿主、锁定 SDK 和审核资源。

| 游戏 | 本机入口 | 当前结论 |
| --- | --- | --- |
| G01 推箱子 | [原生内容与试玩](../reports/host-first-evaluations/workbuddy/2026-11-04T15-52-53-805Z-532bd2fe-6c5d-4f67-9a4e-467d0ef00cd4/receipt.json)、[绑定补验](../reports/host-first-evaluations/workbuddy/2026-11-04T23-53-12-504Z-b2975dfe-347e-4786-833c-5836c9ef3317/check.json) | 玩法与绑定工程参考通过；来源/人工等独立未验 |
| G03 三消 | [回执](../reports/host-first-evaluations/workbuddy/2026-11-06T14-59-46-478Z-0222c599-dab4-46a7-8571-4a33aa975358/receipt.json) | 修复后通过；首个拒绝稿字节缺失保留 |
| G17 射击 | [原回执](../reports/host-first-evaluations/workbuddy/2026-11-06T15-37-58-436Z-313e4e38-2da1-46d3-868f-e16fc07db60f/receipt.json)、[Air补验](../reports/host-first-evaluations/workbuddy/2026-11-06T15-37-58-436Z-313e4e38-2da1-46d3-868f-e16fc07db60f/followups/air-win-20261107/receipt-addendum.json) | 双端通关；整轮 PARTIAL（历史 expired 和补验链缺项） |
| G21 塔防 | [修正版JSON](../integrations/hosts/workbuddy/repaired-games/g21/game.json)、[修复验证](../reports/host-content-repair-g21-final-20261107/summary.json) | 主审修正版双端画布建塔/余额不足负例/通关通过；原生运行的3个expired不改 |
| H01 合成炮台 | [修正版JSON](../integrations/hosts/workbuddy/repaired-games/h01/game.json)、[修复验证](../reports/host-content-repair-20261107/summary.json)、[接收方导入](../reports/workbuddy-delivery-20261107/summary.json) | 主审修正版双端通关、炮台分离；新导入目录的Air通关/重开/释放关闭通过 |

修正版是主审空间/输入配置修订，不得记成模型重新生成或一次成功。原生稿仍在原 RUN 内。[修订来源与 SHA](../integrations/hosts/workbuddy/repaired-games/provenance.json)绑定修改前后字节。

## 当前内容包：revision 3（本机）

G17当前为revision3，见[主审Three定向回归与导出记录](../reports/g17-agent-quality-lead-rev3-20261107/summary.json)和[新内容包](../reports/g17-agent-quality-lead-rev3-20261107/g17-revision3.package.json)。旧revision2包与静态时限报告保留在`reports/g17-agent-quality-lead-20261107/`，不再作为当前交付；原生G17的PARTIAL/expired不覆盖。

Orca Worker代理试玩后，修正了准备时间不足和操作提示难发现的问题。H01首波约18秒、G21约16秒；画布提示写明按键/点击操作。H01无画布购买绑定，购买/合成使用键盘或DOM按钮；原“输入路径全断”推断已被重开时按钮可用、败局后才禁用的时序证据推翻。

- G21：[revision 3包](../reports/agent-content-repair-lead-20261107/g21-revision3.package.json)，SHA256 `5ad104d09bdd448a2c32b4953f922641f301b675029ed4483d264a0efbb70be3`。
- H01：[revision 3包](../reports/agent-content-repair-lead-20261107/h01-revision3.package.json)，SHA256 `2a144616ac54274b49774d291d08f1c2c53d1a617add50f04e69290049ad242e`。

证据：[Orca Worker正常时钟Air试玩及修复](../reports/agent-content-repair-20261107043336.-04112fce/receipt.json)、[主审Three.js定向通关及重新导出](../reports/agent-content-repair-lead-20261107/summary.json)。旧炮台退出、余额不足等现有负例仍由Conformance覆盖。本轮记为Agent质量复核；未新增开始按钮，准备阶段到期仍会开始，不宣称无限读屏等待。

## 历史revision 2包（保留，不是当前默认交付）

- G21：[最终包](../output/mcp/ca370e59-a3ac-4d97-bfaf-eb434c126363/18d3c582-5727-4e32-9c3e-32d6d45569ae.package.json)，SHA256 `c2024a9e4de6a51fdce31f2d2860e359177e1250df219f327534354270a625de`。
- H01：[最终包](../output/mcp/b4e444e9-5df6-4940-b7a2-fe80320bfca8/0bd1b0af-ebef-4c66-b5c3-8e4cf8357e0b.package.json)，SHA256 `2f8319451223903b2494c33a526e1e456f7b194e3fbcfbf85b30cc60ec48d507`。

## 接收方最短使用方法

在具备依赖、已构建 Runtime、真实 SDK 和审核资源的 a2game 根目录执行：

```powershell
node generator/cli.mjs import-package <收到的.package.json> --output output/my-received-game --json
node generator/cli.mjs preview output/my-received-game --backend air
```

输出目录必须全新，导入会重新校验内容及兼容性；打开返回 URL，通过玩家按钮游玩，结束后关闭预览进程。也可用 `--backend three`，但接收路径不要求重复整套双端验收。

`a2game-generator-package` 使用上述 CLI 导入；播放器“导入游戏 JSON”接受 GameSpec 或 `a2game-release-bundle`，不要直接把 Generator 包传给该入口。这是两种已有内容格式的不同入口。

本轮接收验证使用同一机器的新目录 `output/workbuddy-delivery-receiver-20261107`，没有重新安装完整环境或声称异机验证。实际检查：包完整性、重新准入、定义一致、Air DOM输入通关、重开Hash恢复、播放器dispose后资源为0/监听器关闭、服务URL无法再访问；模型调用0。

## 下一步

G17阻塞已在当前Agent评价范围内关闭，不重复五款矩阵或追加生成。对话轮次操作仍易受工具延迟影响，真人偏好/慢轮次模型适配不由截图策略通过推定；后续只处理新的具体问题。窄屏、正式G3、真机及来源认证保持独立状态。Qoder/TRAE仍待定，历史过期记录不再追补。
