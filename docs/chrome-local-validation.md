# 本机 Chrome 验收基线

2026-11-04 已使用本机安装的 Chrome `156.0.8078.74`，可执行文件 `C:/Program Files/Google/Chrome/Application/chrome.exe`，完成G01/G03各自Air/Three双SDK的4组浏览器迁移工程复核。不是Playwright随附Chromium的结果，也不是新模型生成；未读取用户Chrome配置目录，使用新的独立浏览器上下文。

已观察桌面→390px→320px→桌面，以及通关后320px的真实动态缩放，未出现WebKit的画布空白。键盘解法逐步Node/Host Hash、暂停冻结与恢复进度、重开、按住输入时重开清理、终局输入不改变玩法状态、对象/监听器释放及预览关闭通过。原候选JSON未改，原WebKit失败不覆盖。

无头Chrome跨标签切换没有产生预期的失焦暂停，首次复核因错误地假定会失焦而中止；该失败保留。后续仅将该项登记为 `NOT_VERIFIED_FOCUS_NOT_DELIVERED`，不注入程序blur事件冒充真实失焦，不把工程汇总PASS当该项通过。人工质量、完整模拟profile和正式G3不因此升级。

## 使用现有 Chromium 驱动入口

读取 `browserLaunchOptions()` 的Chromium脚本支持本进程环境变量：

```powershell
$env:A2GAME_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/mcp-smoke.mjs <已有候选目录>
```

实际结果应记录 `browser.version`、`browser.executablePath` 和 `selection=EXPLICIT_LOCAL_EXECUTABLE`。此变量不改变模型、SDK或用户浏览器配置；不要把WebKit启动驱动指向Chrome文件。未提供路径时，脚本仍使用其原默认浏览器，不得将其自报为本机Chrome。

后续单元的Chrome方法单独记录版本和适用范围，可以恢复动态视口检查；历史单元不回签，其他浏览器分开计数。原模拟profile中的Linux WPE条件仍未验证，不能以Chrome替代。原始材料保留在本地忽略目录 `reports/chrome-validation-20261104/`（首轮失焦断言失败）和 `reports/chrome-validation-v2-20261104/`（4组工程复核）。
