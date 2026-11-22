import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {requestGeneration} from '../generator/adapters/http-generator.mjs';
const server=async handler=>{const s=createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));return {url:'http://127.0.0.1:'+s.address().port,close:()=>new Promise(r=>{s.close(r);s.closeAllConnections();})};};
test('HTTP generator forwards UTF-8 repair context, preserves raw JSON for strict parsing and reports HTTP failures without response contents',async()=>{
 const s=await server(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks));assert.equal(req.method,'POST');assert.equal(body.previous.message,'修复游戏');res.setHeader('content-type','application/json; charset=utf-8');res.end('{"title":"中文","duplicate":1,"duplicate":2}');});
 try{assert.equal(await requestGeneration({endpoint:s.url},{previous:{message:'修复游戏'}}),'{"title":"中文","duplicate":1,"duplicate":2}');}finally{await s.close();}
 const bad=await server((req,res)=>{res.writeHead(503);res.end('PRIVATE RESPONSE');});try{await assert.rejects(requestGeneration({endpoint:bad.url},{}),e=>e.code==='A2G_E_PROVIDER_HTTP'&&!e.message.includes('PRIVATE'));}finally{await bad.close();}
});
test('HTTP generator bounds streams/deadlines and rejects redirects, invalid UTF-8 and insecure remote endpoints',async()=>{
 for(const endpoint of ['http://example.com/generate','https://user:password@example.com/','file:///tmp/model'])await assert.rejects(requestGeneration({endpoint},{}),e=>e.code==='A2G_E_PROVIDER_CONFIG');
 const s=await server((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{location:'/ok'});res.end();}else if(req.url==='/slow')return;else{res.setHeader('content-type','application/json');res.end(req.url==='/large'?'x'.repeat(1024):Buffer.from([0xff]));}});
 try{for(const [path,code,extra] of [['/redirect','A2G_E_PROVIDER_NETWORK',{}],['/large','A2G_E_PROVIDER_SIZE',{maxResponseBytes:256}],['/utf8','A2G_E_PROVIDER_JSON',{}],['/slow','A2G_E_PROVIDER_TIMEOUT',{timeoutMs:50}]])await assert.rejects(requestGeneration({endpoint:s.url+path,...extra},{}),e=>e.code===code);}finally{await s.close();}
});
