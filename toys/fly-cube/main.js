import * as T from '../../src/vendor/three.module.min.js'
import { loop } from '../../src/shared/stage.js'
import { DIRECTIONS, response } from './motion.js'

const $ = id => document.getElementById(id)
const host = $('stage'), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let renderer
try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }) }
catch { $('error').hidden = false; $('error').textContent = '无法启动 3D 场景，请使用支持 WebGL 的浏览器。'; throw new Error('WebGL unavailable') }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = T.PCFSoftShadowMap
renderer.toneMapping = T.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
host.append(renderer.domElement)
renderer.domElement.setAttribute('aria-label', '地动仪，可用方向键旋转视角，加减号缩放')
renderer.domElement.tabIndex = 0
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; $('error').hidden = false; $('error').textContent = '3D 显示连接中断，请刷新页面重试。' })
const scene = new T.Scene(), camera = new T.PerspectiveCamera(37, 1, .1, 80)
scene.fog = new T.FogExp2(0x151512, .035)
scene.add(new T.HemisphereLight(0xf7ead0, 0x20231b, 2.1))
const key = new T.DirectionalLight(0xfff5dc, 4)
key.position.set(-3, 8, 5); key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 25 })
key.shadow.normalBias = .025
scene.add(key)
const rim = new T.DirectionalLight(0xe5c387, 2.4); rim.position.set(3, 3, -5); scene.add(rim)
const fill = new T.DirectionalLight(0xc1d9ff, .8); fill.position.set(5, 0, 4); scene.add(fill)
const material = (color, roughness = .5, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness })
function mesh(geo, mat, parent, position = [0, 0, 0]) {
  const obj = new T.Mesh(geo, mat); obj.position.set(...position); obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj
}
const bronze = material(0x796347, .52, .82), trim = material(0xa58b61, .43, .83), patina = material(0x485448, .76, .55), shadow = material(0x28251d, .82), gold = material(0xc5a66c, .29, .88)
// Subtle casting grain; a deterministic procedural surface, not a historical texture scan.
const grainData = new Uint8Array(256 * 256 * 4)
let grainSeed = 73
for (let i = 0; i < 256 * 256; i++) {
 grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0
 const v = 110 + (grainSeed >>> 26)
 grainData.set([v, v, v, 255], i * 4)
}
const grain = new T.DataTexture(grainData, 256, 256); grain.wrapS = grain.wrapT = T.RepeatWrapping; grain.repeat.set(4, 4); grain.needsUpdate = true
for (const m of [bronze, trim, patina]) { m.bumpMap = grain; m.bumpScale = .0025 }
const studio = new T.Scene(); studio.background = new T.Color(0x35352f)
for (const [p, scale, power] of [[[0,7,0],[7,1,6],3], [[-6,3,4],[1,6,4],4], [[5,2,-5],[2,5,3],2]]) {
 const panel = new T.Mesh(new T.BoxGeometry(...scale), new T.MeshBasicMaterial({color: new T.Color(power,power*.94,power*.82)}));panel.position.set(...p);studio.add(panel)
}
const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(studio, .12)
scene.environment = environment.texture; scene.environmentIntensity = .75
pmrem.dispose(); studio.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})

const sphere = new T.SphereGeometry(1, 32, 24)
const earth = new T.Group(); scene.add(earth); earth.position.y = -2.25
function ellipsoid(parent, mat, p, scale) { const o = mesh(sphere, mat, parent, p); o.scale.set(...scale); return o }
function tube(parent, points, radius, mat) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 24, radius, 7, false), mat, parent) }
function band(parent, r, y, thick, mat) { const o = mesh(new T.TorusGeometry(r, thick, 10, 96), mat, parent, [0, y, 0]); o.rotation.x = Math.PI / 2; return o }
function tapered(parent, points, radii, mat, segments = 32) {
 const curve = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)))
 const geo = new T.TubeGeometry(curve, segments, 1, 10, false), attr = geo.attributes.position
 for(let i=0;i<=segments;i++) {
  const u=i/segments, center=curve.getPointAt(u), f=u*(radii.length-1), k=Math.min(radii.length-2,Math.floor(f)), r=T.MathUtils.lerp(radii[k],radii[k+1],f-k)
  for(let j=0;j<=10;j++){const n=i*11+j;attr.setXYZ(n,center.x+(attr.getX(n)-center.x)*r,center.y+(attr.getY(n)-center.y)*r,center.z+(attr.getZ(n)-center.z)*r)}
 }
 geo.computeVertexNormals();return mesh(geo,mat,parent)
}
function lathe(parent, profile, mat) {
 const curve = new T.SplineCurve(profile.map(p=>new T.Vector2(...p)))
 return mesh(new T.LatheGeometry(curve.getPoints(96),128),mat,parent)
}
const floor = mesh(new T.PlaneGeometry(160, 160), material(0x1d1e19,.9), scene, [0,-2.54,0]); floor.rotation.x=-Math.PI/2
mesh(new T.CylinderGeometry(3.8,3.92,.25,96),material(0x33352b,.9),earth,[0,-.13,0])
band(earth,3.66,.008,.016,trim); band(earth,3.51,.012,.009,trim)
const housing = new T.Group(); earth.add(housing)
// Silhouette follows the familiar twentieth-century urn-shaped reconstructions.
const vessel = lathe(housing, [[1.08,.08],[1.17,.13],[1.17,.23],[1.04,.29],[1.02,.44],[1.20,.59],[1.43,.98],[1.66,1.52],[1.78,2.12],[1.77,2.66],[1.64,3.16],[1.45,3.38]], bronze)
for(const [r,y,t] of [[1.17,.13,.035],[1.12,.25,.025],[1.05,.43,.024],[1.24,.65,.024],[1.47,1.07,.014],[1.68,1.62,.012],[1.76,2.73,.026],[1.65,3.14,.022],[1.45,3.38,.039]]) band(housing,r,y,t,trim)
lathe(housing,[[1.45,3.39],[1.49,3.43],[1.39,3.56],[1.16,3.77],[.84,3.9],[.47,3.96],[.05,3.98],[0,3.98]],bronze)
band(housing,.49,3.965,.024,trim)
// Three lifting rings on the lid, rather than a teapot-like knob.
for(let i=0;i<3;i++){
 const a=i*Math.PI*2/3, ring=mesh(new T.TorusGeometry(.13,.036,12,40),trim,housing,[Math.sin(a)*.62,4.03,Math.cos(a)*.62]);ring.rotation.y=a
}
// Restrained engraved bands and vertical casting seams.
for(let i=0;i<64;i++){
 const a=i*Math.PI/32, r=1.32
 const points=[[a-.033,.78],[a-.033,.87],[a+.033,.87],[a+.033,.80],[a,.80]].map(([q,y])=>[Math.sin(q)*r,y,Math.cos(q)*r])
 tube(housing,points,.009,trim)
}
for(let i=0;i<8;i++){
 const a=(i+.5)*Math.PI/4
 tube(housing,[[1.45,1.05],[1.67,1.6],[1.79,2.15],[1.77,2.67],[1.63,3.16]].map(([r,y])=>[Math.sin(a)*r,y,Math.cos(a)*r]),.014,trim)
}
const jaws=[], balls=[], levers=[], dragons=[], labels=[]
for(let i=0;i<8;i++) {
 const a=i*Math.PI/4, dx=Math.sin(a), dz=-Math.cos(a)
 const dragon=new T.Group();dragon.rotation.y=Math.PI-a;earth.add(dragon);dragons.push(dragon)
 // Long cast dragon body rises along the vessel, with an upturned tapered tail.
 tapered(dragon,[[0,2.3,1.80],[.06,2.58,1.90],[-.05,2.93,1.78],[.04,3.26,1.66],[.11,3.55,1.73],[.08,3.83,1.80],[-.04,3.99,1.74]],[.19,.17,.135,.10,.065,.026,.004],bronze,48)
 for(let row=0;row<15;row++){
  const y=2.50+row*.078, z=1.93-Math.max(0,y-2.65)*.34
  for(const side of [-1,1]) tube(dragon,[[side*.035,y+.035,z+.105],[side*.09,y,z+.12],[side*.14,y+.033,z+.07]],.012,trim)
 }
 // Angular brows, recessed metallic eyes, elongated muzzle and cheek crests.
 ellipsoid(dragon,bronze,[0,2.39,1.98],[.235,.235,.31])
 ellipsoid(dragon,bronze,[0,2.31,2.24],[.205,.13,.29])
 ellipsoid(dragon,trim,[0,2.34,2.41],[.20,.10,.12])
 ellipsoid(dragon,shadow,[0,2.19,2.35],[.18,.09,.17])
 const jaw=new T.Group();jaw.position.set(0,2.14,2.06);dragon.add(jaw)
 ellipsoid(jaw,bronze,[0,-.045,.27],[.20,.055,.30]);jaws.push(jaw)
 for(const side of [-1,1]){
  ellipsoid(dragon,shadow,[side*.211,2.47,2.04],[.045,.037,.065]);ellipsoid(dragon,trim,[side*.234,2.47,2.066],[.022,.025,.028])
  tapered(dragon,[[side*.09,2.53,2.17],[side*.22,2.56,2.07],[side*.26,2.52,1.95]],[.037,.051,.007],trim)
  tapered(dragon,[[side*.16,2.55,1.9],[side*.23,2.76,1.8],[side*.32,2.88,1.69],[side*.29,2.99,1.63]],[.065,.048,.025,.001],bronze)
  tapered(dragon,[[side*.24,2.78,1.8],[side*.38,2.87,1.88]],[.032,.001],trim)
  tapered(dragon,[[side*.16,2.31,2.46],[side*.33,2.28,2.52],[side*.48,2.37,2.41],[side*.47,2.48,2.28]],[.021,.021,.014,.001],trim)
  ellipsoid(dragon,shadow,[side*.09,2.41,2.44],[.032,.023,.03])
  for(let j=0;j<3;j++) tapered(dragon,[[side*.20,2.43-j*.07,1.91],[side*(.34+j*.015),2.45-j*.09,1.79],[side*.28,2.57-j*.09,1.69]],[.052,.035,.001],bronze)
  for(const y of [2.72,3.14]){
   tapered(dragon,[[side*.09,y,1.85],[side*.31,y-.04,1.8],[side*.35,y-.22,1.76],[side*.48,y-.27,1.70]],[.072,.062,.038,.022],bronze)
   for(let toe=0;toe<3;toe++) tapered(dragon,[[side*.42,y-.25,1.73],[side*(.46+toe*.055),y-.34,1.7],[side*(.47+toe*.055),y-.38,1.67]],[.025,.021,.003],trim,12)
  }
  for(let tooth=0;tooth<3;tooth++) tapered(dragon,[[side*.16,2.24,2.22+tooth*.08],[side*.16,2.16,2.24+tooth*.08]],[.018,.001],trim,8)
 }
 const pearl=mesh(new T.SphereGeometry(.125,24,16),gold,earth,[dx*2.48,2.15,dz*2.48]);balls.push(pearl)
 const frog=new T.Group();frog.position.set(dx*2.72,0,dz*2.72);frog.rotation.y=-a;earth.add(frog)
 // Low hindquarters, raised chest, braced forelegs, and a real hollow receiving mouth.
 ellipsoid(frog,bronze,[0,.24,-.06],[.34,.23,.44])
 const chest=ellipsoid(frog,bronze,[0,.40,.16],[.26,.31,.23]);chest.rotation.x=.2
 ellipsoid(frog,bronze,[0,.56,.12],[.29,.20,.22])
 const mouth=mesh(new T.SphereGeometry(.215,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),shadow,frog,[0,.65,.24]);mouth.material.side=T.DoubleSide
 const lip=band(frog,.218,.65,.028,trim);lip.position.z=.24;lip.scale.z=.9
 for(const side of [-1,1]){
  ellipsoid(frog,bronze,[side*.29,.20,-.17],[.19,.17,.28])
  tapered(frog,[[side*.25,.19,-.31],[side*.43,.10,-.04],[side*.31,.065,.16]],[.10,.075,.028],bronze)
  tapered(frog,[[side*.19,.46,.15],[side*.29,.25,.28],[side*.26,.065,.42]],[.072,.055,.031],bronze)
  ellipsoid(frog,bronze,[side*.215,.63,.09],[.088,.080,.09]);ellipsoid(frog,shadow,[side*.235,.67,.142],[.033,.026,.028])
  for(let toe=0;toe<4;toe++) tapered(frog,[[side*.25,.065,.42],[side*(.16+toe*.065),.045,.53],[side*(.15+toe*.071),.05,.59]],[.018,.014,.006],trim,10)
  for(let row=0;row<5;row++)for(let col=0;col<3;col++){
   const x=side*(.07+col*.075),z=-.32+row*.105,y=.25+.21*Math.sqrt(Math.max(0,1-(x/.35)**2-(z/.48)**2))
   ellipsoid(frog,row%3?bronze:patina,[x,y,z],[.021,.016,.025])
  }
 }
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#c6b58e';ctx.font='48px serif';ctx.textAlign='center';ctx.fillText(DIRECTIONS[i],64,76)
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
 const label=mesh(new T.PlaneGeometry(.56,.56),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),earth,[dx*3.27,.025,dz*3.27]);label.rotation.x=-Math.PI/2;label.castShadow=false;labels.push(label)
}
const mechanism=new T.Group();earth.add(mechanism)
mesh(new T.CylinderGeometry(.08,.08,2.65,12),trim,mechanism,[0,1.56,0])
const pendulum=new T.Group();pendulum.position.y=2.98;mechanism.add(pendulum)
mesh(new T.CylinderGeometry(.035,.035,1.75,12),gold,pendulum,[0,-.9,0]);ellipsoid(pendulum,gold,[0,-1.85,0],[.27,.34,.27])
mesh(new T.CylinderGeometry(.45,.6,.15,32),patina,mechanism,[0,.35,0])
for(let i=0;i<8;i++) {
 const a=i*Math.PI/4, lever=new T.Group();lever.rotation.y=Math.PI-a;mechanism.add(lever)
 mesh(new T.BoxGeometry(.08,.08,1.67),trim,lever,[0,1.0,.92]);tube(lever,[[0,1,1.65],[0,1.65,1.7],[0,2.08,2.12]],.035,gold);levers.push(lever)
}
housing.traverse(o=>{if(o.isMesh)o.material=o.material.clone()})
mechanism.visible=false
const wave=mesh(new T.RingGeometry(.98,1,96),new T.MeshBasicMaterial({color:0xe2bd72,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),scene,[0,-2.52,0]);wave.rotation.x=-Math.PI/2;wave.castShadow=false
let azimuth = .64, elevation = .32, distance = 16.4, drag = null
function cameraUpdate() {
  const d = Math.max(distance, 4.3 / Math.tan(camera.fov * Math.PI / 360) / camera.aspect)
  camera.position.set(d * Math.sin(azimuth) * Math.cos(elevation), d * Math.sin(elevation), d * Math.cos(azimuth) * Math.cos(elevation))
  camera.lookAt(0, -.15, 0)
}
function resetView() { azimuth = .64; elevation = .32; distance = 16.4; cameraUpdate() }
$('view').onclick = resetView
new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); cameraUpdate() }).observe(host)
renderer.domElement.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId) })
renderer.domElement.addEventListener('pointermove', e => { if (!drag) return; azimuth -= (e.clientX - drag[0]) * .007; elevation = T.MathUtils.clamp(elevation + (e.clientY - drag[1]) * .006, -.35, 1.3); drag = [e.clientX, e.clientY]; cameraUpdate() })
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) renderer.domElement.addEventListener(type, () => { drag = null })
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); distance = T.MathUtils.clamp(distance + e.deltaY * .008, 12, 26); cameraUpdate() }, { passive: false })
renderer.domElement.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return
  e.preventDefault()
  if (e.key === 'ArrowLeft') azimuth -= .12
  if (e.key === 'ArrowRight') azimuth += .12
  if (e.key === 'ArrowUp') elevation += .1
  if (e.key === 'ArrowDown') elevation -= .1
  if (e.key === '+' || e.key === '=') distance -= .5
  if (e.key === '-') distance += .5
  elevation = T.MathUtils.clamp(elevation, -.35, 1.3); distance = T.MathUtils.clamp(distance, 12, 26); cameraUpdate()
})
let selected=3, running=false, event=null, slow=false
function select(direction) {
 selected=direction
 azimuth=Math.PI-direction*Math.PI/4+.22;cameraUpdate()
 labels.forEach((l,i)=>l.material.color.set(i===direction?0xffd78c:0xffffff))
}
$('direction').onchange=()=>select(Number($('direction').value))
$('pause').onclick=()=>{slow=!slow;$('pause').setAttribute('aria-pressed',String(slow))}
$('cutaway').onchange=()=>{
 const open=$('cutaway').checked
 housing.traverse(o=>{if(o.isMesh){o.material.transparent=open;o.material.opacity=open?.12:1;o.material.depthWrite=!open;o.castShadow=!open;o.material.needsUpdate=true}})
 mechanism.visible=open
}
function reset() {
 running=false;event=null;earth.position.set(0,-2.25,0);pendulum.rotation.set(0,0,0);wave.material.opacity=0
 balls.forEach((b,i)=>{const a=i*Math.PI/4;b.position.set(Math.sin(a)*2.48,2.15,-Math.cos(a)*2.48)})
 jaws.forEach(j=>j.rotation.x=0);levers.forEach(l=>l.rotation.x=0)
}
$('strike').onclick=()=>{
 if(running)return
 reset()
 event={direction:selected,strength:.6,time:0};running=true
 $('strike').disabled=true;$('direction').disabled=true
 $('status').textContent=`${DIRECTIONS[selected]}方来震`
}
select(3);reset()
loop(dt=>{
 if(running&&event){
  event.time+=dt*(slow?.35:1)
  const r=response(event.direction,event.strength,event.time),d=event.direction,t=event.time
  const shake=reducedMotion?0:r.shake*.10
  earth.position.x=r.x*shake;earth.position.z=r.z*shake
  pendulum.rotation.z=-r.x*r.shake*.5;pendulum.rotation.x=r.z*r.shake*.5
  if(r.triggered&&t>1.2){jaws[d].rotation.x=Math.min(1,(t-1.2)*5)*.38;levers[d].rotation.x=Math.min(1,(t-1.2)*5)*.10}
  balls[d].position.y=2.15-r.fall*1.52
  wave.scale.setScalar(1+t*1.8);wave.material.opacity=Math.max(0,.45-t*.14)
  if(r.finished){
   running=false;earth.position.set(0,-2.25,0);pendulum.rotation.set(0,0,0);wave.material.opacity=0
   $('status').textContent=`${DIRECTIONS[d]}方 · 铜珠落入蟾口`
   $('strike').textContent='再震一次';$('strike').disabled=false;$('direction').disabled=false
  }
 }
 renderer.render(scene,camera)
})
