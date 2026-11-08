import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HeadlessRuntime} from '../dist/index.js';
import {makeRegistry} from '../scripts/registry.mjs';
import {publicDiagnostics} from '../generator/diagnostics.mjs';
import {queryCapabilities} from '../generator/catalog.mjs';
import {createMcpService} from '../integrations/mcp/service.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../specs/v0.1/games/'+name+'.game.json',import.meta.url)));
const failure=g=>{try{const r=new HeadlessRuntime(g,makeRegistry());r.dispose();assert.fail('Expected rejection');}catch(e){assert.equal(e.code,'A2G_E_CAP_CONFIG');return publicDiagnostics(e)[0];}};
const defense=g=>g.scenes[0].entities[0].components.find(c=>c.capability.id==='a2game.strategy.tower-defense');
test('mechanism state diagnostics identify exact authored fields without changing nullable puzzle defaults',()=>{
 let g=load('puzzle-match');g.state.puzzle.initial.selected='PRIVATE_SENTINEL';let d=failure(g);assert.equal(d.ruleId,'puzzle.selected-array');assert.equal(d.jsonPointer,'/state/puzzle/initial/selected');assert.equal(d.expected,'array');assert.equal(d.capabilityId,'a2game.puzzle.swap');assert.match(d.repairHint,/selected/);
 for(const board of [undefined,[1]]){g=load('puzzle-match');if(board===undefined)delete g.state.puzzle.initial.board;else g.state.puzzle.initial.board=board;d=failure(g);assert.equal(d.ruleId,'puzzle.board-dimensions');assert.equal(d.jsonPointer,'/state/puzzle/initial/board');assert.equal(d.expected,9);}
 g=load('puzzle-match');g.state.puzzle.initial.selected=null;const r=new HeadlessRuntime(g,makeRegistry());r.dispose();
 for(const field of ['wallet','lives','towers','won']){g=load('g21-candidate');const key=defense(g).config.statePath.slice(1);delete g.state[key].initial[field];d=failure(g);assert.equal(d.ruleId,'defense.required-state');assert.equal(d.jsonPointer,`/state/${key}/initial/${field}`);assert.equal(d.capabilityId,'a2game.strategy.tower-defense');assert.match(d.repairHint,/wallet/);}
});
test('defense command bounds point at actual component, including prototype declarations',()=>{
 let g=load('g21-candidate');const c=defense(g);c.config.actions[0].index=c.config.cells.length;let d=failure(g);assert.equal(d.ruleId,'defense.action-index');assert.equal(d.jsonPointer,'/scenes/0/entities/0/components/0/config/actions/0/index');assert.equal(d.expected,c.config.cells.length-1);
 g.prototypes={fixture:{components:[c]}};g.scenes[0].entities[0].components=[];g.scenes[0].entities[0].prototype='fixture';d=failure(g);assert.equal(d.jsonPointer,'/prototypes/fixture/components/0/config/actions/0/index');
});
test('visual dependency diagnostics identify declaration and static repair',()=>{
 for(const [id,rule] of [['a2game.visual.scene2d','presentation.scene2d-dependency'],['a2game.visual.body-style','presentation.body-style-dependency']]){const g=load('g21-candidate');g.requires.all=g.requires.all.filter(c=>c.id!==id);if(id.endsWith('body-style'))g.presentation.scene2d.bodyLayer.circleKinds=['actor'];let error;try{new HeadlessRuntime(g,makeRegistry());}catch(e){error=e;}assert.ok(error);const d=publicDiagnostics(error)[0];assert.equal(d.ruleId,rule);assert.equal(d.capabilityId,id);assert.equal(d.jsonPointer,'/requires/all');assert.match(d.repairHint,/requires\.all/);}
});
test('static mechanism hints never echo exception messages, stack, provider bodies or supplied repair text',()=>{
 const secret='PRIVATE_SENTINEL /home/private/token.txt Bearer abc';const d=publicDiagnostics({code:'A2G_E_CAP_CONFIG',message:secret,stack:secret,providerBody:secret,info:{ruleId:'puzzle.selected-array',jsonPointer:'/state/puzzle/initial/selected',capabilityId:'a2game.puzzle.swap',expected:'array',actual:secret,repairHint:secret,detail:secret}})[0];assert.match(d.repairHint,/selected/);assert.ok(!JSON.stringify(d).includes('PRIVATE_SENTINEL'));assert.ok(!JSON.stringify(d).includes('/home/'));
 const unknown=publicDiagnostics({code:'A2G_E_CAP_CONFIG',info:{ruleId:'provider.injected',repairHint:secret}})[0];assert.ok(!JSON.stringify(unknown).includes('PRIVATE_SENTINEL'));
});
test('catalog query parameter faults project argument-stage guidance with exact paging bounds',()=>{
 const error=Object.assign(Error('能力查询参数超出范围。'),{code:'A2G_GEN_CATALOG_QUERY',diagnostics:[{pointer:'',message:'能力查询参数超出范围。'}]});
 const d=publicDiagnostics(error)[0];
 assert.equal(d.stage,'arguments');
 assert.match(d.repairHint,/limit 1\.\.20/);
 assert.match(d.repairHint,/offset/);
 assert.ok(!/state path/.test(d.repairHint));
 let thrown;try{queryCapabilities({limit:21});}catch(e){thrown=e;}
 assert.equal(thrown?.code,'A2G_GEN_CATALOG_QUERY');
 assert.equal(queryCapabilities({limit:20}).capabilities.length,20);
});
test('actual no-provider MCP service preserves safe mechanism diagnostics in both envelope locations',async()=>{
 const service=createMcpService();try{const g=load('puzzle-match');g.state.puzzle.initial.selected='PRIVATE_SENTINEL';const result=await service.call('a2game.validate_game',{gameJson:JSON.stringify(g)});assert.equal(result.status,'FAIL');assert.deepEqual(result.data.diagnostics,result.diagnostics);const d=result.diagnostics[0];assert.equal(d.ruleId,'puzzle.selected-array');assert.equal(d.jsonPointer,'/state/puzzle/initial/selected');assert.match(d.repairHint,/selected/);assert.ok(!JSON.stringify(result.diagnostics).includes('PRIVATE_SENTINEL'));for(const [name,mutate,rule] of [
 ['puzzle-match',game=>{delete game.state.puzzle.initial.board;},'puzzle.board-dimensions'],
 ['g21-candidate',game=>{delete game.state[defense(game).config.statePath.slice(1)].initial.wallet;},'defense.required-state'],
 ['g21-candidate',game=>{defense(game).config.actions[0].index=defense(game).config.cells.length;},'defense.action-index'],
 ['g21-candidate',game=>{game.requires.all=game.requires.all.filter(c=>c.id!=='a2game.visual.scene2d');},'presentation.scene2d-dependency'],
 ['g21-candidate',game=>{game.requires.all=game.requires.all.filter(c=>c.id!=='a2game.visual.body-style');game.presentation.scene2d.bodyLayer.circleKinds=['actor'];},'presentation.body-style-dependency']
 ]){const game=load(name);mutate(game);const result=await service.call('a2game.validate_game',{gameJson:JSON.stringify(game)});assert.equal(result.status,'FAIL');assert.deepEqual(result.data.diagnostics,result.diagnostics);assert.equal(result.diagnostics[0].ruleId,rule);assert.ok(result.diagnostics[0].repairHint.length<=500);}
 assert.equal(service.stats().budgetConsumed,0);}finally{await service.close();}
});

test('runtime-only defense errors leave authored JSON location unknown rather than fabricating an initial-state pointer',async()=>{
 const {defenseImplementation}=await import('../dist/modules/tower-defense.js');const g=load('g21-candidate'),config=defense(g).config;config.actions[0].index=config.cells.length;let error;try{defenseImplementation.simulate({config});}catch(e){error=e;}const d=publicDiagnostics(error)[0];assert.equal(d.ruleId,'defense.action-index');assert.equal(d.jsonPointer,undefined);assert.equal(d.capabilityId,'a2game.strategy.tower-defense');
});
