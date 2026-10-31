/** Host-authored presentation derivative; original native model bytes remain immutable. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,parse} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {root,makeRegistry} from './registry.mjs';
import {createContentService} from './content-service.mjs';
import {playSolution} from './agent-solver.mjs';
import {executeG3Case} from './g3-playthrough.mjs';
import {HeadlessRuntime} from '../dist/index.js';
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function safe(input){if(input.split(/[\\/]/).includes('..'))throw Error('A2G_GEN_PATH');const p=resolve(input);if(p===parse(p).root)throw Error('A2G_GEN_PATH');for(let at=p;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw Error('A2G_GEN_PATH');if(at===dirname(at))break;}return p;}
const source=safe(process.argv[2]??resolve(root,'output/gen2-terra-addc99af-70e3-4dda-a88e-a10f5fe1bbf3-release'));
const output=safe(process.argv[3]??resolve(root,'output','gen2-terra-narrow-'+randomUUID()));
const recipePath=resolve(root,'project/gen2-terra-narrow-presentation.json');
try{
 assert.equal(existsSync(output),false,'目标目录必须不存在');
 const recipe=read(recipePath),sourceGame=resolve(source,'game.json'),before=read(sourceGame),game=structuredClone(before);
 assert.equal(hash(sourceGame),recipe.sourceGameSha256);game.presentation=recipe.presentation;game.meta.description=recipe.description;game.revision=before.revision+1;
 const logic=g=>Object.fromEntries(Object.entries(g).filter(([key])=>!['presentation','meta','revision'].includes(key)));
 assert.deepEqual(logic(game),logic(before));assert.deepEqual({...game.meta,description:before.meta.description},before.meta);
 const solution=read(resolve(source,'solution.json')),suite=read(resolve(source,'conformance.json'));
 const prior=playSolution(before,solution),after=playSolution(game,solution);assert.deepEqual(after,prior);
 const replay=g=>suite.cases.map(c=>{const runtime=new HeadlessRuntime(g,makeRegistry());try{return executeG3Case(c,{runtime,step:n=>runtime.step(n)});}finally{runtime.dispose();}});
 const originalCases=replay(before),cases=replay(game);assert.deepEqual(cases,originalCases);
 const release=await createContentService().release(JSON.stringify(game));
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output);mkdirSync(resolve(output,'tests'));
 const save=(name,value)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const artifacts={'game.json':game,'solution.json':solution,'conformance.json':suite,'release-receipt.json':release,'debug-bundle.json':{format:'a2game-debug-bundle',version:1,game,solution,provenance:{kind:'host-presentation-derivative',parent:'native-subagent gpt-6.1-terra medium'}},'tests/playability.json':after,'tests/conformance.json':{status:'PASS',cases}};
 for(const [name,value]of Object.entries(artifacts))save(name,value);
 const report={format:'a2game-generation-report',version:1,status:'PASS_REFERENCE',provenance:'HOST_PRESENTATION_DERIVATIVE',hostAssistance:'presentation and player-facing description only; revision incremented',parent:{gameSha256:hash(sourceGame),generationReportSha256:hash(resolve(source,'generation-report.json'))},recipe:{path:'project/gen2-terra-narrow-presentation.json',sha256:hash(recipePath)},generationCalls:0,additionalModelCalls:0,oneShot:null,gameplayUnchanged:true,stateHashParity:'PASS',conformanceParity:'PASS',G3:'NOT_RUN',artifacts:Object.fromEntries(Object.keys(artifacts).map(name=>[name,{path:name,sha256:hash(resolve(output,name))}]))};save('generation-report.json',report);
 assert.equal(hash(sourceGame),recipe.sourceGameSha256);console.log(JSON.stringify({status:'PASS_REFERENCE',outputDirectory:output,gameplayUnchanged:true,modelCalls:0}));
}catch(e){console.log(JSON.stringify({status:'FAIL',code:e.code??'A2G_PRESENTATION_REFINEMENT',message:'窄屏表现优化未完成，请检查原始产物、目标目录和完整准入结果后重试。',detail:String(e.message).slice(0,240)}));process.exitCode=1;}
