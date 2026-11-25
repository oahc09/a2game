import {HeadlessRuntime,projectPresentation,sha256Canonical} from '../dist/index.js';
import {validateJsonTree} from '../dist/utils.js';
import {createBrowserRegistry} from './browser-registry.mjs';
import {ResourceScope} from './resources.mjs';
import {ThreeAdapter} from './adapters/three-adapter.mjs';
import {CocosAirAdapter} from './adapters/cocosairjs-adapter.mjs';
import {trustedBundleDigest} from './trusted-bundle.mjs';
import {createPointerHost,hasTouchStick} from './pointer-host.mjs';
import {createMobileHost} from './mobile-host.mjs';
import {createGamepadHost} from './gamepad-host.mjs';
import {actionLabel} from './input-labels.mjs';

// Experimental: the trust anchor is supplied by the build, never by the game package.
let cocosDocumentClaimed=false;
export function createA2GamePlayer({backend,container,onEvent=()=>{}}){
 if(!['three','cocosairjs'].includes(backend)||!(container instanceof HTMLElement))throw Error('A2G_E_CONFIG: invalid backend or container');
 let runtime,adapter,resources,definition,host,canvas,raf,last=0,carry=0,sequence=0,disposed=false,closed=false,loading=false,ready=false,started=false,disposal,flow,loadDone=Promise.resolve();
 const held=new Map();let holdSerial=0,pointerHost,mobileHost,gamepadHost;const inputAbort=new AbortController();
 const emit=(type,detail={})=>{try{onEvent(Object.freeze({type,...detail}));}catch(e){console.error('A2Game event handler',e);}};
 const assert=()=>{if(disposed)throw Error('A2G_E_DISPOSED');};
 const button=action=>definition?.inputs.actions.find(item=>item.id===action&&item.valueType==='button');
 const input=(action,phase,sourceId)=>{const tickIndex=runtime.tickIndex,hz=definition.world.clock.tickHz,timeUs=Math.min(Math.ceil((tickIndex+1)*1e6/hz)-1,Math.ceil(tickIndex*1e6/hz)+Math.max(0,Math.floor(carry*1e6)));runtime.injectAction({action,phase,sourceId,tickIndex,timeUs,seq:sequence++});};
 const raw=sample=>{if(disposed||runtime?.status!=='playing')return false;const tickIndex=runtime.tickIndex,hz=definition.world.clock.tickHz,timeUs=Math.min(Math.ceil((tickIndex+1)*1e6/hz)-1,Math.ceil(tickIndex*1e6/hz)+Math.max(0,Math.floor(carry*1e6)));runtime.injectRaw({...sample,tickIndex,timeUs,seq:sequence++});return true;};
 const hasBinding=prefix=>definition?.inputs.actions.some(a=>a.bindings.some(b=>b.source.startsWith(prefix)));
 const resetSources=()=>{pointerHost?.stop();mobileHost?.stop();gamepadHost?.stop({release:true});emit('sources-reset');};
 const clearHeld=()=>{const count=held.size;held.clear();if(count)emit('inputs-reset');};
 const inputReady=()=>{assert();if(!ready||!started)throw Error('A2G_E_FLOW: start before input');return runtime.status==='playing';};
 const render=()=>{const observation=runtime.observe();adapter.draw(projectPresentation(definition,observation));if(flow!==observation.flow.status){flow=observation.flow.status;emit('status',{status:flow});}};
 const frame=now=>{if(disposed)return;try{if(!last)last=now;const delta=Math.max(0,(now-last)/1000);last=now;if(runtime.status==='playing'){carry+=delta;const hz=definition.world.clock.tickHz,steps=Math.floor(carry*hz+1e-7);if(steps>(definition.world.clock.maxCatchUpTicks??5)){runtime.pause();clearHeld();resetSources();adapter.pauseAudio?.();carry=0;emit('error',{message:'A2G_E_CLOCK_STALL'});}else{for(let i=0;i<steps;i++){pointerHost?.checkGeometry();gamepadHost?.poll();mobileHost?.poll();runtime.step(1);}carry-=steps/hz;}}render();raf=requestAnimationFrame(frame);}catch(e){emit('error',{message:String(e.message??e)});void dispose();}};
 function dispose(){if(disposal)return disposal;disposed=true;clearHeld();inputAbort.abort();gamepadHost?.dispose();if(raf)cancelAnimationFrame(raf);resources?.dispose();disposal=loadDone.then(()=>{runtime?.dispose();return adapter?.dispose();}).finally(()=>{resources?.dispose();host?.remove();closed=true;emit('disposed');});return disposal;}
 return Object.freeze({
  async load(bundle){assert();if(loading||runtime)throw Error('A2G_E_FLOW: load once per player');loading=true;let finishLoad;loadDone=new Promise(resolve=>{finishLoad=resolve;});let failure;
   try{let snapshot;try{const text=JSON.stringify(bundle);if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>1024*1024)throw Error('invalid size');snapshot=JSON.parse(text);validateJsonTree(snapshot);}catch{throw Error('A2G_E_RELEASE_INTEGRITY: invalid JSON package');}
    if(!snapshot||snapshot.format!=='a2game-release-bundle'||snapshot.bundleVersion!==1||sha256Canonical(snapshot)!==trustedBundleDigest)throw Error('A2G_E_RELEASE_INTEGRITY: package not admitted by this build');
    const registry=await createBrowserRegistry();assert();definition=snapshot.definition;
    resources=new ResourceScope(snapshot.resources.map(record=>({...record,href:new URL('./assets/'+record.sha256,import.meta.url).href})));await resources.load();assert();
    runtime=new HeadlessRuntime(definition,registry);host=document.createElement('div');host.className='stage';host.style.cssText='position:relative;width:100%;height:100%';canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label',definition.meta.title);canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';host.append(canvas);container.append(host);
    if(backend==='three'){const module=await import('three');assert();adapter=new ThreeAdapter(module,canvas,resources);await adapter.prepare(definition);}else{if(cocosDocumentClaimed)throw Error('A2G_E_COCOS_DOCUMENT: reload the page before another CocosAirJS instance');cocosDocumentClaimed=true;const module=await import('cocosair.js');assert();adapter=await CocosAirAdapter.create(module,canvas);assert();await adapter.prepare(definition,resources);}assert();
    const getRuntime=()=>disposed?undefined:runtime;
    if(hasBinding('touch.'))pointerHost=createPointerHost({canvas,getRuntime,inject:raw,unlock:()=>adapter.unlockAudio?.(),signal:inputAbort.signal,geometrySensitive:hasTouchStick(definition)});
    if(hasBinding('imu.'))mobileHost=createMobileHost({getRuntime,inject:raw,onStatus:detail=>emit('sensor-status',detail),signal:inputAbort.signal});
    if(hasBinding('gamepad.'))gamepadHost=createGamepadHost({definition,inject:raw,onStatus:message=>emit('gamepad-status',{message})});
    render();assert();ready=true;emit('loaded',{id:definition.id});
   }catch(error){failure=error;void dispose();}finally{loading=false;finishLoad();}
   if(failure){await disposal;throw failure;}
  },
  start(){assert();if(!ready||started)throw Error('A2G_E_FLOW: load before start');runtime.start();started=true;last=0;render();raf=requestAnimationFrame(frame);},
  pause(){assert();if(!ready||!started)throw Error('A2G_E_FLOW: start before pause');runtime.pause();clearHeld();resetSources();adapter.pauseAudio?.();carry=0;render();},
  resume(){assert();if(!ready||!started)throw Error('A2G_E_FLOW: start before resume');runtime.resume();last=0;carry=0;render();},
  restart(){assert();if(!ready||!started)throw Error('A2G_E_FLOW: start before restart');resetSources();runtime.restart();clearHeld();holdSerial=0;last=0;carry=0;sequence=0;render();},
  action(action){if(!inputReady()||!button(action))return false;adapter.unlockAudio?.();const sourceId=`sdk:${action}:${runtime.tickIndex}`;input(action,'press',sourceId);input(action,'release',sourceId);return true;},
  press(action,source='primary'){
   if(!inputReady()||!button(action)||typeof source!=='string'||!source||source.length>64)return false;
   const key=JSON.stringify([action,source]);if(held.has(key)||held.size>=64)return false;
   // The existing Runtime recognizes this prefix and supplies hold edges only
   // for actions that explicitly opt into keyboard.button config.hold.
   const sourceId=`ui-hold:sdk:${++holdSerial}`;held.set(key,{action,sourceId});adapter.unlockAudio?.();input(action,'press',sourceId);return true;
  },
  release(action,source='primary'){
   assert();if(typeof source!=='string'||!source||source.length>64)return false;const key=JSON.stringify([action,source]),entry=held.get(key);if(!entry)return false;held.delete(key);
   if(ready&&started&&runtime.status==='playing')input(entry.action,'release',entry.sourceId);return true;
  },
  cancelInputs(){assert();if(ready&&started&&runtime.status==='playing')for(const entry of held.values())input(entry.action,'cancel',entry.sourceId);clearHeld();resetSources();},
  enableSensors(){assert();if(!ready||!mobileHost)throw Error('A2G_E_CAP_DEPENDENCY: game has no sensor bindings');return mobileHost.enable();},
  calibrateSensors(){assert();if(!ready||!mobileHost)throw Error('A2G_E_CAP_DEPENDENCY: game has no sensor bindings');mobileHost.calibrate();},
  disableSensors(){assert();mobileHost?.stop();},
  enableGamepad(){assert();if(!ready||!gamepadHost)throw Error('A2G_E_CAP_DEPENDENCY: game has no gamepad bindings');gamepadHost.enable();},
  disableGamepad(){assert();gamepadHost?.stop({release:true});},
  getInfo(){assert();if(!ready)throw Error('A2G_E_FLOW: load before metadata');return {id:definition.id,title:definition.meta.title,description:definition.meta.description,inputSources:{touch:!!pointerHost,sensors:!!mobileHost,gamepad:!!gamepadHost},actions:definition.inputs.actions.filter(action=>action.valueType==='button').map(action=>({id:action.id,label:actionLabel(definition,action),hold:action.bindings.some(binding=>binding.source==='keyboard.button'&&binding.config?.hold===true),keys:action.bindings.filter(binding=>binding.source==='keyboard.button').map(binding=>binding.config.code)}))};},
  status(){return closed?'disposed':disposed?'disposing':loading?'loading':runtime?.status??'empty';},
  diagnostics(){return {disposed:closed,disposing:disposed&&!closed,heldSources:held.size,pointer:pointerHost?.diagnostics()??null,sensors:mobileHost?.diagnostics()??null,gamepad:gamepadHost?.diagnostics()??null,resources:resources?.diagnostics()??null,adapter:adapter?.diagnostics()??null};},
  dispose
 });
}
