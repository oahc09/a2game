# G17 宿主表现副本：窄屏与终局提示

规划模式的原始模型输出在游戏进行时绘制两条与背景同色的终局文字，两个 SDK 都留下暗色轮廓。该原稿及其 Benchmark 评分保持不变。这里生成一个明确标记的宿主表现副本：移除两条画布终局文字和重复的 HUD 说明，增大画布字号并调整行距；胜负由播放器现有的「本局进度」和结果说明显示。副本仅修改表现和 revision，不改变输入、状态、规则、玩法、解法或 Conformance。

以保存的原始产物为输入，可重建并复验（生成目标必须不存在）：

```powershell
$env:PATH = (Join-Path (Get-Location) '.venv/Scripts') + ';' + $env:PATH
node scripts/refine-g17-presentation.mjs
node scripts/check-g17-presentation.mjs <上一步返回的副本目录>
node scripts/generator-game-review.mjs <上一步返回的副本目录> --assert-hud
```

构建器检查原始游戏、解法和测试的 SHA，与模型生成回执相符后才建立新目录；对两份游戏运行相同解法和 4 项 Conformance，逐项对照状态 Hash。生成过程不调用模型，也不覆盖原始输出。

本次副本在 `output/g17-host-visual-5348a9c4-b5ae-4a3d-a51d-6e9bd95b04fc/`。[320px 双 SDK 回执](../reports/g17-visual-6e1f8d2e-8f45-454e-b496-16dde2650db4/summary.json)检查四向屏幕按键、开火、胜负、暂停、重开、无横向溢出、44px 按钮和零资源释放，屏幕按键使用浏览器模拟输入；最小画布字号约 16.56 CSS px，先前为约 12.74 CSS px。原始 Playwright 技能客户端在两端的短动作及文本状态记录见同目录 `skill-client.json`。[桌面和 390px 双 SDK 回执](../reports/generator-game-review-afde13f1-fc9b-4d47-9d30-ea6cdaf94201/summary.json)覆盖实际键盘及屏幕按钮、模型解法、闲置失败和释放。已查看两端进行中及终局截图。

这是宿主副本的局部参考验证：320px 胜负反馈在画布下方，可能需要滚动；完整视觉质量、人工体验、真实设备、模型原稿质量和正式 G3 均未升级。
