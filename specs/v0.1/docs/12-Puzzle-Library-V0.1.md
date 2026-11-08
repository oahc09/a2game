# Puzzle Library 0.1.0

本增量不改变旧 `grid-push` / `grid-slide-merge` JSON 的行为或 exact hash；所有玩法在共享 Runtime 内执行，Adapter 只消费 PresentationFrame。参考关卡用于验收机制，不等同于 G01–G10、G20、G24 的完整游戏及 Agent Gate。

## 合同与边界

`a2game.puzzle.swap` 实现相邻交换、MatchN、Cascade、GravityFill；`tray` 实现有向遮挡、容量和三张消除；`pair-match` 提供记忆翻牌和有侧边可取约束的麻将变体；`direction` 检查箭头射线；`placement` 提供目标归位或 Polyomino；`falling-piece` 提供旋转、碰撞、下落与消行；`sort` 提供容量和连续同色倾倒；`connected-match` 提供连通消除及悬空掉落。`push`、`slide` 复用既有实现并增加可选撤销。

`a2game.puzzle.sort` 的 `width` 是管数，`selectActions` 按管索引一一对应；`tubes` 必须有 `width` 个数组，末尾为管顶，颜色值非零。容量为 `capacity`，未配置时取 `height`。选择非空源管后选择目标：目标为空或管顶同色且未满时，倒入源管顶部连续同色段，直至目标满或该段倒完；非法选择可清除选中状态，但不产生成功移动。每次成功倒液后，`moves` 加一，`score` 是已满且全为同色的管数，不计空管。默认胜利条件是每管均为空或已满且同色；配置 `targetScore` 时达到该分数也会置 `won`。`score` 和默认胜利条件在成功倒液后更新，不应假设初始状态会自动按管数计分。

2026-10-27 顶出修复：`falling-piece` 硬降或重力锁定后，在同一事务中消行、生成下一块并检查出生位置；出生被占用立即置 lost，不能用该 Tick 的后续移动或下一 Tick 移动逃离重叠位置。进入 Tick 时已经被占用的出生位置同样先判失败。此前实现的检查延迟允许移动规避顶出，本次修复不改变合法拼块的移动、旋转、重力周期和消行规则。G09 revision 3 使用空 4×8 棋盘、四个 tetromino 连续消四行；变体 revision 3 改变序列并加快重力。原单拼块样例与旧回执保留，完整人工质量与独立 G3 另验。

每种行为有独立 Manifest/config Schema、必需能力依赖和参考 GameSpec。内部 `grid`、`occupancy`、`match-n`、`cascade`、`gravity-fill`、`layered-stack`、`occlusion`、`reveal`、`polyomino`、`rotate-piece`、`line-clear`、`select`、`undo`、`merge` 声明算法服务；这些不是供 JSON 执行任意命令的解释器。`core.goal/rng/score/timer` 声明 Runtime 既有服务。

棋盘最大 16×16、256 格；拼块最大 4×4、16 格；级联和撤销历史各最多 16 层。非法交换、遮挡选择、越界、错误颜色和碰撞不产生成功移动或消耗补位 RNG。遮挡关系必须无环；配置引用的 Action 必须存在。记忆翻牌按逻辑 Tick 延迟关闭，暂停冻结；下落同样只使用唯一 Tick。

撤销恢复模块状态及 RNG，限单行为场景。多行为组合需要使用整个 Session Snapshot；不能局部回退共享 RNG 而保留其他行为的随机结果。撤销下落时该 Tick 不额外推进重力。初始历史必须为空，存储路径必须独立。

## 输入、画面与验证

参考 JSON 通过语义 Action 选择格子，播放器按 Action 定义生成通用按钮，支持键盘及 DOM Pointer。选中、托盘、预览和棋盘通过只读投影显示；不存在按游戏 ID 的 Adapter 分支。DOM 移动视口验证不代表真机 Touch、原始命中测试或拖动手势验收。

`project/puzzle-reference-cases.json` 固定手工预期的合法解和非法输入；`npm run puzzles:e2e` 在真实 HTTP Three.js/CocosAirJS 各运行 12 份 JSON，核对 Node 操作回放 Hash、暂停、胜利、重开、截图、错误日志及释放。回执包括源码/SDK 指纹、浏览器和输入操作，独立保存每次运行。`test/puzzle-library.test.mjs` 仅保留随机撤销、遮挡/记忆、旋转消行和分类守恒等必要回归；Conformance 对各机制保留正反例。

## 2026-10-27 完整滑动对局

`puzzle.slide` 与 `grid-slide-merge` 可选 `stalledPath` 指向独立 bool：棋盘满且横/纵无同值邻居时为 true。空位、合法合并和无效方向均按同一共享算法判定；无效移动不消耗随机。可撤销 Profile 同时保存该字段与棋盘、best、RNG，不改变旧配置。G02 revision 3 从两个 2 开局，种子 42 的作者搜索回放分别 957/1872 步到 2048/4096，182 步达无路失败；作者搜索不计独立 G3。回放原始动作在 project/full-2048-traces.json。
