export const hasTouchStick=definition=>definition.inputs.actions.some(a=>a.bindings.some(b=>b.source==='touch.drag'&&b.config?.stick));
/** Canvas pointer ABI only; recognizers and gameplay remain in the shared Runtime. */
export function createPointerHost({canvas,getRuntime,inject,unlock=()=>{},signal,geometrySensitive=false}){
 const active=new Map();let disposed=false,samples=0,geometry;
 const emit=(kind,pointerId,p)=>{samples++;inject({source:'pointer',kind,payload:{pointerId,...p}});};
 function stop(){const previous=[...active];active.clear();for(const[id,p]of previous){if(getRuntime()?.status==='playing')emit('cancel',id,p);if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}}
 function refresh(rect=canvas.getBoundingClientRect()){
  if(!geometrySensitive||disposed)return;
  const now=[rect.left,rect.top,rect.width,rect.height];
  if(geometry&&geometry.some((n,i)=>n!==now[i]))stop();
  geometry=now;
 }
 function event(e,kind){
  if(disposed||getRuntime()?.status!=='playing')return;
  const id=e.pointerId;if(!Number.isSafeInteger(id)||id<0)return;
  const rect=canvas.getBoundingClientRect();
  refresh(rect);
  if(kind==='down'&&(active.has(id)||active.size>=10)||kind!=='down'&&!active.has(id))return;
  const u=(e.clientX-rect.left)/rect.width,v=(e.clientY-rect.top)/rect.height,aspect=rect.width/rect.height;
  if(![u,v,aspect].every(Number.isFinite)||aspect<.1||aspect>10||Math.abs(u)>4||Math.abs(v)>4){const previous=active.get(id);if(previous){active.delete(id);emit('cancel',id,previous);}return;}
  const p={u,v,viewportAspect:aspect,pointerType:e.pointerType??'touch'};
  if(kind==='down'){active.set(id,p);canvas.focus?.({preventScroll:true});canvas.setPointerCapture?.(id);unlock();}
  else if(kind==='up'||kind==='cancel')active.delete(id);else active.set(id,p);
  emit(kind,id,p);
 }
 for(const[name,kind]of Object.entries({pointerdown:'down',pointermove:'move',pointerup:'up',pointercancel:'cancel',lostpointercapture:'cancel'}))canvas.addEventListener(name,e=>event(e,kind),{signal});
 const observer=geometrySensitive&&typeof ResizeObserver==='function'?new ResizeObserver(()=>refresh()):null;
 observer?.observe(canvas);
 signal.addEventListener('abort',()=>{disposed=true;observer?.disconnect();stop();},{once:true});
 return {stop,checkGeometry:()=>{if(geometrySensitive&&active.size)refresh();},diagnostics:()=>({disposed,activePointers:active.size,samples,listenersActive:!disposed})};
}
