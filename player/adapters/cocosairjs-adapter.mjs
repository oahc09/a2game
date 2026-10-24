/** CocosAirJS scene/UI projection. No game-specific rules or state-name recognition. */
export class CocosAirAdapter {
  static async create(air,canvas){
    const names=['createAirApp','Scene','Node','UITransform','Graphics','Color','Layers','createUICanvas','labelNode','Label'];
    for(const key of names)if(!air?.[key])throw Error(`Missing CocosAirJS SDK export: ${key}`);
    const adapter=new CocosAirAdapter(air,canvas);await adapter.init();return adapter;
  }
  constructor(air,canvas){this.air=air;this.canvas=canvas;this.labels=[];this.current='';}
  async init(){
    const a=this.air;
    this.app=await a.createAirApp({canvas:this.canvas,screenMode:'container',container:this.canvas.parentElement,designResolution:{width:900,height:640,policy:2}});
    this.scene=new a.Scene('A2Game');
    this.ui=a.createUICanvas(this.scene,'A2GameUI',{designWidth:900,designHeight:640});
    const node=new a.Node('PresentationGraphics');node.layer=a.Layers.Enum.UI_2D;
    node.addComponent(a.UITransform).setContentSize(900,640);
    this.graphics=node.addComponent(a.Graphics);this.ui.addChild(node);
    this.app.run(this.scene);
  }
  clearLabels(){for(const node of this.labels)node.destroy();this.labels=[];}
  draw(frame){
    if(!frame?.commands)throw Error('PresentationFrame expected');
    const signature=JSON.stringify(frame);
    if(signature===this.current)return;
    this.current=signature;
    const a=this.air,g=this.graphics,scale=Math.min(900/frame.width,640/frame.height);
    g.clear();this.clearLabels();
    const rgb=value=>new a.Color(parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16),255);
    g.fillColor=rgb(frame.background);g.rect(-450,-320,900,640);g.fill();
    for(const cmd of frame.commands){
      const x=cmd.at[0]*scale,y=cmd.at[1]*scale;
      if(cmd.kind==='text'){
        const label=a.labelNode(this.ui,cmd.text,cmd.id,{fontSize:Math.max(1,cmd.fontSize*scale),position:[x,y],color:rgb(cmd.fill)});
        this.labels.push(label);
      }else{
        g.fillColor=rgb(cmd.fill);
        if(cmd.kind==='rect')g.rect(x-cmd.size[0]*scale/2,y-cmd.size[1]*scale/2,cmd.size[0]*scale,cmd.size[1]*scale);
        else if(cmd.kind==='circle')g.circle(x,y,cmd.radius*scale);
        g.fill();
      }
    }
  }
  async dispose(){this.clearLabels();if(this.app?.releaseScene)await this.app.releaseScene();}
}
