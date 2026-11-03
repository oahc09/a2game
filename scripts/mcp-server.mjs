/** Host launch options are never accepted as MCP tool arguments. stdout is protocol only. */
import {startMcpServer} from '../integrations/mcp/server.mjs';
try{
 const args=process.argv.slice(2),allowed=new Set(['--provider','--provider-config','--max-calls','--timeout-ms','--preview-ttl-ms','--host-run-id']),options={};
 for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!allowed.has(k)||!v||Object.hasOwn(options,k))throw Error();options[k]=v;}
 await startMcpServer({provider:options['--provider'],configFile:options['--provider-config'],maxCalls:Number(options['--max-calls']??0),timeoutMs:Number(options['--timeout-ms']??120000),previewTtlMs:Number(options['--preview-ttl-ms']??120000),hostRunId:options['--host-run-id']??null});
}catch{process.stderr.write('A2G_MCP_START：启动失败，请检查依赖、构建及启动参数后重试。\n');process.exitCode=1;}
