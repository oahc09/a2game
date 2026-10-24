# 本地可信内容交付 Profile

本应用 Profile `scene2d-trusted-assets-v1` 使用既有 GameSpec/Capability `0.1.0`；它替代早期无资源的 `scene2d-local-release-v1`，不扩大未知 Capability 的执行权限。

GameSpec 必须通过完整 Draft 2020-12、组件与输入绑定配置、共享语义编译、能力协商及宿主策略。单场景、既有 scene2d 和 Keyboard/Tap/Swipe 是当前宿主范围；未来表现与输入按独立版本化 Capability 增加。未知能力、脚本、扩展和未支持宿主特性仍拒绝。

`assets` 沿用 GameSpec 的逻辑 ID → `uri/type/integrity`。当前 Profile 要求每份资源提供精确 `sha256-<base64>`，并匹配部署时审核的 `project/asset-policy.json`。策略记录类型、字节预算、来源与许可；游戏上传不能更改策略或触发任意网络下载。资源接口按 SHA 寻址，每次服务前重算 SHA；浏览器对长度和实际 SHA 再次核对。

发布回执包含内容、Manifest、校验环境及资源清单摘要。旧 Profile 的记录不能直接升级为新 PASS：使用原 JSON 重新导入并完整校验，保留旧环境目录。私有记录使用同目录原子重命名发布，重启后首次读取再次完整校验；同目录限定单服务写入。

`a2game-release-bundle@1` 包含 `format/bundleVersion/sha256Jcs/definition/resources`，可导出为文件或由 HTTP API 传输。接收方必须独立核对内容 SHA、自己审核的资源清单并完整准入，不信任发送方回执。资源字节由接收方预先审核部署，包不能注册资源。此方式提供内容交付和完整性检查，不提供发送者签名、远程账户系统或自动部署。

具体 API、预算、恢复和错误处理见 [本地准入说明](../../../docs/content-release.md)。真实双 SDK 的导入/资源释放/迁移/服务重启证据见项目状态台账。它们不代替 Agent G3、完整玩法或移动真机 Gate。
