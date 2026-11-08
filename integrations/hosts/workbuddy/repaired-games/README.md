# WorkBuddy 内容工程修正版

这些文件是主审针对真实试玩问题制作的工程修正版，不是模型重新生成、原生一次成功或正式 G3。原运行、失败稿、快照和历史 PASS/PARTIAL 均保持原样，来源和 SHA 见 [provenance.json](provenance.json)。

- `g17/`：新增目录（2026-11-07）。源为 WorkBuddy 原生 G17 候选 attempt-2（revision 1，RUN 2026-11-06T15-37-58-436Z）。Agent 质量试玩发现开局即高压/隐含限时无提示/得分冒充击落计数/玩家机在 1280×800 折叠线下且敌人出生遮挡 HUD，据用户修复授权做第一次 controller 修订（revision 2，CONTROLLER_AUTHORED_NON_MODEL）：波次 tick 0/120/240 → 900/1020/1300/1420/1700/1820（15 秒读屏准备，60Hz），maxTicks 1800 → 2100 并在画布与说明中明示 35 秒总限时与超时判负，HUD「击落/60」改「得分/60（每架10分）」，玩家出生 y 420→2400 且敌出生高度 10600/11000/11400→10600/10200/10400 使默认视口可见己机、敌机不遮挡 HUD 行；Conformance/解法同步重排，负例（挂机坠毁、终局拒输入、暂停生命周期）保留。原 RUN 与旧快照未动。2026-11-07 第三次 controller 修订（revision 3，解除 Agent 质量 PARTIAL）：restitution 0→800 使击落前敌机触底反弹滞留战区（单目标可持续瞄准约 16-18 秒），maxTicks 2100→3600（60 秒 @60Hz），经 core.bootstrap/core.timer/rules.timer-schedule 公开算子实现实时剩余秒数（state /remaining 每 60 tick 递减、HUD 实时显示、暂停冻结、重开复位）与 /phase 准备期→战斗中显示；Conformance 新增剩余时间推进/暂停冻结/重开恢复断言，负例（挂机生命耗尽、终局拒输入、生命周期）保留；非模型新生成。
- `g21/`：三个全画布 `touch.tap` 改为三个独立的 `touch.select` 格位命中区域，避免点击无法区分目标。输入坐标使用与画面同宽高比的 12×9 坐标系，满足公开合同最小尺寸。同时将空间配置和场景同比放大五倍，使固定尺寸炮台不再互相重叠或遮挡 HUD；金币、波次与规则不变。2026-11-07 第二次 controller 修订（revision 3）：波次 tick 2/152/302 → 480/630/780（30Hz，约 16 秒读屏准备时间，间距与 maxTicks 900 保持不变），画布内标题移开水印角落并新增建塔提示文字，meta.description 改为中文并注明三波、波次从 0 计数；Conformance/解法按公开模块语义同步对时，负例未放宽；非模型新生成。
- `h01/`：将防御空间尺寸、塔位、路径、攻击范围与敌人速度同比放大五倍，并同步场景坐标；固定 300 单位炮台投影相对于塔位间距缩小，解决合成前重叠。这是空间配置修订，不是只改表现或沿用原 Hash 的声明；必须重新准入和执行 Conformance。2026-11-07 第二次 controller 修订（revision 3）：波次 tick 60/300 → 540/900（30Hz，约 18 秒读屏准备时间），maxTicks 600 → 1200，新增 `a2game.visual.text` 依赖与画布内标题/键位/准备提示文字（键盘 1/2 购买、3 选中、4 合成）；Conformance/解法同步对时，暂停拒输入、终局拒输入、旧炮台退役与余额不足负例全部保留；非模型新生成。

两者都增加 GameSpec revision，保留原 ID，随附对应 Conformance 与解法。使用现有完整准入加载 `game.json`、`conformance.json`、`solution.json`，不要覆盖旧内容包。同一 ID 的不同 revision 和字节须分别留存；SHA 不证明作者或模型来源。

验证只做本次相关路径：G21 双 SDK 画布点选不同格位、余额不足拒绝与通关；H01 双 SDK 购买、合成、通关与实际画面；现有 Conformance 继续检查旧炮台退出与生命周期。不修改协议、运行时、播放器或宿主权限，不调用模型。历史过期预览不能补成显式关闭，也不能靠新报告回签旧源码。

本机验证记录：`reports/host-content-repair-20261107/summary.json`（H01最终版及G21输入修复初版）、`reports/host-content-repair-g21-final-20261107/summary.json`（G21最终布局版）。报告和内容包保留本地，不要求公开旧宿主私有材料。实际重验结论以各报告状态为准。

以上是revision 2历史记录；当前revision 3验证：`reports/agent-content-repair-20261107043336.-04112fce/receipt.json`（Orca Worker，正常时钟Air读屏后操作通关、现有Conformance/解法）与`reports/agent-content-repair-lead-20261107/summary.json`（主审Three.js定向通关、新revision包导出）。当前包及SHA见[交付入口](../../../../docs/workbuddy-delivery.md)。代理试玩不算真人体验，旧报告和旧包不覆盖。
