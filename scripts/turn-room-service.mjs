/** Public-information, local two-seat turn profile. One shared server Runtime; no client Tick authority. */
import {randomUUID} from 'node:crypto';
import {HeadlessRuntime,projectPresentation,sha256Canonical} from '../dist/index.js';
import {makeRegistry} from './registry.mjs';
export class RoomError extends Error{constructor(code,message,statusCode=409){super(message);Object.assign(this,{code,statusCode,stage:'room'});}}
const reject=(code,message,status=409)=>{throw new RoomError(code,message,status);};
const exactKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
function assertProfile(game){
 const components=game.scenes.flatMap(s=>s.entities.flatMap(e=>e.components??[])),turn=components[0],initial=game.state.turn?.initial;
 if(game.scenes.length!==1||components.length!==1||turn?.capability.id!=='a2game.turnbased.turn'||turn.config.players!==2||turn.config.statePath!=='/turn'||turn.config.endTurnAction||Object.keys(game.state).length!==1||!exactKeys(initial,['board','player','moves','winner','draw'])||initial.player!==1||initial.moves!==0||initial.winner!==0||initial.draw!==false||!initial.board.every(n=>n===0)||game.rules.length||Object.keys(game.prototypes??{}).length||Object.keys(game.assets??{}).length||game.presentation.stage||game.inputs.actions.some(a=>a.valueType!=='button'||!turn.config.selectActions.includes(a.id)))reject('A2G_E_ROOM_PROFILE','此网络参考只接受空棋盘、公开状态、双人落子和无额外规则/资源的 turn 游戏。',422);
}
export function createTurnRoomService({contentService,maxRooms=8,ttlMs=600000,now=()=>Date.now()}={}){
 if(!contentService||!Number.isInteger(maxRooms)||maxRooms<1||maxRooms>8||!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>600000)throw Error('Invalid room service configuration');
 const rooms=new Map();let disposed=false;
 const expire=()=>{for(const [id,room] of rooms)if(now()>=room.expiresAt){room.runtime.dispose();rooms.delete(id);}};
 const roomFor=id=>{if(disposed)reject('A2G_E_ROOM_CLOSED','回合服务已关闭。',410);expire();const room=rooms.get(id);if(!room)reject('A2G_E_ROOM_NOT_FOUND','房间不存在或已过期。',404);return room;};
 const seatFor=(room,token)=>{const seat=room.tokens.findIndex(value=>value===token);if(!token||seat<0)reject('A2G_E_ROOM_SEAT','此连接没有房间席位。',403);return seat+1;};
 const view=(room,seat)=>{const observation=room.runtime.observe();return {format:'a2game-public-turn-view',profile:'local-public-turn-v1',roomId:room.id,version:room.version,seat,nextSequence:room.sequences[seat-1]+1,hitTargets:room.game.inputs.actions.flatMap(a=>a.bindings.filter(b=>b.source==='touch.select').map(b=>({action:a.id,config:b.config}))),joined:room.tokens.length,gameSha256:room.releaseId,title:room.game.meta.title,actions:room.game.inputs.actions.map(a=>a.id),observation,presentation:projectPresentation(room.game,observation)};};
 return {
  async create(input){if(!exactKeys(input,['releaseId'])||!/^[a-f0-9]{64}$/.test(input.releaseId))reject('A2G_E_ROOM_REQUEST','创建房间需要合法 releaseId。',400);if(disposed)reject('A2G_E_ROOM_CLOSED','回合服务已关闭。',410);expire();if(rooms.size>=maxRooms)reject('A2G_E_ROOM_CAPACITY','本机回合房间已达到上限。',429);const {definition}=await contentService.read(input.releaseId);assertProfile(definition);if(disposed)reject('A2G_E_ROOM_CLOSED','回合服务已关闭。',410);expire();if(rooms.size>=maxRooms)reject('A2G_E_ROOM_CAPACITY','本机回合房间已达到上限。',429);const runtime=new HeadlessRuntime(definition,makeRegistry());runtime.start();const id=randomUUID(),token=randomUUID(),room={id,releaseId:input.releaseId,game:definition,runtime,version:0,sequences:[0,0],tokens:[token],inputs:[],expiresAt:now()+ttlMs};rooms.set(id,room);return {roomId:id,seat:1,token,version:0};},
  join(id,input){if(!exactKeys(input,[]))reject('A2G_E_ROOM_REQUEST','加入请求应为空对象。',400);const room=roomFor(id);if(room.tokens.length!==1)reject('A2G_E_ROOM_FULL','房间席位已满。');const token=randomUUID();room.tokens.push(token);return {roomId:id,seat:2,token,version:room.version};},
  read(id,token){const room=roomFor(id);return view(room,seatFor(room,token));},
  move(id,token,input){const room=roomFor(id),seat=seatFor(room,token);if(!exactKeys(input,['version','sequence','action'])||!Number.isSafeInteger(input.version)||!Number.isSafeInteger(input.sequence)||typeof input.action!=='string')reject('A2G_E_ROOM_REQUEST','落子请求需要版本、序号和已声明按钮动作。',400);
   if(input.version!==room.version)reject('A2G_E_ROOM_STALE','状态版本已变化，请先同步。');if(input.sequence!==room.sequences[seat-1]+1)reject('A2G_E_ROOM_SEQUENCE','动作序号重复或不连续。');if(room.tokens.length!==2)reject('A2G_E_ROOM_WAIT','等待第二位玩家加入。');const before=room.runtime.observe();if(before.flow.status!=='playing'||before.state.turn.winner||before.state.turn.draw)reject('A2G_E_ROOM_FINISHED','本局已结束。');if(before.state.turn.player!==seat)reject('A2G_E_ROOM_TURN','尚未轮到此席位。',403);if(!room.game.inputs.actions.some(a=>a.id===input.action))reject('A2G_E_ROOM_ACTION','动作未在游戏中声明。',422);
   const snapshot=room.runtime.snapshot();try{const sourceId=`seat:${seat}:${input.sequence}`;for(const phase of ['press','release'])room.runtime.injectAction({action:input.action,phase,sourceId});room.runtime.step(1);if(room.runtime.observe().state.turn.moves!==before.state.turn.moves+1)reject('A2G_E_ROOM_ILLEGAL','此位置不能落子。',422);}catch(e){room.runtime.restore(snapshot);throw e;}
   room.version++;room.sequences[seat-1]=input.sequence;room.inputs.push({seat,sequence:input.sequence,action:input.action,tickIndex:snapshot.tickIndex});return view(room,seat);
  },
  close(id,token){const room=roomFor(id);if(seatFor(room,token)!==1)reject('A2G_E_ROOM_OWNER','只有创建者可以关闭房间。',403);room.runtime.dispose();rooms.delete(id);return {status:'CLOSED'};},
  journal(id,token){const room=roomFor(id);seatFor(room,token);return {format:'a2game-public-turn-journal',gameSha256:room.releaseId,inputs:structuredClone(room.inputs),hash:room.runtime.observe().exactHash};},
  diagnostics(){expire();return {disposed,rooms:rooms.size,ownedSessions:rooms.size};},
  dispose(){if(disposed)return;disposed=true;for(const room of rooms.values())room.runtime.dispose();rooms.clear();}
 };
}
