# 暖光仓库 / Lumen Depot

三关渐进推箱子：第一束光（引导绕行）、绕行之间（双箱换位）、三盏归灯（三箱留路）。方向键/屏幕按钮移动，Z撤销，R重试，P暂停/继续；移动缓动、可关闭音效、按内容SHA隔离的本地通关记录。没有计时压力。

启动（已安装项目依赖及锁定SDK）：

```powershell
node scripts/serve-collection.mjs games/phase2/sokoban/collection.json
```

打开 `http://127.0.0.1:8765/player/collection.html?collection=lumen-depot`。引擎菜单可选择真实CocosAirJS或Three.js。端口可用环境变量 `A2GAME_PORT` 调整。

每关的GameSpec、Conformance和解法独立存放。`build.mjs`是本作品的可复现作者工具：修改后会覆盖三关作者文件，重新提交候选前请冻结旧版本；它不是运行时、独立生成器或新测试框架。玩法由既有 `puzzle.push` / `puzzle.undo` 执行，界面只读观察和派发真实操作。通关后如要撤销，请先重试；终局输入沿用既有拒绝语义。

本作品为Cindy controller原创，非Qoder/WorkBuddy/TRAE原生生成；正常时钟、按作者解法操作的双SDK记录不等于盲玩质量或正式G3。当前证据：`reports/phase2-lumen-20261108/browser-summary.json`。

这是依赖项目服务的关卡播放器，**不是独立Player SDK**。移动动画、声音、本地进度是宿主体验，单关JSON导出只包含玩法与场景；独立交付这些宿主功能属于后续M3。

参考Player的iframe内外焦点切换已修复：点击画布后再用外层按钮不会因隐藏暂停而卡住。后台/窗口失焦保护代码保留；本轮headless标签未真正失去焦点，因此外部失焦负例未计通过。
