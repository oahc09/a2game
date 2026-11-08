/** npm-script bridge so Python tooling uses the same resolution as the rest of the repo. */
import {spawnSync} from 'node:child_process';
import {resolvePython} from './python-runtime.mjs';
const [script,...args]=process.argv.slice(2);
if(!script){console.error('usage: node scripts/run-python.mjs SCRIPT [args...]');process.exit(2);}
const result=spawnSync(resolvePython(),[script,...args],{stdio:'inherit'});
process.exit(result.status??1);
