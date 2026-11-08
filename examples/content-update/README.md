# G01 内容修订示例

`v1/` 为原第一关的独立副本；`v2/` 由 Cindy controller 在该副本上修订：目标从 18 移到 19，完成需要从 `left, up, right` 变为 `left, up, right, right`，同时更新目标上的箱子颜色映射、解法及 Conformance。两版保持相同游戏 ID，revision 分别为 1 和 2。此示例不代表独立模型创作、盲玩或用户端已更新。

构造脚本只在目标目录不存在时运行，避免覆盖候选；正常使用已冻结的 `v1/` 和 `v2/`，不要重复执行。导出、重新准入和本地回退命令见 `packages/content-delivery/README.md`。
