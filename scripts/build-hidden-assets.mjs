/** Small repository-authored pixel-art objects; no remote asset or license dependency. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {PNG} from 'pngjs';
const policy=JSON.parse(fs.readFileSync('project/asset-policy.json','utf8'));
for(const name of ['apple','key']){
 const image=new PNG({width:64,height:64});
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let color;const ellipse=(cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2<1;
  if(name==='apple'){
   if(ellipse(25,36,17,21)||ellipse(39,36,17,21))color=[228,93,107,255];
   if((ellipse(23,32,5,10)||ellipse(24,25,7,4))&&x<28)color=[255,158,151,255];
   if(x>=31&&x<=35&&y>=8&&y<=21)color=[130,88,58,255];
   if(ellipse(41,13,9,4))color=[101,192,133,255];
  }else{
   const outer=ellipse(20,21,14,14),inner=ellipse(20,21,7,7);if(outer&&!inner||x>=18&&x<=25&&y>=30&&y<=57||x>=23&&x<=37&&y>=43&&y<=49||x>=23&&x<=33&&y>=53&&y<=58)color=[242,200,105,255];
   if(outer&&!inner&&y<15)color=[255,229,164,255];
  }
  if(color)image.data.set(color,(y*64+x)*4);
 }
 const uri='assets/hidden-'+name+'.png',bytes=PNG.sync.write(image);fs.writeFileSync(uri,bytes);const entry={uri,type:'image',mime:'image/png',bytes:bytes.length,integrity:'sha256-'+createHash('sha256').update(bytes).digest('base64'),source:'Repository-authored pixel-art '+name+' for H05',license:'CC0-1.0'};const i=policy.entries.findIndex(r=>r.uri===uri);if(i<0)policy.entries.push(entry);else policy.entries[i]=entry;
}
fs.writeFileSync('project/asset-policy.json',JSON.stringify(policy,null,2)+'\n');
