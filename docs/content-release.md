# 本地动态内容准入与回执

应用 Profile 为 `trusted-reference-host-v1`，GameSpec/Capability 协议保持 `0.1.0`。S3 支持本地持久化回执、审核资源及可传输内容包；S4 增加声明 `a2game.visual.stage@0.1.0` 的 3D 定义。发送者签名、远程账户和自动部署另行实施。

## 从 JSON 到运行

1. 运行 `npm run build`、`npm run player:serve`，选择后端并点击“导入游戏 JSON”。浏览器以同源 `POST /api/releases` 上传 UTF-8 JSON。
2. 服务拒绝重复键、非有限数、超过 64 层或 256 KiB 的 JSON。使用完整 Draft 2020-12 校验 GameSpec、可信 Manifest、所有组件配置及已知输入绑定配置。
3. 共享 `compileGame` 校验引用、版本、依赖与语义，再检查宿主策略。隔离的 Headless Session 检查初始表现和一个 Tick 的模块布局；它不作为正式游戏会话，也不证明任意后续输入下的玩法正确性。
4. 全部成功后，按 JCS/SHA256 内容地址创建不可变记录并返回回执。播放器服务默认保存到本地私有目录；失败不写入发布记录、不替换当前浏览器 Session。
5. 播放器通过 `GET /api/releases/<sha256Jcs>` 读取回执和 JSON，核对内容、ID、revision、Manifest 及资源清单摘要；逐份下载审核资源，核对实际字节 SHA 并解码后才构建 Session。切换后端保留内容地址，在新文档中从初始状态运行。退出时关闭位图并撤销对象 URL。

## 资源与内容包

`project/asset-policy.json` 是部署方维护的审核目录，记录 URI、类型、精确 `integrity`、字节数、来源和许可。游戏必须与该目录一致，最多 32 份资源、合计 8 MiB。默认包含仓库生成的 CC0 PNG/WAV 示例，生成器为 `scripts/build-reference-assets.mjs`。上传不能注册资源、指定服务器路径或发起任意外网下载。

`GET /api/assets/<sha256>` 每次读取都核对审核字节，浏览器再次核对长度与 SHA。没有公开整个 `assets/` 目录。修改审核目录后需重启服务，内容须重新准入。表现后端只获得当前 Session 拥有的资源作用域，资源不进入逻辑状态 Hash。

导入的游戏可点击“导出内容包”，下载 `a2game-release-bundle@1`，再在另一台具有相同已审核资源的宿主导入。包包含 `definition/resources/sha256Jcs`，不嵌入未经审核的资源字节。接收方独立完整校验，不凭发送方声称的 PASS 放行。

- `GET /api/releases/<sha256>/bundle`：导出内容包。
- `POST /api/bundles`：接收 UTF-8 JSON 内容包并独立完整准入；最大 1 MiB，内部游戏仍限 256 KiB。
- “导入游戏 JSON”同时接受普通游戏或内容包；错误包不替换当前 Session。

早期 `scene2d-local-release-v1` 回执不能直接沿用：保留旧记录，以原游戏 JSON 重新导入，新回执增加 `resourcesDigest`，无资源游戏使用空资源清单摘要。

本机 Agent 也可以调用同一个接口：

```powershell
# 另一个终端先启动 npm run player:serve
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8765/api/releases' `
  -ContentType 'application/json' -InFile '.\my-game.game.json'
```

响应包含 `receipt` 与读取地址 `href`。每个校验环境最多保存 32 个不同内容，同时最多两项校验，每项超时 8 秒。相同内容在同一上下文中复用同一回执。使用相同目录与校验环境重启服务后，原内容地址仍有效；重启后首次读取重新执行完整校验，Python 缺失时拒绝恢复。

## 本地持久化

默认目录为 `.a2game/releases/<contextDigest>/<sha256Jcs>.json`，已被 Git 忽略，也不通过静态 HTTP 公开。可在启动前指定绝对目录：

```powershell
$env:A2GAME_CONTENT_DIR = 'E:\A2GameData\releases'
npm run player:serve
```

记录先写入同目录的独占临时文件并同步文件，再通过同目录重命名原子发布，避免读取半份 JSON；支持当前 Windows exFAT 工作盘，不依赖硬链接。同一存储目录限定单个服务进程写入，不提供多写入者锁或事务。不保证断电后的文件系统持久性，不把它作为数据库或远程签名分发服务。正常写入会清理自己的临时文件，中断遗留的 `.tmp` 不会作为发布记录加载。

每次读取核对内容、Manifest 与校验环境摘要；已经缓存的记录如被修改，立即拒绝。新服务首次读取还会执行完整 Schema、语义、能力、宿主策略及隔离 Headless 检查，不凭磁盘上的 `PASS` 字段直接放行。损坏或自相矛盾的记录返回 `A2G_E_RELEASE_INTEGRITY`；不可写的存储返回 `A2G_E_RELEASE_STORE`，不降级为临时内存发布。

校验环境改变会使用新的 context 目录；旧内容地址在尚未重新导入时返回 `A2G_E_RELEASE_STALE`。重新导入后生成当前环境的新回执，旧目录保留。服务不会自动清理旧环境、损坏记录或已满的存储；需要保留证据后手动管理本地数据，或设置新的 `A2GAME_CONTENT_DIR`。容量按单服务、每个环境计算，多进程共享目录的全局配额未实现。嵌入调用 `createContentService()` 默认仍为内存模式，显式传入 `storageDirectory` 才持久化。

## 当前宿主策略

- 支持已有能力范围内的单场景 `scene2d` 及版本化 `visual.stage`，button 输入及 Keyboard/Tap/Swipe；绑定需声明对应能力或回退引用，至少有一个可用绑定。3D 必须声明 Stage，并使用真实 Three.js/CocosAirJS 后端。
- 未审核 `assets`、自定义 `extensions`、未声明 Stage 的 3D、多场景、未实现的输入及真实录制策略明确拒绝。后续通过独立 Capability/Profile 增加支持，物理、Touch/IMU 等完整目标保留。
- 上传不能注册 Manifest、替换 Schema、执行脚本、指定服务器文件路径或请求网络资源；校验只使用部署自带的 Schema 和绑定可信实现的 Manifest。
- 服务绑定 loopback，要求 JSON 媒体类型和同源 Origin/Host，不提供跨域许可。静态 HTTP 仅公开播放器、编译 Runtime 和版本样例，真实文件路径也必须位于这些公开目录。
- Python 不可用、校验超时或部署上下文变化时拒绝发布，不退化为手写 Schema 子集。默认优先项目 `.venv`，可用 `A2GAME_PYTHON` 指定解释器。

## 回执和修复反馈

`a2game-content-release` / `receiptVersion: 1` 包含 `status/profile/id/revision/sha256Jcs/manifestDigest/contextDigest/resourcesDigest/validator/createdAt`。Manifest 摘要按 ID/version 排序，不依赖 Node 与浏览器的注册顺序。`contextDigest` 固定编译 Runtime、Schema、Manifest、资源策略和准入实现的文件指纹；服务运行期间这些文件改变，读取及新发布返回 `A2G_E_RELEASE_STALE`，须重启服务并重新导入。

回执信任来自本机同源服务，不是面向远程分发的数字签名。失败响应为 `{error:{code,message,stage,diagnostics}}`，不返回服务器堆栈；诊断包含 JSON Pointer，供用户或 Agent 修复。

| 错误码 | 处理方式 |
|---|---|
| `A2G_E_JSON_PARSE` / `A2G_E_CONTENT_SIZE` | 使用合法 UTF-8、无重复键且不超预算的 JSON |
| `A2G_E_SCHEMA` | 按 Pointer 修复结构或配置 |
| 共享编译器的 `A2G_E_CAP_*` / `A2G_E_STATE_PATH` 等 | 修复能力引用、版本、依赖或状态路径 |
| `A2G_E_RESOURCE_POLICY` / `A2G_E_HOST_PROFILE` | 使用当前 Profile 支持的内容，或等待对应能力实现 |
| `A2G_E_RELEASE_INTEGRITY` | 检查并保留损坏记录，修复存储或使用新目录后重新导入 |
| `A2G_E_RELEASE_STALE` | 上下文改变后重启服务并重新导入 |
| `A2G_E_RELEASE_STORE` / `A2G_E_RELEASE_CONFIG` | 修复目录配置、访问权限或文件系统状态，不跳过持久化 |
| `A2G_E_RELEASE_CAPACITY` | 管理当前环境的本地存储或使用新目录；重启不会清空容量 |
| `A2G_E_VALIDATOR_UNAVAILABLE` / `A2G_E_VALIDATOR_TIMEOUT` | 修复 Python/依赖或缩小输入后重试 |

`npm run content:e2e` 在真实 Three.js、CocosAirJS 导入未列入内置白名单的变体，核对 Node/Host Hash、结构/能力负例、失败恢复与后端切换；随后退出并重新启动 HTTP 服务进程，在相同 URL 加载原回执并继续输入。独立目录保存回执、截图、Trace 和进程退出记录。原有样例/生命周期回归继续使用 `npm run g2:real`；两类证据分别统计，不替代 G3 或真机 Touch/IMU。
