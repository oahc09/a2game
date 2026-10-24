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
