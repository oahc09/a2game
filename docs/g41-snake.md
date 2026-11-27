# G41 贪吃蛇参考交付

两份真实 GameSpec 共用 `a2game.puzzle.snake@0.1.0`：4×4（长度 4 获胜）
和 5×4（长度 3 获胜）。方向键、通用方向按钮或单指滑动均注入共享运行时，
引擎只渲染只读棋盘。两套是 R1 扩展参考，不计入冻结的 32+5 或独立 G3。

- 按逻辑 Tick 移动，至多缓存两个合法转向，每次移动只消费一个。重复、反向、
  释放和超过容量的输入不改变转向队列。滑动产生的 press/release 保留原始序号，
  同一微秒的后续键盘/语义动作不会插队。
- 暂停会丢弃还未进入 Tick 的原始、语义输入以及按键/指针占用；不清除已经提交的
  游戏转向队列，不推进时钟或 RNG。重开恢复同一初始布局、种子和移动节拍。
- 进入同一非增长步腾空的尾格合法；撞墙或身体只标记失败，不移动、不刷食物。
  非终局增长从行优先排列的空格用共享 RNG 抽取一次；达到长度目标后不再抽取。
  同一规则也覆盖满盘终局。

验证：

```sh
npm run catalog:build
node --test test/snake.test.mjs
node scripts/run-conformance.mjs specs/v0.1/tests/g41-snake.conformance.json specs/v0.1/tests/g41-snake-wide.conformance.json
# 按项目 SDK lock 执行 npm run sdk:prepare 后，用已安装的 WPE WebKit：
A2GAME_WEBKIT_EXECUTABLE=/path/to/MiniBrowser node scripts/g41-browser.mjs
```

浏览器脚本通过正式目录和 HTTP 播放器，在 CocosAirJS / Three.js 下分别实际发送
方向键和浏览器指针手势，在每个检查点独立以 Node 回放对齐精确 Hash；
它不是 Android 物理触控、原生 GPU 性能、独立模型或正式验收。

留证：`project/evidence/g41-webkit-reference.json`。WebKit 27.2 两套棋盘 × 双 SDK
共四组通过，覆盖真实浏览器指针和方向键、Node Hash、暂停重开、画面变化与资源释放。
两套独立包各 270 项的文件清单逐项核对 SHA-256；本轮浏览器跑的是正式目录，
不将静态包字节核验当成已玩过独立包。
