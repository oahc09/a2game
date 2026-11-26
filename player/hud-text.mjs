import {readPointer} from '../dist/index.js';

export function projectHudText(definition,state){
 const hudLines=[];
 for(const item of definition.presentation.hud??[]){
   if(item.kind!=='text')continue;
   const boundText=item.bind?.text;
   if(boundText?.template&&Array.isArray(boundText.args)){
     const args=boundText.args.map(x=>x.state?readPointer(state,x.state):'?');
     hudLines.push(boundText.template.replace(/\{(\d+)\}/g,(all,index)=>index<args.length?String(args[index]):all));
   }else if(boundText&&Object.hasOwn(boundText,'literal'))hudLines.push(String(boundText.literal));
   else if(boundText?.state)hudLines.push(String(readPointer(state,boundText.state)));
   else if(typeof item.bind?.state==='string'){
     // HUD bindings are optional metadata; a bad pointer must not stop the game.
     try{const value=readPointer(state,item.bind.state);if(['string','number','boolean'].includes(typeof value)){const text=typeof value==='boolean'?(value?'是':'否'):String(value),ratio=typeof value==='number'&&typeof item.text==='string'?item.text.match(/^(.+?)\s*\/\s*(\d+)\s*$/):null;hudLines.push(ratio?`${ratio[1].trim()}：${text} / ${ratio[2]}`:item.text?`${item.text}：${text}`:text);}}catch{}
   }else if(typeof item.text==='string'&&item.text)hudLines.push(item.text);
 }
 return hudLines;
}
