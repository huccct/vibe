import assert from 'node:assert/strict';import{createRings,pump,step,TIP,PEGS,RING_RADIUS,RING_TUBE,RING_BOUNDS}from'./physics.js';
const r=createRings();pump(r);assert(r.every(a=>a.vy>0));for(let i=0;i<1600;i++)step(r,1/120);assert(r.every(a=>Number.isFinite(a.x)&&Math.abs(a.x)<2.65&&a.y>=.15&&a.y<=2.49));
const falling=(x,z,rx)=>({...createRings()[0],x,y:TIP+.002,z,vy:-1,rx});
const hit=[falling(PEGS[0],0,Math.PI/2)];step(hit,1/120);assert.equal(hit[0].caught,0);assert(hit[0].y>TIP-.05,'Slide onto peg rather than teleport');for(let i=0;i<180;i++)step(hit,1/120);assert.equal(hit[0].y,hit[0].seat);
for(const miss of[falling(PEGS[0],.22,Math.PI/2),falling(PEGS[0],0,0)]){step([miss],1/120);assert.equal(miss.caught,-1,'Depth and orientation must line up')}
assert.throws(()=>step(r,NaN));assert.throws(()=>pump(r,Infinity));console.log('Passed: lift, settling, bounds, depth/orientation catch and sliding onto pegs.');

const left=createRings(),right=createRings();pump(left,1,-1);pump(right,1,1);assert(left.reduce((n,r)=>n+r.vx,0)>right.reduce((n,r)=>n+r.vx,0));assert.throws(()=>pump(left,1,0));

// Regression: the entire tumbling ring must stay in front of the print and behind the glass.
const tumbling=createRings(),extent=RING_RADIUS+RING_TUBE;
for(let i=0;i<2400;i++){
 if(i%90===0)pump(tumbling,1.5,i%180===0?-1:1);
 for(const ring of tumbling){
  assert(ring.z-extent>-.20 && ring.z+extent<.35,'Ring intersects a chamber face');
  for(const axis of ['x','y','z'])assert(ring[axis]>=RING_BOUNDS[axis][0] && ring[axis]<=RING_BOUNDS[axis][1],'Contact pushed ring outside tank');
 }
 step(tumbling,1/120,Math.sin(i/100)*.22);
}
console.log('Passed: full ring clearance during repeated pumping and tilting.');

// Tilted hole crossing happens before the center reaches the tip, and fast sweeps use the crossing point.
const {crossesHole}=await import('./physics.js');
const pose={x:PEGS[0],y:TIP+.055,z:.05,rx:Math.PI/4,vy:-1};
assert(crossesHole(pose,{...pose,y:TIP+.045},PEGS[0]),'Tilted opening should catch');
assert(crossesHole({...pose,x:PEGS[0]-.2,y:TIP+.1,z:0,rx:Math.PI/2},{...pose,x:PEGS[0]+.2,y:TIP-.1,z:0,rx:Math.PI/2},PEGS[0]),'Sweep must use crossing position');
assert(!crossesHole(pose,{...pose,y:TIP+.045,vy:1},PEGS[0]),'Upward motion must not catch');
assert(!crossesHole({...pose,x:PEGS[0]+.14},{...pose,x:PEGS[0]+.14,y:TIP+.045},PEGS[0]),'Outside hole must miss');
const settled=createRings();pump(settled);for(let i=0;i<3600;i++)step(settled,1/120);
assert(settled.every(r=>r.sleeping||r.caught>=0));const snapshot=JSON.stringify(settled);for(let i=0;i<240;i++)step(settled,1/120);assert.equal(JSON.stringify(settled),snapshot,'Resting rings must remain still');
pump(settled);assert(settled.filter(r=>r.caught<0).every(r=>!r.sleeping&&r.vy>0),'Pump wakes resting rings');
console.log('Passed: swept tilted-hole catch, no outside/upward catch, stable rest and pump wake.');

const {resolvePegContact}=await import('./physics.js');
const sideHit={...createRings()[0],x:PEGS[0]+RING_RADIUS,y:1.4,z:0,rx:Math.PI/2,vx:-1};
resolvePegContact(sideHit);assert(sideHit.x>PEGS[0]+RING_RADIUS+.025,'Rim must be pushed outside the shaft');assert(sideHit.vx>=0,'Shaft stops inward movement');
const openHole={...sideHit,x:PEGS[0],z:0,vx:0};const holeBefore=JSON.stringify(openHole);resolvePegContact(openHole);assert.equal(JSON.stringify(openHole),holeBefore,'Empty ring hole must not collide');
const crossing={...createRings()[0],x:PEGS[0]+.3,y:1.4,z:0,rx:Math.PI/2,vx:-2,spin:0};
for(let i=0;i<20;i++)step([crossing],1/120);
assert(crossing.x>PEGS[0]+.16,'Moving rim cannot travel through shaft');
console.log('Passed: shaft contact, inward velocity response, open hole and moving ring collision.');

const {resolveBaseContact}=await import('./physics.js');
for(const [y,vy,direction]of [[.96,-1,1],[.88,1,-1]]){
 const r={...createRings()[0],x:PEGS[0],y,z:0,rx:Math.PI/2,vy};resolveBaseContact(r);
 assert(direction*(r.y-y)>0,'Tray must block both top and underside');assert(Math.abs(r.vy)<Math.abs(vy),'Tray must reduce incoming speed while allowing rotation');
}
const support={...createRings()[0],x:PEGS[0]+.15,y:.90,z:-.15,rx:Math.PI/2};const old=JSON.stringify(support);resolveBaseContact(support);assert.notEqual(JSON.stringify(support),old,'Rear support must be solid');
console.log('Passed: tray top, underside and rear support collisions.');

// Regression for rings hanging vertically below the tray; contacts must let them rotate free.
for(const rx of [0,.2,.5])for(const z of [0,.07,.14]){
 const hanging={...createRings()[0],x:PEGS[0],y:.82,z,rx,rz:0};
 for(let i=0;i<3600;i++)step([hanging],1/120);
 assert.equal(hanging.caught,-1,'A tray snag is not a scored catch');
 assert(hanging.y<RING_BOUNDS.y[0]+.12&&hanging.sleeping,'Rim snag must release and settle');
}
const scored={...createRings()[0],x:PEGS[0],y:1.2,z:0,rx:Math.PI/2,caught:0,seat:.9815};
for(let i=0;i<600;i++)step([scored],1/120);
assert.equal(scored.caught,0);assert.equal(scored.y,scored.seat,'A valid catch stays seated');
console.log('Passed: nine rim snags release and settle; scored ring remains seated.');
