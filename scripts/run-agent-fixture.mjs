/** Reproducible engineering loop, explicitly not an independent Agent/G3. */
import {spawn} from 'node:child_process';
import {runAgentWorkflow} from './agent-workflow.mjs';
const result=await runAgentWorkflow({prompt:'创建点击三次获胜、点击两次仍进行的计数游戏。',command:[process.execPath,'test/fixtures/agent-provider.mjs']});
console.log(`${result.summary.status} fixture workflow: ${result.summary.directory}`);
if(!result.success)process.exitCode=1;
else if(process.argv.includes('--browser'))await new Promise((accept,reject)=>{const child=spawn(process.execPath,['scripts/agent-browser.mjs',result.summary.directory],{stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>{process.exitCode=code;accept();});});
