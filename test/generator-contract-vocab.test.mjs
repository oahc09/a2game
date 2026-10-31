import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeRequest} from '../generator/game-plan.mjs';

/** Locks the referenceHostRuleAssembly contract to the trusted Runtime vocabulary.
 * If src/expression.ts or src/validator.ts adds ops, update the constraint AND this list together.
 */
const EXPRESSION_OPS=['and','or','not','eq','ne','lt','lte','gt','gte','add','sub','mul','div'];
const EFFECT_OPS={'state.set':['op','path','value'],'state.add':['op','path','value'],'state.clamp':['op','path','min','max'],'entity.state.set':['op','entity','path','value'],'entity.spawn':['op','prototype','id','state'],'entity.despawn':['op','entity'],'event.emit':['op','eventType','payload'],'feedback.emit':['op','cueType','payload'],'flow.pause':['op'],'timer.schedule':['op','id','delayTicks','periodTicks','eventType','payload']};
const COMPONENT_KINDS=['behavior','core','presentation'];
const FORBIDDEN_COMPONENT_KINDS=['rule-op','recognizer','service'];

test('scopeRequest carries the exact Runtime rule-assembly vocabulary',()=>{
 const scoped=scopeRequest({outputContract:{}},{capabilities:[]},null);
 const text=scoped.request.constraints.referenceHostRuleAssembly;
 assert.ok(text.startsWith('Trusted Runtime contract v0.1.0'),`unexpected prefix: ${text.slice(0,40)}`);
 for(const op of EXPRESSION_OPS)assert.ok(text.includes(` ${op},`)||text.includes(` ${op} `)||new RegExp(`\\b${op}\\b`).test(text),`missing expression op ${op}`);
 for(const [op,fields] of Object.entries(EFFECT_OPS)){
  assert.ok(text.includes(`${op}{${fields.join(',')}}`),`missing effect op ${op}{${fields.join(',')}}`);
 }
 for(const kind of COMPONENT_KINDS)assert.ok(text.includes(kind),`missing component kind ${kind}`);
 for(const kind of FORBIDDEN_COMPONENT_KINDS)assert.ok(text.includes(kind),`forbidden-kind rule must name ${kind}`);
 for(const symbol of ['"<"','">"','"+="'])assert.ok(text.includes(symbol),`invalid-symbol warning must include ${symbol}`);
});
