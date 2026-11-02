/** Fixed public contracts only: no caller paths, author levels, winning traces or secrets. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const version='0.1.0',maxBytes=256*1024;
const hostProfile={format:'a2game-host-profile',version:1,specVersion:version,scope:'REFERENCE_CONTRACT_NOT_DEVICE_ATTESTATION',backends:['air','three'],inputs:{keyboard:'keyboard.button bindings; config.hold:true for continuous held actions',pointer:'Use registered touch.tap/touch.drag contracts; simulated Touch/IMU is not real-device evidence'},lifecycle:['start','pause','resume','restart','dispose'],terminalInput:'Gameplay input is rejected while paused or terminal. Conformance expectError must immediately precede each intentional rejected operation.',solution:{format:'array of {action?,value?,raw?,ticks}',maxSteps:256,maxTicks:12000},hash:'Exact hash comparisons require the same definition, seed and normalized input trace.',security:'No arbitrary scripts, filesystem paths, provider credentials or unapproved resource URLs. Preview URLs alone do not prove input, visual or resource-cleanup acceptance.'};
const example={format:'a2game-contract-fragments',version:1,specVersion:version,scope:'NON_EXECUTABLE_FRAGMENT_NOT_A_GAME_OR_BENCHMARK_SOLUTION',state:{points:{type:'int',initial:0}},capabilityRef:{id:'a2game.core.state',version},explanation:'Fragments illustrate syntax only. Discover current capabilities and author your own game, cases and solution. No target level or winning action sequence is included.'};
const entries=[
 {name:'gamespec-schema',uri:'a2game://spec/0.1.0/game.schema.json',path:'../../specs/v0.1/schemas/game.schema.json'},
 {name:'conformance-schema',uri:'a2game://spec/0.1.0/test-suite.schema.json',path:'../../specs/v0.1/schemas/test-suite.schema.json'},
 {name:'capability-schema',uri:'a2game://spec/0.1.0/capability.schema.json',path:'../../specs/v0.1/schemas/capability.schema.json'},
 {name:'host-profile',uri:'a2game://spec/0.1.0/host-profile.json',value:hostProfile},
 {name:'contract-fragments',uri:'a2game://spec/0.1.0/contract-fragments.json',value:example}
];
export const publicResources=Object.freeze(entries.map(({name,uri})=>Object.freeze({name,uri,mimeType:'application/json',description:`Public A2Game ${version} ${name}; JSON envelope includes content text, SHA256 and byte length; max ${maxBytes} content bytes.`})));
export function readPublicResource(uri){
 const entry=entries.find(e=>e.uri===uri);if(!entry)throw Object.assign(Error('Unknown public resource URI.'),{code:'A2G_MCP_RESOURCE'});
 const bytes=entry.path?readFileSync(fileURLToPath(new URL(entry.path,import.meta.url))):Buffer.from(JSON.stringify(entry.value,null,2)+'\n');
 if(bytes.length>maxBytes)throw Object.assign(Error('Public resource exceeds its size limit.'),{code:'A2G_MCP_RESOURCE_SIZE'});
 const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const envelope={format:'a2game-public-resource',version:1,specVersion:version,uri:entry.uri,contentType:'application/json',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,content};
 return {contents:[{uri:entry.uri,mimeType:'application/json',text:JSON.stringify(envelope)}]};
}
