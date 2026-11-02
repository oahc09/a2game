/** Read-only 2D nominal text diagnostics. Never a visual acceptance gate. */
export function measureTextReadability(frame,canvas,{backend='three',adapter,referenceCssPx=16}={}){
 if(!Number.isFinite(referenceCssPx)||referenceCssPx<=0)throw new TypeError('referenceCssPx must be positive');
 const raw=canvas?.getBoundingClientRect?.(),measuredCanvasRect=raw?Object.fromEntries(['left','top','width','height'].map(k=>[k,raw[k]])):null;
 const result={format:'a2game-text-readability',version:1,status:'UNAVAILABLE',backend,referenceCssPx,measuredCanvasRect,scene:frame?{width:frame.width,height:frame.height}:null,texts:[],warnings:[],limitations:['Nominal font CSS pixels, not measured glyph bounds or legibility','Reference is advisory, not a hard gate or visual PASS','Only PresentationFrame 2D text commands; not DOM, stage textures, occlusion or aesthetics']};
 const positive=v=>Number.isFinite(v)&&v>0;
 if(!raw||![raw.left,raw.top].every(Number.isFinite)||![raw.width,raw.height,frame?.width,frame?.height].every(positive)||!Array.isArray(frame.commands)){result.warnings.push('INVALID_OR_HIDDEN_GEOMETRY');return result;}
 let scaleX,scaleY,centerX=raw.left+raw.width/2,centerY=raw.top+raw.height/2,projection;
 if(backend==='air'){
  const view=adapter?.air?.view,designWidth=adapter?.width,designHeight=adapter?.height,vx=view?.getScaleX?.(),vy=view?.getScaleY?.(),viewport=view?.getViewportRect?.();
  if(![designWidth,designHeight,vx,vy,canvas.width,canvas.height].every(positive)||!viewport||![viewport.x,viewport.y].every(Number.isFinite)||![viewport.width,viewport.height].every(positive)){result.warnings.push('AIR_VIEW_MEASUREMENT_UNAVAILABLE');return result;}
  const designScale=Math.min(designWidth/frame.width,designHeight/frame.height),cssPerPixelX=raw.width/canvas.width,cssPerPixelY=raw.height/canvas.height;
  scaleX=designScale*vx*cssPerPixelX;scaleY=designScale*vy*cssPerPixelY;
  centerX=raw.left+(viewport.x+designWidth*vx/2)*cssPerPixelX;
  centerY=raw.top+raw.height-(viewport.y+designHeight*vy/2)*cssPerPixelY;
  projection={kind:'AIR_LIVE_VIEW_TO_CANVAS_CSS',designWidth,designHeight,designScale,viewScale:[vx,vy],viewport:{x:viewport.x,y:viewport.y,width:viewport.width,height:viewport.height},backingSize:[canvas.width,canvas.height],cssPerViewUnitY:vy*cssPerPixelY};
 }else if(backend==='three'||backend==='preview'){
  scaleX=scaleY=Math.min(raw.width/frame.width,raw.height/frame.height);projection={kind:'CENTERED_CONTAIN_CSS'};
 }else{result.warnings.push('UNSUPPORTED_BACKEND');return result;}
 if(![scaleX,scaleY].every(positive)||![centerX,centerY].every(Number.isFinite)){result.warnings.push('INVALID_PROJECTION');return result;}
 result.status='DIAGNOSTIC_ONLY';result.projection={...projection,scaleX,scaleY};
 for(const command of frame.commands.filter(c=>c.kind==='text')){
  if(!positive(command.fontSize)||!Array.isArray(command.at)||command.at.length!==2||!command.at.every(Number.isFinite)){result.warnings.push('INVALID_TEXT_COMMAND');continue;}
  const nominalTextCssPx=backend==='air'?Math.max(1,command.fontSize*projection.designScale)*projection.cssPerViewUnitY:backend==='preview'?Math.max(1,command.fontSize*scaleY):command.fontSize*scaleY;
  const centerCss=[centerX+command.at[0]*scaleX,centerY-command.at[1]*scaleY];
  if(!positive(nominalTextCssPx)||!centerCss.every(Number.isFinite)){result.warnings.push('INVALID_TEXT_PROJECTION');continue;}
  result.texts.push({id:command.id,text:command.text,fontScene:command.fontSize,nominalTextCssPx,centerCss,warnings:nominalTextCssPx<referenceCssPx?['SMALL_TEXT']:[]});
 }
 if(result.texts.some(t=>t.warnings.length))result.warnings.push('SMALL_TEXT');
 return result;
}
