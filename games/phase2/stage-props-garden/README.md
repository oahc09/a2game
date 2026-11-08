# 林间小站：3D 道具展示

这是 `visual.stage` 的互动展示，复用现有 `collect` 玩法：按空格或“收集”两次，让小光球移动并结束。它不是完整新游戏，也不是独立模型生成或人工质量验收。

树、岩石、货箱是本次 Cindy native subagent 原创的基础几何组合，授权 CC0-1.0，源预设位于 `assets/themes/woodland-props-3d.json`。它明确是 **AUTHORING_PRESET_NOT_GAMESPEC_EXTENSION**：Agent 在创作时读取数据，对节点 ID 加唯一前缀、将每个 `at` 平移到所需位置，再把合法节点数组内联到 GameSpec 的 `presentation.stage.nodes`；预设自己的 `format`、`props` 等字段不能放进 GameSpec。组合使用既有 box/sphere 与 standard 材质，没有模型文件、运行时脚本、扩展字段或外部资源；不把主题 JSON 作为游戏资源使用，也不绕过审核。`build.mjs` 仅为作者一次性展开工具，会拒绝覆盖已存在的三件套。

GameSpec 声明 `a2game.visual.stage@0.1.0` 和 `scene2d`，现有 Three.js 与 CocosAirJS 适配器都实现该合同；本次只用真实 Three.js 验证，CocosAirJS 在此内容上为 NOT_RUN。使用现有 Generator/内容服务重新完整准入后，可选择 Three 或 Air 预览；前提是接收方拥有相应可信能力和 SDK。可视化、输入与资源释放证据见本次独立报告，不等于双端全覆盖、独立盲玩或 M2 素材库完成。
