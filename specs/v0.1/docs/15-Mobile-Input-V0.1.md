# Mobile Input / Trace 0.1.0

`mobile-input-v1` 增加十四个有界识别合同。它们是共享的归一化样本识别器；实际传感器、权限和真机可用性由 Host/device 回执单独证明，不能从 Manifest 注册成功推断设备已通过。

## 归一化与冲突

Pointer 使用画布左上原点的 `u/v`、独立非负 pointerId 和 down/move/up/cancel。最多 10 点，每条路径最多 128 点。扩展识别状态保存在 Snapshot/Hash 的 activePointers 中，暂停清空；只使用旧 Tap/Swipe 的 JSON 继续走既有实现及金向量。

Raw 输出 pointer pose；Drag 输出 vec2 当前位置；Path 输出有界点列；Pinch 输出相对于双指基线的比例，Rotate 输出包裹至 ±π 的角差；LongPress 和 MultiHold 按逻辑 Tick 达到阈值后 press，后续 hold，离开/取消结束。两个接触参与后不退化为单指 Tap；拖动/轨迹/长按消费单指点击。DoubleTap 声明时占用点击识别，避免先触发单击再触发双击。Pair 支持缩放与旋转同时输出，其他互斥规则不由 Adapter 决定。距离/角度及模拟值量化至 0.0001；真实设备噪声不承诺 exact，重放相同归一化 JSON 才承诺一致。

长轨迹仅保留至多 128 点；这不是任意复杂触控轨迹竞技识别器。当前 region 仍为画布，不包含按实体自动 HitTest；完整 G25–G32 和 Hxx 的命中/玩法 DoD 另验。

## IMU、权限与回退

原生浏览器入口基于 [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/)，使用安全上下文、显式用户手势启用、可用时调用两种 requestPermission，并等待实际非空样本。没有自动权限申请、后台遥测、持久化或上传。缺接口、拒绝或 3 秒未收到姿态时显示原因与已有触控/键盘回退；构造函数存在不能当作硬件可用。

Euler 姿态使用 `device-euler-rad-v1`，角速度转 rad/s，线加速度保留 m/s²；null 通道标记不可用，不能伪造为有效零采样。校准按钮注入 calibrate 样本设中立姿态，Tilt 使用声明的平滑百分比/死区/范围并补偿屏幕方向，Orientation 输出中立姿态的包裹角差；Shake 对有效线加速度阈值及冷却 Tick 判定。屏幕方向或参考系变化使校准失效。暂停/失焦/隐藏页面会停止采集、清理识别缓存，继续后需重新显式启用与校准。

原生采集与共享识别分离：DOM 监听不推进逻辑 Tick。缺失能力的游戏须声明自己的触控或键盘绑定；播放器仅显示已有语义按钮，不能捏造一个改变规则的传感器回退。现阶段不提供姿态融合、绝对朝向精度或安全多人传感器认证。

Pointer capture、cancel、触控默认行为遵循 [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/)；游戏画布声明 touch-action:none，浏览器布局不执行玩法。

## 显式输入录制

GameSpec `inputs.traceRecording: user-opt-in` 允许用户选择「重开并录制」。数据仅保存在当前页面内存，4096 样本上限，超限停止并拒绝导出截断回执；离开/销毁释放。导出是另一独立操作，不自动上传。原始输入、语义按钮及暂停/恢复均记录，固定逻辑 Tick 与序列；结束等待已排队输入消费后记录 checkpoint。

InputTrace Schema 原本已声明 `source: action|system`，本轮补齐其执行子集：action/input 携带标准动作；system 仅 pause/resume/checkpoint。控制事件在 Tick 边界执行；checkpoint 标记已完成 Tick 数，不额外推进时钟。未知控制和无效动作在启动前拒绝。仅原始输入的旧 Trace 保留原执行路径及 Hash。Trace 仍为 0.1.0；它不是可执行脚本或任意系统命令通道。

## 验收边界

实验 JSON、Conformance 和三条必要 Node 回归涵盖指针身份/互斥、校准/不可用通道、Snapshot 与混合 Trace。`node scripts/mobile-browser.mjs` 使用真实 HTTP、真实 SDK 和浏览器 Pointer/Sensor 路径，但 Touch/Orientation 来自 CDP 虚拟设备，Motion 为合成 DOM 事件；必须明确标注，不能计真机 Gate。真机回执须另外记录设备/系统/浏览器、真实权限结果、方向/焦点行为、真实 Touch/IMU Trace 与相同 JSON 回放。

## 2026-10-27 逐款输入与样本失联

显式 imu.tilt / imu.orientation 的 `trackSample:true` 保留有效样本标记；orientation 不可用时使校准/本标记失效，重新校准清除旧滤波/标记。input-control 的 `clearLostImu:true` 仅清除来自 IMU 且失去校准/标记的 axis/aim，不清除有效桌面回退来源；该选项与跟踪标记须配套，语义编译拒绝不完整组合。未启用的旧绑定与控制器保留既有字节。刚体 Tilt 同样在重新校准后停止旧施力。

Browser MobileHost 在唯一生产 Tick / 手动 Tick 前采样可用性；60 个逻辑 Tick 无有效样本即停止监听，并将 raw imu.reset 记录到输入流。暂停/方向变化/显式停止要求重校准，暂停不推进失联时钟。回放只消费记录的 reset，不访问实际硬件。Runtime 销毁释放原始输入、手势/IMU/按键缓存与事件历史。

G25/G26/G27/G29/G30/G31/G32/H04 逐款流程见 project/input-gameplay-profiles.json，覆盖实际桌面鼠标/键盘、CDP 虚拟多触点及合成 DOM 姿态/运动/权限/屏幕方向。32 份基础/作者变体双 SDK 输入流程须有原始操作、Node 哈希、截图和释放；所有此类输入均不计物理设备 Gate。
