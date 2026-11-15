# P2 作者关卡扩展

`scripts/build-phase2-levels.mjs` 生成推箱子第四、第五关、四波塔防与紧急星港牌组。解法来自有界作者搜索或作者编排，不能计作独立模型生成或 G3。

- 推箱子第四关18步、第五关5步，复用共享推箱子与撤销机制。
- `turret-defense-four-waves` 在原三波参考基础上增加第四波：第三波补给一份矿石，需要再次精炼、领取并升级，才能完成后续战斗。
- `starport-deck` 保留既有本机宿主创作产物的原始 JSON；`starport-deck-urgent` 使用新牌序和初始热量，要求在有限出牌次数内兼顾冷却与订单。

各目录包含 GameSpec、Conformance 和参考解法。可用 `node generator/cli.mjs test <目录> --json` 检查，或 `preview <目录> --backend three --ready` 试玩。素材展示 `creation-gallery` / `harbor-models` 是受审核资源及 Stage 预设演示，不作为新增完整游戏种类。

这些扩展不修改冻结的32+5款目录，也不改变正式验收分母。
