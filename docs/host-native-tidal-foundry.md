# 当前宿主复合玩法实跑：潮汐铸防（2026-11-07）

当前宿主模型使用《星隙快递》实测反馈后的Skill，原创“生产经营＋塔防建设/合成＋击杀奖励回投升级”游戏，完整走完GamePlan→三件套→CLI完整准入/测试→实际试玩修复→双SDK→Node回放→导出→Skill反馈。没有调用额外Provider、fixture生成器或其他模型，不修改Runtime/Adapter/协议。共享仓库不构成强隔离，工程参考不升级正式G2/G3、verified或物理设备。

## 原创合同与联动证据

原始[GamePlan](../output/host-native-tidal-foundry-20261107/design-plan.md)与冻结前的[布局/时序修正](../output/host-native-tidal-foundry-20261107/design-plan-layout-addendum.md)均保留。熔炼是明确的core规则有界状态机；炮台、所有权、波次、移动、伤害与奖励由原生`a2game.strategy.tower-defense`执行。未猜测`economy-loop`宽泛stateSchema未提供的库存/槽位ABI。

| 联动 | 实际结果 |
|---|---|
| 生产→收取→建设 | 两批各120Tick熔炼，成熟前和未收取不自动进账；收取各3币。H与建A同Tick时建造被拒而钱包随后入账，下Tick可建，重复收取不再奖励 |
| 合成→对象/武器替换 | 两个一级塔变为B位的一个二级塔；新塔/武器使用新ID。旧owner后续没有开火，活跃塔/武器保持一一对应 |
| 等级→真实伤害 | 二级首击把8HP变4HP；三级主舰首击把36HP变28HP。证据是Runtime真实敌HP/射击记录及SDK画面，不是只看HUD等级 |
| 首杀→升级资金 | 观察tickIndex1060首杀已结算：1击退、钱包6；下一Tick升级到三级，钱包归0 |
| 全局过程→终局 | 三艇全部击退、港口生命1，观察1840获胜；省略奖励回投升级时二级火力不足，主舰逃逸导致失败 |
| 替代路线 | “两塔合成”与“单B直升二级”都有效。正常时钟Air实际走前者、Three走后者；两个独立二级塔的特定失败策略不证明所有非合成策略失败 |

上表对应`attempt-3/linkage-audit.json`的七个里程碑与9次后续射击，以及6场景Conformance。未把每Tick重复所有权检查数量当独立测试覆盖数量。所有游戏逻辑在共享Runtime消费JSON，Host只负责投影与输入。

## 验证和实际画面

- 三份候选完整准入与同一六场景意图测试通过；六场景为主联动获胜、提前/重复收取及同Tick资金边界、不生产失败、不回投升级失败、两个独立二级塔策略失败、单B直升替代获胜。没有为了测试故意造错，也未删除有效反例。
- 最终Air/Three各完成1100×900真实键盘＋手动Tick的获胜/缺升级败局、暂停/恢复、重开、资源/监听释放；另各完成390×844正常时钟可见DOM按钮完整通关，合计4条输入流程。正常时钟两局各约30.6秒，没有用API步进代替正常时钟。
- 两端各36个实际输入采样，跨SDK36/36匹配；按实际记录在Node每端两个独立Session回放，共144次Hash全部匹配。正常时钟的两条路线不同、输入Tick不同，不拿它们的任意Hash互比。
- 32张最终截图保留在[截图目录](../output/playwright/tidal-foundry-20261107/)，另有原稿失败图。已查看合成后、升级瞬间、熔炼中、实际8伤害/28HP、直升路线获胜和未回投败局；390px最小名义字号Air约18.22、Three约18.18 CSS px，按钮高44px，无水平内容溢出。名义字号不等于实际字形测量或自动质量分数。
- 操作区从旧方向垫＋长列修为三列八按钮（当前Host测得高约161px）；现有Player仍需纵向滚动查看控件/进度。它是短单关几何风格原型，未宣称长期平衡、独立质量评委或生产发布质量。
- Chrome渠道UA与真实SDK来源/SHA分别存浏览器结果和`attempt-3/previews.json`；无被记录的console/page error。最终ownedNodes/ownedMeshes及资源作用域归零、监听关闭、浏览器关闭，两端预览URL均显式关闭。不把引擎共享缓存计为已证明全部GPU内存零泄漏。
- `final-source-before.json`与`final-source-after.json`一致，最终浏览器/回放取证期间整仓实现指纹未变化；后续Skill更新单独绑定新SHA，不重签运行。

## 真实问题与修复记录

1. 第一稿逻辑通过，但`collect`触发参考Player固定方向垫，使手机7个额外按钮挤成长列。第二稿将H动作按领域语义改为`claimOre`，同步规则、测试和解法，未改播放器或将collect列为协议保留字。
2. 第一稿结束后仍显示“主舰决战”和“首杀6币后升级”：零奖励/后续reward也复用了通用提示。第二稿限定首杀提示，并用真实won/lost生成终态摘要。
3. 第二稿塔已三级且余额0，HUD仍提示二级B可升级。第三稿根据实际模块状态确认升级，改为“三级炮台已就绪，单发伤害8”。该文案状态会改变Hash，已完整重取证，没有冒充纯渲染不变量。
4. 第二稿修订器的一次全文件精确字符串替换也改了规则ID，而脚本仍查旧ID，准备阶段TypeError后没有写出三件套，随后两次CLI得到ENOENT。失败脚本及两个原始CLI响应保留，修准备器后再执行；不算第三次内容候选、不归因玩法模型能力。TypeError原始控制台在聊天工具记录中，磁盘`controller-prepare-failure.json`为明确标注的摘要，未伪造原始stdout或失败稿。

三个候选目录、每次准入/测试前原字节SHA快照、成功/失败命令/退出码/stdout/stderr、浏览器原始返回和修订说明均保留。第二稿准备失败时不存在候选字节，此缺失如实记录。

## 交付与Skill反馈

[最终游戏JSON](../output/host-native-tidal-foundry-20261107/attempt-3/game.json)、[Generator内容包](../output/host-native-tidal-foundry-20261107/tidal-foundry.package.json)、[启动/导入说明](../output/host-native-tidal-foundry-20261107/README.md)、[运行回执](../output/host-native-tidal-foundry-20261107/receipt.json)。内容包仍需接收方兼容的受信宿主与SDK，不嵌入Runtime或素材二进制。本作没有外部图片/音频依赖。

实测后更新Skill四份引用：复合机制因果链/少量反事实与替代路线、初态ABI不足边界、阶段文案/奖励条件和跨事件排序、action ID与Host布局的区别、结构化修订及失败停止下游。同步五处已有副本并重打包。该新包是本次反馈产物，尚未用于下一款游戏，不把两次创作重标为新包下的结果。

本次额外Provider调用0，宿主会话本身使用模型，Token与费用未独立导出。没有运行整仓全量verify、远端CI或真机；正式G3仍NOT_RUN。未提交或推送。
