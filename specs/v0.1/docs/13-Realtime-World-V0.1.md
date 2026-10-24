# Realtime World / aabb-int-v1

`a2game.realtime.world@0.1.0` 是共享 Runtime 的有界 2D 整数物理与战斗 Profile。不是任意三维刚体求解器；G11–G21/G30/G31 完整玩法仍独立验收。Host 不参与积分、碰撞或伤害计算。

## Tick 与可复现性

Runtime 保留既有 T4 离散模块顺序，然后仅对 Manifest `phase: physics` 的模块执行 T5，统一建立 S_sim 后执行规则。旧模块未声明 physics，Tick/Hash 金向量不变。T5 的临时状态、RNG、事件和规则写入均服从原子发布/回滚与整 Session Snapshot；没有浏览器物理时钟。

坐标为每米 1000 整数单位，速度为单位/Tick，加速度为单位/Tick²。世界至多 32000×32000，128 个轴对齐矩形，半尺寸至少 16，速度每轴不超过 128，最多 8 个当前子步（合同预算上限 16）。按当前最大速度选择子步，整数余数分配位移。世界边界裁剪，静态/动态分离采用最小穿透轴，平局使用 Y，动态平分穿透；弹性系数 0–1000。稳定 Body ID 决定对撞处理顺序。该 Profile 无旋转惯性、圆形/连续复杂形状及跨求解器等价承诺。

接触键按两 Body ID 排序，每 Tick 去重后生成 `contact.begin/stay/end` 并进入 contact 通道；内部子步不重复发布接触。跳跃/蓄力、重力、换道、滚动、矩形边界约束、触发拾取、接触同值合成、追踪、固定 Tick 波次和有限对象池在同一 Profile 内结算。对象池满拒绝产生新对象，不覆盖存活对象；波次等待后续容量。触发/合成对象每 Tick 只消费一次。

武器支持向右射线或最近敌人自动瞄准、直线弹丸、Tick 冷却、生命/伤害/死亡与无敌窗口。弹丸拥有命中记录，同一对象碰撞后立即退出，伤害还按 source/target 在 Tick 内去重。物体和弹丸生命周期随 Session 重开/销毁，无 Adapter 引用。这里只提供声明的机制，复杂寻路、Boss、旋转动力学及任意瞄准扩展不能由这些服务标记推断完成。

## 表现与证据

`scene2d.bodyLayer` 是兼容增量：`statePath` 指向 Body 数组，`unitsPerMeter: 1000`、原点和类型调色板投影为普通矩形 DrawCommand。完整 Schema 与语义检查同步，旧 scene2d 没有该字段时行为不变。投影只读，不进入 Hash。

10 份参考关卡覆盖跳跃、重力拾取、换道、反弹、约束、合成、弹丸、射线冷却、波次和追踪/无敌时间。预期数值在 JSON 生成器中人工固定，Conformance 不调用实现产生期望。`node scripts/mechanism-browser.mjs --suite=realtime` 在两个真实 SDK 下执行相同 JSON，核对数值断言、Node Hash、暂停/重开、截图和释放。实际回执存储在独立 `reports/realtime-*` 目录。软件 GPU 和移动视口不计真机 Gate。
