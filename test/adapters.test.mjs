import test from 'node:test';
import assert from 'node:assert/strict';
import {CocosAirAdapter} from '../player/adapters/cocosairjs-adapter.mjs';
import {ThreeAdapter} from '../player/adapters/three-adapter.mjs';
import {HeadlessRuntime,projectPresentation} from '../dist/index.js';
import {makeRegistry,readJson,spec} from '../scripts/registry.mjs';
import {resolve} from 'node:path';
const sampleGame=()=>readJson(resolve(spec,'games/grid-push.game.json'));
const sampleFrame=()=>{
  const definition=sampleGame(),rt=new HeadlessRuntime(definition,makeRegistry());rt.start();
  const frame=projectPresentation(definition,rt.observe());rt.dispose();return frame;
};
function mockThree(){
  const tally={renders:0,geometryDisposes:0,materialDisposes:0,textureDisposes:0,rendererDisposed:false,created:0};
  class Scene{constructor(){this.children=[];}add(v){this.children.push(v);}remove(v){this.children=this.children.filter(x=>x!==v);}}
  class Camera{constructor(){this.position={set(){}};}lookAt(){}updateProjectionMatrix(){}}
  class Renderer{setClearColor(){}setSize(){}setPixelRatio(){}render(){tally.renders++;}dispose(){tally.rendererDisposed=true;}}
  class Geometry{constructor(){tally.created++;}dispose(){tally.geometryDisposes++;}}
  class Material{constructor(o){Object.assign(this,o);}dispose(){tally.materialDisposes++;}}
  class Texture{dispose(){tally.textureDisposes++;}}
  class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(){}};}}
  return {THREE:{Scene,OrthographicCamera:Camera,WebGLRenderer:Renderer,PlaneGeometry:Geometry,CircleGeometry:Geometry,Mesh,MeshBasicMaterial:Material,CanvasTexture:Texture},tally};
}
function mockAir(){
  const tally={started:0,released:0,rect:0,circle:0,destroys:0,labels:0,createOptions:null};
  class Node{constructor(name){this.name=name;this.children=[];this.comp=new Map();}addChild(child){this.children.push(child);}addComponent(Type){const v=new Type();this.comp.set(Type,v);return v;}getComponent(Type){return this.comp.get(Type);}destroy(){tally.destroys++;}}
  class Scene extends Node{}
  class UITransform{setContentSize(){}}
  class Graphics{clear(){}rect(){tally.rect++;}circle(){tally.circle++;}fill(){}set fillColor(x){}}
  class Label{constructor(){this.string='';}}
  class Color{constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}}
  const air={Node,Scene,UITransform,Graphics,Label,Color,Layers:{Enum:{UI_2D:1}},
      createAirApp:async(opts)=>{tally.createOptions=opts;return {run(){tally.started++;},releaseScene:async()=>{tally.released++;}}},
      createUICanvas:(scene,name)=>{const node=new Node(name);scene.addChild(node);return node;},
      labelNode:(parent,text,name)=>{tally.labels++;const node=new Node(name);node.addComponent(Label).string=text;parent.addChild(node);return node;}};
  return {air,tally};
}
test('Three.js adapter projects generic PresentationFrame; reuses and releases resources (mock only)',()=>{
  const oldDoc=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({measureText:text=>({width:text.length*36}),fillText(){},fillStyle:'',font:'',textAlign:'',textBaseline:''})})};
  try{
    const {THREE,tally}=mockThree(), adapter=new ThreeAdapter(THREE,{getBoundingClientRect:()=>({width:800,height:600})});
    const initial=sampleFrame(), frozen=structuredClone(initial);
    adapter.draw(initial);const before=tally.created;
    adapter.draw(initial);assert.equal(tally.created,before);
    const originalMeshes=[...adapter.meshes];
    adapter.draw({...initial,commands:initial.commands.map(command=>({...command,at:[command.at[0]+.1,command.at[1]]}))});
    assert.equal(tally.created,before,'moving objects must preserve their GPU resources');assert.deepEqual(adapter.meshes,originalMeshes);
    adapter.draw({...initial,commands:[...initial.commands].reverse()});assert.equal(tally.created,before);assert.equal(adapter.meshes[0],originalMeshes.at(-1));
    adapter.draw(initial);assert.equal(tally.created,before);
    adapter.draw({...initial,commands:[...initial.commands,{kind:'text',id:'extra',at:[0,0],text:'hello',fontSize:.4,fill:'#ffffff'}]});
    assert.ok(tally.renders>=3);assert.deepEqual(initial,frozen);
    adapter.draw(initial);adapter.releaseVisualsForContextLoss();assert.equal(adapter.meshes.length,0);
    adapter.draw(initial);assert.ok(adapter.meshes.length>0,'Context restore must rebuild the same frame');
    adapter.dispose();
    const disposedCount=tally.geometryDisposes;adapter.dispose();assert.equal(tally.geometryDisposes,disposedCount);
    assert.throws(()=>adapter.draw(initial),/A2G_E_DISPOSED/);
    assert.equal(tally.geometryDisposes,tally.materialDisposes);
    assert.ok(tally.textureDisposes>=1);
    assert.ok(tally.geometryDisposes>0&&tally.rendererDisposed);
  }finally{globalThis.document=oldDoc;}
});
test('CocosAirJS adapter consumes same PresentationFrame and releases scene (mock only)',async()=>{
  const {air,tally}=mockAir();const adapter=await CocosAirAdapter.create(air,{});
  assert.equal(tally.started,1);assert.equal(tally.createOptions.screenMode,'container');
  const initial=sampleFrame(), frozen=structuredClone(initial);
  adapter.draw(initial);const count=tally.rect, circles=tally.circle;
  adapter.draw(initial);assert.equal(tally.rect,count);assert.equal(tally.circle,circles);
  assert.ok(count>0&&circles>0);
  adapter.draw({...initial,commands:[...initial.commands,{id:'extra',kind:'text',at:[0,0],text:'hello',fontSize:.5,fill:'#ffffff'}]});
  assert.ok(tally.labels>0);assert.deepEqual(initial,frozen);
  await adapter.dispose();await adapter.dispose();assert.equal(tally.released,1);assert.ok(tally.destroys>0);
  assert.throws(()=>adapter.draw(initial),/A2G_E_DISPOSED/);
});

// Structural regression only; scripts/painter-order-smoke.mjs checks real SDK pixels.
test('Three scene2d primitives share one painter queue across text and solid shapes (mock only)',()=>{
 const oldDoc=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({measureText:()=>({width:128}),fillText(){}})})};
 try{
  const {THREE}=mockThree(),adapter=new ThreeAdapter(THREE,{getBoundingClientRect:()=>({width:320,height:320})});
  const text={id:'label',kind:'text',at:[0,0],text:'AB',fontSize:1,fill:'#ffffff'},rect={id:'tile',kind:'rect',at:[0,0],size:[3,3],fill:'#ff0000'},circle={id:'disc',kind:'circle',at:[0,0],radius:1,fill:'#00ff00'};
  for(const commands of [[text,rect],[rect,text],[text,rect,circle],[circle,text,rect]]){
   adapter.draw({width:4,height:4,background:'#000000',commands});
   assert.deepEqual(adapter.meshes.map(m=>m.renderOrder),commands.map((_,i)=>i));
   assert.ok(adapter.meshes.every(m=>m.material.transparent===true&&m.material.depthTest===false&&m.material.depthWrite===false));
   assert.deepEqual(adapter.meshes.map(m=>!!m.material.map),commands.map(c=>c.kind==='text'));
  }
  adapter.dispose();assert.equal(adapter.meshes.length,0);
 }finally{globalThis.document=oldDoc;}
});
