/** Same-origin local player and trusted content admission API. */
import {createServer} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTENT_MAX_BYTES,CONTENT_BUNDLE_MAX_BYTES} from '../dist/index.js';
import {ContentError,createContentService} from './content-service.mjs';
import {AssetError} from './asset-policy.mjs';
import {createTurnRoomService,RoomError} from './turn-room-service.mjs';

const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
function body(req,limit=CONTENT_MAX_BYTES){
  return new Promise((accept,reject)=>{
    const chunks=[];let size=0;
    const tooLarge=()=>reject(new ContentError('A2G_E_CONTENT_SIZE','上传文件超过接口字节预算。',413,'parse'));
    if(Number(req.headers['content-length'])>limit){req.resume();tooLarge();return;}
    req.on('data',chunk=>{size+=chunk.length;if(size>limit){chunks.length=0;tooLarge();}else chunks.push(chunk);});
    req.once('error',reject);req.once('end',()=>accept(Buffer.concat(chunks)));
  });
}
export function createPlayerServer({contentService=createContentService({storageDirectory:process.env.A2GAME_CONTENT_DIR??resolve(root,'.a2game/releases')}),enableRooms=false}={}){
  const rooms=enableRooms?createTurnRoomService({contentService}):null;
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
      if(path.startsWith('/api/rooms')){
        if(!rooms)throw new RoomError('A2G_E_ROOM_DISABLED','未启用本机公开回合参考。',404);
        const token=req.headers.authorization?.match(/^Bearer ([a-f0-9-]{36})$/)?.[1],match=path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|moves|journal))?$/);
        if(path==='/api/rooms'&&req.method==='POST'||match&&['join','moves'].includes(match[2])&&req.method==='POST'){
          if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw new RoomError('A2G_E_ROOM_REQUEST','请使用 application/json。',415);
          let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await body(req,8192)));}catch(error){if(error instanceof ContentError)throw error;throw new RoomError('A2G_E_ROOM_REQUEST','请求必须为有效 UTF-8 JSON。',400);}
          if(path==='/api/rooms')json(201,await rooms.create(input));else if(match[2]==='join')json(201,rooms.join(match[1],input));else json(200,rooms.move(match[1],token,input));return;
        }
        if(match&&req.method==='GET'){json(200,match[2]==='journal'?rooms.journal(match[1],token):!match[2]?rooms.read(match[1],token):(()=>{throw new RoomError('A2G_E_ROOM_REQUEST','不支持的房间接口。',405);})());return;}
        if(match&&!match[2]&&req.method==='DELETE'){json(200,rooms.close(match[1],token));return;}
        throw new RoomError('A2G_E_ROOM_REQUEST','不支持的房间路径或方法。',405);
      }
      if(['/api/releases','/api/bundles'].includes(path)&&req.method==='POST'){
        if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')
          throw new ContentError('A2G_E_CONTENT_TYPE','请使用 application/json 上传游戏。',415,'parse');
        let text;
        try{text=new TextDecoder('utf-8',{fatal:true}).decode(await body(req,path==='/api/bundles'?CONTENT_BUNDLE_MAX_BYTES:CONTENT_MAX_BYTES));}
        catch(error){if(error instanceof ContentError)throw error;throw new ContentError('A2G_E_JSON_PARSE','文件必须为有效 UTF-8 JSON。',400,'parse');}
        const receipt=await (path==='/api/bundles'?contentService.importBundle(text):contentService.release(text));json(201,{receipt,href:`/api/releases/${receipt.sha256Jcs}`});return;
      }
      const bundle=path.match(/^\/api\/releases\/([a-f0-9]{64})\/bundle$/);
      if(bundle&&req.method==='GET'){json(200,await contentService.exportBundle(bundle[1]));return;}
      const asset=path.match(/^\/api\/assets\/([a-f0-9]{64})$/);
      if(asset&&req.method==='GET'){const {entry,bytes}=contentService.readAsset(asset[1]);res.writeHead(200,{'Content-Type':entry.mime,'Content-Length':bytes.length});res.end(bytes);return;}
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
      if(error instanceof ContentError||error instanceof AssetError||error instanceof RoomError)json(error.statusCode,{error:{code:error.code,message:error.message,stage:error.stage,diagnostics:error.diagnostics}});
      else if(['ENOENT','ENOTDIR'].includes(error.code))json(404,{error:{code:'A2G_E_NOT_FOUND',message:'文件不存在。'}});
      else{console.error(JSON.stringify({event:'player-request-error',message:String(error)}));json(500,{error:{code:'A2G_E_SERVER',message:'本地服务无法完成请求，请检查服务日志。'}});}
    }
  });
  server.once('close',()=>rooms?.dispose());
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.A2GAME_PORT??8765);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('A2GAME_PORT must be 0..65535');
  const server=createPlayerServer({enableRooms:process.env.A2GAME_ROOMS==='1'});
  server.listen(port,'127.0.0.1',()=>console.log(`A2Game preview: http://127.0.0.1:${server.address().port}/player/index.html`));
  process.once('SIGTERM',()=>server.close());
}
