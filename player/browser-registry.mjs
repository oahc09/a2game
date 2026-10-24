import {CapabilityRegistry,addReferenceRuleOps,gridSlideMergeImplementation,gridPushImplementation} from '../dist/index.js';
const files=[
'a2game.core.flow','a2game.core.rules','a2game.core.state','a2game.input.keyboard.button',
'a2game.input.touch.tap','a2game.input.touch.swipe','a2game.puzzle.grid-slide-merge','a2game.puzzle.grid-push','a2game.rules.state-add','a2game.visual.text','a2game.visual.scene2d'];
export async function createBrowserRegistry() {
  const registry=new CapabilityRegistry();
  for(const id of files){
    const url=`../specs/v0.1/samples/capabilities/${id}.capability.json`;
    const response=await fetch(new URL(url,import.meta.url));
    if(!response.ok)throw Error(`Missing capability manifest ${id}`);
    const m=await response.json();
    const implementation=m.id==='a2game.puzzle.grid-slide-merge'?gridSlideMergeImplementation: m.id==='a2game.puzzle.grid-push'?gridPushImplementation:
      {role:m.kind==='core'?'builtin':m.kind==='rule-op'?'rule-op':
             m.kind==='input-source'||m.kind==='recognizer'?'recognizer':'headless-presentation'};
    registry.register(m,implementation);
  }
  addReferenceRuleOps(registry);
  return registry;
}
