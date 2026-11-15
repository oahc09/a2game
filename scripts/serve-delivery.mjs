import{readFileSync}from'node:fs';
import{startCreationDeliveryService}from'../packages/delivery-service/index.mjs';
const controller=new AbortController();
for(const name of['SIGINT','SIGTERM'])process.once(name,()=>controller.abort());
try{
 const file=process.argv[2];if(!file)throw Error('请提供宿主配置 JSON 路径');
 const config=JSON.parse(readFileSync(file,'utf8'));
 if(Object.keys(config).some(key=>!['releases','providerId','configFile','maxCalls','port','allowPublish','stateDirectory','adminTokenEnv','publicOrigin','signingKeyEnv'].includes(key)))throw Error('配置包含未知字段');
 const service=await startCreationDeliveryService({...config,signal:controller.signal});
 console.log(JSON.stringify({status:service.status,url:service.url,studioUrl:service.studioUrl,scope:'LOOPBACK_REFERENCE'}));
 await new Promise(resolve=>controller.signal.aborted?resolve():controller.signal.addEventListener('abort',resolve,{once:true}));await service.close();
}catch(e){console.error('交付服务未启动或已中断：'+(e.code??e.message)+'；请检查宿主配置和构建产物。');process.exitCode=1;}
