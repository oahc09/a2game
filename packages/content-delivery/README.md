# 本地内容版本交付（实验性）

此工具复用现有 Generator 的 `exportGamePackage` / `importGamePackage`，用于单机目录内保存同一游戏的修订，不调用模型、不创建远端发布，也不是 Player SDK 的在线热更新。接收端必须通过 `import` 重新完整准入，包 SHA 只检测字节变化，不认证作者、审核身份或分发方。实际客户端接收与在线更新均未由这些命令证明。

先创建一个空的本地交付目录（此后只由本工具管理），然后：

```powershell
node scripts/content-delivery.mjs export --root output/my-game --source examples/content-update/v1 --description "首版"
node scripts/content-delivery.mjs export --root output/my-game --source examples/content-update/v2 --description "目标向右移动一格，需连续推两次"
node scripts/content-delivery.mjs inspect --root output/my-game
node scripts/content-delivery.mjs select --root output/my-game --version v1
node scripts/content-delivery.mjs import --root output/my-game --version v1
```

`--source` 是明确指定的作者目录，包含 `game.json`、`conformance.json` 和 `solution.json`（可选 `game-plan.json`）；其余版本、包、快照和导入结果都在 `--root` 下。先复制固定作者字节，再调用原导出流程进行 Schema、能力、语义、资源和解法等现有检查。版本名来自 GameSpec 的正整数 `revision`，例如 `v1`；同 revision 已存在时拒绝覆盖。`versions/vN/` 中包含原始作者文件、Generator 原格式 `package.json`、说明、游戏 ID、revision 和文件 SHA。所有版本必须属于同一游戏。导出完成且包摘要验证通过后，才通过同目录临时文件更新 `latest.json`；失败不切换指针。导出失败留下的 `.staging-*` 是独立中间记录，不会被选为版本，也不会自动删除。

`select` 只切换到已存在且包字节 SHA、ID、revision 与记录一致的版本；`import` 仍调用 Generator 的接收端重新准入，结果写入 `imports/` 新目录。校验环境发生变化时，必须重新准入；更改 `latest.json` 不代表客户端已加载该版本。索引和摘要并非签名，须保护交付目录及其宿主。

路径拒绝 `..`、磁盘根目录及现有软链接/Windows junction；CLI 不运行用户提供的命令。`--root` 必须已存在；运行期间目录必须由可信本机用户独占，不能让不受信进程并发替换目录或链接。排他锁避免此工具的协作进程同时写入；异常退出可能留下 `.content-delivery.lock`，确认没有工具正在运行后须手工处理。系统崩溃、恶意并发文件系统替换或不可靠文件系统的原子性不在此参考范围。原 Generator 准入流程还会在仓库 `.a2game/generator/` 和 `.a2game/generator-package/` 创建随机私有中间记录；不会自动清理这些记录。

这些命令需要项目现有的 Node/Python、依赖与当前构建的 `dist/`。不要把旧版本包当成新源码环境的自动准入证明，也不要覆盖旧目录以“更新”版本。
