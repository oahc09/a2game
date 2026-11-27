/** Independent, opt-in mechanics evidence. No author games, solvers or field-name heuristics. */
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {HeadlessRuntime,sha256Canonical} from '../dist/index.js';
import {makeRegistry,root} from './registry.mjs';
import {hostSourceFingerprint} from './host-source-fingerprint.mjs';
import {createContentService} from './content-service.mjs';
import {isPythonRuntimeError,requirePython} from './python-runtime.mjs';
import {publicDiagnostics} from '../generator/diagnostics.mjs';
export const illegalUndoContract=Object.freeze({
 format:'a2game-illegal-undo-check',version:1,profile:'grid-push-illegal-undo-v1',
 scope:'One direct a2game.puzzle.push@0.1.0 behavior in the entry scene, with configured undo/history. No prototype components or multi-behavior composition.',
 declaration:{required:['format','version','profile','sceneId','entityId','componentIndex','coreStatePaths','legalPrefix','illegalAction','illegalKind','undoAction'],coreStatePaths:'Exactly the four registered component paths: playerPath, boxesPath, movesPath, solvedPath. No omitted or extra paths.',legalPrefix:'1..128 directional action IDs; every step must be a geometrically legal move/push and change core state. Each action uses press then release then exactly one tick.',illegalKind:['blocked-move','blocked-push'],illegalAction:'A configured directional movement action that is geometrically illegal immediately after legalPrefix; unrelated no-op actions cannot qualify.',undoAction:'Must equal the selected component configured undoAction.'},
 assertions:['All prefix steps remain playing and change the registered core state.','Illegal movement leaves the entire observed game state, including undo history, and RNG unchanged; flow remains playing.','Undo restores the four registered core fields, history stack and RNG to immediately before the final legal prefix action; flow remains playing.'],
 exclusions:'Tick/event/pressed-input internals are not undo equality targets. This does not prove all illegal actions, dead corners, presentation, physical input or independent authoring.',
 usage:'node scripts/check-illegal-undo.mjs GAME.json mechanics.json [--require-blocked-push]; stdout JSON receipt. Controller must preserve this separate gate; MCP test_game alone does not run it.'
});
const keys=new Set(illegalUndoContract.declaration.required),directions=['left','right','up','down'];
const coreKeys=['playerPath','boxesPath','movesPath','solvedPath'];
const pointerPattern=/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/;
function problem(ruleId,message,jsonPointer='',unsupported=false){return Object.assign(Error(message),{code:'A2G_E_MECHANICS_ILLEGAL_UNDO',ruleId,jsonPointer,unsupported});}
function requireThat(ok,ruleId,message,pointer='',unsupported=false){if(!ok)throw problem(ruleId,message,pointer,unsupported);}
function field(object,pointer){
 requireThat(typeof pointer==='string'&&pointer.length<=256&&pointerPattern.test(pointer),'mechanics.state-path','State paths must be bounded, non-root JSON Pointers.','/coreStatePaths');
 let value=object;for(const key of pointer.slice(1).split('/').map(s=>s.replaceAll('~1','/').replaceAll('~0','~'))){requireThat(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),'mechanics.state-path','A declared state path is absent.','/coreStatePaths');value=value[key];}return value;
}
function select(game,d,registry){
 requireThat(d&&typeof d==='object'&&!Array.isArray(d)&&Object.keys(d).length===keys.size&&Object.keys(d).every(k=>keys.has(k)),'mechanics.declaration','Use the exact versioned declaration fields.','');
 requireThat(d.format===illegalUndoContract.format&&d.version===1&&d.profile===illegalUndoContract.profile,'mechanics.profile','Unsupported mechanics profile/version.','/profile',true);
 requireThat(d.sceneId===game.entryScene,'mechanics.scope','Only a direct behavior in the entry scene is supported.','/sceneId',true);
 const scene=game.scenes.find(s=>s.id===d.sceneId),entity=scene?.entities.find(e=>e.id===d.entityId);
 requireThat(scene&&entity&&Number.isInteger(d.componentIndex)&&d.componentIndex>=0,'mechanics.selector','Select an existing scene/entity/component.','/componentIndex');
 requireThat(scene.entities.every(e=>!e.prototype),'mechanics.scope','Prototype-based behavior selection is unsupported; no implicit merging or guessing.','/entityId',true);
 const behaviors=scene.entities.flatMap(e=>(e.components??[]).filter(c=>registry.get(c.capability).kind==='behavior'));
 const component=entity.components?.[d.componentIndex];
 requireThat(behaviors.length===1&&behaviors[0]===component&&component?.capability.id==='a2game.puzzle.push'&&component.capability.version==='0.1.0','mechanics.scope','Exactly one selected registered push behavior is required.','/componentIndex',true);
 const c=component.config,paths=coreKeys.map(k=>c[k]);
 requireThat(typeof c.historyPath==='string'&&typeof c.undoAction==='string','mechanics.scope','Selected push behavior must configure both historyPath and undoAction.','/undoAction',true);
 requireThat(Array.isArray(d.coreStatePaths)&&d.coreStatePaths.length===4&&new Set(paths).size===4&&isDeepStrictEqual([...d.coreStatePaths].sort(),[...paths].sort()),'mechanics.core-paths','Declare exactly the four registered push core paths; partial snapshots cannot pass.','/coreStatePaths');
 for(const path of [...paths,c.historyPath,c.wallsPath,c.goalsPath])field(Object.fromEntries(Object.entries(game.state).map(([k,v])=>[k,v.initial])),path);
 const actionIds=directions.map(dir=>c.actions[dir]);
 requireThat(new Set(actionIds).size===4&&!actionIds.includes(c.undoAction),'mechanics.actions','Movement actions and undo must be distinct.','/undoAction');
 requireThat(d.undoAction===c.undoAction&&game.inputs.actions.some(a=>a.id===d.undoAction&&a.valueType==='button'),'mechanics.undo-action','undoAction must bind the selected behavior real button action.','/undoAction');
 requireThat(Array.isArray(d.legalPrefix)&&d.legalPrefix.length>=1&&d.legalPrefix.length<=128&&d.legalPrefix.every(a=>actionIds.includes(a)),'mechanics.prefix','Provide 1..128 configured directional actions as the legal prefix.','/legalPrefix');
 requireThat(actionIds.includes(d.illegalAction)&&['blocked-move','blocked-push'].includes(d.illegalKind),'mechanics.illegal-action','Declare a real directional action and its expected blocked kind.','/illegalAction');
 requireThat(actionIds.every(id=>game.inputs.actions.some(a=>a.id===id&&a.valueType==='button')),'mechanics.actions','Movement actions must be registered button actions.','/legalPrefix');
 return {config:c,paths};
}
function geometry(state,c,action){
 const dir=directions.find(k=>c.actions[k]===action),width=c.width,cells=width*c.height,player=field(state,c.playerPath),walls=new Set(field(state,c.wallsPath)),boxes=field(state,c.boxesPath);
 const delta={left:-1,right:1,up:-width,down:width}[dir];
 const inside=(from,to)=>to>=0&&to<cells&&!(dir==='left'&&from%width===0)&&!(dir==='right'&&from%width===width-1);
 const target=player+delta;
 if(!inside(player,target)||walls.has(target))return 'blocked-move';
 if(boxes.includes(target)){const next=target+delta;if(!inside(target,next)||walls.has(next)||boxes.includes(next))return 'blocked-push';}
 return boxes.includes(target)?'legal-push':'legal-move';
}
export async function checkIllegalUndo(game,declaration,{requireBlockedPush=false,python}={}){
 const report={format:'a2game-illegal-undo-result',version:1,status:'NOT_REQUESTED',profile:illegalUndoContract.profile,gameSha256:null,declarationSha256:null,implementationSha256:hostSourceFingerprint(root),trace:[],checks:{legalPrefix:'NOT_RUN',illegalState:'NOT_RUN',undoCore:'NOT_RUN'},formalG3:'NOT_RUN',browserInputAndVisual:'NOT_RUN',independentAuthoring:'NOT_VERIFIED',scope:illegalUndoContract.scope};
 if(declaration===undefined)return report;
 let runtime;
 try{
  requireThat(typeof requireBlockedPush==='boolean','mechanics.controller-policy','Controller requireBlockedPush must be boolean.');
  const gameText=typeof game==='string'?game:JSON.stringify(game);requireThat(typeof gameText==='string'&&Buffer.byteLength(gameText)<=256*1024&&Buffer.byteLength(JSON.stringify(declaration))<=16*1024,'mechanics.input-budget','Game and mechanics declaration exceed bounded input limits.');if(typeof game==='string')game=JSON.parse(game);
  report.gameSha256=sha256Canonical(game);report.declarationSha256=sha256Canonical(declaration);report.requireBlockedPush=requireBlockedPush;
  // Full Schema/semantic/resource admission is authoritative, including duplicate/unsafe content checks in CLI.
  const registry=makeRegistry(),{config:c,paths}=select(game,declaration,registry);
  await createContentService({python}).release(gameText);
  runtime=new HeadlessRuntime(game,registry);runtime.start();
  const observe=()=>{
   const active=Object.values(runtime.snapshot().entities).flatMap(e=>e.components.map((component,index)=>({entityId:e.id,index,component}))).filter(x=>registry.get(x.component.capability).kind==='behavior');
   requireThat(active.length===1&&active[0].entityId===declaration.entityId&&active[0].index===declaration.componentIndex&&active[0].component.capability.id==='a2game.puzzle.push'&&active[0].component.capability.version==='0.1.0'&&isDeepStrictEqual(active[0].component.config,c),'mechanics.dynamic-scope','Runtime behavior composition changed outside this single-push profile.','/entityId',true);
   const o=runtime.observe();requireThat(o.flow.status==='playing','mechanics.playing','This check requires a nonterminal playing state at every boundary.');return o;};
  const core=o=>Object.fromEntries(paths.map(p=>[p,field(o.state,p)]));
  const topology=o=>({walls:field(o.state,c.wallsPath),goals:field(o.state,c.goalsPath)});
  const act=(action,phase)=>{runtime.injectAction({action,phase:'press'});runtime.injectAction({action,phase:'release'});runtime.step(1);const o=runtime.observe();report.trace.push({action,ticks:1,phase,expectedHash:o.exactHash,flowStatus:o.flow.status});return observe();};
  const initial=observe(),fixedTopology=topology(initial);report.initialHash=initial.exactHash;let beforeLast,beforeLastRng;
  for(const [index,action]of declaration.legalPrefix.entries()){
   const before=observe(),legalKind=geometry(before.state,c,action);requireThat(legalKind.startsWith('legal-'),'mechanics.prefix-legal','A declared legal prefix step is blocked.',`/legalPrefix/${index}`);
   beforeLast=before;beforeLastRng=runtime.snapshot().rng;const after=act(action,'legal-prefix');report.lastLegalActionKind=legalKind;
   requireThat(!isDeepStrictEqual(core(before),core(after)),'mechanics.prefix-changed','Every legal prefix action must actually change registered core state.',`/legalPrefix/${index}`);
   requireThat(isDeepStrictEqual(topology(after),fixedTopology),'mechanics.topology','Walls/goals must stay fixed for this scoped mechanics profile.');
  }
  report.checks.legalPrefix='PASS_REFERENCE';report.legalPrefixLength=declaration.legalPrefix.length;
  const beforeIllegal=observe(),beforeIllegalRng=runtime.snapshot().rng,kind=geometry(beforeIllegal.state,c,declaration.illegalAction);
  requireThat(!kind.startsWith('legal-')&&kind===declaration.illegalKind,'mechanics.illegal-kind','Declared illegal action/kind must be geometrically blocked, not an unrelated no-op.','/illegalAction');
  requireThat(!requireBlockedPush||kind==='blocked-push','mechanics.blocked-push-required','Controller policy requires a blocked box push, not only a blocked walk.','/illegalKind');
  const afterIllegal=act(declaration.illegalAction,'illegal');
  requireThat(isDeepStrictEqual(beforeIllegal.state,afterIllegal.state)&&isDeepStrictEqual(beforeIllegalRng,runtime.snapshot().rng),'mechanics.illegal-atomic','Illegal action must preserve the entire observed state, including history, and RNG.','/illegalAction');
  report.checks.illegalState='PASS_REFERENCE';report.observedIllegalKind=kind;
  const afterUndo=act(declaration.undoAction,'undo');
  requireThat(isDeepStrictEqual(core(afterUndo),core(beforeLast))&&isDeepStrictEqual(field(afterUndo.state,c.historyPath),field(beforeLast.state,c.historyPath))&&isDeepStrictEqual(runtime.snapshot().rng,beforeLastRng),'mechanics.undo-restore','Undo must restore core fields, history and RNG to before the final legal action, skipping the illegal action.','/undoAction');
  requireThat(isDeepStrictEqual(topology(afterUndo),fixedTopology),'mechanics.topology','Undo must preserve fixed walls/goals.','/undoAction');
  report.checks.undoCore='PASS_REFERENCE';report.status='PASS_REFERENCE';
  report.binding={sceneId:declaration.sceneId,entityId:declaration.entityId,componentIndex:declaration.componentIndex,capabilityId:'a2game.puzzle.push',coreStatePaths:paths,historyPath:c.historyPath};
  report.observationHashes={beforeLast:beforeLast.exactHash,beforeIllegal:beforeIllegal.exactHash,afterIllegal:afterIllegal.exactHash,afterUndo:afterUndo.exactHash};
 }catch(error){
  report.status=error.unsupported?'UNSUPPORTED':'FAIL';
  report.diagnostics=error.ruleId?[{code:error.code,stage:'conformance',ruleId:error.ruleId,jsonPointer:error.jsonPointer,message:error.message,repairHint:'Correct the declared trace or game under the fixed profile; do not remove core fields, substitute no-op actions, or weaken the controller policy.'}]:publicDiagnostics(error);
 }finally{
  runtime?.dispose();
  try{report.implementationSha256After=hostSourceFingerprint(root);if(report.implementationSha256After!==report.implementationSha256){report.status='FAIL';(report.diagnostics??=[]).push({code:'A2G_E_MECHANICS_SOURCE_CHANGED',stage:'infra',message:'Implementation bytes changed during verification; freeze the source and rerun.'});}}
  catch{report.status='FAIL';(report.diagnostics??=[]).push({code:'A2G_E_MECHANICS_SOURCE_CHANGED',stage:'infra',message:'Implementation identity could not be rechecked.'});}
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);if(args.length<2||args.length>3||args[2]&&args[2]!=='--require-blocked-push')throw Error('Usage: node scripts/check-illegal-undo.mjs GAME.json mechanics.json [--require-blocked-push]');
  const read=p=>{const bytes=readFileSync(p);if(bytes.length>256*1024)throw Error('Input exceeds 256 KiB');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);};
  const gameText=read(args[0]),declarationText=read(args[1]);
  const python=requirePython(undefined,{schema:true});
  const parsed=spawnSync(python,[resolve(root,'scripts/parse-agent-output.py')],{input:JSON.stringify({text:declarationText}),encoding:'utf8',timeout:8000,maxBuffer:1024*1024});
  if(parsed.status!==0||JSON.parse(parsed.stdout).status!=='PASS')throw Error('Declaration JSON is not strict');
  // Retain original game bytes for full admission; mechanics duplicate keys are rejected above.
  const result=await checkIllegalUndo(gameText,JSON.parse(declarationText),{requireBlockedPush:args[2]==='--require-blocked-push',python});console.log(JSON.stringify(result,null,2));if(result.status!=='PASS_REFERENCE')process.exitCode=1;
 }catch(e){console.error(isPythonRuntimeError(e)?`${e.code}: ${e.message}`:'A2G_E_MECHANICS_INPUT: provide bounded JSON files and supported controller flags.');process.exitCode=2;}
}
