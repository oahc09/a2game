import {AirStageHost} from './air-stage.mjs';
/** CocosAirJS scene/UI projection. No game-specific rules or state-name recognition. */
export class CocosAirAdapter {
  static async create(air,canvas){
    const names=['createAirApp','Scene','Node','UITransform','Graphics','Color','Layers','createUICanvas','labelNode','Label'];
    for(const key of names)if(!air?.[key])throw Error(`Missing CocosAirJS SDK export: ${key}`);
    const adapter=new CocosAirAdapter(air,canvas);
    try{await adapter.init();return adapter;}catch(error){await adapter.dispose();throw error;}
  }
  constructor(air,canvas){this.air=air;this.canvas=canvas;this.nodes=[];this.current='';this.disposed=false;}
  async prepare(definition,resources){if(definition.presentation.stage){this.stage=new AirStageHost(this.air,this.scene,resources);await this.stage.prepare(definition.presentation.stage);}}
  unlockAudio(){this.stage?.audio?.unlock();}
  pauseAudio(){this.stage?.audio?.pause();}
  async init(){
    const a=this.air;
    this.container=this.canvas.closest?.('.stage')??this.canvas.parentElement;
    this.width=this.container?.clientWidth||900;this.height=this.container?.clientHeight||640;
    this.app=await a.createAirApp({canvas:this.canvas,screenMode:'container',container:this.container,designResolution:{width:this.width,height:this.height,policy:2}});
    this.scene=new a.Scene('A2Game');
    this.ui=a.createUICanvas(this.scene,'A2GameUI',{designWidth:this.width,designHeight:this.height});
    this.app.run(this.scene);
  }
  clear(){for(const node of this.nodes)node.destroy();this.nodes=[];}
  makeGraphics(){
    const a=this.air,node=new a.Node('PresentationGraphics');node.layer=a.Layers.Enum.UI_2D;
    node.addComponent(a.UITransform).setContentSize(this.width,this.height);this.ui.addChild(node);this.nodes.push(node);
    return node.addComponent(a.Graphics);
  }
  draw(frame){
    if(this.disposed)throw Error('A2G_E_DISPOSED: CocosAirJS adapter disposed');
    if(!frame?.commands)throw Error('PresentationFrame expected');
    const width=this.container?.clientWidth||900,height=this.container?.clientHeight||640;
    if(width!==this.width||height!==this.height){
      this.width=width;this.height=height;this.air.view?.setDesignResolutionSize(width,height,2);
      this.ui.getComponent(this.air.UITransform)?.setContentSize(width,height);
    }
    if(frame.stage)this.stage.draw(frame.stage,frame.background);
    const signature=`${width}:${height}:${frame.background}:${JSON.stringify(frame.commands)}`;
    if(signature===this.current)return;
    this.current=signature;
    const a=this.air,scale=Math.min(width/frame.width,height/frame.height);
    this.clear();let g=this.makeGraphics();
    const rgb=value=>new a.Color(parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16),255);
    if(a.Canvas){const camera=this.ui.getComponent(a.Canvas).cameraComponent;camera.clearColor=rgb(frame.background);camera.priority=frame.stage?100:0;camera.clearFlags=frame.stage?a.Camera.ClearFlag.DEPTH_ONLY:a.Camera.ClearFlag.SOLID_COLOR;}
    if(!frame.stage){g.fillColor=rgb(frame.background);g.rect(-width/2,-height/2,width,height);g.fill();}
    for(const cmd of frame.commands){
      const x=cmd.at[0]*scale,y=cmd.at[1]*scale;
      if(cmd.kind==='text'){
        const label=a.labelNode(this.ui,cmd.text,cmd.id,{fontSize:Math.max(1,cmd.fontSize*scale),position:[x,y],color:rgb(cmd.fill)});
        this.nodes.push(label);g=null;
      }else{
        // A new Graphics node after text preserves the frame's drawing order.
        if(!g)g=this.makeGraphics();
        g.fillColor=rgb(cmd.fill);
        if(cmd.kind==='rect')g.rect(x-cmd.size[0]*scale/2,y-cmd.size[1]*scale/2,cmd.size[0]*scale,cmd.size[1]*scale);
        else if(cmd.kind==='circle')g.circle(x,y,cmd.radius*scale);
        g.fill();
      }
    }
  }
  diagnostics(){return {disposed:this.disposed,ownedNodes:this.nodes.length,sceneAlive:this.scene?.isValid??null,
    stage:this.stage?.diagnostics(),context:this.app?.contextHealth?.snapshot(),release:this.releaseReceipt??null};}
  dispose(){
    if(this.disposal)return this.disposal;
    this.disposed=true;this.stage?.dispose();this.clear();
    this.disposal=Promise.resolve().then(async()=>{
      // close also detaches SDK layout/context observers; runtime reconstruction requires reload.
      this.releaseReceipt=await (this.app?.close?.()??this.app?.releaseScene?.());
      if(this.releaseReceipt?.status==='failed')throw Error('A2G_E_RELEASE_FAILED: CocosAirJS scene cleanup failed');
      return this.releaseReceipt;
    });
    return this.disposal;
  }
}
