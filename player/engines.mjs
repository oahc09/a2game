import {ThreeAdapter} from './adapters/three-adapter.mjs';
import {CocosAirAdapter} from './adapters/cocosairjs-adapter.mjs';

const engineId=/^[a-z][a-z0-9-]{0,47}$/;
const documentClaims=new WeakMap();

async function loadSdk(name,load){
 try{return await load();}
 catch(cause){throw new Error(`A2G_E_ENGINE_SDK: 无法加载 ${name}，请检查宿主的 SDK 文件和导入映射。`,{cause});}
}

const builtins=[
 {id:'three',label:'Three.js',async create({canvas,resources,signal}){
  const sdk=await loadSdk('Three.js',()=>import('three'));
  signal?.throwIfAborted();
  return new ThreeAdapter(sdk,canvas,resources);
 }},
 {id:'cocosairjs',label:'CocosAirJS',singleDocument:true,async create({canvas,signal}){
  const sdk=await loadSdk('CocosAirJS',()=>import('cocosair.js'));
  signal?.throwIfAborted();
  return CocosAirAdapter.create(sdk,canvas);
 }}
];

/** Registrations come from trusted host JavaScript. GameSpec has no engine loader. */
export function createPlayerEngineRegistry(){
 const engines=new Map();
 const registry=Object.freeze({
  register({id,label=id,create,singleDocument=false}={}){
   if(typeof id!=='string'||!engineId.test(id)||typeof label!=='string'||!label.trim()||
      typeof create!=='function'||typeof singleDocument!=='boolean')throw Error('A2G_E_ENGINE_CONFIG: invalid engine registration');
   if(engines.has(id))throw Error(`A2G_E_ENGINE_DUPLICATE: ${id}`);
   engines.set(id,Object.freeze({id,label,create,singleDocument}));
   return registry;
  },
  has:id=>engines.has(id),
  list:()=>[...engines.values()].map(({id,label})=>({id,label})),
  async create(id,{canvas,renderSetup,resources,signal}){
   const engine=engines.get(id);
   if(!engine)throw Error(`A2G_E_ENGINE_UNAVAILABLE: ${id}`);
   signal?.throwIfAborted();
   // Claims are per document even when callers create separate registries.
   if(engine.singleDocument){
    const document=canvas.ownerDocument;
    let claimed=documentClaims.get(document);
    if(!claimed){claimed=new Set();documentClaims.set(document,claimed);}
    if(claimed.has(id))throw Error(id==='cocosairjs'?'A2G_E_COCOS_DOCUMENT: reload the page before another CocosAirJS instance':`A2G_E_ENGINE_DOCUMENT: reload the page before another ${id} instance`);
    claimed.add(id);
   }
   let adapter;
   try{
    adapter=await engine.create({canvas,resources,signal});
    if(typeof adapter?.draw!=='function'||typeof adapter?.dispose!=='function'||
       ['prepare','diagnostics','unlockAudio','pauseAudio','releaseVisualsForContextLoss'].some(key=>adapter[key]!==undefined&&typeof adapter[key]!=='function')){
     throw Error(`A2G_E_ENGINE_CONTRACT: ${id}`);
    }
    signal?.throwIfAborted();
    await adapter.prepare?.(renderSetup,resources,signal);
    signal?.throwIfAborted();
    return adapter;
   }catch(error){
    try{if(typeof adapter?.dispose==='function')await adapter.dispose();}
    catch(cleanup){throw new AggregateError([error,cleanup],error.message,{cause:error});}
    throw error;
   }
  }
 });
 for(const engine of builtins)registry.register(engine);
 return registry;
}
