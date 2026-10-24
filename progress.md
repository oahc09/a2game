Original prompt: 1.了解当前项目情况，创建AGENTS.md方便AI快速理解 2.整理工程然后提交git 3.提交完毕开始推进下一阶段主线：使用真实 CocosAirJS 和 Three.js SDK，在浏览器执行相同 JSON，验证输入、状态哈希、画面及资源生命周期。

- 2026-10-24：初始仓库无提交；保留已有规范、源码和历史证据，补充 AGENTS.md 导航、环境与 S2 交接。
- 当前只确认历史 G0/G1 子集；真实 SDK G2 必须由新运行回执证明。
- 执行顺序：工程基线验证及提交 → 真实 SDK 获取/锁定 → HTTP 浏览器与 Node 对照 → 更新状态和证据。
- 工程基线：`npm run verify` 全部通过，55 Node、12 Conformance、7 Schema/27 文档。使用 `.venv` 中 Python 3.14.4；系统 `python` 为商店占位程序。
- 已提交工程基线 `7fe10c3`，之后取得真实 Three.js 0.186.1 与固定 CocosAirJS 源码，本地构建 AIR Build 209。
- 当前 G2 回执：`reports/g2-*-real.json`，最终运行 `g2-2026-10-24T11-56-54-131Z-9708`。16 游戏/尺寸场景 + 2 原生/context 场景 PASS，8 组跨引擎 Hash 一致；所有失败尝试保留。
- 已修复文本裁切、AIR 容器缩放、绘制次序、失效实例重建竞态及 Three context restore 清理警告；最新原生 context 场景无 warning/error。
- 细节与限制见 `reports/g2-implementation-20261024.md`。下一目标 S3/S4；G3、真机和完整 32+5 未验收。不沿用源码更改前的 G2 PASS。
- 收尾 `npm run verify` 全部 PASS，独立日志 `reports/g2-workspace-verify-20261024.log`；技能客户端在两端推箱获胜，tick 3、moves 2、Hash 相同。原始 Conformance 报告保留，当前回执另存。
- 2026-10-24 用户要求按 `specs/v0.1/{docs,schemas,samples}` 组织目录；已迁移完整协议包并同步运行入口。旧证据及历史文档原路径保留，等待新路径的基线与真实 SDK G2 验证。
- 目录迁移完成：49 文件、36 个 Schema/样例内容不变，修复规范总览及历史基线文档的相对链接。`npm run verify` PASS；新路径 G2 运行 `g2-2026-10-24T12-07-53-439Z-48524` 为 16+2 场景 PASS、8 组跨引擎 Hash 一致。迁移证明保存在 `reports/spec-layout-2026-10-24T12-06-54-319Z/`，既有历史报告保留原字节。

- 2026-10-24 S3：完成本地动态 JSON 完整准入、SHA 回执与播放器导入；同源服务以 full Draft 2020-12 + 语义/能力/宿主策略拒绝不支持的内容。Tap/Keyboard config 冲突已跨规范修复。
- 动态变体真实双 SDK 回执：reports/content-2026-10-24T12-36-07-539Z-56252/summary.json；原 G2 复验：reports/g2-2026-10-24T12-37-23-734Z-42892/summary.json。两端截图已人工检查；技能浏览器脚本两端推箱子 tick 3/moves 2/won、Hash 相同且无错误。S3 资源及持久化发布仍待实现。

- 2026-10-24 S3 持久化：本地回执支持服务重启，恢复时重新完整校验；私有存储使用同目录原子重命名，限定单服务写入，兼容 E: exFAT。损坏、旧环境和存储失败拒绝。
- 初次硬链接方案在 exFAT 失败，已调整；验证脚本路径/跳转响应读取问题已修复，失败回执保留。当前真实双 SDK 重启证据：reports/content-2026-10-24T13-03-06-871Z-54276/summary.json；G2 16+2 场景复验：reports/g2-2026-10-24T13-03-38-642Z-47780/summary.json。S3 仍 PARTIAL，资源与远程交付为下一目标。
