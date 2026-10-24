import { fail } from '../errors.js';
import { clone, isRecord, readPointer, safeInteger, stableCompare } from '../utils.js';
import type { GameDefinition, Json, JsonRecord, ModuleContext, ModuleResult, TrustedCapabilityImplementation } from '../types.js';

export interface WorldBody {
    id:string; kind:'actor'|'solid'|'target'|'projectile'|'pickup';
    x:number; y:number; vx:number; vy:number; hx:number; hy:number;
    hp:number; team:number; value:number; fixed:boolean;
    ttl?:number; invulnerableUntil?:number; owner?:string; hits?:string[];
}
export interface IntegerWorld {
    bodies:WorldBody[]; score:number; charge:number; nextId:number;
    cooldowns:Record<string,number>; contacts:string[]; spawned:number[];
    grounded:string[]; won:boolean; lost:boolean;
}
function err(why:string):never { return fail('A2G_E_CAP_CONFIG',why); }
const integer=(value:unknown,min:number,max:number):value is number=>safeInteger(value)&&value>=min&&value<=max;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const overlaps=(a:WorldBody,b:WorldBody):boolean=>Math.abs(a.x-b.x)<a.hx+b.hx&&Math.abs(a.y-b.y)<a.hy+b.hy;
const contactKey=(a:string,b:string)=>[a,b].sort(stableCompare).join('|');
export const realtimeServiceIds=['velocity','acceleration','charge','jump','landing','lane-move','auto-scroll','spawner','collider','rigid-body','contact','bounce','constraint','trigger-zone','follow','object-pool'].map(x=>'a2game.realtime.'+x).concat(['health','damage','aim','weapon','cooldown','projectile','hitscan','auto-target','wave','horde','status'].map(x=>'a2game.combat.'+x));

export function validateIntegerWorld(raw:unknown,config:Readonly<JsonRecord>):IntegerWorld {
    if(!isRecord(raw)||!Array.isArray(raw.bodies)||raw.bodies.length>Number(config.maxObjects??128)||!integer(raw.score,0,100000000)||!integer(raw.charge,0,120)||!integer(raw.nextId,0,1000000)||typeof raw.won!=='boolean'||typeof raw.lost!=='boolean')err('Invalid integer world state');
    if(!Array.isArray(raw.contacts)||raw.contacts.length>8128||raw.contacts.some(x=>typeof x!=='string')||!Array.isArray(raw.grounded)||raw.grounded.some(x=>typeof x!=='string')||!Array.isArray(raw.spawned)||raw.spawned.length>64||raw.spawned.some(x=>!integer(x,0,63))||!isRecord(raw.cooldowns)||Object.values(raw.cooldowns).some(x=>!integer(x,0,1000000)))err('Invalid world bookkeeping');
    const ids=new Set<string>();
    for(const body of raw.bodies){
        if(!isRecord(body)||typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(body.id)||ids.has(body.id)||!['actor','solid','target','projectile','pickup'].includes(String(body.kind)))err('Invalid or duplicate world body');
        ids.add(body.id as string);
        if(!integer(body.hx,16,2000)||!integer(body.hy,16,2000)||!integer(body.x,Number(body.hx),Number(config.width)-Number(body.hx))||!integer(body.y,Number(body.hy),Number(config.height)-Number(body.hy))||!integer(body.vx,-128,128)||!integer(body.vy,-128,128)||!integer(body.hp,0,1000000)||!integer(body.team,0,8)||!integer(body.value,0,1000000)||typeof body.fixed!=='boolean')err('Out-of-bounds integer body');
        if(body.ttl!==undefined&&!integer(body.ttl,0,1000000)||body.invulnerableUntil!==undefined&&!integer(body.invulnerableUntil,0,1000000)||body.hits!==undefined&&(!Array.isArray(body.hits)||body.hits.length>128||body.hits.some(x=>typeof x!=='string')))err('Invalid body lifetime or hit ledger');
    }
    for(const constraint of (config.constraints??[]) as JsonRecord[]){if(!ids.has(String(constraint.body))||Number(constraint.minX)>Number(constraint.maxX)||Number(constraint.minY)>Number(constraint.maxY)||Number(constraint.maxX)>Number(config.width)||Number(constraint.maxY)>Number(config.height))err('Invalid body constraint');}
    return raw as unknown as IntegerWorld;
}
function validateConfig(c:Readonly<JsonRecord>):void {
    if(typeof c.statePath!=='string'||!c.statePath.startsWith('/')||!integer(c.width,256,32000)||!integer(c.height,256,32000))err('Invalid integer world config');
    const ranges:Record<string,[number,number]>={gravity:[-16,16],moveSpeed:[0,128],jumpSpeed:[0,128],maxCharge:[1,120],restitution:[0,1000],maxObjects:[1,128],projectileSpeed:[1,128],damage:[1,1000],cooldownTicks:[1,600],invulnerabilityTicks:[0,600],goalScore:[1,1000000],seekSpeed:[0,128],scrollSpeed:[-128,128],laneWidth:[16,32000]};
    for(const [key,[min,max]] of Object.entries(ranges))if(c[key]!==undefined&&!integer(c[key],min,max))err('Invalid world '+key);
    if(c.actions!==undefined&&!isRecord(c.actions))err('Invalid world actions');
    if(c.waves!==undefined&&(!Array.isArray(c.waves)||c.waves.length>64))err('Invalid waves');
}

/** A tick-bound checkpointable service; integers are world units, velocities units per tick. */
export function simulateIntegerWorld(ctx:ModuleContext):ModuleResult {
    const c=ctx.config;validateConfig(c);const raw=readPointer(ctx.world.state,String(c.statePath));
    const w=clone(validateIntegerWorld(raw,c)),events:NonNullable<ModuleResult['events']>=[],emit=(type:string,payload:JsonRecord)=>events.push({type,payload});
    const maximum=Number(c.maxObjects??128),actions=(c.actions??{}) as JsonRecord,actor=w.bodies.find(b=>b.kind==='actor'&&b.hp>0),dead=new Set<string>(),damageLedger=new Set<string>();
    const press=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&e.edge==='press');
    const release=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&e.edge==='release');
    const spawn=(body:WorldBody):boolean=>{
        if(w.bodies.length>=maximum){emit('realtime.pool-full',{});return false;}
        if(w.bodies.some(b=>b.id===body.id))err('Spawn ID already alive');w.bodies.push(body);emit('realtime.spawned',{id:body.id});return true;
    };
    for(const [index,entry] of ((c.waves??[]) as JsonRecord[]).entries())if(ctx.tickIndex>=Number(entry.tick)&&!w.spawned.includes(index)){
        const b=clone(entry.body) as unknown as WorldBody;validateIntegerWorld({...w,bodies:[b]},c);
        if(spawn(b))w.spawned.push(index);
    }
    if(actor){
        if(press('left'))actor.vx=-Number(c.moveSpeed??64);if(press('right'))actor.vx=Number(c.moveSpeed??64);
        if(release('left')&&actor.vx<0||release('right')&&actor.vx>0)actor.vx=0;
        const lane=(press('laneRight')?1:0)-(press('laneLeft')?1:0);if(lane)actor.x=clamp(actor.x+lane*Number(c.laneWidth??1000),actor.hx,Number(c.width)-actor.hx);
        if(press('charge')||ctx.inputs.some(e=>e.action===actions.charge&&e.edge==='hold'))w.charge=Math.min(Number(c.maxCharge??60),w.charge+1);
        if((press('jump')||release('charge'))&&w.grounded.includes(actor.id)){
            actor.vy=Math.min(128,Number(c.jumpSpeed??96)+w.charge);w.charge=0;emit('realtime.jumped',{id:actor.id});
        }
        const targets=w.bodies.filter(b=>b.kind==='target'&&b.team!==actor.team&&b.hp>0&&Math.abs(b.x-actor.x)+Math.abs(b.y-actor.y)<=Number(c.weaponRange??32000)).sort((a,b)=>(Math.abs(a.x-actor.x)+Math.abs(a.y-actor.y))-(Math.abs(b.x-actor.x)+Math.abs(b.y-actor.y))||stableCompare(a.id,b.id));
        if((press('fire')||c.autoFire===true)&&ctx.tickIndex>=(w.cooldowns[actor.id]??0)){
            const target=targets[0];let fired=false;
            if(c.weapon==='hitscan'){
                const hit=(c.autoTarget===true?target:targets.filter(b=>b.x>actor.x&&Math.abs(b.y-actor.y)<=b.hy+actor.hy).sort((a,b)=>a.x-b.x||stableCompare(a.id,b.id))[0]);
                if(hit)damage(hit,Number(c.damage??1),actor.id);fired=true;
            }else{
                const dx=target&&c.autoTarget===true?target.x-actor.x:1,dy=target&&c.autoTarget===true?target.y-actor.y:0,speed=Number(c.projectileSpeed??128),den=Math.max(1,Math.abs(dx)+Math.abs(dy));
                const id=`shot_${w.nextId}`;
                if(!w.bodies.some(b=>b.id===id))fired=spawn({id,kind:'projectile',x:actor.x,y:actor.y,vx:Math.trunc(dx*speed/den),vy:Math.trunc(dy*speed/den),hx:16,hy:16,hp:1,team:actor.team,value:Number(c.damage??1),fixed:false,ttl:600,owner:actor.id,hits:[]});
                if(fired)w.nextId++;
            }
            if(fired){w.cooldowns[actor.id]=ctx.tickIndex+Number(c.cooldownTicks??10);emit('combat.fired',{id:actor.id});}
        }
    }
    function damage(body:WorldBody,amount:number,source:string):void {
        const key=contactKey(body.id,source);
        if(dead.has(body.id)||body.hp<=0||damageLedger.has(key)||ctx.tickIndex<(body.invulnerableUntil??0))return;
        damageLedger.add(key);
        body.hp=Math.max(0,body.hp-amount);body.invulnerableUntil=ctx.tickIndex+Number(c.invulnerabilityTicks??0);emit('combat.hit',{id:body.id,source,amount,hp:body.hp});
        if(body.hp===0){dead.add(body.id);w.score+=body.value;emit('combat.death',{id:body.id,source});}
    }
    w.bodies.sort((a,b)=>stableCompare(a.id,b.id));
    const previousGrounded=new Set(w.grounded),grounded=new Set<string>(),contacts=new Set<string>();
    for(const b of w.bodies)if(!b.fixed&&b.kind!=='projectile'){
        b.vy=clamp(b.vy+Number(c.gravity??0),-128,128);
        if(actor&&b.kind==='target'&&Number(c.seekSpeed??0)>0)b.vx=Math.sign(actor.x-b.x)*Number(c.seekSpeed);
        if(b.kind==='target')b.vx=clamp(b.vx+Number(c.scrollSpeed??0),-128,128);
    }
    // Integral remainder distribution prevents rounding drift across substeps.
    const substeps=Math.max(1,Math.ceil(Math.max(0,...w.bodies.flatMap(b=>[Math.abs(b.vx),Math.abs(b.vy)]))/16));
    for(let step=0;step<substeps;step++){
        for(const b of w.bodies){
            if(b.fixed||dead.has(b.id))continue;
            const dx=Math.trunc(b.vx*(step+1)/substeps)-Math.trunc(b.vx*step/substeps),dy=Math.trunc(b.vy*(step+1)/substeps)-Math.trunc(b.vy*step/substeps);
            b.x+=dx;b.y+=dy;
            if(b.x<b.hx||b.x>Number(c.width)-b.hx){if(b.kind==='projectile')dead.add(b.id);b.x=clamp(b.x,b.hx,Number(c.width)-b.hx);b.vx=-Math.trunc(b.vx*Number(c.restitution??0)/1000);}
            if(b.y<b.hy||b.y>Number(c.height)-b.hy){if(b.kind==='projectile')dead.add(b.id);if(b.y<b.hy)grounded.add(b.id);b.y=clamp(b.y,b.hy,Number(c.height)-b.hy);b.vy=-Math.trunc(b.vy*Number(c.restitution??0)/1000);}
        }
        for(let i=0;i<w.bodies.length;i++)for(let j=i+1;j<w.bodies.length;j++){
            const a=w.bodies[i]!,b=w.bodies[j]!;if(dead.has(a.id)||dead.has(b.id)||!overlaps(a,b))continue;
            contacts.add(contactKey(a.id,b.id));
            const shot=a.kind==='projectile'?a:b.kind==='projectile'?b:undefined,target=shot===a?b:a;
            if(shot){if(target.kind==='solid'){dead.add(shot.id);continue;}if(target.team!==shot.team&&['target','actor'].includes(target.kind)&&!shot.hits?.includes(target.id)){(shot.hits??=[]).push(target.id);damage(target,shot.value,shot.owner??shot.id);dead.add(shot.id);}continue;}
            if(a.kind==='pickup'||b.kind==='pickup'){const pickup=a.kind==='pickup'?a:b,other=pickup===a?b:a;if(other.kind==='actor'){w.score+=pickup.value;dead.add(pickup.id);emit('realtime.trigger',{id:pickup.id,actor:other.id});}continue;}
            if(c.merge===true&&!a.fixed&&!b.fixed&&a.value>0&&a.value===b.value){a.value*=2;a.hp=Math.max(a.hp,b.hp);dead.add(b.id);w.score+=a.value;emit('realtime.merged',{kept:a.id,removed:b.id,value:a.value});continue;}
            if(a.team!==b.team&&a.kind==='actor'&&b.kind==='target')damage(a,1,b.id);
            if(a.team!==b.team&&b.kind==='actor'&&a.kind==='target')damage(b,1,a.id);
            resolveContact(a,b);
        }
    }
    function resolveContact(a:WorldBody,b:WorldBody):void {
        if(a.fixed&&b.fixed)return;
        const px=a.hx+b.hx-Math.abs(a.x-b.x),py=a.hy+b.hy-Math.abs(a.y-b.y),axis=px<py?'x':'y',penetration=axis==='x'?px:py,sign=a[axis]<=b[axis]?-1:1;
        const amountA=a.fixed?0:b.fixed?penetration:Math.ceil(penetration/2),amountB=b.fixed?0:penetration-amountA;
        a[axis]+=sign*amountA;b[axis]-=sign*amountB;
        const velocity=axis==='x'?'vx':'vy',bounce=Number(c.restitution??0);
        if(!a.fixed)a[velocity]=-Math.trunc(a[velocity]*bounce/1000);if(!b.fixed)b[velocity]=-Math.trunc(b[velocity]*bounce/1000);
        if(axis==='y'){if(a.y>b.y&&!a.fixed)grounded.add(a.id);if(b.y>a.y&&!b.fixed)grounded.add(b.id);}
    }
    for(const constraint of (c.constraints??[]) as JsonRecord[]){const b=w.bodies.find(body=>body.id===constraint.body);if(b){b.x=clamp(b.x,Number(constraint.minX)+b.hx,Number(constraint.maxX)-b.hx);b.y=clamp(b.y,Number(constraint.minY)+b.hy,Number(constraint.maxY)-b.hy);}}
    for(const b of w.bodies){b.x=clamp(b.x,b.hx,Number(c.width)-b.hx);b.y=clamp(b.y,b.hy,Number(c.height)-b.hy);if(b.ttl!==undefined){b.ttl--;if(b.ttl<=0)dead.add(b.id);}}
    for(const key of [...contacts].sort(stableCompare))emit(w.contacts.includes(key)?'contact.stay':'contact.begin',{pair:key});
    for(const key of w.contacts.filter(key=>!contacts.has(key)).sort(stableCompare))emit('contact.end',{pair:key});
    for(const id of [...grounded].sort(stableCompare))if(!previousGrounded.has(id))emit('realtime.landed',{id});
    w.contacts=[...contacts].sort(stableCompare);w.grounded=[...grounded].sort(stableCompare);w.bodies=w.bodies.filter(b=>!dead.has(b.id));
    w.won=c.goalScore!==undefined&&w.score>=Number(c.goalScore);w.lost=Boolean(actor&&(actor.hp<=0||dead.has(actor.id)));
    validateIntegerWorld(w,c);
    return {proposals:[{kind:'state.set',path:String(c.statePath),value:w as unknown as Json}],events};
}
export const realtimeWorldImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateIntegerWorld};
export function validateRealtimeDefinition(def:GameDefinition):void {
    const state=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
    for(const entity of [...def.scenes.flatMap(s=>s.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.realtime.world'){
        const c=component.config;validateConfig(c);const w=validateIntegerWorld(readPointer(state,String(c.statePath)),c);
        for(const name of Object.values((c.actions??{}) as JsonRecord))if(!def.inputs.actions.some(a=>a.id===name))err('Unknown realtime action');
        for(const entry of (c.waves??[]) as JsonRecord[]){if(!integer(entry.tick,0,1000000))err('Invalid wave tick');validateIntegerWorld({...w,bodies:[entry.body]},c);}
    }
}
