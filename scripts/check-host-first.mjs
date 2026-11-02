/** Check host templates and their local stdio handshake; this is not a host acceptance. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {lstatSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {Client,StdioClientTransport} from '../integrations/mcp/client.mjs';
import {contracts} from '../integrations/mcp/contract.mjs';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path));
const digest=path=>createHash('sha256').update(read(path)).digest('hex');
const files=dir=>readdirSync(resolve(root,dir)).sort().flatMap(name=>{
 const path=join(dir,name).replaceAll('\\','/'),stat=lstatSync(resolve(root,path));
 assert.equal(stat.isSymbolicLink(),false,'Skill files may not be symlinks');
 return stat.isDirectory()?files(path):[path];
});
const source='integrations/skill/a2game';
const destinations=['integrations/hosts/trae/project-example/.trae/skills/a2game','integrations/hosts/workbuddy/connector-example/skills/a2game'];
const cases=[
 ['qoder','integrations/hosts/qoder/connection.example.json'],
 ['workbuddy','integrations/hosts/workbuddy/connector-example/mcp.json'],
 ['trae-project','integrations/hosts/trae/project-example/.trae/mcp.json'],
 ['trae-isolated','integrations/hosts/trae/project-example/mcp-isolated-workspace.example.json']
];
const dir='reports/host-first-templates-'+randomUUID();mkdirSync(resolve(root,dir),{recursive:true});
const receipt={format:'a2game-host-first-template-check',version:1,status:'FAIL',scope:'Local template and stdio handshake only; no actual Qoder/WorkBuddy/TRAE installation or HOST-G0 acceptance.',hostDiscovery:'NOT_RUN',mcpProviderCalls:0,skillFiles:{},cases:[]};
try{
 const originals=files(source).map(p=>relative(source,p).replaceAll('\\','/'));
 for(const destination of destinations){
  assert.deepEqual(files(destination).map(p=>relative(destination,p).replaceAll('\\','/')),originals);
  for(const name of originals)assert.equal(digest(source+'/'+name),digest(destination+'/'+name),'Skill copy differs: '+destination+'/'+name);
 }
 receipt.skillFiles=Object.fromEntries(originals.map(name=>[name,digest(source+'/'+name)]));
 assert.equal(JSON.parse(read('integrations/hosts/workbuddy/connector-example/connector-meta.json')).type,'mcp');
 assert.match(read('integrations/hosts/workbuddy/connector-example/icon.svg').toString(),/<svg\b/);
 for(const [host,path] of cases){
  const config=JSON.parse(read(path));assert.deepEqual(Object.keys(config.mcpServers),['a2game']);
  const server=config.mcpServers.a2game;assert.equal(server.command,'node');
  assert.deepEqual(server.args.slice(1),['--max-calls','0']);
  assert.ok(['<A2GAME_WORKSPACE>/scripts/mcp-server.mjs','${workspaceFolder}/scripts/mcp-server.mjs'].includes(server.args[0]));
  const executable=server.args[0].replace('<A2GAME_WORKSPACE>',root).replace('${workspaceFolder}',root);
  const client=new Client({name:'a2game-host-template-check',version:'1.0.0'});
  const transport=new StdioClientTransport({command:server.command,args:[executable,...server.args.slice(1)],cwd:root,env:{...process.env,...server.env},stderr:'pipe'});
  try{await client.connect(transport);const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),Object.keys(contracts).sort());receipt.cases.push({host,status:'PASS_REFERENCE',configuration:path,sha256:digest(path),tools:tools.tools.length});}
  finally{await client.close();}
 }
 receipt.status='PASS_REFERENCE';
}catch(error){receipt.failure=String(error.message);process.exitCode=1;}
finally{const path=dir+'/summary.json';writeFileSync(resolve(root,path),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:receipt.status,receipt:path}));}
