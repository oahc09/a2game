/** Create once: controller-authored revisions; never overwrite an existing candidate. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=import.meta.dirname,source=resolve(root,'../../games/phase2/sokoban/01-first-light');
for(const name of ['v1','v2'])if(existsSync(join(root,name)))throw Error(`Candidate ${name} already exists`);
const original=Object.fromEntries(['game','conformance','solution'].map(name=>[name,JSON.parse(readFileSync(join(source,name+'.json'),'utf8'))]));
const revisions=[structuredClone(original),structuredClone(original)],v2=revisions[1];
v2.game.revision=2;v2.game.meta.description='光圈向右移动一格：绕到箱子左侧，连续推动两次。方向键移动，Z 撤销。';v2.game.meta.author='Cindy controller revision; not independent model generation';
v2.game.state.goals.initial=[19];const wood=v2.game.presentation.scene2d.repeat.find(x=>x.id==='boxes').template.find(x=>x.id==='wood');wood.fill.map={'19':'#94b88a'};
v2.game.presentation.hud.find(x=>x.id==='hint').text='光圈向右移动一格；连续推动两次。';v2.solution.push({action:'right',ticks:1});
const steps=v2.conformance.cases.find(x=>x.id==='finish-level').steps,assertIndex=steps.findIndex(x=>x.op==='assert');steps.splice(assertIndex,0,{op:'assert',path:'/flow/status',equals:'playing'},{op:'injectAction',action:'right',phase:'press'},{op:'injectAction',action:'right',phase:'release'},{op:'step',ticks:1});
for(let i=0;i<2;i++){const dir=join(root,'v'+(i+1));mkdirSync(dir);for(const [name,value] of Object.entries(revisions[i]))writeFileSync(join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
console.log('Created independent G01 v1/v2 authoring candidates.');
