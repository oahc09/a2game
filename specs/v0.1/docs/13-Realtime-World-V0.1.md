# Realtime World / aabb-int-v1

可选 `actions.climb` 绑定持续按钮。离地且与固定固体侧面相切时，按住按钮将水平速度置零、竖直速度设为 48，之后照常施加重力和碰撞。跳跃优先于攀爬。松开或脱离墙面后恢复普通运动。

持续方向输入可通过可选 `driftAction` 绑定侧滑键。按住侧滑键时，每轴速度取上一 Tick 速度的四分之三与当前方向目标速度的四分之一，结果向零取整。两轴速度绝对值都达到 16 时发布 `realtime.drift`，作品可按连续 Tick 计分。松开侧滑键即恢复即时方向响应。

`breakableSolids: true` 允许弹丸伤害非中立且敌对的 `solid`，耐久耗尽后从世界移除。中立和友方固体继续阻挡弹丸。

`airJumpOnce` 启用一次额外空中行动。空中再次按跳跃，或绑定 `dash` 后沿当前水平速度方向冲刺，都会消耗该次数。地面接触后恢复。`wallJump` 允许离地角色在固定实体侧面相切时向反方向跳跃。`gravityFlipPath` 绑定布尔状态，开启时反转该世界配置的基础重力，接触及物体位置由共享世界继续计算。

可选 `lift` 使用 `body` 指定初始固定实体，`enabledPath` 读取布尔状态，并在物理 Tick 前选择 `restY` 或 `raisedY`。实体须为固定的 `solid`，两个高度都须在世界边界内，升起位置须高于初始位置。碰撞和 BodyLayer 同步使用更新后的高度。[G52 用例](../../../games/coverage-v2/g52-lift-bridge/conformance.json)

`a2game.realtime.world@0.1.0` 是共享 Runtime 的有界 2D 整数物理与战斗 Profile。不是任意三维刚体求解器；G11–G21/G30/G31 完整玩法仍独立验收。Host 不参与积分、碰撞或伤害计算。

## Tick 与可复现性

Runtime 保留既有 T4 离散模块顺序，然后仅对 Manifest `phase: physics` 的模块执行 T5，统一建立 S_sim 后执行规则。旧模块未声明 physics，Tick/Hash 金向量不变。T5 的临时状态、RNG、事件和规则写入均服从原子发布/回滚与整 Session Snapshot；没有浏览器物理时钟。

坐标为每米 1000 整数单位，速度为单位/Tick，加速度为单位/Tick²。世界至多 32000×32000，128 个轴对齐矩形，半尺寸至少 16，速度每轴不超过 128，最多 8 个当前子步（合同预算上限 16）。按当前最大速度选择子步，整数余数分配位移。世界边界裁剪，静态/动态分离采用最小穿透轴，平局使用 Y，动态平分穿透；弹性系数 0–1000。稳定 Body ID 决定对撞处理顺序。该 Profile 无旋转惯性、圆形/连续复杂形状及跨求解器等价承诺。

接触键按两 Body ID 排序，每 Tick 去重后生成 `contact.begin/stay/end` 并进入 contact 通道；内部子步不重复发布接触。跳跃/蓄力、重力、换道、滚动、矩形边界约束、触发拾取、接触同值合成、追踪、固定 Tick 波次和有限对象池在同一 Profile 内结算。对象池满拒绝产生新对象，不覆盖存活对象；波次等待后续容量。触发/合成对象每 Tick 只消费一次。

武器支持向右射线或最近敌人自动瞄准、直线弹丸、Tick 冷却、生命/伤害/死亡与无敌窗口。弹丸拥有命中记录，同一对象碰撞后立即退出，伤害还按 source/target 在 Tick 内去重。物体和弹丸生命周期随 Session 重开/销毁，无 Adapter 引用。这里只提供声明的机制，复杂寻路、Boss、旋转动力学及任意瞄准扩展不能由这些服务标记推断完成。

## 可选圆形瞄准

`aimMetric` 默认 `manhattan`，保留 L1 归一化、菱形目标范围及弹丸分量向零截断。`euclidean` 改用 L2 归一化，最近目标排序和射线候选筛选采用目标中心的距离平方，射线端点使用相同半径；实体遮挡与零向量的备用方向不变。显式 `weaponRange` 必须是 1–32000 的整数，默认仍为 32000；它不是弹丸的 TTL/距离限制。

欧氏模式按分量对称四舍五入，保持整数世界的旧坐标格式和子步。速度 128 的直向弹丸为 (128,0)，45° 为 (91,91)；通常量化误差不超过每轴半单位。极低速度时相对误差明显，例如速度 1 的 45° 弹丸为 (1,1)，不再静止。该选项不会改变手柄死区、触摸坐标、输入提交 Tick 或既有游戏的默认玩法。能力清单内容摘要会变化；旧存档仍按既有精确摘要门禁处理，不自动迁移或把旧证据当作新证据。机制通过不等于 G59 双摇杆射击整局验收。

## 固定车道兼容增量（2026-10-27）

可选 `laneCenters` 为 2–16 个严格递增、不重复的整数中心，必须容纳初始 actor 半宽且处于世界内；初始 actor 必须在一个中心上、vx 为 0。仅允许 laneLeft/laneRight 控制横向，拒绝 heldMovement、actions.left/right 和非零 jumpHorizontalSpeed 混用。每 Tick 合并按键与 laneRequestPath 后将方向钳制为 -1/0/1，只移一个索引；首尾索引钳制。固定轴在积分及接触分离后重新约束到选中中心，横向速度为 0。未声明时保留既有 laneWidth/世界边界行为。

G13/H03 基础 revision 3 使用三中心 [2000,4000,6000]、三段向下障碍、两个有序 pickup 检查点与 Tick 波次；GameSpec 规则按 contact.begin 判障碍碰撞、按 realtime.trigger 单次递进检查点。滚动物有有限 TTL，过关时只保留角色。H03 使用 projectile 武器：弹丸命中敌人造成伤害，碰 solid 障碍移除且障碍保留；获胜同时要求击退与两个检查点。左/中/右触摸分区分别提交 lane/fire 请求，T8 写入请求由下一 Tick T5 消费；直接键盘动作在当 Tick 消费。作者变体镜像路线并交换分区，不改变共享 Runtime 或 Adapter。

## 表现与证据

可选 `projectileHalfSize` 为 16–128 的整数半尺寸，默认 16，作用于新弹丸的 hx/hy 与统一碰撞投影；未设置的旧 JSON 保持原行为。H03 显式设为 64，使真实 SDK 画布中的弹丸可辨识，Adapter 不放大或修改其物理范围。

2026-10-27 G12 revision 3 组合现有整数世界能力：固定 target 门柱与角色接触即造成伤害；门柱 value 和角色 value 都为 0，只有门后 pickup 计分。门柱半宽 140、角色半宽 100；计分触发器位于门柱中心后 400，半宽 16，最早重叠时角色中心已超过门柱后边缘加角色半宽，保证身体完全越过门柱后才得分。pickup 消费后移除，重复停留不加分；作者变体同时增加第三对门柱及门后触发器。Adapter 仅绘制矩形门柱、触发线和角色，不计算碰撞或分数。

2026-10-26 兼容增量：`actions.up/down` 与 `left/right` 分别控制 Y/X 轴，`cancel` 与 `release` 都停止对应移动轴；`charge` 的 `cancel` 清空蓄力但不发射/跳跃。显式 `heldMovement:true` 时每 Tick 只消费当 Tick 的 press/hold，未保持的轴归零，因此暂停/焦点丢失清理输入后不会残留移动。旧配置未开启该字段时保留原积分语义。G18 revision 2 使用该合同，瞄准/射击与二维移动独立；Host 仅提交输入。

`scene2d.bodyLayer` 是兼容增量：`statePath` 指向 Body 数组，`unitsPerMeter: 1000`、原点和类型调色板投影为普通矩形 DrawCommand。完整 Schema 与语义检查同步，旧 scene2d 没有该字段时行为不变。投影只读，不进入 Hash。

10 份参考关卡覆盖跳跃、重力拾取、换道、反弹、约束、合成、弹丸、射线冷却、波次和追踪/无敌时间。预期数值在 JSON 生成器中人工固定，Conformance 不调用实现产生期望。`node scripts/mechanism-browser.mjs --suite=realtime` 在两个真实 SDK 下执行相同 JSON，核对数值断言、Node Hash、暂停/重开、截图和释放。实际回执存储在独立 `reports/realtime-*` 目录。软件 GPU 和移动视口不计真机 Gate。

## 2026-10-27 显式兼容增量

显式 platformLanding:true 时，actor 在 solid 顶面向下落地即停止横向漂移，首次 realtime.landed 附加 surface、x、centerOffset（角色与支撑中心 X 的整数差）。接触按既有稳定 Body ID 顺序选择支撑；连续站立不重复发落地事件，离地后可再次触发。未开启时保留既有速度与仅 id 的事件。G11 用 GameSpec 有序平台规则记录中心连击/偏心重置和加分；两次落点后完成，落空或超时失败，Adapter 不判断落点或分数。

## 2026-10-27 完整合成与生存

显式 `overflowY` 启用合成溢出线；`overflowTicks` 为 1–120，默认 30。只有静止 target、顶部越线且沿较低 Body 接触链连到地面/静态支撑才累计 world.overflowTicks；失去条件归零。持续达到阈值产生 realtime.failed(reason=overflow)。空中短暂停速不会误判，旧配置不增加状态字段。G16 四颗 2 连续合成为 8，错序堆叠失败，重开回收全部旧体。

G18 revision 3 加入真正 solid 墙，直线 hitscan 被阻挡，WASD 绕行与拖动瞄准分离。G19 revision 3 用既有 GameSpec 规则、计时器和 damageBonusPath 组合三波追踪、一次技能及升级：技能消耗一次充能，40 Tick 后恢复当前升级伤害；T5 消费上一规则阶段提交的增伤，无 Adapter 玩法分支。

2026-10-27 G25 revision 3 使用已有整数重力驱动水果，落地未切中经 GameSpec 规则失败；低采样轨迹与炸弹仍在共享 input-control 中求交、去重。G30 显式 `cancelClearsPower:true` 时取消拉弓将 power 归零，多指中断与单次释放沿既有 fireRequest 事务；未启用时保持旧取消状态。HUD 只投影拉力/发射计数，不参与玩法。
## 定步身体与投射物得分

`a2game.realtime.grid-trail@0.1.0` 的 3–12 行列格网按左、右、上、下绑定四个 button Action。每隔 `intervalTicks` 移动一格，每格接受第一个有效转向，拒绝反向。未吃食时本步会移走的尾格可进入；撞到其余身体或边墙结束。吃食保留尾格并由共享 RNG 从未占格号中选下个食物；达到 `goalFood` 或填满格网完成。状态保存身体顺序、已排队转向和食物，Host 使用普通 `scene2d` 网格投影。[G41 正反例](../../../games/coverage-v2/g41-moss-trail/conformance.json)

`realtime.world` 可选 `projectileGate`，配置投射物计分横线 `y` 和有效的 `minX/maxX`。模块在整数子步中对从严格上方到等于或低于横线的轨迹插值，横坐标落入闭区间才加一分、移除投射物，并发出 `realtime.projectile-scored`。每颗投射物至多贡献一次此类得分。[G146 正反例](../../../games/coverage-v2/g146-clear-bay-hoop/conformance.json)

`moveSpeedBonusPath` 可指向独立的 0–128 整数状态；下一 Tick 的方向移动使用 `min(128, moveSpeed + bonus)`。G73 用它实现移速与火力二选一。[G73 正反例](../../../games/coverage-v2/g73-frost-watch/conformance.json)

`independentProjectileHits:true` 使弹丸伤害按目标和弹丸 ID 去重，同一主人发出的多颗弹丸可在同一 Tick 分别命中。事件的 `source` 仍为主人 ID，目标的无敌窗口和已死亡判定仍适用。未启用时沿用目标与伤害来源的去重方式。

`projectileBeforeContact:true` 将敌对角色与目标之间的接触结算延后至同一 Tick 的弹丸子步结束。过程中相交的组合按对象对记录一次，已经击毁的成员不再造成接触伤害。仍有交叠的存活对象按原碰撞规则分离。未声明时沿用既有子步内结算顺序。

`projectileMuzzleOffset` 可指定 0–2,000 个整数世界单位的发射偏移。按归一化发射方向推进弹丸出生中心，四舍五入到整数，并限制在模拟区内；双发仍保留各自横向偏移。省略或设为 0 时沿用原出生位置。

波次可选 `repeatEveryTicks`（1–36,000）。重复波次用具有正 TTL 的移动目标模板，在起始 Tick 和每个周期发起一次生成，活跃 ID 由模板 ID、波次序号和 Tick 组成。对象池满时跳过该次，等待下一周期。重复波次不写入一次性波次的 `spawned` 账本。模板 ID 最长 26 字符。

配置 `wavePhases` 时，`waves` 提供 1–8 个 `tick:0` 的下降目标模板。阶段按 `startTick` 严格递增，首段从 0 开始。各阶段从自己的起点按 `intervalTicks` 生成。共享 RNG 按 `weights` 选模板，随后在目标可容纳的水平区间选出生 X。纵向速度按 `speedPermille` 缩放并向零取整，TTL 按到下边界的距离和缩放后的速度计算。目标之间记录接触但不推挤。末段持续循环，满池跳过当次生成。暂停期间无 Tick 推进，因此不改变波次节奏。

向上发射的投射物世界可配置 `shooterSupplies`。GameSpec 声明炸弹按钮、初始 `bombs` 和值为 0 的 `doubleShotUntil`。补给从首个正间隔起按 `intervalTicks` 生成，以共享 RNG 等概率选取双发或炸弹。收取双发从下一 Tick 起刷新有效期，不影响当前开火冷却；池内能放入两枚时才发出双发。收取炸弹按 `bombCapacity` 封顶。炸弹按下先于本 Tick 的敌机生成和碰撞，消耗一枚并按普通击毁计分清除当时在场的敌方目标，保留补给；库存为空时无效果。暂停冻结计时，重开恢复声明初态。

输入控制器可用 `moveMode: "relative-drag"` 和 `rawAction` 绑定 `touch.raw`。按下保存受控物体与按点的世界坐标差，首次移动保持该偏移，每 Tick 遵守配置速度上限和现有碰撞裁剪。抬起、取消、多点介入或活动指针失效时停止跟随，下一次按下重新计算偏移。
