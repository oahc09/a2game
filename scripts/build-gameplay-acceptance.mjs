/** Explicit per-identity DoD and one focused boundary; never infers full coverage from a sample. */
import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const candidates=read('project/game-candidates.json').cases,variants=read('project/rule-variants.json').cases;
const a=(action,ticks=1,value)=>({action,ticks,...(value===undefined?{}:{value})}),wait=ticks=>({ticks}),check=(path,equals)=>({path,equals});
const pointer=(kind,id,u,v)=>({source:'pointer',kind,payload:{pointerId:id,u,v,viewportAspect:1.25}});
const data=[
 ['G01','推箱、全部目标、非法推动原子不变、可撤销与重新解题', [a('moveUp'),a('moveRight'),a('moveRight')],[check('/boxes',[13]),check('/moves',2)], 'playing','多关路线、死锁提示与实际手势全流程'],
 ['G02','单次合并、种子补位、无效移动不消耗随机、撤销恢复随机与无路失败', [a('moveLeft'),a('undo'),a('moveLeft')],[check('/best',2),check('/stalled',false)],'playing','标准双小块开局到目标、无合法步失败及长期随机对局'],
 ['G03','相邻交换、无匹配回滚、连锁、重力补位与目标分数', [a('cell0'),a('cell3')],[check('/puzzle/moves',0),check('/puzzle/selected',[])],'playing','多阶段目标、移动预算和拖动交换完整体验'],
 ['G04','覆盖牌禁选、托盘容量、三张先消后判满与清空目标', [a('cell1'),a('cell2'),a('cell3'),a('cell4')],[check('/puzzle/tray',[2,1,2,1])],'lost','更多布局与失败后撤销/重试体验'],
 ['G05','上层遮挡、双侧封闭、配对次序与撤销恢复遮挡', [a('cell4'),a('cell7'),a('undo'),a('cell0')],[check('/puzzle/moves',1),check('/puzzle/board/0',1)],'playing','更大可解牌局、无可配对终局与层次视觉'],
 ['G06','四方向射线阻挡、移除次序、空格和边界处理', [1,3,0,3,3,1].map(i=>a('cell'+i)),[check('/puzzle/moves',2),check('/puzzle/score',2),check('/puzzle/board/0',0),check('/puzzle/board/3',0),check('/puzzle/board/1',1)],'playing','更多可解的二维混合箭头布局'],
 ['G07','配对移除、错配延迟翻回、快速第三点禁选与计时', [a('cell0'),a('cell1'),a('cell2'),wait(60)],[check('/puzzle/selected',[]),check('/puzzle/moves',2)],'playing','随机牌局、配对计时/失败标准和实际触摸快点'],
 ['G08','多格原子放置、旋转、越界拒绝及同时行列消除', [a('cell1'),a('cell0')],[check('/puzzle/moves',1),check('/puzzle/score',1)],'playing','持续手牌、无可放置失败与拖拽预览'],
 ['G09','旋转碰撞、移动边界、重力锁定、消行与顶出失败', [a('left'),a('left'),a('left')],[check('/puzzle/anchor',0)],'playing','标准七种拼块、多块连续局、难度/速度和顶部失败'],
 ['G10','命中选择、物品与目标匹配、错放原子拒绝、归位完成', [a('cell0'),a('cell3'),a('cell0'),a('cell1')],[check('/puzzle/moves',1),check('/puzzle/board',[0,1,2,0])],'playing','完整拖拽拾放、可辨识物品资源与多目标关卡'],
 ['G11','按压时长决定跳跃、落地/坠落、连续平台与连击', [wait(1),{raw:[{source:'keyboard',kind:'down',payload:{code:'Space'}}],ticks:5},{raw:[{source:'keyboard',kind:'cancel',payload:{code:'Space'}}],ticks:1}],[check('/world/score',0),check('/world/charge',0)],'playing','连续平台、中心落点/连击与蓄力可视反馈'],
 ['G12','拍翼/重力、门触发只计一次、障碍碰撞和坠落失败', [{...a('flap',20),checks:[check('/world/score',0)]},wait(4),a('flap',2)],[check('/world/score',1)],'playing','真正门柱碰撞、持续生成/难度及通过门线计分'],
 ['G13','有限换道、滚动障碍、波次、检查点与暂停恢复', [a('left'),a('left'),a('left')],[check('/world/bodies/0/x',2000)],'playing','持续障碍/检查点、道路视觉与多段难度曲线'],
 ['G14','移动挡板、反弹、砖块生命、漏球与关卡推进', [wait(60)],[check('/world/score',0)],'lost','多砖布局、方向反弹、关卡推进与快速拖动接球'],
 ['G15','三维球体/边界反弹、有序触发及能量/生命周期', [a('kick',1),a('kick',1)],[check('/rigid/launched',true),check('/rigid/score',0)],'playing','更多弹板机关与关卡布局'],
 ['G16','放置同值体、接触合成一次、实体替换及溢出失败', [a('drop',60),a('drop',60)],[check('/world/score',4),check('/control/spawned',2)],'playing','连贯掉落队列、溢出线/完整失败循环与堆叠体验'],
 ['G17','独立移动、弹丸发射节奏、波次、敌我伤害和弹丸回收', [a('fire',80)],[check('/world/nextId',1),check('/world/score',0)],'playing','连续波次、敌弹/生命与完整射击生存循环'],
 ['G18','二维移动与瞄准分离、射线遮挡、冷却及生命/伤害', [{raw:[{source:'keyboard',kind:'down',payload:{code:'KeyA'}},{source:'keyboard',kind:'down',payload:{code:'KeyW'}}],ticks:5},{raw:[{source:'keyboard',kind:'up',payload:{code:'KeyA'}},{source:'keyboard',kind:'cancel',payload:{code:'KeyW'}}],ticks:2}],[check('/world/score',0)],'playing','双摇杆/指针移动与瞄准同时输入、场景障碍及生存循环'],
 ['G19','自动索敌稳定顺序、敌群追踪、升级与技能/生存', [a('plant'),a('upgrade')],[check('/economy/plots/0/level',0)],'playing','移动生存、连续敌群、技能选择和跨局成长'],
 ['G20','瞄准、反弹、吸附、连接消除与失去支撑坠落', [a('fire'),a('fire')],[check('/bubble/ammo',0)],'playing','银行反弹射击、持续弹药/棋盘推进与瞄准轨迹'],
 ['G21','建塔/路径/范围/冷却、多波敌人、奖励及漏怪失败', [a('place0'),a('place0')],[check('/defense/wallet',2),check('/defense/towers/0/cell',0)],'playing','完整布局策略、多个塔种/路线与逐波质量审查'],
 ['G22','播种成本、成熟计时、收获去重、重复生产与存档恢复', [a('plant'),a('collect')],[check('/economy/score',0)],'playing','可操作生产时长、多地块/循环和该玩法存档实证'],
 ['G23','合成后生产链、经济消耗/回报、解锁与库存一致', [a('select0'),{actions:[{action:'merge1',phase:'press'},{action:'merge1',phase:'release'},{action:'plant',phase:'press'},{action:'plant',phase:'release'}],ticks:1},a('merge1'),a('collect')],[check('/economy/score',2),check('/economy/wallet',10),check('/economy/plots/0/item',''),check('/economy/plots/0/level',1)],'playing','更多产品与工厂布局'],
 ['G24','合法落子/轮换、横竖双斜胜负、和棋与终局冻结', [a('cell0'),a('cell0'),a('cell5')],[check('/turn/moves',2),check('/turn/player',1)],'playing','横竖双斜/和棋逐项验收及完整棋局交互'],
 ['G25','轨迹低采样交点、每果只计一次、炸弹及时间/漏果', [{raw:[pointer('down',1,0.25,0.5)],ticks:1},{raw:[pointer('move',1,0.46,0.5)],ticks:1},{raw:[pointer('move',1,0.25,0.5)],ticks:1}],[check('/control/score',2)],'playing','动态水果/漏果/时间循环及实际设备轨迹'],
 ['G26','双指归属、角度与缩放、取消释放、匹配姿态再归位', [a('rotate',1,0.2),a('pinch',1,1.5),...[0,1,2,3].map(i=>a('cell'+i))],[check('/puzzle/won',true),check('/control/won',false)],'playing','真实双指手势全流程、重抓归属与设备验收'],
 ['G27','倾斜/回退移动、碰撞、目标、校准和权限失联', candidates.find(r=>r.id==='G27').negative,[check('/world/bodies/1/x',3700)],'playing','多路径迷宫、传感器失联场景与真机权限/校准'],
 ['G28','真实三维刚体放置、角速度/旋转、碰撞支撑与倾覆', [a('drop',90)],[check('/rigid/placed',1),check('/rigid/won',false)],'playing','更多真实几何与堆叠布局'],
 ['G29','摇动去抖、能量消费/解锁、超时/失联与回退', [a('shakeFallback'),a('unlock')],[check('/economy/wallet',1),check('/economy/unlocked',[])],'playing','真实摇动去抖/失联、方向变化和设备回退'],
 ['G30','拉力/方向、释放恰好发射一次、多指/取消中断', candidates.find(r=>r.id==='G30').negative,[check('/world/nextId',0),check('/control/grabbing',false)],'lost','拉弓预览/力度可视化、实际拖动和多靶关卡'],
 ['G31','姿态零点/屏幕方向、独立射击、命中和传感器回退', [a('orientation',1,[0,0,0]),a('fire',10)],[check('/world/score',0)],'playing','真实姿态校准与旋转屏幕后零点一致、动态靶场'],
 ['G32','指定指数量和时长、cancel 清空保持、超时及重试', [{raw:[pointer('down',1,0.3,0.5),pointer('down',2,0.7,0.5)],ticks:15},{raw:[pointer('cancel',2,0.7,0.5)],ticks:20}],[check('/opened',false)],'playing','分区机关/进度反馈、设备多指和焦点取消验收'],
 ['H01','合成实体替换/旧武器释放、冷却继承、波次与经济时序', [a('place0'),a('place1'),a('select0'),a('merge1'),a('merge1')],[check('/defense/towers/0/level',2)],'playing','合成策略、多种波次与完整手动交互质量'],
 ['H02','消除奖励跨阶段到账、升级影响角色、HUD 与伤害同步', [a('fire'),...candidates.find(r=>r.id==='H02').negative,a('upgrade'),a('upgrade'),a('fire')],[check('/economy/plots/0/level',1),check('/economy/wallet',1),check('/combat/nextDamage',2),check('/combat/lastDamage',2),check('/combat/targetHP',1)],'playing','更多角色与可选升级路线'],
 ['H03','移动/开火并发分区、唯一 Tick、弹丸生命周期及跑酷障碍', [{raw:[pointer('down',1,0.2,0.5),pointer('down',2,0.8,0.5)],ticks:1}],[check('/control/laneSignal',-1),check('/control/fireRequest',true)],'playing','真正跑酷滚动障碍及弹丸回收，双指原始事件归属及镜像分区'],
 ['H04','倾斜/回退施力、合成去重、物理状态同步、权限校准', [wait(20)],[check('/world/score',0),check('/control/usedInput',false)],'playing','完整物理合成循环与真机倾斜/权限回退'],
 ['H05','找物 HitTest、限时冻结、成功/超时同 Tick 裁决及重试', [wait(1),{pause:true,ticks:5000,resume:true},a('cell0'),a('cell3')],[check('/timeout',false),check('/puzzle/moves',0)],'playing','资源化找物场景、实际拖动命中与手动质量审查']
];
// Mandatory gaps follow the frozen registry/DoD. Extra level/content ideas below are not gates.
const mustClose={};
const cases=data.map(([id,completion,steps,checks,expected,idea])=>{
 const base=candidates.find(r=>r.id===id),variant=variants.find(r=>r.id===id);
 return {id,title:base.title,game:`specs/v0.1/samples/games/${base.name}.game.json`,variant:`specs/v0.1/samples/games/${variant.name}.game.json`,completion,boundary:{id:id+'-BOUNDARY',steps,checks,expected},remainingGameplay:mustClose[id]??[],...(read('project/input-gameplay-profiles.json').profiles[id]?{nativeInputProfile:read('project/input-gameplay-profiles.json').profiles[id]}:{}),implementedGameplay:({G25:['动态水果/漏果、连贯低采样实际轨迹、去重/炸弹与失败重试'],G26:['CDP 双触旋转/缩放、取消与新指对相对基准、姿态与归位同时完成'],G27:['虚拟权限、校准/屏幕方向/样本失联清零、实际鼠标绕墙回退'],G29:['合成 Motion 原始 Shake 冷却去抖、停止后忽略及键盘能量回退'],G30:['实际拖动拉力、取消/多指清零、不发射与一次释放一弹'],G31:['合成姿态零点/屏幕重校准、独立命中、失联清零与鼠标回退'],G32:['CDP 指数量与完整保持时长、cancel/blur 清空及重新完整计时'],H04:['虚拟 Tilt 与实际整数重力同步、失联不再加速及回退合成去重'],G02:['双小块标准开局完整 2048/4096、随机补位/撤销与无路失败'],G16:['四球分级合成到 8、错序堆叠溢出及重开回收'],G18:['WASD 与独立瞄准、真实墙体遮挡/绕行及装甲冷却'],G19:['三波追踪敌群、一次性技能实际增伤、到期恢复与升级'],G20:['轨迹预览、侧墙反弹后吸附、连接消除及悬挂掉落'],G22:['两/三轮成熟生产、去重收获、玩法回放存档恢复与兼容拒绝'],H05:['审核 PNG 苹果/钥匙资源、真实 HitTest 拖放、倒计时与截止裁决'],G15:['锁定真实三维刚体求解、球体/边界反弹与有序双触发'],G28:['真实三维碰撞堆叠、角速度/旋转倾覆、三/四块稳定放置'],G11:['连续三平台、中心连击奖励、偏心重置、过度蓄力坠落及远距变体'],G24:['横竖双斜五连、合法满盘和棋/中立结束、同 Tick 终局拒绝与画布落子'],G06:['3×3 四向射线、上/下阻挡与出界移除、空格重选及镜像布局'],G13:['固定三车道边界、三段滚动障碍、两个有序检查点、TTL 回收及镜像路线'],H03:['跑酷/双区同时输入、延后一 Tick 请求、真实弹丸击敌/障碍拦截及全部临时对象回收'],G09:['四个 tetromino 连续局、重力锁定/硬降、旋转消四行及即时顶出'],G12:['上下门柱真实碰撞、身体越过门柱后计分、死亡无分及三道门变体'],G23:['合成解锁工厂、成本/成熟/重复收集、双倍产量与两轮生产'],H02:['三消到账、付费升级、下一 Tick 实际增伤、同 Tick 旧伤害及 HUD/生命同步']})[id]??[],futureIdeas:[({"G02":"更多种子的长期对局","G16":"更多掉落队列与关卡布局","G18":"双摇杆设备与更长生存关卡","G19":"更多波次、技能选择与跨局成长","G20":"更多弹药轮次和棋盘推进","G22":"更多地块/产品与长周期生产","G25":"更多动态波次与适用设备轨迹","G26":"更多拼图布局和设备双指验收","G27":"更多迷宫路径和适用设备验收","G29":"更多机关组合和适用设备验收","G30":"更多目标布局与设备拖动验收","G31":"动态靶场与设备姿态验收","G32":"分区机关与设备多指验收","H04":"更多物理合成布局和适用设备验收","H05":"更多资源场景与人工交互质量"})[id]??idea],quality:{visualReview:'NOT_RUN',nativeInteraction:'NOT_RUN'},independentG3:'NOT_RUN',physical:/^G(2[5-9]|3[0-2])$/.test(id)||['H03','H04'].includes(id)?'DEFERRED_BY_USER':'NOT_APPLICABLE',fullAcceptance:'PARTIAL',verified:false};
});
const imu=(kind,orientationRad=[0,0,0])=>({source:'imu',kind,payload:{reference:'device-euler-rad-v1',screenAngle:0,orientationRad,linearAccelerationMps2:[0,0,0],angularVelocityRadps:[0,0,0],available:{orientation:true,linearAcceleration:true,angularVelocity:true}}});
const additional={
 G27:[{name:'calibration-loss-fallback',steps:[{raw:[imu('calibrate')],ticks:1},{raw:[imu('sample',[0,0,.7])],ticks:1,checks:[check('/control/axis/0',.25)]},{raw:[{source:'imu',kind:'reset',payload:{}}],ticks:1,checks:[check('/control/axis',[0,0])]},...candidates.find(r=>r.id==='G27').steps],expected:'won',checks:[check('/world/score',1)]}],
 G31:[{name:'pose-loss-fallback',steps:[{raw:[imu('calibrate')],ticks:1},{raw:[imu('sample',[0,0,Math.PI/2])],ticks:1,checks:[check('/control/aim/1',1)]},{raw:[{source:'imu',kind:'reset',payload:{}}],ticks:1,checks:[check('/control/aim',[0,0])]},...candidates.find(r=>r.id==='G31').steps],expected:'won',checks:[check('/world/score',1)]}],
 G25:[{name:'missed-moving-fruit',steps:[wait(180)],expected:'lost',checks:[check('/control/lost',true),check('/control/score',0)]}],
 G11:[{name:'off-center-reset',steps:[wait(1),{raw:[{source:'keyboard',kind:'down',payload:{code:'Space'}}],ticks:4},{raw:[{source:'keyboard',kind:'up',payload:{code:'Space'}}],ticks:60},a('charge',60)],expected:'won',checks:[check('/jump/landings',2),check('/jump/combo',0),check('/jump/bestCombo',1),check('/jump/score',3)],hudIncludes:['连击 0']}],
 G24:[
  {name:'vertical-terminal-batch',steps:[0,1,5,2,10,3,15,4].map(i=>a('cell'+i)).concat([{actions:[{action:'cell20',phase:'press'},{action:'cell20',phase:'release'},{action:'cell24',phase:'press'},{action:'cell24',phase:'release'}],ticks:1}]),expected:'won',checks:[check('/turn/winner',1),check('/turn/moves',9),check('/turn/board/24',0)]},
  {name:'diagonal-down',steps:[0,1,6,2,12,3,18,4,24].map(i=>a('cell'+i)),expected:'won',checks:[check('/turn/winner',1),check('/turn/moves',9)]},
  {name:'diagonal-up',steps:[4,0,8,1,12,2,16,3,20].map(i=>a('cell'+i)),expected:'won',checks:[check('/turn/winner',1),check('/turn/moves',9)]}
 ]
};
const drawBoard=[1,1,2,2,1,2,2,1,1,2,1,1,2,2,1,2,2,1,1,2,1,1,2,2,1],ones=[],twos=[];drawBoard.forEach((v,i)=>(v===1?ones:twos).push(i));
additional.G24.push({name:'full-board-draw',steps:ones.flatMap((v,i)=>[v,...(i<twos.length?[twos[i]]:[])]).map(i=>a('cell'+i)),expected:'stopped',checks:[check('/turn/board',drawBoard),check('/turn/moves',25),check('/turn/winner',0),check('/turn/draw',true)],hudIncludes:['和棋 true']});
for(const row of cases)if(additional[row.id]){
 row.additionalScenarios=additional[row.id];const path='specs/v0.1/samples/tests/'+row.id.toLowerCase()+'-candidate.conformance.json',suite=read(path);
 suite.cases=suite.cases.filter(c=>!c.id.startsWith('PER-GAME-'));
 for(const scenario of row.additionalScenarios){const operations=scenario.steps.flatMap(step=>[...(step.action?[{op:'injectAction',action:step.action,phase:'press',...(step.value===undefined?{}:{value:step.value})},{op:'injectAction',action:step.action,phase:'release'}]:[]),...(step.actions??[]).map(a=>({op:'injectAction',...a})),...(step.raw??[]).map(raw=>({op:'injectRaw',raw})),{op:'step',ticks:step.ticks??1},...(step.checks??[]).map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals}))]);suite.cases.push({id:'PER-GAME-'+row.id+'-'+scenario.name.toUpperCase(),seed:42,steps:[{op:'start'},...operations,...scenario.checks.map(c=>({op:'assert',path:'/state'+c.path,equals:c.equals})),{op:'assert',path:'/flow/status',equals:scenario.expected}]});}save(path,suite);
}
if(cases.length!==37||new Set(cases.map(r=>r.id)).size!==37)throw Error('Missing frozen identity');
save('project/gameplay-acceptance.json',{format:'a2game-gameplay-acceptance',formatVersion:1,asOf:'2026-10-27',scope:'Per-game DoD and focused boundary evidence; authored variants do not satisfy independent G3; physical work deferred.',verifiedGames:0,verifiedHybrids:0,cases});
console.log('Wrote 37 explicit per-game DoD/boundary contracts.');
