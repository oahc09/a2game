import { fail } from '../errors.js';
import { clone, isRecord, readPointer, safeInteger, stableCompare } from '../utils.js';
import {segmentAabb} from '../geometry.js';
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
    grounded:string[]; won:boolean; lost:boolean; overflowTicks?:number; crosshair?:number[]; health?:number; timeLeft?:number;
}
function err(why:string):never { return fail('A2G_E_CAP_CONFIG',why); }
const integer=(value:unknown,min:number,max:number):value is number=>safeInteger(value)&&value>=min&&value<=max;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const overlaps=(a:WorldBody,b:WorldBody):boolean=>Math.abs(a.x-b.x)<a.hx+b.hx&&Math.abs(a.y-b.y)<a.hy+b.hy;
const contactKey=(a:string,b:string)=>[a,b].sort(stableCompare).join('|');
export const realtimeServiceIds=['velocity','acceleration','charge','jump','landing','lane-move','auto-scroll','spawner','collider','rigid-body','contact','bounce','constraint','trigger-zone','follow','object-pool'].map(x=>'a2game.realtime.'+x).concat(['health','damage','aim','weapon','cooldown','projectile','hitscan','auto-target','wave','horde','status'].map(x=>'a2game.combat.'+x));

/** Validate a prospective body without applying whole-world constraints to a singleton. */
function validateWorldBody(body:unknown,config:Readonly<JsonRecord>):WorldBody {
    if(!isRecord(body)||typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(body.id)||!['actor','solid','target','projectile','pickup'].includes(String(body.kind)))err('Invalid or duplicate world body');
    if(!integer(body.hx,16,2000)||!integer(body.hy,16,2000)||!integer(body.x,Number(body.hx),Number(config.width)-Number(body.hx))||!integer(body.y,Number(body.hy),Number(config.height)-Number(body.hy))||!integer(body.vx,-128,128)||!integer(body.vy,-128,128)||!integer(body.hp,0,1000000)||!integer(body.team,0,8)||!integer(body.value,0,1000000)||typeof body.fixed!=='boolean')err('Out-of-bounds integer body');
    if(body.ttl!==undefined&&!integer(body.ttl,0,1000000)||body.invulnerableUntil!==undefined&&!integer(body.invulnerableUntil,0,1000000)||body.hits!==undefined&&(!Array.isArray(body.hits)||body.hits.length>128||body.hits.some(x=>typeof x!=='string')))err('Invalid body lifetime or hit ledger');
    return body as unknown as WorldBody;
}

/** Public/unbound admission stays strict: every configured target must exist. */
export function validateIntegerWorld(raw:unknown,config:Readonly<JsonRecord>):IntegerWorld {
    return validateWorldState(raw,config);
}
function validateWorldState(raw:unknown,config:Readonly<JsonRecord>,admittedTargets:readonly string[]=[]):IntegerWorld {
    if(!isRecord(raw)||!Array.isArray(raw.bodies)||raw.bodies.length>Number(config.maxObjects??128)||!integer(raw.score,0,100000000)||!integer(raw.charge,0,120)||!integer(raw.nextId,0,1000000)||typeof raw.won!=='boolean'||typeof raw.lost!=='boolean')err('Invalid integer world state');
    if(!Array.isArray(raw.contacts)||raw.contacts.length>8128||raw.contacts.some(x=>typeof x!=='string')||!Array.isArray(raw.grounded)||raw.grounded.some(x=>typeof x!=='string')||!Array.isArray(raw.spawned)||raw.spawned.length>64||raw.spawned.some(x=>!integer(x,0,63))||!isRecord(raw.cooldowns)||Object.values(raw.cooldowns).some(x=>!integer(x,0,1000000)))err('Invalid world bookkeeping');
    const ids=new Set<string>();
    if(raw.overflowTicks!==undefined&&!integer(raw.overflowTicks,0,1000000))err('Invalid overflow duration');
    for(const body of raw.bodies){
        if(isRecord(body)&&ids.has(String(body.id)))err('Invalid or duplicate world body');
        const checked=validateWorldBody(body,config);ids.add(checked.id);
    }
    for(const constraint of (config.constraints??[]) as JsonRecord[]){if((!ids.has(String(constraint.body))&&!admittedTargets.includes(String(constraint.body)))||Number(constraint.minX)>Number(constraint.maxX)||Number(constraint.minY)>Number(constraint.maxY)||Number(constraint.maxX)>Number(config.width)||Number(constraint.maxY)>Number(config.height))err('Invalid body constraint');}
    return raw as unknown as IntegerWorld;
}
function validateConfig(c:Readonly<JsonRecord>):void {
    if(typeof c.statePath!=='string'||!c.statePath.startsWith('/')||!integer(c.width,256,32000)||!integer(c.height,256,32000))err('Invalid integer world config');
    const ranges:Record<string,[number,number]>={overflowTicks:[1,120],overflowY:[16,32000],gravity:[-16,16],moveSpeed:[0,128],jumpSpeed:[0,128],maxCharge:[1,120],restitution:[0,1000],maxObjects:[1,128],projectileSpeed:[1,128],projectileHalfSize:[16,128],damage:[1,1000],cooldownTicks:[1,600],invulnerabilityTicks:[0,600],goalScore:[1,1000000],seekSpeed:[0,128],scrollSpeed:[-128,128],laneWidth:[16,32000]};
    for(const [key,[min,max]] of Object.entries(ranges))if(c[key]!==undefined&&!integer(c[key],min,max))err('Invalid world '+key);
    if(c.aimMetric!==undefined&&c.aimMetric!=='manhattan'&&c.aimMetric!=='euclidean')err('Invalid aim metric');
    if(c.aimMetric==='euclidean'&&c.weaponRange!==undefined&&!integer(c.weaponRange,1,32000))err('Invalid Euclidean weapon range');
    if(c.actions!==undefined&&!isRecord(c.actions))err('Invalid world actions');
    if(c.stickActions!==undefined){
        const input=c.stickActions;
        if(!isRecord(input)||typeof input.move!=='string'||typeof input.aim!=='string'||input.move===input.aim||
            !integer(input.reticleStep,50,1000)||!integer(c.maxTicks,1,1000000)||
            (Math.floor(Number(c.width)/input.reticleStep)+1)*(Math.floor(Number(c.height)/input.reticleStep)+1)>4096||
            c.heldMovement===true||c.laneCenters!==undefined||c.aimPath!==undefined||c.autoFire===true||
            c.autoTarget===true||c.fireRequestPath!==undefined||c.aimMetric!=='euclidean')
            err('Invalid live-stick combat profile');
    }
    if(c.platformLanding!==undefined&&typeof c.platformLanding!=='boolean')err('Invalid platform landing mode');
    if(c.laneCenters!==undefined){
        if(!Array.isArray(c.laneCenters)||c.laneCenters.length<2||c.laneCenters.length>16||c.laneCenters.some((x,i,a)=>!integer(x,16,32000)||i>0&&Number(a[i-1])>=x))err('Invalid ordered lane centers');
        const laneActions=isRecord(c.actions)?c.actions:{};
        if(c.heldMovement===true||laneActions.left!==undefined||laneActions.right!==undefined||Number(c.jumpHorizontalSpeed??0)!==0)err('Fixed lanes require lane-only horizontal movement');
    }
    if(c.waves!==undefined&&(!Array.isArray(c.waves)||c.waves.length>64))err('Invalid waves');
}

/** A tick-bound checkpointable service; integers are world units, velocities units per tick. */
export function simulateIntegerWorld(ctx:ModuleContext):ModuleResult {
    const c=ctx.config;validateConfig(c);const raw=readPointer(ctx.world.state,String(c.statePath));
    let admittedTargets:readonly string[]|undefined;
    if(ctx.resolveRealtimeConstraintTargets!==undefined){
        if(typeof ctx.resolveRealtimeConstraintTargets!=='function')err('Invalid realtime constraint provenance');
        admittedTargets=ctx.resolveRealtimeConstraintTargets(c);
        if(!Array.isArray(admittedTargets)||!Object.isFrozen(admittedTargets)||admittedTargets.some(id=>typeof id!=='string'))err('Invalid realtime constraint provenance');
    }
    // A previously admitted target may leave via combat, TTL, merge, pickup or authorized rules.
    // Its static constraint remains dormant while absent and applies if the same ID returns.
    const w=clone(validateWorldState(raw,c,admittedTargets)),events:NonNullable<ModuleResult['events']>=[],emit=(type:string,payload:JsonRecord)=>events.push({type,payload});
    const maximum=Number(c.maxObjects??128),actions=(c.actions??{}) as JsonRecord,actor=w.bodies.find(b=>b.kind==='actor'&&b.hp>0),dead=new Set<string>(),damageLedger=new Set<string>();
    const bound=(key:string)=>readPointer(ctx.world.state,String(c[key]));
    const bonus=c.damageBonusPath?bound('damageBonusPath'):0;if(!integer(bonus,0,1000))err('Invalid bound damage bonus');const damageValue=Math.min(1000,Number(c.damage??1)+bonus);
    const requested=c.fireRequestPath?bound('fireRequestPath'):false;if(typeof requested!=='boolean')err('Invalid fire request');
    const laneRequest=c.laneRequestPath?bound('laneRequestPath'):0;if(!integer(laneRequest,-1,1))err('Invalid lane request');
    const tilt=c.tiltGravityPath?bound('tiltGravityPath'):[0,0];if(!Array.isArray(tilt)||tilt.length!==2||!tilt.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1))err('Invalid tilt gravity');
    const power=c.powerPath?bound('powerPath'):1;if(typeof power!=='number'||!Number.isFinite(power)||power<0||power>1)err('Invalid bound shot power');
    const press=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&e.edge==='press');
    const release=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&e.edge==='release');
    const cancel=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&e.edge==='cancel');
    const ended=(name:string)=>release(name)||cancel(name);
    const sticks=isRecord(c.stickActions)?c.stickActions:undefined;
    const round=(v:number)=>Math.sign(v)*Math.round(Math.abs(v))||0;
    const active=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&(e.edge==='press'||e.edge==='hold'));
    const fromKeys=(left:string,right:string,down:string,up:string):[number,number]=>{
        const x=Number(active(right))-Number(active(left)),y=Number(active(up))-Number(active(down));
        const len=Math.sqrt(x*x+y*y)||1;return [x/len,y/len];
    };
    const fromStick=(name:Json,keys:[number,number]):[number,number]=>{
        const pressed=ctx.inputs.filter(e=>e.type==='input.action'&&e.action===name&&e.edge==='press');
        const touch=pressed.filter(e=>e.sourceId?.startsWith('touch-stick:'));
        const v=(touch.at(-1)??pressed.at(-1))?.payload.value;
        if(!Array.isArray(v)||v.length!==2||!v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1))return keys;
        const x=Number(v[0]),y=Number(v[1]);if(x===0&&y===0)return keys;
        const len=Math.max(1,Math.sqrt(x*x+y*y));return [x/len,y/len];
    };
    const liveAim=sticks?fromStick(sticks.aim!,fromKeys('aimLeft','aimRight','aimDown','aimUp')):undefined;

    const spawn=(body:WorldBody):boolean=>{
        if(w.bodies.length>=maximum){emit('realtime.pool-full',{});return false;}
        if(w.bodies.some(b=>b.id===body.id))err('Spawn ID already alive');w.bodies.push(body);emit('realtime.spawned',{id:body.id});return true;
    };
    for(const [index,entry] of ((c.waves??[]) as JsonRecord[]).entries())if(ctx.tickIndex>=Number(entry.tick)&&!w.spawned.includes(index)){
        const b=clone(entry.body) as unknown as WorldBody;validateWorldBody(b,c);
        if(spawn(b))w.spawned.push(index);
    }
    let selectedLane:number|undefined;const centers=c.laneCenters as number[]|undefined;
    if(actor){
        if(sticks){
            const v=fromStick(sticks.move!,fromKeys('left','right','down','up')),speed=Number(c.moveSpeed??64);
            actor.vx=round(v[0]*speed);actor.vy=round(v[1]*speed);
        }else{
        if(c.heldMovement===true){actor.vx=0;actor.vy=0;
            const active=(name:string)=>ctx.inputs.some(e=>e.type==='input.action'&&e.action===actions[name]&&(e.edge==='press'||e.edge==='hold'));
            actor.vx=((active('right')?1:0)-(active('left')?1:0))*Number(c.moveSpeed??64);
            actor.vy=((active('up')?1:0)-(active('down')?1:0))*Number(c.moveSpeed??64);
        }
        if(c.heldMovement!==true){if(press('left'))actor.vx=-Number(c.moveSpeed??64);if(press('right'))actor.vx=Number(c.moveSpeed??64);}
        if(ended('left')&&actor.vx<0||ended('right')&&actor.vx>0)actor.vx=0;
        if(c.heldMovement!==true){if(press('up'))actor.vy=Number(c.moveSpeed??64);if(press('down'))actor.vy=-Number(c.moveSpeed??64);}
        if(ended('up')&&actor.vy>0||ended('down')&&actor.vy<0)actor.vy=0;
        }
        const lane=clamp((press('laneRight')?1:0)-(press('laneLeft')?1:0)+laneRequest,-1,1);
        if(centers){const nearest=centers.reduce((best,x,i)=>Math.abs(x-actor.x)<Math.abs(centers[best]!-actor.x)?i:best,0);selectedLane=clamp(nearest+lane,0,centers.length-1);actor.x=centers[selectedLane]!;actor.vx=0;}
        else if(lane)actor.x=clamp(actor.x+lane*Number(c.laneWidth??1000),actor.hx,Number(c.width)-actor.hx);
        if(press('charge')||ctx.inputs.some(e=>e.action===actions.charge&&e.edge==='hold'))w.charge=Math.min(Number(c.maxCharge??60),w.charge+1);
        if(cancel('charge'))w.charge=0;
        if((press('jump')||release('charge'))&&(c.allowAirJump===true||w.grounded.includes(actor.id))){
            actor.vy=Math.min(128,Number(c.jumpSpeed??96)+w.charge);if(c.jumpHorizontalSpeed!==undefined)actor.vx=Math.min(128,Number(c.jumpHorizontalSpeed)+Math.floor(w.charge/4));w.charge=0;emit('realtime.jumped',{id:actor.id});
        }
        const circular=c.aimMetric==='euclidean',range=Number(c.weaponRange??32000);
        const distance=(b:WorldBody)=>{
            const x=b.x-actor.x,y=b.y-actor.y;
            return circular?x*x+y*y:Math.abs(x)+Math.abs(y);
        };
        const limit=circular?range*range:range;
        const targets=w.bodies.filter(b=>b.kind==='target'&&b.team!==actor.team&&b.hp>0&&distance(b)<=limit)
            .sort((a,b)=>distance(a)-distance(b)||stableCompare(a.id,b.id));
        if((liveAim?liveAim[0]!==0||liveAim[1]!==0:press('fire')||c.autoFire===true||requested)&&ctx.tickIndex>=(w.cooldowns[actor.id]??0)){
            const target=targets[0];let fired=false;
            const directions={right:[1,0],left:[-1,0],up:[0,1],down:[0,-1]},base=directions[String(c.fireDirection??'right') as keyof typeof directions]??[1,0];
            const aim=liveAim??(c.aimPath?bound('aimPath'):target&&c.autoTarget===true?[target.x-actor.x,target.y-actor.y]:base);
            if(!Array.isArray(aim)||aim.length!==2||!aim.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=32000))err('Invalid bound aim vector');
            const x=Number(aim[0]),y=Number(aim[1]);
            const scale=Math.max(Math.abs(x),Math.abs(y));
            // Scale before squaring to avoid underflow for an admitted tiny nonzero aim.
            const dx=scale?x/scale:0,dy=scale?y/scale:0;
            const total=Math.abs(x)+Math.abs(y),length=circular?Math.sqrt(dx*dx+dy*dy):total;
            const direction=length>0?(circular?[dx/length,dy/length]:[x/length,y/length]):base;
            if(c.weapon==='hitscan'){
                const end=[actor.x+direction[0]!*range,actor.y+direction[1]!*range];
                const hit=[...targets,...w.bodies.filter(b=>b.kind==='solid')].map(body=>({body,t:segmentAabb([actor.x,actor.y],end,body)})).filter(row=>row.t!==undefined).sort((a,b)=>a.t!-b.t!||stableCompare(a.body.id,b.body.id))[0]?.body;
                if(hit?.kind==='target')damage(hit,damageValue,actor.id);fired=true;
            }else{
                const speed=Math.max(1,Math.round(Number(c.projectileSpeed??128)*Math.max(0.1,power)));
                // Symmetric nearest-integer rounding keeps a unit-speed diagonal moving.
                const quantize=circular?(v:number)=>Math.sign(v)*Math.round(Math.abs(v))||0:Math.trunc;
                const id=`shot_${w.nextId}`;
                if(!w.bodies.some(b=>b.id===id)){const half=Number(c.projectileHalfSize??16);fired=spawn({id,kind:'projectile',x:actor.x,y:actor.y,vx:quantize(direction[0]!*speed),vy:quantize(direction[1]!*speed),hx:half,hy:half,hp:1,team:actor.team,value:damageValue,fixed:false,ttl:600,owner:actor.id,hits:[]});}
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
    const previousGrounded=new Set(w.grounded),grounded=new Set<string>(),contacts=new Set<string>(),landings=new Map<string,JsonRecord>();
    for(const b of w.bodies)if(!b.fixed&&(b.kind!=='projectile'||c.projectileGravity===true)){
        b.vx=clamp(b.vx+Math.round(Number(tilt[0])*16),-128,128);b.vy=clamp(b.vy+Number(c.gravity??0)-Math.round(Number(tilt[1])*16),-128,128);
        if(actor&&b.kind==='target'&&Number(c.seekSpeed??0)>0){
            const speed=Number(c.seekSpeed);
            if(sticks){
                const x=actor.x-b.x,y=actor.y-b.y,len=Math.max(1,Math.sqrt(x*x+y*y));
                b.vx=round(x/len*speed);b.vy=round(y/len*speed);
            }else b.vx=Math.sign(actor.x-b.x)*speed;
        }
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
            if(a.team!==b.team&&a.kind==='actor'&&b.kind==='target'){if(c.damageTargetsOnContact===true)damage(b,damageValue,a.id);else damage(a,1,b.id);}
            if(a.team!==b.team&&b.kind==='actor'&&a.kind==='target'){if(c.damageTargetsOnContact===true)damage(a,damageValue,b.id);else damage(b,1,a.id);}
            resolveContact(a,b);
        }
    }
    function resolveContact(a:WorldBody,b:WorldBody):void {
        if(a.fixed&&b.fixed)return;
        const px=a.hx+b.hx-Math.abs(a.x-b.x),py=a.hy+b.hy-Math.abs(a.y-b.y),axis=px<py?'x':'y',penetration=axis==='x'?px:py,sign=a[axis]<=b[axis]?-1:1;
        const amountA=a.fixed?0:b.fixed?penetration:Math.ceil(penetration/2),amountB=b.fixed?0:penetration-amountA;
        if(c.platformLanding===true&&axis==='y'){
            const top=a.y>b.y?a:b,bottom=top===a?b:a;
            if(top.kind==='actor'&&bottom.kind==='solid'&&top.vy<=0){top.vx=0;if(!landings.has(top.id))landings.set(top.id,{surface:bottom.id,x:top.x,centerOffset:top.x-bottom.x});}
        }
        a[axis]+=sign*amountA;b[axis]-=sign*amountB;
        const velocity=axis==='x'?'vx':'vy',bounce=Number(c.restitution??0);
        if(!a.fixed)a[velocity]=-Math.trunc(a[velocity]*bounce/1000);if(!b.fixed)b[velocity]=-Math.trunc(b[velocity]*bounce/1000);
        if(axis==='y'){if(a.y>b.y&&!a.fixed)grounded.add(a.id);if(b.y>a.y&&!b.fixed)grounded.add(b.id);}
    }
    for(const constraint of (c.constraints??[]) as JsonRecord[]){const b=w.bodies.find(body=>body.id===constraint.body);if(b){b.x=clamp(b.x,Number(constraint.minX)+b.hx,Number(constraint.maxX)-b.hx);b.y=clamp(b.y,Number(constraint.minY)+b.hy,Number(constraint.maxY)-b.hy);}}
    if(actor&&centers&&selectedLane!==undefined&&!dead.has(actor.id)){actor.x=centers[selectedLane]!;actor.vx=0;}
    for(const b of w.bodies){b.x=clamp(b.x,b.hx,Number(c.width)-b.hx);b.y=clamp(b.y,b.hy,Number(c.height)-b.hy);if(b.ttl!==undefined){b.ttl--;if(b.ttl<=0)dead.add(b.id);}}
    for(const key of [...contacts].sort(stableCompare))emit(w.contacts.includes(key)?'contact.stay':'contact.begin',{pair:key});
    for(const key of w.contacts.filter(key=>!contacts.has(key)).sort(stableCompare))emit('contact.end',{pair:key});
    for(const id of [...grounded].sort(stableCompare))if(!previousGrounded.has(id))emit('realtime.landed',{id,...landings.get(id)});
    w.contacts=[...contacts].sort(stableCompare);w.grounded=[...grounded].sort(stableCompare);w.bodies=w.bodies.filter(b=>!dead.has(b.id));
    w.won=c.goalScore!==undefined&&w.score>=Number(c.goalScore)||c.goalTick!==undefined&&ctx.tickIndex+1>=Number(c.goalTick);
    const timedOut=c.maxTicks!==undefined&&ctx.tickIndex+1>=Number(c.maxTicks)&&!w.won,below=Boolean(actor&&c.killBelowY!==undefined&&actor.y<Number(c.killBelowY));
    const supported=(b:WorldBody):boolean=>b.y<=b.hy+1||w.bodies.some(base=>base.y<b.y&&['solid','target'].includes(base.kind)&&Math.abs(b.x-base.x)<b.hx+base.hx&&Math.abs(b.y-b.hy-base.y-base.hy)<=32&&(base.fixed||base.vy===0&&supported(base)));
    const rootedOverflow=c.overflowY!==undefined&&w.bodies.some(b=>!b.fixed&&b.kind==='target'&&b.vy===0&&b.y+b.hy>Number(c.overflowY)&&supported(b));
    if(c.overflowY!==undefined)w.overflowTicks=rootedOverflow?(w.overflowTicks??0)+1:0;
    const overflow=c.overflowY!==undefined&&Number(w.overflowTicks)>=Number(c.overflowTicks??30);
    if(overflow)emit('realtime.failed',{reason:'overflow'});
    if(timedOut||below)emit('realtime.failed',{reason:timedOut?'timeout':'below-boundary'});
    w.lost=overflow||timedOut||below||Boolean(actor&&(actor.hp<=0||dead.has(actor.id)));
    if(sticks){
        w.health=actor?.hp??0;w.timeLeft=Math.max(0,Number(c.maxTicks)-ctx.tickIndex-1);w.crosshair=[];
        if(actor&&actor.hp>0&&liveAim&&(liveAim[0]!==0||liveAim[1]!==0)){
            const step=Number(sticks.reticleStep),cols=Math.floor(Number(c.width)/step)+1,rows=Math.floor(Number(c.height)/step)+1;
            const len=Math.sqrt(liveAim[0]**2+liveAim[1]**2);
            const x=clamp(Math.round((actor.x+liveAim[0]/len*650)/step),0,cols-1);
            const y=clamp(Math.round((Number(c.height)-actor.y-liveAim[1]/len*650)/step),0,rows-1);
            w.crosshair=[y*cols+x];
        }
    }
    validateWorldState(w,c,admittedTargets);
    return {proposals:[{kind:'state.set',path:String(c.statePath),value:w as unknown as Json},...(c.fireRequestPath?[{kind:'state.set' as const,path:String(c.fireRequestPath),value:false}]:[]),...(c.laneRequestPath?[{kind:'state.set' as const,path:String(c.laneRequestPath),value:0}]:[])],events};
}
export const realtimeWorldImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateIntegerWorld};
export function validateRealtimeDefinition(def:GameDefinition):void {
    const state=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
    for(const entity of [...def.scenes.flatMap(s=>s.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.realtime.world'){
        const c=component.config;validateConfig(c);const w=validateIntegerWorld(readPointer(state,String(c.statePath)),c);
        if(Array.isArray(c.laneCenters)){const actor=w.bodies.find(b=>b.kind==='actor');if(!actor||actor.vx!==0||!c.laneCenters.includes(actor.x)||c.laneCenters.some(x=>Number(x)<actor.hx||Number(x)>Number(c.width)-actor.hx))err('Lane actor and centers must fit the world');}
        if(isRecord(c.stickActions)){
            for(const action of [c.stickActions.move,c.stickActions.aim])
                if(!def.inputs.actions.some(a=>a.id===action&&a.valueType==='vec2'))err('Live-stick actions must be declared vec2 inputs');
            if(w.bodies.filter(b=>b.kind==='actor').length!==1||w.bodies.some(b=>b.kind==='actor'&&(b.fixed||b.value!==0)))
                err('Live-stick world needs one moving zero-score actor');
        }
        for(const name of Object.values((c.actions??{}) as JsonRecord))if(!def.inputs.actions.some(a=>a.id===name))err('Unknown realtime action');
        for(const key of ['aimPath','fireRequestPath','powerPath','damageBonusPath','laneRequestPath','tiltGravityPath'])if(c[key]!==undefined){
            const value=readPointer(state,String(c[key]));
            const valid=key==='aimPath'||key==='tiltGravityPath'?Array.isArray(value)&&value.length===2&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=(key==='tiltGravityPath'?1:32000)):key==='fireRequestPath'?typeof value==='boolean':key==='powerPath'?typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1:key==='laneRequestPath'?integer(value,-1,1):integer(value,0,1000);
            if(!valid)err('Invalid initial bound weapon field '+key);
            if(['fireRequestPath','laneRequestPath'].includes(key)&&String(c[key]).startsWith(String(c.statePath)+'/'))err('Requests must use independent controller state');
        }
        for(const entry of (c.waves??[]) as JsonRecord[]){if(!integer(entry.tick,0,1000000))err('Invalid wave tick');validateWorldBody(entry.body,c);}
    }
}
