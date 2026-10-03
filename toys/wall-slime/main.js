import * as T from '../../src/vendor/three.module.min.js';
import { loop } from '../../src/shared/stage.js';
import { createSlime, grab, release, toss, step, surfacePoint, RADIUS, FLOOR } from './physics.js';

const host = document.querySelector('#stage');
const status = document.querySelector('#status');
const soundButton = document.querySelector('#sound');
const sticky = document.querySelector('#sticky');
const throwButton = document.querySelector('#throw');
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true });
} catch {
  document.querySelector('#error').hidden = false;
  document.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
  document.querySelector('.play-hint').hidden = true;
  throw new Error('WebGL is unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const canvas = renderer.domElement;
canvas.setAttribute('aria-label', '抓住软胶后拖动并松手，甩到墙上。也可以用下方按钮或空格键。');
canvas.setAttribute('role', 'img');
host.prepend(canvas);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  document.querySelector('#error').textContent = '3D 场景暂时中断了，请刷新页面重新玩。';
  document.querySelector('#error').hidden = false;
  throwButton.disabled = true;
});

const scene = new T.Scene();
scene.background = new T.Color('#dce5da');
const camera = new T.OrthographicCamera(-5, 5, 3.8, -3.8, 0.1, 70);
scene.add(new T.HemisphereLight(0xfaffef, 0x71816b, 2.1));
const key = new T.DirectionalLight(0xfff4d9, 3.3);
key.position.set(-4, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -7, near: 0.1, far: 35 });
key.shadow.normalBias = 0.025;
key.shadow.bias = -0.00015;
key.shadow.radius = 4;
scene.add(key);
const fill = new T.DirectionalLight(0xe3f2ff, 0.6);
fill.position.set(5, 2, 5); scene.add(fill);

// The same local softbox environment pattern used by the water-ring toy.
const studio = new T.Scene();
studio.background = new T.Color(0x788176);
for (const [x, y, z, w, h, intensity] of [[-4, 6, 5, 3, 7, 3], [4, 2, 5, 1.2, 5, 1.3], [0, 7, -2, 6, 2, 2]]) {
  const box = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(intensity, intensity, intensity) }));
  box.position.set(x, y, z); box.lookAt(0, 0, 0); studio.add(box);
}
const pmrem = new T.PMREMGenerator(renderer);
const environment = pmrem.fromScene(studio, 0.04);
scene.environment = environment.texture;
pmrem.dispose();
studio.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

function mesh(geometry, material, position, parent = scene) {
  const object = new T.Mesh(geometry, material);
  object.position.set(...position); parent.add(object);
  return object;
}

const grout = new T.MeshStandardMaterial({ color: '#b7c4b3', roughness: 0.85 });
mesh(new T.PlaneGeometry(70, 40), grout, [0, 8, -0.10]).receiveShadow = true;
const tileColors = ['#dce5d6', '#d6e1d0', '#d9e3d4', '#dde5d7', '#d4dfce'];
const tileMaterials = tileColors.map(color => new T.MeshPhysicalMaterial({ color, roughness: 0.31, clearcoat: 0.28, clearcoatRoughness: 0.3 }));
const tileGeometry = new T.BoxGeometry(2.15, 1.28, 0.065);
for (let row = 0; row < 9; row++) for (let col = -10; col < 11; col++) {
  const tile = mesh(tileGeometry, tileMaterials[Math.abs(col * 3 + row * 7) % 5], [col * 2.18, FLOOR + 0.64 + row * 1.31, -0.037]);
  tile.receiveShadow = true;
}
const floor = mesh(new T.PlaneGeometry(70, 70), new T.MeshStandardMaterial({ color: '#c7cebc', roughness: 0.72 }), [0, FLOOR, 16]);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
const baseboard = mesh(new T.BoxGeometry(70, 0.13, 0.14), new T.MeshStandardMaterial({ color: '#b4c3ab', roughness: 0.45 }), [0, FLOOR + 0.065, 0.03]);
baseboard.receiveShadow = true;

// Window occluders only cast shadows; they never cover the play area.
const windowFrame = new T.MeshStandardMaterial({ colorWrite: false, depthWrite: false });
for (let i = 0; i < 4; i++) {
  const slat = mesh(new T.BoxGeometry(0.085, 12, 0.1), windowFrame, [-7.5 + i * 0.9, 5.2, 4]);
  slat.rotation.z = -0.35; slat.castShadow = true;
}

const slimeGeometry = new T.SphereGeometry(1, 64, 48);
const originals = Float32Array.from(slimeGeometry.attributes.position.array);
const jelly = new T.MeshPhysicalMaterial({
  color: '#ed881d', roughness: 0.18, metalness: 0, clearcoat: 1,
  clearcoatRoughness: 0.12, transmission: 0.14, thickness: 0.65, ior: 1.38,
  envMapIntensity: 1.35,
});
const blob = mesh(slimeGeometry, jelly, [0, 0, 0]);
blob.castShadow = true; blob.receiveShadow = true; blob.frustumCulled = false;
const eyeWhite = new T.MeshPhysicalMaterial({ color: '#fff7db', roughness: 0.23, clearcoat: 0.8 });
const eyeBlack = new T.MeshPhysicalMaterial({ color: '#232721', roughness: 0.17, clearcoat: 1 });
const eyeGeometry = new T.SphereGeometry(0.108, 24, 16);
const pupilGeometry = new T.SphereGeometry(1, 20, 14);
const eyes = [-1, 1].map(side => {
  const group = new T.Group(); scene.add(group);
  const white = mesh(eyeGeometry, eyeWhite, [0, 0, 0], group); white.scale.z = 0.64;
  const pupil = mesh(pupilGeometry, eyeBlack, [0, 0, 0.068], group);
  pupil.scale.set(0.042, 0.057, 0.032);
  return { group, pupil, side };
});
const mouth = mesh(new T.TorusGeometry(0.044, 0.011, 8, 24, Math.PI), eyeBlack, [0, 0, 0]);
mouth.rotation.z = Math.PI;

let slime = createSlime();
let pointer = null, samples = [], lastPhase = '', lastWallHits = 0, lastFloorHits = 0;
let muted = true, audio = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const bounds = { x: 4, top: 1.8 };
const raycaster = new T.Raycaster(), ndc = new T.Vector2();
const dragPlane = new T.Plane(new T.Vector3(0, 0, 1), -2.2);
const intersection = new T.Vector3();
const mouse = new T.Vector2();

function resize() {
  const w = host.clientWidth, h = host.clientHeight, aspect = w / Math.max(h, 1);
  const half = w < 621 ? 4.5 : 3.8;
  camera.left = -half * aspect; camera.right = half * aspect;
  camera.top = half; camera.bottom = -half;
  const targetY = w < 621 && h < 700 ? -1.25 : -0.72;
  camera.position.set(0, targetY + 2.22, 14); camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  bounds.x = Math.max(0.15, half * aspect - RADIUS * 1.75);
  renderer.setSize(w, h);
}
new ResizeObserver(resize).observe(host); resize();

function ray(event) {
  const box = canvas.getBoundingClientRect();
  ndc.set((event.clientX - box.left) / box.width * 2 - 1, 1 - (event.clientY - box.top) / box.height * 2);
  raycaster.setFromCamera(ndc, camera);
}
function position(event) {
  ray(event); raycaster.ray.intersectPlane(dragPlane, intersection);
  return { x: T.MathUtils.clamp(intersection.x, -bounds.x, bounds.x), y: T.MathUtils.clamp(intersection.y, FLOOR + 0.8, bounds.top) };
}
function track(event) {
  const point = position(event), time = performance.now();
  samples.push({ ...point, time });
  samples = samples.filter(sample => time - sample.time < 130);
  return point;
}
function beginPlay() {
  document.body.classList.add('playing');
  if (audio?.state === 'suspended' && !muted) audio.resume().catch(() => {});
}
function cancelGrab() {
  if (pointer === null) return;
  pointer = null; samples = []; slime.grip = null;
  slime.phase = 'falling'; slime.vx = slime.vy = slime.vz = 0;
  canvas.classList.remove('grabbing');
}
canvas.addEventListener('pointerdown', event => {
  if (pointer !== null || !event.isPrimary || event.button !== 0) return;
  ray(event);
  if (!raycaster.intersectObject(blob).length) return;
  event.preventDefault(); beginPlay(); samples = [];
  const point = track(event); grab(slime, point.x, point.y);
  pointer = event.pointerId; canvas.setPointerCapture(pointer); canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', event => {
  const box = canvas.getBoundingClientRect();
  mouse.set((event.clientX - box.left) / box.width - 0.5, 0.5 - (event.clientY - box.top) / box.height);
  if (event.pointerId !== pointer) return;
  slime.grip = track(event);
});
canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  const point = track(event), first = samples[0], dt = Math.max(0.025, (performance.now() - first.time) / 1000);
  release(slime, (point.x - first.x) / dt, (point.y - first.y) / dt);
  pointer = null; samples = []; canvas.classList.remove('grabbing');
});
for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, cancelGrab);
addEventListener('blur', cancelGrab);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGrab(); });

function demoThrow() {
  if (pointer !== null || throwButton.disabled) return;
  beginPlay(); toss(slime, Math.sin(slime.throws * 2.4) * Math.min(bounds.x, 1.15), 0.8);
}
function reset() {
  cancelGrab(); slime = createSlime(); slime.adhesion = Number(sticky.value) / 100;
  lastWallHits = lastFloorHits = 0; lastPhase = '';
  document.body.classList.remove('playing');
}
throwButton.addEventListener('click', demoThrow);
document.querySelector('#reset').addEventListener('click', reset);
addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select, [contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'KeyR' && !event.repeat) reset();
  if (event.target.closest('button, a')) return;
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) demoThrow(); }
});
sticky.addEventListener('input', () => {
  slime.adhesion = Number(sticky.value) / 100;
  document.querySelector('#sticky-value').textContent = slime.adhesion < 0.33 ? '有点滑' : slime.adhesion > 0.75 ? '超级黏' : '刚刚好';
});
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
  jelly.color.set(button.dataset.color);
  document.querySelectorAll('.swatch').forEach(other => {
    const selected = other === button;
    other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected));
  });
}));

soundButton.addEventListener('click', async () => {
  muted = !muted;
  try {
    if (!muted) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audio ??= new Audio(); await audio.resume();
    }
  } catch { muted = true; status.textContent = '暂时无法播放音效，仍然可以继续玩。'; }
  soundButton.setAttribute('aria-pressed', String(!muted));
  soundButton.setAttribute('aria-label', muted ? '打开音效' : '关闭音效');
  if (!muted) squelch(0.2);
});
function squelch(power = 1) {
  if (muted || !audio || audio.state !== 'running') return;
  const at = audio.currentTime;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(190, at); osc.frequency.exponentialRampToValueAtTime(43, at + 0.17);
  gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.25 * power, at + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.23);
  osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 0.24);
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.13), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const noise = audio.createBufferSource(), filter = audio.createBiquadFilter(), wet = audio.createGain();
  noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(1600, at); filter.frequency.exponentialRampToValueAtTime(180, at + 0.12);
  wet.gain.value = power * 0.33;
  noise.connect(filter).connect(wet).connect(audio.destination); noise.start(at);
}

const messages = {
  ready: '这次不会被骂。', held: '对，就是这个手感。', flying: '接住——',
  stuck: '啪叽。黏住了。', peeling: '撑不住了……', stretching: '拉——长——了。', falling: '掉啦。', rest: '捡起来，还能接着甩。',
};
loop((dt, time) => {
  if (document.hidden) return;
  step(slime, dt, bounds);
  const visiblePhase = slime.phase === 'peeling' && slime.tether.y - slime.y > 1.3 ? 'stretching' : slime.phase;
  if (visiblePhase !== lastPhase) {
    status.textContent = messages[visiblePhase]; lastPhase = visiblePhase;
    host.dataset.phase = visiblePhase;
  }
  if (slime.wallHits > lastWallHits) { squelch(); lastWallHits = slime.wallHits; }
  if (slime.floorHits > lastFloorHits) { squelch(0.38); lastFloorHits = slime.floorHits; }
  const vertices = slimeGeometry.attributes.position;
  const idleTime = reducedMotion.matches && slime.phase === 'ready' ? 0 : time;
  for (let i = 0; i < vertices.count; i++) {
    const [x, y, z] = surfacePoint(slime, originals[i * 3], originals[i * 3 + 1], originals[i * 3 + 2], idleTime);
    vertices.setXYZ(i, x, y, z);
  }
  vertices.needsUpdate = true;
  slimeGeometry.computeVertexNormals(); slimeGeometry.computeBoundingSphere();
  const blink = !reducedMotion.matches && time % 4.7 > 4.55;
  for (const eye of eyes) {
    const nx = eye.side * 0.30, ny = 0.06, nz = Math.sqrt(1 - nx * nx - ny * ny);
    const p = surfacePoint(slime, nx, ny, nz, idleTime);
    eye.group.position.set(p[0], p[1], p[2] + 0.016);
    const squint = blink ? 0.07 : slime.hit > 0.1 ? 0.24 : 1;
    eye.group.scale.set(1, squint, 1);
    eye.pupil.position.x = mouse.x * 0.026;
    eye.pupil.position.y = slime.phase === 'peeling' ? -0.027 : mouse.y * 0.024;
  }
  const p = surfacePoint(slime, 0, -0.24, Math.sqrt(1 - 0.24 ** 2), idleTime);
  mouth.position.set(p[0], p[1], p[2] + 0.013);
  mouth.scale.set(1, slime.phase === 'peeling' ? 1.7 : 0.6, 1);
  renderer.render(scene, camera);
});
