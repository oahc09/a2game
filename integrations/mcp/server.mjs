import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,McpError,ErrorCode} from '@modelcontextprotocol/sdk/types.js';
import {contracts,resultSchema} from './contract.mjs';
import {createMcpService} from './mcp.mjs';
import {publicResources,readPublicResource} from './resources.mjs';
// Preserve the SDK's bounded object/array-member budget before strict tool parsing.
function excessiveElements(value){
 let count=0;const stack=[value];
 while(stack.length){const node=stack.pop();if(node===null||typeof node!=='object')continue;
  for(const key of Object.keys(node)){if(++count>10000)return true;const child=node[key];if(child!==null&&typeof child==='object')stack.push(child);}
 }return false;
}
export async function startMcpServer(options={}){
 const service=createMcpService(options),server=new McpServer({name:'a2game',version:'1.0.0'},{maxToolInputElements:10000});
 for(const [name,{description,schema}]of Object.entries(contracts))server.registerTool(name,{description,inputSchema:schema,outputSchema:resultSchema,annotations:{readOnlyHint:['a2game.list_capabilities','a2game.get_capability','a2game.inspect_game'].includes(name),openWorldHint:name==='a2game.generate_game',destructiveHint:false}},async(args,extra)=>{
  const result=await service.call(name,args,{signal:extra.signal});return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:['FAIL','BLOCKED'].includes(result.status)};
 });
 // McpServer's default callback validates arguments BEFORE invoking the registered
 // handler, which loses rejected calls from the run ledger. Keep its published
 // schemas, but route valid tools/call envelopes through our existing strict parser
 // and canonical receipt writer first. Malformed JSON-RPC envelopes remain protocol
 // errors, not game candidates. No task-augmented execution is supported.
 server.server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
  const task=request.params.task!==undefined;
  const requestErrorCode=task?'A2G_MCP_ARGUMENTS':excessiveElements(request.params.arguments)?'A2G_MCP_SIZE':undefined;
  const result=await service.call(request.params.name,request.params.arguments??{},{signal:extra.signal,requestErrorCode});
  resultSchema.parse(result);
  if(task)throw new McpError(ErrorCode.InvalidParams,'Task augmentation is not supported.',{runId:result.runId});
  return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:['FAIL','BLOCKED'].includes(result.status)};
 });
 for(const resource of publicResources)server.registerResource(resource.name,resource.uri,{description:resource.description,mimeType:resource.mimeType},async uri=>readPublicResource(uri.href));
 const transport=new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:1024*1024});let closing;
 const close=()=>closing??=(async()=>{try{await service.close();}finally{await server.close();}})();
 const closeFailure=()=>{process.stderr.write('A2G_MCP_CLOSE: shutdown did not complete; inspect local lifecycle receipts.\n');process.exitCode=1;};
 server.server.onclose=()=>{void service.close().catch(closeFailure);};
 process.stdin.once('end',()=>{void close().catch(closeFailure);});process.once('SIGINT',()=>{void close().catch(closeFailure);});process.once('SIGTERM',()=>{void close().catch(closeFailure);});
 await server.connect(transport);return {server,service,close};
}
