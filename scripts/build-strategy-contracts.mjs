import {writeFileSync} from 'node:fs';
const int=(minimum,maximum)=>({type:'integer',minimum,maximum}),str={type:'string',minLength:1,maxLength:64};
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false}),list=(items,maxItems=64)=>({type:'array',items,maxItems});
const path={type:'string',pattern:'^/'},action=str;
const contracts={
 'strategy.economy-loop':obj({statePath:path,goalScore:int(1,1000000),products:list(obj({id:str,cost:int(0,1000000),yield:int(1,1000),reward:int(0,1000000),durationTicks:int(1,1000000),upgradeCost:int(1,1000000),requires:str},['id','cost','yield','reward','durationTicks','upgradeCost'])),actions:list(obj({action,kind:{enum:['plant','collect','buy','upgrade','unlock','place','select','merge']},item:str,index:int(0,255),other:int(0,255),cost:int(0,1000000)},['action','kind']))},['statePath','products','actions']),
 'strategy.path-follow':obj({statePath:path,waypoints:list(obj({x:int(0,32000),y:int(0,32000)})),speed:int(1,128),worldPath:path,bodyId:str},['statePath','waypoints','speed']),
 'turnbased.turn':obj({statePath:path,width:int(1,19),height:int(1,19),players:int(2,4),winLength:int(2,19),selectActions:list(action,361),endTurnAction:action},['statePath','width','height','players','winLength','selectActions']),
 'turnbased.cards':obj({statePath:path,drawAction:action,playActions:list(action,32),maxHand:int(1,32),shuffle:{type:'boolean'},goalScore:int(1,1000000)},['statePath','drawAction','playActions','maxHand','shuffle'])
};
const services=['strategy.economy','strategy.inventory','strategy.cost','strategy.reward','strategy.production','strategy.collect','strategy.upgrade','strategy.unlock','strategy.shop','strategy.placement-grid','strategy.path','strategy.tower','strategy.range','turnbased.legal-move','turnbased.deck','turnbased.hand','turnbased.player-order'];
for(const short of [...Object.keys(contracts),...services]){
 const id='a2game.'+short,behavior=Object.hasOwn(contracts,short);
 const m={format:'a2game-capability',manifestVersion:'0.1.0',id,version:'0.1.0',kind:behavior?'behavior':'service',portability:'exact',description:behavior?`Trusted shared ${short} bounded mechanism; no game-name branches.`:`Internal ${short} service consumed by strategy/turn behavior profiles; not an arbitrary JSON command.`,phase:'simulate',dependencies:[{id:'a2game.core.state',version:'0.1.0'},...(behavior?services.filter(s=>s.split('.')[0]===short.split('.')[0]).map(name=>({id:'a2game.'+name,version:'0.1.0'})):[])],contract:{configSchema:contracts[short]??obj({}),stateSchema:{type:'object'},commands:[],events:behavior?['strategy.changed','strategy.invalid','strategy.collected','strategy.upgraded','strategy.arrived','strategy.detached','turn.changed','turn.invalid','cards.drawn','cards.played'].map(name=>({name,payloadSchema:{type:'object'}})):[],stateWrites:behavior?['global']:[],lifecycle:['initialize','tick','pause','resume','reset','dispose']},limits:{maxPlots:16,maxGridCells:256,maxBoardCells:361,maxCards:128,maxHand:32,maxWaypoints:64,clock:'shared integer tick; turn actions do not advance production independently'},testSuites:['STRATEGY-LIBRARY-001']};
 writeFileSync(`specs/v0.1/capabilities/${id}.capability.json`,JSON.stringify(m,null,2)+'\n');
}
console.log('Wrote 21 strategy/turn contracts.');
