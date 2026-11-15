# 三款游戏：玩法与启动

这里是第二阶段的试玩入口。先选一款游戏，运行对应命令，再打开命令打印的网址。

本轮另有[扩展关卡与素材展台](expansions.md)：推箱子新增两关、四波补给塔防、星港牌组与紧急订单，以及透明精灵/Stage模型演示。需要在同一业务网页选择、切换和回退作品时，使用[本机交付服务](../../packages/delivery-service/README.md)。

运行前需要安装项目依赖、构建代码，并准备对应的真实引擎SDK。首次使用请看[项目安装说明](../../README.md)。

## 1. 暖光仓库：推箱子

五关逐步增加难度。把箱子推到目标位置，可以撤销、重试并保存通关进度；第四、第五关由有界作者搜索生成参考解法，前三关内容保留。

```powershell
node scripts/serve-collection.mjs games/phase2/sokoban/collection.json
```

页面中可选择Three.js或CocosAirJS。[完整玩法说明](sokoban/README.md)。

## 2. 光弧巡游：纵版射击

移动飞机、按住射击、获得能量并升级武器。Boss半血后启动引力场，需要及时躲避。

```powershell
node generator/cli.mjs preview games/phase2/shooter --backend three --ready
```

当前为第5版。不同引擎的整局测试版本不同，详见[玩法与测试范围](shooter/README.md)。

2026-11-14当前交付：第5版源Air与独立SDK双端已补完整正常时钟通关（含保护暂停后的显式恢复）。内容包、SDK和Android内置内容版本统一，产物位置见[当前选择清单](../../project/phase2-delivery.json)。

## 3. 港湾守望：合成炮台

熔炼矿石获得金币，购买、合成和升级炮台，抵挡三波敌艇。

```powershell
node generator/cli.mjs preview games/phase2/turret-defense --backend three --ready
```

当前第3版已有Air整局试玩，Three有玩法和画面记录。[完整玩法说明](turret-defense/README.md)。

2026-11-14：第3版当前独立SDK双端均完成合成、升级、三波胜利和重开。主审已知路线Agent复核及网页回退范围见[P0交付说明](../../docs/phase2-p0-delivery.md)。

## 玩之前与玩完后

- 命令从仓库根目录执行。
- `--ready`让游戏先停在准备界面，读完说明再点击开始。
- 切换CocosAirJS时，把`--backend three`改为`--backend air`。
- 游戏出现追帧保护暂停时，点击继续，并重新按住移动或射击键。
- 玩完关闭页面，再在命令行按`Ctrl+C`关闭预览服务。

## 想把游戏交给其他应用

| 目标 | 使用说明 |
| --- | --- |
| 嵌入自己的网页 | [独立Player SDK](../../packages/player-sdk/README.md) |
| 导出新版、保留旧版或回退 | [本地版本管理](../../packages/content-delivery/README.md) |
| 放进Android应用 | [WebView示例](../../examples/android-webview/README.md) |
| 给游戏换主题和道具 | [素材使用](../../docs/creation-library.md) |

另有[林间小站](stage-props-garden/README.md)展示树、岩石和货箱的3D组合。它是可操作的素材示例，不算第四款完整游戏。

这些作品有实际运行记录，但不代表正式G3或真机验收通过。制作来源、已知问题及剩余任务见[第二阶段计划](../../docs/A2Game-Game-Creation-Delivery-Phase2.md)。
