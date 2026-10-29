import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {cpus,platform,release} from 'node:os';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {root,makeRegistry} from './registry.mjs';
const runId=`performance-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`,directory=resolve(root,'reports',runId);mkdirSync(directory);
const game=JSON.parse(readFileSync('specs/v0.1/games/realtime-constraint.game.json'));game.scenes[0].entities[0].components[0].config={statePath:'/world',width:16000,height:12000,maxObjects:128};game.state.world.initial.bodies=Array.from({length:128},(_,i)=>({id:'body_'+i,kind:'target',x:500+(i%16)*900,y:500+Math.floor(i/16)*1200,vx:0,vy:0,hx:100,hy:100,hp:1,team:2,value:1,fixed:false}));
writeFileSync(resolve(directory,'workload.game.json'),JSON.stringify(game,null,2)+'\n');
const runtime=new HeadlessRuntime(game,makeRegistry()),times=[];runtime.start();try{runtime.step(20);for(let i=0;i<180;i++){const start=performance.now();runtime.step(1);times.push(performance.now()-start);}}finally{runtime.dispose();}
const sorted=[...times].sort((a,b)=>a-b),p=q=>sorted[Math.ceil(q*sorted.length)-1],hash=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex'),files=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const receipt={format:'a2game-performance-profile',runId,status:'MEASURED',profile:'aabb-int-v1',environment:{node:process.version,platform:platform(),osRelease:release(),cpu:cpus()[0]?.model},workload:{bodies:128,warmupTicks:20,measuredTicks:180,gameSha256:sha256Canonical(game),mode:'Headless stable all-pairs; excludes rendering/GPU/browser'},milliseconds:{p50:p(0.5),p95:p(0.95),max:p(1)},referenceBudgetMs:1000/60,meetsReferenceBudget:p(0.95)<=1000/60,fingerprints:Object.fromEntries(['scripts/benchmark-profile.mjs','specs/v0.1/games/realtime-constraint.game.json',...files('src')].map(p=>[p,hash(p)]))};writeFileSync(resolve(directory,'summary.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt.milliseconds),receipt.meetsReferenceBudget,`reports/${runId}/summary.json`);
