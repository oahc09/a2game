# 当前宿主原创实跑：星隙快递（2026-11-07）

当前Codex宿主模型已走完GamePlan→原创GameSpec/Conformance/自解→CLI完整准入与修复→Air/Three真实浏览器输入→Node回放→内容包导出。额外Generator Provider调用0，没有运行fixture、切换模型或调用其他生成服务。此记录只覆盖这一款原创单关游戏，不升级正式G2/G3/verified，不代表所有自然语言任务或其他模型的生成质量。

作品是有限氧气的3×3路线解谜：方向移动取回蓝晶和琥珀，中央控制台按E开闸后返港；撞墙不耗氧，裂隙和耗氧会失败。原创布局、规则和9步解法在打开Player前已保存。未读取参考游戏JSON或解法文件；首次浏览器整页文本暴露了Player下拉目录中的参考描述，发生在原创稿冻结之后，后续只修HUD/显示状态/字号。共享仓库不是隔离创作区，`independentAuthoring=NOT_VERIFIED`，当前宿主路由未作独立身份认证。

## 产物和实际结果

- [GamePlan](../output/host-native-star-courier-20261107/design-plan.md)、[最终GameSpec](../output/host-native-star-courier-20261107/attempt-3/game.json)、[Conformance](../output/host-native-star-courier-20261107/attempt-3/conformance.json)、[作者解法](../output/host-native-star-courier-20261107/attempt-3/solution.json)。
- [内容包](../output/host-native-star-courier-20261107/star-courier.package.json)是`a2game-generator-package`，不是含Runtime/SDK的独立应用；使用方式见[交付说明](../output/host-native-star-courier-20261107/README.md)。
- 三个候选均完整准入/test通过；同一份5场景Conformance覆盖获胜/终局拒绝、岩壁/锁闸、裂隙判负、氧气耗尽和缺货到港不获胜。原稿和每次validate/test前的原字节、SHA、命令、退出码、stdout/stderr均保留，没有故意制造验证失败。
- 最终Air/Three各完成1100×900真实键盘+手动Tick、390×844正常时钟可见DOM按钮两条流程，共4条；成功/失败、暂停/恢复、重开、拾取、开闸、动态提示和资源/监听释放通过。两端启动正常，无被记录的console/page error。DOM按钮不计物理触屏设备。
- 每端22个实际操作状态采样，在Node各两个独立Session重放，共88次Hash匹配；两SDK同序22/22匹配。只比较同定义、同输入/同Tick结果，不将任意正常时钟的Hash作跨端比较。
- [最终截图目录](../output/playwright/star-courier-20261107/)含18张最终截图及旧稿/失败图；已查看Air窄屏获胜、Three过程和失败画面。390px名义最小字号Air约17.69、Three约17.65 CSS px，按钮高44px；这是测量辅助与Agent自审，不是独立质量评委或物理设备证据。现有Player窄屏布局需要滚动到控件/进度区。
- 最终两端SDK ownedNodes/ownedMeshes与资源作用域计数归零，监听关闭，两个预览URL实际关闭；不推定整个引擎缓存/GPU内存零泄漏。

## 原始失败与修复

1. 第1稿准入和逻辑测试通过，Air撞墙状态提示变化，但页面没有显示：`hud.bind.path`应为`bind.state`。保留`attempt1-feedback.stdout.txt`和截图；第2稿修正绑定，补显式耗氧说明及“已取/未取”文字。额外显示状态会改变Hash，因此重新取证，没有当作原Hash纯表现修复。
2. 第2稿390px最小名义字号约14.74 CSS px，实际图中格位和货舱文字偏小：第3稿将scene文字下限调到24逻辑单位。状态/输入/规则/胜负/Conformance/解法保持不变，已由脚本比较；新稿重新准入和双SDK试玩。
3. 首轮预览进程因未启用TTY，stdin不能接受关闭指令；第一次进程匹配也未匹配到实际PID。原记录保留，`preview-close-confirmed.json`另行核实自有进程终止与URL关闭；该轮不冒充正常server.close通过。第2、3轮使用TTY，均有真实显式关闭回执。
4. 首次最终Air检查误把`adapter.ownedResources`当作共同字段，脚本报FAIL；实际Air为`adapter.ownedNodes`，资源作用域为`resources.ownedResources`。原stdout/JSON及截图保留，修脚本后同一第3稿重测，未增加作品候选或隐去原失败。
5. 初始能力查询误用`a2game.input.keyboard`，通过目录发现真实`a2game.input.keyboard.button`；本机无独立playwright-cli入口，改用Skill包装器等价的`npx --yes --package @playwright/cli playwright-cli`。另有Windows换行导致一次结果解析失败，改解析脚本而非篡改浏览器输出。

共享工作区期间另一轮修改了`integrations/mcp/service.mjs`的Windows写入重试，故整仓聚合指纹与任务开始不同。本轮未改该文件，也未调用MCP；最终稿的CLI验证、两端操作及Node逐步回放均在该变更之后执行。不宣称整仓源码全程冻结，原始指纹与`cross-engine.json`中的false保留。Skill实测反馈更新又产生新的知识包SHA；创作时Skill与反馈后Skill分别绑定，不重签旧运行。

## 实测反馈进入Skill

更新现有workflow/quality/authoring/troubleshooting四份引用：动态HUD字段与可见文字断言、正常/手动时钟的互补证据、资源诊断所有权层级、Player目录暴露与创作前后SHA。同步五处已有项目/连接器副本并重新打包，未新增宿主配置、Runtime或协议改动；新版Skill本身尚未再用于另一款真实创作。

完整索引见[运行回执](../output/host-native-star-courier-20261107/receipt.json)，游戏和Skill新包指针见`project/status.json.nativeHostGameRun`。未运行整仓全量verify或远端CI；既有G3备证陈旧不由本次局部结果消除。未提交或推送。
