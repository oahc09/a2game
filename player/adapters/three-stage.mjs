import {createStageAudio} from './stage-audio.mjs';
export class ThreeStageHost {
  constructor(T,renderer,resources){Object.assign(this,{T,renderer,resources});this.scene=new T.Scene();this.objects=new Map();this.last='';this.ownedTextures=0;
    this.scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,6);this.scene.add(light);
    this.perspective=new T.PerspectiveCamera(45,1,0.1,100);this.orthographic=new T.OrthographicCamera(-4,4,3,-3,0.1,100);
  }
  async prepare(spec){this.audio=await createStageAudio('three',this.T,this.scene,this.resources,spec.audio);}
  clear(){for(const mesh of this.objects.values()){this.scene.remove(mesh);mesh.geometry.dispose();if(mesh.material.map){mesh.material.map.dispose();this.ownedTextures--;}mesh.material.dispose();}this.objects.clear();this.last='';}
  draw(frame,width,height,background){
    const T=this.T,c=frame.camera,camera=c.projection==='perspective'?this.perspective:this.orthographic;
    camera.position.set(...c.at);camera.lookAt(...c.target);camera.near=c.near;camera.far=c.far;
    if(c.projection==='perspective'){camera.fov=c.fov;camera.aspect=width/height;}else{const extent=c.fitSize?Math.max(c.orthoHeight,c.fitSize[1],c.fitSize[0]*height/width):c.orthoHeight;camera.top=extent/2;camera.bottom=-extent/2;camera.left=-extent*width/height/2;camera.right=-camera.left;}camera.updateProjectionMatrix();
    const signature=JSON.stringify(frame.nodes.map(({at,rotation,...node})=>node));
    if(signature!==this.last){this.clear();this.last=signature;
      for(const node of frame.nodes){
        const geometry=node.geometry==='box'?new T.BoxGeometry(1,1,1):node.geometry==='sphere'?new T.SphereGeometry(0.5,16,12):new T.PlaneGeometry(1,1);
        let map;if(node.asset){const bitmap=this.resources.get(node.asset).bitmap,sheet=document.createElement('canvas');sheet.width=bitmap.width;sheet.height=bitmap.height;sheet.getContext('2d').drawImage(bitmap,0,0);map=new T.CanvasTexture(sheet);map.colorSpace=T.SRGBColorSpace;this.ownedTextures++;}
        const options={color:node.color,...(map?{map,transparent:true,alphaTest:0.01}:{}),side:T.DoubleSide};
        const material=node.material==='standard'?new T.MeshStandardMaterial({...options,roughness:0.65,metalness:0}):new T.MeshBasicMaterial(options);
        const mesh=new T.Mesh(geometry,material);mesh.name=node.id;this.scene.add(mesh);this.objects.set(node.id,mesh);
      }
    }
    for(const node of frame.nodes){const mesh=this.objects.get(node.id);mesh.position.set(...node.at);mesh.rotation.set(...node.rotation);mesh.scale.set(...node.size);}
    this.renderer.setClearColor(background,1);this.renderer.render(this.scene,camera);this.audio?.draw(frame);
  }
  diagnostics(){return {ownedMeshes:this.objects.size,ownedTextures:this.ownedTextures,audio:this.audio?.diagnostics()};}
  dispose(){this.audio?.dispose();this.clear();}
}
