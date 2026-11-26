# 潮纹消消

运行 `node scripts/serve-collection.mjs games/business-complete/tideglass-match/collection.json`，打开命令输出的地址即可游玩。

- [初识潮纹](m01.game.json)教学关。拖动相邻棋子交换，在一步内消除三枚琥珀。
- [双色潮汐](m02.game.json)在两步内消除三枚青玉与三枚紫晶。连锁计入各颜色目标，一次交换只扣一步。

- [潮线](m03.game.json)通过四连生成直线块，再让它匹配激活。
- [潮心爆发](m04.game.json)通过 T/L 形生成爆炸块，再触发邻格清除。
- [虹潮](m05.game.json)通过五连生成颜色清除块，再与普通棋子交换。
- [冰封潮汐](m06.game.json)在两次有效交换中清除两层冰。
- [沉箱水道](m07.game.json)从相邻格消除两层木箱，打通重力通道。
- [潮口运珠](m08.game.json)让潮珠经过指定重力路径落入出口。
- [交叉潮线](combos/m09.game.json)、[交潮爆发](combos/m10.game.json)与[虹线齐鸣](combos/m11.game.json)练习三种特殊块组合。
- [潮汇终章](m12.game.json)两步内完成双色、破冰碎箱和潮珠目标。局内各有一次锤子、强制交换和洗牌，刷新可保留棋盘与道具库存。通关见证无需道具。

十二关均有通过实际规则重放的通关 Trace，M01、M02 和 M12 另有失败路线。关卡依次解锁，浏览器刷新后保留关卡进度。

关卡目录公开每关的 `baseScore`。通关至少一星，达到基准分的 1.5 倍（向上取整）或 2 倍分别获得二星或三星。地图保留成功局的最高分和对应星级。失败计零星。主关和组合变体均有[三星输入见证](star-witnesses.json)。

连锁结算时请等待棋盘解锁。此时可暂停，接着游玩时不会补执行此前的交换。M12 刷新会从最后一次已结算的棋盘继续。

六种组合可通过 `node scripts/serve-collection.mjs games/business-complete/tideglass-match/combos/collection.json` 体验。该入口包括 M09–M11 的三关基础版及三种可玩变体。

用 `node scripts/package-player-sdk.mjs games/business-complete/tideglass-match/collection.json` 打包。静态 HTTP 打开包内的 `/player/collection.html`。十二主关已从独立静态包在两个引擎上通关。
