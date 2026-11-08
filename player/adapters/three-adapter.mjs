import {ThreeStageHost} from './three-stage.mjs';
/** Three.js host projection. Only PresentationFrame is understood: no gameplay/state special cases. */
export class ThreeAdapter {
  constructor(THREE,canvas,resources){
    for(const name of ['WebGLRenderer','Scene','OrthographicCamera','Mesh','MeshBasicMaterial','PlaneGeometry','CircleGeometry','CanvasTexture'])
      if(!THREE?.[name])throw Error(`Missing Three.js module export: ${name}`);
    this.THREE=THREE;this.canvas=canvas;this.resources=resources;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-4,4,3,-3,0.1,100);
    this.camera.position.set(0,0,15);this.camera.lookAt(0,0,0);
    this.meshes=[];this.visuals=new Map();this.lastSignature='';this.disposed=false;
  }
  async prepare(definition){if(definition.presentation.stage){this.stage=new ThreeStageHost(this.THREE,this.renderer,this.resources);await this.stage.prepare(definition.presentation.stage);}}
  unlockAudio(){this.stage?.audio?.unlock();}
  pauseAudio(){this.stage?.audio?.pause();}
  makeVisual(cmd,z){
    const T=this.THREE;
    let geometry,material;
    if(cmd.kind==='rect'){
      geometry=new T.PlaneGeometry(cmd.size[0],cmd.size[1]);
      material=new T.MeshBasicMaterial({color:cmd.fill});
    }else if(cmd.kind==='circle'){
      geometry=new T.CircleGeometry(cmd.radius,48);
      material=new T.MeshBasicMaterial({color:cmd.fill});
    }else{
      const sheet=document.createElement('canvas');
      const ctx=sheet.getContext('2d');if(!ctx)throw Error('Text canvas unavailable');
      const font='700 64px system-ui';ctx.font=font;
      sheet.width=Math.max(1,Math.ceil(ctx.measureText(cmd.text).width+16));sheet.height=96;
      ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=cmd.fill;
      ctx.fillText(cmd.text,sheet.width/2,sheet.height/2);
      const texture=new T.CanvasTexture(sheet);
      if(T.SRGBColorSpace)texture.colorSpace=T.SRGBColorSpace;
      geometry=new T.PlaneGeometry(sheet.width/64*cmd.fontSize,sheet.height/64*cmd.fontSize);
      material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
    }
    const mesh=new T.Mesh(geometry,material);
    // Three sorts opaque and transparent objects in separate queues: renderOrder
    // cannot interleave them. Put every 2D primitive in the same transparent queue
    // (solid fills still have opacity 1) to honor the frame's painter order.
    material.transparent=true;
    mesh.renderOrder=this.meshes.length;material.depthTest=false;material.depthWrite=false;
    mesh.position.set(cmd.at[0],cmd.at[1],z);
    this.scene.add(mesh);this.meshes.push(mesh);
  }
  clear(){
    for(const mesh of new Set([...this.meshes,...[...this.visuals.values()].map(entry=>entry.mesh)]))this.releaseVisual(mesh);
    this.meshes=[];this.visuals.clear();
  }
  releaseVisual(mesh){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
  releaseVisualsForContextLoss(){
    // Detach resource disposal listeners while the old context is lost. Restoring
    // then rebuilds visuals from the frame, avoiding stale WebGL handle deletion.
    this.clear();this.stage?.clear();this.lastSignature='';
  }
  draw(frame){
    if(this.disposed)throw Error('A2G_E_DISPOSED: Three.js adapter disposed');
    if(!frame?.commands)throw Error('PresentationFrame expected');
    const rect=this.canvas.getBoundingClientRect(),w=Math.max(rect.width,1),h=Math.max(rect.height,1);
    const dpr=Math.min(globalThis.devicePixelRatio||1,2);
    const sizeSignature=`${w}:${h}:${dpr}`;
    if(this.sizeSignature!==sizeSignature){this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h,false);this.sizeSignature=sizeSignature;}
    const scale=Math.min(w/frame.width,h/frame.height);
    this.camera.left=-w/(2*scale);this.camera.right=w/(2*scale);
    this.camera.top=h/(2*scale);this.camera.bottom=-h/(2*scale);
    this.camera.updateProjectionMatrix();
    this.renderer.setClearColor(frame.background,1);
    const signature=JSON.stringify(frame.commands);
    if(signature!==this.lastSignature){
      const next=new Map();this.meshes=[];
      frame.commands.forEach((cmd,i)=>{
        // Position and painter order never require new GPU objects. A changed
        // primitive or text rebuilds only that visual, including its own texture.
        const shape=JSON.stringify([cmd.kind,cmd.size,cmd.radius,cmd.text,cmd.fontSize,cmd.fill]);
        const previous=this.visuals.get(cmd.id);let mesh;
        if(previous?.shape===shape){mesh=previous.mesh;this.meshes.push(mesh);}
        else{
          if(previous){this.releaseVisual(previous.mesh);this.visuals.delete(cmd.id);}
          this.makeVisual(cmd,i*0.005);mesh=this.meshes.at(-1);
        }
        mesh.renderOrder=i;mesh.position.set(cmd.at[0],cmd.at[1],i*0.005);
        next.set(cmd.id,{shape,mesh});
      });
      for(const [id,entry]of this.visuals)if(!next.has(id))this.releaseVisual(entry.mesh);
      this.visuals=next;this.lastSignature=signature;
    }
    if(frame.stage){
      this.stage.draw(frame.stage,w,h,frame.background);this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);this.renderer.autoClear=true;
    }else this.renderer.render(this.scene,this.camera);
  }
  diagnostics(){return {disposed:this.disposed,ownedMeshes:this.meshes.length,
    stage:this.stage?.diagnostics(),gpu:this.renderer.info?{...this.renderer.info.memory}:null};}
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.stage?.dispose();this.clear();this.renderer.dispose();
  }
}
