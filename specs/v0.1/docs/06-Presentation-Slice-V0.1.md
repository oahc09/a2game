# A2Game `scene2d` V0.1 · 声明式表现子集（增量规范）

状态：**V0.1 附加 Profile；Headless/Canvas2D 已验证；2026-10-24 四份参考 JSON 的真实 AIR/Three G2 已通过。** 现行回执见 `../../../reports/g2-cocosairjs-real.json`、`../../../reports/g2-threejs-real.json`，不包含尚未声明的 Sprite/Mesh 等扩展或移动真机。

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

### 3.1 已有 BodyLayer 与验收参数说明（2026-10-27，文档澄清）

后续版本已加入的 `scene2d.bodyLayer` 仍按 [13 号规范](13-Realtime-World-V0.1.md) 读取 `WorldBody[]`。`statePath` **相对于 `SessionObservation.state`，必须直接指向 Body 数组**，例如世界对象存于 `/world`、Bodies 存于其 `bodies` 字段时，应引用 `/world/bodies`；不能引用整个 `/world` 对象。每个 Body 必须具有合法的整数 `x/y/hx/hy` 与 `kind`，`palette` 为 actor/solid/target/projectile/pickup 提供颜色；`unitsPerMeter:1000`、`origin` 继续使用场景中心原点和 Y 向上坐标。此说明不增加 API、不放宽既有校验。

2026-10-31 兼容增量：声明 `a2game.visual.body-style` 且 `showValues:true` 时，可选 `minValueFontSize` 与 `minValueBodySize`（逻辑单位，大于 0 且不超过 2）。前者是正值标签的最小字号，后者是正值实体绘制形状的最小直径或边长；不改变碰撞体、输入范围、状态或 Hash。未设置时沿用原有尺寸，无正值的实体不受最小形状尺寸影响。较大的标签仍应检查遮挡、视口缩放和文本宽度。

表现布局应将完整棋盘、标题与目标置于 `[-width/2,width/2] × [-height/2,height/2]`，包括文字尺寸和图形半径；字体大小为逻辑单位，应考虑缩放后的实际可读性。只显示部分棋盘或原始 true/false 不代表质量通过。

操作说明应解释目标、输入及规则；益智关卡不应在初始画面直接列出完整获胜操作顺序。消除后的编号、遮挡层与结束反馈应保持可读，不能仅以场景非空或逻辑获胜作为完整质量验收。

Conformance 使用观察路径 `/flow/status` 断言 `won` 与独立负例的 `playing/lost`。按 [04 号规范](04-Conformance-Test-V0.1.md) 与现有执行器，`assertEvent` 需要 `eventType` 和**整数 `count`**，可选 `sinceTick`；不提供 `count` 不等于“至少发生一次”。不知道精确事件次数时，应选择可复现的状态/终局断言，不猜测事件数量。

## 4. Host 适配

- `CanvasPreviewAdapter`：Canvas2D 参考实现，Chromium 实际绘制验收；非 G2 目标后端。
- `ThreeAdapter`：将矩形/圆形映射到 MeshBasicMaterial/Geometry，文字映射到 CanvasTexture；真实 SDK 四样例已通过。文字按测量尺寸创建纹理；按指令绘制次序呈现，context loss 后清理并重建绘制资源。
- `CocosAirAdapter`：使用 CocosAirJS Scene、createUICanvas、Graphics 和 Label，启动时使用 `screenMode:container`；真实 SDK 四样例已通过。矢量与文字保持指令顺序，按容器尺寸适配；`close()` 的保留资源及重载要求遵守上游契约。
- 三个适配器输入均为同一 `PresentationFrame`，不得因具体游戏创建特殊绘制路径。
- 动态文字纹理、渲染目标、材质和节点的对象所有权必须由各适配器管理并在 `dispose()` 时释放。

## 5. 历史证据与下一步

初始基线：4 份 JSON 样例均可投影为非空的限额内指令，且投影前后 `exactHash` 不变。Chromium 4 款真实 Canvas2D 截图和 Touch Trace 第五种回放状态均已产生；与 Node `exactHash` 的 5 组对照一致。该历史基线不包含真实 SDK；2026-10-24 的独立真实 G2 见上述回执。

后续 `Sprite/Texture/Mesh/Camera/Animation/Particle` 应作为新的、版本化的 Capability，不能无版本地扩大这个有限 `scene2d` 字段的语义。
