# G59 霓虹回路：首个可玩积分参考

两份 GameSpec 共用同一套确定性规则，不包含后端特判：
- `g59-neon-arena`：右侧航道、三波目标和一支追兵。
- `g59-neon-arena-mirror`：左侧航道、独立的波次时间与挡板。

运行 `npm run catalog:build`、`npm run sdk:prepare` 和 `npm run player:serve`，在普通播放器目录中选择上述关卡。也可用 `node scripts/package-player-sdk.mjs specs/v0.1/games/g59-neon-arena.game.json` 构建独立包。双触控分别按住左右半区，左手移动、右手拖出瞄准向量即按冷却自动发射；标准布局手柄需显式启用。键盘用 WASD 移动、方向键瞄准兼发射。按压不动或释放不继续开火；暂停、断连和画布缩放清除当前意图，不能把上一帧的向量当成继续输入。

击毁每个敌机得 10 分，达到 30 且存活结束为胜利。角色死亡或计时耗尽为失利；角色不计击毁奖励。同一 Tick 达标且角色死亡时只发送一个失利结算，成绩仍保留。只在最后一个 Tick 达标但角色仍存活时，先达标，不因超时而判负。重开清空本局的得分、准星和对象状态。

`node --test test/g59-arena.test.mjs` 验证输入一致性与真实碰撞结算；`node scripts/g59-arena-browser.mjs` 用已准备的两个锁定 SDK 及可选 `A2GAME_WEBKIT_EXECUTABLE` 完成普通、独立播放器整局与截图采集。

[WebKit 验证记录](../project/evidence/g59-arena-webkit.json) · [CocosAirJS 实际运行画面](evidence/g59-arena-cocosairjs-webkit.png)

本轮是固定整数世界的有目标训练局，不是完整无限计分模式；未包含跨局最高分持久化、30/10 分钟真实播放器压力、实体触屏或手柄，也不改变正式 32＋5 / G3 门禁。

## 生存模式

目录选择 **霓虹回路 · 生存得分**（`g59-neon-survival`）。原来的 30 分训练局仍可用。生存局没有过关配额或倒计时：击落敌机加分，机体耗尽后显示本局成绩，可立即重开。暂停期间不经过波次。同一份 GameSpec 驱动两个播放器和两个后端。

`realtime.world.config.survival` 仅用于显式双摇杆配置。每个从 `startTick` 起按 `intervalTicks` 产生的槽位，按其序号轮换敌机模板；编号取槽位本身而非累计成功次数。满池或满活跃上限时跳过当前槽，不补发。敌机寿命有限，移除后归还名额，不在检查点保存持续增长的波次历史。仅 HUD 投影 `elapsedTicks`，不作为终止条件。分数沿用协议的 1 亿数值上限，到顶不结束对局。默认保留最近 128 条观测事件（单 Tick 超过时保留当 Tick 完整批次），不裁掉规则所消费的事件，也不改变游戏 Hash；调用方显式设定的事件硬预算保持原行为。

普通和独立播放器保存同一规则下的本机最高分，须是运行时记录的机体死亡，同一终局只结算一次。记录仅含一个分数，与回放、存档和运行时 Hash 分离；按浏览器同源、完整 GameSpec 摘要区隔。存储被拒绝时仍可游玩并在当前页面保留最高分，手动 Tick 调试不写入浏览器存储。它不提供防作弊、跨标签页原子更新、跨域同步或排行榜。

短局浏览器回执不计入长时验收；普通播放器 30/10 分钟实跑另有回执，仍不计物理输入或独立 Agent 创作验收。参考目录新增一局，不更改正式 32＋5、G3 或设备分母。

### 复跑实时时钟

准备项目锁定 SDK 和 WebKit 后，分别执行：

```sh
node scripts/g59-survival-soak.mjs three 600
node scripts/g59-survival-soak.mjs air 1800 rounds
```

脚本通过普通播放器启动，按实际经过时间取样，模拟标准手柄输入；没有加速或替换播放器时钟。CocosAirJS 的 rounds 模式在自然死亡后校验结算并走界面重开，同一页持续取样；权限、异常或追帧暂停仍判失败。另可用 single 模式要求整段时长不死亡。到达时长后停止输入，验证单次死亡结算和刷新后的最高分。脚本会保留失败和保护暂停，不自动重试。结果只覆盖当前浏览器与合成输入，不替代独立播放器长跑、物理真机或独立 Agent 门禁。

普通播放器参考回执：[CocosAirJS 30 分钟](../project/evidence/g59-survival-soak-air.json) · [Three.js 10 分钟](../project/evidence/g59-survival-soak-three.json)。这两次实跑各自用动态合成手柄，并不是相同输入序列，不能用来比较游戏状态轨迹，也不代表真实硬件性能。

### 同输入跨后端一致性

运行 `node scripts/g59-survival-trace.mjs 36000`，会重建一份固定输入序列并保留其摘要，以手动推进时钟逐批在普通播放器两个后端上回放。实际取证比较了 6,001 个带 Tick 的输入、121 个检查点；CocosAirJS、Three.js 和 Node 的状态 Hash、分数、机体值及终局事件一致。[回执](../project/evidence/g59-survival-fixed-trace.json)。此项不计实际运行时长，也不是不同输入设备的一致性验收。


### 浏览器后退与恢复

普通播放器和完整静态导出在 `pagehide.persisted` 时保留当前对局和画布，停用原输入采样并暂停正在玩的轮次。返回后必须先点击「继续」，再按住操作键；手柄等连续采样需重新启用。主动销毁、嵌入页宿主关闭和非缓存离开仍走清理路径。真正刷新是新页面和新一局；同源同版本的个人纪录不变。

复验：先构建并准备锁定 SDK，再使用本地原生 WPE MiniBrowser 运行 `A2GAME_WPE_NATIVE_EXECUTABLE=/absolute/path/to/MiniBrowser node scripts/g59-history-browser.mjs`。用真实同源跳转和浏览历史验证 `persisted`，不以人工派发事件充数；两种模式各用实际 CocosAirJS 和 Three.js，对照真实 GL 提交、输入清空、同一画布、刷新后的记录和关闭清理。凭据、真机、部署和独立包长时运行均不在本回执的证明范围。
