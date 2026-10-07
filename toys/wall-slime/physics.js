export const RADIUS = 0.83;
export const FLOOR = -2.7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Waist, chest, head, elbows, hands, knees and feet in the visible rest pose.
const SPIDER = [[0,0,0],[0,-.34,0],[0,-.50,0],[-.24,-.48,0],[.24,-.48,0],[-.28,-.72,0],[.28,-.72,0],[-.19,.32,0],[.19,.32,0],[-.34,.72,0],[.34,.72,0]];
export const TOYS = {
  spider: { name: '蜘蛛侠', rest: SPIDER, pads: [5,6,9,10], grip: 1, adhesion: .85 },
  gecko: { name: '小壁虎', rest: [[0,0,0],[0,-.34,0],[0,-.56,0],[-.38,-.26,0],[.38,-.26,0],[-.60,-.48,0],[.60,-.48,0],[-.35,.24,0],[.35,.24,0],[-.57,.46,0],[.57,.46,0]], pads: [5,6,9,10], grip: 1.15, adhesion: 1 },
  star: { name: '软海星', rest: [[0,.06,0],[0,-.1,0],[0,-.78,0],[-.36,-.19,0],[.36,-.19,0],[-.76,-.26,0],[.76,-.26,0],[-.23,.37,0],[.23,.37,0],[-.46,.73,0],[.46,.73,0]], pads: [2,5,6,9,10], grip: .85, adhesion: .65 },
  frog: { name: '弹弹蛙', rest: [[0,.08,0],[0,-.25,0],[0,-.43,0],[-.30,-.18,0],[.30,-.18,0],[-.52,-.43,0],[.52,-.43,0],[-.40,.28,0],[.40,.28,0],[-.28,.64,0],[.28,.64,0]], pads: [5,6,9,10], grip: 1, adhesion: .78 },
};
const EDGES = [[0,1],[1,2],[1,3],[3,5],[1,4],[4,6],[0,7],[7,9],[0,8],[8,10]];
const length = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const LINK_INDICES = [...EDGES.map(([a,b])=>[a,b,1]), [0,2,1],[3,4,.6],[7,8,.35],[0,3,.7],[0,4,.7],[1,7,.5],[1,8,.5],[1,5,.35],[1,6,.35],[0,9,.4],[0,10,.4]];
export function createSlime(kind='spider', position=[0,.15,.22]) {
  if(!Object.hasOwn(TOYS,kind))throw new RangeError('Unknown toy');
  const profile=TOYS[kind],rest=profile.rest;
  const s = {kind,rest,links:[...LINK_INDICES,...(kind==='star'?[[3,7,.35],[8,4,.35],[4,2,.18],[2,3,.18]]:[])].map(([a,b,k])=>({a,b,k,length:length(rest[a],rest[b])})),phase:'ready',x:position[0],y:position[1],z:position[2],vx:0,vy:0,vz:0,age:0,adhesion:profile.adhesion,grip:null,heldNode:0,contacted:false,throws:0,wallHits:0,floorHits:0,
    nodes:rest.map((p,i)=>({p:p.map((v,j)=>v+position[j]),v:[0,0,0],pad:profile.pads.includes(i),pin:null,hold:0,cooldown:0})),bones:[]};
  updateBones(s); return s;
}
export function grab(s,x,y) {
  if (![x,y].every(Number.isFinite)) return;
  s.heldNode=s.nodes.reduce((best,n,i)=>Math.hypot(n.p[0]-x,n.p[1]-y)<Math.hypot(s.nodes[best].p[0]-x,s.nodes[best].p[1]-y)?i:best,0);
  s.phase='held';s.grip={x,y};s.age=0;
  for(const n of s.nodes){n.pin=null;n.cooldown=.2;n.v=n.v.map(v=>v*.25);}
}
export function release(s,vx,vy) {
  if(s.phase!=='held'||![vx,vy].every(Number.isFinite))return;
  const f=Math.min(1,15/Math.max(Math.hypot(vx,vy),1));
  for(const n of s.nodes){n.v=[vx*f,vy*f,-8];n.pin=null;n.cooldown=0;}
  s.phase='flying';s.contacted=false;s.grip=null;s.age=0;s.throws++;
}
export function toss(s,x=0,y=.8,random=null,spread=1) {
  grab(s,s.x,s.y);
  const drift=random?(random()-.5)*.35*spread:.35;
  const angle=random?(random()-.5)*1.8*spread:0;
  const spin=random?(random()-.5)*2*spread:0;
  const power=random?.() ?? .5;
  const depth=2.2+power*.6, startY=Math.max(FLOOR+RADIUS,y-1.8);
  const cos=Math.cos(angle),sin=Math.sin(angle);
  for(let i=0;i<s.nodes.length;i++){
    const [rx,ry,rz]=s.rest[i];
    s.nodes[i].p=[rx*cos-ry*sin+x-drift,rx*sin+ry*cos+startY,rz+depth];
  }
  release(s,drift/.28,(y-startY)/.28+1+(power-.5)*.6);
  for(const n of s.nodes){
    n.v[0]-=(n.p[1]-startY)*spin;
    n.v[1]+=(n.p[0]-x+drift)*spin;
    n.v[2]=-8*depth/2.5;
  }
  updateBones(s);
}
export function tossTogether(slimes,bounds,random=Math.random){
  const slots=[0,1,2,3];
  for(let i=slots.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];
  }
  const narrow=bounds.x<3;
  slimes.forEach((s,i)=>{
    const slot=slots[i];
    const x=narrow?(slot%2?1:-1)*Math.min(.95,bounds.x):(slot-1.5)*1.9;
    const drop=narrow?(slot>=2?2.45:0)+(slot%2)*.15:[0,1.15,.35,1.55][slot];
    const y=bounds.top-.5-drop-random()*.2;
    toss(s,clamp(x+(random()-.5)*.2,-bounds.x,bounds.x),y,random,narrow?.4:1);
  });
}
// ponytail: eleven masses and distance constraints suffice for this one rubber toy;
// a volumetric solver is only needed for squeezing or self-collision.
export function step(s,dt,bounds={x:4,top:3}) {
  if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Invalid time step');
  if(dt===0)return;
  const count=Math.ceil(dt*120),h=dt/count;
  for(let sub=0;sub<count;sub++){
    s.age+=h;
    if(s.phase==='ready'||s.phase==='rest')continue;
    const old=s.nodes.map(n=>n.p.slice());
    for(let i=0;i<s.nodes.length;i++){
      const n=s.nodes[i];n.cooldown=Math.max(0,n.cooldown-h);
      if(n.pin){
        n.hold-=h;
        if(n.hold<=0){n.pin=null;n.cooldown=.45;n.v[2]=.22;}
      }
      if(n.pin)continue;
      n.v[1]-=8*h;
      for(let j=0;j<3;j++){n.v[j]*=Math.exp(-h*1.4);n.p[j]+=n.v[j]*h;}
      if(s.grip&&i===s.heldNode){
        const target=[s.grip.x,s.grip.y,2.2];
        for(let j=0;j<3;j++)n.p[j]+=(target[j]-n.p[j])*Math.min(1,h*35);
      }
    }
    const fixed=i=>s.nodes[i].pin|| (s.grip&&i===s.heldNode);
    for(let iteration=0;iteration<10;iteration++){
      for(const link of s.links){
        const a=s.nodes[link.a],b=s.nodes[link.b],d=b.p.map((v,j)=>v-a.p[j]);
        const len=Math.hypot(...d),wa=fixed(link.a)?0:1,wb=fixed(link.b)?0:1;
        if(len<1e-8||wa+wb===0)continue;
        const correction=(len-link.length)/len*link.k/(wa+wb);
        for(let j=0;j<3;j++){a.p[j]+=d[j]*correction*wa;b.p[j]-=d[j]*correction*wb;}
      }
      for(const n of s.nodes){
        if(n.pin)n.p=n.pin.slice();
        n.p[0]=clamp(n.p[0],-bounds.x-.4,bounds.x+.4);
        n.p[1]=clamp(n.p[1],FLOOR+.07,bounds.top+.5);
        n.p[2]=Math.max(n.p[2],.08);
      }
    }
    let pins=0,ground=0,speed=0;
    for(let i=0;i<s.nodes.length;i++){
      const n=s.nodes[i];
      n.v=n.p.map((v,j)=>(v-old[i][j])/h);
      if(n.pad&&!n.pin&&!s.grip&&n.cooldown===0&&n.p[2]<=.095&&n.p[1]>FLOOR+.18){
        n.pin=n.p.slice();n.pin[2]=.08;n.p=n.pin.slice();
        // Unequal grip lifetimes produce torque around the remaining real contact.
        n.hold=(.8+s.adhesion*10)*TOYS[s.kind].grip*(.65+.65*(.5+.5*Math.sin(i*8.3+s.throws*2.4+s.wallHits*.7)));
        n.v=[0,0,0];s.contacted=true;s.wallHits++;
      }
      if(n.pin)pins++;
      if(n.p[1]<=FLOOR+.075){ground++;n.v[0]*=.6;n.v[2]*=.6;}
      speed+=Math.hypot(...n.v);
    }
    if(!s.grip){
      s.phase=pins?(pins>=3?'stuck':'peeling'):(s.contacted?'falling':'flying');
      if(ground>=3&&speed<1.2){s.phase='rest';s.floorHits++;for(const n of s.nodes)n.v=[0,0,0];}
    }
    const waist=s.nodes[0];[s.x,s.y,s.z]=waist.p;[s.vx,s.vy,s.vz]=waist.v;
  }
  updateBones(s);
}
// ponytail: rounded samples approximate body and limbs; mesh contacts are only
// needed for precise deformable stacking. The broad box alone is not a contact.
export function resolveToyContacts(slimes){
  const bodies=slimes.map(s=>{
    const points=s.nodes.map(n=>n.p);
    if(s.kind==='gecko')points.push(deformPoint(s,.06,.88,0,bindPoint(.06,.88,0,0,s.kind)));
    const min=[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))-.24);
    const max=[0,1,2].map(j=>Math.max(...points.map(p=>p[j]))+.24);
    const samples=s.nodes.map((n,i)=>({p:n.p,r:i<2?.25:i===2?.18:.12}));
    for(const [a,b] of EDGES)for(const t of [.25,.5,.75])samples.push({
      p:s.nodes[a].p.map((v,j)=>v+(s.nodes[b].p[j]-v)*t),r:s.kind==='star'?.16:.10,
    });
    if(s.kind==='gecko')for(const [x,y,r] of [[.08,.36,.08],[.20,.68,.05],[.06,.88,.025]]){
      samples.push({p:deformPoint(s,x,y,0,bindPoint(x,y,0,0,s.kind)),r});
    }
    return {s,min,max,samples};
  }).sort((a,b)=>(a.min[2]+a.max[2])-(b.min[2]+b.max[2]));
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
    const back=bodies[i],front=bodies[j];
    if([0,1].some(axis=>front.min[axis]>=back.max[axis]||front.max[axis]<=back.min[axis]))continue;
    if(front.min[2]>=back.max[2])continue;
    let push=0;
    for(const a of back.samples)for(const b of front.samples){
      const radius=a.r+b.r, dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],dz=b.p[2]-a.p[2];
      const cross=radius*radius-dx*dx-dy*dy;
      if(cross<=0||dz*dz>=cross)continue;
      push=Math.max(push,Math.sqrt(cross)-dz+.025);
    }
    if(push<=0)continue;
    const backVelocity=back.s.nodes.reduce((sum,n)=>sum+n.v[2],0)/back.s.nodes.length;
    // Preserve shared flight toward the wall; only cancel relative closing speed.
    // A toy resting on another toy cannot simultaneously pin through it to the wall.
    for(const n of front.s.nodes){
      n.p[2]+=push;n.v[2]=Math.max(backVelocity,n.v[2]);
      n.pin=null;n.hold=0;n.cooldown=Math.max(n.cooldown,.15);
    }
    for(const sample of front.samples.slice(front.s.nodes.length))sample.p[2]+=push;
    front.min[2]+=push;front.max[2]+=push;
    front.s.z+=push;front.s.vz=Math.max(backVelocity,front.s.vz);
    if(!front.s.grip&&front.s.phase!=='rest')front.s.phase=front.s.contacted?'falling':'flying';
    updateBones(front.s);
  }
}
function updateBones(s){
  const REST=s.rest;
  s.bones=EDGES.map(([a,b])=>{
    const start=REST[a],u=REST[b].map((v,j)=>v-start[j]),v=s.nodes[b].p.map((p,j)=>p-s.nodes[a].p[j]);
    const l=Math.hypot(...u),r=Math.max(1e-8,Math.hypot(...v));
    for(let j=0;j<3;j++){u[j]/=l;v[j]/=r;}
    let q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0],1+u.reduce((sum,p,j)=>sum+p*v[j],0)];
    if(q[3]<1e-6)q=[-u[1],u[0],0,0];
    const norm=Math.hypot(...q);q=q.map(p=>p/norm);
    return {p:s.nodes[a].p,u,q,scale:r/l};
  });
}
export function bindPoint(x,y,z,boneIndex=null,kind='spider'){
  const REST=TOYS[kind].rest;
  const point=[x,y,z];
  let candidates=EDGES.map(([a,b],index)=>{
    const d=REST[b].map((v,j)=>v-REST[a][j]),offset=point.map((v,j)=>v-REST[a][j]);
    const t=clamp(offset.reduce((sum,v,j)=>sum+v*d[j],0)/d.reduce((sum,v)=>sum+v*v,0),0,1);
    const distance=Math.hypot(...offset.map((v,j)=>v-t*d[j]));
    return {index,offset,weight:1/Math.max(.015,distance)**4};
  }).filter(c=>boneIndex===null||c.index===boneIndex).sort((a,b)=>b.weight-a.weight).slice(0,kind==='star'?EDGES.length:2);
  const total=candidates.reduce((sum,c)=>sum+c.weight,0);
  candidates=candidates.map(c=>({...c,weight:c.weight/total}));
  if(kind==='star'&&boneIndex===null){
    const blend=clamp((Math.hypot(x,y)-.24)/.24,0,1);
    const smooth=blend*blend*(3-2*blend);
    for(const c of candidates)c.weight=c.weight*smooth+(c.index===0?1-smooth:0);
  }
  return candidates;
}
// Each molded limb follows only its own chain; roots share the torso transform.
export function bindLimbPoint(x,y,z,limbIndex,kind){
  const upper=2+limbIndex*2, lower=upper+1, rest=TOYS[kind].rest;
  const point=[x,y,z], root=rest[EDGES[upper][0]], tip=rest[EDGES[lower][1]];
  const fromRoot=length(point,root), fromTip=length(point,tip);
  const t=2*fromRoot/(fromRoot+fromTip);
  const smooth=(a,b)=>{const v=clamp((t-a)/(b-a),0,1);return v*v*(3-2*v);};
  const core=1-smooth(.35,.85), end=smooth(.85,1.35);
  return [[0,core],[upper,1-core-end],[lower,end]].filter(([,w])=>w>0).map(([index,weight])=>({
    ...bindPoint(x,y,z,index,kind)[0],weight,
  }));
}
export function deformPoint(s,x,y,z,binding=bindPoint(x,y,z,null,s.kind)){
  const result=[0,0,0];
  for(const {index,offset,weight} of binding){
    const {p,u,q,scale}=s.bones[index],along=offset.reduce((sum,v,j)=>sum+v*u[j],0)*(scale-1);
    const [vx,vy,vz]=offset.map((v,j)=>v+u[j]*along),[qx,qy,qz,qw]=q;
    const tx=2*(qy*vz-qz*vy),ty=2*(qz*vx-qx*vz),tz=2*(qx*vy-qy*vx);
    const rotated=[vx+qw*tx+qy*tz-qz*ty,vy+qw*ty+qz*tx-qx*tz,vz+qw*tz+qx*ty-qy*tx];
    for(let j=0;j<3;j++)result[j]+=(p[j]+rotated[j])*weight;
  }
  result[1]=Math.max(FLOOR+.012,result[1]);result[2]=Math.max(.025,result[2]);
  return result;
}
