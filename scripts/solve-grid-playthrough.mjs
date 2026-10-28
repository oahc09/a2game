/** Bounded host search over public Runtime transitions. It does not implement grid movement or load authored traces. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {HeadlessRuntime} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
export function solveGrid(game,{maxMoves=1600,maxNodes=120000,timeoutMs=180000,depth=2}={}){
 assert.ok(Number.isInteger(maxMoves)&&maxMoves>0&&maxMoves<=2048&&Number.isInteger(maxNodes)&&maxNodes>0&&maxNodes<=250000&&timeoutMs>0&&timeoutMs<=300000&&[1,2,3].includes(depth));
 const component=game.scenes.flatMap(s=>s.entities.flatMap(e=>e.components??[])).find(c=>c.capability.id==='a2game.puzzle.slide');assert.ok(component,'需要已声明的共享滑动合并模块。');
 const {width,height,boardPath}=component.config,choices=Object.entries(component.config.actions).map(([direction,action])=>({direction,action}));assert.equal(choices.length,4);
 const runtime=new HeadlessRuntime(game,makeRegistry()),started=performance.now(),actions=[];let nodes=0,committed,failure;
 const board=s=>boardPath.slice(1).split('/').reduce((v,k)=>v[k],s.state);
 function value(s){const b=board(s);let snake=0;for(let variant=0;variant<4;variant++){let score=0;for(let n=0;n<b.length;n++){let x=n%width,y=Math.floor(n/width);if(y%2)x=width-1-x;if(variant&1)x=width-1-x;if(variant&2)y=height-1-y;score+=b[y*width+x]*Math.pow(.35,n);}snake=Math.max(snake,score);}return snake*8+b.filter(n=>n===0).length*200;}
 function advance(snapshot,action){if(++nodes>maxNodes||performance.now()-started>timeoutMs)throw Object.assign(Error('搜索预算耗尽，不代表关卡无解。'),{code:'A2G_E_SEARCH_BUDGET'});runtime.restore(snapshot);runtime.injectAction({action,phase:'press'});runtime.injectAction({action,phase:'release'});runtime.step(1);const next=runtime.snapshot();return JSON.stringify(board(next))===JSON.stringify(board(snapshot))?null:next;}
 function search(snapshot,left){if(snapshot.status==='won')return 1e12;if(snapshot.status!=='playing')return -1e12;if(!left)return value(snapshot);let best=-1e12;for(const c of choices){const next=advance(snapshot,c.action);if(next)best=Math.max(best,search(next,left-1));}return best;}
 runtime.start();committed=runtime.snapshot();try{try{while(runtime.status==='playing'&&actions.length<maxMoves){const before=runtime.snapshot();let selected,best=-Infinity;for(const c of choices){const next=advance(before,c.action);if(!next)continue;const score=search(next,depth-1);if(score>best){best=score;selected={...c,next};}}if(!selected){runtime.restore(before);break;}actions.push(selected.action);runtime.restore(selected.next);committed=selected.next;if(actions.length%100===0)console.log('GRID_SEARCH',actions.length,Math.max(...board(selected.next)));}}catch(e){if(e.code!=='A2G_E_SEARCH_BUDGET')throw e;failure=e.message;runtime.restore(committed);}
  const final=runtime.observe();return {format:'a2game-runtime-grid-search',version:1,status:final.flow.status==='won'?'SOLVED':'BUDGET_EXHAUSTED',scope:'Host Runtime search on this independently generated definition; no authored GameSpec or solution consumed, not model self-solve or formal G3.',actions,final,nodes,elapsedMs:performance.now()-started,...(failure?{failure}:{})};
 }finally{runtime.dispose();}
}
if(process.argv[1]===import.meta.filename){const output=JSON.parse(readFileSync(resolve(root,process.argv[2]),'utf8')),result=solveGrid(output.game??output,{timeoutMs:300000});writeFileSync(resolve(root,process.argv[3]),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,moves:result.actions.length,nodes:result.nodes,elapsedMs:result.elapsedMs}));if(result.status!=='SOLVED')process.exitCode=1;}
