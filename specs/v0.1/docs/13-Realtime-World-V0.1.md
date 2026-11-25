# Realtime World / aabb-int-v1

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
