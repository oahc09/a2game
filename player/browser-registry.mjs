import {CapabilityRegistry,addReferenceRuleOps,trustedModules,trustedServiceIds} from '../dist/index.js';
export async function createBrowserRegistry() {
  const registry=new CapabilityRegistry();
  const indexResponse=await fetch('./capability-index.json');if(!indexResponse.ok)throw Error('能力索引缺失，请运行 npm run catalog:build。');
  const files=await indexResponse.json();if(!Array.isArray(files)||files.length>256||files.some(id=>typeof id!=='string'||!/^a2game\.[a-z0-9.-]+$/.test(id)))throw Error('能力索引格式无效。');
  for(const id of files){
    const url=`../specs/v0.1/capabilities/${id}.capability.json`;
    const response=await fetch(new URL(url,import.meta.url));
    if(!response.ok)throw Error(`Missing capability manifest ${id}`);
    const m=await response.json();
    const implementation=trustedModules[m.id]??(m.kind==='core'||trustedServiceIds.includes(m.id)?{role:'builtin'}:m.kind==='rule-op'?{role:'rule-op'}:m.kind==='recognizer'||m.kind==='input-source'?{role:'recognizer'}:m.kind==='presentation'?{role:'headless-presentation'}:undefined);
    if(!implementation)throw Error('No trusted implementation for '+m.id);
    registry.register(m,implementation);
  }
  addReferenceRuleOps(registry);
  return registry;
}
