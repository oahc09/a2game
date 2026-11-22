/** Public manifests only. Never reads author games, levels, tests or solutions. */
import {makeRegistry} from '../scripts/registry.mjs';
import {createHash} from 'node:crypto';
export const capabilityKey=ref=>`${ref.id}@${ref.version}`;
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const fault=(code,pointer,message)=>Object.assign(Error(message),{code,diagnostics:[{pointer,message}]});
export function queryCapabilities({query='',offset=0,limit=10}={}){
 if(typeof query!=='string'||query.length>120||!Number.isInteger(offset)||offset<0||offset>1000||!Number.isInteger(limit)||limit<1||limit>20)throw fault('A2G_GEN_CATALOG_QUERY','','能力查询参数超出范围。');
 const q=query.toLowerCase();
 const matchedIds=new Set(aliases.filter(([,pattern])=>pattern.test(q)).flatMap(([, ,ids])=>ids));
 const all=makeRegistry().list().filter(m=>matchedIds.has(m.id)||(m.id+' '+m.description).toLowerCase().includes(q));
 return {total:all.length,offset,capabilities:all.slice(offset,offset+limit).map(m=>({id:m.id,version:m.version,kind:m.kind,description:m.description,status:'REGISTERED_HEADLESS_REFERENCE',platformSupport:'Requires host-specific negotiation'})),modelCalls:0};
}
export function getPublicCapability(ref){const registry=makeRegistry();registry.negotiate({all:[ref]});return registry.get(ref);}
// Aliases identify mechanisms, not levels or winning actions. Unmatched prompts require an explicit plan.
const aliases=[
 ['counter',/counter|计数|点击加分|three.click/i,['a2game.rules.state-add']],
 ['grid-push',/sokoban|grid.push|推箱/i,['a2game.puzzle.grid-push']],
 ['match-three',/match.?3|match.three|三消/i,['a2game.puzzle.swap']],
 ['merge',/merge|合成/i,['a2game.puzzle.merge']],
 ['grid-slide-merge',/2048|滑动合并/i,['a2game.puzzle.grid-slide-merge']],
 ['tower-defense',/tower.defen|塔防|炮台保卫/i,['a2game.strategy.tower-defense']],
 ['shooter',/shoot|shmup|射击|飞机/i,['a2game.realtime.world','a2game.combat.weapon','a2game.combat.projectile','a2game.combat.wave']],
 ['economy',/economy|经营|经济/i,['a2game.strategy.economy']],
 ['economy-loop',/economy.loop|经营|生产循环/i,['a2game.strategy.economy-loop']],
 ['falling-piece',/tetris|俄罗斯方块|落块/i,['a2game.puzzle.falling-piece']],
 ['pair-match',/pair.match|翻牌|记忆配对/i,['a2game.puzzle.pair-match']],
 ['bubble-grid',/bubble|泡泡龙/i,['a2game.combat.bubble-grid']],
 ['turn-based',/turn.based|回合/i,['a2game.turnbased.turn']],
 ['rigid3d',/rigid.?3d|3d.physics|三维物理|3D刚体/i,['a2game.physics.rigid3d']],
 ['runner',/runner|跑酷/i,['a2game.realtime.world','a2game.realtime.lane-move','a2game.realtime.auto-scroll']],
 ['jump',/platformer|jump|跳跃/i,['a2game.realtime.world','a2game.realtime.jump']],
 ['mine-board',/\bminesweeper\b|扫雷/i,['a2game.puzzle.mine-board']],
 ['grid-trail',/\bsnake\b|贪吃蛇/i,['a2game.realtime.grid-trail']],
 ['production-line',/\bproduction[ -]line\b|生产线|工厂产线/i,['a2game.strategy.production-line']],
 ['disk-flip',/\breversi\b|\bothello\b|黑白棋|翻转棋/i,['a2game.turnbased.disk-flip']],
 ['grid-tactics',/\bgrid[ -]tactics\b|网格战术|格子战术/i,['a2game.turnbased.grid-tactics']]
];
const base=['a2game.core.state','a2game.core.rules','a2game.core.flow','a2game.visual.text','a2game.visual.scene2d','a2game.visual.body-style'];
export function closeCapabilities(refs){
 const registry=makeRegistry();
 // Registry is authoritative for implementations, exact versions, conflicts and cycles.
 return registry.negotiate({all:refs}).capabilities;
}
export function selectCapabilities(prompt){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw fault('A2G_GEN_PROMPT','/prompt','需求必须为 1–8000 字符。');
 if(/\b(?:VR|AR|MMORPG)\b|虚拟现实|增强现实|联网对战|互联网多人/i.test(prompt))throw fault('A2G_GEN_UNSUPPORTED_CAPABILITY','/prompt','当前自动规划不支持此目标；请提供经过审核的显式 GamePlan，不会降级玩法。');
 const registry=makeRegistry(),manifests=registry.list(),byId=new Map(manifests.map(m=>[m.id,m]));
 // Prohibitions are not requested mechanics: the benchmark explicitly forbids replacing a game with a counter.
 const intent=prompt.replace(/(?:不能|不得|不要|禁止)[^。；;！!\n]*(?:替代|代替)[^。；;！!\n]*/g,'').replace(/(?:do not|don't|never)[^.\n]*(?:substitut|replac)[^.\n]*/gi,'');
 const refs=[],mechanisms=[];
 const add=id=>{const item=byId.get(id);if(!item)throw fault('A2G_GEN_UNSUPPORTED_CAPABILITY','/capabilities',`能力未注册：${id}`);refs.push({id,version:item.version});};
 for(const [id,pattern,ids] of aliases)if(pattern.test(intent)){mechanisms.push({id,capabilities:ids.map(cap=>({id:cap,version:byId.get(cap)?.version??'0.1.0'})),entities:[],stateRefs:[]});ids.forEach(add);}
 for(const match of prompt.matchAll(/a2game(?:\.[a-z][a-z0-9-]*){2,}(?:@\d+\.\d+\.\d+)?/g)){
  const [id,version]=match[0].split('@'),manifest=byId.get(id);
  if(!manifest)throw fault('A2G_GEN_UNSUPPORTED_CAPABILITY','/prompt',`能力未注册：${id}`);
  const ref={id,version:version??manifest.version};refs.push(ref);
  mechanisms.push({id:`explicit-${mechanisms.length}`,capabilities:[ref],entities:[],stateRefs:[]});
 }
 if(!mechanisms.length)throw fault('A2G_GEN_UNSUPPORTED_CAPABILITY','/prompt','未识别可支持的玩法机制；请使用明确机制名称或提供 GamePlan。');
 base.forEach(add);
 if(/3d|三维/i.test(prompt))add('a2game.visual.stage');
 // Small common instruction vocabulary; parameters/commands still come from selected manifests.
 for(const m of manifests)if(m.kind==='rule-op')add(m.id);
 const sources=['keyboard.button'];
 if(/touch|pointer|触屏|触摸|手机|点选/i.test(prompt))sources.push('touch.tap');
 if(/drag|拖动|拖拽/i.test(prompt))sources.push('touch.drag');
 if(/imu|倾斜|陀螺仪/i.test(prompt))sources.push('imu.tilt','imu.calibration');
 for(const source of sources)add('a2game.input.'+source);
 const capabilities=closeCapabilities(refs);
 return {mechanisms,capabilities,inputSources:sources,catalogDigest:digest(manifests),selectionPolicy:'keyword-alias-v1; conservative host draft, NOT semantic completeness proof'};
}
export function compactCatalog(refs){
 const registry=makeRegistry();return closeCapabilities(refs).map(ref=>{const m=registry.get(ref);return {id:m.id,version:m.version,kind:m.kind,description:m.description,dependencies:m.dependencies,contract:m.contract,limits:m.limits??{}};});
}
