/** npm-script bridge so Python tooling uses the same resolution as the rest of the repo. */
import {spawnSync} from 'node:child_process';
import {isPythonRuntimeError,requirePython} from './python-runtime.mjs';
const [script,...args]=process.argv.slice(2);
if(!script){console.error('usage: node scripts/run-python.mjs SCRIPT [args...]');process.exit(2);}
try{
 const schema=['specs/v0.1/tools/validate_specs.py','scripts/preflight.py'].includes(script.replaceAll('\\','/'));
 const result=spawnSync(requirePython(undefined,{schema}),[script,...args],{stdio:'inherit',shell:false,windowsHide:true});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}catch(e){
 console.error(isPythonRuntimeError(e)?`${e.code}: ${e.message}`:'A2G_E_PYTHON_EXECUTION: Python 工具未能执行。');
 process.exitCode=1;
}
