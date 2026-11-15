/** Presentation-only fallback; explicit GameSpec labels always take precedence. */
export function actionLabel(definition,action){
 const label=definition.presentation.hud?.find(item=>item.kind==='button'&&item.bind?.action===action.id)?.text;
 if(typeof label==='string'&&label.trim())return label;
 const names={left:'向左',right:'向右',up:'向上',down:'向下',undo:'撤销',collect:'收集',restart:'重试'};
 if(names[action.id])return names[action.id];
 const code=action.bindings.find(b=>b.source==='keyboard.button')?.config?.code;
 return code?'按键 '+({Space:'空格',Enter:'回车',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'}[code]??code.replace(/^(Key|Digit)/,'')):action.id;
}
