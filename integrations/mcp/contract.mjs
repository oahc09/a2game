import {z} from 'zod';
export const mcpToolContractVersion=1;
const id=z.string().uuid(),prompt=z.string().trim().min(1).max(8000),mode=z.enum(['direct-json','game-plan']);
const artifact={artifactId:id};
export const contracts={
 'a2game.list_capabilities':{description:'查询当前受信 Registry 的能力；不调用模型。平台来源仍需对应 Host 支持。',schema:z.object({query:z.string().max(120).optional(),offset:z.number().int().min(0).max(1000).default(0),limit:z.number().int().min(1).max(20).default(10)}).strict()},
 'a2game.get_capability':{description:'读取已注册能力的公开合同和依赖；不读取任意文件。',schema:z.object({id:z.string().regex(/^a2game(?:\.[a-z][a-z0-9-]*){2,}$/),version:z.string().regex(/^\d+\.\d+\.\d+$/)}).strict()},
 'a2game.plan_game':{description:'创建宿主关键词 GamePlan 草案；不是模型规划或最终玩法证明。',schema:z.object({prompt}).strict()},
 'a2game.generate_game':{description:'仅显式使用启动时固定的 Provider 和调用额度；默认额度为0。',schema:z.object({prompt,provider:z.enum(['fixture','codex','claude','model-http','http']),mode:mode.default('direct-json'),maxAttempts:z.number().int().min(1).max(3).default(1)}).strict()},
 'a2game.validate_game':{description:'对外部提供的原始 JSON 完整准入，创建会话内不可变 artifact；绝不隐式生成。',schema:z.object({gameJson:z.string().min(2).max(256*1024),conformanceJson:z.string().min(2).max(256*1024).optional(),solutionJson:z.string().min(2).max(128*1024).optional()}).strict()},
 'a2game.test_game':{description:'重验 artifact 的 Conformance、模型自解、Hash 和生命周期；缺少测试则拒绝。',schema:z.object(artifact).strict()},
 'a2game.preview_game':{description:'打开限时 loopback 真实 SDK 预览，或关闭本会话签发的预览；不自动启动外部浏览器。',schema:z.object({action:z.enum(['open','close']),artifactId:id.optional(),backend:z.enum(['air','three']).optional(),previewId:id.optional()}).strict()},
 'a2game.inspect_game':{description:'返回 artifact 的内容 SHA、验证/测试状态、精确 Hash 和预览摘要。',schema:z.object(artifact).strict()},
 'a2game.export_game':{description:'将已通过测试的 artifact 导出为不覆盖旧文件的受控内容包；接收方仍需兼容宿主/SDK/资源。',schema:z.object({...artifact,format:z.literal('package').default('package')}).strict()}
};
export const resultSchema=z.object({mcpToolContractVersion:z.literal(1),runId:id,status:z.enum(['PASS_REFERENCE','FAIL','BLOCKED','NOT_RUN']),diagnostics:z.array(z.object({code:z.string(),stage:z.string(),message:z.string(),jsonPointer:z.string().max(256).optional(),capabilityId:z.string().max(128).optional(),ruleId:z.string().max(128).optional(),caseId:z.string().max(128).optional(),expected:z.union([z.string().max(80),z.number(),z.boolean(),z.null()]).optional(),actual:z.union([z.string().max(80),z.number(),z.boolean(),z.null()]).optional(),repairHint:z.string().max(500).optional()})),data:z.record(z.string(),z.unknown()).optional()}).strict();
