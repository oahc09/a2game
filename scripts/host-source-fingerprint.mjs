/** Content identity of implementation/contracts, independent of Git commits and private run output. */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export function hostSourceFingerprint(workspace=root){
 const entries=[];
 function visit(path,browserSource=false){if(browserSource&&path===join(workspace,'player','vendor'))return;if(!existsSync(path))return;const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error('Source fingerprint rejects symbolic links');if(stat.isDirectory()){for(const name of readdirSync(path).sort())if(!['node_modules','__pycache__'].includes(name))visit(join(path,name),browserSource);}else if(stat.isFile()&&(browserSource?/\.(?:mjs|js|html|css)$/.test(path):/\.(?:mjs|js|ts|py|json|md)$/.test(path)))entries.push([relative(workspace,path).replaceAll('\\','/'),createHash('sha256').update(readFileSync(path)).digest('hex')]);}
 for(const path of ['src','dist','generator','scripts','integrations/mcp','integrations/skill/a2game','specs/v0.1/schemas','specs/v0.1/capabilities','package.json','package-lock.json','project/sdk-lock.json','project/asset-policy.json','docs/host-agent-pilot.md'])visit(join(workspace,path));
 // Browser execution/layout bytes participate; generated catalogs and downloaded SDKs do not.
 // SDK identity remains bound by sdk-lock.json and separate actual SDK SHA evidence.
 visit(join(workspace,'player'),true);
 if(!entries.length)throw Error('No implementation bytes available for evidence binding');
 return createHash('sha256').update(JSON.stringify(entries.sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
}
