/** Native browser source only. Recognizers and all gameplay stay in the shared Runtime. */
export function createMobileHost({getRuntime,inject,onStatus,signal}){
 let sensors,timeout,orientation,motion,enabled=false,syntheticSamples=0,nativeSamples=0,lastOrientationTick=-1,lastMotionTick=-1;
 const finite3=values=>values.every(value=>typeof value==='number'&&Number.isFinite(value));
 const radians=value=>Math.round(value*Math.PI/180*10000)/10000;
 const angle=()=>((screen.orientation?.angle??0)%360+360)%360;
 const status=(state,message)=>onStatus({state,message,enabled,syntheticSamples,nativeSamples,orientation:!!orientation,linearAcceleration:!!motion?.acceleration,angularVelocity:!!motion?.rotation});
 function sample(kind='sample'){
  const runtime=getRuntime();if(!enabled||!orientation||runtime?.status!=='playing')return false;
  inject({source:'imu',kind,payload:{reference:'device-euler-rad-v1',screenAngle:angle(),orientationRad:orientation,
   linearAccelerationMps2:motion?.acceleration??[0,0,0],angularVelocityRadps:motion?.rotation??[0,0,0],
   available:{orientation:true,linearAcceleration:!!motion?.acceleration,angularVelocity:!!motion?.rotation}}});return true;
 }
 function stop(message='传感器已停止；可使用已声明的触控/键盘回退。'){
  sensors?.abort();clearTimeout(timeout);enabled=false;orientation=undefined;motion=undefined;lastOrientationTick=lastMotionTick=-1;
  status('STOPPED',message);
 }
 async function enable(){
  if(!isSecureContext){status('NOT_AVAILABLE','当前不是安全上下文，请使用 HTTPS 或本机回环地址；保留触控回退。');return;}
  const constructors=[window.DeviceOrientationEvent,window.DeviceMotionEvent].filter(Boolean);
  if(!constructors.length){status('NOT_AVAILABLE','浏览器没有传感器接口；请使用触控/键盘回退。');return;}
  try{
   // Both calls occur during the same explicit user gesture, before awaiting either result.
   const requests=constructors.map(type=>typeof type.requestPermission==='function'?type.requestPermission():Promise.resolve('granted'));
   if((await Promise.all(requests)).some(result=>result!=='granted')){stop('传感器权限未获准；请使用触控/键盘回退。');status('DENIED','传感器权限未获准；未启动采集。');return;}
   stop();enabled=true;sensors=new AbortController();const options={signal:sensors.signal};status('WAITING','已启用接口，等待实际样本；收到后请校准。');
   const count=event=>{if(event.isTrusted)nativeSamples++;else syntheticSamples++;};
   window.addEventListener('deviceorientation',event=>{
    if(!finite3([event.alpha,event.beta,event.gamma]))return;count(event);orientation=[event.alpha,event.beta,event.gamma].map(radians);
    const tick=getRuntime()?.observe().tickIndex;if(tick!==lastOrientationTick){lastOrientationTick=tick;sample();}status('SAMPLING','已收到姿态样本；点击「校准」设定中立姿态。');
   },options);
   window.addEventListener('devicemotion',event=>{
    const a=event.acceleration,r=event.rotationRate;motion={
     ...(a&&finite3([a.x,a.y,a.z])?{acceleration:[a.x,a.y,a.z].map(n=>Math.round(n*10000)/10000)}:{}),
     ...(r&&finite3([r.alpha,r.beta,r.gamma])?{rotation:[r.alpha,r.beta,r.gamma].map(radians)}:{})};
    count(event);const tick=getRuntime()?.observe().tickIndex;if(tick!==lastMotionTick){lastMotionTick=tick;sample();}
   },options);
   window.addEventListener('orientationchange',()=>{if(getRuntime()?.status==='playing')inject({source:'imu',kind:'reset',payload:{}});orientation=undefined;status('CALIBRATION_REQUIRED','屏幕方向已变化，请保持设备稳定后重新校准。');},options);
   timeout=setTimeout(()=>{if(!orientation)stop('未收到有效姿态样本；当前设备不可用，请使用触控/键盘回退。');},3000);
  }catch(error){stop();status('DENIED','无法启用传感器：'+error.message+'；可使用触控/键盘回退。');}
 }
 function calibrate(){if(sample('calibrate'))status('CALIBRATED','校准样本已入队；逻辑 Tick 将应用中立姿态。');else status('NOT_AVAILABLE','尚无有效姿态样本，请先启用并等待设备数据。');}
 signal.addEventListener('abort',()=>stop('已释放传感器监听器。'),{once:true});
 return {enable,calibrate,stop,diagnostics:()=>({enabled,listenersActive:enabled&&!sensors?.signal.aborted,nativeSamples,syntheticSamples})};
}

/** Memory-only explicit recording; export is a separate user action. */
export function createTraceRecorder(definition,nextSequence){
 let events=[],recording=false,overflow=false,seq=0;
 const append=sample=>{
  if(!recording)return;if(events.length>=4096){recording=false;overflow=true;return;}
  const eventSeq=sample.seq??sample.payload?.seq??(nextSequence?nextSequence():seq);seq=Math.max(seq,eventSeq+1);
  events.push(structuredClone({...sample,seq:eventSeq}));
 };
 return {
  start(){events=[];seq=0;overflow=false;recording=true;},
  raw(input){append(input);},
  action(input,tickIndex,timeUs){append({source:'action',kind:'input',tickIndex,timeUs,payload:input});},
  control(kind,tickIndex){append({source:'system',kind,tickIndex,timeUs:Math.ceil(tickIndex*1000000/definition.world.clock.tickHz),payload:{}});},
  stop(tickIndex){if(recording)this.control('checkpoint',tickIndex);recording=false;},
  diagnostics:()=>({recording,count:events.length,overflow}),
  dispose(){events=[];recording=false;overflow=false;},
  export(){if(overflow)throw Error('录制超过 4096 个样本，请重开并缩短录制。');if(recording)throw Error('请先结束录制。');return {format:'a2game-input-trace',traceVersion:'0.1.0',session:{gameId:definition.id,gameRevision:definition.revision,tickHz:definition.world.clock.tickHz,seed:definition.world.clock.seed,inputNormalizerVersion:'0.1.0',coordinateProfile:'viewport-top-left-v1',recognizers:Object.fromEntries(definition.requires.all.filter(ref=>ref.id.startsWith('a2game.input.')).map(ref=>[ref.id,ref.version]))},events:structuredClone(events)};}
 };
}
