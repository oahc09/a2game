# G59 霓虹回路：首个可玩积分参考

两份 GameSpec 共用同一套确定性规则，不包含后端特判：
- `g59-neon-arena`：右侧航道、三波目标和一支追兵。
- `g59-neon-arena-mirror`：左侧航道、独立的波次时间与挡板。

运行 `npm run catalog:build`、`npm run sdk:prepare` 和 `npm run player:serve`，在普通播放器目录中选择上述关卡。也可用 `node scripts/package-player-sdk.mjs specs/v0.1/games/g59-neon-arena.game.json` 构建独立包。双触控分别按住左右半区，左手移动、右手拖出瞄准向量即按冷却自动发射；标准布局手柄需显式启用。键盘用 WASD 移动、方向键瞄准兼发射。按压不动或释放不继续开火；暂停、断连和画布缩放清除当前意图，不能把上一帧的向量当成继续输入。

击毁每个敌机得 10 分，达到 30 且存活结束为胜利。角色死亡或计时耗尽为失利；角色不计击毁奖励。同一 Tick 达标且角色死亡时只发送一个失利结算，成绩仍保留。只在最后一个 Tick 达标但角色仍存活时，先达标，不因超时而判负。重开清空本局的得分、准星和对象状态。

`node --test test/g59-arena.test.mjs` 验证输入一致性与真实碰撞结算；`node scripts/g59-arena-browser.mjs` 用已准备的两个锁定 SDK 及可选 `A2GAME_WEBKIT_EXECUTABLE` 完成普通、独立播放器整局与截图采集。

[WebKit 验证记录](../project/evidence/g59-arena-webkit.json) · [CocosAirJS 实际运行画面](evidence/g59-arena-cocosairjs-webkit.png)

本轮是固定整数世界的有目标训练局，不是完整无限计分模式；未包含跨局最高分持久化、30/10 分钟真实播放器压力、实体触屏或手柄，也不改变正式 32＋5 / G3 门禁。
