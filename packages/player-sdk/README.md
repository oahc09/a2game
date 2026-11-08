# Player SDK 本地试用切片

这是实验性接口和本地分发工具，不是稳定 API、npm 发布或完整 M3 验收。需要 Node、项目现有依赖、Python 完整 Schema 环境、已构建 `dist/` 和按项目锁准备的真实 SDK。打包前确保 `dist/` 与当前源码一致：脚本复用现有编译产物，不自动编译或安装依赖。

```powershell
node scripts/package-player-sdk.mjs games/phase2/sokoban/01-first-light/game.json
```

命令在 `output/player-sdk-<时间>-<随机值>/` 创建新目录并打印位置。每次目录是构建时源码及适配器的独立快照，之后的源码更新不会改变旧目录；`build-inventory.json` 记录快照文件摘要。可将整个目录复制到仓库外，用普通静态 HTTP 服务提供该目录，访问 `/player/index.html`。无需 Python、仓库、内容服务或 iframe；HTTP 服务必须提供正确的文件长度。随附示例从已准入游戏读取标题、按钮及声明的键盘绑定，加载后先读说明，再点击开始。支持 Three.js / CocosAirJS、键盘与鼠标/触屏按钮的按住/松开、多输入来源、暂停、恢复、重开和销毁；没有声明的快捷键不会自动添加。CocosAirJS 按上游单文档约定，一页只能初始化一次，包括销毁后；新实例需重新加载文档。

可传 `a2game` GameSpec、`a2game-release-bundle` 或 `a2game-generator-package` JSON。前两者分别调用现有完整内容准入或接收端 bundle 重新准入。generator-package 只提取其中的 `files.content` release-bundle 并以同样方式重新准入；不会验证或交付其解法、来源、测试、game-plan 和其他生成元数据，也不把发送方的摘要、回执或作者声明当作认证。每次打包都重新运行完整 Draft 2020-12 Schema、Capability、语义和资源策略。任意新 JSON 都必须在可信构建环境重新准入和重新打包。

生成的 `trusted-bundle.mjs` 固定整个规范化 release-bundle 的 SHA；播放器先创建不超过 1 MiB 的自有 JSON 快照，对该快照校验摘要并在后续加载中使用，再用现有 ResourceScope 验证本地资源长度和 SHA。调用方在 `load` 返回后修改传入对象不会改变待运行内容。可信边界是完整分发目录和提供它的宿主；如果攻击者能替换 SDK、信任锚或页面，摘要不能认证内容、作者或分发方。部署者必须保护分发目录和传输，审核第三方 SDK 及素材的来源和许可；本仓库为 UNLICENSED，复制依赖不代表取得商业发布许可。SDK 来源摘要见分发目录的 `player/vendor/sdk-provenance.json`，共享物理库锁见仓库 `project/sdk-lock.json`。

应用入口见 `examples/embedded-player/example.mjs`。接口提供 `load(bundle)`、`start()`、`pause()`、`resume()`、`restart()`、`action(id)`、`press(id, source)`、`release(id, source)`、`cancelInputs()`、`getInfo()`、`status()`、`diagnostics()`、`dispose()` 和 `onEvent` 状态/错误/销毁通知；应用需要自行实现按钮和键盘输入。`dispose()` 返回的 Promise 等待在途加载结束及适配器释放；期间 `status()` 为 `disposing`，结束后才变为 `disposed`。调用失败的 `load` 会关闭实例；重新尝试须创建新实例。CocosAirJS 初始化曾发生时也须重新加载页面。API 当前覆盖按钮的点按和持续输入，是否连续触发沿用 GameSpec 的 keyboard.button hold 声明；每个来源独立释放，最多64个持续来源。暂停、重开和销毁会清空持续输入，恢复后需重新按住。示例按钮支持指针按住，但不代表已集成 touch 手势协议；传感器、手柄、录制、画面运动、额外音效及参考 Player 的业务 UI 未集成。自动追帧超限会暂停并上报 `A2G_E_CLOCK_STALL`；用户可选择恢复。SDK 并不提供 AI 生成、动态准入、线上更新、移动端或商业许可承诺。

## 本轮实际验证

`reports/phase2-sdk-held-20261108/browser-summary.json` 记录脱离仓库、普通 HTTP 下的 Three.js 持续移动/开火、释放停止、多来源、暂停复位和销毁，以及 G01 点按通关。只读状态采样用于断言，未注入状态；不是独立盲玩。随后定向补测发现 CocosAirJS 会在 canvas 目标阶段 stopPropagation，导致示例的冒泡键盘监听无效；已改为捕获阶段。原失败保留在 `reports/phase2-sdk-held-air-20261108/browser-summary.json`，修后两个真实 SDK 的持续移动/开火、释放、多来源与暂停复位记录在 `reports/phase2-sdk-held-air-20261108/fixed/browser-summary.json`。此处只验证输入与生命周期，不代表新版 Boss 整局双端验收。较早的双 SDK 资源与在途加载销毁证据见 `reports/phase2-sdk-20261108-resources-f2c4/browser-summary.json`，它属于当时源码快照，不等同最新版本全量通过。
