import {fail} from '../errors.js';
import {clone,isRecord,readPointer,safeInteger} from '../utils.js';
import type {GameDefinition,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
function error(why:string):never{return fail('A2G_E_CAP_CONFIG',why);}
function integer(v:unknown,min:number,max:number):v is number{return safeInteger(v)&&v>=min&&v<=max;}
const inputs=(ctx:ModuleContext)=>ctx.inputs.filter(e=>e.type==='input.action'&&e.edge==='press');
function state(ctx:ModuleContext):JsonRecord {const raw=readPointer(ctx.world.state,String(ctx.config.statePath));if(!isRecord(raw))error('Strategy state must be an object');return clone(raw) as JsonRecord;}
function output(ctx:ModuleContext,s:JsonRecord,events:NonNullable<ModuleResult['events']>):ModuleResult{return {proposals:[{kind:'state.set',path:String(ctx.config.statePath),value:s}],events};}
function numbers(v:unknown,max:number):v is number[]{return Array.isArray(v)&&v.length<=max&&v.every(n=>integer(n,0,1000000));}

interface Plot {item:string;readyAt:number;level:number;}
interface Product {id:string;cost:number;yield:number;reward:number;durationTicks:number;upgradeCost:number;requires?:string;}
function checkEconomy(s:JsonRecord,c:Readonly<JsonRecord>):void{
 if(!integer(s.wallet,0,1000000000)||!integer(s.score,0,1000000000)||!integer(s.moves,0,1000000)||!isRecord(s.inventory)||Object.values(s.inventory).some(n=>!integer(n,0,1000000))||!Array.isArray(s.plots)||s.plots.length>16||!numbers(s.grid,256)||!integer(s.selected,-1,255)||!Array.isArray(s.unlocked)||s.unlocked.some(x=>typeof x!=='string')||typeof s.won!=='boolean'||typeof s.lost!=='boolean')error('Invalid economy state');
 const products=c.products;if(!Array.isArray(products)||products.length>64||!Array.isArray(c.actions)||c.actions.length>64)error('Invalid economy catalog/actions');
 const ids=new Set<string>();for(const product of products){if(!isRecord(product)||typeof product.id!=='string'||ids.has(product.id)||!integer(product.cost,0,1000000)||!integer(product.yield,1,1000)||!integer(product.reward,0,1000000)||!integer(product.durationTicks,1,1000000)||!integer(product.upgradeCost,1,1000000))error('Invalid economy product');ids.add(product.id);}
 for(const plot of s.plots)if(!isRecord(plot)||typeof plot.item!=='string'||plot.item!==''&&!ids.has(plot.item)||!integer(plot.readyAt,-1,1000000000)||!integer(plot.level,0,8))error('Invalid production slot');
 for(const raw of c.actions){if(!isRecord(raw)||typeof raw.action!=='string'||!['plant','collect','buy','upgrade','unlock','place','select','merge'].includes(String(raw.kind)))error('Invalid economy command');if(['plant','collect','upgrade'].includes(String(raw.kind))&&!integer(raw.index,0,s.plots.length-1))error('Unknown production slot');if(['place','select','merge'].includes(String(raw.kind))&&!integer(raw.index,0,s.grid.length-1))error('Unknown placement cell');}
}
export function simulateEconomy(ctx:ModuleContext):ModuleResult{
 const s=state(ctx),c=ctx.config;checkEconomy(s,c);const events:NonNullable<ModuleResult['events']>=[],plots=s.plots as unknown as Plot[],inventory=s.inventory as Record<string,number>,grid=s.grid as number[],unlocked=s.unlocked as string[];
 for(const input of inputs(ctx)){
  const commands=(c.actions as JsonRecord[]).filter(row=>row.action===input.action);for(const command of commands){
   const product=(c.products as unknown as Product[]).find(p=>p.id===command.item),index=Number(command.index),plot=plots[index],cost=Number(command.cost??product?.cost??0);let valid=false;
   switch(command.kind){
    case 'plant':if(product&&plot&&plot.item===''&&Number(s.wallet)>=product.cost&&(!product.requires||unlocked.includes(product.requires))){s.wallet=Number(s.wallet)-product.cost;plot.item=product.id;plot.readyAt=ctx.tickIndex+product.durationTicks;valid=true;}break;
    case 'collect':{const planted=plot&&(c.products as unknown as Product[]).find(p=>p.id===plot.item);if(planted&&ctx.tickIndex>=plot.readyAt){const amount=planted.yield*(plot.level+1);inventory[planted.id]=(inventory[planted.id]??0)+amount;s.wallet=Number(s.wallet)+planted.reward*amount;s.score=Number(s.score)+amount;plot.item='';plot.readyAt=-1;events.push({type:'strategy.collected',payload:{item:planted.id,amount}});valid=true;}break;}
    case 'buy':if(product&&Number(s.wallet)>=cost&&(!product.requires||unlocked.includes(product.requires))){s.wallet=Number(s.wallet)-cost;inventory[product.id]=(inventory[product.id]??0)+product.yield;valid=true;}break;
    case 'upgrade':if(product&&plot&&plot.level<8&&Number(s.wallet)>=product.upgradeCost*(plot.level+1)){s.wallet=Number(s.wallet)-product.upgradeCost*(plot.level+1);plot.level++;valid=true;events.push({type:'strategy.upgraded',payload:{index,level:plot.level}});}break;
    case 'unlock':if(typeof command.item==='string'&&!unlocked.includes(command.item)&&integer(cost,0,1000000)&&Number(s.wallet)>=cost){s.wallet=Number(s.wallet)-cost;unlocked.push(command.item);valid=true;}break;
    case 'place':if(product&&grid[index]===0&&(inventory[product.id]??0)>0){inventory[product.id]!--;grid[index]=product.yield;valid=true;}break;
    case 'select':if(grid[index]!>0){s.selected=index;valid=true;}break;
    case 'merge':{const from=Number(s.selected);if(integer(from,0,grid.length-1)&&from!==index&&grid[from]!>0&&grid[from]===grid[index]){grid[index]=grid[index]!*2;grid[from]=0;s.selected=-1;s.score=Number(s.score)+grid[index]!;valid=true;}break;}
   }
   if(valid){s.moves=Number(s.moves)+1;events.push({type:'strategy.changed',payload:{kind:command.kind!}});}else events.push({type:'strategy.invalid',payload:{action:input.action??''}});
  }
 }
 s.won=c.goalScore!==undefined&&Number(s.score)>=Number(c.goalScore);checkEconomy(s,c);return output(ctx,s,events);
}

/** Stable four-neighbour BFS for bounded placement/path profiles. */
export function findGridPath(width:number,height:number,blocked:readonly number[],from:number,to:number):number[]{
 if(!integer(width,1,32)||!integer(height,1,32)||!integer(from,0,width*height-1)||!integer(to,0,width*height-1)||blocked.some(n=>!integer(n,0,width*height-1)))error('Invalid path grid');
 const walls=new Set(blocked);if(walls.has(from)||walls.has(to))return [];const queue=[from],previous=new Map<number,number>([[from,-1]]);
 for(let i=0;i<queue.length;i++){const cell=queue[i]!;if(cell===to)break;for(const next of [cell%width>0?cell-1:-1,cell%width<width-1?cell+1:-1,cell-width,cell+width])if(next>=0&&next<width*height&&!walls.has(next)&&!previous.has(next)){previous.set(next,cell);queue.push(next);}}
 if(!previous.has(to))return [];const path=[];for(let at=to;at!==-1;at=previous.get(at)!)path.push(at);return path.reverse();
}
function checkPath(s:JsonRecord,c:Readonly<JsonRecord>):void{
 if(!integer(s.x,0,32000)||!integer(s.y,0,32000)||!integer(s.cursor,0,64)||typeof s.arrived!=='boolean'||!Array.isArray(c.waypoints)||c.waypoints.length<1||c.waypoints.length>64||!integer(c.speed,1,128))error('Invalid path-follow state/config');
 for(const point of c.waypoints)if(!isRecord(point)||!integer(point.x,0,32000)||!integer(point.y,0,32000))error('Invalid waypoint');
 if(Number(s.cursor)>c.waypoints.length||s.arrived===true&&Number(s.cursor)<c.waypoints.length)error('Invalid path cursor/arrival');
 if(Boolean(c.worldPath)!==Boolean(c.bodyId))error('World path binding requires worldPath and bodyId');
}
export function simulatePath(ctx:ModuleContext):ModuleResult{
 const s=state(ctx),c=ctx.config;checkPath(s,c);
 if(c.worldPath){const world=readPointer(ctx.world.state,String(c.worldPath));if(isRecord(world)&&Array.isArray(world.bodies)&&!world.bodies.some(b=>isRecord(b)&&b.id===c.bodyId))return {events:[{type:'strategy.detached',payload:{id:String(c.bodyId)}}]};}
 const points=c.waypoints as JsonRecord[],events:NonNullable<ModuleResult['events']>=[];let budget=Number(c.speed);
 while(Number(s.cursor)<points.length&&budget>0){const point=points[Number(s.cursor)]!,dx=Number(point.x)-Number(s.x),dy=Number(point.y)-Number(s.y),xStep=Math.sign(dx)*Math.min(Math.abs(dx),budget);s.x=Number(s.x)+xStep;budget-=Math.abs(xStep);const yStep=Math.sign(dy)*Math.min(Math.abs(dy),budget);s.y=Number(s.y)+yStep;budget-=Math.abs(yStep);if(s.x===point.x&&s.y===point.y)s.cursor=Number(s.cursor)+1;else break;}
 if(Number(s.cursor)>=points.length&&!s.arrived){s.arrived=true;events.push({type:'strategy.arrived',payload:{}});}const result=output(ctx,s,events);
 if(c.worldPath){const world=clone(readPointer(ctx.world.state,String(c.worldPath)));if(!isRecord(world)||!Array.isArray(world.bodies))error('Invalid world path binding');const body=world.bodies.find(b=>isRecord(b)&&b.id===c.bodyId);if(!isRecord(body))error('Path-follow body missing');body.x=s.x;body.y=s.y;result.proposals!.push({kind:'state.set',path:String(c.worldPath),value:world as Json});}
 return result;
}
function checkTurn(s:JsonRecord,c:Readonly<JsonRecord>):void{
 if(!integer(c.width,1,19)||!integer(c.height,1,19)||!integer(c.players,2,4)||!integer(c.winLength,2,19)||!numbers(s.board,361)||s.board.length!==Number(c.width)*Number(c.height)||s.board.some(n=>n>Number(c.players))||!integer(s.player,1,Number(c.players))||!integer(s.moves,0,1000000)||!integer(s.winner,0,Number(c.players))||typeof s.draw!=='boolean'||!Array.isArray(c.selectActions)||c.selectActions.length!==(c.gravityDrop===true?c.width:s.board.length))error('Invalid turn board/config');
 if(c.gravityDrop===true&&(c.endTurnAction!==undefined||new Set(c.selectActions).size!==c.width))error('Gravity drop requires distinct column actions and automatic turns');
 const board=s.board;
 if(c.gravityDrop===true&&board.some((piece,index)=>piece!==0&&board[index+Number(c.width)]===0))error('Gravity board contains an unsupported piece');
}
export function simulateTurn(ctx:ModuleContext):ModuleResult{
 const s=state(ctx),c=ctx.config;checkTurn(s,c);const board=s.board as number[],events:NonNullable<ModuleResult['events']>=[],width=Number(c.width),height=Number(c.height);
 for(const input of inputs(ctx)){
  if(s.winner!==0||s.draw)break;const selection=(c.selectActions as string[]).indexOf(input.action??'');
  if(input.action===c.endTurnAction){s.player=Number(s.player)%Number(c.players)+1;events.push({type:'turn.changed',payload:{player:s.player}});continue;}
  if(selection<0)continue;
  let index=selection;
  if(board[index]!==0){events.push({type:'turn.invalid',payload:{index}});continue;}
  if(c.gravityDrop===true)while(index+width<board.length&&board[index+width]===0)index+=width;
  board[index]=Number(s.player);s.moves=Number(s.moves)+1;
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let count=1;for(const direction of [-1,1]){let x=index%width+dx!*direction,y=Math.floor(index/width)+dy!*direction;while(x>=0&&x<width&&y>=0&&y<height&&board[y*width+x]===s.player){count++;x+=dx!*direction;y+=dy!*direction;}}if(count>=Number(c.winLength))s.winner=s.player;}
  s.draw=s.winner===0&&board.every(n=>n!==0);if(s.winner===0&&!s.draw)s.player=Number(s.player)%Number(c.players)+1;
  events.push({type:'turn.changed',payload:{index,player:s.player,winner:s.winner}});
 }
 checkTurn(s,c);return output(ctx,s,events);
}
function checkCards(s:JsonRecord,c:Readonly<JsonRecord>):void{
 if(!numbers(s.deck,128)||!numbers(s.hand,32)||!numbers(s.discard,128)||s.deck.length+s.hand.length+s.discard.length>128||!integer(c.maxHand,1,32)||s.hand.length>Number(c.maxHand)||!Array.isArray(c.playActions)||c.playActions.length<Number(c.maxHand)||typeof s.initialized!=='boolean'||!integer(s.score,0,1000000000)||typeof s.won!=='boolean')error('Invalid deck/hand state');
}
export function drawCard(deck:number[],hand:number[],maxHand:number):boolean{
 if(hand.length>=maxHand||deck.length===0)return false;
 hand.push(deck.shift()!);
 return true;
}
export function discardCard(hand:number[],discard:number[],index:number):number{
 const card=hand.splice(index,1)[0]!;
 discard.push(card);
 return card;
}
export function simulateCards(ctx:ModuleContext):ModuleResult{
 const s=state(ctx),c=ctx.config;checkCards(s,c);const deck=s.deck as number[],hand=s.hand as number[],discard=s.discard as number[],events:NonNullable<ModuleResult['events']>=[];
 if(!s.initialized){if(c.shuffle===true)for(let i=deck.length-1;i>0;i--){const j=ctx.rng.randomInt(0,i);[deck[i],deck[j]]=[deck[j]!,deck[i]!];}s.initialized=true;}
 for(const input of inputs(ctx)){
  if(input.action===c.drawAction){if(drawCard(deck,hand,Number(c.maxHand)))events.push({type:'cards.drawn',payload:{count:hand.length}});continue;}
  const index=(c.playActions as string[]).indexOf(input.action??'');if(index>=0&&index<hand.length){const card=discardCard(hand,discard,index);s.score=Number(s.score)+card;events.push({type:'cards.played',payload:{card}});}
 }
 s.won=c.goalScore!==undefined&&Number(s.score)>=Number(c.goalScore);checkCards(s,c);return output(ctx,s,events);
}
export const strategyImplementations:Record<string,TrustedCapabilityImplementation>={'a2game.strategy.economy-loop':{role:'module',simulate:simulateEconomy},'a2game.strategy.path-follow':{role:'module',simulate:simulatePath},'a2game.turnbased.turn':{role:'module',simulate:simulateTurn},'a2game.turnbased.cards':{role:'module',simulate:simulateCards}};
export const strategyServiceIds=['economy','inventory','cost','reward','production','collect','upgrade','unlock','shop','placement-grid','path','tower','range'].map(s=>'a2game.strategy.'+s).concat(['legal-move','deck','hand','player-order'].map(s=>'a2game.turnbased.'+s));
export function validateStrategyDefinition(def:GameDefinition):void{
 const initial=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
 for(const entity of [...def.scenes.flatMap(s=>s.entities),...Object.values(def.prototypes??{})])for(const component of entity.components??[]){
  if(!strategyImplementations[component.capability.id])continue;const c=component.config,raw=readPointer(initial,String(c.statePath));if(!isRecord(raw))error('Unknown strategy state path');const s=raw as JsonRecord;
  const check=component.capability.id.endsWith('economy-loop')?checkEconomy:component.capability.id.endsWith('path-follow')?checkPath:component.capability.id.endsWith('.cards')?checkCards:checkTurn;check(s,c);
  if(component.capability.id==='a2game.strategy.path-follow'&&c.worldPath){
   const world=readPointer(initial,String(c.worldPath));if(!isRecord(world)||!Array.isArray(world.bodies)||!world.bodies.some(b=>isRecord(b)&&b.id===c.bodyId))error('Path binding references an unknown body');
  }
  const names=component.capability.id.endsWith('economy-loop')?(c.actions as JsonRecord[]).map(row=>row.action):component.capability.id.endsWith('path-follow')?[]:component.capability.id.endsWith('.cards')?[c.drawAction,...c.playActions as Json[]]:[...c.selectActions as Json[],...(c.endTurnAction?[c.endTurnAction]:[])];
  if(names.some(name=>!def.inputs.actions.some(action=>action.id===name&&(c.gravityDrop!==true||action.valueType==='button'))))error('Unknown strategy action');
 }
}
