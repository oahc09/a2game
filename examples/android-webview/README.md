# Android WebView 本地接入示例

这是用于验证接入方式的最小 Android 工程，不是已验收或可发布的 Android 客户端。需要本机 JDK、Android SDK 35、构建工具、Gradle/AndroidX 依赖，以及已完整准入并打包的可信 Player SDK 分发目录。例如从本工程目录构建：

```powershell
.\gradlew.bat --no-daemon assembleDebug "-Pa2gameSdkDir=E:/path/to/player-sdk-output"
```

`a2gameSdkDir` 指向分发根目录，须包含 `player/`、`dist/`、能力清单及 `build-inventory.json`；编译时把目录作为 APK 只读 assets，缺失时直接失败。使用新的游戏包需要重新准入、重新构建可信 SDK 并重新构建应用；这不是在线热更新，也不会自行签名、安装或发布。debug 构建故意不签名。分发目录、APK、AndroidX 和 SDK 依赖均需由集成方确认完整性与许可；本示例不通过 `build-inventory.json` 验证来源身份。

通过 AndroidX `WebViewAssetLoader` 将 APK 资源映射到保留域名 `https://appassets.androidplatform.net/app/`，内容不依赖本地 HTTP 服务、仓库或外网。自定义路径处理器提供 `Content-Length`，为 `.mjs`/`.js` 提供 JS MIME，并识别当前示例中的 PNG/WAV；单文件限制 16 MiB。没有 JavaScript 原生桥，也没有 `INTERNET` 权限；仅允许该本地源请求和播放器页导航，禁用 `file://`、`content://` 及混合内容。分发页面必须本身可信，校验摘要不是作者认证。

切出应用时请求游戏暂停并暂停 WebView；返回后不自动继续，用户需在页面中显式继续。销毁时请求 SDK 清理并销毁 WebView；由于 Android `evaluateJavascript` 是异步的，这不保证 SDK 的异步释放 Promise 已完成，系统资源回收和实际生命周期表现仍需真机验证。Activity 重建会从头加载，不保存游戏进度。

目前仅有工程构建，不将其当作运行验收：Android WebView 对本地 HTTPS 拦截、JS 模块、`Content-Length`、WebGL、输入、音频、暂停、销毁及内容更新的行为均需在设备或模拟器实际核对。没有真机时这些项目标记为 `NOT_RUN`，不以桌面浏览器结果代替。

本轮最终构建复用了已修复 CocosAirJS canvas 键盘传播问题的 SDK 分发 `output/player-sdk-2026-11-08T10-28-40-143Z-003682b9`（G17 revision4）。日志：`reports/phase2-android-20261108/final-input-build.log` 与 `final-input-apk-assets.log`。资源178项逐字节摘要核对，不代表在 Android 运行通过。
