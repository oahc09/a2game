# 当前能力目录

本目录的 127 份 `*.capability.json` 是共享 Runtime 和浏览器实际读取的能力声明，协议版本均为 `0.1.0`。它们包含行为模块、内置服务、输入识别、规则操作和表现合同，不能按文件数理解为 127 套独立完整算法。

- 声明须与 `src/trusted-modules.ts`、Runtime 内置实现和输入/表现实现匹配；加载 JSON 不能注册任意代码。
- `requires.all` / `requires.anyOf` 采用精确版本与依赖闭包协商，未知能力、无可信实现或不兼容配置拒绝加载。
- 当前绑定与测试来源见 [`project/capability-bindings.json`](../../../project/capability-bindings.json)，由 `npm run catalog:build` 重建。未解析测试声明保留为待补项，不伪造已执行回执。
- `docs/02` 的未来能力候选不是本目录的已实现清单。跨宿主、真机、完整玩法和正式 G3 仍按各自 Gate 验收。
