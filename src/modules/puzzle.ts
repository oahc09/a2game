import {fail} from '../errors.js';
import {isRecord,readPointer,safeInteger,equals} from '../utils.js';
import {gridPushImplementation} from './grid-push.js';
import {gridSlideMergeImplementation} from './grid-slide-merge.js';
import type {GameDefinition,GameEntity,Json,JsonRecord,ModuleContext,ModuleResult,TrustedCapabilityImplementation} from '../types.js';
import type {CapabilityRegistry} from '../registry.js';

export type PuzzleMode='match'|'tray'|'pair'|'arrows'|'placement'|'falling'|'sort'|'connected';
interface Checkpoint {data:JsonRecord;rng:number[];}
interface PuzzleState {board:number[];display:number[];preview:number[];selected:number[];removed:number[];tray:number[];tubes:number[][];score:number;moves:number;won:boolean;lost:boolean;history:Checkpoint[];closeAt:number;active:number;anchor:number;rotation:number;}
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
function normalize(raw:unknown,cfg:JsonRecord,mode:PuzzleMode):PuzzleState{
  if(!isRecord(raw))error('Puzzle state must be an object');const p=clone(raw) as unknown as PuzzleState;
  p.board??=[];p.display??=[];p.preview??=[];p.selected??=[];p.removed??=[];p.tray??=[];p.tubes??=[];p.score??=0;p.moves??=0;p.won??=false;p.lost??=false;p.history??=[];p.closeAt??=-1;p.active??=0;p.anchor??=Math.floor(Number(cfg.width)/2);p.rotation??=0;
  const array=(v:unknown,max=256)=>Array.isArray(v)&&v.length<=max&&v.every(n=>safeInteger(n)&&n>=0&&n<=1000000);
  const cells=Number(cfg.width)*Number(cfg.height);
  if(!array(p.board)||(mode!=='sort'&&p.board.length!==cells)||!array(p.selected,2)||!array(p.removed)||!array(p.tray,32)||!Array.isArray(p.tubes)||p.tubes.length>16||!p.tubes.every(tube=>array(tube,32))||
    !safeInteger(p.score)||p.score<0||!safeInteger(p.moves)||p.moves<0||typeof p.won!=='boolean'||typeof p.lost!=='boolean'||!Array.isArray(p.history)||p.history.length>16||!safeInteger(p.closeAt)||!safeInteger(p.active)||p.active<0||!safeInteger(p.anchor)||p.anchor<0||!safeInteger(p.rotation)||p.rotation<0||p.rotation>3)error('Invalid puzzle state');
  if(mode==='sort'&&(p.tubes.length!==Number(cfg.width)||p.tubes.some(tube=>tube.length>Number(cfg.capacity??cfg.height))))error('Invalid tube layout');
  if(p.selected.some(index=>index>=cells)||new Set(p.selected).size!==p.selected.length||p.removed.some(index=>index>=cells)||new Set(p.removed).size!==p.removed.length||p.tray.some(value=>value===0)||p.tubes.some(tube=>tube.some(value=>value===0)))error('Invalid puzzle selection or tile values');
  return p;
}
function validateConfig(cfg:JsonRecord,mode:PuzzleMode):void{
  if(typeof cfg.statePath!=='string'||!/^\/(?:[^~/]|~[01])+$/.test(cfg.statePath)||!safeInteger(cfg.width)||cfg.width<1||cfg.width>16||!safeInteger(cfg.height)||cfg.height<1||cfg.height>16)error('Invalid puzzle dimensions/state path');
  const count=Number(cfg.width)*Number(cfg.height),actions=cfg.selectActions;
  if(!Array.isArray(actions)||actions.length!==(mode==='sort'?cfg.width:mode==='falling'?0:count)||actions.some(name=>typeof name!=='string'||!name)||new Set(actions).size!==actions.length)error('One distinct action per selectable cell/container required');
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
    if(!Array.isArray(cfg.blockers)||cfg.blockers.length!==count||cfg.blockers.some((row,index)=>!Array.isArray(row)||row.some(n=>!safeInteger(n)||n<0||n>=count||n===index)))error('Invalid layer/occlusion graph');
    const graph=cfg.blockers as number[][],seen=new Set<number>(),stack=new Set<number>();const visit=(index:number):void=>{if(stack.has(index))error('Cyclic occlusion graph');if(seen.has(index))return;stack.add(index);for(const next of graph[index]!)visit(next);stack.delete(index);seen.add(index);};for(let i=0;i<count;i++)visit(i);
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
  if(mode==='tray'||(mode==='pair'&&cfg.variant==='mahjong'))p.display=p.board.map((value,index)=>value&&!freeCell(p,cfg,index,cfg.variant==='mahjong')?0:value||-1);
  if(mode==='falling'&&!p.lost&&Array.isArray(cfg.pieces)&&p.active<cfg.pieces.length){const piece=rotatePolyomino(cfg.pieces[p.active] as number[][],p.rotation),width=Number(cfg.width);for(const [x,y] of piece){const col=p.anchor%width+x!,row=Math.floor(p.anchor/width)+y!;if(col>=0&&col<width&&row>=0&&row<Number(cfg.height))p.display[row*width+col]=7;}}
}
export function simulatePuzzle(ctx:ModuleContext,mode:PuzzleMode):ModuleResult{
  const cfg=ctx.config;validateConfig(cfg,mode);const raw=readPointer(ctx.world.state,String(cfg.statePath));let p=normalize(raw,cfg,mode);const original=clone(raw);
  const width=Number(cfg.width),height=Number(cfg.height),length=Number(cfg.matchLength??3),events:NonNullable<ModuleResult['events']>=[];
  const checkpoint=()=>{const data=clone(p);data.history=[];if(mode!=='pair'||cfg.variant==='mahjong')data.selected=[];p.history.push({data:data as unknown as JsonRecord,rng:ctx.rng.state()});if(p.history.length>16)p.history.shift();};
  let undid=false;
  const invalid=(reason:string)=>events.push({type:'puzzle.invalid',payload:{reason}});
  const changed=()=>events.push({type:'puzzle.changed',payload:{mode,moves:p.moves,score:p.score}});
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
  for(const input of ctx.inputs){
    if(input.type!=='input.action'||input.edge!=='press')continue;
    if(input.action===cfg.undoAction){const previous=p.history.pop();if(previous){const history=p.history;p=normalize(previous.data,cfg,mode);p.history=history;ctx.rng.restore(previous.rng);undid=true;events.push({type:'puzzle.undone',payload:{moves:p.moves}});}continue;}
    if(p.won||p.lost)continue;const index=(cfg.selectActions as string[]).indexOf(input.action!);
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
      if(!freeCell(p,cfg,index)){invalid('occluded');continue;}checkpoint();p.tray.push(p.board[index]!);p.board[index]=0;p.moves++;
      const tile=p.tray.at(-1)!,matches=p.tray.filter(value=>value===tile).length;if(matches>=length){let remove=length;p.tray=p.tray.filter(value=>{if(value===tile&&remove>0){remove--;return false;}return true;});p.score+=length;}
      p.lost=p.tray.length>=Number(cfg.capacity??7);p.won=p.board.every(value=>!value)&&p.tray.length===0;changed();continue;
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
      if(!p.selected.length){if(p.board[index])p.selected=[index];else invalid('empty');continue;}const source=p.selected[0]!;p.selected=[];if(source===index)continue;
      if(mode==='placement'){
        const targets=cfg.targets as number[]|undefined;if(!Array.isArray(targets)||p.board[index]||targets[index]!==p.board[source]){invalid('wrong-target');continue;}checkpoint();p.board[index]=p.board[source]!;p.board[source]=0;p.moves++;p.won=p.board.every((value,i)=>value===targets[i]);p.score=p.board.filter((value,i)=>value>0&&value===targets[i]).length;changed();continue;
      }
      if(!gridNeighbors(source,width,height).includes(index)){invalid('non-adjacent');continue;}const next=[...p.board];[next[source],next[index]]=[next[index]!,next[source]!];let matches=findMatches(next,width,height,length);if(!matches.length){invalid('no-match');continue;}
      checkpoint();p.board=next;const colors=Math.max(3,...p.board);let cascades=0;
      while(matches.length){if(cascades++>=16)fail('A2G_E_BUDGET_EXCEEDED','Puzzle cascade exceeds 16 waves');for(const cell of matches)p.board[cell]=0;p.score+=matches.length;
        for(let x=0;x<width;x++){const column=Array.from({length:height},(_,y)=>p.board[y*width+x]!).filter(Boolean);while(column.length<height)column.unshift(ctx.rng.randomInt(1,colors));for(let y=0;y<height;y++)p.board[y*width+x]=column[y]!;}matches=findMatches(p.board,width,height,length);
      }p.moves++;changed();continue;
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
    const mode=modes[component.capability.id];if(!mode)continue;validateConfig(component.config,mode);const p=normalize(readPointer(state,String(component.config.statePath)),component.config,mode);if(p.history.length)error('Authored initial undo history must be empty');
    const actions=[...(component.config.selectActions as string[]),...['undoAction','rotateAction','leftAction','rightAction','dropAction'].flatMap(key=>typeof component.config[key]==='string'?[String(component.config[key])]:[])];if(actions.some(name=>!def.inputs.actions.some(action=>action.id===name)))error('Puzzle config references an unknown input action');
  }
}
