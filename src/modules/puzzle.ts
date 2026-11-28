import {fail} from '../errors.js';
import type {DiagnosticInfo} from '../errors.js';
import {isRecord,readPointer,safeFinite,safeInteger,equals} from '../utils.js';
import {viewportToWorld} from '../geometry.js';
import {collectibleFace,colorClearFace,dropSpecialColumn,dropSpecialPath,planSpecialCombo,planSpecials,resolveSpecialHits,specialRuns} from './match-specials.js';
import type {SpecialKind} from './match-specials.js';
import {gridPushImplementation} from './grid-push.js';
import {gridSlideMergeImplementation} from './grid-slide-merge.js';
import type {GameDefinition,GameEntity,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
import type {CapabilityRegistry} from '../registry.js';

export type PuzzleMode='match'|'tray'|'pair'|'arrows'|'placement'|'falling'|'sort'|'connected';
interface Checkpoint {data:JsonRecord;rng:number[];}
interface PuzzleState {board:number[];display:number[];preview:number[];selected:number[];removed:number[];tray:number[];tubes:number[][];score:number;moves:number;won:boolean;lost:boolean;history:Checkpoint[];closeAt:number;active:number;anchor:number;rotation:number;tilePress?:[number,number,number];trayTools?:TrayLedger;goalRemaining?:number[];movesRemaining?:number;specials?:SpecialKind[];pieceIds?:number[];nextPieceId?:number;ice?:number[];boxes?:number[];obstacleRemaining?:number[];collectionRemaining?:number;}
interface ColorGoal {color:number;count:number;}
interface ObstacleGoals {ice:number;boxes:number;}
interface OutletLayout {paths:number[][];outlets:number[];targetCount:number;}
const matchToolNames=['hammer','forceSwap','shuffle'] as const;
type MatchTool=typeof matchToolNames[number];
interface MatchTools {hammer:string;forceSwap:string;shuffle:string;cancel:string;}
interface PuzzleState {toolMode?:''|'hammer'|'forceSwap';toolRemaining?:Record<MatchTool,number>;settleUntilTick?:number;}
interface TilePointer {action:string;centers:[number,number][];size:[number,number];scene:[number,number];}
interface TrayToolActions {moveOutAction:string;returnActions:string[];shuffleAction?:string;}
interface TrayLedger {
  faces:number[];trayIds:number[];reserveIds:number[];reserveFaces:number[];clearedIds:number[];
  moveOutRemaining:number;undoRemaining:number;
  shuffleRemaining?:number;
}
/** Construct a legal order by filling existing partial groups before starting new ones. */
export function buildTrayShuffle(board:readonly number[],tray:readonly number[],reserve:readonly number[],blockers:readonly number[][],capacity:number,rng:ModuleContext['rng']){
  const counts=new Map<number,number>(),pending=new Map<number,number>(),held=[...reserve],faces:number[]=[];
  let occupancy=tray.length;
  for(const face of board)if(face)counts.set(face,(counts.get(face)??0)+1);
  for(const face of tray)pending.set(face,(pending.get(face)??0)+1);
  const route:{board?:number;reserve?:number}[]=[];
  const add=(face:number):boolean=>{
    const at=held.indexOf(face);
    if(at>=0){held.splice(at,1);route.push({reserve:at});}
    else{
      const left=counts.get(face)??0;if(!left)return false;
      counts.set(face,left-1);faces.push(face);route.push({board:faces.length-1});
    }
    const count=(pending.get(face)??0)+1;
    occupancy++;
    if(count===3){pending.delete(face);occupancy-=3;}else pending.set(face,count);
    return occupancy<capacity;
  };
  for(const [face,count] of [...pending].sort((a,b)=>b[1]-a[1]))for(let i=count;i<3;i++)if(!add(face))return null;
  const remainder=new Set([...counts.keys(),...held]);
  for(const face of remainder){
    const total=(counts.get(face)??0)+held.filter(value=>value===face).length;
    if(total%3!==0)return null;
    for(let i=0;i<total;i++)if(!add(face))return null;
  }
  const live=new Set(board.flatMap((value,index)=>value?[index]:[])),order:number[]=[],result=[...board];
  for(const face of faces){
    const free=[...live].filter(id=>!blockers[id]!.some(other=>live.has(other)));
    if(!free.length)return null;
    const id=free[rng.randomInt(0,free.length-1)]!;live.delete(id);order.push(id);result[id]=face;
  }
  if(live.size)return null;
  return {board:result,route:route.map(move=>move.board===undefined?move:{board:order[move.board]!})};
}
const modes:Record<string,PuzzleMode>={'a2game.puzzle.swap':'match','a2game.puzzle.tray':'tray','a2game.puzzle.pair-match':'pair','a2game.puzzle.direction':'arrows','a2game.puzzle.placement':'placement','a2game.puzzle.falling-piece':'falling','a2game.puzzle.sort':'sort','a2game.puzzle.connected-match':'connected'};
function error(message:string):never{return fail('A2G_E_CAP_CONFIG',message);}
const clone=<T>(value:T):T=>structuredClone(value);
export function gridNeighbors(index:number,width:number,height:number):number[]{return [-1,1,-width,width].map(delta=>index+delta).filter((next,i)=>next>=0&&next<width*height&&(i>1||Math.floor(next/width)===Math.floor(index/width)));}
export function findMatches(board:number[],width:number,height:number,length=3):number[]{
  const found=new Set<number>();for(let axis=0;axis<2;axis++)for(let line=0;line<(axis?width:height);line++){
    const cells=Array.from({length:axis?height:width},(_,i)=>axis?i*width+line:line*width+i);let start=0;
    while(start<cells.length){let end=start+1;while(end<cells.length&&board[cells[end]!]===board[cells[start]!])end++;if(board[cells[start]!]!>0&&end-start>=length)for(let i=start;i<end;i++)found.add(cells[i]!);start=end;}
  }return [...found].sort((a,b)=>a-b);
}
function hasLegalSwap(board:number[],width:number,height:number,length:number,specials?:SpecialKind[]):boolean{
  const line=(cell:number,dx:number,dy:number):boolean=>{
    const face=board[cell]!;
    if(specials&&face>=colorClearFace)return false;
    let run=1;
    for(const direction of [-1,1]){
      let x=cell%width+dx*direction,y=Math.floor(cell/width)+dy*direction;
      for(;x>=0&&x<width&&y>=0&&y<height&&board[y*width+x]===face;x+=dx*direction,y+=dy*direction)run++;
    }
    return run>=length;
  };
  for(let cell=0;cell<board.length;cell++){
    if(!board[cell])continue;
    for(const next of gridNeighbors(cell,width,height)){
      if(next<=cell||!board[next])continue;
      if(specials&&(
        specials[cell]!=='none'&&specials[next]!=='none'||
        specials[cell]==='color'&&board[next]!<colorClearFace||
        specials[next]==='color'&&board[cell]!<colorClearFace))return true;
      if(board[cell]===board[next])continue;
      [board[cell],board[next]]=[board[next]!,board[cell]!];
      const match=line(cell,1,0)||line(cell,0,1)||line(next,1,0)||line(next,0,1);
      [board[cell],board[next]]=[board[next]!,board[cell]!];
      if(match)return true;
    }
  }
  return false;
}
export function connectedCells(board:number[],start:number,width:number,height:number):number[]{
  if(!board[start])return [];const found=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++)for(const next of gridNeighbors(queue[i]!,width,height))if(!found.has(next)&&board[next]===board[start]){found.add(next);queue.push(next);}return [...found].sort((a,b)=>a-b);
}
export function rotatePolyomino(piece:number[][],turns:number):number[][]{
  let result=piece.map(cell=>[cell[0]!,cell[1]!]);for(let i=0;i<((turns%4)+4)%4;i++)result=result.map(([x,y])=>[-y!,x!]);
  const x=Math.min(...result.map(cell=>cell[0]!)),y=Math.min(...result.map(cell=>cell[1]!));return result.map(cell=>[cell[0]!-x,cell[1]!-y]);
}
export function clearLines(board:number[],width:number,height:number,gravity=false):{board:number[];lines:number}{
  const rows=Array.from({length:height},(_,y)=>y).filter(y=>board.slice(y*width,(y+1)*width).every(Boolean));
  const columns=gravity?[]:Array.from({length:width},(_,x)=>x).filter(x=>Array.from({length:height},(_,y)=>board[y*width+x]).every(Boolean));
  if(gravity){const kept=Array.from({length:height},(_,y)=>board.slice(y*width,(y+1)*width)).filter((_,y)=>!rows.includes(y));return {board:[...Array(rows.length*width).fill(0),...kept.flat()],lines:rows.length};}
  return {board:board.map((value,index)=>rows.includes(Math.floor(index/width))||columns.includes(index%width)?0:value),lines:rows.length+columns.length};
}
function normalize(raw:unknown,cfg:JsonRecord,mode:PuzzleMode,diagnostic:DiagnosticInfo={}):PuzzleState{
  if(!isRecord(raw))error('Puzzle state must be an object');const p=clone(raw) as unknown as PuzzleState;
  p.board??=[];p.display??=[];p.preview??=[];p.selected??=[];p.removed??=[];p.tray??=[];p.tubes??=[];p.score??=0;p.moves??=0;p.won??=false;p.lost??=false;p.history??=[];p.closeAt??=-1;p.active??=0;p.anchor??=Math.floor(Number(cfg.width)/2);p.rotation??=0;
  const array=(v:unknown,max=256)=>Array.isArray(v)&&v.length<=max&&v.every(n=>safeInteger(n)&&n>=0&&n<=1000000);
  const cells=Number(cfg.width)*Number(cfg.height);
  const stateError=(field:string,ruleId:string,expected:unknown):never=>fail('A2G_E_CAP_CONFIG','Invalid puzzle state',{...diagnostic,...(diagnostic.jsonPointer?{jsonPointer:diagnostic.jsonPointer+'/'+field}:{}),ruleId,expected});
  if(!array(p.board)||(mode!=='sort'&&p.board.length!==cells))stateError('board','puzzle.board-dimensions',mode==='sort'?'array':cells);
  if(!array(p.selected,2))stateError('selected','puzzle.selected-array','array');
  if(!array(p.removed)||!array(p.tray,32)||!Array.isArray(p.tubes)||p.tubes.length>16||!p.tubes.every(tube=>array(tube,32))||
    !safeInteger(p.score)||p.score<0||!safeInteger(p.moves)||p.moves<0||typeof p.won!=='boolean'||typeof p.lost!=='boolean'||!Array.isArray(p.history)||p.history.length>16||!safeInteger(p.closeAt)||!safeInteger(p.active)||p.active<0||!safeInteger(p.anchor)||p.anchor<0||!safeInteger(p.rotation)||p.rotation<0||p.rotation>3)error('Invalid puzzle state');
  if(mode==='sort'&&(p.tubes.length!==Number(cfg.width)||p.tubes.some(tube=>tube.length>Number(cfg.capacity??cfg.height))))error('Invalid tube layout');
  if(p.selected.some(index=>index>=cells)||new Set(p.selected).size!==p.selected.length||p.removed.some(index=>index>=cells)||new Set(p.removed).size!==p.removed.length||p.tray.some(value=>value===0)||p.tubes.some(tube=>tube.some(value=>value===0)))error('Invalid puzzle selection or tile values');
  if(cfg.colorGoals!==undefined){
    const goals=cfg.colorGoals as unknown as ColorGoal[];
    if(!Array.isArray(p.goalRemaining)||p.goalRemaining.length!==goals.length||p.goalRemaining.some((n,i)=>!safeInteger(n)||n<0||n>goals[i]!.count)||
      !safeInteger(p.movesRemaining)||p.movesRemaining!==Number(cfg.moveLimit)-p.moves||p.movesRemaining<0)error('Invalid swap goal counters');
  }
  if(cfg.specialBlocks===true){
    const occupied=Array.isArray(p.pieceIds)?p.pieceIds.filter((_,i)=>p.board[i]):[];
    if(!Array.isArray(p.specials)||p.specials.length!==cells||!p.specials.every((kind,i)=>['none','row','column','burst','color'].includes(kind)&&
      (kind==='color')===(p.board[i]===colorClearFace)&&(p.board[i]!==0||kind==='none'))||!Array.isArray(p.pieceIds)||p.pieceIds.length!==cells||
      !safeInteger(p.nextPieceId)||p.nextPieceId<cells||new Set(occupied).size!==occupied.length||
      p.pieceIds.some((id,i)=>p.board[i]?(!safeInteger(id)||id<0||id>=p.nextPieceId!):id!==-1))error('Invalid match special state');
  }
  if(cfg.obstacleGoals!==undefined){
    const goals=cfg.obstacleGoals as unknown as ObstacleGoals;
    const layers=(value:unknown):value is number[]=>Array.isArray(value)&&value.length===cells&&value.every(n=>safeInteger(n)&&n>=0&&n<=3);
    if(!layers(p.ice)||!layers(p.boxes)||p.boxes.some((n,i)=>n>0&&(p.board[i]!==0||p.ice![i]!==0))||
      !array(p.obstacleRemaining,2)||p.obstacleRemaining!.length!==2||p.obstacleRemaining![0]!>goals.ice||p.obstacleRemaining![1]!>goals.boxes)error('Invalid match obstacle state');
  }
  if(cfg.outletLayout!==undefined){
    const layout=cfg.outletLayout as unknown as OutletLayout,active=new Set(layout.paths.flat());
    if(!safeInteger(p.collectionRemaining)||p.collectionRemaining<0||p.collectionRemaining>layout.targetCount||
      p.board.some((face,i)=>!active.has(i)&&(face!==0||Boolean(p.ice?.[i])||Boolean(p.boxes?.[i])))||
      p.board.some((face,i)=>face===collectibleFace&&p.specials![i]!=='none'))error('Invalid match outlet state');
  }
  if(cfg.matchTools!==undefined){
    const stock=p.toolRemaining;
    if(!stock||Object.keys(stock).length!==3||matchToolNames.some(tool=>!safeInteger(stock[tool])||stock[tool]<0||stock[tool]>8)||
       !['','hammer','forceSwap'].includes(p.toolMode??'')||p.toolMode&&!stock[p.toolMode])error('Invalid match tool state');
  }
  if(cfg.settleTicksPerWave!==undefined){
    p.settleUntilTick??=0;
    if(!safeInteger(p.settleUntilTick)||p.settleUntilTick<0)error('Invalid match settlement deadline');
  }
  if(cfg.trayTools!==undefined){
    const ledger=p.trayTools;
    const count=Number(cfg.width)*Number(cfg.height);
    if(!ledger||!array(ledger.faces)||ledger.faces.length!==count||ledger.faces.some(face=>face===0)||
      !array(ledger.trayIds,32)||!array(ledger.reserveIds,3)||!array(ledger.reserveFaces,3)||!array(ledger.clearedIds)||
      ![0,1].includes(ledger.moveOutRemaining)||![0,1].includes(ledger.undoRemaining)||
      (isRecord(cfg.trayTools)&&cfg.trayTools.shuffleAction!==undefined&&ledger.shuffleRemaining!==0&&ledger.shuffleRemaining!==1))error('Invalid tray ledger');
    const live=p.board.flatMap((face,id)=>face?[id]:[]),ids=[...live,...ledger.trayIds,...ledger.reserveIds,...ledger.clearedIds];
    if(ids.length!==count||new Set(ids).size!==count||ids.some(id=>id>=count)||p.score!==ledger.clearedIds.length||
      live.some(id=>p.board[id]!==ledger.faces[id])||!equals(p.tray,ledger.trayIds.map(id=>ledger.faces[id]!))||
      !equals(ledger.reserveFaces,ledger.reserveIds.map(id=>ledger.faces[id]!)))error('Tray ledger does not conserve card identities');
  }
  if(cfg.colorGoals!==undefined||cfg.moveLimit!==undefined){
    const goals=cfg.colorGoals,limit=cfg.moveLimit;
    if(mode!=='match'||cfg.targetScore!==undefined||cfg.undoAction!==undefined||!safeInteger(limit)||limit<1||limit>200||
      !Array.isArray(goals)||goals.length<1||goals.length>8||goals.some(goal=>!isRecord(goal)||!safeInteger(goal.color)||goal.color<1||goal.color>12||!safeInteger(goal.count)||goal.count<1||goal.count>256)||
      new Set(goals.map(goal=>(goal as JsonRecord).color)).size!==goals.length)error('Invalid limited-move color goals');
  }
  if(cfg.specialBlocks!==undefined&&(typeof cfg.specialBlocks!=='boolean'||mode!=='match'||cfg.colorGoals===undefined||
    Number(cfg.matchLength??3)!==3))error('Special blocks require limited-move color goals and match length three');
  if(cfg.obstacleGoals!==undefined){
    if(!isRecord(cfg.obstacleGoals)||cfg.specialBlocks!==true||
      ![cfg.obstacleGoals.ice,cfg.obstacleGoals.boxes].every(n=>safeInteger(n)&&n>=0&&n<=768))error('Invalid obstacle goal configuration');
  }
  return p;
}
function validateConfig(cfg:JsonRecord,mode:PuzzleMode):void{
  if(typeof cfg.statePath!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(cfg.statePath)||!safeInteger(cfg.width)||cfg.width<1||cfg.width>16||!safeInteger(cfg.height)||cfg.height<1||cfg.height>16)error('Invalid puzzle dimensions/state path');
  const count=Number(cfg.width)*Number(cfg.height),actions=cfg.selectActions;
  if(cfg.deadboardShuffle!==undefined&&(typeof cfg.deadboardShuffle!=='boolean'||mode!=='match'||cfg.colorGoals===undefined))
    error('Deadboard shuffle requires limited-move swap rules');
  if(cfg.settleTicksPerWave!==undefined&&(
     mode!=='match'||cfg.colorGoals===undefined||!safeInteger(cfg.settleTicksPerWave)||cfg.settleTicksPerWave<1||cfg.settleTicksPerWave>24))
    error('Match settlement requires 1–24 ticks per wave and limited moves');
  if(cfg.matchTools!==undefined){
    const tools=cfg.matchTools;
    if(mode!=='match'||cfg.specialBlocks!==true||!isRecord(tools)||Object.keys(tools).length!==4||
       [...matchToolNames,'cancel'].some(tool=>typeof tools[tool]!=='string'||!tools[tool]||(Array.isArray(actions)&&actions.includes(tools[tool])))||
       new Set(Object.values(tools)).size!==4)error('Invalid match tool actions');
  }
  if(!Array.isArray(actions)||actions.length!==(mode==='sort'?cfg.width:mode==='falling'||cfg.tilePointer!==undefined?0:count)||actions.some(name=>typeof name!=='string'||!name)||new Set(actions).size!==actions.length)error('One distinct action per selectable cell/container required');
  if(cfg.outletLayout!==undefined){
    const layout=cfg.outletLayout,width=Number(cfg.width);
    if(!isRecord(layout)||cfg.specialBlocks!==true||!Array.isArray(layout.paths)||!layout.paths.length||layout.paths.length>256||
      layout.paths.some(path=>!Array.isArray(path)||!path.length||path.some((id,i)=>!safeInteger(id)||id<0||id>=count||i>0&&id!==Number(path[i-1])+width))||
      !Array.isArray(layout.outlets)||!layout.outlets.length||layout.outlets.some(id=>!safeInteger(id)||
        !(layout.paths as number[][]).some(path=>path.at(-1)===id))||new Set(layout.outlets).size!==layout.outlets.length||
      new Set(layout.paths.flat()).size!==layout.paths.flat().length||!safeInteger(layout.targetCount)||layout.targetCount<1||layout.targetCount>count)error('Invalid match outlet paths');
  }
  if(cfg.tilePointer!==undefined){
    const t=cfg.tilePointer;
    const pair=(value:unknown)=>Array.isArray(value)&&value.length===2&&value.every(safeFinite);
    if(mode!=='tray'||!isRecord(t)||typeof t.action!=='string'||!pair(t.size)||!pair(t.scene)||!Array.isArray(t.centers)||t.centers.length!==count||
      !(t.size as number[]).every(x=>x>0&&x<=32)||!(t.scene as number[]).every(x=>x>0&&x<=128)||t.centers.some(x=>!pair(x))||!Array.isArray(cfg.blockers))error('Invalid tray pointer layout');
  }
  if(cfg.trayTools!==undefined){
    const tools=cfg.trayTools;
    if(mode!=='tray'||cfg.tilePointer===undefined||!isRecord(tools)||typeof tools.moveOutAction!=='string'||
      typeof cfg.undoAction!=='string'||!Array.isArray(tools.returnActions)||tools.returnActions.length!==3||
      tools.returnActions.some(action=>typeof action!=='string'||!action)||
      new Set([tools.moveOutAction,cfg.undoAction,...tools.returnActions,(cfg.tilePointer as JsonRecord).action]).size!==6||
      (tools.shuffleAction!==undefined&&(typeof tools.shuffleAction!=='string'||!tools.shuffleAction||
        [tools.moveOutAction,cfg.undoAction,...tools.returnActions,(cfg.tilePointer as JsonRecord).action].includes(tools.shuffleAction)||cfg.matchLength!==3)))error('Invalid tray tool actions');
  }
  if(cfg.matchLength!==undefined&&(!safeInteger(cfg.matchLength)||cfg.matchLength<2||cfg.matchLength>8))error('Match length must be 2..8');
  if(cfg.capacity!==undefined&&(!safeInteger(cfg.capacity)||cfg.capacity<1||cfg.capacity>32))error('Capacity must be 1..32');
  if(cfg.closeTicks!==undefined&&(!safeInteger(cfg.closeTicks)||cfg.closeTicks<1||cfg.closeTicks>600))error('closeTicks must be 1..600');
  if(cfg.fallTicks!==undefined&&(!safeInteger(cfg.fallTicks)||cfg.fallTicks<1||cfg.fallTicks>600))error('fallTicks must be 1..600');
  if(cfg.variant!==undefined&&!['memory','mahjong'].includes(String(cfg.variant)))error('Invalid pair variant');
  if(mode==='arrows'&&(!Array.isArray(cfg.directions)||cfg.directions.length!==count||cfg.directions.some(d=>!['left','right','up','down'].includes(String(d)))))error('Arrow directions required');
  if(cfg.targets!==undefined&&(!Array.isArray(cfg.targets)||cfg.targets.length!==count||cfg.targets.some(x=>!safeInteger(x)||x<0)))error('Placement target grid required');
  if(cfg.pieces!==undefined&&(!Array.isArray(cfg.pieces)||!cfg.pieces.length||cfg.pieces.length>16||cfg.pieces.some(piece=>!Array.isArray(piece)||!piece.length||piece.length>16||piece.some(cell=>!Array.isArray(cell)||cell.length!==2||cell.some(n=>!safeInteger(n)||n<0||n>3))||new Set(piece.map(cell=>JSON.stringify(cell))).size!==piece.length)))error('Pieces must contain unique cells in a 4x4 grid');
  if(mode==='falling'&&!cfg.pieces)error('Falling pieces require a piece sequence');
  if(mode==='placement'&&Boolean(cfg.pieces)===Boolean(cfg.targets))error('Placement requires exactly one of pieces or targets');
  if(cfg.blockers!==undefined){
    if(!Array.isArray(cfg.blockers)||cfg.blockers.length!==count||cfg.blockers.some(row=>!Array.isArray(row)||row.some(n=>!safeInteger(n)||n<0||n>=count)))error('Invalid layer/occlusion graph');
    const graph=cfg.blockers as number[][],seen=new Set<number>(),stack=new Set<number>();
    const visit=(index:number):void=>{
      if(stack.has(index)){
        const path=[...stack],cycle=[...path.slice(path.indexOf(index)),index];
        error(`Cyclic occlusion graph at blockers[${index}]: ${cycle.join(' -> ')}`);
      }
      if(seen.has(index))return;
      stack.add(index);
      for(const next of graph[index]!)visit(next);
      stack.delete(index);seen.add(index);
    };
    for(let i=0;i<count;i++)visit(i);
  }
}
function freeCell(p:PuzzleState,cfg:JsonRecord,index:number,mahjong=false):boolean{
  if(!p.board[index])return false;const blockers=(cfg.blockers as number[][]|undefined)?.[index]??[];
  if(blockers.some(cell=>p.board[cell]!>0))return false;if(!mahjong)return true;
  const width=Number(cfg.width);return index%width===0||index%width===width-1||!p.board[index-1]||!p.board[index+1];
}
function frame(p:PuzzleState,cfg:JsonRecord,mode:PuzzleMode):void{
  p.preview=Array.isArray(cfg.pieces)&&p.active<cfg.pieces.length?rotatePolyomino(cfg.pieces[p.active] as number[][],p.rotation).map(([x,y])=>y!*4+x!):[];
  if(mode==='sort'){const width=Number(cfg.width),height=Number(cfg.height);p.display=Array.from({length:width*height},(_,index)=>p.tubes[index%width]?.[height-1-Math.floor(index/width)]??0);return;}
  p.display=p.board.map((value,index)=>mode==='pair'&&cfg.variant!=='mahjong'&&!p.removed.includes(index)&&!p.selected.includes(index)?0:value||-1);
  if(cfg.specialBlocks===true){const faces={none:0,row:14,column:15,burst:16,color:17};p.display=p.board.map((value,i)=>p.boxes?.[i]?19+p.boxes[i]!:value===collectibleFace?24:faces[p.specials![i]!]||value||-1);}
  if(mode==='tray'||(mode==='pair'&&cfg.variant==='mahjong'))p.display=p.board.map((value,index)=>value&&!freeCell(p,cfg,index,cfg.variant==='mahjong')?0:value||-1);
  if(mode==='falling'&&!p.lost&&Array.isArray(cfg.pieces)&&p.active<cfg.pieces.length){const piece=rotatePolyomino(cfg.pieces[p.active] as number[][],p.rotation),width=Number(cfg.width);for(const [x,y] of piece){const col=p.anchor%width+x!,row=Math.floor(p.anchor/width)+y!;if(col>=0&&col<width&&row>=0&&row<Number(cfg.height))p.display[row*width+col]=7;}}
}
export function simulatePuzzle(ctx:ModuleContext,mode:PuzzleMode):ModuleResult{
  const cfg=ctx.config;validateConfig(cfg,mode);const raw=readPointer(ctx.world.state,String(cfg.statePath));let p=normalize(raw,cfg,mode);const original=clone(raw);
  const width=Number(cfg.width),height=Number(cfg.height),length=Number(cfg.matchLength??3),events:NonNullable<ModuleResult['events']>=[];
  const tools=cfg.trayTools as unknown as TrayToolActions|undefined;
  const colorGoals=cfg.colorGoals as unknown as ColorGoal[]|undefined;
  const outletLayout=cfg.outletLayout as unknown as OutletLayout|undefined;
  const matchTools=cfg.matchTools as unknown as MatchTools|undefined;
  const checkpoint=()=>{if(tools&&p.trayTools!.undoRemaining===0)return;const data=clone(p);data.history=[];delete data.tilePress;delete data.settleUntilTick;if(mode!=='pair'||cfg.variant==='mahjong')data.selected=[];if(tools)p.history=[];p.history.push({data:data as unknown as JsonRecord,rng:ctx.rng.state()});if(p.history.length>16)p.history.shift();};
  let undid=false;
  const invalid=(reason:string)=>events.push({type:'puzzle.invalid',payload:{reason}});
  const settleTicks=Number(cfg.settleTicksPerWave??0);
  const matchActions=new Set(settleTicks?[...(cfg.selectActions as string[]),...Object.values(matchTools??{})]:[]);
  let busyReported=false;
  const transaction=(entry?:JsonRecord):JsonRecord=>cfg.journalActions===true&&entry?{transaction:entry}:{};
  const changed=(entry?:JsonRecord)=>events.push({type:'puzzle.changed',payload:{mode,moves:p.moves,score:p.score,...transaction(entry)}});
  const shuffleMatch=(manual=false):number=>{
    // Keep cargo and blocked cells fixed. Colored pieces carry their types and IDs.
    const cells=p.board.flatMap((face,index)=>face&&face!==collectibleFace?[index]:[]);
    const board=[...p.board],specials=p.specials&&[...p.specials],ids=p.pieceIds&&[...p.pieceIds];
    for(let attempt=1;attempt<=64;attempt++){
      const order=[...cells];
      for(let i=order.length-1;i>0;i--){
        const j=ctx.rng.randomInt(0,i);
        [order[i],order[j]]=[order[j]!,order[i]!];
      }
      for(const [i,cell] of cells.entries()){
        const from=order[i]!;
        board[cell]=p.board[from]!;
        if(specials&&ids){specials[cell]=p.specials![from]!;ids[cell]=p.pieceIds![from]!;}
      }
      const existing=specials?specialRuns(board,width,height):findMatches(board,width,height,length);
      if(existing.length||!hasLegalSwap(board,width,height,length,specials)||
         manual&&equals(board,p.board)&&(!specials||equals(specials,p.specials!)))continue;
      p.board=board;
      if(specials&&ids){p.specials=specials;p.pieceIds=ids;}
      return attempt;
    }
    return 0;
  };
  const recoverDeadboard=()=>{
    if(p.won||p.lost||hasLegalSwap(p.board,width,height,length,p.specials))return;
    const attempts=shuffleMatch();
    if(!attempts)p.lost=true;
    events.push({type:'puzzle.deadboard',payload:{recovered:attempts>0,attempts:attempts||64}});
  };
  const useMatchTool=(tool:MatchTool,cells:number[])=>{
    const remaining=--p.toolRemaining![tool];
    p.toolMode='';
    p.selected=[];
    events.push({type:'puzzle.tool-used',payload:{tool,cells,remaining}});
    changed({tool:[tool,...cells]});
  };
  const placeTray=(tile:number,cardId:number,grouped:boolean,entry:JsonRecord)=>{
    const ledger=tools?p.trayTools!:undefined,last=grouped?p.tray.lastIndexOf(tile):-1,at=last<0?p.tray.length:last+1;
    p.tray.splice(at,0,tile);ledger?.trayIds.splice(at,0,cardId);p.moves++;
    const matches=p.tray.reduce<number[]>((indices,face,i)=>{if(face===tile)indices.push(i);return indices;},[]);
    if(matches.length>=length){
      const matched=new Set(matches.slice(0,length));
      if(ledger){
        ledger.clearedIds.push(...ledger.trayIds.filter((_,i)=>matched.has(i)));
        ledger.trayIds=ledger.trayIds.filter((_,i)=>!matched.has(i));
      }
      p.tray=p.tray.filter((_,i)=>!matched.has(i));p.score+=length;
    }
    p.lost=p.tray.length>=Number(cfg.capacity??7);
    p.won=p.board.every(value=>!value)&&p.tray.length===0&&!ledger?.reserveIds.length;
    changed(entry);
  };
  if(mode==='pair'&&p.closeAt>=0&&ctx.tickIndex>=p.closeAt){p.selected=[];p.closeAt=-1;changed();}
  const pieces=cfg.pieces as number[][][]|undefined;
  const cells=(anchor:number,rotation:number):number[]|null=>{const shape=rotatePolyomino(pieces![p.active]!,rotation),result:number[]=[];for(const [x,y] of shape){const col=anchor%width+x!,row=Math.floor(anchor/width)+y!;if(col<0||col>=width||row<0||row>=height||p.board[row*width+col])return null;result.push(row*width+col);}return result;};
  const lock=(anchor:number)=>{
    const indexes=cells(anchor,p.rotation);if(!indexes)return false;checkpoint();
    for(const index of indexes)p.board[index]=p.active%6+1;
    const result=clearLines(p.board,width,height,mode==='falling');p.board=result.board;p.score+=result.lines;p.moves++;p.active++;p.rotation=0;p.anchor=Math.floor(width/2);
    p.won=p.active>=pieces!.length;if(cfg.targetScore!==undefined){p.won=p.score>=Number(cfg.targetScore);if(p.active>=pieces!.length&&!p.won)p.lost=true;}
    // Spawn belongs to this lock transaction; later input cannot rescue an overlapping piece.
    if(mode==='falling'&&!p.won&&!p.lost&&!cells(p.anchor,0)){p.lost=true;invalid('spawn-blocked');}
    changed();return true;
  };
  if(mode==='falling'&&!p.won&&!p.lost&&pieces&&p.active<pieces.length&&!cells(p.anchor,p.rotation)){p.lost=true;invalid('spawn-blocked');}
  if(cfg.deadboardShuffle===true&&ctx.tickIndex===0)recoverDeadboard();
  for(const input of ctx.inputs){
    if(input.type!=='input.action'||input.edge!=='press')continue;
    if(settleTicks&&matchActions.has(input.action!)){
      const gesture=input.payload.value;
      if(ctx.tickIndex<p.settleUntilTick!||
         input.sourceId?.startsWith('select:')&&isRecord(gesture)&&safeInteger(gesture.startedTick)&&gesture.startedTick<p.settleUntilTick!){
        if(!busyReported){invalid('resolving');busyReported=true;}
        continue;
      }
    }
    if(input.action===cfg.undoAction){
      if(tools&&(p.won||p.lost||!p.trayTools!.undoRemaining||!p.history.length)){invalid('undo-unavailable');continue;}
      const previous=p.history.pop();if(previous){const history=p.history;p=normalize(previous.data,cfg,mode);p.history=history;if(tools)p.trayTools!.undoRemaining=0;ctx.rng.restore(previous.rng);undid=true;events.push({type:'puzzle.undone',payload:{moves:p.moves,...transaction({action:input.action!})}});}continue;
    }
    if(tools&&!p.won&&!p.lost){
      const ledger=p.trayTools!;
      if(input.action===tools.shuffleAction){
        if(!ledger.shuffleRemaining){invalid('shuffle-unavailable');continue;}
        const rng=ctx.rng.state(),candidate=buildTrayShuffle(p.board,p.tray,ledger.reserveFaces,cfg.blockers as number[][],Number(cfg.capacity??7),ctx.rng);
        if(!candidate||equals(candidate.board,p.board)){
          ctx.rng.restore(rng);invalid('shuffle-no-verified-change');continue;
        }
        p.board=candidate.board;
        for(const [id,face] of p.board.entries())if(face)ledger.faces[id]=face;
        ledger.shuffleRemaining=0;p.history=[];delete p.tilePress;changed({action:input.action!});continue;
      }
      if(input.action===tools.moveOutAction){
        if(!ledger.moveOutRemaining||ledger.reserveIds.length||p.tray.length<3){invalid('move-out-unavailable');continue;}
        ledger.reserveIds=ledger.trayIds.splice(0,3);ledger.reserveFaces=p.tray.splice(0,3);
        ledger.moveOutRemaining=0;p.history=[];delete p.tilePress;changed({action:input.action!});continue;
      }
      const slot=tools.returnActions.indexOf(input.action!);
      if(slot>=0){
        if(slot>=ledger.reserveIds.length){invalid('reserve-slot-empty');continue;}
        checkpoint();
        const [id]=ledger.reserveIds.splice(slot,1),[tile]=ledger.reserveFaces.splice(slot,1);
        placeTray(tile!,id!,true,{action:input.action!});continue;
      }
    }
    if(p.won||p.lost)continue;
    if(matchTools){
      if(input.action===matchTools.cancel){p.toolMode='';p.selected=[];continue;}
      const tool=matchToolNames.find(name=>matchTools[name]===input.action);
      if(tool){
        if(!p.toolRemaining![tool]){invalid('tool-empty');continue;}
        if(tool==='shuffle'){
          const rng=ctx.rng.state();
          if(!shuffleMatch(true)){ctx.rng.restore(rng);invalid('shuffle-no-verified-change');continue;}
          useMatchTool(tool,[]);continue;
        }
        p.toolMode=tool;p.selected=[];continue;
      }
    }
    let index=(cfg.selectActions as string[]).indexOf(input.action!);
    const pointer=cfg.tilePointer as unknown as TilePointer|undefined;
    if(pointer&&input.action===pointer.action){
      const v=input.payload.value;
      if(!isRecord(v)||!safeInteger(v.pointerId)||!safeFinite(v.u)||!safeFinite(v.v))continue;
      const [width,height]=pointer.scene,aspect=input.payload.viewportAspect;
      const [x,y]=viewportToWorld(v.u,v.v,safeFinite(aspect)?aspect:width/height,width,height,[0,0]);
      if(v.count!==1||v.kind==='cancel'){delete p.tilePress;continue;}
      if(v.kind==='down'){p.tilePress=[v.pointerId,x,y];continue;}
      if(v.kind!=='up')continue;
      const down=p.tilePress;delete p.tilePress;
      if(!down||down[0]!==v.pointerId||Math.hypot(x-down[1],y-down[2])>350)continue;
      for(let i=p.board.length-1;i>=0;i--){
        const [cx,cy]=pointer.centers[i]!;
        if(p.board[i]&&Math.abs(x-cx*1000)<=pointer.size[0]*500&&Math.abs(y-cy*1000)<=pointer.size[1]*500){index=i;break;}
      }
    }
    if(pieces&&(mode==='falling'||mode==='placement')){
      if(p.active>=pieces.length)continue;
      if(input.action===cfg.rotateAction){const rotation=(p.rotation+1)%4;if(cells(p.anchor,rotation)){p.rotation=rotation;changed();}else invalid('rotation-blocked');continue;}
      if(mode==='placement'){if(index>=0&&!lock(index))invalid('placement-blocked');continue;}
      if(input.action===cfg.leftAction||input.action===cfg.rightAction){const delta=input.action===cfg.leftAction?-1:1,next=p.anchor+delta;if(Math.floor(next/width)===Math.floor(p.anchor/width)&&cells(next,p.rotation))p.anchor=next;else invalid('boundary');continue;}
      if(input.action===cfg.dropAction){let anchor=p.anchor;while(cells(anchor+width,p.rotation))anchor+=width;if(!lock(anchor))p.lost=true;continue;}
    }
    if(index<0)continue;
    if(mode==='sort'){
      if(!p.selected.length){if(p.tubes[index]!.length)p.selected=[index];else invalid('empty');continue;}
      const source=p.selected[0]!;p.selected=[];if(source===index)continue;const from=p.tubes[source]!,to=p.tubes[index]!,capacity=Number(cfg.capacity??height),top=from.at(-1);
      if(!top||to.length>=capacity||(to.length&&to.at(-1)!==top)){invalid('color-or-capacity');continue;}
      checkpoint();let run=0;for(let i=from.length-1;i>=0&&from[i]===top;i--)run++;const count=Math.min(run,capacity-to.length);to.push(...from.splice(from.length-count,count));p.moves++;p.score=p.tubes.filter(tube=>tube.length===capacity&&tube.every(value=>value===tube[0])).length;p.won=p.tubes.every(tube=>!tube.length||(tube.length===capacity&&tube.every(value=>value===tube[0])));changed();continue;
    }
    if(mode==='arrows'){
      if(!p.board[index]){invalid('empty');continue;}const direction=(cfg.directions as string[])[index]!,delta={left:-1,right:1,up:-width,down:width}[direction]!;let cell=index,blocked=false;
      for(;;){const next=cell+delta;if(next<0||next>=width*height||((direction==='left'||direction==='right')&&Math.floor(next/width)!==Math.floor(cell/width)))break;if(p.board[next]){blocked=true;break;}cell=next;}
      if(blocked){invalid('ray-blocked');continue;}checkpoint();p.board[index]=0;p.moves++;p.score++;p.won=p.board.every(value=>!value);changed();continue;
    }
    if(mode==='tray'){
      if(!freeCell(p,cfg,index)){invalid('occluded');continue;}checkpoint();
      const tile=p.board[index]!;p.board[index]=0;placeTray(tile,index,Boolean(pointer),{card:index});continue;
    }
    if(mode==='pair'){
      if(p.closeAt>=0||!freeCell(p,cfg,index,cfg.variant==='mahjong')||p.removed.includes(index)||p.selected.includes(index)){invalid('unavailable');continue;}
      checkpoint();p.selected.push(index);p.moves++;
      if(p.selected.length===2){const [a,b]=p.selected;if(p.board[a!]===p.board[b!]){p.board[a!]=0;p.board[b!]=0;p.removed.push(a!,b!);p.selected=[];p.score+=2;}else if(cfg.variant==='mahjong')p.selected=[];else p.closeAt=ctx.tickIndex+Number(cfg.closeTicks??30);}
      p.won=p.board.every(value=>!value);changed();continue;
    }
    if(mode==='connected'){
      const matches=connectedCells(p.board,index,width,height);if(matches.length<length){invalid('group-too-small');continue;}checkpoint();for(const cell of matches)p.board[cell]=0;
      const supported=new Set<number>(),queue=Array.from({length:width},(_,i)=>i).filter(i=>p.board[i]);for(const cell of queue)supported.add(cell);for(let i=0;i<queue.length;i++)for(const next of gridNeighbors(queue[i]!,width,height))if(p.board[next]&&!supported.has(next)){supported.add(next);queue.push(next);}
      let removed=matches.length;for(let i=0;i<p.board.length;i++)if(p.board[i]&&!supported.has(i)){p.board[i]=0;removed++;}p.score+=removed;p.moves++;p.won=p.board.every(value=>!value);changed();continue;
    }
    if(mode==='match'||mode==='placement'){
      const tool=matchTools?p.toolMode:undefined,hammer=tool==='hammer';
      if(hammer){
        if((!p.board[index]&&!p.boxes?.[index])||p.board[index]===collectibleFace){invalid('hammer-target');continue;}
      }else if(!p.selected.length){if(p.board[index])p.selected=[index];else invalid('empty');continue;}
      const source=hammer?index:p.selected[0]!;p.selected=[];if(!hammer&&source===index)continue;
      if(mode==='placement'){
        const targets=cfg.targets as number[]|undefined;if(!Array.isArray(targets)||p.board[index]||targets[index]!==p.board[source]){invalid('wrong-target');continue;}checkpoint();p.board[index]=p.board[source]!;p.board[source]=0;p.moves++;p.won=p.board.every((value,i)=>value===targets[i]);p.score=p.board.filter((value,i)=>value>0&&value===targets[i]).length;changed();continue;
      }
      if(!hammer&&!gridNeighbors(source,width,height).includes(index)){invalid('non-adjacent');continue;}
      if(!hammer&&(!p.board[index]||!p.board[source])){invalid('blocked-cell');continue;}
      const next=[...p.board];[next[source],next[index]]=[next[index]!,next[source]!];
      const specials=p.specials&&[...p.specials],ids=p.pieceIds&&[...p.pieceIds];
      if(cfg.specialBlocks===true){
        [specials![source],specials![index]]=[specials![index]!,specials![source]!];
        [ids![source],ids![index]]=[ids![index]!,ids![source]!];
      }
      const combo=cfg.specialBlocks===true&&!hammer?planSpecialCombo(next,specials!,ids!,width,height,source,index):undefined;
      const forced=new Map<number,number>();
      if(cfg.specialBlocks===true&&!hammer){
        if(specials![source]==='color'&&specials![index]==='none'&&next[index]!<colorClearFace)forced.set(source,next[index]!);
        if(specials![index]==='color'&&specials![source]==='none'&&next[source]!<colorClearFace)forced.set(index,next[source]!);
      }
      let runs=cfg.specialBlocks===true?specialRuns(next,width,height):[];
      let matches=cfg.specialBlocks===true?[...new Set(runs.flatMap(r=>r.cells))]:findMatches(next,width,height,length);
      if(hammer)matches=[index];
      else if(combo)matches=[...combo.consumed,...combo.footprint];
      else if(forced.size)matches=[source,index];
      if(!matches.length&&(tool!=='forceSwap'||p.board[source]===p.board[index]&&p.specials?.[source]===p.specials?.[index])){invalid('no-match');continue;}
      checkpoint();p.board=next;const colors=Math.max(3,...(cfg.specialBlocks===true?next.filter(face=>face<colorClearFace):next));let cascades=0;
      if(cfg.specialBlocks===true){p.specials=specials!;p.pieceIds=ids!;}
      if(combo)events.push({type:'puzzle.special-combined',payload:{
        kind:combo.kind,cell:index,pieceIds:combo.consumed.map(cell=>p.pieceIds![cell]!),footprint:combo.footprint,
        convertedIds:combo.converted.map(cell=>p.pieceIds![cell]!)
      }});
      while(matches.length){if(cascades++>=16)fail('A2G_E_BUDGET_EXCEEDED','Puzzle cascade exceeds 16 waves');
        if(settleTicks)events.push({type:'puzzle.resolve-wave',payload:{wave:cascades,cells:[...new Set(matches)].sort((a,b)=>a-b)}});
        if(cfg.specialBlocks===true){
          const direct=(hammer||combo||forced.size)&&cascades===1;
          const newPieces=direct?[]:planSpecials(runs,p.specials!,cascades===1?[index,source]:[]);
          const ordinaryMatches=direct?[]:matches.filter(cell=>p.specials![cell]==='none'),{cleared,activated,impacted}=resolveSpecialHits(p.board,p.specials!,width,height,matches,
            new Set(newPieces.map(piece=>piece.cell)),cascades===1?forced:undefined,cascades===1?combo:undefined);
          if(cfg.obstacleGoals!==undefined){
            const hits=new Set(impacted);
            const boxHits=new Set([...impacted,...ordinaryMatches.filter(cell=>cleared.includes(cell)).flatMap(cell=>gridNeighbors(cell,width,height))]);
            for(const [layers,targets,goal,kind] of [[p.ice!,hits,0,'ice'],[p.boxes!,boxHits,1,'box']] as const){
              for(const cell of [...targets].sort((a,b)=>a-b))if(layers[cell]!>0){
                layers[cell]!--;p.score+=20;p.obstacleRemaining![goal]=Math.max(0,p.obstacleRemaining![goal]!-1);
                events.push({type:'puzzle.obstacle-hit',payload:{cell,kind,layers:layers[cell]!,wave:cascades}});
              }
            }
          }
          matches=cleared;
          for(const cell of activated)events.push({type:'puzzle.special-activated',payload:{cell,pieceId:p.pieceIds![cell]!,kind:p.specials![cell]!,wave:cascades}});
          for(const {cell,kind} of newPieces){
            p.specials![cell]=kind;p.pieceIds![cell]=p.nextPieceId!++;
            if(kind==='color')p.board[cell]=colorClearFace;
            events.push({type:'puzzle.special-created',payload:{cell,pieceId:p.pieceIds![cell]!,kind,wave:cascades}});
          }
        }
        for(const cell of matches){
          if(colorGoals){const goal=colorGoals.findIndex(g=>g.color===p.board[cell]);if(goal>=0)p.goalRemaining![goal]=Math.max(0,p.goalRemaining![goal]!-1);}
          p.board[cell]=0;
        }
        p.score+=matches.length*(colorGoals?10:1);
        if(outletLayout){
          for(const path of outletLayout.paths){
            const endpoint=path.at(-1)!;
            const collected=dropSpecialPath(p.board,p.specials!,p.pieceIds!,p.boxes??[],path,path[0]!<width,outletLayout.outlets.includes(endpoint),
              ()=>({face:ctx.rng.randomInt(1,colors),id:p.nextPieceId!++}));
            for(const pieceId of collected){
              p.score+=50;p.collectionRemaining=Math.max(0,p.collectionRemaining!-1);
              events.push({type:'puzzle.outlet-collected',payload:{pieceId,cell:endpoint,wave:cascades}});
            }
          }
        }else for(let x=0;x<width;x++){
          if(cfg.specialBlocks===true){
            dropSpecialColumn(p.board,p.specials!,p.pieceIds!,p.boxes??[],width,height,x,()=>({face:ctx.rng.randomInt(1,colors),id:p.nextPieceId!++}));
          }else{
            const column=Array.from({length:height},(_,y)=>p.board[y*width+x]!).filter(Boolean);while(column.length<height)column.unshift(ctx.rng.randomInt(1,colors));for(let y=0;y<height;y++)p.board[y*width+x]=column[y]!;
          }
        }
        if(cfg.specialBlocks===true){runs=specialRuns(p.board,width,height);matches=[...new Set(runs.flatMap(r=>r.cells))];}
        else matches=findMatches(p.board,width,height,length);
      }
      if(!tool)p.moves++;
      if(colorGoals){p.movesRemaining=Number(cfg.moveLimit)-p.moves;p.won=p.goalRemaining!.every(n=>n===0)&&(!p.obstacleRemaining||p.obstacleRemaining.every(n=>n===0))&&(!outletLayout||p.collectionRemaining===0);p.lost=!p.won&&p.movesRemaining===0;}
      if(cfg.deadboardShuffle===true)recoverDeadboard();
      if(settleTicks){
        const ticks=Math.max(1,cascades)*settleTicks;
        p.settleUntilTick=ctx.tickIndex+1+ticks;
        events.push({type:'puzzle.resolving',payload:{ticks,waves:Math.max(1,cascades),cells:[...new Set([source,index])]}});
      }
      if(tool)useMatchTool(tool,hammer?[index]:[source,index]);
      else changed({swap:[source,index]});
      continue;
    }
  }
  if(mode==='falling'&&!undid&&!p.won&&!p.lost&&pieces&&p.active<pieces.length){if(!cells(p.anchor,p.rotation))p.lost=true;else if((ctx.tickIndex+1)%Number(cfg.fallTicks??30)===0){if(cells(p.anchor+width,p.rotation))p.anchor+=width;else lock(p.anchor);}}
  if(cfg.targetScore!==undefined&&p.score>=Number(cfg.targetScore))p.won=true;frame(p,cfg,mode);
  if(equals(p as unknown as Json,original as unknown as Json))return {events};
  return {proposals:[{kind:'state.set',path:String(cfg.statePath),value:p as unknown as Json}],events};
}
function undoable(implementation:TrustedCapabilityImplementation,fields:string[]):TrustedCapabilityImplementation{return {role:'module',simulate(ctx){
  const selected=fields.filter(field=>typeof ctx.config[field]==='string');
  const historyPath=ctx.config.historyPath,undoAction=ctx.config.undoAction;if(typeof historyPath!=='string'||typeof undoAction!=='string')return implementation.simulate!(ctx);
  const history=clone(readPointer(ctx.world.state,historyPath));if(!Array.isArray(history)||history.length>16)error('Undo history must be an array of at most 16 checkpoints');
  if(ctx.inputs.some(input=>input.type==='input.action'&&input.edge==='press'&&input.action===undoAction)){
    const previous=history.pop() as unknown as Checkpoint|undefined;if(!previous)return {};
    if(!isRecord(previous.data)||!Array.isArray(previous.rng))error('Invalid undo checkpoint');ctx.rng.restore(previous.rng);
    return {proposals:[...selected.map(field=>{const path=String(ctx.config[field]);if(!Object.hasOwn(previous.data,path))error('Missing undo field');return {kind:'state.set' as const,path,value:previous.data[path]!};}),{kind:'state.set',path:historyPath,value:history}],events:[{type:'puzzle.undone',payload:{}}]};
  }
  const rng=ctx.rng.state(),result=implementation.simulate!(ctx);if(result.proposals?.length){const data=Object.fromEntries(selected.map(field=>{const path=String(ctx.config[field]);return [path,clone(readPointer(ctx.world.state,path))];}));history.push({data,rng} as unknown as Json);if(history.length>16)history.shift();result.proposals.push({kind:'state.set',path:historyPath,value:history});}return result;
}};}
export const puzzleImplementations:Record<string,TrustedCapabilityImplementation>=Object.fromEntries(Object.entries(modes).map(([id,mode])=>[id,{role:'module',simulate:(ctx:ModuleContext)=>simulatePuzzle(ctx,mode)}]));
puzzleImplementations['a2game.puzzle.push']=undoable(gridPushImplementation,['playerPath','boxesPath','movesPath','solvedPath']);
puzzleImplementations['a2game.puzzle.slide']=undoable(gridSlideMergeImplementation,['boardPath','bestPath','stalledPath']);
export const puzzleServiceIds=['grid','occupancy','match-n','cascade','gravity-fill','layered-stack','occlusion','reveal','polyomino','rotate-piece','line-clear','select','undo','merge'].map(name=>'a2game.puzzle.'+name);
export function validatePuzzleDefinition(def:GameDefinition,registry:CapabilityRegistry):void{
  const state=Object.fromEntries(Object.entries(def.state).map(([key,field])=>[key,field.initial]));
  for(const scene of def.scenes){const components=scene.entities.flatMap(entity=>[...(def.prototypes?.[entity.prototype??'']?.components??[]),...(entity.components??[])]).filter(component=>registry.get(component.capability).kind==='behavior');if(components.length>1&&components.some(component=>Object.hasOwn(component.config,'undoAction')))error('RNG-restoring board undo requires a single behavior per scene; multi-behavior sessions use whole-session snapshots');}
  const entities:GameEntity[]=[...def.scenes.flatMap(scene=>scene.entities),...Object.values(def.prototypes??{})];
  for(const entity of entities)for(const component of entity.components??[]){
    if(['a2game.puzzle.push','a2game.puzzle.slide','a2game.puzzle.grid-slide-merge'].includes(component.capability.id)){
      const cfg=component.config;if(cfg.stalledPath!==undefined&&(typeof cfg.stalledPath!=='string'||typeof readPointer(state,String(cfg.stalledPath))!=='boolean'||[cfg.boardPath,cfg.bestPath,cfg.historyPath].includes(cfg.stalledPath)))error('Invalid independent boolean stalled path');if(Boolean(cfg.historyPath)!==Boolean(cfg.undoAction))error('Undo requires both historyPath and undoAction');
      if(cfg.historyPath){const history=readPointer(state,String(cfg.historyPath));if(!Array.isArray(history)||history.length)error('Authored initial undo history must be empty');if(!def.inputs.actions.some(action=>action.id===cfg.undoAction))error('Unknown undo input action');const paths=['boardPath','bestPath','playerPath','boxesPath','movesPath','solvedPath'].flatMap(key=>typeof cfg[key]==='string'?[String(cfg[key])]:[]);if(paths.includes(String(cfg.historyPath)))error('Undo history must have independent storage');}continue;
    }
    const mode=modes[component.capability.id];if(!mode)continue;validateConfig(component.config,mode);const p=normalize(readPointer(state,String(component.config.statePath)),component.config,mode,{capabilityId:component.capability.id,jsonPointer:'/state/'+String(component.config.statePath).slice(1)+'/initial'});if(p.history.length)error('Authored initial undo history must be empty');
    if(component.config.colorGoals!==undefined){
      const goals=component.config.colorGoals as unknown as ColorGoal[],width=Number(component.config.width),height=Number(component.config.height);
      const layout=component.config.outletLayout as unknown as OutletLayout|undefined,active=layout?new Set(layout.paths.flat()):undefined;
      if(!equals(p.goalRemaining!,goals.map(g=>g.count))||p.moves!==0||p.score!==0||p.won||p.lost||p.selected.length||
        p.board.some((face,i)=>face<(p.boxes?.[i]||active&&!active.has(i)?0:1)||face>(layout?collectibleFace:component.config.specialBlocks===true?colorClearFace:12))||
        (component.config.specialBlocks===true?specialRuns(p.board,width,height):findMatches(p.board,width,height,Number(component.config.matchLength??3))).length)error('Color-goal swaps require a stable initial board and fresh counters');
      if(layout&&(p.collectionRemaining!==layout.targetCount||p.board.filter(face=>face===collectibleFace).length<layout.targetCount||
        layout.outlets.some(cell=>p.board[cell]===collectibleFace)))error('Outlet goals require collectible pieces above declared exits');
    }
    if(isRecord(component.config.obstacleGoals)){
      const goals=component.config.obstacleGoals,counts=[Number(goals.ice),Number(goals.boxes)];
      if(!equals(p.obstacleRemaining!,counts)||[p.ice!,p.boxes!].some((layers,i)=>layers.reduce((a,b)=>a+b,0)<counts[i]!))error('Obstacle goals exceed the declared initial layers');
    }
    const actions=[...(component.config.selectActions as string[]),...['undoAction','rotateAction','leftAction','rightAction','dropAction'].flatMap(key=>typeof component.config[key]==='string'?[String(component.config[key])]:[])];if(actions.some(name=>!def.inputs.actions.some(action=>action.id===name)))error('Puzzle config references an unknown input action');
    if(component.config.tilePointer!==undefined){
      const t=component.config.tilePointer as unknown as TilePointer,graph=component.config.blockers as number[][];
      if(!def.inputs.actions.some(a=>a.id===t.action&&a.valueType==='pose'&&a.bindings.some(b=>b.source==='touch.raw')))error('Tray pointer requires a raw touch action');
      const scene=def.presentation.scene2d,displayPath=String(component.config.statePath)+'/display';
      if(!isRecord(scene)||scene.width!==t.scene[0]||scene.height!==t.scene[1]||!Array.isArray(scene.repeat)||
        !scene.repeat.some(r=>isRecord(r)&&isRecord(r.source)&&r.source.state===displayPath&&equals(r.positions,t.centers)&&
          Array.isArray(r.omitItems)&&r.omitItems.includes(-1)&&Array.isArray(r.template)&&
          isRecord(r.template[0])&&r.template[0].kind==='rect'&&equals(r.template[0].at,[0,0])&&equals(r.template[0].size,t.size)))error('Tray pointer geometry must match the projected tiles');
      for(const [i,[x,y]] of t.centers.entries()){
        if(Math.abs(x)+t.size[0]/2>t.scene[0]/2||Math.abs(y)+t.size[1]/2>t.scene[1]/2)error('Tray tile lies outside the scene');
        const expected=t.centers.flatMap(([ox,oy],j)=>j>i&&Math.abs(x-ox)<t.size[0]&&Math.abs(y-oy)<t.size[1]?[j]:[]);
        if(!equals(graph[i]!,expected))error('Tray blockers must match overlapping tiles in draw order');
      }
    }
    if(component.config.trayTools!==undefined){
      const tools=component.config.trayTools as unknown as TrayToolActions,ledger=p.trayTools!;
      const toolIds=[...tools.returnActions,tools.moveOutAction,component.config.undoAction,...(tools.shuffleAction?[tools.shuffleAction]:[])];
      if(toolIds.some(id=>!def.inputs.actions.some(action=>action.id===id&&action.valueType==='button'))||
        ledger.moveOutRemaining!==1||ledger.undoRemaining!==1||tools.shuffleAction&&ledger.shuffleRemaining!==1||p.board.some(face=>face===0)||p.score!==0||p.tray.length||ledger.reserveIds.length)error('Tray tools require button bindings and a full initial board with one use per tool');
    }
    if(component.config.journalActions===true){
      const supported=mode==='tray'&&Boolean(component.config.trayTools)||mode==='match'&&component.config.colorGoals!==undefined;
      if(!supported||def.rules.length||def.scenes.length!==1||def.scenes[0]?.entities.length!==1||
        def.scenes[0]?.entities[0]?.components?.length!==1||Object.keys(def.prototypes??{}).length)
        error('Puzzle journals require a standalone tray with tools or limited-move swap ruleset');
    }
    if(component.config.matchTools!==undefined&&(
       p.toolMode||Object.values(component.config.matchTools as JsonRecord).some(id=>!def.inputs.actions.some(action=>action.id===id&&action.valueType==='button'))))
      error('Match tools require declared button actions and no initial tool selection');
    if(component.config.settleTicksPerWave!==undefined&&(
       p.settleUntilTick!==0||def.inputs.actions.some(action=>(component.config.selectActions as string[]).includes(action.id)&&
       action.bindings.some(binding=>binding.source==='touch.select'&&binding.config?.gestureMetadata!==true))))
      error('Match settlement requires fresh state and gesture metadata for touch selection');
  }
}
