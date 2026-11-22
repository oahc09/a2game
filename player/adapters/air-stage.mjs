import {createStageAudio} from './stage-audio.mjs';
export class AirStageHost {
  constructor(a,scene,resources){Object.assign(this,{a,scene,resources});this.objects=new Map();this.assets=[];this.last='';
    this.root=new a.Node('A2GameVisualStage');scene.addChild(this.root);
    this.cameraNode=new a.Node('A2GameStageCamera');scene.addChild(this.cameraNode);this.camera=this.cameraNode.addComponent(a.Camera);this.camera.visibility=a.Layers.Enum.DEFAULT;this.camera.priority=0;
    this.lightNode=new a.Node('A2GameStageLight');scene.addChild(this.lightNode);this.lightNode.setRotationFromEuler(-35,-30,0);this.lightNode.addComponent(a.DirectionalLight).illuminance=50000;
    if(scene.globals?.ambient){scene.globals.ambient.skyIllum=20000;scene.globals.ambient.skyColor=new a.Color(180,200,230,255);}
  }
  async prepare({audio}){this.audio=await createStageAudio('air',this.a,this.root,this.resources,audio);}
  clear(){for(const {node,renderer} of this.objects.values()){renderer.mesh=null;renderer.material=null;node.destroy();}this.objects.clear();for(const asset of this.assets)asset.destroy();this.assets=[];this.last='';}
  draw(frame,background,aspect=1){
    const a=this.a,c=frame.camera;this.cameraNode.setPosition(...c.at);this.cameraNode.lookAt(new a.Vec3(...c.target));
    this.camera.projection=c.projection==='perspective'?a.Camera.ProjectionType.PERSPECTIVE:a.Camera.ProjectionType.ORTHO;
    this.camera.fov=c.fov;this.camera.orthoHeight=(c.fitSize?Math.max(c.orthoHeight,c.fitSize[1],c.fitSize[0]/aspect):c.orthoHeight)/2;this.camera.near=c.near;this.camera.far=c.far;this.camera.clearFlags=a.Camera.ClearFlag.SOLID_COLOR;
    const color=value=>new a.Color(parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16),255);this.camera.clearColor=color(background);
    const signature=JSON.stringify(frame.nodes.map(({at,rotation,...node})=>node));
    if(signature!==this.last){this.clear();this.last=signature;
      for(const item of frame.nodes){
        const node=new a.Node(item.id);node.layer=a.Layers.Enum.DEFAULT;this.root.addChild(node);const renderer=node.addComponent(a.MeshRenderer);
        const geometry=item.geometry==='box'?a.primitives.box({width:1,height:1,length:1}):item.geometry==='sphere'?a.primitives.sphere(0.5,{widthSegments:16,heightSegments:12}):a.primitives.quad();
        const mesh=a.utils.createMesh(geometry),material=new a.Material();
        material.initialize({effectName:item.material==='standard'?'builtin-standard':'builtin-unlit',defines:item.asset?(item.material==='standard'?{USE_ALBEDO_MAP:true,USE_ALPHA_TEST:true}:{USE_TEXTURE:true,USE_ALPHA_TEST:true}):{}});
        material.setProperty('mainColor',color(item.color));
        if(item.asset){const bitmap=this.resources.get(item.asset).bitmap,sheet=document.createElement('canvas');sheet.width=bitmap.width;sheet.height=bitmap.height;const paint=sheet.getContext('2d');paint.translate(0,sheet.height);paint.scale(1,-1);paint.drawImage(bitmap,0,0);
          const image=new a.ImageAsset(sheet),texture=new a.Texture2D();texture.image=image;material.setProperty('mainTexture',texture);this.assets.push(texture,image);}
        renderer.mesh=mesh;renderer.material=material;this.assets.push(mesh,material);this.objects.set(item.id,{node,renderer});
      }
    }
    for(const item of frame.nodes){const node=this.objects.get(item.id).node;node.setPosition(...item.at);node.setScale(...item.size);node.setRotationFromEuler(...item.rotation.map(value=>value*180/Math.PI));}
    this.audio?.draw(frame);
  }
  diagnostics(){return {ownedMeshes:this.objects.size,ownedAssets:this.assets.length,audio:this.audio?.diagnostics()};}
  dispose(){this.audio?.dispose();this.clear();this.root.destroy();this.cameraNode.destroy();this.lightNode.destroy();}
}
