#!/usr/bin/env node
/** TRAE 项目级样例生成与校验。Skill 唯一内容来源为 integrations/skill/a2game；
 * project-example/.trae/skills/a2game 下的副本必须由本脚本生成，禁止手工维护漂移。
 * 默认模式：补齐缺失副本并完整校验；--check：只校验不写入。校验失败以非零码退出。 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const hostDir=resolve(root,'integrations/hosts/trae');
const source=resolve(root,'integrations/skill/a2game');
const dest=resolve(hostDir,'project-example/.trae/skills/a2game');
const jsonSamples=['.trae/mcp.json','mcp-isolated-workspace.example.json'].map(n=>resolve(hostDir,'project-example',n));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const checkOnly=process.argv.includes('--check');
const errors=[];

// 1) Skill 唯一来源合同（口径与 scripts/package-a2game-skill.py 一致）
const files=[];
try{(function walk(dir){for(const name of readdirSync(dir).sort()){const p=join(dir,name);if(lstatSync(p).isSymbolicLink()){errors.push('Skill 源不允许符号链接: '+relative(root,p));continue;}statSync(p).isDirectory()?walk(p):files.push(p);}})(source);}catch(e){errors.push('Skill 源不可读: '+e.message);}
if(!files.some(p=>relative(source,p)==='SKILL.md'))errors.push('Skill 源缺少 SKILL.md');
const entry=files.some(p=>relative(source,p)==='SKILL.md')?readFileSync(join(source,'SKILL.md'),'utf8'):'';
if(entry&&!(/^---\n/.test(entry)&&/^name: a2game$/m.test(entry)&&/^description: .+/m.test(entry)))errors.push('SKILL.md frontmatter 不符合 name/description 合同');
for(const [,link] of entry.matchAll(/\]\(([^)]+)\)/g)){const t=link.replaceAll('\\','/');if(t.startsWith('/')||t.split('/').includes('..'))errors.push('SKILL.md 链接必须为相对路径: '+t);else if(!files.some(p=>relative(source,p).replaceAll('\\','/')===t))errors.push('SKILL.md 链接目标不存在: '+t);}
for(const p of files){if(!p.endsWith('.md'))errors.push('Skill 源仅允许 .md 文件: '+relative(root,p));if(statSync(p).size>64*1024)errors.push('Skill 文件超过 64KiB: '+relative(root,p));}

// 2) 仅创建缺失的副本，不覆盖已有改动或跟随目标符号链接。
if(!checkOnly&&!errors.length){
  for(const dir of [resolve(hostDir,'project-example'),resolve(hostDir,'project-example/.trae'),resolve(hostDir,'project-example/.trae/skills'),dest]){
    if(existsSync(dir)&&lstatSync(dir).isSymbolicLink())errors.push('目标目录不允许符号链接: '+relative(root,dir));
  }
  for(const p of files){
    const target=join(dest,relative(source,p));
    let parent=dirname(target);
    while(parent!==dest&&parent.startsWith(dest)){if(existsSync(parent)&&lstatSync(parent).isSymbolicLink())errors.push('目标目录不允许符号链接: '+relative(root,parent));parent=dirname(parent);}
    if(existsSync(target)&&(lstatSync(target).isSymbolicLink()||!lstatSync(target).isFile()||sha256(readFileSync(target))!==sha256(readFileSync(p))))errors.push('目标已存在且不同，请先人工检查: '+relative(root,target));
  }
  if(!errors.length)for(const p of files){const target=join(dest,relative(source,p));if(!existsSync(target)){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,readFileSync(p),{flag:'wx'});}}
}

// 3) 副本与源逐文件 SHA 一致，且目标目录无源之外的多余文件
const receipt={format:'a2game-trae-host-layout',version:1,status:'PASS_LOCAL',checkOnly,skillSource:'integrations/skill/a2game',skillDestination:relative(root,dest).replaceAll('\\','/'),mcpSamples:{},skillFiles:{}};
for(const file of jsonSamples){try{receipt.mcpSamples[relative(hostDir,file).replaceAll('\\','/')]=sha256(readFileSync(file));}catch{errors.push('样例文件缺失: '+relative(hostDir,file).replaceAll('\\','/'));}}
for(const p of files){const rel=relative(source,p).replaceAll('\\','/'),target=join(dest,rel);try{if(sha256(readFileSync(target))!==sha256(readFileSync(p)))errors.push('目标副本与源不一致: '+rel);}catch{errors.push('目标副本缺失: '+rel);}receipt.skillFiles[rel]=sha256(readFileSync(p));}
try{(function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else{const rel=relative(dest,p).replaceAll('\\','/');if(!(rel in receipt.skillFiles))errors.push('目标存在源之外的多余文件: '+rel);}}})(dest);}catch{errors.push('目标目录不存在，请先以默认模式运行生成');}

// 4) mcp 样例结构与安全检查（按 TRAE 官方 stdio 字段合同：command/args/env）
const allowedServerKeys=new Set(['command','args','env']),allowedEnvKeys=new Set(['START_MCP_TIMEOUT_MS','RUN_MCP_TIMEOUT_MS']);
const secretPattern=/(sk-[A-Za-z0-9]{8,})|(Bearer\s+[A-Za-z0-9._-]{8,})|((?:api[_-]?key|secret|password|token)\s*[=:]\s*["'][^"'\n]{8,}["'])/i;
for(const file of jsonSamples){const rel=relative(hostDir,file).replaceAll('\\','/');let text,servers;try{text=readFileSync(file,'utf8');servers=JSON.parse(text).mcpServers;}catch(e){errors.push(rel+' JSON 解析失败: '+e.message);continue;}
 if(!servers||typeof servers!=='object'||!Object.hasOwn(servers,'a2game')||Object.keys(servers).length!==1){errors.push(rel+' 必须且仅包含 mcpServers.a2game');continue;}
 const s=servers.a2game;
 for(const key of Object.keys(s))if(!allowedServerKeys.has(key))errors.push(rel+' 含 TRAE stdio 合同之外的字段: '+key);
 if(typeof s.command!=='string'||!s.command||/\s/.test(s.command))errors.push(rel+' command 必须为 PATH 内命令或完整路径且不含空格');
 const args=Array.isArray(s.args)?s.args:[];
 if(args.some(a=>typeof a!=='string'||!a))errors.push(rel+' args 必须为非空字符串数组');
 const i=args.indexOf('--max-calls');
 if(i<0||args[i+1]!=='0')errors.push(rel+' 必须显式携带 --max-calls 0（模型调用预算为 0）');
 if(args.includes('--provider')||args.includes('--provider-config'))errors.push(rel+' 项目级样例禁止接入模型 Provider');
 if(!args.some(a=>a==='${workspaceFolder}/scripts/mcp-server.mjs'||a==='<A2GAME_WORKSPACE>/scripts/mcp-server.mjs'||/^[A-Za-z]:[\\/].*scripts[\\/]mcp-server\.mjs$/.test(a)))errors.push(rel+' args 须指向 a2game 工作区 scripts/mcp-server.mjs');
 for(const [k,v] of Object.entries(s.env??{})){if(!allowedEnvKeys.has(k))errors.push(rel+' env 仅允许官方超时变量，发现: '+k);else if(typeof v!=='string'||!/^\d+$/.test(v))errors.push(rel+' env '+k+' 必须为纯数字字符串');}
 if(secretPattern.test(text))errors.push(rel+' 疑似包含密钥内容');
}

// 5) 本目录全部文本文件密钥扫描（含生成的 Skill 副本与说明文档）
try{(function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else if(/\.(md|json|mjs)$/.test(name)&&secretPattern.test(readFileSync(p,'utf8')))errors.push('疑似密钥内容: '+relative(hostDir,p).replaceAll('\\','/'));}})(hostDir);}catch(e){errors.push('宿主目录不可读: '+e.message);}

if(errors.length){console.error('FAIL');for(const e of errors)console.error('- '+e);process.exit(1);}
console.log(JSON.stringify(receipt,null,2));
