# 兼容与扩展参考合同

发行 `1.0.0`，GameSpec/Capability/Adapter `0.1.0`，exact logical projection v1 保持不变。本轮是可复验的初始扩展 Profile，不表示未来兼容维护已永久完成。机器状态见 `project/status.json`，逐项边界见 `project/extension-profiles.json`。

## 重放存档与迁移

`src/replay-save.ts` 仅接收规范 InputTrace，以公共输入接口在新 Session 重放，不导入任意外部 SessionSnapshot，也不修改当前游戏。v2 信封绑定 GameSpec SHA256、完整可信 Manifest digest、runtime profile、最终状态 Hash 和 JCS 校验和。预算为 1 MiB、4096 事件、3600 Tick；预算之外需未来单独定义受校验快照 Profile。校验和用于完整性，不是签名或身份认证。

`createReplaySave` 重放后创建信封；`openReplaySave` 校验上下文并重建 Session，调用者拥有返回 Runtime，使用后须 dispose。暂停、待触发计时器、共享 RNG、手柄/手势缓存等通过输入和同一 Tick 重建。录制仍是用户显式选择，不自动采集设备。

v1→v2 是本轮明确提供的旧版参考信封迁移，不能解释为兼容曾经发布的任意生产存档。游戏/Manifest 有变化时，默认拒绝。仅允许宿主提供的、精确 from/to Game SHA 与 Manifest digest 匹配且唯一的 `TrustedSaveMigration`；回调不从 JSON 反序列化。迁移后的 Trace 必须再次通过 Runtime。保存源数据不被覆盖，迁移产生新对象。

CLI：

```powershell
node scripts/replay-save.mjs export game.json trace.json new-save.json
node scripts/replay-save.mjs open game.json new-save.json
```

GameSpec 先完整准入；输出使用独占创建，不覆盖已有存档。旧 Trace 保持读取，新增的语义动作 `viewportAspect` 在重放时保留。

## 新 Host：本机公开回合棋桌

```powershell
$env:A2GAME_ROOMS='1'
npm run player:serve
```

打开 `/player/room.html`，创建棋桌，再用本机另一标签页加入房间号；两端可分别选择 Three.js、CocosAirJS。默认服务不开放房间 API。HTTP 保持 loopback/same-origin；不开放 LAN、不改端口权限、不自动授予传感器权限。

`local-public-turn-v1` 只接受完整准入后的空棋盘、双人 turn 模块、唯一公开 turn 状态，没有额外 Rules、资源、原型、实时模块或隐藏信息。服务端拥有唯一 HeadlessRuntime；合法落子推进一个逻辑 Tick。客户端只显示 PresentationFrame、注入已声明按钮。胜利/非法落子由共享玩法判定，Host 不按游戏 ID 实现规则。G24 的胜利条件已修正为任一玩家五连，第二席位不会陷入无法结束的状态。

服务端分配席位，动作须包含当前版本和严格递增序号，不能指定另一玩家、Tick、任意状态或脚本。版本过期、重复序号、抢回合、未声明动作、占用位置均拒绝；非法动作恢复事务前快照，不消耗 Tick、序号或版本。公开对局 journal 可独立重放。`turn.draw` 是终止标记；不擅自给 GameStatus 协议加入 `draw` 值。

最多 8 房间、2 席位、10 分钟 TTL、8 KiB 请求。席位令牌为本机本次会话生成，仅在当前页面内存及服务进程中使用，不写 URL、存储、截图或回执。暂停同步不驱动逻辑，恢复后拉取权威版本；刷新页面丢失席位。关闭/过期/进程退出释放 Session。客户端销毁释放请求、监听器、观察器和 SDK 对象。该 Profile 不提供互联网身份、安全隐藏信息、实时回滚或持久房间恢复。

## 新设备：Gamepad 按钮与双轴

`gamepad.button` 和 `gamepad.axis2` 是独立版本化识别器。规范 raw sample 为：

```json
{"source":"gamepad","kind":"sample","payload":{"index":0,"connected":true,"buttons":[true],"axes":[0.8,0]}}
```

最多 4 设备、32 按钮、16 轴；轴范围 [-1,1]，量化 1e-4，绑定有死区。按钮 press/hold/release 及来源 OR 合并在共享 Runtime；保持状态参与 Snapshot/Hash，回放不依赖重复的硬件采样。断连释放按钮并中和轴，暂停清空缓存。越界或错误类型受控拒绝并回滚。

`gamepad.axis2` 默认仍使用旧版逐分量死区，不改变现有 Gamepad Lab、Raw Trace 或已发布存档。仅在绑定为 `{ "xAxis": 0, "yAxis": 1, "deadZone": 0.2, "deadZoneMode": "radial" }` 时采用径向死区；两轴必须不同。对量化后的向量计算半径 `r`，`r ≤ deadZone` 输出中性，其余保留方向，将半径映射到 `(min(r, 1) − deadZone) / (1 − deadZone)`，最后以 1e-4 量化组件并保持长度不超过 1。仅在映射值变化时发出轴更新，回到中性及已跟踪设备断连发送零向量。不应将 `vec2` 更新使用的 press 边沿当射击按钮；玩法按非零瞄准值或独立射击动作决定。配置变更应作为新 GameSpec 修订，旧定义继续按原方式回放。

两个径向绑定可以消费同一设备中独立的轴对；这不规定硬件轴编号或标准布局。G59 尚需实际设备映射准入、键鼠/触控回退、玩法与双 SDK 工程验收，不能因合成向量测试通过改写正式验收状态。

`player/gamepad-host.mjs` 只在用户点“启用手柄”后，沿现有唯一逻辑 Tick 的边界调用原生 API；硬件采样不创建第二个游戏时钟。API 不可用/拒绝时说明回退；暂停、重开、录制重开、失焦及销毁停止采样。示例 `gamepad-lab` 用 Space/collect 与 ArrowRight/lookRight 提供无硬件回退。

真实 SDK 验收中的临时 `navigator.getGamepads` 夹具是虚拟设备；它证明 Host 采样→识别→录制/存档→回放链，不是真实手柄或 Android Touch/IMU 证据。物理设备仍需独立设备/系统/浏览器、授权、采样和生命周期回执。

## 后续 Host / 设备的接入清单

新 Host 注册独立 Adapter Manifest，声明受支持的 PresentationFrame 子集、物理 Profile、资源所有权与限制；消费只读画面，不复制玩法。必须保留同一 JSON 的输入、Node Hash、画面、缩放/DPR、暂停/重开、context loss、销毁/重建证据。CocosAirJS 单文档初始化限制沿上游契约执行。

新设备先给出单位、坐标、版本、值类型、预算、权限、不可用与回退策略，再增加 Manifest、规范化、共享识别、Schema/语义检查、正反例、Host 和 Coverage receipt。设备原生权限只能由真实用户手势请求；虚拟上下文授权不提升物理 Gate。未知 Capability 必须拒绝，不能被静默忽略或降成 Canvas2D 冒充真实 Host。

## 多版本、性能和 CI

`npm run compat:matrix -- <另一主版本的 node.exe>` 在隔离 Node 二进制上重跑核心语义、旧 InputTrace/Hash 金向量、存档、回合与手柄合同，记录版本、二进制 SHA、日志及源码指纹。本机 Node 22 Windows 二进制来自 [Node.js 官方校验清单](https://nodejs.org/dist/v22.23.4/SHASUMS256.txt)，精确来源和 SHA 在 `project/toolchain-lock.json`；不替换系统 Node。

`npm run performance:profile` 测量 Headless 128 Body 的固定工作负载，保留 P50/P95/max、CPU/Node/OS 和源码 SHA。它不是物理 Android、GPU 或最坏碰撞场景的帧率承诺。16.67ms 只作为 60Hz 的参考比较，超出时保留实际结果。

`.github/workflows/compatibility.yml` 提供 Windows/Linux × Node 22/24 的完整校验，以及显式手动启动的真实 SDK 工作流。Actions 锁定官方仓库的 commit，SDK 从 `project/sdk-lock.json` 的固定上游 commit 构建。原始报告以字节保留，源码 LF 固定；每次只归档新证据。Actions 用法参见官方 [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node)、[setup-python](https://github.com/actions/setup-python)、[upload-artifact](https://github.com/actions/upload-artifact)。本次只提交配置，未推送或运行远端 CI。

校验器和生成器子进程显式使用 UTF-8 标准输入输出，避免依赖 Windows Python 的区域编码；工程回归会故意把父环境设为 ASCII，再验证中文标题和完整修复链。CI 同样显式设置 UTF-8。

回归通过只提升对应参考 Profile。冻结 verified 分母仍为 32 Gxx、5 Hxx；真实独立生成器、逐款完整质量 DoD、Android Touch/IMU 和物理手柄的未完成项保持单独状态，不由 S11 的兼容工程代替。

## 2026-10-27 显式兼容增量

保持 turn.draw 作为业务标记，不向 GameStatus 加入 draw 值；显式的 GameSpec 兼容增量允许 Outcome 提交已存在的 stopped，供 G24 中立结束。公开回合服务继续独立检查 turn.draw，已有房间合同无需依赖新 Outcome。完整 Schema、类型与语义校验同步；旧宿主拒绝不支持的定义，不将和棋伪作获胜。

### 可选标准手柄布局与 Y 方向

同一设备索引下的所有手柄绑定可以统一声明 `mapping: "standard"`。普通播放器和独立 SDK 等浏览器宿主只接受 `Gamepad.mapping === "standard"` 且含四个轴的设备；不明映射来源不传入 Runtime，已跟踪设备失去标准映射时发送一次断连样本。标准轴对只能是 0/1（左摇杆）或 2/3（右摇杆），按钮索引为 0–16。不同设备索引可以使用不同策略。未声明此字段的旧定义仍使用原有输入。

可选 `invertY: true` 只用于 `gamepad.axis2`，在死区滤波后仅翻转 Y；用于将标准手柄“向上为负”映射到游戏世界“向上为正”，避免在玩法层再次翻转。默认不翻转。原始采样及历史回放格式不变，也不能用于证明物理手柄的布局。触屏的顶部原点保持不变，双指控制需在各自的玩法绑定中显式处理。
