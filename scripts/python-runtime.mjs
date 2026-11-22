/** Host-only Python selection shared by CLI, creator, validation and packaging tools. */
import {accessSync,constants,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {delimiter,dirname,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const pythonErrorCodes=Object.freeze(['A2G_E_PYTHON_UNAVAILABLE','A2G_E_PYTHON_SCHEMA']);
export const isPythonRuntimeError=error=>pythonErrorCodes.includes(error?.code);
function availableOnPath(name){
 const path=process.env.PATH??(process.platform==='win32'?process.env.Path:'')??'';
 return path.split(delimiter).filter(Boolean).some(directory=>{
  try{accessSync(resolve(directory,process.platform==='win32'?name+'.exe':name),constants.X_OK);return true;}
  catch{return false;}
 });
}
export function resolvePython(explicit){
 const local=resolve(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
 return explicit??process.env.A2GAME_PYTHON??(existsSync(local)?local:
  availableOnPath('python')?'python':availableOnPath('python3')?'python3':'python');
}
const unavailable=()=>Object.assign(Error('需要可运行的 Python 3.10+；请检查 A2GAME_PYTHON、项目 .venv 或 PATH。'),
 {code:'A2G_E_PYTHON_UNAVAILABLE',attribution:'INFRA',stage:'infra'});
const missingSchema=()=>Object.assign(Error('所选 Python 缺少完整 Draft 2020-12 校验依赖；请用同一个解释器安装 requirements-dev.txt。'),
 {code:'A2G_E_PYTHON_SCHEMA',attribution:'INFRA',stage:'infra'});
const probeSource=(requireSchema)=>[
 'import json, sys',
 'if sys.version_info < (3, 10): raise SystemExit(10)',
 ...(requireSchema?[
  'try:',
  ' from jsonschema import Draft202012Validator',
  ' Draft202012Validator.check_schema({"type": "object"})',
  'except Exception:',
  ' raise SystemExit(11)',
 ]:[]),
 'print(json.dumps(sys.executable, ensure_ascii=True))',
].join('\n');
/** Verify selected Python before starting any provider work; never expose probe output or local paths. */
export function requirePython(explicit,{schema=false}={}){
 const selected=resolvePython(explicit);
 if(typeof selected!=='string'||!selected.trim()||selected.includes('\0'))throw unavailable();
 const result=spawnSync(selected,['-c',probeSource(schema)],{cwd:root,shell:false,windowsHide:true,
  encoding:'utf8',timeout:5000,maxBuffer:16*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
 if(result.status===11&&schema)throw missingSchema();
 if(result.error||result.status!==0)throw unavailable();
 let executable;
 try{executable=JSON.parse(result.stdout);}catch{throw unavailable();}
 if(typeof executable!=='string'||!isAbsolute(executable)||executable.includes('\0'))throw unavailable();
 return executable;
}
