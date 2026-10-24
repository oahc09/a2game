import {HeadlessRuntime} from './runtime.js';
import {CapabilityRegistry} from './registry.js';
import {replayNormalizedInputTrace} from './input-trace.js';
import {sha256Canonical} from './exact-hash.js';
import {capabilityManifestDigest} from './content-release.js';
import {isRecord,validateJsonTree,clone} from './utils.js';
import {fail} from './errors.js';
import type {GameDefinition,Json,JsonRecord} from './types.js';
export const REPLAY_SAVE_PROFILE='a2game-reference-replay-v2';
export interface ReplaySave {
 format:'a2game-replay-save';saveVersion:2;runtimeProfile:typeof REPLAY_SAVE_PROFILE;
 gameSha256:string;manifestDigest:string;payload:{trace:Json};finalHash:string;checksum:string;
}
export interface TrustedSaveMigration {
 id:string;fromGameSha256:string;fromManifestDigest:string;toGameSha256:string;toManifestDigest:string;
 /** Application code only. Never deserialize this function from a save or GameSpec. */
 migrateTrace:(trace:Json)=>Json;
}
const digest=(value:unknown)=>sha256Canonical(value as Json);
function error(message:string):never{return fail('A2G_E_SAVE_COMPATIBILITY',message);}
function checkedTrace(trace:unknown):asserts trace is Json{
 validateJsonTree(trace);if(!isRecord(trace)||!Array.isArray(trace.events)||trace.events.length>4096||trace.events.some(e=>!isRecord(e)||!Number.isSafeInteger(e.tickIndex)||Number(e.tickIndex)<0||Number(e.tickIndex)>3600))error('Replay save exceeds its 4096-event/3600-Tick reference budget');
}
function seal(value:Omit<ReplaySave,'checksum'>):ReplaySave{return {...value,checksum:digest(value)};}
function verifyEnvelope(raw:unknown):JsonRecord{
 validateJsonTree(raw);if(new TextEncoder().encode(JSON.stringify(raw)).length>1024*1024||!isRecord(raw))error('Invalid or oversized replay save');
 const allowed=raw.saveVersion===1?['format','saveVersion','gameSha256','manifestDigest','inputTrace','finalHash','checksum']:['format','saveVersion','runtimeProfile','gameSha256','manifestDigest','payload','finalHash','checksum'];
 if(raw.format!=='a2game-replay-save'||(raw.saveVersion!==1&&raw.saveVersion!==2)||Object.keys(raw).some(key=>!allowed.includes(key))||allowed.some(key=>!Object.hasOwn(raw,key)))error('Unsupported save envelope');
 const {checksum,...body}=raw;if(typeof checksum!=='string'||digest(body)!==checksum||!['gameSha256','manifestDigest','finalHash'].every(key=>typeof raw[key]==='string'&&/^[a-f0-9]{64}$/.test(raw[key] as string)))error('Save checksum or identity differs');
 if(raw.saveVersion===2&&(raw.runtimeProfile!==REPLAY_SAVE_PROFILE||!isRecord(raw.payload)||Object.keys(raw.payload).length!==1||!Object.hasOwn(raw.payload,'trace')))error('Unsupported replay runtime profile');
 return raw as JsonRecord;
}
/** Reconstructs through public Runtime input APIs. Untrusted snapshots never enter restore(). */
export function openReplaySave(game:GameDefinition,makeRegistry:()=>CapabilityRegistry,raw:unknown,migrations:readonly TrustedSaveMigration[]=[]):{runtime:HeadlessRuntime;receipt:{status:'PASS';migrated:boolean;migration:string|null;finalHash:string;saveVersion:2}}{
 const envelope=verifyEnvelope(raw),registry=makeRegistry(),targetGame=digest(game),targetManifests=capabilityManifestDigest(registry.list());let trace=envelope.saveVersion===1?envelope.inputTrace:(envelope.payload as JsonRecord).trace,migration:TrustedSaveMigration|undefined;
 if(envelope.gameSha256!==targetGame||envelope.manifestDigest!==targetManifests){
  const matches=migrations.filter(m=>m.fromGameSha256===envelope.gameSha256&&m.fromManifestDigest===envelope.manifestDigest&&m.toGameSha256===targetGame&&m.toManifestDigest===targetManifests);if(matches.length!==1)error('No unambiguous trusted migration for this exact game/capability pair');migration=matches[0];if(typeof migration!.id!=='string'||!migration!.id||typeof migration!.migrateTrace!=='function')error('Invalid trusted migration');trace=migration!.migrateTrace(clone(trace as Json));
 }
 checkedTrace(trace);const runtime=new HeadlessRuntime(game,registry);
 try{const result=replayNormalizedInputTrace(runtime,trace);if(!migration&&result.finalHash!==envelope.finalHash)error('Replayed state differs from save hash');return {runtime,receipt:{status:'PASS',migrated:envelope.saveVersion===1||Boolean(migration),migration:migration?.id??(envelope.saveVersion===1?'envelope-v1-to-v2':null),finalHash:result.finalHash,saveVersion:2}};}catch(e){runtime.dispose();throw e;}
}
/** Opt-in normalized Trace archive, deterministic and without wall-clock or device acquisition. */
export function createReplaySave(game:GameDefinition,makeRegistry:()=>CapabilityRegistry,trace:unknown):ReplaySave{
 checkedTrace(trace);const registry=makeRegistry(),manifestDigest=capabilityManifestDigest(registry.list()),runtime=new HeadlessRuntime(game,registry);
 try{const result=replayNormalizedInputTrace(runtime,trace);return seal({format:'a2game-replay-save',saveVersion:2,runtimeProfile:REPLAY_SAVE_PROFILE,gameSha256:digest(game),manifestDigest,payload:{trace:clone(trace)},finalHash:result.finalHash});}finally{runtime.dispose();}
}
/** Explicit archive-envelope conversion; not a promise that arbitrary old gameplay remains compatible. */
export function upgradeReplaySaveEnvelope(raw:unknown):ReplaySave{
 const value=verifyEnvelope(raw);if(value.saveVersion===2)return clone(value) as unknown as ReplaySave;checkedTrace(value.inputTrace);return seal({format:'a2game-replay-save',saveVersion:2,runtimeProfile:REPLAY_SAVE_PROFILE,gameSha256:String(value.gameSha256),manifestDigest:String(value.manifestDigest),payload:{trace:clone(value.inputTrace as Json)},finalHash:String(value.finalHash)});
}
