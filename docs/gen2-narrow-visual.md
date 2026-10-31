# GEN-2 窄屏表现优化

本次修复的是“双灯之锁”的字号与文案。以原始 Terra 产物为父版本创建明确标记的 `HOST_PRESENTATION_DERIVATIVE`：游戏规则、状态、输入绑定、时钟、胜负与原模型解法保持不变；只调整 `presentation`、玩家说明，`revision` 增加为 2。原始模型 JSON、两次失败、GEN-2 原始验收与视觉局限记录均保留，不把宿主修图后的结果计入模型独立视觉成绩。

改动：

- 设计画布由 390×680 调整为 360×420，重新安排目标、灯、机会与两行说明，文字设计字号至少 26。
- 390×844 画布上的最小文字按实际缩放由约 9.4 提升到 23.2 CSS px；320×568 下约 16.9 CSS px。标题、灯状态与操作说明均在可视边界内。
- HUD 改为“剩余 N 次机会 · 切换不扣次数”，不再显示 `chances/confirmed`。说明明确现有「向左/向右」按钮与左右灯的对应关系。
- 灭灯颜色稍提亮，保留灯名与亮/灭文字，状态含义不单靠颜色区分。

本地产物：`output/gen2-terra-narrow-v1-20261030/`；视觉配方：[gen2-terra-narrow-presentation.json](../project/gen2-terra-narrow-presentation.json)。重新构建需要原始 GEN-2 本地产物，不会从 fixture 或新模型调用重新生成：

```powershell
npm run generator:narrow:build -- <原始产物目录> <不存在的新目录>
npm run generator:narrow:check -- <优化产物目录>
npm run generator -- preview <优化产物目录> --backend air
```

构建脚本先检查原始游戏 SHA、逻辑字段不变、原版/新版解法逐步 Hash 与 3 个正反例，再执行完整可信准入，输出新目录与来源回执。验收脚本通过公开预览入口在两真实 SDK、320×568 / 390×844 / 1280×1050 检查初始、进行中、通关、失败、重开、中文 HUD、字号与文本边界、44px 按钮、原版/新版 Hash、资源/监听释放和控制台错误。窄屏按钮采用浏览器触摸模拟，不计真机。

两 SDK、三规格共 6/6 PASS_REFERENCE；另原样复用网页游戏 Skill 客户端完成两 SDK 通关并查看截图。汇总与最新回归见 [Generator 台账](../project/generator-status.json) 的 `visualRefinement`。结论限于窄屏视觉 AI 参考验收，人工手感、长期游玩、真机与正式 G3 保持独立。
