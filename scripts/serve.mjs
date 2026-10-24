/** Dev-only same-origin static server for packaged A2Game demo. Localhost by default. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const port=Number(process.env.A2GAME_PORT??8765);
const server=createServer(async(req,res)=>{
 try{
   const target=new URL(req.url??'/',`http://localhost:${port}`);
   let path=decodeURIComponent(target.pathname);if(path==='/'||path==='/player')path='/player/index.html';
   const filename=resolve(root,'.'+path);
   if(filename!==root && !filename.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   const s=await stat(filename);if(!s.isFile())throw Error('Not a file');
   const bytes=await readFile(filename);
   res.writeHead(200,{'Content-Type':types[extname(filename)]??'application/octet-stream',
     'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
     'Cross-Origin-Opener-Policy':'same-origin'});
   res.end(bytes);
 }catch(e){res.writeHead(404,{'Content-Type':'text/plain'});res.end('File not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`A2Game preview: http://127.0.0.1:${port}/player/index.html`));
