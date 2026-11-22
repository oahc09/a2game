# Locked 3D rigid-body profile

`repeatLaunch: true` 允许尚未终局的活动球体在再次按下发射键时重设线速度，并再次发布 `rigid3d.launched`。作品可用该事件累计击球次数。当前 G149 参考果岭采用同一配置速度和方向验证多杆计数。

`a2game.physics.rigid3d@0.1.0` 使用锁定的 cannon-es 0.20.0，来源、ESM/Node 文件 SHA 在 `project/sdk-lock.json`。官方来源为 https://github.com/pmndrs/cannon-es 和 https://pmndrs.github.io/cannon-es/docs/ 。Node 与浏览器消费同一组参数和量化状态；CocosAirJS/Three.js 只绘制只读 Stage，不各自推进物理。

每 Tick 在 T5 重建至多 16 个可信 box/sphere Body，以固定的四个子步积分；NaiveBroadphase 与 16 次求解迭代、局部稳定 Body ID 固定接触顺序。完整位置、线速度、Quaternion、角速度按 1e6 量化；下一 Tick 从这些数值重建并归一化 Quaternion。缓存不跨 Tick 持有，因此 Snapshot/回放不依赖不可序列化的原生 World。Euler XYZ 仅为只读姿态投影，不代替 Quaternion 积分或接触力矩。

此有界 Profile 支持零摩擦接触、0–1 弹性、重力/校准后倾斜输入、单次发射、有限预分配放置槽、有序三维触发体和连续稳定计时。球体三轴尺寸必须一致；静态体不可在初态隐藏；池数与放置目标、发射体索引、速度、尺寸、重力及完整状态均有边界验证。它不承诺任意网格、关节、车辆或跨所有 CPU/求解器的等价。exact 接受范围仅限实际回执所记录的锁定 Node/Chromium 平台；不可由量化推出普遍确定性。

G15 为真实球体、球台/边界碰撞反弹、去程与回程触发；不以旧 AABB 跳跃代替。G28 由真实三维方块、接触力矩和角速度堆叠判稳定；偏出支撑会旋转倾覆/坠落，不使用逻辑倾角判定器。作者变体分别改变发射速度/回程触发位置以及堆叠数量。

所有 World/Body 都在模块返回或抛错的 finally 路径移除，`rigid3dDiagnostics().activeWorlds` 必须为 0。JSON State 不包含 Cannon 对象；事务回滚、重开和销毁无外部物理缓存。Stage 用 `numeric-pointer-v1` 绑定运动/旋转；未激活的固定槽投影至视锥外，不动态访问不存在的数组项。GPU 几何体、材质及 SDK 原生节点由既有 Stage Adapter 释放。

浏览器只从同源固定路由 `/player/physics/cannon-es.js` 加载 SHA 验证后的 ESM；不公开其他 node_modules 路径。Node 从 npm 完整性锁定的包加载，Registry 同时检查两种分发文件 SHA。普通 JSON 不提供模块代码、URL 或脚本。默认 `npm ci` 安装依赖；真实 G2 仍须完整 Schema + HTTP + 两个真实 SDK、Hash、画面与释放回执。真机输入与完整人工质量另验。
