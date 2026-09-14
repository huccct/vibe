import * as T from '../../src/vendor/three.module.min.js';
import {loop} from '../../src/shared/stage.js';
import {createRings,pump,step,PEGS,TOTAL,TIP,RING_RADIUS,RING_TUBE} from './physics.js';
const host=document.getElementById('stage'),buttons=[...document.querySelectorAll('.pump')],score=document.getElementById('score');
let renderer;try{renderer=new T.WebGLRenderer({antialias:true})}catch(e){document.getElementById('error').hidden=false;throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xe5e3dc);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','黄色横向塑料机身、海底背板和左右双按钮的三维套圈机');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,100);
scene.add(new T.HemisphereLight(0xffffff,0x8d8a7d,1.4));const key=new T.DirectionalLight(0xfff5e7,2.4);key.position.set(-4,9,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:8,bottom:-6,near:.1,far:30});key.shadow.normalBias=.035;key.shadow.radius=4;scene.add(key);const fill=new T.DirectionalLight(0xe3ecff,1.3);fill.position.set(5,4,-3);scene.add(fill);
const studio=new T.Scene();studio.background=new T.Color(0xc9c8c3);for(const [x,y,z,w,h]of[[-4,5,5,3,8],[5,4,2,2,6],[0,8,-2,7,3]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(1.7,1.7,1.7)}));m.position.set(x,y,z);m.lookAt(0,2,0);studio.add(m)}const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.08);scene.environment=env.texture;pmrem.dispose();studio.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});
const red=new T.MeshPhysicalMaterial({color:0xf6c524,roughness:.29,metalness:0,clearcoat:.48,clearcoatRoughness:.24});const redDark=new T.MeshStandardMaterial({color:0xe5a718,roughness:.5});const cream=new T.MeshPhysicalMaterial({color:0xee5639,roughness:.28,clearcoat:.25});const clear=new T.MeshPhysicalMaterial({color:0xf5fffd,roughness:.015,transmission:1,thickness:.035,ior:1.47,transparent:true,opacity:1,depthWrite:false,envMapIntensity:.85});const acrylic=new T.MeshPhysicalMaterial({color:0xd5e3df,roughness:.17,metalness:0,transparent:true,opacity:.14,depthWrite:false});
const toy=new T.Group();toy.position.y=-1.9;const pivot=new T.Group();pivot.add(toy);scene.add(pivot);
function mesh(g,m,parent=toy,p=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=!m.transparent;o.receiveShadow=!m.transparent;parent.add(o);return o}
function rounded(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
function block(w,h,d,r,mat,p){const g=new T.ExtrudeGeometry(rounded(w-.1,h-.1,r),{depth:d-.10,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.05,bevelThickness:.05,curveSegments:10});g.translate(0,0,-(d-.1)/2);return mesh(g,mat,toy,p)}
function cylinder(rad,len,mat,p){const o=mesh(new T.CylinderGeometry(rad,rad,len,48),mat,toy,p);o.rotation.x=Math.PI/2;return o}
// Rounded injection-moulded shell, a recessed clear window and two mechanical pumps.
block(6.8,4.05,1.0,.65,redDark,[0,1.92,-.10]);
block(6.72,3.97,.78,.62,red,[0,1.94,.02]);
block(5.63,2.97,.13,.38,cream,[0,2.37,.46]);
const tank=new T.Group();tank.position.set(0,.97,.77);toy.add(tank);
// ponytail: original canvas print approximates the undersea backing, not the branded artwork.
const art=document.createElement('canvas');art.width=1200;art.height=620;const c=art.getContext('2d');
const grad=c.createLinearGradient(0,0,0,620);grad.addColorStop(0,'#91e4ee');grad.addColorStop(.55,'#29b8d4');grad.addColorStop(1,'#067ab5');c.fillStyle=grad;c.fillRect(0,0,1200,620);
c.fillStyle='#ffffff24';for(let i=0;i<7;i++){c.beginPath();c.moveTo(i*220-200,0);c.lineTo(i*220-50,0);c.lineTo(i*220+200,620);c.lineTo(i*220+110,620);c.fill()}
c.fillStyle='#f4d88d';c.beginPath();c.moveTo(0,545);c.bezierCurveTo(350,470,720,625,1200,515);c.lineTo(1200,620);c.lineTo(0,620);c.fill();
for(let i=0;i<17;i++){const x=20+i*73;c.strokeStyle=i%2?'#287f60':'#58a65d';c.lineWidth=9+i%4;c.lineCap='round';c.beginPath();c.moveTo(x,570);c.bezierCurveTo(x-35,520,x+30,490,x-8,445-i%3*28);c.stroke()}
function fish(x,y,size,color,flip=1){c.save();c.translate(x,y);c.scale(flip,1);c.fillStyle=color;c.beginPath();c.ellipse(0,0,size,size*.58,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-size*.8,0);c.lineTo(-size*1.55,-size*.5);c.lineTo(-size*1.55,size*.5);c.closePath();c.fill();c.fillStyle='#fff4d4';c.beginPath();c.ellipse(size*.45,-size*.12,size*.19,size*.22,0,0,Math.PI*2);c.fill();c.fillStyle='#173c4d';c.beginPath();c.arc(size*.51,-size*.10,size*.09,0,Math.PI*2);c.fill();c.restore()}
fish(210,195,70,'#ffd550');fish(960,325,95,'#ff866e',-1);fish(750,110,34,'#fff0a0',-1);fish(850,140,25,'#fff0a0',-1);
c.strokeStyle='#d6ffffaa';c.lineWidth=3;for(let i=0;i<18;i++){c.beginPath();c.arc((i*193)%1170,40+(i*83)%470,5+i%4*4,0,Math.PI*2);c.stroke()}
c.fillStyle='#fff8d9';c.font='bold 30px sans-serif';c.fillText('OCEAN WORLD',460,62);
const texture=new T.CanvasTexture(art);texture.colorSpace=T.SRGBColorSpace;
mesh(new T.ShapeGeometry(rounded(5.38,2.72,.29)),new T.MeshStandardMaterial({map:texture,roughness:.65}),tank,[0,1.39,-.20]);
// ShapeGeometry UVs are local coordinates; normalize for the printed backing.
const backing=tank.children[0];const uv=backing.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+2.69)/5.38,(uv.getY(i)+1.36)/2.72);uv.needsUpdate=true;
mesh(new T.ShapeGeometry(rounded(5.40,2.74,.30)),clear,tank,[0,1.39,.35]);
for(const x of[-2.68,2.68])mesh(new T.BoxGeometry(.03,2.23,.69),clear,tank,[x,1.39,0]);
const waterMat=new T.MeshPhysicalMaterial({color:0xc4eaf2,transparent:true,opacity:.19,roughness:.08,depthWrite:false,side:T.DoubleSide});const surface=mesh(new T.PlaneGeometry(4.95,.65),waterMat,tank,[0,2.66,0]);surface.rotation.x=-Math.PI/2;
const seamMat=new T.MeshBasicMaterial({color:0xf4fffa,transparent:true,opacity:.5});mesh(new T.BoxGeometry(4.95,.012,.012),seamMat,tank,[0,2.66,.34]);
const pegMat=new T.MeshStandardMaterial({color:0xf4e68c,roughness:.29});
for(const x of PEGS){mesh(new T.CylinderGeometry(.023,.04,TIP-.9,20),pegMat,tank,[x,(TIP+.9)/2,0]);mesh(new T.CylinderGeometry(.17,.19,.065,24),pegMat,tank,[x,.92,0]);mesh(new T.BoxGeometry(.065,.065,.36),pegMat,tank,[x,.90,-.18]);mesh(new T.SphereGeometry(.023,12,8),pegMat,tank,[x,TIP,0])}
const plungers=[-2.19,2.19].map(x=>{cylinder(.44,.12,redDark,[x,.49,.47]);cylinder(.37,.08,cream,[x,.49,.56]);return cylinder(.31,.19,cream,[x,.49,.65])});
for(const x of[-1.95,1.95])mesh(new T.CylinderGeometry(.09,.065,.09,24),cream,tank,[x,.07,0]);
const label=document.createElement('canvas');label.width=512;label.height=80;const lc=label.getContext('2d');lc.fillStyle='#946c0b';lc.textAlign='center';lc.font='bold 26px sans-serif';lc.fillText('WATER GAME',256,36);lc.font='15px sans-serif';lc.fillText('水 中 套 圈',256,64);const lt=new T.CanvasTexture(label);lt.colorSpace=T.SRGBColorSpace;mesh(new T.PlaneGeometry(1.7,.27),new T.MeshBasicMaterial({map:lt,transparent:true}),toy,[0,.49,.424]);
const colors=[0xd8392d,0xf2cb27,0x1463a9,0x29954c];const ringGeo=new T.TorusGeometry(RING_RADIUS,RING_TUBE,12,40);const ringMeshes=Array.from({length:TOTAL},(_,i)=>mesh(ringGeo,new T.MeshPhysicalMaterial({color:colors[i%4],roughness:.26,clearcoat:.45,clearcoatRoughness:.17}),tank));
// Small fixed bubbles adhere to the inner wall; pump bubbles are transient.
const bubbleMat=new T.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.03,transparent:true,opacity:.28,depthWrite:false});const bubbleGeo=new T.SphereGeometry(1,12,8);for(let i=0;i<22;i++){const b=mesh(bubbleGeo,bubbleMat,tank,[Math.sin(i*12.3)*2.42,.3+((i*13)%23)/10,.33]);b.scale.setScalar(.009+(i%3)*.008)}
const bubbles=Array.from({length:32},()=>{const m=mesh(bubbleGeo,bubbleMat,tank);m.visible=false;return{mesh:m,x:0,y:0,z:0,speed:0}});
const floor=mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.13}),scene,[0,-3.1,0]);floor.rotation.x=-Math.PI/2;
let rings=createRings(),held=[false,false],press=[0,0],waterPulse=0,drag=null,angle=-.10,pitch=0,lean=0,scoreCount=-1,accumulator=0;
function fire(side){if(held[side])return;held[side]=true;pump(rings,1,side===0?-1:1);waterPulse=1;for(let i=side*16;i<(side+1)*16;i++){const b=bubbles[i];b.mesh.visible=true;b.x=(side===0?-1.95:1.95)+(Math.random()-.5)*.25;b.y=.12+Math.random()*.08;b.z=(Math.random()-.5)*.25;b.speed=.5+Math.random()*.7;b.mesh.scale.setScalar(.012+Math.random()*.015)}}
function release(side){held[side]=false}
buttons.forEach((button,side)=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);fire(side)});for(const event of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>release(side));button.addEventListener('click',e=>{if(e.detail===0){fire(side);setTimeout(()=>release(side),120)}})});
addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON')return;const side=e.code==='ArrowLeft'?0:e.code==='ArrowRight'?1:-1;if(side>=0){e.preventDefault();if(!e.repeat)fire(side)}});addEventListener('keyup',e=>{if(e.code==='ArrowLeft')release(0);if(e.code==='ArrowRight')release(1)});addEventListener('blur',()=>{held.fill(false);drag=null});document.getElementById('reset').onclick=()=>{rings=createRings();held.fill(false);waterPulse=0;lean=0;angle=-.10;pitch=0;for(const b of bubbles)b.mesh.visible=false};
document.getElementById('view-reset').onclick=()=>{angle=-.10;pitch=0;lean=0};
renderer.domElement.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;angle+=(e.clientX-drag[0])*.008;pitch+=(e.clientY-drag[1])*.008;lean=T.MathUtils.clamp(lean-(e.clientX-drag[0])*.003,-.22,.22);drag=[e.clientX,e.clientY]});for(const type of['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>{drag=null});
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.set(0,2.3,Math.max(14.7,13.3/camera.aspect));camera.lookAt(0,-.02,0);camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);resize();
loop(dt=>{accumulator+=dt;while(accumulator>=1/120){step(rings,1/120,-lean);accumulator-=1/120}if(!drag)lean*=Math.exp(-dt*3);pivot.rotation.set(pitch,angle,lean);plungers.forEach((p,i)=>{press[i]+=(Number(held[i])-press[i])*Math.min(1,dt*20);p.position.z=.65-press[i]*.12});waterPulse*=Math.exp(-dt*2);surface.rotation.z=Math.sin(performance.now()*.004)*waterPulse*.012;
 ringMeshes.forEach((m,i)=>{const r=rings[i];m.position.set(r.x,r.y,r.z);m.rotation.set(r.rx,0,r.rz)});
 for(const b of bubbles)if(b.mesh.visible){b.y+=b.speed*dt;b.x+=Math.sin(b.y*3)*dt*.16;b.mesh.position.set(b.x,b.y,b.z);if(b.y>2.64)b.mesh.visible=false}
 const n=rings.filter(r=>r.caught>=0).length;if(n!==scoreCount){score.textContent=`${n} / ${TOTAL}`;scoreCount=n}
 scene.updateMatrixWorld();plungers.forEach((plunger,i)=>{const button=buttons[i];const p=plunger.getWorldPosition(new T.Vector3());const normal=new T.Vector3(0,0,1).transformDirection(toy.matrixWorld);button.hidden=normal.dot(camera.position.clone().sub(p).normalize())<.25;p.addScaledVector(normal,.12);p.project(camera);button.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;button.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;const size=Math.max(38,host.clientHeight*.055);button.style.width=button.style.height=`${size}px`;});renderer.render(scene,camera)
});
