import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from '../west-lake/vendor/OrbitControls.js';
import { Sky } from '../west-lake/vendor/Sky.js';
import { Water } from '../west-lake/vendor/Water.js';

const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});}
catch {status.textContent='无法启动 3D，请开启浏览器硬件加速后刷新。';document.querySelectorAll('.tools button,#save').forEach(b=>b.disabled=true);}
if(renderer) start().catch(error=>{console.error(error);status.textContent='模型未能载入，请刷新重试。';});

async function start(){
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#d4e1e8',150,700);
 const camera=new THREE.PerspectiveCamera(36,1,.15,5000);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=!reduced.matches;controls.enablePan=false;controls.minDistance=30;controls.maxDistance=280;controls.maxPolarAngle=Math.PI*.61;controls.autoRotateSpeed=.35;
 const sky=new Sky();sky.scale.setScalar(4500);scene.add(sky);
 const uniforms=sky.material.uniforms;uniforms.turbidity.value=3.8;uniforms.rayleigh.value=1.25;uniforms.mieCoefficient.value=.004;uniforms.mieDirectionalG.value=.82;
 const sunDirection=new THREE.Vector3(-.42,.65,.64).normalize();uniforms.sunPosition.value.copy(sunDirection);
 const pmrem=new THREE.PMREMGenerator(renderer);const daylight=pmrem.fromScene(sky,.04);scene.environment=daylight.texture;scene.environmentIntensity=.055;pmrem.dispose();
 const fill=new THREE.HemisphereLight('#d9e9f6','#72796b',.45);scene.add(fill);
 const sun=new THREE.DirectionalLight('#fff4e2',2.7);sun.position.copy(sunDirection).multiplyScalar(150);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-105,right:105,top:95,bottom:-70,near:1,far:350});sun.shadow.bias=-.00013;sun.shadow.normalBias=.035;scene.add(sun);
 const normal=await new THREE.TextureLoader().loadAsync('../west-lake/assets/stone-normal.png');normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(180,180);
 const groundMat=new THREE.MeshStandardMaterial({color:'#b3b2a9',roughness:.91,normalMap:normal,normalScale:new THREE.Vector2(.08,.08)});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.065;ground.receiveShadow=true;scene.add(ground);
 const waterNormals=await new THREE.TextureLoader().loadAsync('../west-lake/assets/waternormals.jpg');waterNormals.wrapS=waterNormals.wrapT=THREE.RepeatWrapping;
 const water=new Water(new THREE.PlaneGeometry(160,13),{textureWidth:512,textureHeight:512,waterNormals,sunDirection,sunColor:0xfff3de,waterColor:0x4c716d,distortionScale:.45,fog:true});water.rotation.x=-Math.PI/2;water.position.set(0,.07,39.5);water.material.uniforms.size.value=3;scene.add(water);
 const inscription=document.createElement('canvas');inscription.width=2048;inscription.height=256;const ink=inscription.getContext('2d');ink.fillStyle='#a32329';ink.fillRect(0,0,2048,256);ink.strokeStyle='#eddfc2';ink.lineWidth=12;ink.strokeRect(8,8,2032,240);ink.fillStyle='#fff6e4';ink.font='600 170px "Songti SC",serif';ink.textAlign='center';ink.textBaseline='middle';ink.fillText('中华人民共和国万岁',1024,135,1910);const leftInscription=new THREE.CanvasTexture(inscription);leftInscription.colorSpace=THREE.SRGBColorSpace;leftInscription.flipY=false;
 const {scene:model}=await new GLTFLoader().loadAsync('./assets/tiananmen-imported.glb');
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const m=o.material;if(m.name.startsWith('Facade left inscription'))m.map=leftInscription;if(m.map)m.map.anisotropy=renderer.capabilities.getMaxAnisotropy();m.envMapIntensity=.6;if(m.transparent||m.opacity<1){m.alphaTest=.45;m.transparent=false;m.side=THREE.DoubleSide;o.castShadow=false;}});scene.add(model);
 const flagCanvas=document.createElement('canvas');flagCanvas.width=600;flagCanvas.height=400;const fc=flagCanvas.getContext('2d');fc.fillStyle='#cf2027';fc.fillRect(0,0,600,400);fc.fillStyle='#ffe166';
 function star(x,y,r,rotation){fc.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+rotation+i*Math.PI/5,s=i%2?r*.382:r;fc.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}fc.closePath();fc.fill();}
 star(100,100,60,0);for(const[x,y]of[[200,40],[240,80],[240,140],[200,180]])star(x,y,20,Math.atan2(100-y,100-x)+Math.PI/2);
 const tex=new THREE.CanvasTexture(flagCanvas);tex.colorSpace=THREE.SRGBColorSpace;
 const redFlagMat=new THREE.MeshStandardMaterial({color:'#b91622',side:THREE.DoubleSide,roughness:.86});
 const flags=[];
 // Keep the source asset intact so the cloth can be restored later.
 model.traverse(o=>{if(o.isMesh&&o.material.name==='Mat3d66-10107180-63-37768')o.visible=false;});
 function flag(x,y,z,w,h,national){const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h,24,14),national?new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.85}):redFlagMat);o.position.set(x+w/2,y-h/2,z);o.castShadow=true;scene.add(o);flags.push({mesh:o,original:o.geometry.attributes.position.array.slice(),width:w});const base=national?0:13.4;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,y-base,12),new THREE.MeshStandardMaterial({color:'#adb3b5',metalness:.78,roughness:.32}));pole.position.set(x,(y+base)/2,z);scene.add(pole);}
 flag(0,30,140,5,3.33,true);
 const nightLamps=[];
 for(const x of[-29,-15,0,15,29]){const light=new THREE.SpotLight('#ffc879',0,65,.55,.7,1.3);light.position.set(x,.25,25);light.target.position.set(x,18,0);scene.add(light,light.target);nightLamps.push(light);}
 let night=false;
 const nightButton=document.querySelector('#night');
 function setNight(value){night=value;document.body.classList.toggle('night',night);sky.visible=!night;scene.background=night?new THREE.Color('#091421'):null;scene.fog.color.set(night?'#091421':'#d4e1e8');fill.intensity=night?.18:.45;sun.intensity=night?.25:2.7;sun.color.set(night?'#b8cce9':'#fff4e2');scene.environmentIntensity=night?.04:.055;nightLamps.forEach(l=>l.intensity=night?850:0);water.material.uniforms.sunColor.value.set(night?'#46566e':'#fff3de');nightButton.textContent=night?'日景':'夜景';nightButton.setAttribute('aria-pressed',String(night));}
 nightButton.onclick=()=>setNight(!night);
 function setView(name){const mobile=innerWidth<=700;const views={plaza:{p:mobile?[22,3,137]:[42,3,112],t:[0,16,0]},detail:{p:[42,10,63],t:[0,23,0]},aerial:{p:[85,72,110],t:[0,10,0]}};const v=views[name];camera.position.set(...v.p);controls.target.set(...v.t);controls.update();}
 document.querySelector('#reset').onclick=()=>setView('plaza');document.querySelector('#detail').onclick=()=>setView('detail');document.querySelector('#aerial').onclick=()=>setView('aerial');
 const orbit=document.querySelector('#orbit');orbit.onclick=()=>{controls.autoRotate=!controls.autoRotate;orbit.setAttribute('aria-pressed',String(controls.autoRotate));orbit.textContent=controls.autoRotate?'停止':'环游';};
 let mobile=innerWidth<=700;function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<=700?52:36;camera.updateProjectionMatrix();if(mobile!==(innerWidth<=700)){mobile=innerWidth<=700;setView('plaza');}}resize();setView('plaza');addEventListener('resize',resize);
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){setView('plaza');return;}const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(e.key==='ArrowLeft')s.theta-=.07;if(e.key==='ArrowRight')s.theta+=.07;if(e.key==='ArrowUp')s.phi=Math.max(.12,s.phi-.06);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI*.61,s.phi+.06);if(e.key==='+')s.radius=Math.max(30,s.radius*.9);if(e.key==='-')s.radius=Math.min(280,s.radius*1.1);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();});
 const bursts=[];const fireButton=document.querySelector('#fireworks');let showStart=-Infinity,nextBurst=0;
 function burst(){const count=180,p=new Float32Array(count*3),v=[],x=(Math.random()-.5)*90,y=42+Math.random()*25,z=-15;for(let i=0;i<count;i++){const a=i*2.399963,b=Math.acos(1-2*(i+.5)/count);v.push(new THREE.Vector3(Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)).multiplyScalar(9+Math.random()*7));p.set([x,y,z],i*3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.PointsMaterial({color:['#ffcd73','#ff7250','#cfdfed'][Math.floor(Math.random()*3)],size:.23,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const points=new THREE.Points(g,m);points.frustumCulled=false;scene.add(points);bursts.push({points,velocities:v,age:0});}
 fireButton.onclick=()=>{if(fireButton.disabled)return;setNight(true);fireButton.disabled=true;showStart=performance.now();nextBurst=0;status.textContent='';};
 document.querySelector('#save').onclick=()=>{renderer.render(scene,camera);canvas.toBlob(blob=>{if(!blob){status.textContent='保存失败，请重试。';return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='天安门-国庆77周年.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已保存';},'image/png');};
 reduced.addEventListener('change',()=>{controls.enableDamping=!reduced.matches;controls.autoRotate=false;orbit.setAttribute('aria-pressed','false');orbit.textContent='环游';});
 status.textContent='';canvas.dataset.ready='true';let last=performance.now();
 renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;
  if(!reduced.matches){water.material.uniforms.time.value+=dt*.35;for(const f of flags){const a=f.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=f.original[i*3],y=f.original[i*3+1],z=f.original[i*3+2];
    const t=(x+f.width/2)/f.width;a.setZ(i,Math.sin(x*2.1-now*.003+y)*.24*t);a.setY(i,y-.07*t*t);
   }a.needsUpdate=true;f.mesh.geometry.computeVertexNormals();}}
  if(now-showStart<4200&&now-showStart>=nextBurst){burst();nextBurst+=reduced.matches?1500:450;}
  if(fireButton.disabled&&now-showStart>6500){fireButton.disabled=false;status.textContent='';}
  for(let b=bursts.length-1;b>=0;b--){const o=bursts[b];o.age+=dt;const p=o.points.geometry.attributes.position;for(let i=0;i<p.count;i++){o.velocities[i].y-=dt*3;p.setXYZ(i,p.getX(i)+o.velocities[i].x*dt,p.getY(i)+o.velocities[i].y*dt,p.getZ(i)+o.velocities[i].z*dt);}p.needsUpdate=true;o.points.material.opacity=Math.max(0,1-o.age/3);if(o.age>3){scene.remove(o.points);o.points.geometry.dispose();o.points.material.dispose();bursts.splice(b,1);}}
  controls.update();if(camera.position.y<1.7){camera.position.y=1.7;camera.lookAt(controls.target);}renderer.render(scene,camera);
 });
}
