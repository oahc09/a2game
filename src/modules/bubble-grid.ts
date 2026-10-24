import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeFinite,safeInteger} from '../utils.js';
import {gridNeighbors,connectedCells} from './puzzle.js';
import {viewportToWorld} from '../geometry.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
function error(why:string):never{return fail('A2G_E_CAP_CONFIG',why);}
function integer(value:unknown,min:number,max:number):value is number{return safeInteger(value)&&value>=min&&value<=max;}
function check(s:JsonRecord,c:Readonly<JsonRecord>):void{
 if(!integer(c.columns,2,16)||!integer(c.rows,2,16)||Number(c.columns)*Number(c.rows)>256||!integer(c.cellSize,64,2000)||!integer(c.worldWidth,256,32000)||!integer(c.worldHeight,256,32000)||!Array.isArray(s.board)||s.board.length!==Number(c.columns)*Number(c.rows)||s.board.some(value=>!integer(value,0,Number(c.colors??3)))||!integer(s.ammo,0,64)||!integer(s.color,1,Number(c.colors??3))||!integer(s.score,0,1000000)||typeof s.won!=='boolean'||typeof s.lost!=='boolean'||!Array.isArray(s.aim)||s.aim.length!==2||!s.aim.every(safeFinite)||!isRecord(s.shot))error('Invalid bubble grid');
 if(typeof s.shot.active!=='boolean'||!integer(s.shot.x,0,Number(c.worldWidth))||!integer(s.shot.y,0,Number(c.worldHeight))||!integer(s.shot.vx,-128,128)||!integer(s.shot.vy,-128,128))error('Invalid bubble projectile');
 if((s.aim as number[]).some(value=>Math.abs(value)>1)||Number((s.aim as number[])[1])<=0||s.shot.active&&Number(s.shot.vy)<=0)error('Bubble aim must point upward within the normalized range');
 const radius=Number(c.radius??160),half=Number(c.cellSize)/2;if(Number(c.originX)<half||Number(c.originX)+(Number(c.columns)-1)*Number(c.cellSize)+half>Number(c.worldWidth)||Number(c.topY)+half>Number(c.worldHeight)||Number(c.topY)-(Number(c.rows)-1)*Number(c.cellSize)-half<0||Number(c.launchX)<radius||Number(c.launchX)>Number(c.worldWidth)-radius||Number(c.launchY)<radius||Number(c.launchY)>Number(c.worldHeight)-radius)error('Bubble geometry exceeds world bounds');
}
export function simulateBubbleGrid(ctx:ModuleContext):ModuleResult{
 const c=ctx.config,raw=readPointer(ctx.world.state,String(c.statePath));if(!isRecord(raw))error('Missing bubble state');const s=clone(raw) as JsonRecord;check(s,c);
 const board=s.board as number[],shot=s.shot as JsonRecord,width=Number(c.columns),height=Number(c.rows),cell=Number(c.cellSize),radius=Number(c.radius??160),events:NonNullable<ModuleResult['events']>=[];
 const position=(index:number)=>[Number(c.originX)+(index%width)*cell,Number(c.topY)-Math.floor(index/width)*cell];
 for(const event of ctx.inputs){if(event.type!=='input.action'||event.edge!=='press')continue;
  if(event.action===c.aimAction&&Array.isArray(event.payload.value)&&event.payload.value.length===2&&event.payload.value.every(safeFinite)){
   const frameWidth=Number(c.sceneWidth??Number(c.worldWidth)/1000),frameHeight=Number(c.sceneHeight??Number(c.worldHeight)/1000),point=viewportToWorld(Number(event.payload.value[0]),Number(event.payload.value[1]),Number(event.payload.viewportAspect??frameWidth/frameHeight),frameWidth,frameHeight,[-Number(c.worldWidth)/2000,-Number(c.worldHeight)/2000]);
   const dx=point[0]-Number(c.launchX),dy=point[1]-Number(c.launchY),den=Math.abs(dx)+Math.abs(dy);if(dy>0&&den>0)s.aim=[Math.round(dx/den*10000)/10000,Math.round(dy/den*10000)/10000];
  }
  if(event.action===c.fireAction){if(shot.active||Number(s.ammo)<=0||s.won||s.lost){events.push({type:'bubble.invalid',payload:{reason:'not-ready'}});continue;}
   const aim=s.aim as number[];shot.active=true;shot.x=c.launchX!;shot.y=c.launchY!;shot.vx=Math.trunc(aim[0]!*Number(c.shotSpeed??128));shot.vy=Math.max(1,Math.trunc(aim[1]!*Number(c.shotSpeed??128)));s.ammo=Number(s.ammo)-1;events.push({type:'bubble.fired',payload:{color:s.color!}});
  }
 }
 if(shot.active){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(Number(shot.vx)),Math.abs(Number(shot.vy)))/16));
  for(let step=0;step<steps&&shot.active;step++){
   shot.x=Number(shot.x)+Math.trunc(Number(shot.vx)*(step+1)/steps)-Math.trunc(Number(shot.vx)*step/steps);shot.y=Number(shot.y)+Math.trunc(Number(shot.vy)*(step+1)/steps)-Math.trunc(Number(shot.vy)*step/steps);
   if(Number(shot.x)<radius||Number(shot.x)>Number(c.worldWidth)-radius){shot.x=Math.max(radius,Math.min(Number(c.worldWidth)-radius,Number(shot.x)));shot.vx=-Number(shot.vx);}
   const hit=board.findIndex((value,index)=>{if(!value)return false;const [x,y]=position(index);return Math.abs(x!-Number(shot.x))<=cell/2+radius&&Math.abs(y!-Number(shot.y))<=cell/2+radius;});
   if(hit>=0||Number(shot.y)>=Number(c.topY)){
    const choices=(hit>=0?gridNeighbors(hit,width,height):Array.from({length:width},(_,i)=>i)).filter(index=>board[index]===0).sort((a,b)=>{const [ax,ay]=position(a),[bx,by]=position(b);return (ax!-Number(shot.x))**2+(ay!-Number(shot.y))**2-((bx!-Number(shot.x))**2+(by!-Number(shot.y))**2)||a-b;});
    const snapped=choices[0];shot.active=false;
    if(snapped===undefined){s.lost=true;break;}board[snapped]=Number(s.color);events.push({type:'bubble.snapped',payload:{index:snapped}});
    const match=connectedCells(board,snapped,width,height);if(match.length>=Number(c.matchLength??3)){
     for(const index of match)board[index]=0;let removed=match.length;const supported=new Set<number>(),queue=Array.from({length:width},(_,i)=>i).filter(index=>board[index]!>0);queue.forEach(index=>supported.add(index));
     for(let i=0;i<queue.length;i++)for(const next of gridNeighbors(queue[i]!,width,height))if(board[next]!>0&&!supported.has(next)){supported.add(next);queue.push(next);}
     for(let i=0;i<board.length;i++)if(board[i]!>0&&!supported.has(i)){board[i]=0;removed++;}s.score=Number(s.score)+removed;events.push({type:'bubble.cleared',payload:{removed}});
    }
    s.won=Number(s.score)>=Number(c.goalScore??1);s.lost=!s.won&&(Number(s.ammo)===0||board.slice((height-1)*width).some(value=>value>0));if(Number(s.ammo)>0)s.color=ctx.rng.randomInt(1,Number(c.colors??3));
   }
  }
 }
 const visuals:Json[]=[];for(const [index,value] of board.entries())if(value){const [x,y]=position(index);visuals.push({id:'bubble_'+index,kind:'target',x:x!,y:y!,hx:cell*0.44,hy:cell*0.44,value});}
 if(shot.active)visuals.push({id:'projectile',kind:'projectile',x:shot.x!,y:shot.y!,hx:radius,hy:radius,value:s.color!});visuals.push({id:'launcher',kind:'actor',x:c.launchX!,y:c.launchY!,hx:radius,hy:radius,value:s.color!});s.visuals=visuals;check(s,c);
 return {proposals:[{kind:'state.set',path:String(c.statePath),value:s}],events};
}
export const bubbleGridImplementation:TrustedCapabilityImplementation={role:'module',simulate:simulateBubbleGrid};
export function validateBubbleDefinition(def:GameDefinition):void{
 const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));for(const entity of [...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[])if(component.capability.id==='a2game.combat.bubble-grid'){
  const s=readPointer(initial,String(component.config.statePath));if(!isRecord(s))error('Missing initial bubble state');check(s as JsonRecord,component.config);for(const key of ['fireAction','aimAction'])if(component.config[key]&&!def.inputs.actions.some(action=>action.id===component.config[key]))error('Unknown bubble action');
 }
}
