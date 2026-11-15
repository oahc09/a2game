# 本地游戏版本管理

用这组命令保存游戏的新旧版本、导入检查，并在需要时回退。它使用已有的游戏包检查流程，不调用模型，也不发布到远端。

**当前只管理本地文件。切换版本指针不会让已经打开的客户端自动更新。**

## 1. 准备目录

需要项目现有的Node/Python依赖和最新`dist/`。选择一个专用交付目录，先创建它，再运行下面的示例。目录由本工具管理，运行期间不要让其他进程修改。

每个作者目录包含：

| 文件 | 内容 |
| --- | --- |
| `game.json` | 游戏定义 |
| `conformance.json` | 玩法检查步骤 |
| `solution.json` | 完成游戏的操作步骤 |
| `game-plan.json` | 可选的创作计划 |

## 2. 保存两个版本

下面假设`output/my-game`已经存在：

```powershell
node scripts/content-delivery.mjs export --root output/my-game --source examples/content-update/v1 --description "首版"
node scripts/content-delivery.mjs export --root output/my-game --source examples/content-update/v2 --description "目标向右移动一格，需连续推两次"
```

版本名来自GameSpec中的正整数`revision`，例如`v1`、`v2`。同一目录中的版本必须属于同一个游戏；已存在的版本不覆盖。

导出会保存作者文件，再执行原有格式、能力、语义、资源和解法检查。检查成功后才更新`latest.json`；失败不会切到新版本。

## 3. 查看、回退和导入

```powershell
node scripts/content-delivery.mjs inspect --root output/my-game
node scripts/content-delivery.mjs select --root output/my-game --version v1
node scripts/content-delivery.mjs import --root output/my-game --version v1
```

- `inspect`：查看本地版本。
- `select`：检查包摘要、游戏ID和版本后，切换`latest.json`。
- `import`：在当前环境重新完整检查内容，将结果写入新的`imports/`子目录。

接收方要执行`import`，不能把发送方的旧检查结果直接当作自己环境已通过。

## 4. 文件保存在哪里

### 从选中版本生成独立网页播放器

准备好最新 `dist/` 和真实引擎SDK后执行：

```powershell
node scripts/content-delivery.mjs build-player --root output/my-game
node scripts/content-delivery.mjs build-player --root output/my-game --version v1
```

不传 `--version` 时使用 `latest.json` 选中的版本；显式指定只影响本次构建，不改变版本选择。命令先核对版本摘要，再在接收环境重新检查内容、资源、测试和解法，保存本次实际使用的包快照，然后生成新的独立播放器目录。任一步失败都不切换版本。

成功结果的 `player.output` 是静态服务目录，访问 `/player/index.html`。输出中的 `delivery-source.json` 记录版本、原包SHA和运行包摘要，并纳入文件清单；`imports/` 内的 `player-build.json` 保留本次构建位置。摘要不认证作者。

回退时先 `select --version v1`，再运行 `build-player`，把业务网页入口指向新生成的目录并重新加载页面。旧分发目录和已打开的播放器不会自动切换；本命令不发布文件、不实现在线热更新，也不绕过CocosAirJS的单文档初始化限制。部署和分发仍由接收方管理。

- `versions/vN/`：作者文件、原格式`package.json`、说明和文件摘要。
- `latest.json`：当前选择的版本。
- `imports/`：每次导入的结果。
- `.staging-*`：失败或未完成的中间记录，不会被自动选为版本，也不会自动删除。

原Generator还会在仓库`.a2game/generator/`和`.a2game/generator-package/`生成私有中间记录。

## 5. 使用限制与出错处理

工具拒绝`..`、磁盘根目录和已有软链接或Windows junction路径；不会执行目录中提供的任意命令。

运行时使用排他锁，避免本工具的多个进程同时写入。异常退出后若留下`.content-delivery.lock`，应先确认没有进程运行，再手工处理。这里假设目录由可信本机用户管理，不保证抵抗恶意并发替换、系统崩溃或异常文件系统行为。

SHA摘要可以发现包字节变化，但不是作者签名。应保护交付目录及所在机器。旧包仍需在接收环境重新检查，不要覆盖旧目录来伪造“版本已更新”。
