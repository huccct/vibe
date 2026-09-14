export const PEGS=[-1.05,1.05], TOTAL=12, TIP=1.85;
export const RING_RADIUS=.151, RING_TUBE=.028;
const extent=RING_RADIUS+RING_TUBE;
// ponytail: a conservative sphere keeps every ring orientation inside the shallow chamber.
export const RING_BOUNDS={x:[-2.44,2.44],y:[.03+extent+.005,2.49],z:[-.20+extent+.005,.35-extent-.005]};
export function createRings(){return Array.from({length:TOTAL},(_,i)=>({x:Math.sin(i*2.39+.4)*2.22,y:RING_BOUNDS.y[0]+(i%4)*.07,z:.02+((i*7)%5)*.025,vx:0,vy:0,vz:0,rx:.55+i*.71,rz:i*.93,spin:0,caught:-1,seat:0,rest:0,sleeping:false}))}
// ponytail: damped 3D particles and a pulsed circulation field, not a full fluid solver.
export function pump(rings,power=1,side=-1){if(!Number.isFinite(power)||power<0||power>1.5||![-1,1].includes(side))throw new RangeError('Invalid pressure');for(let i=0;i<rings.length;i++){const r=rings[i];if(r.caught>=0)continue;r.sleeping=false;r.rest=0;const jet=.2+.8*Math.exp(-((r.x-side*1.95)**2)/4);r.vy=Math.min(4.9,r.vy+(3.5+.7*Math.sin(i*1.7+r.rz))*jet*power);r.vx+=(-side*.8-r.x*.12+Math.sin(i*2.1+r.rx)*.5)*power;r.vz+=Math.sin(i*2.3+r.rx)*.4*power;r.spin+=(i%2?-1:1)*(2.5+jet)*power}}
// The peg tip must cross the actual ring plane inside its open hole.
export function crossesHole(before,after,peg){
 if(after.vy>=0)return false;
 const signed=r=>-Math.sin(r.rx)*(TIP-r.y)+Math.cos(r.rx)*(-r.z);
 const a=signed(before),b=signed(after);
 if(a*b>0 || Math.abs(a-b)<1e-9)return false;
 const t=a/(a-b),x=before.x+(after.x-before.x)*t,y=before.y+(after.y-before.y)*t,z=before.z+(after.z-before.z)*t,rx=before.rx+(after.rx-before.rx)*t;
 return Math.abs(Math.sin(rx))>.15 && Math.hypot(peg-x,TIP-y,z)<RING_RADIUS-RING_TUBE-.023;
}
// Contact impulse includes the lever arm, so an off-center rim contact turns the ring.
function contactResponse(r,nx,ny,nz,depth,armY,armZ){
 const inertia=RING_RADIUS*RING_RADIUS/2,lever=armY*nz-armZ*ny,weight=1+lever*lever/inertia;
 const correction=depth/weight;r.x+=nx*correction;r.y+=ny*correction;r.z+=nz*correction;
 r.rx+=Math.max(-.12,Math.min(.12,lever*correction/inertia));
 const speed=r.vx*nx+r.vy*ny+r.vz*nz+r.spin*lever;
 if(speed<0){const impulse=-speed/weight;r.vx+=nx*impulse;r.vy+=ny*impulse;r.vz+=nz*impulse;r.spin+=lever*impulse/inertia}
}
// ponytail: 64 samples of the torus centerline against the tapered peg capsule;
// sampling error is under .0002 units at this ring size. The open center stays empty.
export function resolvePegContact(r){
 if(r.caught>=0)return;
 for(const peg of PEGS){
  if(Math.abs(r.x-peg)>extent+.05||r.y<TIP-1.0-extent||r.y>TIP+extent)continue;
  for(let pass=0;pass<6;pass++){
   let contact=null;
   for(let i=0;i<64;i++){
    const a=i*Math.PI/32,dx=Math.cos(a)*RING_RADIUS,dy=Math.sin(a)*RING_RADIUS;
    const x=r.x+dx,y=r.y+dy*Math.cos(r.rx),z=r.z+dy*Math.sin(r.rx);
    const py=Math.max(.9,Math.min(TIP,y)),radius=.04-(py-.9)/(TIP-.9)*.017;
    const nx=x-peg,ny=y-py,nz=z,d=Math.hypot(nx,ny,nz),depth=RING_TUBE+radius+.0003-d;
    if(depth>0&&(!contact||depth>contact.depth))contact={nx,ny,nz,d,depth,armY:y-r.y,armZ:z-r.z};
   }
   if(!contact)break;
   let {nx,ny,nz,d,depth}=contact;
   if(d<1e-7){nx=r.x>=peg?1:-1;ny=nz=0;d=1}
   nx/=d;ny/=d;nz/=d;
   contactResponse(r,nx,ny,nz,depth,contact.armY,contact.armZ);
  }
 }
}
// Torus samples against the solid tray and its rectangular rear support.
export function resolveBaseContact(r){
 if(r.caught>=0)return;
 for(const peg of PEGS){
  if(Math.abs(r.x-peg)>.19+extent||Math.abs(r.y-.92)>.065+extent)continue;
  for(let pass=0;pass<8;pass++){
   let hit=null,armY=0,armZ=0;
   const consider=(nx,ny,nz,depth)=>{if(depth>0&&(!hit||depth>hit.depth))hit={nx,ny,nz,depth,armY,armZ}};
   for(let i=0;i<64;i++){
    const a=i*Math.PI/32,x=r.x+Math.cos(a)*RING_RADIUS-peg,y=r.y+Math.sin(a)*RING_RADIUS*Math.cos(r.rx),z=r.z+Math.sin(a)*RING_RADIUS*Math.sin(r.rx);
    armY=y-r.y;armZ=z-r.z;
    const h=y-.92,rho=Math.hypot(x,z),rad=.19-.02*Math.max(0,Math.min(1,(h+.0325)/.065));
    const dr=rho-rad,dh=Math.abs(h)-.0325;
    if(dr>0||dh>0){const dx=Math.max(dr,0),dy=Math.max(dh,0),d=Math.hypot(dx,dy);consider(rho?x/rho*dx/d:0,Math.sign(h)*dy/d,rho?z/rho*dx/d:0,RING_TUBE+.0003-d)}
    else if(dr>dh)consider(rho?x/rho:1,0,rho?z/rho:0,RING_TUBE-dr+.0003);
    else consider(0,h>=0?1:-1,0,RING_TUBE-dh+.0003);
    const local=[x,y-.90,z+.18],half=[.0325,.0325,.18],delta=local.map((v,k)=>v-Math.max(-half[k],Math.min(half[k],v))),d=Math.hypot(...delta);
    if(d>0)consider(...delta.map(v=>v/d),RING_TUBE+.0003-d);
    else{const gaps=local.map((v,k)=>half[k]-Math.abs(v)),k=gaps.indexOf(Math.min(...gaps)),n=[0,0,0];n[k]=local[k]>=0?1:-1;consider(...n,RING_TUBE+gaps[k]+.0003)}
   }
   if(!hit)break;
   const {nx,ny,nz,depth,armY:ay,armZ:az}=hit;
   contactResponse(r,nx,ny,nz,depth,ay,az);
  }
 }
}
export function step(rings,dt,tilt=0){if(!Number.isFinite(dt)||dt<0||dt>.05||!Number.isFinite(tilt))throw new RangeError('Invalid simulation step');if(dt>1/120){const n=Math.ceil(dt*120);for(let i=0;i<n;i++)step(rings,dt/n,tilt);return}for(let i=0;i<rings.length;i++){const r=rings[i];if(r.caught>=0){r.x+=(PEGS[r.caught]-r.x)*Math.min(1,dt*12);r.z*=Math.exp(-dt*12);r.rx+=(Math.PI/2-r.rx)*Math.min(1,dt*8);r.rz*=Math.exp(-dt*8);r.y=Math.max(r.seat,r.y-dt*.9);continue}if(r.sleeping){if(Math.abs(tilt)<.04)continue;r.sleeping=false;r.rest=0}const before={x:r.x,y:r.y,z:r.z,rx:r.rx};r.vy-=1.35*dt;r.vx+=(tilt*3.5+Math.sin(r.y*2+r.rz)*Math.abs(r.vy)*.09)*dt;r.vx*=Math.exp(-1.05*dt);r.vy*=Math.exp(-.63*dt);r.vz*=Math.exp(-1.3*dt);r.spin*=Math.exp(-1.1*dt);r.rx+=(r.spin+.12*r.vy)*dt;r.rz+=r.spin*.43*dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;
 for(let p=0;p<2;p++){if(crossesHole(before,r,PEGS[p])){r.caught=p;r.seat=.92+.065/2+RING_TUBE+.001+rings.filter(a=>a!==r&&a.caught===p).length*.055;r.rx=((r.rx+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;r.vx=r.vy=r.vz=0;break}}
 for(const [pos,vel,lo,hi]of[['x','vx',...RING_BOUNDS.x],['z','vz',...RING_BOUNDS.z],['y','vy',...RING_BOUNDS.y]]){if(r[pos]<lo||r[pos]>hi){r[pos]=Math.max(lo,Math.min(hi,r[pos]));r[vel]=(pos==='y'&&r.y===lo&&Math.abs(r[vel])<.3)?0:r[vel]*-.2;if(pos==='y'&&r.y===lo){r.vx*=.9;r.spin*=.8;r.rx+=(Math.PI/2-r.rx)*Math.min(1,dt*5)}}}
 }
 // Soft contacts prevent rings from occupying exactly the same volume.
 for(let i=0;i<rings.length;i++)for(let j=i+1;j<rings.length;j++){const a=rings[i],b=rings[j];if(a.caught>=0||b.caught>=0||(a.sleeping&&b.sleeping))continue;const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz);if(d>0.001&&d<.24){const f=(.24-d)*.22/d;a.x-=dx*f;b.x+=dx*f;a.y=Math.max(RING_BOUNDS.y[0],a.y-dy*f);b.y=Math.max(RING_BOUNDS.y[0],b.y+dy*f);const closing=((b.vx-a.vx)*dx+(b.vy-a.vy)*dy+(b.vz-a.vz)*dz)/d;if(closing<-.05){const impulse=-closing*.5;a.vx-=dx/d*impulse;b.vx+=dx/d*impulse;a.sleeping=b.sleeping=false;a.rest=b.rest=0}}}
 // Resolve contacts before the final boundary clamp: contacts can push a ring back outside.
 for(const r of rings){
  resolvePegContact(r);
  resolveBaseContact(r);
  for(const axis of ['x','y','z']){const [lo,hi]=RING_BOUNDS[axis];r[axis]=Math.max(lo,Math.min(hi,r[axis]))}
  if(r.caught>=0||r.sleeping)continue;
  if(r.y<RING_BOUNDS.y[0]+.12 && Math.hypot(r.vx,r.vy,r.vz)<.22 && Math.abs(tilt)<.04){
   r.rest+=dt;r.vx*=Math.exp(-dt*10);r.vz*=Math.exp(-dt*10);r.spin*=Math.exp(-dt*10);r.rx+=(Math.PI/2-r.rx)*Math.min(1,dt*10);
   if(r.rest>.7){r.sleeping=true;r.vx=r.vy=r.vz=r.spin=0}
  }else r.rest=0;
 }
}
