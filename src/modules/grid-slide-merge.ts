import { fail } from '../errors.js';
import { readPointer, safeInteger } from '../utils.js';
import type { ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

/** A composable grid slide+merge algorithm, not a hard-coded 2048 game controller. */
export function simulateGridSlideMerge(ctx: ModuleContext): ModuleResult {
    const cfg = ctx.config;
    const width = Number(cfg.width), height = Number(cfg.height);
    const boardPath = String(cfg.boardPath), bestPath = String(cfg.bestPath);
    if (!safeInteger(width) || !safeInteger(height) || width < 2 || height < 2 || width > 8 || height > 8) fail('A2G_E_CAP_CONFIG','Grid dimensions must be integers 2..8');
    const cells = readPointer(ctx.world.state, boardPath);
    if (!Array.isArray(cells) || cells.length !== width * height || !cells.every(n => safeInteger(n) && n >= 0)) fail('A2G_E_STATE_TYPE','Board must be flat array of non-negative safe integers');
    const mappings = cfg.actions;
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) fail('A2G_E_CAP_CONFIG','Missing action mapping');
    const names = mappings as Record<string,string>;
    const moves: Array<'left'|'right'|'up'|'down'> = ['left','right','up','down'];
    let board = [...cells] as number[];
    let best = readPointer(ctx.world.state,bestPath);
    if (!safeInteger(best)) fail('A2G_E_STATE_TYPE','bestPath must point to safe int');
    const events: NonNullable<ModuleResult['events']> = [];
    let changed = false;
    for (const input of ctx.inputs) {
        if (input.type !== 'input.action' || input.edge !== 'press') continue;
        const direction = moves.find(move => names[move] === input.action);
        if (!direction) continue;
        const next = [...board];
        const lines = direction === 'left' || direction === 'right' ? height : width;
        const lineLen = direction === 'left' || direction === 'right' ? width : height;
        for (let n=0;n<lines;n++) {
            const indexes = Array.from({length:lineLen},(_,i)=>{
                if (direction==='left') return n*width+i;
                if (direction==='right') return n*width+width-1-i;
                if (direction==='up') return i*width+n;
                return (height-1-i)*width+n;
            });
            const nonzero = indexes.map(i=>board[i]!).filter(v=>v!==0);
            const merged:number[]=[];
            for (let k=0;k<nonzero.length;k++) {
                if (k+1<nonzero.length && nonzero[k]===nonzero[k+1]) {
                    const sum = nonzero[k]!*2;
                    if (!safeInteger(sum)) fail('A2G_E_STATE_RANGE','Merged tile exceeds safe integer range');
                    merged.push(sum);k++;
                } else merged.push(nonzero[k]!);
            }
            indexes.forEach((idx,i)=>{ next[idx]=merged[i]??0; });
        }
        if (next.every((v,i)=>v===board[i])) continue; // no move, no RNG consumption
        const spawnCount=cfg.spawnCount === undefined ? 1 : Number(cfg.spawnCount);
        if (!safeInteger(spawnCount) || spawnCount<0 || spawnCount>1) fail('A2G_E_CAP_CONFIG','spawnCount must be 0 or 1');
        const newTiles:{index:number;value:number}[]=[];
        for(let i=0;i<spawnCount;i++) {
            const empties=next.map((v,i)=>v===0?i:-1).filter(v=>v!==-1);
            if (empties.length===0) break;
            const index=empties[ctx.rng.randomInt(0,empties.length-1)]!;
            const value=ctx.rng.randomInt(1,10)===10?4:2;
            next[index]=value;
            newTiles.push({index,value});
        }
        board=next;
        best=Math.max(best,...board);
        changed=true;
        events.push({type:'grid.moved',payload:{direction,spawned:newTiles}});
    }
    return changed ? {
        proposals:[{kind:'state.set',path:boardPath,value:board},{kind:'state.set',path:bestPath,value:best}],events,
    } : {events:[]};
}
export const gridSlideMergeImplementation: TrustedCapabilityImplementation = {role:'module',simulate:simulateGridSlideMerge};
