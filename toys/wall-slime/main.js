import { createStarGeometry } from './star.js';
import * as T from '../../src/vendor/three.module.min.js';
import { loop } from '../../src/shared/stage.js';
import { createSlime, grab, release, tossTogether, step, resolveToyContacts, deformPoint, bindPoint, bindLimbPoint, TOYS, RADIUS, FLOOR } from './physics.js';

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
canvas.setAttribute('aria-label', '抓住玩具后拖动并松手，甩到墙上。也可以用下方按钮或空格键。');
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

const blob = new T.Group(); scene.add(blob);

const mold = document.createElement('canvas'); mold.width = mold.height = 128;
const ink = mold.getContext('2d');
ink.fillStyle = '#929292'; ink.fillRect(0, 0, 128, 128);
ink.strokeStyle = '#555'; ink.lineWidth = 2;
for (let i = 0; i <= 128; i += 16) {
  ink.beginPath(); ink.moveTo(i, 0); ink.lineTo(i, 128); ink.stroke();
  ink.beginPath(); ink.moveTo(0, i); ink.lineTo(128, i); ink.stroke();
}
const relief = new T.CanvasTexture(mold);
relief.wrapS = relief.wrapT = T.RepeatWrapping;
const blue = new T.MeshStandardMaterial({ color: '#073cb1', roughness: 0.6, bumpMap: relief, bumpScale: 0.004, envMapIntensity: 0.65 });
const red = new T.MeshStandardMaterial({ color: '#b62716', roughness: 0.56 });
const jellyTemplate = new T.MeshPhysicalMaterial({ color: '#c93821', roughness: 0.43, clearcoat: 0.18, transmission: 0.08, thickness: 0.12 });
const rubberTemplate = new T.MeshPhysicalMaterial({ color: '#98bf37', roughness: 0.42, clearcoat: 0.3, transmission: 0.10, thickness: 0.12 });
const eyeWhite = new T.MeshStandardMaterial({ color: '#fff5db', roughness: 0.5 });
const pupil = new T.MeshStandardMaterial({ color: '#20372e', roughness: 0.4 });
const sphere = new T.SphereGeometry(1, 24, 16);
const emboss = new T.MeshStandardMaterial({ color: '#083697', roughness: 0.55 });
const toyColors = { spider: '#c93821', gecko: '#98bf37', star: '#e687a0', frog: '#6bafd0' };
function buildToy(kind) {
  const figure = new T.Group(); blob.add(figure);
  figure.userData.kind = kind;
  const softParts = [];
  const rubber = rubberTemplate.clone(), jelly = jellyTemplate.clone();
function oval(material, position, scale) {
  const part = mesh(sphere, material, position, figure); part.scale.set(...scale);
  part.castShadow = true; part.receiveShadow = true; return part;
}
// Curved, tapered rest meshes are deformed together below.
function limb(points, radii, material = blue) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const geometry = new T.TubeGeometry(curve, 32, 1, 12, false);
  const vertices = geometry.attributes.position;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32, center = curve.getPointAt(t);
    const f = t * (radii.length - 1), k = Math.min(Math.floor(f), radii.length - 2);
    const r = T.MathUtils.lerp(radii[k], radii[k + 1], f - k);
    for (let j = 0; j <= 12; j++) {
      const n = i * 13 + j;
      vertices.setXYZ(n, center.x + (vertices.getX(n) - center.x) * r,
        center.y + (vertices.getY(n) - center.y) * r,
        center.z + (vertices.getZ(n) - center.z) * r * 0.78);
    }
  }
  geometry.computeVertexNormals();
  const part = mesh(geometry, material, [0, 0, 0], figure);
  part.castShadow = true; part.receiveShadow = true;
  return part;
}
  figure.rotation.set(0, 0, kind === 'spider' ? Math.PI : 0);
  rubber.color.set(toyColors[kind]); jelly.color.set(toyColors.spider);
  if (kind === 'spider') {
const torso = mesh(new T.LatheGeometry([
  new T.Vector2(0.075, -0.04), new T.Vector2(0.10, 0.02),
  new T.Vector2(0.095, 0.12), new T.Vector2(0.13, 0.24),
  new T.Vector2(0.145, 0.32), new T.Vector2(0.115, 0.38),
  new T.Vector2(0.045, 0.415), new T.Vector2(0.035, 0.43),
], 32), blue, [0, 0, 0], figure);
torso.userData.boneIndex = 0;
torso.scale.z = 0.5; torso.castShadow = torso.receiveShadow = true;
oval(blue, [0, 0.50, 0], [0.087, 0.117, 0.061]).userData.boneIndex = 0;
const belt = mesh(new T.CylinderGeometry(0.103, 0.098, 0.078, 24), red, [0, 0.025, 0], figure);
belt.userData.boneIndex = 0;
belt.scale.z = 0.58; belt.rotation.z = -0.08; belt.castShadow = true;
for (const side of [-1, 1]) {
  limb([[side * 0.115, 0.34, 0], [side * 0.225, 0.44, 0.005],
    [side * 0.295, 0.56, 0], [side * 0.28, 0.72, -0.015]], [0.057, 0.045, 0.04, 0.032]).userData.limbIndex = side > 0 ? 0 : 1;
  limb([[side * 0.065, -0.015, 0], [side * 0.16, -0.25, 0.012],
    [side * 0.29, -0.49, -0.006], [side * 0.34, -0.72, -0.015]], [0.062, 0.054, 0.046, 0.03]).userData.limbIndex = side > 0 ? 2 : 3;
  oval(jelly, [side * 0.28, 0.72, -0.018], [0.067, 0.066, 0.058]).userData.boneIndex = side > 0 ? 3 : 5;
  oval(jelly, [side * 0.34, -0.72, -0.018], [0.070, 0.067, 0.058]).userData.boneIndex = side > 0 ? 7 : 9;
}
// The cheap blue molding has an embossed mask, not painted cartoon eyes.

for (const side of [-1, 1]) {
  const eye = oval(emboss, [side * 0.035, 0.514, 0.053], [0.022, 0.034, 0.006]);
  eye.rotation.z = -side * 0.4;
  eye.userData.boneIndex = 0;
}

  } else {
    const points = TOYS[kind].rest;
    if (kind === 'star') {
      const star = mesh(createStarGeometry(), rubber, [0,0,0], figure);
      star.castShadow = star.receiveShadow = true;
    } else {
      const core = oval(rubber, [0, -.08, 0], kind === 'frog' ? [.25, .31, .13] : [.16, .38, .08]);
      core.userData.boneIndex = 0;
      oval(rubber, points[2], kind === 'frog' ? [.25,.15,.11] : [.17,.18,.085]).userData.boneIndex = 0;
      if (kind === 'gecko') {
        limb([[0,.03,0],[.08,.36,0],[.20,.68,0],[.06,.88,0]], [.10,.07,.035,.008], rubber).userData.boneIndex = 0;
      }
      for (const [limbIndex,[a,b,c]] of [[1,3,5],[1,4,6],[0,7,9],[0,8,10]].entries()) {
        limb([points[a], points[b], points[c]], kind === 'frog' ? [.11,.08,.045] : [.065,.047,.03], rubber).userData.limbIndex = limbIndex;
        oval(rubber, points[c], [.115,.09,.065]).userData.boneIndex = 3 + limbIndex * 2;
        for (let toe = -1; toe <= 1; toe++) {
          oval(rubber, [points[c][0] + toe * .07, points[c][1] + (c < 7 ? -.07 : .07), .006], [.035,.042,.035]).userData.boneIndex = 3 + limbIndex * 2;
        }
      }
    }
    const faceY = kind === 'star' ? -.04 : points[2][1];
    for (const side of [-1, 1]) {
      const x = side * (kind === 'star' ? .075 : kind === 'frog' ? .14 : .085);
      const eye = oval(eyeWhite, [x, faceY - .025, kind === 'star' ? .132 : .084], [.046,.052,.031]);
      const dot = oval(pupil, [x, faceY - .030, kind === 'star' ? .159 : .111], [.021,.026,.009]);
      eye.userData.boneIndex = dot.userData.boneIndex = 0;
    }
  }
// Bake the rest pose once. No per-frame geometry allocation or detached rigid parts.
blob.updateMatrixWorld(true);
figure.traverse(part => {
  if (!part.isMesh) return;
  const source = part.geometry;
  part.geometry = source.clone().applyMatrix4(part.matrixWorld);
  if (source !== sphere) source.dispose();
  part.position.set(0, 0, 0); part.quaternion.identity(); part.scale.set(1, 1, 1);
  const rest = Float32Array.from(part.geometry.attributes.position.array);
  const bindings = Array.from({ length: rest.length / 3 }, (_, i) => {
    const p = [rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]];
    return part.userData.limbIndex === undefined
      ? bindPoint(...p, part.userData.boneIndex ?? null, kind)
      : bindLimbPoint(...p, part.userData.limbIndex, kind);
  });
  softParts.push({ part, rest, bindings });
  part.frustumCulled = false;
});
figure.rotation.set(0, 0, 0);
return { kind, figure, softParts, material: kind === 'spider' ? jelly : rubber,
  slime: createSlime(kind), lastWallHits: 0, lastFloorHits: 0 };
}
const toys = Object.keys(TOYS).map(buildToy);
let active = toys[0], slime = active.slime;
let pointer = null, samples = [], lastPhase = '';
let muted = true, audio = null;
const bounds = { x: 4, top: 1.8 };
const raycaster = new T.Raycaster(), ndc = new T.Vector2();
const dragPlane = new T.Plane(new T.Vector3(0, 0, 1), -2.2);
const intersection = new T.Vector3();

function home(index) {
  const wide = bounds.x >= 3;
  return wide ? [(index - 1.5) * 1.9, .35] : [(index % 2 ? 1 : -1) * Math.min(.95, bounds.x), index < 2 ? 1.1 : -.85];
}
function freshSlime(kind, index, adhesion = TOYS[kind].adhesion) {
  const [x,y] = home(index);
  const state = createSlime(kind, [x,y,.22]);
  state.adhesion = adhesion;
  return state;
}
function selectToy(toy) {
  active = toy; slime = toy.slime; lastPhase = slime.phase;
  sticky.value = Math.round(slime.adhesion * 100);
  sticky.setAttribute('aria-label', `${TOYS[toy.kind].name}的黏糊度`);
  document.querySelector('#sticky-value').textContent = `${sticky.value}%`;
  document.querySelectorAll('[data-toy]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.toy === toy.kind)));
  document.querySelectorAll('.swatch').forEach(button => {
    const selected = button.dataset.color === `#${toy.material.color.getHexString()}`;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
}
function resize() {
  const w = host.clientWidth, h = host.clientHeight, aspect = w / Math.max(h, 1);
  const half = w < 621 ? 5 : 4.6;
  camera.left = -half * aspect; camera.right = half * aspect;
  camera.top = half; camera.bottom = -half;
  const targetY = w < 621 && h < 700 ? -0.55 : -0.2;
  camera.position.set(0, targetY + 2.22, 14); camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  bounds.x = Math.max(0.15, half * aspect - RADIUS * 0.9);
  bounds.top = half + targetY - RADIUS - 0.5;
  renderer.setSize(w, h);
  toys.forEach((toy, i) => {
    if (toy.slime.phase === 'ready') toy.slime = freshSlime(toy.kind, i, toy.slime.adhesion);
  });
  slime = active.slime;
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
  const hit = raycaster.intersectObject(blob, true)[0];
  if (!hit) return;
  let figure = hit.object;
  while (!figure.userData.kind) figure = figure.parent;
  selectToy(toys.find(toy => toy.kind === figure.userData.kind));
  event.preventDefault(); beginPlay(); samples = [];
  const point = track(event); grab(slime, point.x, point.y);
  pointer = event.pointerId; canvas.setPointerCapture(pointer); canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', event => {
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
  beginPlay();
  tossTogether(toys.map(toy => toy.slime), bounds);
}
function reset() {
  cancelGrab();
  toys.forEach((toy, i) => {
    toy.slime = freshSlime(toy.kind, i, toy.slime.adhesion); toy.lastWallHits = toy.lastFloorHits = 0;
  });
  slime = active.slime; lastPhase = '';
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
  document.querySelector('#sticky-value').textContent = `${sticky.value}%`;
});
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
  active.material.color.set(button.dataset.color);
  document.querySelectorAll('.swatch').forEach(other => {
    const selected = other === button;
    other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected));
  });
}));

document.querySelectorAll('[data-toy]').forEach(button => button.addEventListener('click', () => {
  if (pointer !== null) return;
  selectToy(toys.find(toy => toy.kind === button.dataset.toy));
  status.textContent = `选中了${TOYS[active.kind].name}，可以调黏糊度，也可以换颜色。`;
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
  stuck: '啪叽。黏住了。', peeling: '松开了……翻个跟头。',  falling: '掉啦。', rest: '捡起来，还能接着甩。',
};
loop(dt => {
  if (document.hidden) return;
  const substeps = Math.ceil(dt * 120);
  for (let i = 0; i < substeps; i++) {
    for (const toy of toys) step(toy.slime, dt / substeps, bounds);
    resolveToyContacts(toys.map(toy => toy.slime));
  }
  for (const toy of toys) {
    const { slime, softParts } = toy;
    const visiblePhase = slime.phase;
    if (toy === active && visiblePhase !== lastPhase) {
      status.textContent = messages[visiblePhase]; lastPhase = visiblePhase;
      host.dataset.phase = visiblePhase;
    }
    if (slime.wallHits > toy.lastWallHits) { squelch(); toy.lastWallHits = slime.wallHits; }
    if (slime.floorHits > toy.lastFloorHits) { squelch(0.38); toy.lastFloorHits = slime.floorHits; }
    for (const { part, rest, bindings } of softParts) {
      const positions = part.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const p = deformPoint(slime, rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], bindings[i]);
        positions.setXYZ(i, ...p);
      }
      positions.needsUpdate = true;
      part.geometry.computeVertexNormals();
      part.geometry.computeBoundingSphere();
    }
  }
  renderer.render(scene, camera);
});
