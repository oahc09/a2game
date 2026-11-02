// Static host-layout regression only; actual viewport/SDK rectangles require browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../player/index.html',import.meta.url),'utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
function elements(){
 const nodes=[],stack=[],voids=new Set(['meta','link','input','br','hr','img']);
 const body=html.slice(html.indexOf('<body>'),html.indexOf('<script type="module"'));
 for(const token of body.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)){
  const [,closing,tag,attributes]=token;
  if(closing){assert.equal(stack.pop()?.tag,tag);continue;}
  const attrs=Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const node={tag,attrs,parent:stack.at(-1),index:token.index,hidden:/\bhidden(?:\s|$)/.test(attributes)};nodes.push(node);
  if(!voids.has(tag)&&!attributes.endsWith('/'))stack.push(node);
 }
 return nodes;
}
const nodes=elements(),byId=id=>{const found=nodes.filter(n=>n.attrs.id===id);assert.equal(found.length,1,id+' remains unique');return found[0];};
test('terminal result is a normal-flow sibling after the canvas stage, never its overlay child',()=>{
 const canvas=byId('GameCanvas'),stage=canvas.parent,result=byId('stageResult');
 assert.equal(stage.attrs.class,'stage');assert.equal(result.parent,stage.parent);assert.equal(result.parent.attrs.class,'playfield');assert.ok(result.index>stage.index);assert.ok(result.index<byId('instructions').index);assert.equal(result.hidden,true);
 assert.equal(byId('stageRestart').parent,result);assert.equal(byId('stageRestart').attrs.type,'button');
});
test('terminal banner cannot become positioned over the canvas at narrow breakpoints',()=>{
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].split(',').map(x=>x.trim()).includes('.stage-result'));
 assert.ok(rules.length>0);assert.match(rules[0][2],/position\s*:\s*static\s*;/);assert.match(rules[0][2],/flex-wrap\s*:\s*wrap\s*;/);
 for(const [,selector,body]of rules){assert.doesNotMatch(body,/position\s*:\s*(?:absolute|fixed|sticky|relative)\b|(?:^|;)\s*(?:inset(?:-[\w-]+)?|top|right|bottom|left|transform|translate|z-index)\s*:/,selector);assert.doesNotMatch(body,/margin(?:-[\w-]+)?\s*:\s*-/);}
 assert.match(css,/\.stage-result>div\{[^}]*min-width:0;[^}]*overflow-wrap:anywhere/);
});
test('terminal layout preserves hidden, canvas keyboard focus and the existing accessible status channel',()=>{
 assert.match(css,/\[hidden\]\{display:none!important\}/);const canvas=byId('GameCanvas');assert.equal(canvas.attrs.tabindex,'0');assert.equal(canvas.attrs['aria-label'],'游戏画面');assert.equal(canvas.attrs['aria-describedby'],'instructions');
 const status=byId('resultMessage');assert.equal(status.attrs.role,'status');assert.equal(status.attrs['aria-live'],'polite');
 for(const id of ['stageResultTitle','stageResultDetail'])assert.equal(byId(id).parent.attrs['aria-hidden'],'true');
 assert.equal(byId('stageRestart').hidden,false);assert.equal(byId('restart').tag,'button');assert.equal(byId('pause').tag,'button');
});
