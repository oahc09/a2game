/** Canvas2D reference projection: consumes the same engine-neutral drawing commands as AIR and Three. */
export class CanvasPreviewAdapter {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('2D canvas not supported');}
  draw(frame){
    if(frame?.stage)throw Error('A2G_E_HOST_PROFILE: 通用 3D Stage 请使用真实 Three.js 或 CocosAirJS 后端。');
    if(!frame?.commands||!Array.isArray(frame.commands))throw Error('PresentationFrame expected');
    const rect=this.canvas.getBoundingClientRect();
    const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
    const dpr=Math.min(globalThis.devicePixelRatio||1,2);
    const pixelW=Math.max(1,Math.round(w*dpr)),pixelH=Math.max(1,Math.round(h*dpr));
    if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){this.canvas.width=pixelW;this.canvas.height=pixelH;}
    const ctx=this.ctx;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle=frame.background;ctx.fillRect(0,0,w,h);
    const scale=Math.min(w/frame.width,h/frame.height);
    for(const command of frame.commands){
      const x=w/2+command.at[0]*scale,y=h/2-command.at[1]*scale;
      ctx.fillStyle=command.fill;
      if(command.kind==='rect')ctx.fillRect(x-command.size[0]*scale/2,y-command.size[1]*scale/2,command.size[0]*scale,command.size[1]*scale);
      else if(command.kind==='circle'){ctx.beginPath();ctx.arc(x,y,command.radius*scale,0,Math.PI*2);ctx.fill();}
      else if(command.kind==='text'){
        ctx.font=`700 ${Math.max(1,command.fontSize*scale)}px system-ui`;
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(command.text,x,y);
      }
    }
  }
  dispose(){}
}
