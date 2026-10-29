# 协议资产按用途分层

2026-10-29 将 `specs/v0.1/samples/` 拆为一级 `capabilities/`、`adapters/`、`games/`、`tests/`、`coverage/` 和 `examples/`。运行时代码、浏览器能力加载、白名单目录、数据生成器、校验脚本和当前文档使用新位置；原有 `docs/`、`schemas/`、`tools/` 保留。

迁移保持 362 份资产的原始字节不变：127 能力、112 游戏、3 个适配器、32 款登记所在的 1 个文件、117 份执行测试/向量，以及 2 份格式示例。`org.a2game.samples.*` 是稳定内容 ID，继续保留；项目仍为 Alpha 参考实现，正式 verified/G3/人工/真机口径不变。

## 目录和加载

当前播放器只使用新 HTTP 路径，如 `/specs/v0.1/capabilities/a2game.core.state.capability.json` 和 `/specs/v0.1/games/tap-target.game.json`。旧 `/samples/` URL 不再提供；没有复制一套资产或创建符号链接，避免两份清单漂移。静态服务继续限制公开资产根，不公开 `tools/`、仓库配置或私有内容。

112 份游戏的相对 `../tests/` 和套件的 `../games/` 仍保持对应关系。真正的格式示例只有 `examples/coverage/not-run.receipt.json` 和 `examples/input-traces/touch-imu.input-trace.json`，校验器同时覆盖 `tests` 与 `examples` 的录制数据。

`project/capability-bindings.json` 记录每项能力的精确版本、可信绑定角色、依赖闭包和测试声明。可执行用例引用、规范编号和未解析声明分别记录；缺少独立执行回执时不标为 verified。它与 `player/capability-index.json` 由同一构建入口生成，不替代 Manifest 或正式验收记录。

当前 127 项均有可信绑定；138 条测试声明引用中，98 条可定位到可执行 Conformance 用例、10 条定位到规范编号、30 条（16 个不同编号）尚无统一可执行映射。后者不直接表示实现缺失，仍需将现有 Node/浏览器测试与声明编号逐项绑定，不能假装 127 项都已有独立正式签收。

## 历史证据保持不可变

旧报告、截图、解法、Golden Vector 和既有证据包不改写。`project/spec-layout-migration.json` 保存迁移前提交、旧/新路径、前后 SHA 和精确路径替换位置。

`scripts/spec-layout.mjs` 对旧路径执行有限映射；当源码字节因路径替换不同，必须同时满足迁移前 SHA、当前 SHA，并且按记录撤销的每一处都属于固定路径替换，最终还原字节的 SHA 必须等于旧回执。任意算法、断言或其他语义修改仍使旧源码证据失效；不能手改迁移后的 SHA 绕过旧 SHA。

两份历史审计工具 `final-acceptance-audit.mjs`、`g3-codex-report.mjs` 因新增迁移读取逻辑不属于纯路径修改。它们的原始字节保存在 `project/spec-layout-history/`，仅供旧档案核验当时使用的报告生成/审计来源，不作为当前 Runtime 指纹的替代。当前审计实现另行运行回归和治理验证。

原始报告中的 sourceCommit 和文件路径继续描述历史执行；目录等价性核验不是新模型调用、不是重新完成整款游戏验收。原有便携包仍用于其冻结范围，新迁移验证记录另存本地。

## 本次验证

- `npm run verify`：项目治理、122 项 Node 测试、静态引用、360 份完整 Schema 文档、114 套件 / 203 个 Conformance 用例，以及 112 游戏与 127 能力的目录构建全部通过；默认历史回执在运行后还原，当前结果另存 `reports/spec-layout-validation-2026-10-29T08-53-59-918Z-23272/`。
- 真实浏览器：Three.js / CocosAirJS 各从新 URL 读取内置推箱子与全部 127 个能力声明，通过键盘获胜、Node/Host exactHash、重开、390px 无横向溢出和 owned 资源归零。回执为 `reports/spec-layout-browser-2026-10-29T08-55-42-979Z-21276/summary.json`，桌面终局和移动端截图已查看。
- 浏览器首轮在目录白名单正则中发现未迁移的旧路径，失败回执保留在 `reports/spec-layout-browser-2026-10-29T08-52-46-053Z-19896/`；修复后另开运行，不覆盖失败。
- 原 3,332 文件独立 G3 档案仍按原 SHA / 严格目录等价性核验，正式通过数保持 0；本轮生成调用 0，真机仍暂缓。
