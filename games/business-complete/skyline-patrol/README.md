# 云线巡航

第八版 [muzzle.game.json](muzzle.game.json) 让弹丸出生点对齐机头前缘。短局及三段难度见证随版本登记。使用 `skyline-patrol-offscreen-browser.mjs --muzzle` 验证边界和短局，追加 `--long` 验证三段难度路线。正常时钟压力测试使用 `skyline-patrol-endurance.mjs <air|three> --muzzle`。

第七版 [contact-order.game.json](contact-order.game.json) 启用 `projectileBeforeContact`。同一 Tick 的弹丸先完成命中，已击毁敌机不再造成接触伤害。计分局正常死亡后，结算面板显示本局权威分数。用 `node scripts/skyline-patrol-contact-order-browser.mjs` 复验两种实体 ID 排序及致命／非致命对照。`skyline-patrol-offscreen-browser.mjs` 和 `skyline-patrol-endurance.mjs` 使用 `--contact-order` 复验第七版。

第六版 [offscreen.game.json](offscreen.game.json) 的可视区仍为 10,000 × 16,000。模拟高度扩至 18,800，画面上方和下方各有 1,400 单位的缓冲区。敌机从上缓冲区下降，在下缓冲区到期回收。向上发射的弹丸在上缓冲区外沿回收。玩家的碰撞框始终限制在可视范围，拖动和画面使用同一个坐标原点。

第六版使用 [短局计分输入](offscreen-score-trace.json) 和 [三段难度输入](offscreen-long-score-trace.json)。运行 `node scripts/skyline-patrol-offscreen-browser.mjs` 验证双引擎边界和正常时钟短局，追加 `--long` 复验三段难度的确定性长路线。下文的 30/10 分钟回执对应第五版。

第六版的正常时钟压力测试使用 `node scripts/skyline-patrol-endurance.mjs three --offscreen` 和 `node scripts/skyline-patrol-endurance.mjs air --offscreen`。两个浏览器顺序运行。双端完成后用 `node scripts/check-three-games-browser-receipts.mjs --offscreen-endurance <CocosAirJS回执> <Three.js回执>` 对照版本、输入轨迹、共同终局、性能及资源释放。

BIZ-01 的首个可玩版本。拖动飞机避开敌机，飞机自动射击。击落侦察机得 100 分，击落运输机得 400 分。撞机结算后可以点击「再玩一次」。

在已准备真实 SDK 的工作区运行 `npm run player:serve`，打开播放器并导入 [game.json](game.json)，可切换 Three.js 或 CocosAirJS。当前使用参考播放器。

[规则用例](conformance.json) 检查持续生成与得分、撞机结束和重开。[计分 Trace](score-trace.json) 从正式初态重放拖动，预期得分 200，状态为 `lost`，并出现玩家死亡事件。

第二版使用 [phased.game.json](phased.game.json)。侦察机、运输机、母舰分别提供 100、400、1,000 分。每 72、48、30 Tick 刷新一个目标，三段分别从 0、60、180 秒开始，末段持续循环。固定种子可复验加权抽选、不同出生位置和赛局路径。[规则用例](phased.conformance.json) · [计分 Trace](phased-score-trace.json)

第二版在正常时钟下通过真实双引擎的 100 分结算与重开。

第三版使用 [supplies.game.json](supplies.game.json)。每 30 秒生成双发或炸弹补给。双发效果持续 12 秒，重复拾取刷新。开局有一枚炸弹，最多携带三枚，按 B 或点击「使用炸弹」清除当前敌机并计分。[炸弹用例](supplies.conformance.json)

第三版的炸弹按钮在真实双引擎均通过。双发拾取、刷新、暂停和过期已通过 Headless 夹具。

第四版使用 [relative.game.json](relative.game.json)。你可以从飞机旁按住开始拖动，飞机会保持按点与机身的相对距离。松手或取消后停止跟随。结算时自动记本地最高分，重开或同源刷新后可查看。[拖动用例](relative.conformance.json) · [计分 Trace](relative-score-trace.json)

第五版使用 [delivery.game.json](delivery.game.json)，以原创程序化机体、弹丸轨迹、补给图案、命中粒子和合成音效交付，无需外部图片、音频或 CDN。独立包按正常时钟通过双引擎的拖动、结算、重开、最高分与声音偏好刷新，以及销毁检查。双发拾取、暂停冻结和到期恢复单发也已通过双引擎浏览器实测。真实长局和设备验收待完成。

使用 `node scripts/package-player-sdk.mjs games/business-complete/skyline-patrol/delivery.game.json` 生成独立目录，再通过静态 HTTP 打开其中的 `/player/index.html`。

[长局输入](long-score-trace.json)从正式初态跨越三段难度，在第 17,043 Tick 死亡，得分 14,900。正常时钟的验收入口为 `node scripts/skyline-patrol-endurance.mjs air` 和 `node scripts/skyline-patrol-endurance.mjs three`。两者重放相同的初始局序列，分别记录 30 分钟和 10 分钟的帧时间、对象峰值和重开前后资源诊断。
