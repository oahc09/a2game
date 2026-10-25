import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeInteger,stableCompare} from '../utils.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';

interface Point {x:number;y:number;}
interface Tower {id:string;cell:number;level:number;weaponId:string;}
interface Weapon {id:string;owner:string;nextFire:number;}
interface Enemy extends Point {id:string;hp:number;cursor:number;reward:number;}
interface DefenseState {wallet:number;score:number;lives:number;nextId:number;selected:number;waveCursor:number;towers:Tower[];weapons:Weapon[];enemies:Enemy[];bodies:JsonRecord[];shots:JsonRecord[];won:boolean;lost:boolean;}
const error=(why:string):never=>fail('A2G_E_CAP_CONFIG',why);
const integer=(v:unknown,min:number,max:number):v is number=>safeInteger(v)&&v>=min&&v<=max;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,48}$/.test(v);
export function initialDefenseState(wallet=4,lives=3):JsonRecord{return {wallet,score:0,lives,nextId:0,selected:-1,waveCursor:0,towers:[],weapons:[],enemies:[],bodies:[],shots:[],won:false,lost:false};}

function checkConfig(c:Readonly<JsonRecord>):void {
 if(typeof c.statePath!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(c.statePath)||!integer(c.width,256,32000)||!integer(c.height,256,32000))error('Invalid defense dimensions/state path');
 for(const [key,min,max] of [['cost',1,1000000],['damage',1,1000],['range',16,64000],['speed',1,128],['cooldownTicks',1,600],['maxTicks',1,1000000]] as const)if(!integer(c[key],min,max))error('Invalid defense '+key);
 const point=(p:unknown)=>isRecord(p)&&integer(p.x,100,Number(c.width)-100)&&integer(p.y,100,Number(c.height)-100);
 if(!Array.isArray(c.cells)||c.cells.length<1||c.cells.length>16||!c.cells.every(point)||new Set(c.cells.map(p=>{const v=p as JsonRecord;return String(v.x)+','+String(v.y);})).size!==c.cells.length)error('Invalid defense placement cells');
 if(!Array.isArray(c.path)||c.path.length<2||c.path.length>64||!c.path.every(point))error('Invalid defense path');
 if(!Array.isArray(c.waves)||c.waves.length<1||c.waves.length>32)error('Invalid defense waves');
 let previous=0;for(const wave of c.waves as JsonRecord[]){if(!isRecord(wave)||!integer(wave.tick,1,Number(c.maxTicks))||wave.tick<previous||!integer(wave.hp,1,1000000)||!integer(wave.reward,0,1000000))error('Invalid defense wave');previous=Number(wave.tick);}
 if(!Array.isArray(c.actions)||c.actions.length<1||c.actions.length>64)error('Invalid defense actions');
 const names=new Set<string>();for(const a of c.actions as JsonRecord[]){if(!isRecord(a)||typeof a.action!=='string'||names.has(a.action)||!['place','select','merge','upgrade'].includes(String(a.kind))||!integer(a.index,0,(c.cells as Json[]).length-1))error('Invalid defense command');names.add(String(a.action));}
}
function checked(raw:unknown,c:Readonly<JsonRecord>):DefenseState {
 if(!isRecord(raw))error('Defense state must be an object');const s=raw as unknown as DefenseState;
 for(const key of ['wallet','score','nextId'] as const)if(!integer(s[key],0,1000000000))error('Invalid defense '+key);
 if(!integer(s.lives,0,1000)||!integer(s.selected,-1,15)||!integer(s.waveCursor,0,(c.waves as Json[]).length)||typeof s.won!=='boolean'||typeof s.lost!=='boolean'||!Array.isArray(s.towers)||s.towers.length>16||!Array.isArray(s.weapons)||s.weapons.length!==s.towers.length||!Array.isArray(s.enemies)||s.enemies.length>32||!Array.isArray(s.bodies)||s.bodies.length>48||!Array.isArray(s.shots)||s.shots.length>16)error('Invalid defense bookkeeping');
 const ids=new Set<string>(),cells=new Set<number>(),weapons=new Set<string>();
 for(const t of s.towers){if(!isRecord(t)||!id(t.id)||ids.has(t.id)||!id(t.weaponId)||weapons.has(t.weaponId)||!integer(t.cell,0,(c.cells as Json[]).length-1)||cells.has(t.cell)||!integer(t.level,1,8))error('Invalid or duplicate tower');ids.add(t.id);cells.add(t.cell);weapons.add(t.weaponId);}
 for(const w of s.weapons){if(!isRecord(w)||!id(w.id)||!id(w.owner)||!integer(w.nextFire,0,1000000600)||!s.towers.some(t=>t.id===w.owner&&t.weaponId===w.id))error('Stale weapon owner');}
 if(new Set(s.weapons.map(w=>w.id)).size!==s.weapons.length)error('Duplicate weapon');
 for(const e of s.enemies){if(!isRecord(e)||!id(e.id)||ids.has(e.id)||!integer(e.x,100,Number(c.width)-100)||!integer(e.y,100,Number(c.height)-100)||!integer(e.hp,1,1000000)||!integer(e.reward,0,1000000)||!integer(e.cursor,1,(c.path as Json[]).length))error('Invalid defense enemy');ids.add(e.id);}
 for(const body of s.bodies)if(!isRecord(body)||!ids.has(String(body.id))||!['actor','target'].includes(String(body.kind))||!integer(body.x,100,Number(c.width)-100)||!integer(body.y,100,Number(c.height)-100)||body.hx!==150||body.hy!==150||!integer(body.value,1,1000000))error('Invalid defense body projection');
 for(const shot of s.shots)if(!isRecord(shot)||!s.weapons.some(w=>w.id===shot.weapon&&w.owner===shot.owner)||!id(shot.target)||!integer(shot.tick,0,1000000000))error('Stale defense shot reference');
 return s;
}

/** Commands -> waves/path -> weapons -> rewards. All ownership and cooldowns are checkpointed. */
export function simulateDefense(ctx:ModuleContext):ModuleResult {
 const c=ctx.config;checkConfig(c);const s=clone(checked(readPointer(ctx.world.state,String(c.statePath)),c));
 const events:NonNullable<ModuleResult['events']>=[],emit=(type:string,payload:JsonRecord)=>events.push({type,payload});
 const cells=c.cells as unknown as Point[],path=c.path as unknown as Point[];s.shots=[];
 const create=(cell:number,level:number,nextFire=ctx.tickIndex)=>{const serial=s.nextId++,t={id:'tower_'+serial,cell,level,weaponId:'weapon_'+serial};s.towers.push(t);s.weapons.push({id:t.weaponId,owner:t.id,nextFire});return t;};
 for(const input of ctx.inputs.filter(e=>e.type==='input.action'&&e.edge==='press')){
  const command=(c.actions as JsonRecord[]).find(a=>a.action===input.action);if(!command)continue;const index=Number(command.index),target=s.towers.find(t=>t.cell===index);let valid=false;
  if(command.kind==='place'&&!target&&s.wallet>=Number(c.cost)){s.wallet-=Number(c.cost);const t=create(index,1);emit('defense.placed',{id:t.id,cell:index});valid=true;}
  if(command.kind==='select'&&target){s.selected=index;valid=true;}
  if(command.kind==='upgrade'&&target&&target.level<8&&s.wallet>=Number(c.cost)*target.level){s.wallet-=Number(c.cost)*target.level;target.level++;valid=true;}
  if(command.kind==='merge'&&target){const source=s.towers.find(t=>t.cell===s.selected);if(source&&source.id!==target.id&&source.level===target.level&&target.level<8){
   const retired=[source.id,target.id],oldWeapons=s.weapons.filter(w=>retired.includes(w.owner)),nextFire=Math.max(ctx.tickIndex,...oldWeapons.map(w=>w.nextFire));
   s.towers=s.towers.filter(t=>!retired.includes(t.id));s.weapons=s.weapons.filter(w=>!retired.includes(w.owner));const replacement=create(index,target.level+1,nextFire);s.selected=-1;
   emit('defense.merged',{retired,retiredWeapons:oldWeapons.map(w=>w.id),replacement:replacement.id,weapon:replacement.weaponId});valid=true;
  }}
  emit(valid?'defense.changed':'defense.invalid',{action:input.action??'',kind:command.kind!});
 }
 const waves=c.waves as JsonRecord[];while(s.waveCursor<waves.length&&Number(waves[s.waveCursor]!.tick)<=ctx.tickIndex){const wave=waves[s.waveCursor]!,serial=s.nextId++;s.enemies.push({id:'enemy_'+serial,...path[0]!,hp:Number(wave.hp),reward:Number(wave.reward),cursor:1});s.waveCursor++;emit('defense.wave',{index:s.waveCursor});}
 const escaped=new Set<string>();for(const e of s.enemies){let budget=Number(c.speed);while(budget>0&&e.cursor<path.length){const p=path[e.cursor]!,dx=p.x-e.x,x=Math.sign(dx)*Math.min(Math.abs(dx),budget);e.x+=x;budget-=Math.abs(x);const dy=p.y-e.y,y=Math.sign(dy)*Math.min(Math.abs(dy),budget);e.y+=y;budget-=Math.abs(y);if(e.x===p.x&&e.y===p.y)e.cursor++;else break;}if(e.cursor===path.length){escaped.add(e.id);s.lives=Math.max(0,s.lives-1);emit('defense.escaped',{id:e.id});}}
 s.enemies=s.enemies.filter(e=>!escaped.has(e.id));
 for(const t of [...s.towers].sort((a,b)=>stableCompare(a.id,b.id))){const w=s.weapons.find(w=>w.id===t.weaponId)!,at=cells[t.cell]!;if(ctx.tickIndex<w.nextFire)continue;
  const distance=(e:Enemy)=>Math.abs(e.x-at.x)+Math.abs(e.y-at.y),target=s.enemies.filter(e=>e.hp>0&&distance(e)<=Number(c.range)).sort((a,b)=>distance(a)-distance(b)||stableCompare(a.id,b.id))[0];if(!target)continue;
  target.hp=Math.max(0,target.hp-Number(c.damage)*2**(t.level-1));w.nextFire=ctx.tickIndex+Number(c.cooldownTicks);s.shots.push({owner:t.id,weapon:w.id,target:target.id,tick:ctx.tickIndex});emit('defense.fired',{owner:t.id,weapon:w.id,target:target.id});
  if(target.hp===0){s.wallet+=target.reward;s.score++;emit('defense.reward',{id:target.id,amount:target.reward});}
 }
 s.enemies=s.enemies.filter(e=>e.hp>0);s.lost=s.lives===0||ctx.tickIndex>=Number(c.maxTicks);s.won=!s.lost&&s.waveCursor===waves.length&&s.enemies.length===0;
 const visual=(id:string,kind:string,p:Point,value:number)=>({id,kind,...p,vx:0,vy:0,hx:150,hy:150,hp:1,team:kind==='actor'?1:2,value,fixed:true});
 s.bodies=[...s.towers.map(t=>visual(t.id,'actor',cells[t.cell]!,2**t.level)),...s.enemies.map(e=>visual(e.id,'target',e,e.hp))];
 checked(s as unknown as JsonRecord,c);return {proposals:[{kind:'state.set',path:String(c.statePath),value:s as unknown as Json}],events};
}
export const defenseImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateDefense};
export function validateDefenseDefinition(def:GameDefinition):void {
 const state=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
 for(const entity of [...def.scenes.flatMap(s=>s.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.strategy.tower-defense'){
  checkConfig(component.config);checked(readPointer(state,String(component.config.statePath)),component.config);
  if((component.config.actions as JsonRecord[]).some(a=>!def.inputs.actions.some(input=>input.id===a.action&&input.valueType==='button')))error('Defense command references an unknown button action');
 }
}
