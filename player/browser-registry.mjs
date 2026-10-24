import {CapabilityRegistry,addReferenceRuleOps,gridSlideMergeImplementation,gridPushImplementation,puzzleImplementations,puzzleServiceIds,realtimeWorldImplementation,realtimeServiceIds,strategyImplementations,strategyServiceIds} from '../dist/index.js';
export async function createBrowserRegistry() {
  const registry=new CapabilityRegistry();
  const indexResponse=await fetch('./capability-index.json');if(!indexResponse.ok)throw Error('能力索引缺失，请运行 npm run catalog:build。');
  const files=await indexResponse.json();if(!Array.isArray(files)||files.length>256||files.some(id=>typeof id!=='string'||!/^a2game\.[a-z0-9.-]+$/.test(id)))throw Error('能力索引格式无效。');
  for(const id of files){
    const url=`../specs/v0.1/samples/capabilities/${id}.capability.json`;
    const response=await fetch(new URL(url,import.meta.url));
    if(!response.ok)throw Error(`Missing capability manifest ${id}`);
    const m=await response.json();
    const implementation=puzzleImplementations[m.id]??strategyImplementations[m.id]??(m.id==='a2game.realtime.world'?realtimeWorldImplementation:m.id==='a2game.puzzle.grid-slide-merge'?gridSlideMergeImplementation: m.id==='a2game.puzzle.grid-push'?gridPushImplementation:
      {role:m.kind==='core'||[...puzzleServiceIds,...realtimeServiceIds,...strategyServiceIds].includes(m.id)?'builtin':m.kind==='rule-op'?'rule-op':
             m.kind==='input-source'||m.kind==='recognizer'?'recognizer':'headless-presentation'});
    registry.register(m,implementation);
  }
  addReferenceRuleOps(registry);
  return registry;
}
