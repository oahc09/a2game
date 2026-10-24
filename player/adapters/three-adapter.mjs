/** Three.js host projection. Only PresentationFrame is understood: no gameplay/state special cases. */
export class ThreeAdapter {
  constructor(THREE,canvas){
    for(const name of ['WebGLRenderer','Scene','OrthographicCamera','Mesh','MeshBasicMaterial','PlaneGeometry','CircleGeometry','CanvasTexture'])
      if(!THREE?.[name])throw Error(`Missing Three.js module export: ${name}`);
    this.THREE=THREE;this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-4,4,3,-3,0.1,100);
    this.camera.position.set(0,0,15);this.camera.lookAt(0,0,0);
    this.meshes=[];this.lastSignature='';
  }
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
      const sheet=document.createElement('canvas');sheet.width=512;sheet.height=128;
      const ctx=sheet.getContext('2d');if(!ctx)throw Error('Text canvas unavailable');
      ctx.font='700 68px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=cmd.fill;
      ctx.fillText(cmd.text,256,64);
      const texture=new T.CanvasTexture(sheet);
      // 2D text has a stable view-space height; canvas width can be scaled to fit long labels.
      const width=Math.max(cmd.fontSize,Math.min(5,cmd.fontSize*4));
      geometry=new T.PlaneGeometry(width,cmd.fontSize);
      material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
    }
    const mesh=new T.Mesh(geometry,material);
    mesh.position.set(cmd.at[0],cmd.at[1],z);
    this.scene.add(mesh);this.meshes.push(mesh);
  }
  clear(){
    for(const mesh of this.meshes){
      this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();
    }
    this.meshes=[];
  }
  draw(frame){
    if(!frame?.commands)throw Error('PresentationFrame expected');
    const rect=this.canvas.getBoundingClientRect(),w=Math.max(rect.width,1),h=Math.max(rect.height,1);
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));this.renderer.setSize(w,h,false);
    const scale=Math.min(w/frame.width,h/frame.height);
    this.camera.left=-w/(2*scale);this.camera.right=w/(2*scale);
    this.camera.top=h/(2*scale);this.camera.bottom=-h/(2*scale);
    this.camera.updateProjectionMatrix();
    this.renderer.setClearColor(frame.background,1);
    const signature=JSON.stringify(frame.commands);
    if(signature!==this.lastSignature){
      this.lastSignature=signature;this.clear();
      frame.commands.forEach((cmd,i)=>this.makeVisual(cmd,i*0.005));
    }
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.clear();this.renderer.dispose();}
}
