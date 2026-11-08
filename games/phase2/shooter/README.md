# 光弧巡游：引力核心

在纵向航道的下方驾驶飞机，24 秒内击退从上方进入的四架敌机：侦察、护卫、装甲与核心 Boss。约 5 秒后首波出现、14 秒后 Boss 入场。Boss 半血会开启引力场，敌我均向下受力，应先向侧方避开核心，再按 W 向上脱离，持续接触核心会快速损失生命；生命归零，或时限到达时尚未击退全部目标，均会失败。W/A/S/D 移动，按住 Space 持续自动瞄准射击；每次击退获得 5 能量，按 E 消耗 5 能量提升新弹丸威力，最多提升两次。画面显示生命、能量、威力、击退数与 Boss HP；结束后可使用“再玩一次”。

已安装项目依赖及锁定 SDK 时，从项目根目录启动：

```powershell
node generator/cli.mjs preview games/phase2/shooter --backend three --ready
```

打开输出的本地 URL；准备界面允许先阅读操作说明，点击“开始游戏”后计时。Ctrl+C 关闭预览。`--backend air` 可切换 CocosAirJS，第 3 版已补测该端完整战斗，第 4 版尚未在该端试玩。事件特效和反馈声音是 Player 中的可选功能，不是内容包自带音效。

第 5 版的导出由主审处理；保留的第 3 版内容包：`output/phase2-shooter-vertical-2026-11-08T08-25-46-673Z-df6e1a0c/shooter.package.json`。需要支持 `a2game.visual.body-motif@0.1.0` 的兼容可信 A2Game 宿主、相应 SDK；这不是独立 Player SDK。机体图案来自作者 CC0 `assets/themes/spaceflight.json`，以现有公开图元模板旋转为纵向后嵌入 GameSpec；共享模板不提供飞行方向旋转或完整动画，Boss 仍是同一敌机模板的较大实例，弹丸外形固定朝上而非跟随自动瞄准方向。

本作是 Cindy 会话中 **native subagent 作者修订**，依次衍生自 `output/host-native-arc-drifter-20261108/attempt-3/` 与本作品第 2 版，不是独立新生成或 Qoder/WorkBuddy/TRAE 原生作品。第 3 版调整战区宽度与初始/波次位置，保留共享 Runtime 成长、自动瞄准和 Boss 机制，缩短阶段标题、清晰说明目标及失败条件；移动坐标断言同步更新，原通关、松键停止、成长余额、无射击失败和终局拒输入用例保留。第 3 版的 Boss 是高生命波次对象，没有独立弹幕或多阶段逻辑。

证据和冻结三件套：`reports/phase2-shooter-vertical-2026-11-08T08-25-46-673Z-df6e1a0c/`。该版 Three.js 按作者引导完成正常时钟流程；首次浏览器流程在多次“运行追帧超限”暂停后超时失败，重试通过真实继续并重新按下 Space 后获胜，但仍发生 3 次追帧暂停。失败记录保留，不声称连续无暂停。作者引导不是独立盲玩或正式 G3；独立 Agent 对第 3 版、声音、真机和其它宿主未验。Air 部分试跑时共享源码正在更新，未记录当次加载的源码指纹，不作为最终源码 Gate。第 1/2 版旧证据保留在 `reports/phase2-shooter-20261108-terra-g17/` 和 `reports/phase2-shooter-20261108-terra-g17-rev2/`。


2026-11-08 补测：CocosAirJS 当前冻结共享源码下按作者引导、正常时钟完成整局，出现 3 次“运行追帧超限”暂停，点击继续并重新按住 Space 后通关；并非连续无暂停。游戏与指定共享文件的开始/结束 SHA 一致，见 `reports/phase2-shooter-air-full-2026-11-08T10-11-43-257Z-c41ab148/receipt.json`。

第 4 版以第 3 版为基础，在 Boss 半血时触发一次引力场：现有规则更新共享 `tiltGravityPath`，从下一逻辑 Tick 起对 Boss 和玩家施加向下的全局加速度，玩家仍可移动。Boss 于 14 秒入场、生命 30，20 秒限时和生命归零失败不变；没有新增独立弹幕或按游戏 ID 实现的玩法。新增场景断言阶段触发、实际下坠与 W 上移；原关键负例保留，作者解法不变。第 4 版 GameSpec、Conformance 和解法冻结及记录在 `reports/phase2-shooter-boss-2026-11-08T10-21-47-989Z-64e0441a/`。

Three.js 正常时钟按作者引导观察阶段切换、下坠、W 上移及通关；出现 3 次追帧超限暂停，通过页面继续，不代表无暂停或独立盲玩。CocosAirJS 第 4 版、声音、真机、独立 Agent 质量未验。

第4版内容包已补导出：`output/phase2-shooter-boss-rev4-20261108.package.json`，完整重新准入/导出日志见 `reports/phase2-shooter-boss-2026-11-08T10-21-47-989Z-64e0441a/export.log`；旧第3版包不覆盖。

第 5 版在第 4 版基础上将核心生命提升至 60，半血 30 时开启原有引力场，时限与 HUD 延长为 24 秒；原失败条件和成长机制保留。按作者引导先向侧方避让再向上，Headless 阶段持续 196 Tick（约 3.27 秒）并通关；另一条向侧方移动不足的尝试因与 Boss 接触而失败，记录保留。作者操作不等于独立玩家质量验证；Boss 仍无独立攻击或弹幕。第 4 版冻结和本版过程见 `reports/phase2-shooter-boss5-2026-11-08T10-36-59-524Z-dc73b47d/`。

第 5 版 Three.js 正常时钟一次作者引导实测：观察到引力阶段、实际 W 上升及通关，观察到的阶段至终局为 200 Tick（约 3.33 秒），未观察到暂停；见 `reports/phase2-shooter-boss5-2026-11-08T10-36-59-524Z-dc73b47d/rev5/browser.json` 和截图。此回合不代表独立盲测或其它设备质量。

当前第5版交付包：`output/phase2-shooter-boss-rev5-20261108.package.json`，完整准入/导出日志为 `reports/phase2-shooter-boss5-2026-11-08T10-36-59-524Z-dc73b47d/export.log`。此前SDK/Android示例冻结在第4版，用于输入与嵌入演示；加载第5版须重新打包，不能修改旧分发目录绕过可信摘要。
