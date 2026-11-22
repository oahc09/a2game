# Visual Stage 0.1.0

`a2game.visual.stage@0.1.0` 是独立、版本化的只读表现能力，依赖既有 `a2game.visual.scene2d@0.1.0`。GameSpec 协议保持 `0.1.0`，新增 `presentation.stage`，旧 `scene2d` 语义和样例不变。完整结构见 `game.schema.json#/$defs/visualStage` 与能力 Manifest。

## 表现合同

2026-11-14音频修正：PresentationFrame中的音频key按cue ID与逻辑eventId稳定绑定，不包含当前观察Tick。宿主记住已消费事件，避免历史事件在后续Tick重复播放；用户解锁前的事件只消费不补播，同帧同cue合并，Tick回退/重开清空消费缓存，dispose释放缓存与原生音源。此修正不改GameSpec或逻辑Hash。

- `scene2d` 继续提供背景尺寸与 HUD；`stage.camera` 提供透视/正交相机、位置、目标、裁剪距离、FOV 和正交高度。中心坐标、右手 Y 向上，角度为弧度；Host 转换为 SDK 单位。
- `nodes` 最多 128 个，支持 `sprite` 和 `mesh`。Mesh 为 box/sphere/plane，Sprite 使用经过审核的 image 资源。尺寸为正 vec3，位置为数字或顶层数值状态 JSON Pointer。资源逻辑 ID 必须存在且类型匹配。
- 可信材质预设为 `unlit/standard`：分别使用原生无光照/PBR 材质与 Shader，不执行来自 JSON 的脚本或 Shader 源码。未来材质扩展需单独注册 Capability。
- `rotation + spin × tickIndex/tickHz` 产生只读动画姿态。暂停时逻辑 Tick 不变，动画随之冻结；重开和快照恢复自然回到相应姿态。Host 的原生渲染时钟不推进玩法。
- 粒子最多 8 个发射器、总计 128 个。位置由索引、声明参数和逻辑 Tick 确定，不消耗游戏 RNG，不回写逻辑状态。当前为有界的 CPU 投影和原生 Mesh 绘制，未声明复杂粒子编辑器或骨骼动画支持。
- 音频引用审核的 audio 资源，按规范化 Runtime 事件触发；每条 cue 每 Tick 最多播放一次，需要用户手势解锁。暂停、失焦、context loss 停止/暂停当前 cue，不在恢复时自动重放旧事件。

`PresentationFrame.stage` 包含规范化 Camera、节点变换、音频 cue 和 Tick。它不进入 exact logical hash；相同 Runtime 操作仍由 Node 与两 Host 的 exactHash 对照。暂停会按既有协议清空输入源缓存，因此恢复必须与 Node 的同一暂停/继续序列比较，不能假设哈希等于暂停前。

## 真实 Host 与资源所有权

Three.js 使用原生 Scene、Camera、Mesh/Texture/Material、Light 和 Audio。CocosAirJS 使用原生 Scene/Camera/MeshRenderer/Material/Texture2D/AudioSource，HUD 由 UI Camera 叠加。两端共用同一 Canvas，各自仅有一个 SDK 渲染器；没有以 Canvas2D 模拟 SDK 画面。

稳定节点复用资源，仅更新姿态；适配器拥有并释放自己的网格、材质、纹理和音频节点。资源作用域保留验证后的字节和位图，适配器释放后关闭位图、撤销 URL。Three.js context loss 后重建 GPU 资源并显式继续；AIR 依上游契约受控重载。原生共享缓存/AudioContext 不作为单实例所有资源销毁，不声明引擎总内存零泄漏。

Canvas2D 预览明确拒绝 Stage，提示选择真实 Three.js/CocosAirJS。当前示例可通过“导入游戏 JSON”加载 `games/visual-stage.game.json`；完整准入 Profile 为 `trusted-reference-host-v1`。旧 Profile 记录保留，重新导入后完整校验升级。

## 验收

`npm run stage:e2e` 验证透视投影；`node scripts/content-browser.mjs --stage --orthographic` 验证正交/2.5D。每个场景在两个真实 SDK 检查输入、Node Hash、动画实际像素变化、网格/纹理可见性、缩放、原生 AudioBufferSourceNode 与音频时钟、内容包、服务重启、context loss 和释放。Node 正反例与 `visual-stage.conformance.json` 分别核对纯投影与 Tick/暂停/重开。回执与能力覆盖见项目状态，真机与完整 Gameplay Gate 独立统计。

## 2026-10-27 正交范围适配

显式 `camera.fitSize:[width,height]` 仅用于 orthographic，两个正数不超过 1000。宿主使用实际 viewport aspect，完整高度取 max(orthoHeight, fitSize[1], fitSize[0]/aspect)，Three.js 使用全高，CocosAirJS 使用一半为 orthoHeight。未声明时保留原固定高语义。H05 设为 scene2d 宽高，使图片和同一 HitTest 框在桌面、390px 及缩放下对齐；图片以各 SDK 的纹理方向上传并启用 alpha。输入宿主在 pointerdown 捕获阶段以 preventScroll 聚焦画布，避免窄屏首次按压使页面滚动、拖动终点偏离。此项为纯投影，不改变逻辑 Hash。
## 相机数值绑定

当 Stage 声明 `bindingProfile: "numeric-pointer-v1"` 且要求 `a2game.visual.bound-stage@0.1.0` 时，`camera.at`、`camera.target` 的各轴也可使用数值指针与可选 `scale` / `offset`。校验初始值、每帧解析后的范围和相机位置与目标不重合。共享表现层在交给 Adapter 前解析为数值向量。未启用该 Profile 的相机使用固定数值向量。

G177 使用两个位置坐标和朝向生成相机位置及凝视点。墙体阻挡、转向和出口由 GameSpec 的共享 Tick 规则处理，双 SDK 读取相同的透视相机帧。[原型](../../../games/coverage-v2/g177-blue-rock-maze/game.json)
