import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {contracts,resultSchema} from './contract.mjs';
import {createMcpService} from './service.mjs';
export async function startMcpServer(options={}){
 const service=createMcpService(options),server=new McpServer({name:'a2game',version:'1.0.0'},{maxToolInputElements:10000});
 for(const [name,{description,schema}]of Object.entries(contracts))server.registerTool(name,{description,inputSchema:schema,outputSchema:resultSchema,annotations:{readOnlyHint:['a2game.list_capabilities','a2game.get_capability','a2game.inspect_game'].includes(name),openWorldHint:name==='a2game.generate_game',destructiveHint:false}},async(args,extra)=>{
  const result=await service.call(name,args,{signal:extra.signal});return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:['FAIL','BLOCKED'].includes(result.status)};
 });
 const transport=new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:1024*1024});let closing;
 const close=()=>closing??=(async()=>{await service.close();await server.close();})();
 server.server.onclose=()=>{void service.close();};
 process.stdin.once('end',()=>{void close();});process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
 await server.connect(transport);return {server,service,close};
}
