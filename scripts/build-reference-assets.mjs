/** Reproducible, repository-authored CC0 fixtures; no downloaded or executable assets. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {root} from './registry.mjs';
import {resolve} from 'node:path';
const directory=resolve(root,'assets');mkdirSync(directory,{recursive:true});
const png=new PNG({width:32,height:32});
for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const offset=(y*32+x)*4,bright=(Math.floor(x/8)+Math.floor(y/8))%2===0;
  png.data.set(bright?[87,215,200,255]:[36,53,80,255],offset);
}
const sampleRate=16000,frames=1600,wav=Buffer.alloc(44+frames*2);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++)wav.writeInt16LE(Math.round(Math.sin(i/sampleRate*2*Math.PI*440)*4000*(1-i/frames)),44+i*2);
const files=[['checker.png','image','image/png',PNG.sync.write(png)],['tone.wav','audio','audio/wav',wav]];
const entries=files.map(([name,type,mime,bytes])=>{
  writeFileSync(resolve(directory,name),bytes);
  return {uri:`assets/${name}`,type,mime,bytes:bytes.length,integrity:`sha256-${createHash('sha256').update(bytes).digest('base64')}`,source:'Repository-authored procedural fixture',license:'CC0-1.0'};
});
writeFileSync(resolve(root,'project/asset-policy.json'),JSON.stringify({format:'a2game-asset-policy',version:1,maxAssets:32,maxTotalBytes:8388608,entries},null,2)+'\n');
console.log(`Generated ${entries.length} deterministic reference assets and policy.`);
