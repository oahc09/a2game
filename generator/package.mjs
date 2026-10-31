/** Content only: no executable files, Runtime, provider config or private generation logs. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {safePath,testGeneratedDirectory} from './index.mjs';
import {validateGamePlan,checkPlanGame,checkReferenceInputProfile} from './game-plan.mjs';
import {runGeneratorWorker} from './process.mjs';
import {createContentService} from '../scripts/content-service.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fail=code=>Object.assign(Error('游戏包操作未完成，请检查兼容宿主、资源和完整性后重试。'),{code});
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=(path,limit=768*1024)=>{const b=readFileSync(safePath(path));if(b.length>limit)throw fail('A2G_GEN_PACKAGE_SIZE');return new TextDecoder('utf-8',{fatal:true}).decode(b);};
const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const privateRun=()=>{const directory=join(root,'.a2game/generator-package',randomUUID());mkdirSync(directory,{recursive:true});return directory;};
export async function exportGamePackage(input,{signal,timeoutMs=60000}={}){
 const directory=safePath(input),tested=await testGeneratedDirectory(directory,{signal,timeoutMs});
 if(tested.status!=='PASS_REFERENCE')throw fail(tested.code??'A2G_GEN_PACKAGE_VALIDATION');
 const game=JSON.parse(read(join(directory,'game.json'),256*1024)),service=createContentService();
 const receipt=await service.release(JSON.stringify(game));
 const files={content:await service.exportBundle(receipt.sha256Jcs),conformance:JSON.parse(read(join(directory,'conformance.json'))),solution:JSON.parse(read(join(directory,'solution.json')))};
 if(existsSync(join(directory,'game-plan.json')))files.gamePlan=await validateGamePlan(read(join(directory,'game-plan.json'),64*1024),{signal,timeoutMs});
 const policy=JSON.parse(readFileSync(join(root,'project/asset-policy.json'),'utf8'));
 const assets=files.content.resources.map(resource=>{
  const trusted=policy.entries.find(entry=>entry.uri===resource.uri&&entry.integrity===resource.integrity);
  if(!trusted)throw fail('A2G_GEN_PACKAGE_ASSET');
  return {uri:resource.uri,sha256:resource.sha256,bytes:resource.bytes,source:trusted.source,license:trusted.license};
 });
 const result={format:'a2game-generator-package',version:1,compatibility:{release:'1.0.0',specVersion:'0.1.0',profile:receipt.profile,manifestDigest:receipt.manifestDigest,backends:['air','three'],requiresInstalledTrustedHost:true},files,assets,hashes:Object.fromEntries(Object.entries(files).map(([key,value])=>[key,sha(value)])),provenance:{kind:'EXPORTED_CONTENT',G3:'NOT_RUN',humanReview:'NOT_RUN',notice:'Hashes bind content, not author/model identity. Receiving host must revalidate; approved resources and SDKs are host prerequisites.'}};
 if(Buffer.byteLength(JSON.stringify(result))>768*1024)throw fail('A2G_GEN_PACKAGE_SIZE');return result;
}
export async function importGamePackage(text,outputDirectory,{signal,timeoutMs=60000}={}){
 if(typeof text!=='string'||Buffer.byteLength(text)>768*1024)throw fail('A2G_GEN_PACKAGE_SIZE');
 const output=safePath(outputDirectory);if(existsSync(output))throw fail('A2G_GEN_OUTPUT_EXISTS');
 const directory=privateRun(),parsed=JSON.parse((await runGeneratorWorker('parse-json',{text,directory},{signal,timeoutMs,maxBytes:2*1024*1024})).stdout);
 if(parsed.status!=='PASS')throw fail('A2G_GEN_PACKAGE_JSON');const pack=parsed.output;
 if(pack?.format!=='a2game-generator-package'||pack.version!==1||pack.compatibility?.specVersion!=='0.1.0'||!pack.files||!pack.hashes||!Array.isArray(pack.assets)||Object.keys(pack.files).some(k=>!['content','conformance','solution','gamePlan'].includes(k)))throw fail('A2G_GEN_PACKAGE_FORMAT');
 for(const key of ['content','conformance','solution',...('gamePlan' in pack.files?['gamePlan']:[])])if(!Object.hasOwn(pack.files,key)||pack.hashes[key]!==sha(pack.files[key]))throw fail('A2G_GEN_PACKAGE_INTEGRITY');
 const service=createContentService(),receipt=await service.importBundle(JSON.stringify(pack.files.content));
 const expected=JSON.parse(readFileSync(join(root,'project/asset-policy.json'),'utf8')).entries;
 const expectedAssets=pack.files.content.resources.map(resource=>{const e=expected.find(item=>item.uri===resource.uri&&item.integrity===resource.integrity);if(!e)throw fail('A2G_GEN_PACKAGE_ASSET');return {uri:e.uri,sha256:resource.sha256,bytes:e.bytes,source:e.source,license:e.license};});
 if(sha(pack.assets)!==sha(expectedAssets))throw fail('A2G_GEN_PACKAGE_ASSET');
 const game=pack.files.content.definition;
 checkReferenceInputProfile(game);
 if(pack.files.gamePlan){await validateGamePlan(pack.files.gamePlan,{signal,timeoutMs});checkPlanGame(pack.files.gamePlan,game);}
 const rawFile=join(directory,'raw.json');save(rawFile,{format:'a2game-generation-output',version:1,game,conformance:pack.files.conformance,solution:pack.files.solution,provenance:{kind:'fixture',model:'package-revalidation-only'}});
 const check=join(directory,'check');mkdirSync(check);
 const validation=JSON.parse((await runGeneratorWorker('validate',{rawFile,directory:check,prompt:'Validate imported content without generation.'},{signal,timeoutMs})).stdout).validationDirectory;
 const summary=JSON.parse(readFileSync(join(validation,'summary.json'),'utf8'));
 if(summary.status!=='PASS_REFERENCE')throw fail('A2G_GEN_PACKAGE_VALIDATION');
 mkdirSync(output,{recursive:true});mkdirSync(join(output,'tests'));
 const artifacts={'game.json':game,'conformance.json':pack.files.conformance,'solution.json':pack.files.solution,'release-receipt.json':receipt,'debug-bundle.json':{format:'a2game-debug-bundle',version:1,game,solution:pack.files.solution,provenance:{kind:'fixture',model:'imported-content-unverified-origin'}},'assets-manifest.json':pack.assets,'tests/lifecycle.json':JSON.parse(readFileSync(join(validation,'lifecycle.json'),'utf8')),'tests/conformance.json':JSON.parse(readFileSync(join(validation,'attempt-1.json'),'utf8')).conformance,'tests/playability.json':JSON.parse(readFileSync(join(validation,'playability.json'),'utf8'))};
 if(pack.files.gamePlan)artifacts['game-plan.json']=pack.files.gamePlan;
 for(const [name,value] of Object.entries(artifacts))save(join(output,name),value);
 const report={format:'a2game-generation-report',version:1,status:'PASS_REFERENCE',mode:pack.files.gamePlan?'game-plan':'direct-json',provenance:'IMPORTED_CONTENT_UNVERIFIED_ORIGIN',generationCalls:0,importModelCalls:0,G3:'NOT_RUN',humanReview:'NOT_RUN',packageSha256:createHash('sha256').update(text).digest('hex'),gameSha256Jcs:receipt.sha256Jcs,artifacts:Object.keys(artifacts)};
 save(join(output,'generation-report.json'),report);return {...report,outputDirectory:output};
}
