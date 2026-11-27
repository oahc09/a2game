# G35 扫雷 · R1 扩展参考

G35 是 2026-11-22 差距计划里的独立扩展，不属于原 32 款游戏加 5 个混合案例的正式验收分母。两份真实 GameSpec 共用 `a2game.puzzle.minesweeper@0.1.0`，Three.js 和 CocosAirJS 只绘制共享 PresentationFrame：

| GameSpec | 几何与雷数 | 默认种子 |
|---|---|---|
| `g35-minesweeper.game.json` | 4×4、3 雷 | 42 |
| `g35-minesweeper-wide.game.json` | 5×4、4 雷 | 73 |

点击棋盘翻格；点击画布内「标旗 / FLAG」或按空格切换模式；金色格已标旗。键盘 A 至 P 或 A 至 T 对应行优先棋盘。数字是八邻域雷数；没有相邻雷的格会连带展开；翻开全部安全格获胜，触雷失败。首次有效翻格前不生成棋盘，插旗、翻已标旗格不消耗随机数。只有最后踩中的雷会改变对应可见格，其余隐雷不会进入已提交的这两份布局的表现投影。这是单机表现边界，不是多人保密或防作弊机制。

## 复验

```sh
npm run catalog:build
node --test test/minesweeper.test.mjs
node scripts/run-conformance.mjs specs/v0.1/tests/g35-minesweeper.conformance.json specs/v0.1/tests/g35-minesweeper-wide.conformance.json
```

有 `project/sdk-lock.json` 对应的真实 SDK 及可运行的 Playwright WebKit 后，可执行专项浏览器 / 独立包回执：

```sh
node scripts/g35-browser.mjs specs/v0.1/games/g35-minesweeper.game.json specs/v0.1/games/g35-minesweeper-wide.game.json
```

专项回执不把原 G2、G3、真机、硬件性能或人体工学验收升级为通过。
