import { fail } from '../errors.js';
import { readPointer, safeInteger } from '../utils.js';
import type { ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

/** Sokoban-style atomic grid pushing, independent of input devices or renderer. */
export function simulateGridPush(ctx:ModuleContext):ModuleResult {
    const config=ctx.config;
    const width=config.width,height=config.height;
    if(!safeInteger(width)||!safeInteger(height)||width<3||height<3||width>32||height>32)fail('A2G_E_CAP_CONFIG','Invalid push board dimensions');
    const get=(key:string)=>{
        const path=config[key];
        if(typeof path!=='string'||!path.startsWith('/'))fail('A2G_E_CAP_CONFIG',`Missing ${key}`);
        return readPointer(ctx.world.state,path);
    };
    const cells=width*height;
    const indices=(key:string):number[]=>{
        const result=get(key);
        if(!Array.isArray(result)||result.some(x=>!safeInteger(x)||x<0||x>=cells)||new Set(result).size!==result.length)fail('A2G_E_STATE_TYPE',`${key} must be unique in-bounds indices`);
        return result as number[];
    };
    const walls=indices('wallsPath'),goals=indices('goalsPath');
    const wallSet=new Set(walls);
    if(goals.some(x=>wallSet.has(x)))fail('A2G_E_STATE_TYPE','Goal overlaps wall');
    const boxes=indices('boxesPath');
    const rawPlayer=get('playerPath'),rawMoves=get('movesPath'),rawSolved=get('solvedPath');
    if(!safeInteger(rawPlayer)||rawPlayer<0||rawPlayer>=cells||!safeInteger(rawMoves)||rawMoves<0||typeof rawSolved!=='boolean')fail('A2G_E_STATE_TYPE','Invalid player/moves/solved state');
    let player = rawPlayer as number, moves=rawMoves as number, solved=rawSolved as boolean;
    if(wallSet.has(player)||boxes.includes(player)||boxes.some(x=>wallSet.has(x)))fail('A2G_E_STATE_TYPE','Invalid overlapping grid entities');
    const actions=config.actions;
    if(!actions||typeof actions!=='object'||Array.isArray(actions))fail('A2G_E_CAP_CONFIG','Missing grid-push actions');
    const actionMap=actions as Record<string,unknown>;
    const directions=['left','right','up','down'] as const;
    if(directions.some(k=>typeof actionMap[k]!=='string'))fail('A2G_E_CAP_CONFIG','Invalid grid-push action names');
    const delta={left:-1,right:1,up:-width,down:width};
    const inside=(from:number,to:number,dir:typeof directions[number]):boolean =>
        to>=0&&to<cells&&!(dir==='left'&&from%width===0)&&!(dir==='right'&&from%width===width-1);
    const events:NonNullable<ModuleResult['events']>=[];
    let changed=false;
    for(const input of ctx.inputs){
        if(input.type!=='input.action'||input.edge!=='press')continue;
        const dir=directions.find(k=>actionMap[k]===input.action);
        if(!dir||solved)continue;
        const target=player+delta[dir];
        if(!inside(player,target,dir)||wallSet.has(target))continue;
        const boxIdx=boxes.indexOf(target);
        if(boxIdx!==-1){
            const next=target+delta[dir];
            if(!inside(target,next,dir)||wallSet.has(next)||boxes.includes(next))continue;
            boxes[boxIdx]=next;
            events.push({type:'grid.box-pushed',payload:{from:target,to:next,direction:dir}});
        }
        player=target;moves++;changed=true;
        solved=boxes.length>0 && boxes.every(b=>goals.includes(b));
        events.push({type:'grid.player-moved',payload:{player,moves,direction:dir,solved}});
    }
    if(!changed)return {};
    return {
        proposals:[
            {kind:'state.set',path:String(config.playerPath),value:player},
            {kind:'state.set',path:String(config.boxesPath),value:boxes},
            {kind:'state.set',path:String(config.movesPath),value:moves},
            {kind:'state.set',path:String(config.solvedPath),value:solved},
        ],events,
    };
}
export const gridPushImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateGridPush};
