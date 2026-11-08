# 创作素材与可玩作品

先读真实能力合同，再选表现素材。MCP新增公开资源 `a2game://spec/0.1.0/creation-library.json`，工具仍为原有9个，不额外调用模型。资源是有界JSON及其SHA/字节数封装，沿用已有读取、白名单和路径限制。

首个条目 `warm-workshop@1.0.0`：暖色卡通推箱子图元，含墙、光圈、箱子、角色和配色。源文件 `assets/themes/warm-workshop.json` 已纳入 `project/asset-policy.json`，记录类型、来源、CC0许可、字节数和SHA。目录中有 `2d/puzzle/warm/cartoon/scene2d` 标签可供Agent筛选。

它是**创作时的JSON模板**：Agent将需要的图元复制到合法 `scene2d.repeat`，设置状态路径、原点、步长和颜色绑定，再走原有完整准入。模板含相对位置，不能直接当成完整GameSpec；不在JSON中执行脚本，不自行下载外网资源，也不把主题文件注册为Runtime插件。当前G01作者工具实际从该文件读取图元，不另维护第二份主题定义。

当前可用宿主反馈为 `motion=1` 的短缓动（尊重减少动态效果设置）和 `player/feedback-audio.mjs` 中由用户开启的8个固定UI声音预设（移动、推箱、撤销、重试、成功、合成、命中、错误），关卡页已接入。它们不是新的协议字段，也不在单关内容包中承诺存在。Sprite/3D素材包仍待实现；下面的可选事件反馈已提供有界粒子与固定音效映射，本条目不代表整个M2通过。

实际作品与启动：`games/phase2/sokoban/README.md`。导出三份现有格式的内容包：

```powershell
node games/phase2/sokoban/export.mjs
```

输出始终写入新的 `output/lumen-depot-<timestamp>-<unique>/`，逐份使用原有Generator完整复验，附manifest及SHA；已有输出不会被覆盖。接收方继续使用现有包导入并完整重验。关卡UI仍依赖项目服务，不是独立Player SDK。

本地源码/审核策略变化后，旧内容服务会按现有规则返回 `A2G_E_RELEASE_STALE`。关卡页会显示实际错误和“重新加载”，不再无限等待；先重启本地服务，再重新加载页面，不能绕过准入沿用旧环境回执。

## 参考播放器的事件反馈

新增 `player/event-feedback.mjs`，用户可用“事件特效”按钮或URL参数 `feedback=1`开启，默认关闭；声音仍需另行明确开启。复用已存在的combat.hit/death、defense.fired/reward/merged等事件，在声明的bodyLayer位置绘制短暂命中/死亡粒子、射击点线和合成闪光。位置不可知时不伪造；减少动态效果设置下不绘制。最多12个同时效果，并保持整个绘制帧不超过640指令，重开、关闭和销毁清理缓存。它不写玩法状态、不改Exact Hash、不新增GameSpec字段，也不随独立JSON内容包或当前SDK切片自动携带。

射击事件反馈已在双真实SDK正常时钟下核对，H01合成/射击在Three核对通过，均为作者引导输入，非独立质量。H01 Air两次出现AIR_E_ORTHO_WIDTH会话关闭，后续最短布局对照未复现，原因未定，失败记录保留；不能提升为Air反馈全通过。证据目录 `reports/phase2-feedback-20261108/`。

ThreeAdapter现按图元ID复用未变的GPU对象，仅位置变化不重建几何/材质/文字纹理。G17同一正常时钟引导脚本定向重跑通关，自动追帧暂停由旧记录约39次降到本次0次（保留1次主动暂停）；这是一条回归观察，不是跨硬件性能保证。见 `reports/phase2-three-reuse-20261108/`。

## 机体图元与客户端交付

`spaceflight@1.0.0` 与 `tidal-turrets@1.0.0` 分别提供飞机/敌机/弹丸、炮台/货艇的原创 CC0 图元，字节和 SHA 见同一受审目录。它们使用 `a2game.visual.body-motif@0.1.0`：将规范化模板内联到 `scene2d.bodyLayer.motifs`，大小随 body 半尺寸计算，`item` 绑定该 body 的 value；完整边界见 `specs/v0.1/docs/06-Presentation-Slice-V0.1.md`。未知/未配置 kind 沿用旧图元；无任意脚本、额外模型调用或按游戏ID分支。港湾图元目前按炮台实际伤害配色，并不是所有游戏通用的等级推导规则。

读屏可用现有 `preview --ready`：开局先冻结，用户明确开始；可重开并准备。独立嵌入分发与本地版本流程分别见 `packages/player-sdk/README.md`、`packages/content-delivery/README.md`，不依赖关卡页面来冒充 SDK。

Android 本地嵌入示例见 `examples/android-webview/README.md`，已有未签名构建及 APK 内资源摘要核对；设备运行与销毁完成确认尚未验证，不能将构建算作客户端 Gate。

`woodland-props-3d@1.0.0` 是原创 CC0 的树、岩石、货箱组合，用已有 Stage box/sphere/standard 材质实现。Agent 给节点ID加前缀并平移位置后内联，不能把预设format/props放进GameSpec。实际展示见 `games/phase2/stage-props-garden/`，Three点击与画面已验，Air未验；它是基础几何道具，不是完整模型/动画素材包。
