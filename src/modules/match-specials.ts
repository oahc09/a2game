export const colorClearFace=13;
export const collectibleFace=14;
export type SpecialKind='none'|'row'|'column'|'burst'|'color';
export interface CreatedSpecial {cell:number;kind:SpecialKind;}

interface Run {cells:number[];axis:'row'|'column';}
export function specialRuns(board:number[],width:number,height:number):Run[]{
 const runs:Run[]=[];
 for(const axis of ['row','column'] as const){
  const horizontal=axis==='row',lines=horizontal?height:width,span=horizontal?width:height;
  for(let line=0;line<lines;line++){
   const cells=Array.from({length:span},(_,i)=>horizontal?line*width+i:i*width+line);
   for(let start=0;start<span;){
    const color=board[cells[start]!]!;
    let end=start+1;while(end<span&&board[cells[end]!]===color)end++;
    if(color>0&&color<colorClearFace&&end-start>=3)runs.push({cells:cells.slice(start,end),axis});
    start=end;
   }
  }
 }
 return runs;
}

export function planSpecials(runs:Run[],specials:SpecialKind[],preferred:number[]):CreatedSpecial[]{
 const groups:{cells:Set<number>;runs:Run[]}[]=[];
 for(const run of runs){
  const joined=groups.filter(group=>run.cells.some(cell=>group.cells.has(cell)));
  const group={cells:new Set(run.cells),runs:[run]};
  for(const overlap of joined){
   for(const cell of overlap.cells)group.cells.add(cell);
   group.runs.push(...overlap.runs);groups.splice(groups.indexOf(overlap),1);
  }
  groups.push(group);
 }
 const result:CreatedSpecial[]=[];
 for(const group of groups){
  const four=group.runs.find(r=>r.cells.length===4);
  const kind=group.runs.some(r=>r.cells.length>=5)?'color':
   group.cells.size>=5&&new Set(group.runs.map(r=>r.axis)).size===2?'burst':four?.axis;
  const cell=[...preferred,...[...group.cells].sort((a,b)=>a-b)].find(i=>group.cells.has(i)&&specials[i]==='none');
  if(kind&&cell!==undefined)result.push({cell,kind});
 }
 return result.sort((a,b)=>a.cell-b.cell);
}

export function planSpecialCombo(board:number[],specials:SpecialKind[],pieceIds:number[],width:number,height:number,source:number,target:number){
 const a=specials[source]!,b=specials[target]!;
 if(a==='none'||b==='none')return undefined;
 const category=(kind:SpecialKind)=>kind==='row'||kind==='column'?'line':kind;
 const categories=[category(a),category(b)].sort().join('+');
 const cells=board.map((_,i)=>i),consumed=[source,target];
 const x=target%width,y=Math.floor(target/width);
 const near=(i:number)=>[Math.abs(i%width-x),Math.abs(Math.floor(i/width)-y)];
 let footprint:number[],converted:number[]=[];
 if(categories==='line+line')footprint=cells.filter(i=>{const [dx,dy]=near(i);return dx===0||dy===0;});
 else if(categories==='burst+line')footprint=cells.filter(i=>{const [dx,dy]=near(i);return dx!<=1||dy!<=1;});
 else if(categories==='burst+burst')footprint=cells.filter(i=>{const [dx,dy]=near(i);return dx!<=2&&dy!<=2;});
 else if(categories==='color+color')footprint=cells;
 else{
  const partner=a==='color'?target:source,color=board[partner],kind=specials[partner]!;
  converted=cells.filter(i=>!consumed.includes(i)&&board[i]===color).sort((i,j)=>pieceIds[i]!-pieceIds[j]!);
  for(const cell of converted)specials[cell]=kind;
  footprint=[...converted];
 }
 return {kind:categories,consumed,footprint,converted};
}

export function resolveSpecialHits(board:number[],specials:SpecialKind[],width:number,height:number,initial:number[],protectedCells:Set<number>,forcedColors=new Map<number,number>(),combo?:ReturnType<typeof planSpecialCombo>){
 const hit=new Set(combo?.consumed),impact=new Set(combo?.consumed),queue:number[]=[],activated:number[]=[];
 const hitCell=(cell:number)=>{
  impact.add(cell);
  if(!board[cell]||board[cell]===collectibleFace||protectedCells.has(cell)||hit.has(cell))return;
  hit.add(cell);if(specials[cell]!=='none')queue.push(cell);
 };
 for(const cell of combo?.converted??[])hitCell(cell);
 for(const cell of [...initial].sort((a,b)=>a-b))hitCell(cell);
 const counts=new Map<number,number>();
 for(const face of board)if(face>0&&face<colorClearFace)counts.set(face,(counts.get(face)??0)+1);
 const dominant=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0];
 for(let i=0;i<queue.length;i++){
  const cell=queue[i]!,x=cell%width,y=Math.floor(cell/width);
  const kind=specials[cell]!,color=forcedColors.get(cell)??dominant;
  activated.push(cell);
  for(let other=0;other<width*height;other++){
   const ox=other%width,oy=Math.floor(other/width);
   if(kind==='row'&&oy===y||kind==='column'&&ox===x||
    kind==='burst'&&Math.abs(ox-x)<=1&&Math.abs(oy-y)<=1||
    kind==='color'&&color!==undefined&&board[other]===color)hitCell(other);
  }
 }
 return {cleared:[...hit].sort((a,b)=>a-b),activated,impacted:[...impact].sort((a,b)=>a-b)};
}

/** A surviving box cuts the column. Only the segment open to the top receives refills. */
export function dropSpecialColumn(board:number[],specials:SpecialKind[],ids:number[],boxes:number[],width:number,height:number,x:number,create:()=>{face:number;id:number}){
 return dropSpecialPath(board,specials,ids,boxes,Array.from({length:height},(_,y)=>y*width+x),true,false,create);
}

export function dropSpecialPath(board:number[],specials:SpecialKind[],ids:number[],boxes:number[],path:number[],refill:boolean,outlet:boolean,create:()=>{face:number;id:number}){
 const collected:number[]=[];
 let end=path.length-1;
 while(end>=0){
  if(boxes[path[end]!]){end--;continue;}
  let start=end;
  while(start>0&&!boxes[path[start-1]!])start--;
  const pieces=path.slice(start,end+1).filter(i=>board[i])
    .map(i=>({face:board[i]!,kind:specials[i]!,id:ids[i]!}));
  if(outlet&&end===path.length-1)while(pieces.at(-1)?.face===collectibleFace)collected.push(pieces.pop()!.id);
  if(refill&&start===0)while(pieces.length<=end)pieces.unshift({...create(),kind:'none'});
  for(let y=end;y>=start;y--){
   const cell=path[y]!,piece=pieces.pop();
   board[cell]=piece?.face??0;specials[cell]=piece?.kind??'none';ids[cell]=piece?.id??-1;
  }
  end=start-1;
 }
 return collected;
}
