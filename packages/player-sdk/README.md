# Player SDK：把游戏放进自己的网页

这个SDK让业务网页加载并运行已经检查过的游戏，无需携带整个A2Game仓库，也不在游玩时调用AI。它目前是**试用接口**，还没有作为稳定的npm包发布。

## 1. 打包前准备什么

在A2Game开发工作区准备好Node、项目依赖、Python格式检查环境，以及锁定版本的真实引擎SDK。先执行`npm run build`生成最新`dist/`；打包脚本不会自动编译或安装依赖。

构建时需要这些工具，最终浏览器运行时不需要Python或Generator服务。

## 2. 生成播放器目录

从仓库根目录执行：

```powershell
node scripts/package-player-sdk.mjs games/phase2/sokoban/01-first-light/game.json
```

命令会打印一个新的`output/player-sdk-<时间>-<随机值>/`目录。之后：

1. 复制整个目录到网页的静态文件服务中，保持目录结构。
2. 通过HTTP访问`/player/index.html`，不要直接双击本地HTML文件。
3. 读取说明后点击开始，可以切换Three.js或CocosAirJS。

静态服务需要返回正确的`Content-Length`（文件长度）。每份输出保留打包时的代码和内容；以后修改仓库，不会自动更新旧目录。

## 3. 示例支持什么操作

页面根据游戏声明生成标题、按钮和键盘绑定，支持点按、按住、松开、暂停、继续、重开和关闭。没有在游戏中声明的快捷键不会自动添加。

暂停、重开和关闭会清除持续输入；继续后需要重新按住按键。触屏按钮可按住，但不代表已实现全部触摸手势、传感器或手柄输入。

CocosAirJS在同一页面中只能初始化一次，包括关闭之后。需要新实例时，重新加载页面；示例切换引擎也通过重新加载完成。

## 4. 业务代码有哪些接口

入口示例：[example.mjs](../../examples/embedded-player/example.mjs)。

| 接口 | 用途 |
| --- | --- |
| `load(bundle)` | 加载该分发目录允许的游戏内容 |
| `start()` | 开始游戏 |
| `pause()` / `resume()` | 暂停 / 继续 |
| `restart()` | 从头开始 |
| `action(id)` | 点按一个动作 |
| `press(id, source)` / `release(id, source)` | 按住 / 释放某个输入来源 |
| `cancelInputs()` | 取消持续输入 |
| `getInfo()` | 读取标题、操作名称和键盘绑定 |
| `status()` / `diagnostics()` | 查看运行状态 / 资源检查信息 |
| `dispose()` | 关闭实例并等待清理 |
| `onEvent` | 创建时接收状态、错误和关闭通知 |

持续触发沿用GameSpec的`keyboard.button hold`设置，最多64个持续输入来源。不同来源分别释放，避免松开一个按钮就错误取消其他来源。

调用`dispose()`后，状态先变为`disposing`，待加载和适配器清理结束才成为`disposed`。加载失败的实例会关闭；再次加载需要新建实例，CocosAirJS仍需遵守重新加载页面的限制。

## 5. 怎样更新游戏

打包命令支持三种JSON：`a2game`游戏定义、`a2game-release-bundle`运行内容包，以及`a2game-generator-package`生成工具导出的包。

对于生成工具包，脚本只读取`files.content`里的运行内容，不验证或交付解法、来源声明、测试结果和GamePlan等其他信息。

**换游戏或修改JSON后，必须重新完整检查并打包。** 当前SDK绑定一个确定的内容包，不能直接接收任意新JSON，也不是在线更新系统。保留旧输出目录，新版本生成到新目录。

## 6. 检查和信任范围

打包时检查完整JSON格式、能力、语义和资源策略。浏览器加载时核对整个运行内容包的SHA摘要，再检查资源长度和摘要。

播放器使用自己的JSON副本，大小不超过1 MiB；调用方在加载后修改原对象，不会改变实际运行内容。`build-inventory.json`列出打包文件摘要，`trusted-bundle.mjs`保存允许加载的内容摘要。

摘要用于发现内容变化，不能认证作者。如果SDK、页面或摘要文件本身被替换，也不能依靠这些摘要保证安全。应保护整个分发目录和传输，并核对第三方素材/SDK许可；本仓库为UNLICENSED，复制依赖不代表取得商业发布许可。

SDK来源见分发目录的`player/vendor/sdk-provenance.json`，共享物理库版本见仓库`project/sdk-lock.json`。

## 7. 已验证和未验证的内容

已在仓库外通过普通HTTP运行示例。CocosAirJS会拦截画布键盘事件，示例已改为捕获阶段监听；修后双SDK的持续移动、开火、松键、多来源输入和暂停清理通过。该检查不是最新版游戏整局验收。

输入与关闭记录见本地`reports/phase2-sdk-held-air-20261108/fixed/browser-summary.json`；原失败保留在同目录上一级。较早的资源加载失败与在途初始化关闭记录见`reports/phase2-sdk-20261108-resources-f2c4/browser-summary.json`，只代表当时的代码版本。

当前不包括完整手势、IMU、手柄、录制、参考播放器附加音效和动画。自动追帧超限会暂停并报告`A2G_E_CLOCK_STALL`，用户可以选择继续。受管资源清理不代表引擎全局缓存或全部GPU资源归零，也不构成移动端或商业发布承诺。
