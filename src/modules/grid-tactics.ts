import { fail } from '../errors.js';
import { clone, isRecord, readPointer, safeInteger } from '../utils.js';
import { discardCard, drawCard } from './strategy.js';
import type { GameDefinition, JsonRecord, ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

export const gridTacticsId = 'a2game.turnbased.grid-tactics';
const moves = [[-1,0],[1,0],[0,-1],[0,1]] as const;
const integer = (n:unknown,lo:number,hi:number): n is number => safeInteger(n) && n>=lo && n<=hi;
const invalid = (message:string):never => fail('A2G_E_CAP_CONFIG',message,{capabilityId:gridTacticsId});

interface TacticsConfig {
    statePath:string; columns:number; rows:number; walls:number[];
    maxAP:number; damage:number; enemyDamage:number;
    moveActions:string[]; endAction:string; attackAction?:string; cardActions?:string[];
    scoutAction?:string;
}

interface TacticsState {
    player:number; enemy:number; health:number; enemyHealth:number; ap:number; round:number;
    selected:number; deck:number[]; hand:number[]; discard:number[];
    scouted?:boolean; visibleEnemy?:number[];
}

function adjacent(cell:number,direction:number,c:TacticsConfig):number {
    const [dx,dy]=moves[direction]!;
    const x=cell%c.columns+dx;
    const y=Math.floor(cell/c.columns)+dy;
    return x<0||x>=c.columns||y<0||y>=c.rows?-1:y*c.columns+x;
}

function validate(raw:unknown,c:TacticsConfig):TacticsState {
    if (!isRecord(raw)) return invalid('Grid tactics needs an object state');
    const s=raw as unknown as TacticsState;
    const last=c.columns*c.rows-1;
    const validCell=(cell:number)=>integer(cell,0,last)&&!c.walls.includes(cell);
    const cardList=(value:unknown)=>Array.isArray(value)&&value.every(n=>integer(n,1,2));
    if (!validCell(s.player)||!validCell(s.enemy)||s.player===s.enemy||!integer(s.health,0,1000)||
        !integer(s.enemyHealth,0,1000)||!integer(s.ap,0,c.maxAP)||!integer(s.round,1,1000000)||
        !cardList(s.deck)||!cardList(s.hand)||!cardList(s.discard)||
        s.deck.length+s.hand.length+s.discard.length>32||s.hand.length>(c.cardActions?.length??0)||
        !integer(s.selected,-1,s.hand.length-1)||(!c.cardActions&&(s.deck.length>0||s.discard.length>0))) {
        return invalid('Invalid tactics units, action points or cards');
    }
    return s;
}

function simulate(ctx:ModuleContext):ModuleResult {
    const c=ctx.config as unknown as TacticsConfig;
    const raw=readPointer(ctx.world.state,c.statePath);
    const s=clone(validate(raw,c) as unknown as JsonRecord) as unknown as TacticsState;
    if(c.scoutAction){
        s.scouted ??= false;
        s.visibleEnemy=s.scouted?[s.enemy]:[];
    }
    const events:NonNullable<ModuleResult['events']>=[];
    const emit=(name:string,data:JsonRecord={})=>events.push({type:'tactics.'+name,payload:data});
    const neighbors=(cell:number)=>moves.map((_,d)=>adjacent(cell,d,c));
    for(const input of ctx.inputs){
        if (!s.health||!s.enemyHealth) break;
        if(input.type!=='input.action'||input.edge!=='press')continue;
        const action=input.action??'';
        const index=c.cardActions?.indexOf(action)??-1;
        const dir=c.moveActions.indexOf(action);
        if(action===c.scoutAction&&s.ap>0&&!s.scouted){
            s.ap--;
            s.scouted=true;
            s.visibleEnemy=[s.enemy];
        }else if(action===c.endAction){
            if(neighbors(s.enemy).includes(s.player))s.health=Math.max(0,s.health-c.enemyDamage);
            s.round=Math.min(1000000,s.round+1);
            s.ap=c.maxAP;
            s.selected=-1;
            if(c.cardActions)drawCard(s.deck,s.hand,c.cardActions.length);
            emit('turn',{round:s.round});
        }else if(index>=0){
            if(index<s.hand.length){s.selected=index;emit('selected',{index,card:s.hand[index]!});}
            else emit('invalid',{action});
        }else if(dir>=0||action===c.attackAction){
            const card=s.hand[s.selected];
            const target=dir>=0?adjacent(s.player,dir,c):s.enemy;
            const attack=c.cardActions?card===2:action===c.attackAction;
            const ready=s.ap>0&&(!c.cardActions||card!==undefined);
            const legal=attack?(!c.scoutAction||s.scouted===true)&&target===s.enemy&&neighbors(s.player).includes(target):
                target>=0&&target!==s.enemy&&!c.walls.includes(target);
            if(!ready||!legal){emit('invalid',{action});continue;}
            s.ap--;
            if(attack){s.enemyHealth=Math.max(0,s.enemyHealth-c.damage);emit('hit',{damage:c.damage});}
            else{s.player=target;emit('moved',{cell:target});}
            if(c.cardActions){discardCard(s.hand,s.discard,s.selected);s.selected=-1;}
        }
    }
    return {proposals:[{kind:'state.set',path:c.statePath,value:s as unknown as JsonRecord}],events};
}

export const gridTacticsImplementation:TrustedCapabilityImplementation={role:'module',simulate};

export function validateGridTacticsDefinition(def:GameDefinition):void{
    const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
    const entities=[...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})];
    for(const entity of entities)for(const component of entity.components??[]){
        if(component.capability.id!==gridTacticsId)continue;
        const c=component.config as unknown as TacticsConfig;
        if(!integer(c.columns,2,12)||!integer(c.rows,2,12)||!integer(c.maxAP,1,8)||
            !integer(c.damage,1,100)||!integer(c.enemyDamage,1,100)||
            !Array.isArray(c.walls)||c.walls.some(cell=>!integer(cell,0,c.columns*c.rows-1))||
            new Set(c.walls).size!==c.walls.length||!Array.isArray(c.moveActions)||c.moveActions.length!==4||
            (c.cardActions!==undefined&&(!Array.isArray(c.cardActions)||c.cardActions.length<1||c.cardActions.length>8))||
            Boolean(c.cardActions)===Boolean(c.attackAction))invalid('Invalid tactics board or action configuration');
        const names=[...c.moveActions,c.endAction,...(c.cardActions??[c.attackAction!]),...(c.scoutAction?[c.scoutAction]:[])];
        if(new Set(names).size!==names.length||names.some(name=>!def.inputs.actions.some(a=>a.id===name&&a.valueType==='button'))){
            invalid('Tactics commands require distinct button actions');
        }
        validate(readPointer(initial,c.statePath),c);
    }
}
