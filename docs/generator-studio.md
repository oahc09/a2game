# 本地 Studio 与游戏包

准备 Node 22+、Python 依赖、构建与锁定 SDK 后运行：

```powershell
npm run generator:studio
```

打开打印出的 `http://127.0.0.1:<port>/studio/`。页面的样式和脚本在一个 HTML 内，游戏预览依赖同源的可信 Player/Runtime/SDK。默认可用固定 `DEMO_FIXTURE`，不解释自然语言。选择方式、点击生成后，后台执行 Generator、完整准入和正反例；通过才载入新 JSON。可以取消、切换真实 Three.js/CocosAirJS、操作游戏、读取状态/资源/Hash、查看规划/JSON/验证记录、比较前后规划和下载调试包。

真实 Provider 由启动命令固定，保持原 Adapter 的认证与模型路由。页面不能传配置路径、可执行文件、服务地址或密钥。需要真实调用时由操作者明确提供新预算，例如：

```powershell
npm run generator:studio -- --provider codex --config .a2game/codex-generator.json --max-calls 3
```

此命令中的预算是示意，不代表本会话已授权额外调用。默认真实预算 0。每次最多 1–3 尝试，先预留尝试上限、按已知实际调用返还未用预算；不明的基础设施失败保守占用预留。最多一个生成/导入任务、16 份会话记录；关闭服务会取消本次 worker 树并关闭监听。任务目录保存在 `output/studio/<UUID>/`，私有回复留在 `.a2game/`，会话列表本身不跨进程保存。

服务仅绑定 Loopback、严格 Host/Origin、拒绝跨站请求，变更请求须同源 JSON 和固定自定义头。只提供本会话已验证结果的固定文件名，不能从网页浏览本地任意目录。现有 Player 内容 API 保持原策略。

游戏包命令：

```powershell
npm run generator -- export-package output/my-game --output output/my-game.package.json
npm run generator -- import-package output/my-game.package.json --output output/imported-new
npm run generator -- preview output/imported-new --backend air
```

包为受控单文件 JSON，包含内容 bundle、GameSpec、Conformance、solution、可选 GamePlan、资源来源/许可/SHA 清单和兼容声明；不携带代码、Provider 配置、提示词、原始回复或历史验证报告。每项文件绑定 SHA，整个包上限 768 KiB。SHA 不认证作者身份，导入结果标记 `IMPORTED_CONTENT_UNVERIFIED_ORIGIN`。

接收方须已安装兼容可信宿主、完整 Validator、相应 Manifest、锁定 SDK 和所引用的审核资源。包携带资源清单，**当前不嵌入纹理/音频等二进制文件或 Runtime**；资源不在本机审核目录或字节缺失时拒绝，不自行安装、放行远程 URL 或相信发送方 PASS。无资源的 Primitive 游戏可直接迁移；带资源交付的独立资源分发仍待扩展，不称为离线独立应用安装包。

导入使用严格 JSON/重复键检查、资源 bundle 完整性、当前全量 Schema/能力/语义、Conformance、解法/双 Session Hash、GamePlan 一致性与生命周期复核。既有目录不可覆盖。包中声称的正式身份、G3 或人工质量不获得信任。

验证：`npm run generator:studio:check` 真实点击生成/取消、双 SDK 桌面/390px 试玩与包下载/导入；`npm run generator:package:check -- <游戏包.json>` 在新临时源码宿主 `npm ci`、构建、CLI 导入、双 SDK 输入/Hash/重开/释放。后者支持纯按钮解法的已验证游戏，逐步比较模型解法Hash；不对 raw/非按钮方案伪造物理输入，复用同机 Python，并显式复制锁定 SDK 与审核资源，不证明新物理机器复现。运行材料见 Generator 台账。
