# 素材怎么选、怎么用

素材目录帮助Agent复用现成的外观，不必每次重新画角色、飞机或炮台。现有图元主题之外，新增9幅原创透明精灵、3段PCM音效和港湾Stage模型/动画预设，均有源文件、许可和审核摘要；这仍不是任意模型格式导入器。

## 1. 现在有哪些素材

| 主题 | 包含内容 | 适合的作品 |
| --- | --- | --- |
| `warm-workshop@1.0.0` | 墙、箱子、角色、目标光圈和暖色配色 | 推箱子 |
| `spaceflight@1.0.0` | 飞机、敌机、弹丸 | 射击游戏 |
| `tidal-turrets@1.0.0` | 炮台、货艇和数字标记 | 塔防、合成炮台 |
| `woodland-props-3d@1.0.0` | 树、岩石、货箱的基础3D组合 | 小场景和道具展示 |
| `warehouse-* / space-* / harbor-* @1.0.0` | 九幅256px透明PNG及可编辑SVG源 | 三款代表作品的角色、物件与反馈素材 |
| `collect-chime / impact-soft / merge-chord @1.0.0` | 三段原创短PCM WAV | 收取、命中、合成提示 |
| `harbor-models@1.0.0` | 仓库、码头组合模型与Tick旋转/粒子预设 | 现有Stage能力的3D创作 |

新增资源见[原创素材包](../assets/creation-kit/README.md)。`runtime-stage-sprite`与`runtime-stage-audio`条目需要在GameSpec的`assets`中声明，并以现有`presentation.stage`引用；不要把PNG条目当作scene2d图元主题。`stage-authoring-kit`是创作模板，不是可执行模型脚本。

源文件都在`assets/themes/`。这些原创素材标注CC0许可；目录同时记录来源、版本、文件大小和SHA摘要，便于核对文件是否被修改。摘要不能证明文件来自谁。

## 2. Agent怎样找到素材

通过MCP读取公开资源：

```text
a2game://spec/0.1.0/creation-library.json
```

也可以直接查看[素材目录文件](../project/creation-library.json)。目录包含用途标签、所需能力和使用数据；读取目录不会自动调用另一个模型，也不会增加MCP工具数量。

## 3. 怎样放进游戏

1. 根据玩法和画面需求选择主题。
2. 阅读对应能力的字段说明，确认播放器支持这些能力。
3. 将需要的图形复制到GameSpec中，设置位置、大小、颜色及状态绑定。
4. 使用原有工具检查完整游戏，再实际预览。

主题文件是**创作时使用的模板**，不是可以直接运行的完整游戏，也不是脚本插件。不能把主题文件里的所有字段原样塞进GameSpec。

### 2D主题

推箱子主题使用`scene2d.repeat`重复绘制图形。飞机和炮台主题使用`scene2d.bodyLayer.motifs`，让图形跟随游戏对象移动。后者需要`a2game.visual.body-motif@0.1.0`能力。

图形大小按对象的半宽、半高计算；`item`读取该对象的`value`。例如港湾炮台主题按伤害值配色，这不是所有游戏都通用的等级规则。字段限制见[2D表现说明](../specs/v0.1/docs/06-Presentation-Slice-V0.1.md)。

### 3D道具

树、岩石和货箱由已有的长方体、球体和材质组合而成。使用时给节点ID加上不同前缀，调整位置，再放入`presentation.stage.nodes`。预设中的`format`和`props`不能作为新的游戏字段。

实际效果见[林间小站](../games/phase2/stage-props-garden/README.md)。该内容已在Three.js检查画面和操作，Air未测试。

## 4. 可选动画、特效和声音

参考播放器还提供以下效果：

- `motion=1`：短距离移动缓动，并尊重系统的减少动态效果设置。
- `feedback=1`或“事件特效”按钮：开启命中粒子、射击点线和合成闪光，默认关闭。
- 声音开关：用户主动开启后，播放移动、推箱、撤销、重试、通关、合成、命中和错误等固定提示音。

这些是**播放器提供的附加效果**。它们不会自动写进单关游戏包，也不自动出现在当前独立SDK中。效果不改变玩法状态；重开或关闭时会清理自身记录。

## 5. 已经检查什么，还缺什么

射击事件效果有两个真实SDK的检查记录；炮台合成和射击效果在Three检查过。声音的主观效果还没有评价。

Air的H01反馈检查曾出现`AIR_E_ORTHO_WIDTH`，历史失败保留。后续一次第3版整局未复现，但没有因此认定特效或历史错误已全部解决。

效果模块最多同时显示12组效果，整帧最多640条绘制指令。更详细的实现和运行记录分别在`player/event-feedback.mjs`及本地`reports/phase2-feedback-20261108/`。

Three绘制对象复用已有定向性能观察，但不是所有机器上的性能保证。更多图片、完整3D模型、动画和声音素材仍待补充。

## 6. 预览与交付

- 想先读说明再开始：使用`preview --ready`。
- 想导出推箱子五关：运行`node games/phase2/sokoban/export.mjs`，每次创建新目录，不覆盖旧包。
- 想嵌入网页：看[Player SDK](../packages/player-sdk/README.md)。
- 想保留和回退版本：看[本地版本管理](../packages/content-delivery/README.md)。

修改源码或审核规则后，如果旧服务提示`A2G_E_RELEASE_STALE`，请先重启服务，再重新加载。这个错误表示检查环境已变化，不能关闭检查后继续使用旧结论。
