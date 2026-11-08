# A2Game Skill 元数据与分发修复（2026-11-08）

已按用户授权修复skill-checker的5项项目策略缺项：license、compatibility、metadata、allowed-tools及agents/openai.yaml。技能声明MIT，许可证副本来自根目录LICENSE，版权署名为oahc09；用户已在根LICENSE为MIT、package.json为UNLICENSED的冲突下明确选择技能采用MIT。本轮不改主项目package.json或其他产物的许可元数据。

metadata包含作者、技能版本1.0.0、更新日期、关键词及中英文描述；compatibility说明实际CLI/SDK前置条件。工具元数据不授予权限，实际调用沿用宿主Schema、用户授权、原模型路由/预算和数据边界。没有新增Provider调用、MCP强制依赖、hooks、模型覆盖或宿主全局配置。

Codex界面配置包含display_name、short_description、引用$a2game的default_prompt，显式allow_implicit_invocation=true，沿用自动匹配默认。第一次修复复检给出“正文仅明确调用/配置隐式调用”的质量提示，实际匹配的是专用非法推动Profile的条件。已澄清**整个技能可自动匹配，专用Profile仍须控制端给出同名要求**，没有削弱专用门禁或修改检查器规则；初次提示报告保留。

## 分发链路

- 原有6份Markdown加agents/openai.yaml、LICENSE，共8文件。
- ZIP、项目安装器与TRAE样例同步器只额外放行上述两个精确路径，未放宽为任意YAML或可执行文件。
- 公开创作capsule完整绑定8文件；历史3/6文件v2与v1保持可读，不接受半套新元数据、篡改或额外文件。
- 源码身份将YAML及技能LICENSE计入指纹；旧回执保持原SHA，不因补元数据重签为当前验收。
- .agents、.trae、.codebuddy三处已有项目副本及两个连接器样例同步；本轮不是新全局安装或新宿主自动触发证据。

## 验证

1. skill-checker 1.1.1，codex profile、--fail-on-audit：源码和ZIP实际解压目录均**通过，0严重/0一般，规范/项目策略/质量通过，安全allow**。各静态扫描7文件、1文件跳过、incomplete=false；静态allow不证明全部安全。
2. `test/host-public-workspace.test.mjs`、`test/host-agent-run.test.mjs`、`test/simulated-host-acceptance.test.mjs`：58项，56通过、2文件symlink场景因平台权限跳过、0失败；目录junction拒绝场景实际执行。新增元数据/许可证身份与历史布局兼容检查，复用既有合同，没有扩大为全量验收。
3. 五处副本/源码/ZIP逐文件SHA一致；ZIP逐项原字节往返通过，解压后checker再次通过。
4. 真实公开capsule搬运/验证通过，8个Skill成员与包回执完全一致，元数据和许可证没有丢失。

主HTML与ZIP HTML报告、测试原始日志、公开capsule及新包由`project/status.json.skillPolicyRepairRun`索引。旧5严重项报告与中间1提示报告保留。未调用额外Provider，未运行新游戏/浏览器实测/远端CI或升级正式G3。本轮未提交或推送，也未再次永久删除此前隔离的临时产物。

提交范围说明：本次仅提交checker元数据、许可、条件措辞澄清及分发修复；此前未提交的Skill正文重组、引用指南与其他创作改动继续留在工作区。上述源码/ZIP报告记录当时完整工作区包，不能作为本次选择性提交树的逐字节回执；提交候选另做定向checker核对。

选择性提交候选的独立导出复检：codex checker为0严重/0一般、静态allow（7扫描/1跳过），相关回归56通过/2平台跳过/0失败。记录位于`output/skill-repair-commit-6a0f8548-a97a-43dd-a281-bf7134970598`（`staged-skill-report.html`及`candidate-tests-ready.log`）；隔离目录最初缺少依赖/构建产物的启动失败单独保留，补环境后通过。
