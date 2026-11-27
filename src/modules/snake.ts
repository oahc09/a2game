import {fail} from '../errors.js';
import type {GameDefinition,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
import {isRecord,readPointer,safeInteger} from '../utils.js';

export const snakeId='a2game.puzzle.snake';
const dirs=['up','right','down','left'] as const;
type Direction = typeof dirs[number];
type Board = {body:number[];food:number[];direction:Direction;turns:Direction[];nextMoveTick:number;eaten:number;status:'playing'|'lost'|'won'};
const isDir=(value:unknown):value is Direction=>dirs.some(d=>d===value);
const opposite=(a:Direction,b:Direction)=>(dirs.indexOf(a)+2)%dirs.length===dirs.indexOf(b);

function configOf(raw:Readonly<JsonRecord>) {
    const {width,height,stepTicks,goalLength,actions,statePath}=raw;
    if(!safeInteger(width)||width<3||width>12||!safeInteger(height)||height<3||height>12||
        !safeInteger(stepTicks)||stepTicks<1||stepTicks>120||!safeInteger(goalLength)||goalLength<3||goalLength>width*height||
        !isRecord(actions)||Object.keys(actions).length!==4||dirs.some(d=>typeof actions[d]!=='string'||!actions[d])||
        new Set(Object.values(actions)).size!==4||typeof statePath!=='string'||!/^\/[a-zA-Z][a-zA-Z0-9_-]*$/.test(statePath)) {
        fail('A2G_E_CAP_CONFIG','Snake requires a bounded grid, movement cadence, target length, distinct directional actions, and a top-level state path');
    }
    return {width,height,stepTicks,goalLength,actions:actions as Record<Direction,string>,statePath};
}

function neighbor(cell:number,direction:Direction,width:number,height:number):number {
    const deltas={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]} as const;
    const [dx,dy]=deltas[direction],x=cell%width+dx,y=Math.floor(cell/width)+dy;
    return x>=0&&x<width&&y>=0&&y<height ? y*width+x : -1;
}

function boardOf(raw:unknown,c:ReturnType<typeof configOf>,initial=false):Board {
    if(!isRecord(raw))fail('A2G_E_STATE_TYPE','Snake board must be an object');
    const {body,food,direction,turns,nextMoveTick,eaten,status}=raw;
    const area=c.width*c.height;
    const cell=(x:unknown):x is number=>safeInteger(x)&&x>=0&&x<area;
    if(Object.keys(raw).length!==7||!Array.isArray(body)||body.length<2||body.length>c.goalLength||
       !body.every(cell)||new Set(body).size!==body.length||
       body.slice(1).some((v,i)=>!dirs.some(d=>neighbor(v,d,c.width,c.height)===body[i]))||
       !Array.isArray(food)||food.length!==(status==='won'?0:1)||!food.every(cell)||food.some(f=>body.includes(f))||
       !isDir(direction)||neighbor(body[1]!,direction,c.width,c.height)!==body[0]||
       !Array.isArray(turns)||turns.length>2||!turns.every(isDir)||
       turns.some((d,i)=>{const prior=i?turns[i-1]!:direction;return d===prior||opposite(prior,d);})||
       !safeInteger(nextMoveTick)||nextMoveTick<0||!safeInteger(eaten)||eaten<0||eaten>body.length-2||
       (status!=='playing'&&status!=='lost'&&status!=='won')||((status==='won')!==(body.length===c.goalLength))||
       (initial&&(status!=='playing'||turns.length!==0||nextMoveTick!==c.stepTicks-1||eaten!==0))) {
        fail('A2G_E_STATE_TYPE','Invalid Snake board state');
    }
    return {body:[...body],food:[...food],direction,turns:[...turns],nextMoveTick,eaten,status};
}

export function simulateSnake(ctx:ModuleContext):ModuleResult {
    const c=configOf(ctx.config),b=boardOf(readPointer(ctx.world.state,c.statePath),c);
    if(b.status!=='playing')return {};
    let changed=false;
    for(const input of ctx.inputs){
        if(input.type!=='input.action'||input.edge!=='press'||b.turns.length>=2)continue;
        const turn=dirs.find(d=>c.actions[d]===input.action),last=b.turns.at(-1)??b.direction;
        if(turn===undefined||turn===last||opposite(last,turn))continue;
        b.turns.push(turn);changed=true;
    }
    const events:NonNullable<ModuleResult['events']>=[];
    if(ctx.tickIndex>=b.nextMoveTick){
        changed=true;
        const turn=b.turns.shift()??b.direction;
        const next=neighbor(b.body[0]!,turn,c.width,c.height);
        const grows=next===b.food[0];
        // The tail leaves this cell during the same non-growth movement.
        const occupied=grows?b.body:b.body.slice(0,-1);
        if(next<0||occupied.includes(next)){
            b.status='lost';b.turns=[];
            events.push({type:'snake.lost',payload:{reason:next<0?'wall':'body'}});
        }else{
            b.direction=turn;
            b.body.unshift(next);
            if(!grows)b.body.pop();
            else{
                b.eaten++;
                if(b.body.length===c.goalLength){
                    b.food=[];b.turns=[];b.status='won';
                    events.push({type:'snake.won',payload:{length:b.body.length}});
                }else{
                    const used=new Set(b.body);
                    const free=Array.from({length:c.width*c.height},(_,i)=>i).filter(i=>!used.has(i));
                    b.food=[free[ctx.rng.randomInt(0,free.length-1)]!];
                }
            }
            b.nextMoveTick=ctx.tickIndex+c.stepTicks;
        }
    }
    return changed?{proposals:[{kind:'state.set',path:c.statePath,value:b}],events}:{};
}

export function validateSnakeDefinition(def:GameDefinition):void {
    const buttons=new Set(def.inputs.actions.filter(a=>a.valueType==='button').map(a=>a.id));
    if(Object.values(def.prototypes??{}).some(e=>e.components?.some(c=>c.capability.id===snakeId))) {
        fail('A2G_E_CAP_CONFIG','Snake boards must be scene-local, never spawnable prototypes');
    }
    for(const scene of def.scenes){
        const paths=new Set<string>();
        for(const e of scene.entities)for(const component of e.components??[]){
            if(component.capability.id!==snakeId)continue;
            const c=configOf(component.config);
            if(paths.has(c.statePath)||!dirs.every(d=>buttons.has(c.actions[d])))fail('A2G_E_CAP_CONFIG','Snake boards must have a distinct state per scene and declared button actions');
            paths.add(c.statePath);
            const field=def.state[c.statePath.slice(1)];
            if(field?.type!=='object')fail('A2G_E_CAP_CONFIG','Snake requires an object state field');
            boardOf(field.initial,c,true);
        }
    }
}
export const snakeImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateSnake};
