import {fail} from '../errors.js';
import type {GameDefinition,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
import {isRecord,readPointer,safeInteger} from '../utils.js';

export const minesweeperId = 'a2game.puzzle.minesweeper';
const COVERED = -2, FLAGGED = -1, EXPLODED = 9;
type Board = {mines:number[]; cells:number[]; flagMode:boolean; remainingSafe:number; status:'playing'|'won'|'lost'};

function getConfig(config:Readonly<JsonRecord>) {
    const {width,height,mineCount,cellActions,flagModeAction,statePath} = config;
    if (!safeInteger(width) || !safeInteger(height) || width < 2 || height < 2 || width > 8 || height > 8 ||
        !safeInteger(mineCount) || mineCount < 1 || mineCount >= width * height ||
        !Array.isArray(cellActions) || cellActions.length !== width * height ||
        cellActions.some(id => typeof id !== 'string' || !id) ||
        typeof flagModeAction !== 'string' || !flagModeAction ||
        new Set([...cellActions,flagModeAction]).size !== cellActions.length + 1 ||
        typeof statePath !== 'string' || !/^\/[a-zA-Z][a-zA-Z0-9_-]*$/.test(statePath)) {
        fail('A2G_E_CAP_CONFIG','Minesweeper requires a bounded board, distinct cell and flag-mode actions, and a top-level state path');
    }
    return {width,height,mineCount,cellActions:cellActions as string[],flagModeAction,statePath};
}

function getBoard(raw:unknown,area:number,mineCount:number,initial=false):Board {
    if (!isRecord(raw)) fail('A2G_E_STATE_TYPE','Minesweeper state must be an object');
    const {mines,cells,flagMode,remainingSafe,status} = raw;
    if (Object.keys(raw).length !== 5 || !Array.isArray(cells) || cells.length !== area ||
        !cells.every(v => safeInteger(v) && v >= COVERED && v <= EXPLODED) ||
        !Array.isArray(mines) || (mines.length !== 0 && mines.length !== mineCount) ||
        !mines.every(v => safeInteger(v) && v >= 0 && v < area) || new Set(mines).size !== mines.length ||
        typeof flagMode !== 'boolean' || !safeInteger(remainingSafe) || remainingSafe < 0 ||
        remainingSafe !== area - mineCount - cells.filter(n => n >= 0 && n < EXPLODED).length ||
        (status !== 'playing' && status !== 'lost' && status !== 'won') ||
        (status === 'won') !== (remainingSafe === 0) ||
        cells.filter(n => n === EXPLODED).length !== (status === 'lost' ? 1 : 0) ||
        (mines.length === 0 && cells.some(n => n >= 0)) ||
        (initial && (mines.length !== 0 || cells.some(n => n !== COVERED) || flagMode || status !== 'playing'))) {
        fail('A2G_E_STATE_TYPE','Invalid minesweeper board state');
    }
    return {mines:[...mines],cells:[...cells],flagMode,remainingSafe,status};
}

function neighbors(idx:number,width:number,height:number):number[] {
    const col=idx%width,row=Math.floor(idx/width),out:number[]=[];
    for (let r=Math.max(0,row-1); r<=Math.min(height-1,row+1); r++)
        for (let c=Math.max(0,col-1); c<=Math.min(width-1,col+1); c++)
            if (r!==row || c!==col) out.push(r*width+c);
    return out;
}

export function simulateMinesweeper(ctx:ModuleContext):ModuleResult {
    const presses=ctx.inputs.filter(e=>e.type==='input.action' && e.edge==='press');
    if (!presses.length) return {};
    const {width,height,mineCount,cellActions,flagModeAction,statePath}=getConfig(ctx.config);
    const area=width*height,board=getBoard(readPointer(ctx.world.state,statePath),area,mineCount);
    const events:NonNullable<ModuleResult['events']>=[];
    let changed=false;
    for (const input of presses) {
        if (board.status!=='playing') break;
        if (input.action===flagModeAction) {
            board.flagMode=!board.flagMode;
            changed=true;
            continue;
        }
        const index=cellActions.indexOf(input.action ?? '');
        if (index<0) continue;
        const current=board.cells[index]!;
        if (board.flagMode) {
            if (current!==COVERED && current!==FLAGGED) continue;
            board.cells[index]=current===COVERED?FLAGGED:COVERED;
            changed=true;
            continue;
        }
        if (current!==COVERED) continue;
        if (!board.mines.length) {
            // Partial shuffle over row-major eligible cells. Flags do not affect placement.
            const eligible=Array.from({length:area},(_,i)=>i).filter(i=>i!==index);
            for (let i=0;i<mineCount;i++) {
                const j=ctx.rng.randomInt(i,eligible.length-1);
                [eligible[i],eligible[j]]=[eligible[j]!,eligible[i]!];
            }
            board.mines=eligible.slice(0,mineCount).sort((a,b)=>a-b);
        }
        changed=true;
        const mines=new Set(board.mines);
        if (mines.has(index)) {
            board.cells[index]=EXPLODED;
            board.status='lost';
            events.push({type:'minesweeper.lost',payload:{cell:index}});
            break;
        }
        const queue=[index],seen=new Set(queue);
        for (let i=0;i<queue.length;i++) {
            const cell=queue[i]!;
            if (board.cells[cell]!==COVERED || mines.has(cell)) continue;
            const adjacent=neighbors(cell,width,height);
            const count=adjacent.filter(n=>mines.has(n)).length;
            board.cells[cell]=count;
            board.remainingSafe--;
            if (!count) for (const n of adjacent) if (!seen.has(n) && board.cells[n]===COVERED) {
                seen.add(n);
                queue.push(n);
            }
        }
        if (!board.remainingSafe) {
            board.status='won';
            events.push({type:'minesweeper.won',payload:{cell:index}});
        }
    }
    return changed?{proposals:[{kind:'state.set',path:statePath,value:board}],events}:{};
}

export function validateMinesweeperDefinition(def:GameDefinition):void {
    const initial=Object.fromEntries(Object.entries(def.state).map(([id,field])=>[id,field.initial]));
    const actions=new Set(def.inputs.actions.filter(a=>a.valueType==='button').map(a=>a.id));
    for (const entity of [...Object.values(def.prototypes??{}),...def.scenes.flatMap(scene=>scene.entities)]) {
        for (const comp of entity.components??[]) {
            if (comp.capability.id!==minesweeperId) continue;
            const {width,height,mineCount,cellActions,flagModeAction,statePath}=getConfig(comp.config);
            if (![...cellActions,flagModeAction].every(a=>actions.has(a))) fail('A2G_E_CAP_CONFIG','Minesweeper actions must be declared buttons');
            getBoard(readPointer(initial,statePath),width*height,mineCount,true);
        }
    }
}
export const minesweeperImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateMinesweeper};
