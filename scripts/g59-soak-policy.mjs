const ring=[[870,1150],[3100,1100],[5150,1050],[5200,2200],[5100,3200],[3150,3200],[950,3320],[850,2200]];
const unit=(x,y)=>{const n=Math.hypot(x,y)||1;return [x/n,y/n];};
const dist=(a,x,y)=>Math.hypot(a.x-x,a.y-y);
function crosses(x0,y0,x1,y1,b,margin=0){
 let t0=0,t1=1;
 for(const [a,d,lo,hi] of [[x0,x1-x0,b.x-b.hx-margin,b.x+b.hx+margin],[y0,y1-y0,b.y-b.hy-margin,b.y+b.hy+margin]]){
  if(!d){if(a<lo||a>hi)return false;continue;}
  const u=(lo-a)/d,v=(hi-a)/d;t0=Math.max(t0,Math.min(u,v));t1=Math.min(t1,Math.max(u,v));
  if(t0>t1)return false;
 }
 return true;
}
// Reproducible input-driver, not a game rule.
export function makeController(){
 let cursor=0;
 return function control(world){
  const p=world.bodies.find(b=>b.kind==='actor');
  if(!p)return [0,0,0,0];
  const solids=world.bodies.filter(b=>b.kind==='solid');
  const targets=world.bodies.filter(b=>b.kind==='target')
    .sort((a,b)=>dist(a,p.x,p.y)-dist(b,p.x,p.y));
  if(dist(p,...ring[cursor])<290)cursor=(cursor+1)%ring.length;
  const goal=ring[cursor],[gx,gy]=unit(goal[0]-p.x,goal[1]-p.y);
  const minRange=targets[0]?dist(targets[0],p.x,p.y):Infinity;
  let move=[0,0],choice=-Infinity;
  for(let i=-1;i<16;i++){
   const x=i<0?0:Math.cos(i*Math.PI/8),y=i<0?0:Math.sin(i*Math.PI/8);
   const nx=p.x+x*500,ny=p.y+y*500;
   if(nx<170||nx>5830||ny<170||ny>4230||solids.some(b=>crosses(p.x,p.y,nx,ny,b,160)))continue;
   const near=targets[0]?Math.min(...targets.map(t=>dist(t,nx,ny))):Infinity;
   const toward=x*gx+y*gy;
   const risk=Math.max(0,850-near),safe=Math.min(1400,near);
   const towardWeight=minRange<850?80:520;
   const score=toward*towardWeight-risk*3+safe*.20;
   if(score>choice){choice=score;move=[x,y];}
  }
  const target=targets.find(t=>!solids.some(b=>crosses(p.x,p.y,t.x,t.y,b,45)));
  const aim=target?unit(target.x-p.x+target.vx*6,target.y-p.y+target.vy*6):[0,0];
  return [move[0],-move[1],aim[0],-aim[1]].map(x=>Math.round(x*10000)/10000);
 };
}
