import {existsSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve,dirname,parse} from 'node:path';
import {fault} from './catalog.mjs';
export function writePlanFile(input,plan){
 if(typeof input!=='string'||!input||input.includes('\0')||input.split(/[\\/]/).includes('..'))throw fault('A2G_GEN_PATH','/output','请指定安全的新文件路径。');
 const path=resolve(input);if(path===parse(path).root)throw fault('A2G_GEN_PATH','/output','不能输出到根目录。');
 for(let at=path;;at=dirname(at)){if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw fault('A2G_GEN_PATH','/output','输出路径不允许符号链接。');if(at===dirname(at))break;}
 writeFileSync(path,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
}
