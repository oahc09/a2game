# 当前宿主实时射击成长实跑：光弧巡游（2026-11-08）

当前宿主模型使用《潮汐铸防》反馈后的Skill，原创WASD移动＋Space持续射击/自动瞄准＋击杀能量成长游戏。完成GamePlan→三件套→CLI完整准入/失败修复→双SDK实际输入/审图→Node回放→内容导出→Skill反馈。额外Provider调用0；没有调用生成fixture、其他模型或生图/音频服务，没有修改Runtime/Adapter/协议。共享工作区不是强隔离来源，不计正式G3/G2/verified或真机Gate。

## 作品与机制

[GamePlan](../output/host-native-arc-drifter-20261108/design-plan.md)、[最终GameSpec](../output/host-native-arc-drifter-20261108/attempt-3/game.json)、[测试](../output/host-native-arc-drifter-20261108/attempt-3/conformance.json)、[作者自解](../output/host-native-arc-drifter-20261108/attempt-3/solution.json)、[Generator内容包](../output/host-native-arc-drifter-20261108/arc-drifter.package.json)。输入、规则、界限和伤害全部由共享Runtime消费JSON；Host只处理输入/表现。

- 前5秒可读屏/测试，4架敌机按时到达，20秒内全部击退获胜；生命耗尽或超时失败。
- WASD按住连续移动，松开后停止；Space按住连射，自动瞄准最近敌机。这里不是鼠标手动瞄准或像素盲玩。每次击杀+5能量，E花5升级，伤害1→2→3，最多两次。
- `heldMovement`与`hold:true`供应连续移动。当前原生fire直接消费press，声明式持有规则通过独立`fireRequestPath`维持射击，原生模块按18Tick冷却发射；没有用永远autoFire替代停止要求。
- 成长在T8提交；同Tick先前已生成的弹丸保留旧damage，之后的新弹丸才用新bonus。`causal-audit.json`实测新旧弹值并存、击杀奖励实际支付、真实命中amount=1/2/3，而非只检查HUD等级。
- 同一未成长输入路线最终3击退、生命0而失败；这是该路线的对照，不推断所有未成长玩法全局无解。

没有读取参考游戏JSON/解法；为核实press/hold消费与弹丸快照时序，读取了公开Manifest/规范及对应realtime拥有者实现。作者自行给出解法，不用搜索器补解。自动化正常时钟控制按可观察能量状态决定E时机，属于有状态辅助的脚本Agent试玩，不是独立评委或纯像素自由试玩。

## 实测结果

| 范围 | 结果 |
|---|---|
| 内容准入/逻辑 | 三个内容候选（两版GameSpec）；GameSpec均完整准入通过，首稿测试因输入封装Schema失败，修复后六场景全部通过 |
| 六场景 | 成长完整获胜；连续移动/松开/暂停清理；连射/停止；需赚取能量且不能重复透支；同路线不成长失败；不射击接触/超时失败 |
| 双SDK输入 | Air/Three各跑手动Tick真实键盘、正常时钟真实键盘整局、390px正常时钟CDP多指整局，共6条最终流程 |
| 手感 | 空场按住6Tick移动240单位；移动释放后位移0；55Tick连续射击4发，选定释放点后60Tick不再发射；正常键盘释放漂移0，虚拟触控单指及部分指释放后漂移均0 |
| 排队边界 | 恰在冷却到期Tick释放或暂停/恢复，可能完成1发已排队射击，之后60Tick无继续射击。报告不将其说成所有边界都零延迟 |
| 成长上限 | 已满两次且持有至少5能量时再次E，不扣钱、不再提高伤害，单独边界记录保留 |
| 正常时钟完整度 | 两端键盘与修正后的触控路线均约17.0–17.2秒满生命击退四机；实际移动/移射/两次成长，无API快进 |
| Hash | 两端各29个实际输入采样跨SDK29/29一致；各在Node两个独立Session回放，共116次匹配。补拍58采样再与原记录逐项匹配，不重复计作新的Node覆盖 |
| 视觉 | 保留40张最终有效截图及旧稿/失败图。主战场投影线性尺寸较旧布局约增35%，倒计时与阶段分离，保留四项战斗数据；黄色/青色/紫色真实弹丸和命中/受伤边框已审图 |
| 窄屏 | 390×844，名义最小字号约17.65 CSS px，6个按钮高44px，无水平内容溢出。名义字号不是实际字形测量或自动美观分数 |
| 生命周期 | 暂停/恢复、重开清空成长/输入，最终SDK ownedNodes/ownedMeshes与资源作用域归零、监听关闭、浏览器和所有预览URL关闭；不宣称整个引擎/GPU零泄漏 |

正常时钟控制使用WASD或可见按钮实际持有，未改变游戏时钟。移动按轴叠加，斜向未归一化；本次没有测端到端输入延迟、操作偏好、真实手机/真实OS失焦或长期平衡。虚拟触点的isTrusted只证明浏览器事件送达，不是物理手指来源。

## 失败、误判与修复

1. 首稿`injectRaw`把source/kind/payload摊在Conformance step上，`A2G_E_AGENT_CONFORMANCE_SCHEMA`拒绝；原始响应、原字节与SHA均保留。第二候选改成`{op:"injectRaw",raw:{...}}`，GameSpec/solution字节和全部断言不变，六场景通过。
2. 首次Air画面审查发现战场偏小、重复说明拥挤、倒计时靠近阶段文字。第三候选只改presentation和revision：场景高13.8→10.2，场景原点/边框一起调整，精简重复说明与统计；玩法/输入/状态/规则/测试/解法不变，经审计确认。
3. 第一版虚拟触控驱动错误释放了另一触点，导致射击停而移动残留，原始超时失败保留。第二版虽通关，位移复核仍发现角色一路滑到边界，故其PASS不计最终触控通过。
4. 小型输入探针记录实际pointerup/lostpointercapture。在线[CDP tip-of-tree说明](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl)要求touchEnd/cancel无触点；但当前UA报告Chrome156的实测中，部分释放需提交结束点，而touchMove只给剩余点没有发出对应pointerup。第三版驱动只按本机实测处理，并增加后续位移断言；两端最终单指/部分指释放均为0，另一指持续射击。此为当前版本的驱动验证，**不是跨浏览器/跨版本CDP兼容保证**，没有修改游戏来迁就错误输入。
5. 初次探针已结束全部触点后再次cancel，被浏览器拒绝，结果后处理器因没有Result而抛TypeError。原浏览器错误文本保留，后续探针将该清理错误记入结果。它是控制端诊断失败，不是游戏候选失败；后处理TypeError原始输出位于聊天工具记录，未伪造磁盘原始stderr。
6. 审图发现原`final-air-manual-growth2-bullets.png`黑画布，不能因逻辑PASS就算视觉通过。保留原图，补拍时等待3个原生RAF与100ms并改为固定视口，Air与Three的新旧弹色画面恢复，58逻辑采样与原记录相同。两个捕获条件一起变动，没有单独归因某个因素，也未认定或修补引擎故障。

核心证据在`test-1.stdout.json`、`repair-conformance.json`、`repair-visual.json`、`final-air-touch.json`、`air-touch-release-check.json`、`touch-probe-v2.json`、`repair-touch-driver-v3.json`、`capture-issue.json`与`recapture-check.json`。游戏原稿、驱动原稿、初步误判、黑图与成功补验都保留，不覆写历史结果。

## Skill反馈与交付

实测后更新四份Skill引用：Conformance/solution原始输入外层区别、持续射击与排队边界、成长弹丸快照、实质释放位移检查、输入驱动版本/事件证据、有效战场占比和原生绘制后截图。同步五处已有副本、重新打包；创作时使用的Skill SHA与反馈后的新包分开记录，未声称新包已生成另一款游戏。

启动/导入见[交付说明](../output/host-native-arc-drifter-20261108/README.md)，全部索引见[运行回执](../output/host-native-arc-drifter-20261108/receipt.json)。实现/协议/生成时Skill在最终浏览器、Node与补拍阶段的聚合指纹一致；反馈后的新Skill另记SHA。额外Provider调用0，宿主会话本身使用模型，Token/费用未独立导出。没有运行整仓全量verify或远端CI；未提交或推送。
