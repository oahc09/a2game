/** Hardware is sampled only at the existing logic Tick boundary after an explicit user enable. */
export function createGamepadHost({definition,inject,getPads=()=>navigator.getGamepads?.(),onStatus=()=>{}}){
 const standardIndices=new Set((definition?.inputs.actions??[]).flatMap(a=>a.bindings)
  .filter(b=>b.source.startsWith('gamepad.')&&b.config?.mapping==='standard').map(b=>b.config.index??0));
 let enabled=false,disposed=false,samples=0,rejected=0;
 const last=new Map();
 const disconnect=index=>{
  inject({source:'gamepad',kind:'sample',payload:{index,connected:false,buttons:[],axes:[]}});
  last.delete(index);samples++;
 };
 function stop({release=false}={}){
  enabled=false;rejected=0;
  if(release)for(const index of last.keys())disconnect(index);
  last.clear();
 }
 return {
  enable(){if(disposed||enabled)return;enabled=true;onStatus('已启用手柄；按键后浏览器才可能公开设备。');},
  poll(){
   if(!enabled||disposed)return;
   let pads;
   try{pads=getPads();}catch{stop({release:true});onStatus('浏览器拒绝手柄访问；请使用键盘回退。');return;}
   if(!pads){stop({release:true});onStatus('浏览器未提供 Gamepad API；请使用已声明的键盘回退。');return;}
   const seen=new Set();let rejectedNow=0;
   for(const pad of Array.from(pads).filter(Boolean)){
    const {index}=pad;
    if(!Number.isInteger(index)||index<0||index>3||seen.has(index))continue;
    // Keep mapping at the browser boundary. Raw samples and recorded traces retain their old schema.
    if(standardIndices.has(index)&&(pad.mapping!=='standard'||!(pad.axes?.length>=4))){
     if(pad.connected!==false)rejectedNow++;
     continue;
    }
    seen.add(index);
    const payload={index,connected:pad.connected!==false,buttons:Array.from(pad.buttons).slice(0,32).map(b=>Boolean(b.pressed||b.value>=0.5)),axes:Array.from(pad.axes).slice(0,16).map(n=>Math.round(Math.max(-1,Math.min(1,n))*10000)/10000)};
    const text=JSON.stringify(payload);
    if(last.get(index)!==text){inject({source:'gamepad',kind:'sample',payload});last.set(index,text);samples++;}
   }
   for(const index of last.keys())if(!seen.has(index))disconnect(index);
   if(rejectedNow!==rejected)onStatus(rejectedNow?'检测到非标准手柄映射；可使用触屏或键盘回退。':'已启用手柄。');
   rejected=rejectedNow;
  },
  stop,
  dispose(){stop();disposed=true;},
  diagnostics:()=>({enabled,disposed,samples,trackedDevices:last.size,...(standardIndices.size?{incompatibleDevices:rejected}:{} )})
 };
}
