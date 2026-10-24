# 独立游戏候选与跨域输入合同

协议 `0.1.0`，候选 Profile `bounded-reference-levels-v1`。发行号仍为 `1.0.0`。

`project/game-candidates.json` 将 G01–G32、H01–H05 分别绑定到独立 GameSpec、正反例和操作配方。`scripts/build-game-candidates.mjs` 只生成仓库作者编写的关卡，不是独立 Agent，不构成 G3。冻结登记及 verified 分母保持 32 和 5。

本轮实现单关入门/终盘参考：2048 使用可到达 2048 的终盘；五子棋使用 5×5 五连；泡泡使用四邻接方格吸附；弹球、平衡使用整数 AABB 与逻辑力矩。通用角动力学、完整商业关卡、独立生成变体及真机验收仍按原计划执行。Manifest 中出现服务依赖不等于该候选已经覆盖服务的全部变体。G21 的炮台解锁和 G28 的逻辑堆叠尤其不能代替通用塔实体替换、三维刚体或放置编辑器验收。

## 输入与唯一时钟

- `a2game.input.touch.select`：声明 scene2d 的宽高、命中中心和半尺寸，按 contain 投影命中。`tap` 在松开时选择，`drag-select` 在按下时选择起点、跨区域松开时选择终点。多指不会在结束时继续单指选择；已发生的首指按下遵循普通事件时序。取消不提交终点。
- `a2game.realtime.input-control`：T4 消费规范输入，提供裁剪后的平移、倾斜/拖动回退、切割去重、旋转/缩放目标、拉弓、放球和逻辑平衡。单轴移动使用扫掠 AABB 裁剪，禁止高速穿过薄墙。每 Tick 最多 128 单位移动，切割最多 128 路径点/对象。
- `viewportAspect` 随每次规范输入记录；不把纯视口信息持久写入空闲逻辑状态。旋转/缩放使用带按下序号的双指身份，相同 pointerId 的下一次手势重新建立基准。
- 规范输入和 DOM 语义按钮都只入队；唯一逻辑 Tick 消费它们。自动化模式的 `injectAction` 与 `injectRaw` 同样记录操作，不在渲染适配器中实现玩法。

## 物理、泡泡与表现

`aabb-int-v1` 增加受校验状态路径：瞄准、拉力、开火请求、换道请求、伤害加成和倾斜重力。请求在 T5 消费后清零，必须位于独立控制状态。射线以共享 segment/AABB 计算最近命中，实体墙阻挡。目标时间、限时、落底失败均使用共享 Tick；不采用墙钟。

`a2game.combat.bubble-grid` 在 T5 执行一枚有界弹体、墙反弹、四邻接吸附、同色连接消除及无顶部支撑的掉落。棋盘最多 256 格、64 发，发射速度最多 128 单位/Tick，颜色由共享 RNG 选择。开火时已有弹体、弹药不足或关卡结束均不生成第二枚弹体。

`visual.bound-stage` 的 `numeric-pointer-v1` 允许位置、旋转、尺寸绑定数值 JSON Pointer，并使用有界仿射 scale/offset。绑定必须初始可解为有限数值，尺寸必须为正；缺少 Capability 拒绝。`visual.body-style` 只控制圆形和数值色板/标签，不改变碰撞形状或逻辑 Hash。

## 跨域顺序与计时

T4 模块提交后执行 T5 物理，T7 条件共享同一快照，T8 提交规则效果。因此 H01 的合并伤害可被当 Tick 武器消费；H02 当 Tick 的消除奖励不能被之前的购买操作使用；H03 并发区域输入在规则提交后由下一 Tick 物理消费。H04 重力与合并共用世界账本，H05 暂停冻结限时。

`core.bootstrap` 每个 Session generation 只产生一次 `level.started`，可选 `tickPath` 产生 `level.tick`。计时器由该事件启动，避免首帧多输入重复注册同 ID 计时器。重开恢复初始标记和计时队列。

## 验收回执

`npm run candidates:e2e` 通过真实 HTTP、锁定的 CocosAirJS 和 Three.js，对同一 JSON 的正反例分别校验 Node/Host Hash、跨引擎 Hash、暂停、重开和销毁，保存截图/操作/源码指纹。每批最多 12 个不同发布项，不放宽每服务 32 个发布项的限制。G03 另走真实浏览器 DOM PointerEvent 命中选择。规范化虚拟输入、桌面 PointerEvent 均不代替 Android 真机 Touch/IMU。

所有候选保持 `verified:false`。正式 CoverageResult 只有在对应 G0/G1/G2/G3、完整玩法 DoD 以及适用真机合同全部满足后，才能升级冻结登记。
