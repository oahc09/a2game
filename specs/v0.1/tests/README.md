# 执行合同与测试向量

- `*.conformance.json`：114 份套件、203 个用例，通过 `npm run conformance` 在共享 Runtime 执行。
- `rng-vectors.json`：确定性随机数黄金向量。
- `grid-push-swipe.input-trace.json`：实际用于回放核对的输入合同。
- `negative-fixtures.json`：结构、能力及规则拒绝用例。

原始 JSON 和向量字节随目录迁移保持不变。仅演示格式的合成 Touch/IMU 录制已移到 `../examples/input-traces/`，仍接受完整 Schema 检查，不计真机证据。
