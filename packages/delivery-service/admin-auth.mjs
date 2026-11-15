/** Optional single-administrator login. Secret stays in the host environment; sessions stay in memory. */
import{randomBytes,createHash,timingSafeEqual}from'node:crypto';
const digest=s=>createHash('sha256').update(s).digest();
export function createAdminAuth(env,publicOrigin){
 if(env===undefined)return{handle:async()=>false,dispose(){}};
 const secret=/^[A-Z][A-Z0-9_]{0,63}$/.test(env)?process.env[env]:undefined;
 if(typeof secret!=='string'||secret.length<32||secret.length>512)throw Object.assign(Error('启动环境中缺少有效管理员令牌；请配置指定环境变量后重试。'),{code:'A2G_ADMIN_TOKEN_REQUIRED'});
 const expected=digest(secret),sessions=new Map();let failures=0,since=Date.now();const cookie='a2game_admin',secure=publicOrigin?'; Secure':'';
 const page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>管理员登录</title><body><main><h1>管理员登录</h1><p>使用本机启动配置对应的管理员令牌。令牌不会保存在浏览器存储中。</p><form><label>管理员令牌 <input name="token" type="password" autocomplete="off" required maxlength="512"></label><button>登录</button></form><p role="status"></p></main><script>document.querySelector("form").onsubmit=async e=>{e.preventDefault();const input=document.querySelector("input"),token=input.value;input.value="";try{const r=await fetch("/auth/login",{method:"POST",headers:{"Content-Type":"application/json","X-A2Game-Auth":"1"},body:JSON.stringify({token})});if(!r.ok)throw Error((await r.json()).code);location.replace("/delivery/");}catch(e){document.querySelector("[role=status]").textContent="登录未完成（"+e.message+"），请核对令牌或稍后重试。";}};</script></body></html>';
 const styledPage=page.replace('<body>','<style>:root{color-scheme:dark;font:16px/1.6 system-ui;background:#091722;color:#e6f1ed}body{margin:0;padding:24px}main{max-width:560px;margin:10vh auto}h1{font-size:30px}label{display:block}input{display:block;width:100%;box-sizing:border-box;margin:8px 0 20px}input,button{font:inherit;min-height:44px;padding:10px;border:1px solid #52737b;border-radius:6px;background:#173540;color:inherit}button{cursor:pointer}[role=status]{min-height:3em}</style><body>');
 return{async handle(req,res){
  const respond=(status,code)=>{req.resume();res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'FAIL',code,message:'需要有效管理员登录或发布权限；请重新登录或联系宿主配置方。'}));};
  try{const origin=publicOrigin??('http://'+req.headers.host),url=new URL(req.url,origin),port=req.socket.localPort,hostValid=publicOrigin?url.origin===publicOrigin&&req.headers.host===new URL(publicOrigin).host&&req.headers['x-forwarded-proto']==='https':['127.0.0.1','localhost'].includes(url.hostname)&&Number(url.port)===port;if(!hostValid||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){respond(403,'A2G_ADMIN_ORIGIN');return true;}
   const now=Date.now();for(const[key,expires]of sessions)if(expires<=now)sessions.delete(key);
   if(url.pathname==='/auth/login'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(styledPage);return true;}
   if(url.pathname==='/auth/login'&&req.method==='POST'){
    if(req.headers['x-a2game-auth']!=='1'||req.headers['content-type']?.split(';')[0]!=='application/json'){respond(403,'A2G_ADMIN_ORIGIN');return true;}
    if(now-since>60000){failures=0;since=now;}if(failures>=5){respond(429,'A2G_ADMIN_RATE_LIMIT');return true;}
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2048){respond(413,'A2G_ADMIN_INPUT');return true;}chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!input||Object.keys(input).some(k=>k!=='token')||typeof input.token!=='string'||input.token.length>512){respond(400,'A2G_ADMIN_INPUT');return true;}
    if(!timingSafeEqual(expected,digest(input.token))){failures++;respond(401,'A2G_ADMIN_LOGIN');return true;}
    failures=0;const session=randomBytes(24).toString('hex');if(sessions.size>=16)sessions.delete(sessions.keys().next().value);sessions.set(session,now+20*60*1000);res.writeHead(204,{'Set-Cookie':`${cookie}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1200${secure}`,'Cache-Control':'no-store'});res.end();return true;
   }
   const session=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1);
   if(!session||!sessions.has(session)){if(req.method==='GET'&&(req.headers.accept??'').includes('text/html')){res.writeHead(303,{Location:'/auth/login','Cache-Control':'no-store'});res.end();}else respond(401,'A2G_ADMIN_REQUIRED');return true;}
   if(url.pathname==='/auth/logout'&&req.method==='POST'){if(req.headers['x-a2game-auth']!=='1'){respond(403,'A2G_ADMIN_ORIGIN');return true;}sessions.delete(session);res.writeHead(204,{'Set-Cookie':`${cookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,'Cache-Control':'no-store'});res.end();return true;}
   return false;
  }catch{respond(400,'A2G_ADMIN_INPUT');return true;}
 },dispose(){sessions.clear();expected.fill(0);}};
}
