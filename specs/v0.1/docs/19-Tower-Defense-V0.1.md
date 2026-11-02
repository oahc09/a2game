# 固定 Tick 塔防与合成所有权

`a2game.strategy.tower-defense@0.1.0` 是共享 Runtime 的有界整数参考行为，执行于 T4。发行版本仍为 `1.0.0`。G21/H01 revision 2 使用此行为；旧 revision 的报告保留。

每 Tick 按以下顺序提交同一状态事务：购买/放置/选择/合成/升级，生成到期波次，沿路径移动，炮台射击，死亡奖励，胜负。奖励不能支付该 Tick 较早的购买操作；下一 Tick 可使用。波次与冷却使用 `ModuleContext.tickIndex`（首个逻辑 Tick 为 0），暂停不推进。

执行 Tick `n` 时，模块读取的 `ModuleContext.tickIndex` 为 `n`；该 Tick 提交后的 `Session.observe().tickIndex` 为 `n + 1`（下一个待执行 Tick），不能用观察值替代刚执行的 Tick 编号。武器只有在 `nextFire <= n` 且存在射程内存活目标时才射击；成功射击记录 `shots[].tick = n`，并设 `nextFire = n + cooldownTicks`。观察到 `tickIndex == nextFire` 表示下次推进将执行到期 Tick，并非到期射击已经发生。

## 输入和状态

配置包含 `statePath`、整数 `width/height`、`cost/damage/range/speed/cooldownTicks/maxTicks`、放置点 `cells`、折线路径 `path`、按 Tick 排序的 `waves`，以及 `{action,kind,index}` 命令表。`kind` 为 `place/select/merge/upgrade`，只引用声明的 button Action。完整配置 Schema 位于 Manifest；重复位置、非法顺序、越界点和未知动作在语义编译时拒绝。

状态保存 wallet、score、lives、nextId、selected、waveCursor、towers、weapons、enemies、bodies、shots、won/lost。每个塔唯一持有武器，武器反向引用 owner。无目标不消耗冷却。射程使用整数 Manhattan 距离，按距离、稳定对象 ID 排序；每塔每 Tick 最多一次瞬时伤害，不是通用弹道/角动力学。

合成只允许两个不同格、同级且未到 8 级的塔。删除两塔和两武器，生成新 ID 的升级塔和新武器；新冷却为两旧武器冷却与当前 Tick 的最大值。即在执行 Tick `n` 时继承 `max(n, oldA.nextFire, oldB.nextFire)`：两旧值相等或不等都遵循该式；若两者均不晚于 `n`，合成塔可在同 Tick 的射击阶段射击；任一旧值晚于 `n`，必须等到较晚的到期 Tick。继承值不是已完成射击后的最终值；若当 Tick 成功射击，仍更新为 `n + cooldownTicks`。不会重复使用 ID，也不会通过合成刷新尚未到期的射击机会。`defense.merged` 事件记录退休 ID 与替换 ID；后续武器不得持有退休 owner。升级按 `cost × 当前等级` 扣费。

敌人到路径终点先扣生命再进入射击阶段。全部波次已产生且无存活敌人才胜利；零生命或到达 maxTicks 优先失败。路程按每 Tick 固定预算先 X 后 Y 消费，无墙钟、独立计时器或 Host 玩法。最多 16 塔、32 波/敌人、64 路径点，速度最多 128 单位/Tick。1000 单位为一米。

## Host、回放与证据

`bodies` 是已提交塔/敌人的只读整数投影，复用 `visual.scene2d` / `visual.body-style`；Three.js 与 CocosAirJS 无新增玩法分支。Session 快照/回放同时保存 ID 分配器、波次、冷却和引用；重开恢复空对象与初始钱包；释放由 Session 和现有表现资源所有者执行。

`test/defense-library.test.mjs` 覆盖合成所有权与冷却、暂停/快照、奖励支付顺序、非法放置/绑定、射程/漏怪/超时，以及 G05 实际层叠遮挡与撤销。G21/H01 正反例纳入既有 Conformance 与 `candidates:e2e` 双 SDK。真实当前回执见 `project/status.json`，完整 G3、物理设备与逐款完整 DoD 继续独立验收。

`test/defense-cooldown-boundary.test.mjs` 使用独立合成状态与 Runtime 定义验证相等/不等旧冷却的到期前、恰好到期、到期后边界，以及无目标、提交后观察、暂停和快照重放；不读取历史候选或解法，不构成真实 Host/G3 证据。
