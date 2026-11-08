/** Shared Python resolution; mirrors the content-service contract so tests and CLI agree. */
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function resolvePython(explicit){
 if(explicit)return explicit;
 const local=resolve(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
 return process.env.A2GAME_PYTHON??(existsSync(local)?local:'python');
}
