# 第二阶段作品与交付入口

这些作品用于推进游戏质量和客户端交付。它们有可玩内容和实际运行记录，但来源为 Cindy 主审或 native subagent 作者修订，不能代称 Qoder、WorkBuddy、TRAE 独立生成、正式 G3 或真机验收。

从仓库根目录运行，需已有依赖、构建产物及锁定的真实 SDK：

| 作品 | 启动 | 当前体验范围 |
| --- | --- | --- |
| [暖光仓库](sokoban/README.md) | `node scripts/serve-collection.mjs games/phase2/sokoban/collection.json` | 三关、撤销、重试、进度；双 SDK 引导通关，Agent 单端试玩 |
| [光弧巡游](shooter/README.md) | `node generator/cli.mjs preview games/phase2/shooter --backend three --ready` | 纵版射击、持续输入、成长与Boss引力阶段；最新Three修反应窗，旧Air整局保留，快照与暂停范围见作品说明 |
| [港湾守望](turret-defense/README.md) | `node generator/cli.mjs preview games/phase2/turret-defense --backend three --ready` | 熔炼、购买、合成、升级与三波防守；Three 正常时钟引导通关 |

使用命令打印的 URL。`--ready` 会先暂停读屏，点击开始后才推进；工具栏也可重开并准备。切换 Air 使用 `--backend air`。玩完关闭浏览器，并在命令行 Ctrl+C 关闭预览。保护暂停后，点击继续并重新按住持续操作键。各作品 README 保留具体失败与未验范围。

创作主题见 [素材目录](../../project/creation-library.json) 和 [使用说明](../../docs/creation-library.md)。Agent 先读公开能力合同，将主题参数落实为合法 GameSpec，再通过已有完整准入；主题不是运行插件。

## 嵌入与后续更新

1. [独立 Player SDK](../../packages/player-sdk/README.md)：对受审内容打包，将输出整个目录交给普通 HTTP 服务；客户端不需要本仓库、Python、Generator 服务或 AI。页面按声明生成按钮和键盘映射，提供明确开始、暂停、重开和销毁。当前是实验接口。
2. [本地版本交付](../../packages/content-delivery/README.md)：保留 v1/v2，拒绝覆盖及篡改，接收端重新完整准入并可回退。它不等于线上发布或客户端热更新。
3. [Android WebView 示例](../../examples/android-webview/README.md)：将一个可信 SDK 分发目录编入 APK。已有未签名构建和资源摘要检查；尚未在设备运行，不据此保证 WebGL、触屏、音频或生命周期。

每份分发输出都是当次构建快照。不要覆盖旧目录来更新证据；新内容须重新准入、重新构建。素材许可、第三方 SDK 许可及分发宿主安全边界见相应说明。最新真实进展以 [第二阶段计划](../../docs/A2Game-Game-Creation-Delivery-Phase2.md) 和 [状态台账](../../project/status.json) 为准。

基础3D道具的可操作展示：[林间小站](stage-props-garden/README.md)。它演示受审树/岩石/货箱的创作时组合，只复用两次collect，不计第四款完整游戏。
