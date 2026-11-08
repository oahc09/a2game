# 当前宿主新组合实跑：星港牌令（2026-11-08）

用户选择继续原创下一款。本轮当前宿主模型使用《光弧巡游》反馈后的Skill，设计“原生抽/出牌＋资源账本＋热量风险＋双订单”单人牌序解谜；没有额外Provider、生成fixture或其他模型调用。没有修改Runtime/Adapter/协议。方向选择前核对了本会话自己的射击游戏交付；未读取参考卡牌游戏或解法。为核实ABI/事件读取了公开规范、Manifest与对应cards实现。共享工作区不是强隔离，不计正式G3/G2/verified或真机。

## 机制和真实语义

[GamePlan](../output/host-native-starport-deck-20261108/design-plan.md)、[最终GameSpec](../output/host-native-starport-deck-20261108/attempt-3/game.json)、[8场景Conformance](../output/host-native-starport-deck-20261108/attempt-3/conformance.json)、[作者自解](../output/host-native-starport-deck-20261108/attempt-3/solution.json)。

固定10张牌，最多3手牌。D或点右上牌库抽一张；1/2/3或点手牌打出当前位置，后牌左移。牌面1充能、2采矿、3装配、4冷却，图例给出成本/效果；9次出牌内造2件模块，电/矿为负、热≥4或出牌>9都先判败。没有墙钟压力，抽牌不计出牌回合。

- `turnbased.cards`实际维护deck/hand/discard，满手/空库与空位置不产生成功事件。原生score是弃牌数字总和，不是本作电力/订单；本作不依赖模块的goalScore。
- 原生模块先消费有效位置牌，规则再按牌值结算。资源不足时仍消费并立即破产，是明确的风险规则，不是“无代价拒绝”。
- 资源效果为T8常量add与冷却clamp，按输入事件顺序提交，T9检查净额；同Tick充能＋采矿可结算为电1/矿2，不借用上一款T4建设命令的时序结论。
- 主解实际7次出牌完成：电0、矿0、热3、订单2；牌库2＋手牌1＋弃牌7=10。Native cards.score=16、cards.won=false而Runtime flow=won，证明自定义资源/目标与原生记分分开。
- 十次出牌的对照实际达到订单2、电1/矿2/热2，仍因出牌10/9失败；明确验证目标达标不能覆盖预算败局。

## 验证范围

| 内容 | 实际结果 |
|---|---|
| CLI | 3稿均完整准入/test通过，无故意制造内容失败；最终8场景覆盖7牌通关、满手/空位、透支、过热、冷却最低0/闲置、同Tick账本、10牌达标仍败、Pointer命中/留白/空位 |
| 守恒/联动 | Native牌数总和始终10，显示计数与真实数组一致，实际位置牌被移除且左移，score等于弃牌数值和；资源/风险/订单随成功played事件变化 |
| 双SDK | 最终Air/Three各完成1100×900真实键盘＋手动Tick、390×844正常时钟真实画布鼠标点选，共4条流程；没有用DOM按钮代替画布命中 |
| 场景/生命周期 | 实际点牌库/点牌、满手无损、7牌获胜、透支/过热/超回合败局、暂停/恢复、重开、SDK ownedNodes/ownedMeshes与资源作用域释放、监听关闭、浏览器/URL关闭通过 |
| Hash | 最终两端各70个同序采样匹配，在Node各两个独立Session重放，共280次匹配。正常时钟输入时刻不同，不比任意Tick Hash |
| 画面 | 30张最终截图，已查看手牌、成功、透支和“订单达标但10次出牌失败”。窄屏名义最小字Air约16.91、Three约16.88 CSS px；牌和牌库命中区大于44px，按钮高44px，固定图例和牌面数字不只靠颜色识别 |

原始Sprite/文字均为已支持几何原语，无外部素材。固定牌序、不做随机卡组/多人隐藏信息保证；鼠标Pointer命中不是物理Touch证明。质量是作者Agent实际试玩和审图，不是独立评委或偏好研究。

## 修订、来源漂移与保留记录

1. 初稿逻辑通过，实际画面中的“牌面类型”小字约15.66 CSS px；第二稿提高到.54逻辑单位，并新增已注册touch.select的牌库/三手牌命中。键盘与Pointer采用simultaneous策略，牌库/规则/解法保留。图例与“位置号≠牌面类型”明确显示。
2. 补验发现第一批没有覆盖“第10次才达标”的组合边界，新增该场景及Pointer/留白/空位场景。没有为了模拟失败删改有效预期。
3. 第二稿审图时，订单2/2仍显绿色、次数10/9没有警示，说明也漏掉超次数败局。第三稿只改meta/presentation/revision：补全三条败局和优先级，负资源、热4、出牌10及超预算订单用红色。规则、输入、牌库、测试、解法不变，见revision3-invariant.json。
4. 第一批取证期间并发修改了Player/服务/集合相关文件，广义指纹false保留在final-source-after.json，不当作最终当前源码回执。该批原始浏览器结果和图片都保留，重新基于当前文件验证最终稿。
5. 最后一批逐文件清单显示，425个实现/合同文件中只有未使用的`integrations/mcp/resources.mjs`发生变化（并发新增creation-library URI），SDK无变化；CLI/Runtime/Player/Schema/Manifest文件不变。此链路没有调用MCP资源；按这个**执行链工程范围**报告通过，但保留广义聚合SOURCE_DRIFT，不宣称全仓冻结、不升级要求全指纹一致的正式Gate。证据为final-v2-source-before/after/check.json和final-source-scope.json，没有重签旧结果。

全部候选、原字节SHA、命令/退出码/stdout/stderr、图片与源变化清单保留。CLI没有格式或玩法拒绝；真实问题是字号、交互/警示完整度和取证来源漂移，不人为制造一个FAIL来充数。

## Skill反馈与交付

反馈到四份Skill引用：cards具体初态与成功事件、位置/类型和score/资源区别、消费后失败政策、T8账本与S_sim边界、目标达标仍败的交叉约束、contain-space真画布命中与风险提示。五处已有副本同步后另打新包；生成时Skill与反馈包SHA分别记录，新包尚未用于下一款创作。

[最终内容包](../output/host-native-starport-deck-20261108/starport-deck-r3.package.json)、[启动/导入说明](../output/host-native-starport-deck-20261108/README.md)、[运行回执](../output/host-native-starport-deck-20261108/receipt.json)。旧第二稿包保留但不作为当前交付。内容包需要兼容受信宿主/SDK，不内置Runtime。额外Provider调用0，宿主会话Token/费用未独立导出；没有运行全量verify/远端CI或真机。本轮未提交或推送，保留其他会话的提交与未提交改动。
