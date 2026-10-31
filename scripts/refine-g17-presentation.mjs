/** Reproducible host-only visual derivative of one immutable benchmark output. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,parse} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {root,makeRegistry} from './registry.mjs';
import {createContentService} from './content-service.mjs';
import {playSolution} from './agent-solver.mjs';
import {executeG3Case} from './g3-playthrough.mjs';
import {HeadlessRuntime} from '../dist/index.js';

const originalSha='ea3e3999e785f3540132b0b7a67f2d96174278920d6c8b30307089303b265e7b';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function safe(input){
 if(input.split(/[\\/]/).includes('..'))throw Error('A2G_GEN_PATH');
 const p=resolve(input);if(p===parse(p).root)throw Error('A2G_GEN_PATH');
 for(let at=p;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw Error('A2G_GEN_PATH');if(at===dirname(at))break;}
 return p;
}
const source=safe(process.argv[2]??resolve(root,'output/generator-benchmark-followup/2fb28428-443d-408e-86d5-df8d969dcbab/G17-game-plan'));
const output=safe(process.argv[3]??resolve(root,'output','g17-host-visual-'+randomUUID()));
try{
 assert.equal(existsSync(output),false,'目标目录必须不存在');
 const sourcePaths=['game.json','solution.json','conformance.json','generation-report.json'];
 const originalHashes=Object.fromEntries(sourcePaths.map(name=>[name,hash(resolve(source,name))]));
 const originalReport=read(resolve(source,'generation-report.json'));
 assert.equal(originalHashes['game.json'],originalSha);
 for(const name of sourcePaths.slice(0,3))assert.equal(originalHashes[name],originalReport.artifacts[name].sha256);
 const before=read(resolve(source,'game.json')),game=structuredClone(before);
 const nodes=game.presentation.scene2d.nodes;
 for(const id of ['result','failure']){const i=nodes.findIndex(node=>node.id===id);assert.ok(i>=0);nodes.splice(i,1);}
 assert.equal(nodes.length,before.presentation.scene2d.nodes.length-2);
 const duplicateHud=['objective','controls','timing','pause_help'];
 for(const id of duplicateHud)assert.ok(game.presentation.hud.some(item=>item.id===id));
 game.presentation.hud=game.presentation.hud.filter(item=>!duplicateHud.includes(item.id));game.revision++;
 for(const node of nodes.filter(node=>node.kind==='text')){assert.ok([0.5,0.6].includes(node.fontSize));node.fontSize=node.fontSize===0.5?0.65:0.72;}
 const lineY={title:4.8,goal:3.9,score_label:3,hp_label:3,score:2.25,hp:2.25,score_goal:1.5,movement:-3.95,host_help:-4.8};
 for(const [id,y] of Object.entries(lineY))nodes.find(node=>node.id===id).at[1]=y;
 const expected=structuredClone(before);expected.presentation.scene2d.nodes=expected.presentation.scene2d.nodes.filter(node=>!['result','failure'].includes(node.id));expected.presentation.hud=expected.presentation.hud.filter(item=>!duplicateHud.includes(item.id));
 for(const node of expected.presentation.scene2d.nodes.filter(node=>node.kind==='text')){node.fontSize=node.fontSize===0.5?0.65:0.72;if(Object.hasOwn(lineY,node.id))node.at[1]=lineY[node.id];}expected.revision++;
 assert.deepEqual(game,expected);
 const solution=read(resolve(source,'solution.json')),suite=read(resolve(source,'conformance.json'));
 const prior=playSolution(before,solution),after=playSolution(game,solution);assert.deepEqual(after,prior);
 const replay=definition=>suite.cases.map(c=>{const runtime=new HeadlessRuntime(definition,makeRegistry());try{return executeG3Case(c,{runtime,step:n=>runtime.step(n)});}finally{runtime.dispose();}});
 const cases=replay(game);assert.deepEqual(cases,replay(before));
 const release=await createContentService().release(JSON.stringify(game));
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output);mkdirSync(resolve(output,'tests'));
 const save=(name,value)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 save('game.json',game);
 for(const name of ['solution.json','conformance.json'])writeFileSync(resolve(output,name),readFileSync(resolve(source,name)),{flag:'wx'});
 save('release-receipt.json',release);save('tests/playability.json',after);save('tests/conformance.json',{status:'PASS',cases});
 save('debug-bundle.json',{format:'a2game-debug-bundle',version:1,game,solution,provenance:{kind:'host-presentation-derivative',parentGameSha256:originalSha}});
 const artifactNames=['game.json','solution.json','conformance.json','release-receipt.json','tests/playability.json','tests/conformance.json','debug-bundle.json'];
 save('generation-report.json',{format:'a2game-generation-report',version:1,status:'PASS_REFERENCE',provenance:'HOST_PRESENTATION_DERIVATIVE',hostAssistance:'Removed result and failure canvas text and duplicate HUD instructions, increased canvas text size and adjusted line positions; host status supplies terminal feedback. Revision incremented.',parent:originalHashes,generationCalls:0,additionalModelCalls:0,gameplayUnchanged:true,stateHashParity:'PASS',conformanceParity:'PASS',G3:'NOT_RUN',humanReview:'NOT_RUN',artifacts:Object.fromEntries(artifactNames.map(name=>[name,{path:name,sha256:hash(resolve(output,name))}]))});
 for(const name of sourcePaths)assert.equal(hash(resolve(source,name)),originalHashes[name]);
 console.log(JSON.stringify({status:'PASS_REFERENCE',outputDirectory:output,conformanceCases:cases.length,modelCalls:0}));
}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code??'A2G_PRESENTATION_REFINEMENT',message:String(error.message)}));process.exitCode=1;}
