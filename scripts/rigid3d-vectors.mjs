/** Locked-profile vectors used by the Node-major compatibility matrix. */
import fs from 'node:fs';import {HeadlessRuntime} from '../dist/index.js';import {makeRegistry} from './registry.mjs';
const rows=JSON.parse(fs.readFileSync('project/game-candidates.json')).cases.filter(r=>['G15','G28'].includes(r.id)),vectors=[];
for(const row of rows)for(const kind of ['steps','negative']){const game=JSON.parse(fs.readFileSync('specs/v0.1/samples/games/'+row.name+'.game.json')),r=new HeadlessRuntime(game,makeRegistry());r.start();try{for(const step of row[kind]){if(step.action){r.injectAction({action:step.action,phase:'press',...(step.value===undefined?{}:{value:step.value})});r.injectAction({action:step.action,phase:'release'});}r.step(step.ticks??1);}vectors.push({id:row.id,kind,hash:r.observe().exactHash,status:r.status});}finally{r.dispose();}}
process.stdout.write(JSON.stringify(vectors));
