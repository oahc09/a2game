import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeInteger,stableCompare} from '../utils.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
import {productionLineId} from './production-line.js';

interface Point {x:number;y:number;}
type Specialization = 'range' | 'slow';
interface Tower {id:string;cell:number;level:number;weaponId:string;specialization?:Specialization;}
interface Weapon {id:string;owner:string;nextFire:number;}
interface Enemy extends Point {id:string;hp:number;cursor:number;reward:number;fromCell?:number;toCell?:number;slowUntil?:number;}
interface DefenseState {wallet:number;score:number;lives:number;nextId:number;selected:number;waveCursor:number;towers:Tower[];weapons:Weapon[];enemies:Enemy[];bodies:JsonRecord[];shots:JsonRecord[];won:boolean;lost:boolean;route?:number[];}
interface RouteGrid {columns:number;rows:number;origin:Point;spacing:number;}
interface MergeSpecializations {range:number;slowRange:number;slowSpeed:number;slowTicks:number;}
const error=(why:string):never=>fail('A2G_E_CAP_CONFIG',why);
const integer=(v:unknown,min:number,max:number):v is number=>safeInteger(v)&&v>=min&&v<=max;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,48}$/.test(v);
export function initialDefenseState(wallet=4,lives=3):JsonRecord{return {wallet,score:0,lives,nextId:0,selected:-1,waveCursor:0,towers:[],weapons:[],enemies:[],bodies:[],shots:[],won:false,lost:false};}

const gridPoint=(g:RouteGrid,cell:number):Point=>({x:g.origin.x+cell%g.columns*g.spacing,y:g.origin.y-Math.floor(cell/g.columns)*g.spacing});
function gridCell(g:RouteGrid,p:Point):number{
 const x=(p.x-g.origin.x)/g.spacing,y=(g.origin.y-p.y)/g.spacing;
 return integer(x,0,g.columns-1)&&integer(y,0,g.rows-1)?y*g.columns+x:-1;
}
function neighbors(g:RouteGrid,cell:number):number[]{
 const x=cell%g.columns,y=Math.floor(cell/g.columns);
 return [x>0?cell-1:-1,x<g.columns-1?cell+1:-1,y>0?cell-g.columns:-1,y<g.rows-1?cell+g.columns:-1].filter(v=>v>=0);
}
function distances(g:RouteGrid,exit:number,blocked:Set<number>):number[]{
 const distance=Array<number>(g.columns*g.rows).fill(-1),queue=[exit];
 distance[exit]=0;
 for(let i=0;i<queue.length;i++){
  const cell=queue[i]!;
  for(const next of neighbors(g,cell))if(distance[next]===-1&&!blocked.has(next)){
   distance[next]=distance[cell]!+1;queue.push(next);
  }
 }
 return distance;
}
function nextCell(g:RouteGrid,distance:number[],cell:number):number{
 return neighbors(g,cell).find(next=>distance[next]>=0&&distance[next]===distance[cell]!-1)??error('Unreachable defense route');
}
function checkConfig(c:Readonly<JsonRecord>,configPointer?:string):RouteGrid|undefined {
 if(typeof c.statePath!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(c.statePath)||!integer(c.width,256,32000)||!integer(c.height,256,32000))error('Invalid defense dimensions/state path');
 if(c.ammo!==undefined&&(!isRecord(c.ammo)||typeof c.ammo.linePath!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(c.ammo.linePath)||c.ammo.linePath===c.statePath||!integer(c.ammo.warehouse,0,11)))error('Invalid defense ammunition binding');
 for(const [key,min,max] of [['cost',1,1000000],['damage',1,1000],['range',16,64000],['speed',1,128],['cooldownTicks',1,600],['maxTicks',1,1000000]] as const)if(!integer(c[key],min,max))error('Invalid defense '+key);
 if(c.mergeSpecializations!==undefined){
  const spec=c.mergeSpecializations;
  if(!isRecord(spec)||!integer(spec.range,Number(c.range)+1,64000)||!integer(spec.slowRange,16,Number(c.range))||!integer(spec.slowSpeed,1,Number(c.speed)-1)||!integer(spec.slowTicks,1,600))error('Invalid defense merge specializations');
 }
 const point=(p:unknown)=>isRecord(p)&&integer(p.x,100,Number(c.width)-100)&&integer(p.y,100,Number(c.height)-100);
 if(!Array.isArray(c.cells)||c.cells.length<1||c.cells.length>16||!c.cells.every(point)||new Set(c.cells.map(p=>{const v=p as JsonRecord;return String(v.x)+','+String(v.y);})).size!==c.cells.length)error('Invalid defense placement cells');
 if(!Array.isArray(c.path)||c.path.length<2||c.path.length>64||!c.path.every(point))error('Invalid defense path');
 if(!Array.isArray(c.waves)||c.waves.length<1||c.waves.length>32)error('Invalid defense waves');
 let previous=0;for(const wave of c.waves as JsonRecord[]){if(!isRecord(wave)||!integer(wave.tick,1,Number(c.maxTicks))||wave.tick<previous||!integer(wave.hp,1,1000000)||!integer(wave.reward,0,1000000))error('Invalid defense wave');previous=Number(wave.tick);}
 if(!Array.isArray(c.actions)||c.actions.length<1||c.actions.length>64)error('Invalid defense actions');
 const names=new Set<string>();for(const [index,a] of (c.actions as JsonRecord[]).entries()){
  if(!isRecord(a)||typeof a.action!=='string'||names.has(a.action)||!['place','select','merge','upgrade'].includes(String(a.kind)))error('Invalid defense command');
  if(a.specialization!==undefined&&(a.kind!=='merge'||c.mergeSpecializations===undefined||(a.specialization!=='range'&&a.specialization!=='slow')))error('Invalid defense merge specialization command');
  if(!integer(a.index,0,(c.cells as Json[]).length-1))fail('A2G_E_CAP_CONFIG','Invalid defense command index',{ruleId:'defense.action-index',capabilityId:'a2game.strategy.tower-defense',expected:(c.cells as Json[]).length-1,...(configPointer?{jsonPointer:configPointer+'/actions/'+index+'/index'}:{})});
  names.add(String(a.action));
 }
 if(c.routeGrid===undefined)return;
 const g=c.routeGrid as unknown as RouteGrid;
 if(!isRecord(c.routeGrid)||!integer(g.columns,2,12)||!integer(g.rows,2,12)||!integer(g.spacing,256,8000)||!point(g.origin)||!point(gridPoint(g,g.columns*g.rows-1)))error('Invalid defense route grid');
 const path=c.path as unknown as Point[];
 const entry=gridCell(g,path[0]!),exit=gridCell(g,path[1]!);
 if(path.length!==2||entry<0||exit<0||entry===exit||(c.cells as unknown as Point[]).some(p=>{const cell=gridCell(g,p);return cell<0||cell===entry||cell===exit;}))error('Defense grid requires two distinct endpoints and legal placement cells');
 return g;
}
function checked(raw:unknown,c:Readonly<JsonRecord>,statePointer?:string,grid?:RouteGrid):DefenseState {
 if(!isRecord(raw))error('Defense state must be an object');const s=raw as unknown as DefenseState;
 const stateError=(key:string,expected:string):never=>fail('A2G_E_CAP_CONFIG','Invalid defense state field',{ruleId:'defense.required-state',capabilityId:'a2game.strategy.tower-defense',expected,...(statePointer?{jsonPointer:statePointer+'/'+key}:{})});
 for(const key of ['wallet','score','nextId'] as const)if(!integer(s[key],0,1000000000))stateError(key,'integer');
 for(const [key,min,max] of [['lives',0,1000],['selected',-1,15],['waveCursor',0,(c.waves as Json[]).length]] as const)if(!integer(s[key],min,max))stateError(key,'integer');
 for(const key of ['won','lost'] as const)if(typeof s[key]!=='boolean')stateError(key,'boolean');
 for(const key of ['towers','weapons','enemies','bodies','shots'] as const)if(!Array.isArray(s[key]))stateError(key,'array');
 if(!integer(s.lives,0,1000)||!integer(s.selected,-1,15)||!integer(s.waveCursor,0,(c.waves as Json[]).length)||typeof s.won!=='boolean'||typeof s.lost!=='boolean'||!Array.isArray(s.towers)||s.towers.length>16||!Array.isArray(s.weapons)||s.weapons.length!==s.towers.length||!Array.isArray(s.enemies)||s.enemies.length>32||!Array.isArray(s.bodies)||s.bodies.length>48||!Array.isArray(s.shots)||s.shots.length>16)error('Invalid defense bookkeeping');
 const ids=new Set<string>(),cells=new Set<number>(),weapons=new Set<string>();
 for(const t of s.towers){if(!isRecord(t)||!id(t.id)||ids.has(t.id)||!id(t.weaponId)||weapons.has(t.weaponId)||!integer(t.cell,0,(c.cells as Json[]).length-1)||cells.has(t.cell)||!integer(t.level,1,8))error('Invalid or duplicate tower');ids.add(t.id);cells.add(t.cell);weapons.add(t.weaponId);}
 if(s.towers.some(t=>t.specialization!==undefined&&(c.mergeSpecializations===undefined||t.level<2||!['range','slow'].includes(t.specialization))))error('Invalid specialized tower');
 for(const w of s.weapons){if(!isRecord(w)||!id(w.id)||!id(w.owner)||!integer(w.nextFire,0,1000000600)||!s.towers.some(t=>t.id===w.owner&&t.weaponId===w.id))error('Stale weapon owner');}
 if(new Set(s.weapons.map(w=>w.id)).size!==s.weapons.length)error('Duplicate weapon');
 for(const e of s.enemies){
  if(!isRecord(e)||!id(e.id)||ids.has(e.id)||!integer(e.x,100,Number(c.width)-100)||!integer(e.y,100,Number(c.height)-100)||!integer(e.hp,1,1000000)||!integer(e.reward,0,1000000)||!integer(e.cursor,1,(c.path as Json[]).length))error('Invalid defense enemy');
  if(e.slowUntil!==undefined&&(c.mergeSpecializations===undefined||!integer(e.slowUntil,0,Number(c.maxTicks)+600)))error('Invalid defense slow expiry');
  if(grid){
   const last=grid.columns*grid.rows-1;
   if(!integer(e.fromCell,0,last)||!integer(e.toCell,0,last)||!neighbors(grid,e.fromCell).includes(e.toCell)||e.cursor!==1)error('Invalid defense route segment');
   const a=gridPoint(grid,e.fromCell!),b=gridPoint(grid,e.toCell!);
   if(!integer(e.x,Math.min(a.x,b.x),Math.max(a.x,b.x))||!integer(e.y,Math.min(a.y,b.y),Math.max(a.y,b.y)))error('Enemy outside defense route segment');
  }
  ids.add(e.id);
 }
 for(const body of s.bodies)if(!isRecord(body)||!ids.has(String(body.id))||!['actor','target'].includes(String(body.kind))||!integer(body.x,100,Number(c.width)-100)||!integer(body.y,100,Number(c.height)-100)||body.hx!==150||body.hy!==150||!integer(body.value,1,1000000))error('Invalid defense body projection');
 for(const shot of s.shots)if(!isRecord(shot)||!s.weapons.some(w=>w.id===shot.weapon&&w.owner===shot.owner)||!id(shot.target)||!integer(shot.tick,0,1000000000))error('Stale defense shot reference');
 return s;
}

/** Commands -> waves/path -> weapons -> rewards. All ownership and cooldowns are checkpointed. */
export function simulateDefense(ctx:ModuleContext):ModuleResult {
 const c=ctx.config,grid=checkConfig(c);
 const ammo=c.ammo as {linePath:string;warehouse:number}|undefined;
 const line=ammo?readPointer(ctx.world.state,ammo.linePath):undefined;
 const inputs=isRecord(line)&&Array.isArray(line.inputs)?line.inputs:undefined;
 const stock=ammo?inputs?.[ammo.warehouse]:undefined;
 if(ammo&&!integer(stock,0,1000))error('Invalid defense ammunition stock');
 let remaining=Number(stock??0);
 const specializations=c.mergeSpecializations as unknown as MergeSpecializations|undefined;
 const s=clone(checked(readPointer(ctx.world.state,String(c.statePath)),c,undefined,grid));
 const events:NonNullable<ModuleResult['events']>=[],emit=(type:string,payload:JsonRecord)=>events.push({type,payload});
 const cells=c.cells as unknown as Point[],path=c.path as unknown as Point[];s.shots=[];
 const entry=grid?gridCell(grid,path[0]!):-1,exit=grid?gridCell(grid,path[1]!):-1;
 const occupied=(g:RouteGrid)=>new Set(s.towers.map(t=>gridCell(g,cells[t.cell]!)));
 const canPlace=(index:number):boolean=>{
  if(!grid)return true;
  const cell=gridCell(grid,cells[index]!);
  if(s.enemies.some(e=>e.fromCell===cell||e.toCell===cell))return false;
  const blocked=occupied(grid);blocked.add(cell);
  const route=distances(grid,exit,blocked);
  return route[entry]!>=0&&s.enemies.every(e=>route[e.toCell!]!>=0);
 };
 const create=(cell:number,level:number,nextFire=ctx.tickIndex)=>{const serial=s.nextId++,t={id:'tower_'+serial,cell,level,weaponId:'weapon_'+serial};s.towers.push(t);s.weapons.push({id:t.weaponId,owner:t.id,nextFire});return t;};
 for(const input of ctx.inputs.filter(e=>e.type==='input.action'&&e.edge==='press')){
  const command=(c.actions as JsonRecord[]).find(a=>a.action===input.action);if(!command)continue;const index=Number(command.index),target=s.towers.find(t=>t.cell===index);let valid=false;
  if(command.kind==='place'&&!target&&s.wallet>=Number(c.cost)&&canPlace(index)){s.wallet-=Number(c.cost);const t=create(index,1);emit('defense.placed',{id:t.id,cell:index});valid=true;}
  if(command.kind==='select'&&target){s.selected=index;valid=true;}
  if(command.kind==='upgrade'&&target&&target.level<8&&s.wallet>=Number(c.cost)*target.level){s.wallet-=Number(c.cost)*target.level;target.level++;valid=true;}
  if(command.kind==='merge'&&target){const source=s.towers.find(t=>t.cell===s.selected);if(source&&source.id!==target.id&&source.level===target.level&&target.level<8){
   const retired=[source.id,target.id],oldWeapons=s.weapons.filter(w=>retired.includes(w.owner)),nextFire=Math.max(ctx.tickIndex,...oldWeapons.map(w=>w.nextFire));
   s.towers=s.towers.filter(t=>!retired.includes(t.id));s.weapons=s.weapons.filter(w=>!retired.includes(w.owner));const replacement=create(index,target.level+1,nextFire);s.selected=-1;
   const specialization=command.specialization as Specialization|undefined;
   if(specialization)(replacement as Tower).specialization=specialization;
   emit('defense.merged',{retired,retiredWeapons:oldWeapons.map(w=>w.id),replacement:replacement.id,weapon:replacement.weaponId,...(specialization?{specialization}:{})});valid=true;
  }}
  emit(valid?'defense.changed':'defense.invalid',{action:input.action??'',kind:command.kind!});
 }
 const distance=grid?distances(grid,exit,occupied(grid)):[];
 if(grid){
  if(distance[entry]!<0||s.enemies.some(e=>distance[e.toCell!]!<0))error('Disconnected defense route');
  s.route=[entry];
  for(let cell=entry;cell!==exit;){cell=nextCell(grid,distance,cell);s.route.push(cell);}
 }
 const waves=c.waves as JsonRecord[];
 while(s.waveCursor<waves.length&&Number(waves[s.waveCursor]!.tick)<=ctx.tickIndex){
  const wave=waves[s.waveCursor]!,serial=s.nextId++;
  s.enemies.push({id:'enemy_'+serial,...path[0]!,hp:Number(wave.hp),reward:Number(wave.reward),cursor:1,
   ...(grid?{fromCell:entry,toCell:nextCell(grid,distance,entry)}:{})});
  s.waveCursor++;emit('defense.wave',{index:s.waveCursor});
 }
 const escaped=new Set<string>();
 for(const e of s.enemies){
  let budget=specializations&&ctx.tickIndex<=(e.slowUntil??-1)?specializations.slowSpeed:Number(c.speed);
  while(budget>0&&e.cursor<path.length){
   const p=grid?gridPoint(grid,e.toCell!):path[e.cursor]!;
   const x=Math.sign(p.x-e.x)*Math.min(Math.abs(p.x-e.x),budget);e.x+=x;budget-=Math.abs(x);
   const y=Math.sign(p.y-e.y)*Math.min(Math.abs(p.y-e.y),budget);e.y+=y;budget-=Math.abs(y);
   if(e.x!==p.x||e.y!==p.y)break;
   if(grid&&e.toCell!==exit){e.fromCell=e.toCell!;e.toCell=nextCell(grid,distance,e.fromCell);}
   else e.cursor++;
  }
  if(e.cursor===path.length){escaped.add(e.id);s.lives=Math.max(0,s.lives-1);emit('defense.escaped',{id:e.id});}
 }
 s.enemies=s.enemies.filter(e=>!escaped.has(e.id));
 for(const t of [...s.towers].sort((a,b)=>stableCompare(a.id,b.id))){const w=s.weapons.find(w=>w.id===t.weaponId)!,at=cells[t.cell]!;if(ctx.tickIndex<w.nextFire)continue;
  const range=t.specialization==='range'?specializations!.range:t.specialization==='slow'?specializations!.slowRange:Number(c.range);
  const distance=(e:Enemy)=>Math.abs(e.x-at.x)+Math.abs(e.y-at.y),target=s.enemies.filter(e=>e.hp>0&&distance(e)<=range).sort((a,b)=>distance(a)-distance(b)||stableCompare(a.id,b.id))[0];if(!target)continue;
  if(ammo){if(remaining===0)continue;remaining--;}
  target.hp=Math.max(0,target.hp-Number(c.damage)*2**(t.level-1));w.nextFire=ctx.tickIndex+Number(c.cooldownTicks);s.shots.push({owner:t.id,weapon:w.id,target:target.id,tick:ctx.tickIndex});emit('defense.fired',{owner:t.id,weapon:w.id,target:target.id});
  if(t.specialization==='slow'&&target.hp>0)target.slowUntil=ctx.tickIndex+specializations!.slowTicks;
  if(target.hp===0){s.wallet+=target.reward;s.score++;emit('defense.reward',{id:target.id,amount:target.reward});}
 }
 s.enemies=s.enemies.filter(e=>e.hp>0);s.lost=s.lives===0||ctx.tickIndex>=Number(c.maxTicks);s.won=!s.lost&&s.waveCursor===waves.length&&s.enemies.length===0;
 const visual=(id:string,kind:string,p:Point,value:number)=>({id,kind,...p,vx:0,vy:0,hx:150,hy:150,hp:1,team:kind==='actor'?1:2,value,fixed:true});
 s.bodies=[...s.towers.map(t=>visual(t.id,'actor',cells[t.cell]!,2**t.level)),...s.enemies.map(e=>visual(e.id,'target',e,e.hp))];
 checked(s as unknown as JsonRecord,c,undefined,grid);
 const proposals:NonNullable<ModuleResult['proposals']>=[{kind:'state.set',path:String(c.statePath),value:s as unknown as Json}];
 if(ammo&&inputs&&remaining!==stock){
  const updated=[...inputs];updated[ammo.warehouse]=remaining;
  proposals.push({kind:'state.set',path:ammo.linePath,value:{...line as JsonRecord,inputs:updated}});
 }
 return {proposals,events};
}
export const defenseImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateDefense};
export function validateDefenseDefinition(def:GameDefinition):void {
 const state=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
 const entities=[...def.scenes.flatMap((scene,si)=>scene.entities.map((entity,ei)=>({entity,path:'/scenes/'+si+'/entities/'+ei}))),...Object.entries(def.prototypes??{}).map(([key,entity])=>({entity,path:'/prototypes/'+key.replace(/~/g,'~0').replace(/\//g,'~1')}))];
 for(const {entity,path} of entities)for(const [ci,component] of (entity.components??[]).entries())if(component.capability.id==='a2game.strategy.tower-defense'){
  const grid=checkConfig(component.config,path+'/components/'+ci+'/config');
  const ammo=component.config.ammo as {linePath:string;warehouse:number}|undefined;
  if(ammo){
   const scene=def.scenes.find(scene=>scene.entities.includes(entity));
   const lines=scene?.entities.flatMap(e=>e.components??[]).filter(c=>c.capability.id===productionLineId&&c.config.statePath===ammo.linePath)??[];
   const machines=lines[0]?.config.machines;
   const warehouse=Array.isArray(machines)?machines[ammo.warehouse]:undefined;
   if(lines.length!==1||!isRecord(warehouse)||warehouse.input===undefined||warehouse.output!==undefined)error('Defense ammunition must reference one warehouse in its scene');
  }
  const current=checked(readPointer(state,String(component.config.statePath)),component.config,'/state/'+String(component.config.statePath).slice(1)+'/initial',grid);
  if(grid){
   const cells=component.config.cells as unknown as Point[],path=component.config.path as unknown as Point[];
   const blocked=new Set(current.towers.map(t=>gridCell(grid,cells[t.cell]!)));
   const distance=distances(grid,gridCell(grid,path[1]!),blocked);
   if(distance[gridCell(grid,path[0]!)]!<0||current.enemies.some(e=>blocked.has(e.fromCell!)||distance[e.toCell!]!<0))error('Disconnected initial defense route');
  }
  if((component.config.actions as JsonRecord[]).some(a=>!def.inputs.actions.some(input=>input.id===a.action&&input.valueType==='button')))error('Defense command references an unknown button action');
 }
}
