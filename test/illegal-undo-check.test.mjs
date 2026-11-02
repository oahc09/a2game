import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createFixture} from '../generator/fixture.mjs';
import {checkIllegalUndo} from '../scripts/check-illegal-undo.mjs';
import {root} from '../scripts/registry.mjs';
// Purpose-built synthetic board, not any Gxx/Hxx game, Pilot candidate or winning trace.
function synthetic(){
 const game=createFixture().game;game.id='org.a2game.test.illegal-undo';
 game.requires.all.push({id:'a2game.puzzle.push',version:'0.1.0'});
 const cfg={width:5,height:5,wallsPath:'/barriers',goalsPath:'/targets',boxesPath:'/crates',playerPath:'/avatar',movesPath:'/turns',solvedPath:'/done',historyPath:'/trail',undoAction:'rewind',actions:{left:'west',right:'east',up:'north',down:'south'}};
 game.state={barriers:{type:'array',initial:[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24]},targets:{type:'array',initial:[18]},crates:{type:'array',initial:[7]},avatar:{type:'int',initial:11},turns:{type:'int',initial:0},done:{type:'bool',initial:false},trail:{type:'array',initial:[]}};
 game.scenes=[{id:'main',entities:[{id:'mechanism',components:[{capability:{id:'a2game.puzzle.push',version:'0.1.0'},config:cfg}]}]}];
 game.rules=[];game.outcomes=[{id:'complete',status:'won',priority:0,when:{state:'/done'}}];
 game.inputs.actions=['west','east','north','south','rewind','unrelated'].map((id,index)=>({id,valueType:'button',policy:'first-ready',bindings:[{source:'keyboard.button',config:{code:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyZ','KeyX'][index]}}]}));
 game.presentation={hud:[],cues:[],scene2d:{width:5,height:5,background:'#102030',nodes:[{id:'label',kind:'text',at:[0,0],fill:'#ffffff',fontSize:0.3,text:{literal:'Synthetic mechanics check'}}]}};
 const declaration={format:'a2game-illegal-undo-check',version:1,profile:'grid-push-illegal-undo-v1',sceneId:'main',entityId:'mechanism',componentIndex:0,coreStatePaths:['/avatar','/crates','/turns','/done'],legalPrefix:['east'],illegalAction:'north',illegalKind:'blocked-push',undoAction:'rewind'};
 return {game,declaration,cfg};
}
const run=({game,declaration},options={requireBlockedPush:true})=>checkIllegalUndo(game,declaration,options);
test('declared single push profile independently proves legal, blocked push, full-state atomicity and undo',async()=>{
 const result=await run(synthetic());assert.equal(result.status,'PASS_REFERENCE',JSON.stringify(result));assert.equal(result.observedIllegalKind,'blocked-push');assert.equal(result.lastLegalActionKind,'legal-move');
 assert.deepEqual(result.trace.map(r=>r.phase),['legal-prefix','illegal','undo']);assert.ok(result.trace.every(r=>r.ticks===1&&r.flowStatus==='playing'&&/^[0-9a-f]{64}$/.test(r.expectedHash)));assert.equal(result.formalG3,'NOT_RUN');assert.equal(result.implementationSha256After,result.implementationSha256);
});
test('no declaration never invents PASS; custom undo and unsupported behavior are explicitly unsupported',async()=>{
 assert.equal((await checkIllegalUndo(createFixture().game)).status,'NOT_REQUESTED');
 const custom=synthetic();delete custom.cfg.historyPath;delete custom.cfg.undoAction;assert.equal((await run(custom)).status,'UNSUPPORTED');
 const multiple=synthetic();multiple.game.scenes[0].entities[0].components.push(structuredClone(multiple.game.scenes[0].entities[0].components[0]));assert.equal((await run(multiple)).status,'UNSUPPORTED');
 const other=synthetic();other.declaration.profile='arbitrary-custom-undo';assert.equal((await run(other)).status,'UNSUPPORTED');
});
test('missing core paths, unrelated no-op, blocked prefix and falsely labelled illegal movement cannot pass',async()=>{
 for(const mutate of [
  x=>x.declaration.coreStatePaths.pop(),
  x=>x.declaration.illegalAction='unrelated',
  x=>x.declaration.legalPrefix=['west'],
  x=>x.declaration.illegalAction='south',
  x=>x.declaration.undoAction='unrelated',
  x=>x.declaration.coreStatePaths=['/barriers','/targets','/trail','/turns']
 ]){const f=synthetic();mutate(f);assert.notEqual((await run(f)).status,'PASS_REFERENCE');}
});
test('blocked walk is classified separately and cannot satisfy required blocked box push',async()=>{
 const f=synthetic();f.declaration.legalPrefix=['south'];f.declaration.illegalAction='west';f.declaration.illegalKind='blocked-move';
 const generic=await run(f,{requireBlockedPush:false});assert.equal(generic.status,'PASS_REFERENCE',JSON.stringify(generic));assert.equal(generic.observedIllegalKind,'blocked-move');
 const strict=await run(f);assert.equal(strict.status,'FAIL');assert.equal(strict.diagnostics[0].ruleId,'mechanics.blocked-push-required');
});
test('illegal action changing any observed state cannot pass even when declared core appears unchanged',async()=>{
 const f=synthetic();f.game.state.hiddenCounter={type:'int',initial:0};f.game.rules=[{id:'bad-illegal-counter',priority:0,on:{type:'input.action',action:'north',edge:'press'},do:[{op:'state.add',path:'/hiddenCounter',value:1}]}];
 const result=await run(f);assert.equal(result.status,'FAIL',JSON.stringify(result));assert.equal(result.diagnostics[0].ruleId,'mechanics.illegal-atomic');assert.equal(result.trace.length,2);
});
test('broken undo core restore is detected rather than trusting a declared undo action or case name',async()=>{
 const f=synthetic();f.game.rules=[{id:'bad-undo',priority:0,on:{type:'input.action',action:'rewind',edge:'press'},do:[{op:'state.add',path:'/turns',value:7}]}];
 const result=await run(f);assert.equal(result.status,'FAIL',JSON.stringify(result));assert.equal(result.diagnostics[0].ruleId,'mechanics.undo-restore');assert.equal(result.trace.length,3);
});
test('raw game duplicate keys and CLI mechanics duplicates are rejected without losing original bytes',async t=>{
 const f=synthetic(),raw=JSON.stringify(f.game).replace('"format":"a2game"','"format":"a2game","format":"a2game"');
 assert.equal((await checkIllegalUndo(raw,f.declaration,{requireBlockedPush:true})).status,'FAIL');
 const dir=mkdtempSync(join(tmpdir(),'a2game-illegal-undo-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const game=join(dir,'game.json'),mechanics=join(dir,'mechanics.json');writeFileSync(game,JSON.stringify(f.game));writeFileSync(mechanics,JSON.stringify(f.declaration).replace('"version":1','"version":1,"version":1'));
 const cli=spawnSync(process.execPath,['scripts/check-illegal-undo.mjs',game,mechanics,'--require-blocked-push'],{cwd:root,encoding:'utf8'});assert.equal(cli.status,2);assert.match(cli.stderr,/A2G_E_MECHANICS_INPUT/);
});


test('standalone CLI accepts a valid strict declaration and emits complete executable trace evidence',t=>{
 const f=synthetic(),dir=mkdtempSync(join(tmpdir(),'a2game-illegal-undo-valid-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const game=join(dir,'game.json'),mechanics=join(dir,'mechanics.json');writeFileSync(game,JSON.stringify(f.game));writeFileSync(mechanics,JSON.stringify(f.declaration));
 const cli=spawnSync(process.execPath,['scripts/check-illegal-undo.mjs',game,mechanics,'--require-blocked-push'],{cwd:root,encoding:'utf8',timeout:20000});assert.equal(cli.status,0,cli.stderr+cli.stdout);const result=JSON.parse(cli.stdout);assert.equal(result.status,'PASS_REFERENCE');assert.equal(result.trace.length,3);assert.equal(result.observedIllegalKind,'blocked-push');assert.equal(result.requireBlockedPush,true);assert.equal(result.implementationSha256After,result.implementationSha256);
});

test('dynamically spawned second behavior is unsupported rather than passing static selector scope',async()=>{
 const f=synthetic();
 f.game.requires.all.push({id:'a2game.rules.entity-spawn',version:'0.1.0'});
 f.game.prototypes={extra:{components:[structuredClone(f.game.scenes[0].entities[0].components[0])]}};
 f.game.rules=[{id:'spawn-extra',priority:0,on:{type:'input.action',action:'east',edge:'press'},do:[{op:'entity.spawn',prototype:'extra',id:'spawned-extra'}]}];
 const result=await run(f);assert.equal(result.status,'UNSUPPORTED',JSON.stringify(result));assert.equal(result.diagnostics[0].ruleId,'mechanics.dynamic-scope');
});
