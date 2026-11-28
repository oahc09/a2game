# 三款游戏业务验收证据台账

截至 2026-11-27，逐条对照[业务验收方案](history/A2Game-Three-Complete-Games-Acceptance-Plan-2026-11-22.md)和[设计用例目录](history/A2Game-Three-Game-Business-Test-Catalog-2026-11-22.json)。每条结论须覆盖原用例的全部条件，当前关联仅供复核。

逐条复核结果为 **12 条通过、48 条部分取证、14 条待真机**。74 条均已关联可查证资料。部分真机项已有桌面证据。

变体生成请求与原稿均核对 SHA-256。四次调用各捕获 11 份公开源码，其中 10 份与本次工作区一致，`realtime.ts` 已有后续代码变化。请求未保存完整的 Runtime 与 Adapter 源码快照，历史冻结结论维持待验。[历史指纹核查](../output/business-case-boundaries-1795788196979/variant-source-fingerprints.json)

## COM-11 参考版本与规则对照

| 交付作品与参考时期 | 官方可确认 | 本次设计和实际取证 | 原版待核对 |
|---|---|---|---|
| 云线巡航 · 2013 年微信 5.0 的飞机大战 | 腾讯记录了纵版射击与分数排行。[腾讯 2013/14 报告，第 19 页](https://www.tencent.net.cn/wp-content/uploads/2022/12/2014-CSR-Report_compressed-1-min.pdf#page=21) | 第八版采用相对拖动、自动开火、三类敌机与三段难度、补给、死亡结算及本地最高分。[交付定义](../games/business-complete/skyline-patrol/muzzle.game.json) · [双引擎长局](../output/skyline-patrol-revision8-endurance-retry-1795852297288/summary.json) | 航迹与拖动手感，血量、射速、判伤、补给的数值，以及同期可操作版本。 |
| 纹港叠牌 · 早期微信经典消除闯关 | 简游官方页可确认开发者与消除闯关定位。[简游官方页](https://easygame2021.com/index.php?a=index&c=Lists&m=home&tid=4) | 自研教学关与六层主挑战采用遮挡、受限槽位、三张消除及每局道具额度，局中恢复与回退已取证。[关卡目录](../games/business-complete/pattern-harbor/collection.json) · [双引擎交付](../output/puzzle-static-update-1795851826430/receipt.json) | 早期版本的关卡编排、道具额度及操作手感，现有官方产品页仅作为产品识别依据。 |
| 潮纹消消 · 经典交换三消核心 | 乐元素确认滑动成横竖三连并达成关卡目标。2022 年公告确认与魔力鸟交换会产生消除。[开发者商店说明](https://apps.apple.com/cn/app/id791532221) · [乐元素官方公告](https://www.taptap.cn/moment/317353022915086154) | 自研 12 关采用步数目标、障碍、特殊块组合、星级和续关，规则与数值按当前定义及见证锁定。[关卡目录](../games/business-complete/tideglass-match/collection.json) · [关卡星级见证](../games/business-complete/tideglass-match/star-witnesses.json) | 历史版本的特殊组合优先级、星级阈值、表现时序和手感。活动积分规则仅对应公告所述活动。 |

当前没有完成对锁定原版构建或同期可复核录像的逐项实测，`referenceFidelity` 保留 `PENDING`。以上自研回执用于签收各自的业务条件。

| 编号 | 用例 | 签收状态 | 已关联证据 | 复核结论及缺口 |
|---|---|---|---|---|
| SHT-01 | 从入口开始一局并重开 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 真机起局和重开 · 真机待验 |
| SHT-02 | 拖动、屏幕映射和取消输入 | BLOCKED_DEVICE | [拖动和最高分](../output/skyline-patrol-relative-browser-1795392995253/receipt.json) | 不同窗口比例与取消 · 真机待验 |
| SHT-03 | 自动开火与时间语义 | PASS | [第八版双端帧率与枪口坐标](../output/skyline-patrol-fire-cadence-1795831779257/receipt.json) | 弹丸从机身前缘出生，朝上以 96 单位每 Tick 飞行。两端约 60 Hz 和 30 Hz 均每 6 Tick 发射，暂停冻结且恢复不补发。 |
| SHT-04 | 循环生成与难度变化 | PASS | [同种子生成序列](../output/skyline-patrol-revision6-boundaries-1795790059660/sht-04-wave-replay.json)、[第七版三阶段双端](../output/skyline-patrol-offscreen-1795828459899/receipt.json) | 两端的 214 架敌机生成序列、分段首波模板与速度一致，旧敌机跨段时保持速度。终局均为 5,300 分。 |
| SHT-05 | 屏幕外出生、离屏回收和玩家边界 | PASS | [第五版失败](../output/business-case-boundaries-1795788196979/shooter-boundary.json)、[第六版双引擎](../output/skyline-patrol-offscreen-1795788794048/receipt.json)、[三段难度路线](../output/skyline-patrol-offscreen-1795788979756/receipt.json) | 敌机屏外出生后自然入场，目标与弹丸在屏外回收且无额外计分，玩家保持在画面内。三个运行端的 11 个边界观测 Hash 一致。 |
| SHT-06 | 不同敌机的伤害和击毁得分 | PASS | [正式模板 Headless](../output/skyline-patrol-revision6-boundaries-1795790059660/headless.log)、[双端 1/3/5 血夹具与画面](../output/skyline-patrol-damage-1795831909587/receipt.json) | 双端逐次扣血、击毁与唯一计分符合预期，额外弹丸无法再命中已死亡对象，实际受击与爆炸画面已取证。 |
| SHT-07 | 碰撞层与非阻挡接触 | BLOCKED_DEVICE | [第八版双引擎碰撞夹具](../output/skyline-patrol-graze-1795854932830/receipt.json) | 双引擎与 Headless 状态和 Hash 一致。两敌机交叠无推挤，友方弹穿过玩家后命中敌机。夹具单独加宽机翼投影，画面相交但判定框仅接边时玩家无伤，判定框重叠后判负。真机待验。 |
| SHT-08 | 独立子弹去重与同Tick多命中 | PASS | [定向回归](../output/business-case-boundaries-1795788196979/headless-node.log) | 同主人独立命中、唯一死亡和唯一计分通过。 |
| SHT-09 | 同Tick击毁与接触的结算顺序 | PASS | [第六版反例](../output/skyline-patrol-revision6-boundaries-1795790059660/sht-09-revision6.json)、[第七版双端](../output/skyline-patrol-contact-order-1795791385548/receipt.json) | 两种 ID／数组排序均先完成本 Tick 弹丸命中。致命命中时玩家生还、得分一次；非致命对照正常死亡，结算面板与权威分数一致。 |
| SHT-10 | 无尽得分局的正常结束语义 | PASS | [第八版计分与终局](../output/skyline-patrol-terminal-1795831964083/receipt.json)、[三阶段路线](../output/skyline-patrol-offscreen-1795831837933/receipt.json) | 超过旧分数和时间上限仍可操作，跨三段难度持续刷敌。真实死亡后结算分数与权威状态一致，射击、生成和输入停止。 |
| SHT-11 | 死亡、重复输入与重开隔离 | PASS | [Headless](../output/skyline-patrol-revision6-boundaries-1795790059660/headless.log)、[第七版双端终局](../output/skyline-patrol-terminal-1795828504581/receipt.json) | 终局单次显示、死亡反馈无重复，实际终局键鼠输入未改变状态；重开一次回到 Tick 0，Hash、输入队列与演出均恢复初态。 |
| SHT-12 | 最高分持久记录 | PASS | [真实计分路线](../output/skyline-patrol-high-score-fixture-1795832114173/routes.json)、[双端持久化](../output/skyline-patrol-high-score-fixture-1795832114173/browser-1795832835670.json) | 两端三局实得 100、80、120 分，关闭再开后最高分依次为 100、100、120，仅两次写入。版本隔离通过，写入被拒时仅显示本页最高分，重新打开没有该记录。 |
| SHT-13 | 暂停、隐藏与恢复 | BLOCKED_DEVICE | [双发](../output/skyline-patrol-live-supply-1795398109938/receipt.json) | 后台隐藏和回到前台 · 真机待验 |
| SHT-14 | 双发强化与范围炸弹的完整状态 | BLOCKED_DEVICE | [双发](../output/skyline-patrol-live-supply-1795398109938/receipt.json)、[炸弹](../output/skyline-patrol-supplies-browser-1795392781795/receipt.json) | 完整道具事务 · 真机待验 |
| SHT-15 | 完整资源、动画与正式交付一致 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 素材和画面复核 · 真机待验 |
| SHT-16 | 持续游玩、压力与释放 | BLOCKED_DEVICE | [第八版正常时钟长局](../output/skyline-patrol-revision8-endurance-retry-1795852297288/summary.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 桌面 30/10 分钟时长、帧时间、对象和资源释放通过。设备压力与输入反馈待真机。 |
| SHT-17 | 同一JSON的双后端业务一致 | BLOCKED_DEVICE | [第八版双引擎长局审计](../output/skyline-patrol-revision8-endurance-retry-1795852297288/summary.json) | 12 个共有终局一致，真机待验。 |
| SHT-18 | JSON创作与规则变体验收 | PARTIAL | [AI-01](../output/business-ai01-rounds-1795650574037/summary.json)、[AI-04](../output/business-ai02-06-run-1795700751295/AI-04/attempt-1/browser.json) | 完整业务和交付映射 |
| SHEEP-01 | 新玩家教学到主挑战完整流程 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 实际设备从教学到主挑战 · 真机待验 |
| SHEEP-02 | 遮挡拓扑决定可选牌且拒绝循环图 | PARTIAL | [主挑战](../output/pattern-harbor-challenge-1795393777570/receipt.json)、[双遮挡与循环图 Headless](../test/puzzle-library.test.mjs) | 两个遮挡都移除后才能取牌。循环报错已给出牌索引和闭环路径，覆盖多牌循环及自循环。待补双端同夹具。 |
| SHEEP-03 | 槽内同类归组及三张消除守恒 | PARTIAL | [主挑战](../output/pattern-harbor-challenge-1795393777570/receipt.json) | 逐次归组与守恒 |
| SHEEP-04 | 第七张形成三消时先消除再判失败 | PASS | [Headless](../output/business-case-boundaries-1795788196979/headless-node.log)、[双端实际点击](../output/business-case-boundaries-1795788196979/sheep-04-click-browser.json) | 第七张先消除，槽剩四张，重复点击被拒，终局面板未出现。 |
| SHEEP-05 | 第七张未形成三消时准确失败并可重试 | PASS | [正式挑战 Headless](../test/puzzle-library.test.mjs)、[同定义离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 七张不匹配只触发一次失败，终局拒绝输入。重试恢复同一初态 Hash、种子与三种道具额度，离线双端验证失败重试和解锁进度保留。 |
| SHEEP-06 | 移出道具把三张牌保留而非删除 | PARTIAL | [叠牌道具](../output/pattern-harbor-tools-1795394022206/receipt.json) | 零库存及失败原子性 |
| SHEEP-07 | 撤回恢复完整选择事务且不返还工具额度 | PARTIAL | [叠牌道具](../output/pattern-harbor-tools-1795394022206/receipt.json) | 额度及 RNG 恢复映射 |
| SHEEP-08 | 洗牌保持规则并验证可达后继 | PARTIAL | [洗牌](../output/pattern-harbor-shuffle-1795394223015/receipt.json) | 非法洗牌不写状态 |
| SHEEP-09 | 不能仅凭牌数整除判定可解 | PASS | [正式路线和反例](../output/business-case-boundaries-1795788196979/sheep-09-receipt.json)、[Headless](../output/business-case-boundaries-1795788196979/headless-node.log) | 两份正式布局从初态通关。21 张强制遮挡反例满槽；单独登记预算耗尽。 |
| SHEEP-10 | 正式挑战不泄露答案且确有选择压力 | PARTIAL | [主挑战](../output/pattern-harbor-challenge-1795393777570/receipt.json) | 答案露出与选择压力 |
| SHEEP-11 | 清空判定包括保留区和槽 | PARTIAL | [叠牌道具](../output/pattern-harbor-tools-1795394022206/receipt.json) | 保留区非空阻止胜利 |
| SHEEP-12 | 动画期间连续点击不重复选牌或穿透层 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 连点与动画穿透 · 真机待验 |
| SHEEP-13 | 退出和恢复保留牌局与工具状态 | PARTIAL | [存档恢复](../output/pattern-harbor-resume-1795394472821/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 主挑战最坏操作量及恢复映射 |
| SHEEP-14 | 双后端相同内容及输入产生相同逻辑结果 | PARTIAL | [主挑战](../output/pattern-harbor-challenge-1795393777570/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 同输入关键状态逐项核对 |
| SHEEP-15 | 替换关卡与主题无需修改播放器代码 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json)、[AI-05](../output/business-ai05-06-run-1795702836880/AI-05/attempt-1/browser-main-witness.json) | 播放器源码指纹 |
| SHEEP-16 | 完整画面可用且表现随包交付 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 实际视听复核 · 真机待验 |
| SHEEP-17 | 多局资源和时间表现稳定 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 多局资源趋势 · 真机待验 |
| SHEEP-18 | Agent从公开能力和内容要求生成完整作品变体 | PARTIAL | [AI-02](../output/business-ai02-06-run-1795700751295/AI-02/attempt-1/browser-main-witness.json)、[AI-05](../output/business-ai05-06-run-1795702836880/AI-05/attempt-1/browser-main-witness.json) | Agent 独立包 |
| M3-01 | 首次进入、教学和完整胜利流程 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 教学逐项断言 |
| M3-02 | 无效交换完整回退 | PARTIAL | [开篇两关](../output/tideglass-m01-m02-1795394707306/receipt.json) | 无效交换的 RNG 和初态对照 |
| M3-03 | 横竖三消与交叉匹配去重 | PARTIAL | [重叠命中去重回归](../test/puzzle-library.test.mjs) | 补单横、单竖及交叉交换的完整步数、唯一棋子 ID、计分和 RNG 回执 |
| M3-04 | 四连、T/L、五连与特殊块生成优先级 | PARTIAL | [特殊块](../output/tideglass-specials-1795395302379/receipt.json) | 冲突时的生成优先级 |
| M3-05 | 普通匹配与特效命中的链式激活、消费和去重 | PARTIAL | [六类组合](../output/tideglass-combos-1795395527341/receipt.json) | 普通匹配激活及消费去重 |
| M3-06 | 六类特殊组合完整语义 | PARTIAL | [六类组合](../output/tideglass-combos-1795395527341/receipt.json) | 六类组合逐项范围核对 |
| M3-07 | 多轮连锁、可观察阶段与原子结果 | PARTIAL | [连锁锁定](../output/tideglass-settlement-static-1795397434737/receipt.json) | 阶段事件原子观测 |
| M3-08 | 两类障碍扣层、占格与去重 | PARTIAL | [冰层和箱体](../output/tideglass-obstacles-1795395762947/receipt.json) | 扣层、占格和去重映射 |
| M3-09 | 非矩形棋盘、下落补充和出口收集 | PARTIAL | [三消主线](../output/tideglass-main-1795396286215/receipt.json) | 孔洞填充与出口唯一入账 |
| M3-10 | 最后一步经连锁达成全部目标优先胜利 | PARTIAL | [三消主线](../output/tideglass-main-1795396286215/receipt.json)、[AI-06](../output/business-ai05-06-run-1795702836880/AI-06/attempt-2/browser-representative.json) | 正式关最后一步的全部目标 |
| M3-11 | 步数耗尽但目标未完正确失败和重试 | PARTIAL | [三消主线](../output/tideglass-main-1795396286215/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 重试状态重置 |
| M3-12 | 关卡启动稳定且初始可操作 | PARTIAL | [包内 Headless](../output/three-games-packaged-headless-1795401783242/receipt.json) | 每关初态无预消且存在合法动作 |
| M3-13 | 死盘确定性洗牌、预算与无法恢复 | PARTIAL | [死盘](../output/tideglass-deadboard-1795396727308/receipt.json) | 重排预算和固定种子摘要 |
| M3-14 | 12主关与3变体真实可达通关 | PARTIAL | [星级](../output/tideglass-ranked-static-1795396677199/receipt.json)、[包内 Headless](../output/three-games-packaged-headless-1795401783242/receipt.json) | 15 关目标、步数和双端见证索引 |
| M3-15 | 锤子、强制交换、洗牌道具与扣费事务 | PARTIAL | [三消道具](../output/tideglass-tools-static-1795396975407/receipt.json) | 道具扣费逐项映射 |
| M3-16 | 结算时输入屏障、暂停与恢复 | PARTIAL | [连锁锁定](../output/tideglass-settlement-static-1795397434737/receipt.json) | 不同动效设置结果索引 |
| M3-17 | 保存恢复与恰好一次结算 | PARTIAL | [连锁锁定](../output/tideglass-settlement-static-1795397434737/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json)、[升级与回退双端](../output/puzzle-version-update-1795840051717/receipt.json) | 已验证不兼容提示和保留旧存档。重复提交仍待签收。 |
| M3-18 | 计分公式、星级边界、关卡进度与最好成绩 | PARTIAL | [星级](../output/tideglass-ranked-static-1795396677199/receipt.json) | 星级边界与解锁 |
| M3-19 | 真实画面、触控和反馈随SDK交付 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 画面及反馈人工复核 |
| M3-20 | Agent独立生成关卡变体与跨后端重放 | PARTIAL | [AI-03](../output/business-ai02-06-run-1795700751295/AI-03/attempt-2/browser-representative.json)、[AI-06](../output/business-ai05-06-run-1795702836880/AI-06/attempt-2/browser-representative.json) | 独立包及业务签收 |
| COM-01 | 从交付入口独立启动完整游戏 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 正式包视觉复核 |
| COM-02 | 暂停、失焦与恢复不产生幽灵输入 | BLOCKED_DEVICE | [双发](../output/skyline-patrol-live-supply-1795398109938/receipt.json)、[连锁锁定](../output/tideglass-settlement-static-1795397434737/receipt.json) | 失焦与恢复组合 · 真机待验 |
| COM-03 | 跨重开与跨启动的持久进度正确 | PARTIAL | [拖动和最高分](../output/skyline-patrol-relative-browser-1795392995253/receipt.json)、[存档恢复](../output/pattern-harbor-resume-1795394472821/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 三作跨启动与包内证据核对 |
| COM-04 | 同一内容在两个真实后端运行 | PARTIAL | [CocosAirJS 长局](../output/skyline-patrol-endurance-air-1795398461194/receipt.json)、[Three.js 长局](../output/skyline-patrol-endurance-three-1795400822853/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 双端视觉复核 |
| COM-05 | 窄屏、DPR和实际触控命中一致 | BLOCKED_DEVICE | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 设备实际命中 · 真机待验 |
| COM-06 | 正式交付包带齐画面和声音 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 逐作品视听复核 |
| COM-07 | 内容更新和不兼容存档有明确结果 | PARTIAL | [存档恢复](../output/pattern-harbor-resume-1795394472821/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json)、[新版独立包升级与回退](../output/puzzle-static-update-1795851826430/receipt.json) | 两款益智游戏的新版独立包已在双引擎正常时钟下通过同版恢复、更新提示、确认重开、新版保存和旧版恢复。仍需按三款游戏范围签收全部条件。 |
| COM-08 | 重复结算与连续重开不重复奖励或泄漏对象 | PARTIAL | [CocosAirJS 长局](../output/skyline-patrol-endurance-air-1795398461194/receipt.json)、[Three.js 长局](../output/skyline-patrol-endurance-three-1795400822853/receipt.json)、[离线双端](../output/three-games-delivery-1795401762291/receipt.json) | 重复奖励幂等 |
| COM-09 | 玩法完全由共享能力和JSON决定 | PARTIAL | [AI-04](../output/business-ai02-06-run-1795700751295/AI-04/attempt-1/browser.json)、[AI-05](../output/business-ai05-06-run-1795702836880/AI-05/attempt-1/browser-main-witness.json)、[AI-06](../output/business-ai05-06-run-1795702836880/AI-06/attempt-2/browser-representative.json) | 源码指纹及宿主职责 |
| COM-10 | 结算过程与输入屏障可重放 | PARTIAL | [连锁锁定](../output/tideglass-settlement-static-1795397434737/receipt.json) | 输入和阶段绑定 |
| COM-11 | 参考版本与本次设计规则可以逐项追溯 | PARTIAL | [官方资料与规则对照](#com-11-参考版本与规则对照) | 已关联三款的官方依据与自研交付证据，原版实测和表现对照待完成。 |
| COM-12 | 当前证据绑定实际交付版本且不改变旧覆盖口径 | PARTIAL | [离线双端](../output/three-games-delivery-1795401762291/receipt.json)、[CocosAirJS 长局](../output/skyline-patrol-endurance-air-1795398461194/receipt.json)、[Three.js 长局](../output/skyline-patrol-endurance-three-1795400822853/receipt.json) | 逐条交付指纹与历史证据门禁 |
| AI-01 | 公开能力生成完整飞机作品 | PARTIAL | [生成与复验](../output/business-ai01-rounds-1795650574037/summary.json)、[独立包双端](../output/business-ai01-rounds-1795650574037/attempt-3/standalone-browser.json) | 独立包已验开局、拖动、结算、重开、刷新后最高分与释放；补齐其余必需业务流程映射 |
| AI-02 | 公开能力生成完整叠牌作品 | PARTIAL | [原稿通关](../output/business-ai02-06-run-1795700751295/AI-02/attempt-1/browser-main-witness.json)、[独立包双端](../output/business-agent-collections-1795786842367/browser-1795786960238.json) | 两端已验续关、失败重试和主挑战局中恢复，待完整业务签收 |
| AI-03 | 公开能力生成完整交换消除作品 | PARTIAL | [原稿代表流程](../output/business-ai02-06-run-1795700751295/AI-03/attempt-2/browser-representative.json)、[星级对齐后的独立包双端](../output/business-ai03-stars-1795787069943/browser-1795787122051.json) | 两端已验 15 关连续三星、失败重试和刷新进度，待完整业务签收 |
| AI-04 | 飞机规则变体只改内容 | PARTIAL | [原稿计分](../output/business-ai02-06-run-1795700751295/AI-04/attempt-1/browser.json)、[独立包双端](../output/business-agent-variants-1795787999603/browser-1795788075358.json)、[历史公开源码指纹](../output/business-case-boundaries-1795788196979/variant-source-fingerprints.json) | 已核对生成时捕获的 11 份公开源码。完整 Runtime 与 Adapter 的同期冻结指纹缺失，正式签收待补。 |
| AI-05 | 叠牌拓扑变体只改内容 | PARTIAL | [原稿通关](../output/business-ai05-06-run-1795702836880/AI-05/attempt-1/browser-main-witness.json)、[独立包双端](../output/business-agent-variants-1795787999603/browser-1795788075358.json)、[历史公开源码指纹](../output/business-case-boundaries-1795788196979/variant-source-fingerprints.json) | 已核对生成时捕获的 11 份公开源码。完整 Runtime 与 Adapter 的同期冻结指纹缺失，正式签收待补。 |
| AI-06 | 三消目标变体只改内容 | PARTIAL | [原稿代表流程](../output/business-ai05-06-run-1795702836880/AI-06/attempt-2/browser-representative.json)、[独立包双端](../output/business-agent-variants-1795787999603/browser-1795788075358.json)、[历史公开源码指纹](../output/business-case-boundaries-1795788196979/variant-source-fingerprints.json) | 已核对生成时捕获的 11 份公开源码。完整 Runtime 与 Adapter 的同期冻结指纹缺失，正式签收待补。 |
