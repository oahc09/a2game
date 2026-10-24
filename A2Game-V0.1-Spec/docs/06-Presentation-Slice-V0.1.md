# A2Game `scene2d` V0.1 · 声明式表现子集（增量规范）

状态：**V0.1 附加 Profile；已在 Headless/Canvas2D 验证，真实 AIR/Three G2 未验证。**

## 1. 协议边界

`GameSpec.presentation.scene2d` 是只读表现定义，不是第二份玩法状态，也不是宿主原生 Scene。它将 `GameSpec` 的静态数据及运行时 `SessionObservation.state` 投影成 `PresentationFrame`，再由宿主绘制。游戏逻辑在 `HeadlessRuntime` 内执行，任何 Renderer 不得回写规则状态。

必须声明 `requires.all` 中 `a2game.visual.scene2d@0.1.0`。没有 `scene2d` 的旧 `GameSpec` 仍可通过语义编译，但调用 `projectPresentation()` 将明确报错。无需修改旧版 `specVersion: 0.1.0`。

数据路径：`GameSpec JSON -> full Draft 2020-12 preflight -> compileGame semantic checks -> HeadlessRuntime.observe() -> projectPresentation() -> PresentationFrame -> RenderAdapter`。

## 2. 数据结构与规范化

根结构：`{ "width": positive, "height": positive, "background": "#RRGGBB", "nodes": [...], "repeat": [...] }`。

- 坐标 `at` 为 `[x,y]`，中心原点，**Y 向上**，单位为当前场景逻辑尺寸；`width/height` 为正数，不代表物理像素。
- 静态节点 `kind` 仅允许 `rect`、`circle`、`text`，均要求唯一、合法的 `id`、`at`、`fill`。矩形要求 `size`、圆形要求 `radius`、文字要求 `text` 与 `fontSize`。
- `fill` 为 `#RRGGBB`，或者 `{"from": <binding>, "map": {"key":"#RRGGBB"}, "fallback":"#RRGGBB"}`。
- `DataBinding` 为 **三选一**：`{"state":"/field[/subpath]"}`，`{"item":true}`，`{"literal":jsonValue}`。`state` 顶层字段必须存在于 `GameSpec.state`，禁止插入 JavaScript/代码字符串执行；深路径在运行时解析，值必须符合使用者期望的数据类型。
- `omitWhen` 仅可用于 `text`，匹配标量后跳过该文本。
- `repeat` 指定 `source`、`columns`、`origin`、`step`、`indexMode` 及 `template`。`array` 以数组索引确定网格位置；`cell` 以元素数值作为展平格子索引，适合玩家/箱子/障碍的动态分布。
- 对于 `cell`，坐标为 `x=originX+(cell % columns)*stepX`，`y=originY-floor(cell/columns)*stepY`。
- 展开后的 `DrawCommand` 必须保持定义次序及唯一实例 ID，例如 `boxes[0].crate`。渲染器必须按指令顺序绘制，不得根据游戏 ID、状态字段名或类型自行套模板。

## 3. 上限及拒绝条件

- `nodes` 至多 128；`repeat` 至多 16；每个 `template` 包含 1～8 个节点；每个 `repeat` 至多处理 256 个元素；每帧至多 640 条绘制指令。
- `cell` 必须是 `0..4095` 内的非负整数；坐标、尺寸必须为约定范围内有限数；重复 ID、非法填色、未知绑定、未知字段一律拒绝。
- 演示中不得执行来自 JSON 的 `eval`、`Function`、脚本 URL、任意网络请求或浏览器 DOM 命令。

上述上限是 **V0.1 Presentation 子集约定**，并不声称已覆盖粒子、模型、骨骼、图片、Shader、HitTest 或物理。

## 4. Host 适配

- `CanvasPreviewAdapter`：Canvas2D 参考实现，Chromium 实际绘制验收；非 G2 目标后端。
- `ThreeAdapter`：将矩形/圆形映射到 MeshBasicMaterial/Geometry，文字映射到 CanvasTexture；此轮仅完成 Mock API/释放契约验证，缺真实 Three.js SDK 验收。
- `CocosAirAdapter`：使用 CocosAirJS Scene、createUICanvas、Graphics 和 Label，启动时使用 `screenMode:container`；此轮仅完成 Mock API/释放契约验证，缺真实 SDK 验收。
- 三个适配器输入均为同一 `PresentationFrame`，不得因具体游戏创建特殊绘制路径。
- 动态文字纹理、渲染目标、材质和节点的对象所有权必须由各适配器管理并在 `dispose()` 时释放。

## 5. 本轮证据与下一步

4 份 JSON 样例均可投影为非空的限额内指令，且投影前后 `exactHash` 不变。Chromium 4 款真实 Canvas2D 截图和 Touch Trace 第五种回放状态均已产生；与 Node `exactHash` 的 5 组对照一致。真实 SDK 和 UI 命中交互不属于这项验收。

后续 `Sprite/Texture/Mesh/Camera/Animation/Particle` 应作为新的、版本化的 Capability，不能无版本地扩大这个有限 `scene2d` 字段的语义。
