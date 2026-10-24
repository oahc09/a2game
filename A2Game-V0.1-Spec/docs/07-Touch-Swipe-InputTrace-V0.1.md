# A2Game Touch Swipe / InputTrace V0.1 · 输入附加契约

状态：**归一化 Touch Swipe 识别与合成轨迹回放已验证；真实触摸硬件、IMU 采集和权限未验证。**

## 1. 输入层次

`Source Adapter (Pointer/Touch/Keyboard/IMU) -> NormalizedRawInput -> Recognizer -> NormalizedAction -> Game Rule/Gameplay Module`。

`touch.swipe` 由能力 `a2game.input.touch.swipe@0.1.0` 提供。声明绑定 `source:"touch.swipe"`，`config` 至少包含 `direction: left|right|up|down`；可声明 `minDistanceNorm`、`maxDurationUs`。手势符合阈值后发出同 Tick 成对的 `press` 和 `release`，不得将某次释放误记为持续保持。

Normalized Pointer Payload 至少包含 `pointerId`、`pointerType`、`u`、`v`。`u/v` 为画布归一化坐标，坐标起点在**左上**，Y 正向下。相同 `pointerId` 的 down/up/cancel 属于一次触摸生命周期；不同 pointerId 不得相互代替。`cancel` 不等于成功 `up`，不会产生 Swipe。

Swipe 的方向由绝对位移较大轴决定，`abs(dx)>=abs(dy)` 时左右优先；否则上下。小于最小距离或超过最长持续时间不发出动作。当前是按 down/up 识别的第一版，不支持复杂画线轨迹、手指速度模型和手势冲突竞技规则。

## 2. InputTrace 的确定性顺序

Trace 须关联 `gameId`、`gameRevision`、`tickHz`、`seed`、`coordinateProfile:viewport-top-left-v1`、`inputNormalizerVersion:0.1.0` 以及 recognizer 版本。每条事件必须有 `tickIndex`、`timeUs`、`seq`、`source`、`kind`、`payload`。

- 固定 `tickHz` 的第 `n` 个逻辑 Tick 接受 `timeUs` 落在半开区间 `[n*1e6/tickHz, (n+1)*1e6/tickHz)` 的样本。端点严格属于下一 Tick。
- 事件按 `tickIndex` 升序；同 Tick 的 `seq` 必须严格递增。批内输入由 `(timeUs,seq,source)` 排序。跨 Tick 的 `seq` 可以重置；给定 Trace 重放输出仍必须一致。
- 所有包络、版本、游戏身份、事件顺序和事件 Tick 归属检查必须在启动 Session 前完成。归一化具体载荷由 Tick 处理时进一步校验；不对未经完整语义校验的任意 Trace 承诺不会发生任何状态改变。
- Trace 最多 4096 个输入样本；不匹配游戏/版本/输入参考系则拒绝，不能自动猜测转换。
- `InputTrace` 回放是测试工具，不默认录制真实用户的 Touch/IMU 数据，不能未经授权持久化或上报传感器轨迹。

## 3. 参考样例

`A2Game-V0.1-Spec/samples/tests/grid-push-swipe.input-trace.json` 包含两段 Swipe：第 10 个 Tick 向右移动、第 27 个 Tick 向上推动箱子到目标格。输入事件顺序、超时、cancel、短距离和指针身份均有自动化测试。

`replayNormalizedInputTrace()` 会生成 `InputTraceReceipt{advanced, finalHash, finalStatus, consumed}`。实测该样例 `advanced=28`、`consumed=4`、`finalStatus=won`，其 `exactHash` 在 Node 与 Chromium 一致。

## 4. 未覆盖及下一步

没有实现真实 IMU Tilt/Shake 识别、设备姿态校准、传感器权限和缺采样处理。`IMU` 当前仅做归一化结构合法性检查，**不得**在 Capability Registry 中将尚未实现的 IMU 手势注册为支持。

浏览器演示只采集 DOM Pointer 事件并交给 Headless；`InputTrace` 合成回放不等于移动端真机 Touch 验收。后续要增加真实设备轨迹采集、样本时间基准转换、录制显式授权、长轨迹降采样、多点 Pinch/Rotate、`pointercancel` 与焦点切换恢复测试。
