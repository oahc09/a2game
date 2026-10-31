# Generator Batch B：能力选择、规划与有界修复

`direct-json` 选取公开能力后直接请求 JSON；`game-plan` 先创建或导入 GamePlan，再校验并交给同一个 Provider 编译。两条路径共用权威的完整 Schema、Content Release、Conformance 和求解/回放。此批不更改 Runtime、协议、Manifest、SDK 或既有模型路由。

默认规划器为 `HOST_KEYWORD_DRAFT`：它根据明确机制别名匹配能力，不调用模型、不读取作者游戏/测试/解法。它不是语义理解模型。支持的别名覆盖推箱子、三消、合成、2048、塔防、射击、经营、落块、翻牌、泡泡龙、回合、刚体、跑酷、跳跃与工程计数；复合需求不一定完整识别，未匹配或明确超出当前 Profile 的目标拒绝。可以用显式 GamePlan 补足，而不是静默换游戏。

`generator/game-plan.schema.json` 是内部版本 1 Schema，采用完整 Draft 2020-12 校验。所有能力通过现有 Registry 检查可信绑定、精确版本、冲突和依赖闭包。机制引用必须在能力/实体/状态集合内；输入来源须与选中能力和 HostProfile 一致；未满足能力阻止生成。默认草案不填关卡常量、棋盘、实体初始状态或解法。

生成内容必须使用规划的能力、绑定相应行为组件、提供规划输入，且包含显式声明的实体/状态；额外未选能力会被拒绝，需修改规划后重新生成。规则/结果的详细语义、目标描述是否充分实现仍需实际测试和独立审查。GamePlan 不执行脚本，也不由 Player 加载。

请求保留完整 GameSpec/Conformance Schema。仅精简能力目录，附上每项完整参数、命令和依赖；回执测量的是 Provider 包装之前的请求字节和能力数量。Codex 等 Adapter 仍可加入既有公开 HostProfile/通用实现说明，不能据此声称实际 Token、费用或生成成功率已改善。两种模式的真实模型对比属于后续 GEN-7；GEN-2 的原始结果不会被追记为新模式验收。

修复上限仍为 1–3 次、总超时 100–600000 ms。旧失败与每次原始回复私有保留，下一次仅收到同轮当前 Provider 输出和有界诊断。公开回执区分 `INPUT_SPEC`、`PROVIDER_INFRA`、`GENERATION_FORMAT`、`CAPABILITY_SEMANTICS`、`GAMEPLAY_CONFORMANCE` 和 `SECURITY_POLICY`；Host、视觉与人工维度独立待验。HTTP 本机 mock 的调用是测试端点请求，不能计作真实模型调用。

新增 Headless 生命周期回执：暂停不推进、终局拒绝输入、终局不推进 Tick、重开恢复初态和相同解法 Hash、独立 Session 回放、重复销毁及销毁后执行拒绝。按游戏声明 Seed 和 Conformance 指定 Seed 执行，不证明任意种子均可通关。自触发事件规则遵循现有延迟下一 Tick 的合同；不会为了拒绝“循环”而禁止合法有界事件玩法。

工程验证使用明确标记的固定计数夹具，两个模式应生成同一 GameSpec。额外测试覆盖规划 Schema/重复键、引用/版本/依赖错误、格式修复、未知能力、任意脚本、伪造 PASS 和用计数替换推箱子。真实浏览器分别验证两种模式、两个 SDK、桌面和 390px 输入、Hash、重开、资源释放。所有结果限于参考范围，正式 G3、人工作品质量、真机与真实模型两模式成绩不自动升级。

运行记录见 [独立 Generator 台账](../project/generator-status.json) 的 `batchB`。新增模型预算仍为 0；本地工程夹具和 HTTP mock 不消耗或补充 GEN-2 的 3 次预算。
