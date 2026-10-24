/** Same-origin local player and trusted content admission API. */
import {createServer} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTENT_MAX_BYTES} from '../dist/index.js';
import {ContentError,createContentService} from './content-service.mjs';

const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
function body(req){
  return new Promise((accept,reject)=>{
    const chunks=[];let size=0;
    const tooLarge=()=>reject(new ContentError('A2G_E_CONTENT_SIZE','JSON 文件超过 256 KiB 上限。',413,'parse'));
    if(Number(req.headers['content-length'])>CONTENT_MAX_BYTES){req.resume();tooLarge();return;}
    req.on('data',chunk=>{size+=chunk.length;if(size>CONTENT_MAX_BYTES){chunks.length=0;tooLarge();}else chunks.push(chunk);});
    req.once('error',reject);req.once('end',()=>accept(Buffer.concat(chunks)));
  });
}
export function createPlayerServer({contentService=createContentService({storageDirectory:process.env.A2GAME_CONTENT_DIR??resolve(root,'.a2game/releases')})}={}){
  const server=createServer({requestTimeout:10000,headersTimeout:10000},async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      const origin=`http://${req.headers.host}`,target=new URL(req.url??'/',origin);
      if(!['127.0.0.1','localhost'].includes(target.hostname)||Number(target.port)!==server.address().port)
        throw new ContentError('A2G_E_ORIGIN','此服务仅接受本机宿主访问。',403,'policy');
      if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')
        throw new ContentError('A2G_E_ORIGIN','请求必须来自当前播放器同源页面。',403,'policy');
      const path=decodeURIComponent(target.pathname);
      if(path==='/api/releases'&&req.method==='POST'){
        if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')
          throw new ContentError('A2G_E_CONTENT_TYPE','请使用 application/json 上传游戏。',415,'parse');
        let text;
        try{text=new TextDecoder('utf-8',{fatal:true}).decode(await body(req));}
        catch(error){if(error instanceof ContentError)throw error;throw new ContentError('A2G_E_JSON_PARSE','文件必须为有效 UTF-8 JSON。',400,'parse');}
        const receipt=await contentService.release(text);json(201,{receipt,href:`/api/releases/${receipt.sha256Jcs}`});return;
      }
      const release=path.match(/^\/api\/releases\/([a-f0-9]{64})$/);
      if(release&&req.method==='GET'){json(200,await contentService.read(release[1]));return;}
      if(!['GET','HEAD'].includes(req.method))throw new ContentError('A2G_E_METHOD','此接口不支持该方法。',405,'policy');
      const publicPath=path==='/'||path==='/player'?'/player/index.html':path;
      const allowed=['/player/','/dist/','/specs/v0.1/samples/'].some(prefix=>publicPath.startsWith(prefix));
      if(!allowed)throw new ContentError('A2G_E_NOT_FOUND','文件或发布回执不存在。',404,'policy');
      const filename=await realpath(resolve(root,'.'+publicPath));
      const publicRoots=['player','dist','specs/v0.1/samples'].map(path=>resolve(root,path)+sep);
      if(!publicRoots.some(prefix=>filename.startsWith(prefix)))throw new ContentError('A2G_E_ORIGIN','文件超出播放器公开目录。',403,'policy');
      if(!(await stat(filename)).isFile())throw new ContentError('A2G_E_NOT_FOUND','文件不存在。',404,'policy');
      const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':types[extname(filename)]??'application/octet-stream'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){
      req.resume();res.setHeader('Connection','close');
      if(error instanceof ContentError)json(error.statusCode,{error:{code:error.code,message:error.message,stage:error.stage,diagnostics:error.diagnostics}});
      else if(['ENOENT','ENOTDIR'].includes(error.code))json(404,{error:{code:'A2G_E_NOT_FOUND',message:'文件不存在。'}});
      else{console.error(JSON.stringify({event:'player-request-error',message:String(error)}));json(500,{error:{code:'A2G_E_SERVER',message:'本地服务无法完成请求，请检查服务日志。'}});}
    }
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.A2GAME_PORT??8765);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('A2GAME_PORT must be 0..65535');
  const server=createPlayerServer();
  server.listen(port,'127.0.0.1',()=>console.log(`A2Game preview: http://127.0.0.1:${server.address().port}/player/index.html`));
  process.once('SIGTERM',()=>server.close());
}
