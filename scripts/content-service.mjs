/** Trusted local content admission with optional durable, context-scoped records. */
import {readFileSync,readdirSync,existsSync,mkdirSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {HeadlessRuntime,compileGame,projectPresentation,sha256Canonical,capabilityManifestDigest,verifyReleasedGame,CONTENT_PROFILE,CONTENT_MAX_BYTES,A2GameError,mobileInputSources,gamepadInputSources} from '../dist/index.js';
import {validateJsonTree} from '../dist/utils.js';
import {root,makeRegistry} from './registry.mjs';
import {createAssetPolicy} from './asset-policy.mjs';
import {resolvePython} from './python-runtime.mjs';

export class ContentError extends Error {
  constructor(code,message,statusCode=422,stage='policy',diagnostics=[]){
    super(message);Object.assign(this,{code,statusCode,stage,diagnostics});
  }
}
const reject=(code,message,pointer='')=>{throw new ContentError(code,message,422,'policy',[{pointer,message}]);};
function assertProfile(game,effective){
  if(Object.keys(game.extensions??{}).length)reject('A2G_E_HOST_PROFILE','当前宿主不支持自定义 extensions。','/extensions');
  if(!game.presentation.scene2d||game.scenes.length!==1||(game.world.dimension==='3d'&&!game.presentation.stage))
    reject('A2G_E_HOST_PROFILE','当前导入支持单场景 scene2d 或声明 visual.stage 的 3D 游戏。','/presentation/scene2d');
  const supported={'keyboard.button':'a2game.input.keyboard.button','touch.tap':'a2game.input.touch.tap','touch.swipe':'a2game.input.touch.swipe',...mobileInputSources,...gamepadInputSources};
  const declared=[...game.requires.all,...(game.requires.anyOf??[]).flat()];
  for(const [index,action] of game.inputs.actions.entries()){
    for(const [bi,binding] of action.bindings.entries()){
      const cap=supported[binding.source],ptr=`/inputs/actions/${index}/bindings/${bi}`;
      if(!cap||!declared.some(item=>item.id===cap&&item.version==='0.1.0'))reject('A2G_E_HOST_PROFILE','输入绑定未声明受支持的能力或回退能力。',ptr);
      if(binding.source==='keyboard.button'&&typeof binding.config?.code!=='string')reject('A2G_E_HOST_PROFILE','键盘绑定需要 code。',ptr+'/config/code');
      if(binding.source==='touch.swipe'&&!['left','right','up','down'].includes(binding.config?.direction))reject('A2G_E_HOST_PROFILE','Swipe 绑定需要合法 direction。',ptr+'/config/direction');
    }
    if(!action.bindings.some(binding=>effective.capabilities.some(item=>item.id===supported[binding.source])))
      reject('A2G_E_HOST_PROFILE','此动作没有可用的输入绑定。',`/inputs/actions/${index}`);
  }
}
function validateFull(python,payload){
  return new Promise((accept,rejectPromise)=>{
    const child=spawn(python,[resolve(root,'scripts/validate-content.py')],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
    let output='',overflow=false;
    const timeout=setTimeout(()=>{child.kill();rejectPromise(new ContentError('A2G_E_VALIDATOR_TIMEOUT','完整 Schema 校验超时，请缩小输入后重试。',503,'infra'));},8000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1024*1024){overflow=true;child.kill();}});
    child.stderr.resume(); // Do not expose interpreter paths or stacks to uploaded content.
    child.stdin.on('error',()=>{});
    child.once('error',()=>{clearTimeout(timeout);rejectPromise(new ContentError('A2G_E_VALIDATOR_UNAVAILABLE','完整 Schema 校验器不可用，请安装 requirements-dev.txt 并检查 A2GAME_PYTHON。',503,'infra'));});
    child.once('close',code=>{
      clearTimeout(timeout);
      let result;try{result=JSON.parse(output);}catch{}
      if(overflow||![0,1].includes(code)||!['PASS','FAIL'].includes(result?.status))
        return rejectPromise(new ContentError('A2G_E_VALIDATOR_UNAVAILABLE','完整 Schema 校验器无法完成校验，请检查 Python 环境。',503,'infra'));
      if(result.errors?.some(item=>item.pointer.startsWith('/trustedCapabilities/')))
        return rejectPromise(new ContentError('A2G_E_VALIDATOR_CONTEXT','本地可信能力目录未通过完整校验，请修复部署配置。',503,'infra',result.errors));
      if(result.status!=='PASS')return rejectPromise(new ContentError(result.stage==='parse'?'A2G_E_JSON_PARSE':'A2G_E_SCHEMA','游戏 JSON 未通过完整校验。',422,result.stage,result.errors));
      accept(result);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
function contextFiles(){
  const flat=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(item=>item.isDirectory()?flat(`${dir}/${item.name}`):[`${dir}/${item.name}`]);
  return [...flat('dist').filter(path=>path.endsWith('.js')),...flat('specs/v0.1/schemas'),...flat('specs/v0.1/capabilities'),
    'scripts/registry.mjs','scripts/content-service.mjs','scripts/validate-content.py','scripts/asset-policy.mjs','project/asset-policy.json'];
}
// Private local data, never served as static files. A final record appears only after a complete write.
function diskStore(directory,contextDigest,maxReleases){
  const base=resolve(directory),current=resolve(base,contextDigest),recordName=/^[a-f0-9]{64}\.json$/;
  const integrity=()=>new ContentError('A2G_E_RELEASE_INTEGRITY','本地发布记录损坏或已改变，请检查存储目录并重新导入。',409,'integrity');
  const access=operation=>{try{return operation();}catch(error){if(error instanceof ContentError)throw error;console.error(JSON.stringify({event:'content-store-error',code:error.code??'UNKNOWN'}));throw new ContentError('A2G_E_RELEASE_STORE','无法读写本地发布存储，请检查 A2GAME_CONTENT_DIR 和服务日志。',503,'infra');}};
  access(()=>{mkdirSync(current,{recursive:true});if(!lstatSync(current).isDirectory()||lstatSync(current).isSymbolicLink())throw integrity();});
  const count=()=>access(()=>readdirSync(current).filter(name=>recordName.test(name)).length);
  const read=digest=>access(()=>{
    const path=resolve(current,digest+'.json');let info;
    try{info=lstatSync(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(!info.isFile()||info.isSymbolicLink()||info.size>CONTENT_MAX_BYTES*4)throw integrity();
    try{return new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(path));}catch{throw integrity();}
  });
  return {
    read,count,
    inOtherContext:digest=>access(()=>readdirSync(base,{withFileTypes:true}).some(item=>item.isDirectory()&&/^[a-f0-9]{64}$/.test(item.name)&&item.name!==contextDigest&&existsSync(resolve(base,item.name,digest+'.json')))),
    write(digest,encoded){return access(()=>{
      const existing=read(digest);if(existing!==null)return existing;
      if(count()>=maxReleases)throw new ContentError('A2G_E_RELEASE_CAPACITY','当前校验环境的本地发布存储已满，请管理存储或使用新的 A2GAME_CONTENT_DIR。',409,'policy');
      if(Buffer.byteLength(encoded,'utf8')>CONTENT_MAX_BYTES*4)throw new ContentError('A2G_E_CONTENT_SIZE','规范化后的发布记录超出存储预算。',413,'policy');
      const temporary=resolve(current,`.${digest}.${randomUUID()}.tmp`),target=resolve(current,digest+'.json');
      let fd;
      try{
        fd=openSync(temporary,'wx');writeFileSync(fd,encoded,'utf8');fsyncSync(fd);closeSync(fd);fd=undefined;
        // One writer process per directory. Same-directory rename publishes complete bytes on exFAT too.
        if(read(digest)===null)renameSync(temporary,target);
        return read(digest);
      }finally{if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary);}
    });}
  };
}
export function createContentService({python,maxReleases=32,storageDirectory=null}={}){
  if(!Number.isInteger(maxReleases)||maxReleases<1||maxReleases>32)throw new ContentError('A2G_E_RELEASE_CONFIG','maxReleases 必须为 1–32 的整数。',503,'infra');
  if(storageDirectory!==null&&(typeof storageDirectory!=='string'||!storageDirectory.trim()))throw new ContentError('A2G_E_RELEASE_CONFIG','本地发布目录不能为空。',503,'infra');
  python=resolvePython(python);
  const fingerprints=()=>Object.fromEntries(contextFiles().map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')]));
  const contextDigest=sha256Canonical(fingerprints()),manifests=makeRegistry().list(),manifestDigest=capabilityManifestDigest(manifests);
  const assetPolicy=createAssetPolicy();
  const store=storageDirectory===null?null:diskStore(storageDirectory,contextDigest,maxReleases);
  const records=new Map();let active=0;
  const assertContext=()=>{if(sha256Canonical(fingerprints())!==contextDigest)throw new ContentError('A2G_E_RELEASE_STALE','校验环境已改变，请重启本地服务并重新导入。',409,'integrity');};
  const assertDigest=digest=>{if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw new ContentError('A2G_E_RELEASE_INTEGRITY','发布标识无效。',400,'integrity');};
  const assertRecord=(encoded,digest)=>{
    try{
      const envelope=JSON.parse(encoded);verifyReleasedGame(envelope,digest,manifestDigest);
      if(envelope.receipt.contextDigest!==contextDigest)throw Error('Context differs');
      if(sha256Canonical(envelope.resources)!==sha256Canonical(assetPolicy.resolve(envelope.definition)))throw Error('Resource policy differs');
      if(records.has(digest)&&records.get(digest)!==encoded)throw Error('Immutable record differs');
      return envelope;
    }catch{throw new ContentError('A2G_E_RELEASE_INTEGRITY','本地发布记录与已校验内容或环境不符，请检查存储后重新导入。',409,'integrity');}
  };
  const validate=async(text,game)=>{
    if(active>=2)throw new ContentError('A2G_E_VALIDATOR_BUSY','校验任务繁忙，请稍后重试。',429,'infra');
    active++;
    try{
      validateJsonTree(game);
      const result=await validateFull(python,{text,game,manifests});
      const plan=compileGame(game,makeRegistry());assertProfile(plan.definition,plan.effective);
      const runtime=new HeadlessRuntime(plan.definition,makeRegistry());
      try{projectPresentation(game,runtime.observe());runtime.start();runtime.step(1);projectPresentation(game,runtime.observe());}finally{runtime.dispose();}
      const resources=assetPolicy.resolve(game);assertContext();return {...result,resources};
    }catch(error){
      if(error instanceof A2GameError)error=new ContentError(error.code,error.message,422,'semantic',[{...error.info,pointer:error.info.jsonPointer??'',message:error.message}]);
      if(error instanceof ContentError)error.diagnostics=error.diagnostics.map(d=>{
        const pointer=d.jsonPointer??d.pointer??'',rule=/^\/rules\/(\d+)(?:\/|$)/.exec(pointer);
        return {...d,...(rule&&game.rules?.[Number(rule[1])]?.id?{ruleId:game.rules[Number(rule[1])].id}:{})};
      });
      throw error;
    }finally{active--;}
  };
  return {
    async release(text,sourceText=text){
      if(Buffer.byteLength(text,'utf8')>CONTENT_MAX_BYTES)throw new ContentError('A2G_E_CONTENT_SIZE','JSON 文件超过 256 KiB 上限。',413,'parse');
      assertContext();
      let game;
      try{game=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new ContentError('A2G_E_JSON_PARSE','文件不是有效 JSON。',400,'parse');}
      try{validateJsonTree(game);}catch(error){throw new ContentError(error.code,error.message,422,'parse',[{pointer:error.info?.jsonPointer??'',message:error.message}]);}
      const result=await validate(sourceText.replace(/^\uFEFF/,''),game);
      const digest=sha256Canonical(game);
      const existing=store?store.read(digest):records.get(digest);
      if(existing!=null){const envelope=assertRecord(existing,digest);records.set(digest,existing);return envelope.receipt;}
      if((store?.count()??records.size)>=maxReleases)throw new ContentError('A2G_E_RELEASE_CAPACITY','本地发布存储已满，请管理存储或使用新的 A2GAME_CONTENT_DIR。',409,'policy');
      const receipt={format:'a2game-content-release',receiptVersion:1,status:'PASS',profile:CONTENT_PROFILE,
        id:game.id,revision:game.revision,sha256Jcs:digest,manifestDigest,contextDigest,
        resourcesDigest:sha256Canonical(result.resources),validator:result.validator,createdAt:new Date().toISOString()};
      const encoded=records.get(digest)??JSON.stringify({receipt,definition:game,resources:result.resources});
      const saved=store?store.write(digest,encoded):encoded;assertRecord(saved,digest);records.set(digest,saved);
      return JSON.parse(saved).receipt;
    },
    async read(digest){
      assertDigest(digest);assertContext();
      const encoded=store?store.read(digest):records.get(digest);
      if(encoded==null){
        if(store?.inOtherContext(digest))throw new ContentError('A2G_E_RELEASE_STALE','该内容属于旧校验环境，请重新导入以取得当前回执。',409,'integrity');
        throw new ContentError('A2G_E_RELEASE_NOT_FOUND','发布回执不存在，请重新导入 JSON。',404,'integrity');
      }
      const envelope=assertRecord(encoded,digest);
      if(!records.has(digest)){
        // Disk is input too: a fresh process revalidates before trusting a stored record.
        await validate(JSON.stringify(envelope.definition),envelope.definition);
        if(store.read(digest)!==encoded)throw new ContentError('A2G_E_RELEASE_INTEGRITY','校验期间本地发布记录发生变化，请检查存储后重试。',409,'integrity');
        records.set(digest,encoded);
      }
      return envelope;
    },
    async exportBundle(digest){const {definition,resources}=await this.read(digest);return {format:'a2game-release-bundle',bundleVersion:1,sha256Jcs:digest,definition,resources};},
    async importBundle(text){
      let bundle;try{bundle=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new ContentError('A2G_E_JSON_PARSE','内容包不是有效 JSON。',400,'parse');}
      validateJsonTree(bundle);
      if(bundle?.format!=='a2game-release-bundle'||bundle.bundleVersion!==1||!bundle.definition||typeof bundle.definition!=='object'||Array.isArray(bundle.definition)||!Array.isArray(bundle.resources)||typeof bundle.sha256Jcs!=='string'||Object.keys(bundle).some(key=>!['format','bundleVersion','sha256Jcs','definition','resources'].includes(key))||
        sha256Canonical(bundle.definition)!==bundle.sha256Jcs)
        throw new ContentError('A2G_E_RELEASE_INTEGRITY','内容包的格式、内容 SHA 或资源清单不符。',422,'integrity');
      let expected;try{expected=assetPolicy.resolve(bundle.definition);}catch(error){if(error instanceof TypeError)throw new ContentError('A2G_E_RELEASE_INTEGRITY','内容包资源结构无效。',422,'integrity');throw error;}
      if(sha256Canonical(bundle.resources)!==sha256Canonical(expected))throw new ContentError('A2G_E_RESOURCE_INTEGRITY','内容包资源清单不符。',422,'integrity');
      // Sender metadata never grants trust: the receiving host performs its complete admission again.
      return this.release(JSON.stringify(bundle.definition),text);
    },
    readAsset(digest){assertDigest(digest);assertContext();return assetPolicy.readDigest(digest);},
    get size(){return store?.count()??records.size;}
  };
}
