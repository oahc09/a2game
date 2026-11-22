import { fail } from '../errors.js';
import { clone, isRecord, readPointer, safeInteger } from '../utils.js';
import type { GameDefinition, JsonRecord, ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

export const minesId='a2game.puzzle.mine-board';
export const disksId='a2game.turnbased.disk-flip';
const integer=(value:unknown,min:number,max:number):value is number=>safeInteger(value)&&value>=min&&value<=max;
const invalid=(message:string):never=>fail('A2G_E_CAP_CONFIG',message);
const directions=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
const covered=-2,flagged=-1,blast=9;

interface BoardConfig { statePath:string; width:number; height:number; cells:string[]; flagAction?:string; }
interface MineState { mines:number[]; tiles:number[]; revealed:number; flagging:boolean; won:boolean; lost:boolean; }
interface DiskState { tiles:number[]; player:number; moves:number; skipped:number; black:number; white:number; winner:number; ended:boolean; }

function next(cell:number,dx:number,dy:number,c:BoardConfig):number {
    const x=cell%c.width+dx;
    const y=Math.floor(cell/c.width)+dy;
    return x>=0&&x<c.width&&y>=0&&y<c.height?y*c.width+x:-1;
}

function checked(raw:unknown,c:BoardConfig,mine:boolean):JsonRecord {
    const size=c.width*c.height;
    if(!isRecord(raw)||!Array.isArray(raw.tiles)||raw.tiles.length!==size||
        raw.tiles.some(tile=>!integer(tile,mine?covered:0,mine?blast:2)))return invalid('Invalid board tiles');
    if(mine){
        if(!Array.isArray(raw.mines)||raw.mines.length<1||raw.mines.length>=size||
            new Set(raw.mines).size!==raw.mines.length||raw.mines.some(cell=>!integer(cell,0,size-1))||
            !integer(raw.revealed,0,size-raw.mines.length)||raw.revealed!==raw.tiles.filter(v=>Number(v)>=0&&v!==blast).length||
            typeof raw.flagging!=='boolean'||typeof raw.won!=='boolean'||typeof raw.lost!=='boolean'||(raw.won&&raw.lost)){
            return invalid('Invalid mine board state');
        }
    }else if(!integer(raw.player,1,2)||!integer(raw.moves,0,size)||!integer(raw.skipped,0,size)||
        raw.black!==raw.tiles.filter(v=>v===1).length||raw.white!==raw.tiles.filter(v=>v===2).length||
        !integer(raw.winner,0,2)||typeof raw.ended!=='boolean'){
        return invalid('Invalid disk board state');
    }
    return raw as JsonRecord;
}

function mineBoard(ctx:ModuleContext):ModuleResult{
    const c=ctx.config as unknown as BoardConfig;
    const s=clone(checked(readPointer(ctx.world.state,c.statePath),c,true)) as unknown as MineState;
    const events:NonNullable<ModuleResult['events']>=[];
    const emit=(name:string,cell:number)=>events.push({type:'mine-board.'+name,payload:{cell}});
    for(const input of ctx.inputs){
        if(s.won||s.lost)break;
        if(input.type!=='input.action'||input.edge!=='press')continue;
        if(input.action===c.flagAction){s.flagging=!s.flagging;continue;}
        const cell=c.cells.indexOf(input.action??'');
        if(cell<0)continue;
        const tile=s.tiles[cell]!;
        if(s.flagging&&tile<0){s.tiles[cell]=tile===covered?flagged:covered;emit('flag',cell);continue;}
        if(s.flagging||tile!==covered)continue;
        const mine=s.mines.indexOf(cell);
        if(mine>=0&&s.revealed===0){
            const choices=s.tiles.map((_,i)=>i).filter(i=>i!==cell&&!s.mines.includes(i));
            s.mines[mine]=choices[ctx.rng.randomInt(0,choices.length-1)]!;
        }else if(mine>=0){
            s.tiles[cell]=blast;s.lost=true;emit('blast',cell);break;
        }
        const count=directions.filter(([dx,dy])=>s.mines.includes(next(cell,dx,dy,c))).length;
        s.tiles[cell]=count;
        s.revealed++;
        s.won=s.revealed===s.tiles.length-s.mines.length;
        emit('reveal',cell);
    }
    return {proposals:[{kind:'state.set',path:c.statePath,value:s as unknown as JsonRecord}],events};
}

function flips(board:number[],cell:number,player:number,c:BoardConfig):number[]{
    if(board[cell]!==0)return [];
    return directions.flatMap(([dx,dy])=>{
        const line:number[]=[];
        let at=next(cell,dx,dy,c);
        while(at>=0&&board[at]===3-player){
            line.push(at);
            at=next(at,dx,dy,c);
        }
        return at>=0&&board[at]===player?line:[];
    });
}

function diskBoard(ctx:ModuleContext):ModuleResult{
    const c=ctx.config as unknown as BoardConfig;
    const s=clone(checked(readPointer(ctx.world.state,c.statePath),c,false)) as unknown as DiskState;
    const events:NonNullable<ModuleResult['events']>=[];
    const emit=(name:string,payload:JsonRecord)=>events.push({type:'disk-flip.'+name,payload});
    const hasMove=(player:number)=>s.tiles.some((tile,cell)=>tile===0&&flips(s.tiles,cell,player,c).length>0);
    const finish=()=>{
        s.winner=s.black>s.white?1:s.white>s.black?2:0;
        s.ended=true;
        emit('ended',{winner:s.winner});
    };
    if(ctx.tickIndex===0&&!s.ended&&!hasMove(s.player)){
        if(hasMove(3-s.player)){
            emit('skip',{player:s.player});s.skipped++;s.player=3-s.player;
        }else finish();
    }
    for(const input of ctx.inputs){
        if(s.ended)break;
        if(input.type!=='input.action'||input.edge!=='press')continue;
        const cell=c.cells.indexOf(input.action??'');
        if(cell<0)continue;
        const captured=flips(s.tiles,cell,s.player,c);
        if(!captured.length){emit('invalid',{cell,player:s.player});continue;}
        s.tiles[cell]=s.player;
        for(const index of captured)s.tiles[index]=s.player;
        s.black=s.tiles.filter(tile=>tile===1).length;
        s.white=s.tiles.filter(tile=>tile===2).length;
        s.moves++;
        emit('placed',{cell,player:s.player,flipped:captured.length});
        if(hasMove(3-s.player))s.player=3-s.player;
        else if(hasMove(s.player)){s.skipped++;emit('skip',{player:3-s.player});}
        else finish();
    }
    return {proposals:[{kind:'state.set',path:c.statePath,value:s as unknown as JsonRecord}],events};
}

export const mineBoardImplementation:TrustedCapabilityImplementation={role:'module',simulate:mineBoard};
export const diskBoardImplementation:TrustedCapabilityImplementation={role:'module',simulate:diskBoard};

export function validateGridBoardDefinition(def:GameDefinition):void{
    const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
    const entities=[...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})];
    for(const entity of entities)for(const component of entity.components??[]){
        const {id}=component.capability;
        if(id!==minesId&&id!==disksId)continue;
        const c=component.config as unknown as BoardConfig;
        const mine=id===minesId;
        if(!integer(c.width,3,8)||!integer(c.height,3,8)||!Array.isArray(c.cells)||c.cells.length!==c.width*c.height){
            invalid('Expected a unique button for each board cell');
        }
        const actions=[...c.cells,...(mine?[c.flagAction]:[])];
        if(new Set(actions).size!==actions.length||actions.some(name=>!def.inputs.actions.some(a=>a.id===name&&a.valueType==='button'))){
            invalid('Invalid board input bindings');
        }
        checked(readPointer(initial,c.statePath),c,mine);
    }
}
