# 纹港叠牌

[教学关](game.json)有 18 张牌，分成九组双层叠放。点击露在上层的牌，同类凑三张后会从七格暂存区消除。清空桌面和暂存区即完成教学。

从参考播放器导入 GameSpec 并开始。Three.js 和 CocosAirJS 均已通过画面点选、拒绝被遮挡的牌、18 张清空和重开。[规则用例](conformance.json) · [通关 Trace](tutorial-trace.json)

[主挑战](challenge.game.json)包含 144 张牌、12 类牌面和 24 组六层堆叠。七张不同类同时占满暂存区会失败。双引擎均用实际画面点选完成教学解锁、七步失败、重试和 144 步通关，刷新后关卡仍保持解锁。[胜利 Trace](challenge-win-trace.json) · [失败 Trace](challenge-loss-trace.json)

运行 `node scripts/serve-collection.mjs games/business-complete/pattern-harbor/collection.json`，打开命令输出的链接即可从教学进入[带道具的主挑战](resume.game.json)。每局可移出前三张、撤回最近一次选牌或取回操作，以及洗牌各一次。移出的牌要从保留区取回消除，撤回不会退回已消耗的道具额度。只有能构造合法通关路线的新排列才会提交洗牌。[用例](resume.conformance.json)

同一个浏览器和站点地址会保存通关进度和主挑战成功提交的事务。刷新后可继续此前的棋盘、暂存槽、保留区、道具与撤回点。遇到损坏记录，页面会提示重试；主动重试会开始新局。

用 `node scripts/package-player-sdk.mjs games/business-complete/pattern-harbor/collection.json` 生成独立两关目录。静态 HTTP 打开 `/player/collection.html`。仓库外构建副本已在两个真实引擎上通过教学解锁和局中刷新恢复。
