import { createStarGeometry } from './star.js';
import assert from 'node:assert/strict';
import { createSlime, grab, release, toss, tossTogether, step, resolveToyContacts, bindPoint, bindLimbPoint, deformPoint, TOYS, FLOOR } from './physics.js';
const bounds={x:2,top:3};
function cycle(adhesion,dt=1/120){
  const s=createSlime();s.adhesion=adhesion;toss(s);
  const phases=new Set();let firstPeel=0,reattached=false,previousHits=0;
  for(let t=0;t<120;t+=dt){
    const pins=s.nodes.map(n=>n.pin?.slice());
    step(s,dt,bounds);phases.add(s.phase);
    if(s.phase==='peeling'&&!firstPeel)firstPeel=t;
    if(firstPeel&&s.wallHits>previousHits)reattached=true;
    previousHits=s.wallHits;
    for(let i=0;i<s.nodes.length;i++){
      const n=s.nodes[i];assert(n.p.every(Number.isFinite));
      assert(n.p[1]>=FLOOR+.069);assert(n.p[2]>=.079);
      if(pins[i]&&n.pin)assert.deepEqual(n.p,pins[i],'A sticky contact cannot skate across the wall');
    }
    const spine=s.nodes[1].p.map((v,j)=>v-s.nodes[0].p[j]);
    const neck=s.nodes[2].p.map((v,j)=>v-s.nodes[1].p[j]);
    const alignment=spine.reduce((sum,v,j)=>sum+v*neck[j],0)/Math.hypot(...spine)/Math.hypot(...neck);
    assert(alignment>.8,'Neck cannot fold away from the torso during a tumble');
    for(const [a,b] of [[0,1],[1,2],[1,3],[3,5],[1,4],[4,6],[0,7],[7,9],[0,8],[8,10]]){
      const length=Math.hypot(...s.nodes[a].p.map((v,j)=>v-s.nodes[b].p[j]));
      assert(length<.5,'Limbs stay rubbery without stretching into strings');
    }
  }
  for(const phase of ['flying','stuck','peeling','rest'])assert(phases.has(phase),phase);
  if(adhesion===0)assert(phases.has('falling'),'Low adhesion allows free fall');
  if(adhesion===.55)assert(reattached,'A released pad can catch the wall again');
  assert.equal(s.phase,'rest');assert.equal(s.floorHits,1);
  return {s,firstPeel};
}
const low=cycle(0),high=cycle(1);cycle(.55,1/30);cycle(.70);
assert(high.firstPeel>low.firstPeel,'Adhesion delays independent pad release');
const s=high.s;grab(s,s.nodes[5].p[0],s.nodes[5].p[1]);
assert.equal(s.heldNode,5,'Grab the touched limb, not the entire center');
s.grip={x:0,y:1};for(let i=0;i<240;i++)step(s,1/120,bounds);
assert(s.nodes[5].p[1]>.85);assert(s.nodes[0].p[1]<s.nodes[5].p[1],'Body hangs below the held hand');
release(s,1e6,1e6);step(s,1/120,bounds);assert.equal(s.phase,'flying','A new launch does not inherit the previous fall');assert(Math.hypot(...s.nodes[0].v.slice(0,2))<=15.01);
assert.throws(()=>step(s,NaN),RangeError);assert.throws(()=>step(s,-1),RangeError);
const before=JSON.stringify(s);grab(s,Infinity,0);assert.equal(JSON.stringify(s),before);
const ready=createSlime();
for(const p of [[0,0,0],[.28,-.72,.02],[-.34,.72,0]]){
  const actual=deformPoint(ready,...p,bindPoint(...p));
  for(let j=0;j<3;j++)assert(Math.abs(actual[j]-p[j]-[0,.15,.22][j])<1e-8,'Skin preserves rest shape');
}
console.log('Passed: fixed individual contacts, release/re-catch, bounded limb stretch, landing, hand grab, adhesion, 30 FPS and skinning.');

for(const p of [[0,-.5,0],[.035,-.514,.053],[0,-.415,0]]){
  const binding=bindPoint(...p,0);
  assert.equal(binding.length,1);assert.equal(binding[0].index,0,'Head, eyes and neck follow the torso, never an arm');
}
console.log('Passed: neck alignment and shared head/torso binding.');

for(const kind of Object.keys(TOYS)){
  const toy=createSlime(kind);assert.equal(toy.nodes.filter(n=>n.pad).length,kind==='star'?5:4);
  for(const p of toy.rest){
    const point=deformPoint(toy,...p,bindPoint(...p,null,kind));
    assert(point.every(Number.isFinite),'Every toy has valid skin bindings');
  }
  toss(toy);
  for(let i=0;i<14400;i++){
    step(toy,1/120,{x:2,top:3});
    assert(toy.nodes.every(n=>n.p.every(Number.isFinite)));
  }
  assert(toy.wallHits>0,kind+' sticks');assert.equal(toy.phase,'rest',kind+' settles');
  grab(toy,toy.x,toy.y);toy.grip.y=1;
  for(let i=0;i<240;i++)step(toy,1/120,{x:2,top:3});
  assert(toy.nodes[toy.heldNode].p[1]>.8,kind+' can be picked up again');
}
assert.throws(()=>createSlime('unknown'),RangeError);
console.log('Passed: four toy profiles, five-point star, skinning, contact, landing and re-grab.');

const starMesh=createStarGeometry(), edgeCounts=new Map();
const triangles=starMesh.index.array;
for(let i=0;i<triangles.length;i+=3)for(const [a,b] of [[triangles[i],triangles[i+1]],[triangles[i+1],triangles[i+2]],[triangles[i+2],triangles[i]]]){
  const key=a<b?`${a},${b}`:`${b},${a}`;edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
}
assert([...edgeCounts.values()].every(count=>count===2),'Star must be a closed, shared surface with no loose arm seams');
assert(starMesh.attributes.normal.getZ(0)>.9,'Star front faces the viewer');
const centerBinding=bindPoint(.075,-.065,.13,null,'star');
assert.equal(centerBinding.find(b=>b.index===0).weight,1,'Star face and center follow exactly the same transform');
starMesh.dispose();
console.log('Passed: closed star surface, outward normals and stable face binding.');

for(const kind of ['spider','gecko','frog']){
  const toy=createSlime(kind);
  const chains=[[1,3,5],[1,4,6],[0,7,9],[0,8,10]];
  for(const [limbIndex,[root,,tip]] of chains.entries()){
    const upper=2+limbIndex*2, lower=upper+1;
    for(const [node,bone] of [[root,0],[tip,lower]]){
      const p=toy.rest[node], binding=bindLimbPoint(...p,limbIndex,kind);
      assert.deepEqual(binding,bindPoint(...p,bone,kind),'Limb roots match torso and tips match pads');
    }
    for(let i=0;i<=100;i++){
      const p=toy.rest[root].map((v,j)=>v+(toy.rest[tip][j]-v)*i/100);
      const binding=bindLimbPoint(...p,limbIndex,kind);
      assert(binding.every(b=>[0,upper,lower].includes(b.index)),'No neighboring limb can pull this skin');
      assert(Math.abs(binding.reduce((sum,b)=>sum+b.weight,0)-1)<1e-12);
    }
  }
  toss(toy);
  for(let frame=0;frame<1200;frame++){
    step(toy,1/120,bounds);
    for(const [limbIndex,[root,,tip]] of chains.entries())for(const [node,bone] of [[root,0],[tip,3+2*limbIndex]]){
      const p=toy.rest[node];
      assert.deepEqual(deformPoint(toy,...p,bindLimbPoint(...p,limbIndex,kind)),deformPoint(toy,...p,bindPoint(...p,bone,kind)), 'Attachments stay together throughout a throw');
    }
  }
}
console.log('Passed: isolated limb chains and matching body/pad attachments for spider, gecko and frog.');

const group=Object.keys(TOYS).map((kind,i)=>createSlime(kind,[(i-1.5)*1.9,.35,.22]));
for(const toy of group){
  const origin=[toy.x,toy.y,toy.z];
  const p=toy.rest[0], actual=deformPoint(toy,...p,bindPoint(...p,0,toy.kind));
  actual.forEach((v,j)=>assert(Math.abs(v-p[j]-origin[j])<1e-10,'Spawn offsets reach the rendered skin'));
}
const untouched=group.slice(1).map(toy=>JSON.stringify(toy));
grab(group[0],group[0].x,group[0].y);step(group[0],1/60);release(group[0],2,3);
group.slice(1).forEach((toy,i)=>assert.equal(JSON.stringify(toy),untouched[i],'Dragging one toy leaves the others alone'));
for(const [i,toy] of group.entries())toss(toy,(i-1.5)*1.9,.35);
for(let frame=0;frame<14400;frame++){
  for(const toy of group)step(toy,1/120,{x:4,top:3});
  resolveToyContacts(group);
}
for(const toy of group){assert(toy.wallHits>0);assert.equal(toy.phase,'rest');}
console.log('Passed: four independent spawn positions, single-toy grab, simultaneous throws and landing.');

assert.equal(new Set(Object.values(TOYS).map(profile=>profile.adhesion)).size,4,'Every toy starts with a different adhesion');
for(const kind of Object.keys(TOYS)){
  const toy=createSlime(kind);assert.equal(toy.adhesion,TOYS[kind].adhesion);
  toss(toy,0,2.9);
  for(let i=0;i<120&&!toy.wallHits;i++)step(toy,1/120,{x:4,top:3.05});
  assert(toy.wallHits>0&&toy.y>2.5,kind+' reaches the upper wall before attaching');
}
console.log('Passed: distinct default adhesion and upper-wall throws for all four toys.');

for(const kind of Object.keys(TOYS)){
  const launches=[];
  for(const value of [0,.5,.999]){
    const toy=createSlime(kind);toss(toy,0,2.7,()=>value);
    launches.push(JSON.stringify(toy.nodes.map(n=>[n.p,n.v])));
    let firstContactY, landedAt;
    for(let frame=0;frame<14400;frame++){
      step(toy,1/120,{x:4,top:3.05});
      if(toy.wallHits&&firstContactY===undefined)firstContactY=toy.y;
      if(toy.phase==='rest'){landedAt=frame/120;break;}
    }
    assert(firstContactY>2.1,kind+' randomized throw still reaches the upper wall');
    assert.equal(toy.phase,'rest',kind+' randomized throw settles');
    assert(landedAt>15,kind+' must not drop to the floor within a few seconds at default adhesion');
    assert(toy.nodes.every(n=>n.p.every(Number.isFinite)));
  }
  assert.equal(new Set(launches).size,3,'Random input changes launch pose and velocity');
}
console.log('Passed: randomized launch extremes, upper-wall contact and stable landing for every toy.');


const touching=[createSlime('gecko'),createSlime('star')];
for(const toy of touching)for(const n of toy.nodes)if(n.pad){n.pin=n.p.slice();n.hold=10;}
const backBefore=JSON.stringify(touching[0].nodes);
resolveToyContacts(touching);
assert.equal(JSON.stringify(touching[0].nodes),backBefore,'Back toy retains its wall anchors');
assert(touching[1].nodes.every(n=>!n.pin),'Front toy cannot cling through the toy behind it');
assert(Math.min(...touching[1].nodes.map(n=>n.p[2]))-Math.max(...touching[0].nodes.map(n=>n.p[2]))>.48,'Overlapping bodies have actual depth clearance');
const separated=JSON.stringify(touching);resolveToyContacts(touching);
assert.equal(JSON.stringify(touching),separated,'Resolving an existing contact must not creep or jitter');
const pile=Object.keys(TOYS).map(kind=>createSlime(kind));
for(let frame=0;frame<360;frame++){
  for(const toy of pile)step(toy,1/120,bounds);
  resolveToyContacts(pile);
  assert(pile.every(toy=>toy.nodes.every(n=>n.p.every(Number.isFinite))),'Four-toy overlap stays finite');
}
const distant=[createSlime('gecko',[-2,0,.22]),createSlime('star',[2,0,.22])];
const distantBefore=JSON.stringify(distant);resolveToyContacts(distant);
assert.equal(JSON.stringify(distant),distantBefore,'Nonoverlapping toys keep their original motion');
console.log('Passed: overlapping toys separate in depth, release obstructed wall pins, and remain stable in a four-toy pile.');


// Exercise the actual shared collision path, not four isolated throws.
for(const narrow of [false,true])for(let seed=1;seed<=100;seed++){
  let randomState=seed;
  const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/2**32);
  const limit=narrow?{x:1.56,top:3.47}:{x:4,top:3.05};
  const batch=Object.keys(TOYS).map(kind=>createSlime(kind));
  tossTogether(batch,limit,random);
  const launchHeights=batch.map(toy=>toy.nodes[0].p[1]);
  assert(Math.max(...launchHeights)-Math.min(...launchHeights)>1,'Group throws must not form one row');
  for(let frame=0;frame<180;frame++){
    for(const toy of batch)step(toy,1/120,limit);
    resolveToyContacts(batch);
  }
  assert(batch.every(toy=>toy.wallHits>0),`All four must reach the wall: narrow=${narrow}, seed=${seed}`);
}
const airborne=[createSlime('gecko'),createSlime('star')];
for(const toy of airborne)toss(toy);
resolveToyContacts(airborne);
assert(airborne.every(toy=>toy.nodes.every(n=>n.v[2]<-7)),'Contact preserves shared inward flight velocity');
console.log('Passed: 200 shared-wall launch batches and preserved incoming velocity.');
