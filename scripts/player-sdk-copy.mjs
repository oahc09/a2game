/** Copy the fixed standalone example without replacing a sibling component. */
import {constants,copyFileSync} from 'node:fs';
import {join} from 'node:path';

export function copyEmbeddedPlayer(source,destination){
 for(const name of ['README.md','example.mjs','index.html'])
  copyFileSync(join(source,name),join(destination,name),constants.COPYFILE_EXCL);
}
