import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Water } from './vendor/Water.js';
import { Sky } from './vendor/Sky.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector('#sources');
document.querySelector('#info').onclick = () => dialog.showModal();
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch { status.textContent = '无法启动 3D，请启用浏览器硬件加速；模型仍可下载。'; }
if (renderer) start();

async function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb7c8ce, .00047);
  const camera = new THREE.PerspectiveCamera(25, innerWidth / innerHeight, 1, 15000);
  camera.position.set(-100, 4, -750);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 53, 0);
  controls.enableDamping = !reduced.matches;
  controls.dampingFactor = .075;
  controls.minDistance = 65; controls.maxDistance = 1800;
  controls.maxPolarAngle = Math.PI * .51;
  controls.enablePan = false;
  controls.rotateSpeed = .45;
  controls.zoomSpeed = .65;
  const sky = new Sky();
  sky.scale.setScalar(10000);
  Object.assign(sky.material.uniforms.turbidity, { value: 6 });
  sky.material.uniforms.rayleigh.value = .65;
  sky.material.uniforms.mieCoefficient.value = .003;
  sky.material.uniforms.mieDirectionalG.value = .8;
  sky.material.fragmentShader = sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    'texColor = mix(vec3(dot(texColor, vec3(0.2126, 0.7152, 0.0722))), texColor, 0.28); gl_FragColor = vec4(texColor, 1.0);',
  );
  const sunDirection = new THREE.Vector3(-.55, .62, -.56).normalize();
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(sky, .02);
  scene.environment = environment.texture;
  scene.environmentIntensity = .12;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdde8ec, 0x424937, .75));
  const sun = new THREE.DirectionalLight(0xfff5de, 2.3);
  sun.position.copy(sunDirection).multiplyScalar(500);
  sun.target.position.set(0, 65, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 150, bottom: -100, near: 20, far: 900 });
  sun.shadow.bias = -.00012; sun.shadow.normalBias = .08;
  scene.add(sun, sun.target);
  const waterNormals = await new THREE.TextureLoader().loadAsync('./assets/waternormals.jpg').catch(() => null);
  if (!waterNormals) { status.textContent = '水面材质加载失败，请刷新重试。'; return; }
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const water = new Water(new THREE.PlaneGeometry(12000, 12000), {
    textureWidth: innerWidth < 700 ? 512 : 1024, textureHeight: innerWidth < 700 ? 512 : 1024,
    waterNormals, sunDirection, sunColor: 0xfff3d6, waterColor: 0x344440,
    distortionScale: 1.25, fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = .08;
  water.material.uniforms.size.value = 4.5;
  scene.add(water);
  let paused = reduced.matches;
  const motion = document.querySelector('#motion');
  function updateMotion() { motion.textContent = paused ? '继续水面' : '暂停水面'; motion.setAttribute('aria-pressed', String(paused)); }
  motion.onclick = () => { paused = !paused; updateMotion(); };
  reduced.addEventListener('change', e => { paused = e.matches; controls.enableDamping = !e.matches; updateMotion(); });
  updateMotion();
  const views = {
    lake: { position: [-100, 4, -750], target: [0, 43, 0] },
    detail: { position: [-80, 90, -150], target: [0, 75, 0] },
    aerial: { position: [-260, 260, -340], target: [0, 40, 0] },
  };
  let transition = null;
  function setView(name) {
    const preset = views[name];
    const p = new THREE.Vector3(...preset.position), t = new THREE.Vector3(...preset.target);
    if (innerWidth < 600 && name !== 'detail') p.sub(t).multiplyScalar(1.25).add(t);
    p.y = Math.max(4, p.y);
    transition = { start: performance.now(), from: camera.position.clone(), fromTarget: controls.target.clone(), position: p, target: t };
    for (const id of Object.keys(views)) {
      const active = id === name;
      document.getElementById(id).classList.toggle('active', active);
      document.getElementById(id).setAttribute('aria-pressed', String(active));
    }
    document.querySelector('.title').style.visibility = name === 'lake' ? 'visible' : 'hidden';
  }
  for (const id of Object.keys(views)) document.getElementById(id).onclick = () => setView(id);
  controls.addEventListener('start', () => { transition = null; });
  const zoom = factor => {
    transition = null;
    const delta = camera.position.clone().sub(controls.target);
    delta.setLength(THREE.MathUtils.clamp(delta.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(delta); controls.update();
  };
  document.querySelector('#zoom-in').onclick = () => zoom(.82);
  document.querySelector('#zoom-out').onclick = () => zoom(1.22);
  canvas.addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)) return;
    e.preventDefault(); transition = null;
    if (e.key === 'Home') { setView('lake'); return; }
    if (e.key === '+' || e.key === '=') { zoom(.9); return; }
    if (e.key === '-') { zoom(1.1); return; }
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (e.key === 'ArrowLeft') spherical.theta -= .045;
    if (e.key === 'ArrowRight') spherical.theta += .045;
    if (e.key === 'ArrowUp') spherical.phi = Math.max(.1, spherical.phi-.035);
    if (e.key === 'ArrowDown') spherical.phi = Math.min(Math.PI*.51, spherical.phi+.035);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update();
  });
  try {
    const { scene: model } = await new GLTFLoader().loadAsync('./assets/leifeng-realistic.glb');
    // Shared Blender tree meshes become GPU instances: one draw per species/material.
    model.updateMatrixWorld(true);
    const groves = new Map();
    model.traverse(o => {
      if (!o.isMesh || !/^GEO-(Canopy|Trunk)-/.test(o.name)) return;
      const key = o.geometry.uuid + o.material.uuid;
      if (!groves.has(key)) groves.set(key, []);
      groves.get(key).push(o);
    });
    for (const trees of groves.values()) {
      const first = trees[0];
      const instances = new THREE.InstancedMesh(first.geometry, first.material, trees.length);
      instances.name = first.name;
      trees.forEach((tree, i) => {
        instances.setMatrixAt(i, tree.matrixWorld);
        const shade = .76 + (Math.sin(i * 127.1) * .5 + .5) * .24;
        instances.setColorAt(i, new THREE.Color(shade, shade * .98, shade * .88));
        tree.removeFromParent();
      });
      instances.computeBoundingSphere();
      model.add(instances);
    }
    model.traverse(o => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow = !o.name.includes('Survey-terrain');
      if (o.material.name === 'Broadleaf cutout foliage') {
        o.material.alphaTest = .3; o.material.transparent = false;
        o.material.side = THREE.DoubleSide;
        o.material.roughness = .95;
        o.material.envMapIntensity = .35;
        o.material.forceSinglePass = true;
      } else o.material.envMapIntensity = .65;
    });
    scene.add(model);
    status.textContent = '';
    canvas.dataset.ready = 'true';
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  } catch (error) {
    console.error(error); status.textContent = '场景未能加载，请刷新重试。';
  }
  setView('lake');
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!paused) water.material.uniforms.time.value += dt * .45;
    if (transition) {
      const t = reduced.matches ? 1 : Math.min(1, (now - transition.start) / 1500);
      const smooth = t*t*(3-2*t);
      camera.position.lerpVectors(transition.from, transition.position, smooth);
      controls.target.lerpVectors(transition.fromTarget, transition.target, smooth);
      if (t === 1) transition = null;
    }
    controls.update();
    if (camera.position.y < 2) { camera.position.y = 2; camera.lookAt(controls.target); }
    renderer.render(scene, camera);
  });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
}
