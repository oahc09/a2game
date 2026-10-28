/** Literal, host-approved evidence references; no paths, expressions or commands from a model are evaluated. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {sha256Canonical} from '../dist/index.js';
import {checkG3SuiteBudget} from './g3-playthrough.mjs';
export function bindAgentEvidence(output,registry){
 assert.equal(output.format,'a2game-referenced-generation-output');assert.equal(output.version,1);
 const approved=ref=>{assert.match(ref??'',/^[a-f0-9]{64}$/);const entry=registry[ref];assert.ok(entry,'未批准的证据引用。');assert.equal(sha256Canonical(entry.value),ref,'引用数据摘要不符。');return entry;};
 const game=approved(output.gameRef),solution=approved(output.solutionRef);assert.equal(game.kind,'game');assert.equal(solution.kind,'solution');assert.equal(solution.gameSha256,output.gameRef);assert.ok(Array.isArray(solution.value)&&solution.value.length<=256);
 assert.ok(!(output.conformance&&output.conformanceRef),'测试只能选择一种来源。');
 const suite=output.conformanceRef?approved(output.conformanceRef):undefined;
 if(suite){assert.equal(suite.kind,'conformance');assert.equal(suite.gameSha256,output.gameRef);}
 let included=0;const conformance=structuredClone(suite?.value??output.conformance);
 for(const c of conformance.cases)c.steps=c.steps.flatMap((s,index)=>{if(s.op!=='includeSolution')return [s];assert.equal(index,1);assert.equal(c.steps[0].op,'start');assert.equal(s.ref,output.solutionRef);assert.equal(c.seed,solution.seed);included++;
  const total=solution.value.reduce((n,r)=>{assert.ok(Number.isInteger(r.ticks)&&r.ticks>0);return n+r.ticks;},0);assert.ok(total<=12000);
  const scheduled=solution.value.every(row=>!row.action&&Array.isArray(row.raw)&&row.raw.length<=64&&row.raw.every(raw=>raw.tickIndex===undefined||Number.isInteger(raw.tickIndex)&&raw.tickIndex>=0&&raw.tickIndex<total));
  if(scheduled){let offset=0;const steps=solution.value.flatMap(row=>{const events=row.raw.map(raw=>({op:'injectRaw',raw:{...raw,tickIndex:raw.tickIndex??offset}}));offset+=row.ticks;return events;});return [...steps,{op:'step',ticks:total}];}
  return solution.value.flatMap(row=>{const steps=[];if(row.action)steps.push({op:'injectAction',action:row.action,phase:'press',...(row.value===undefined?{}:{value:row.value})},{op:'injectAction',action:row.action,phase:'release'});if(row.raw){assert.ok(Array.isArray(row.raw)&&row.raw.length<=64);steps.push(...row.raw.map(raw=>({op:'injectRaw',raw})));}steps.push({op:'step',ticks:row.ticks});return steps;});});
 assert.ok(suite||included>0,'需在正例中实际重放引用解法。');checkG3SuiteBudget(conformance);
 const materializedGame=structuredClone(game.value);
 if(output.presentation!==undefined){assert.ok(output.presentation&&typeof output.presentation==='object'&&!Array.isArray(output.presentation));materializedGame.presentation=structuredClone(output.presentation);materializedGame.revision++;}
 return {format:'a2game-generation-output',version:1,game:materializedGame,conformance,solution:structuredClone(solution.value),provenance:structuredClone(output.provenance)};
}
if(process.argv[1]===import.meta.filename){assert.equal(process.argv[2],'--read-output');const path=resolve(process.argv[3]),binding=JSON.parse(readFileSync(resolve(dirname(path),'binding.json'),'utf8')),bytes=readFileSync(path);assert.equal(createHash('sha256').update(bytes).digest('hex'),binding.materializedSha256);process.stdout.write(JSON.stringify(JSON.parse(bytes)));}
