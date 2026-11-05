import * as T from '../../src/vendor/three.module.min.js';

export function show() {
  const canvas = document.querySelector('canvas');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
  } catch {
    document.querySelector('#error').textContent = '需要开启浏览器 WebGL 硬件加速。';
    document.querySelector('nav').hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new T.Scene();
  scene.background = new T.Color(0x010603);
  const camera = new T.PerspectiveCamera(54, 1, 0.08, 70);
  const atlas = document.createElement('canvas');
  atlas.width = 512;
  atlas.height = 128;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff';
  ctx.font = '25px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>+=:.*';
  for (let i = 0; i < 64; i++) ctx.fillText(letters[i % letters.length], (i % 16) * 32 + 16, Math.floor(i / 16) * 32 + 16);
  const texture = new T.CanvasTexture(atlas);
  texture.minFilter = T.LinearFilter;
  texture.magFilter = T.LinearFilter;
  const shared = {
    clock: { value: 0 }, reveal: { value: 0 }, glyphs: { value: texture },
  };
  // World-space glyph coordinates keep characters attached while the camera moves.
  const vertexShader = `
    varying vec3 worldPos;
    varying vec3 worldNormal;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      worldPos = world.xyz;
      vec3 viewNormal = normalize(normalMatrix * normal);
      worldNormal = vec3(dot(viewMatrix[0].xyz, viewNormal), dot(viewMatrix[1].xyz, viewNormal), dot(viewMatrix[2].xyz, viewNormal));
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;
  const fragmentShader = `
    uniform float clock;
    uniform float reveal;
    uniform vec3 base;
    uniform float signal;
    uniform sampler2D glyphs;
    varying vec3 worldPos;
    varying vec3 worldNormal;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 n = normalize(worldNormal);
      vec3 axis = abs(n);
      vec2 plane = worldPos.xy;
      if (axis.x > axis.y && axis.x > axis.z) plane = worldPos.zy;
      if (axis.y > axis.x && axis.y > axis.z) plane = worldPos.xz;
      vec2 grid = plane * vec2(19.0, 15.0);
      vec2 cell = floor(grid);
      float column = hash(vec2(cell.x, 4.0));
      float digit = floor(hash(cell + floor(clock * 3.0) * 0.13) * 64.0);
      vec2 tile = vec2(mod(digit, 16.0), floor(digit / 16.0));
      vec2 local = fract(grid);
      float ink = texture2D(glyphs, (tile + vec2(local.x, 1.0-local.y)) / vec2(16.0, 4.0)).r;
      float trail = fract(plane.y * 0.16 + clock * (0.15 + column * 0.13) + column);
      float head = smoothstep(0.92, 0.99, trail);
      float strength = 0.17 + 0.75 * pow(trail, 4.0) + head * 0.8;
      float facing = 0.45 + 0.55 * abs(dot(n, normalize(cameraPosition-worldPos)));
      vec3 code = vec3(0.015, 0.7, 0.16) * ink * strength * facing;
      code += vec3(0.45, 1.0, 0.65) * ink * head * 0.4;
      code *= signal;
      code += vec3(0.002, 0.018, 0.006) * signal;
      float rim = pow(1.0 - abs(dot(n, normalize(cameraPosition-worldPos))), 3.0);
      code += vec3(0.01, 0.1, 0.025) * rim * max(signal-1.0, 0.0);
      float ceilingLight = 0.24 + 0.55 * max(dot(n, normalize(vec3(-0.4, 0.9, 0.5))), 0.0);
      float pools = 0.65 + 0.35 * pow(0.5 + 0.5 * cos(worldPos.z * 1.57), 4.0);
      vec3 reality = base * ceilingLight * pools;
      float distanceAlong = 6.0 - worldPos.z;
      float wave = reveal * 52.0;
      float amount = smoothstep(distanceAlong - 2.0, distanceAlong + 2.0, wave);
      float edge = exp(-pow((distanceAlong-wave) * 1.4, 2.0)) * step(0.01, reveal) * step(reveal, 0.98);
      vec3 color = mix(reality, code, amount) + vec3(0.03, 0.2, 0.07) * edge;
      float fog = exp(-length(cameraPosition-worldPos) * 0.024);
      gl_FragColor = vec4(color * fog, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  function material(color, signal = 0.7) {
    return new T.ShaderMaterial({ uniforms: { ...shared, base: { value: new T.Color(color) }, signal: { value: signal } }, vertexShader, fragmentShader });
  }
  const wall = material(0x617366), trim = material(0x34463b);
  const floor = material(0x344038), suit = material(0x171c19, 2.4);
  const skin = material(0xa19b80, 2.8), shirt = material(0xb5bca5), dark = material(0x050a07);
  const cube = new T.BoxGeometry(1, 1, 1);
  const sphere = new T.SphereGeometry(1, 24, 20);
  function part(geometry, mat, position, scale, parent = scene) {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }
  function box(mat, x, y, z, w, h, d, parent = scene) {
    return part(cube, mat, [x, y, z], [w, h, d], parent);
  }
  box(floor, 0, -0.11, -13, 6.5, 0.2, 42);
  box(wall, 0, 3.65, -13, 6.5, 0.2, 42);
  box(wall, -3.2, 1.8, -13, 0.2, 3.6, 42);
  box(wall, 3.2, 1.8, -13, 0.2, 3.6, 42);
  box(wall, 0, 1.8, -33, 6.5, 3.6, 0.2);
  for (const side of [-1, 1]) {
    box(trim, side * 3.05, 0.14, -13, 0.1, 0.28, 42);
    box(trim, side * 3.05, 3.35, -13, 0.14, 0.14, 42);
    box(trim, side * 3.05, 1.05, -13, 0.06, 0.08, 42);
    for (let z = 1; z > -32; z -= 4) {
      box(dark, side * 3.06, 1.35, z, 0.05, 2.7, 1.35);
      box(trim, side * 3.0, 2.74, z, 0.16, 0.12, 1.58);
      for (const offset of [-0.76, 0.76]) box(trim, side * 3, 1.37, z + offset, 0.16, 2.74, 0.12);
      box(wall, side * 3.0, 1.35, z, 0.08, 2.5, 1.18);
      box(shirt, side * 2.93, 1.15, z + 0.42, 0.08, 0.07, 0.16);
    }
  }
  for (let z = 2; z > -32; z -= 4) {
    box(trim, 0, 3.51, z, 6.3, 0.12, 0.18);
    box(shirt, 0, 3.48, z - 1.8, 0.5, 0.05, 1.6);
    box(trim, 0, 0.005, z, 6.2, 0.006, 0.025);
  }
  for (let x = -2; x <= 2; x++) box(trim, x, 0.006, -13, 0.02, 0.007, 42);

  // Rings follow garment cross-sections in metres, with a 1.86 m adult silhouette.
  function tailored(rings, material, parent, segments = 40) {
    const positions = [], indices = [];
    rings.forEach(([y, width, depth, centerX = 0, centerZ = 0], row) => {
      for (let i = 0; i < segments; i++) {
        const angle = i / segments * Math.PI * 2;
        positions.push(centerX + Math.sin(angle) * width, y, centerZ + Math.cos(angle) * depth);
        if (row > 0) {
          const a = (row - 1) * segments + i, b = (row - 1) * segments + (i + 1) % segments;
          indices.push(a, b, a + segments, b, b + segments, a + segments);
        }
      }
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  }
  function panel(points, material, parent) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.material = material.clone();
    mesh.material.side = T.DoubleSide;
    Object.assign(mesh.material.uniforms, shared);
    parent.add(mesh);
    return mesh;
  }
  function agent(x, z, turn) {
    const body = new T.Group();
    body.position.set(x, 0, z);
    body.rotation.y = turn;
    scene.add(body);
    const cloth = material(0x202521, 2.15);
    const lapel = material(0x2a302a, 2.25);
    const flesh = material(0xb39b85, 2.65);
    const hair = material(0x2b2922, 1.3);
    const mouth = material(0x624c40, 1.8);
    for (const side of [-1, 1]) {
      tailored([
        [0.075, 0.07, 0.075, side * 0.115, 0.005],
        [0.13, 0.074, 0.085, side * 0.115, 0],
        [0.38, 0.075, 0.08, side * 0.12, -0.012],
        [0.49, 0.076, 0.084, side * 0.12, 0.012],
        [0.54, 0.083, 0.09, side * 0.12, 0.01],
        [0.78, 0.095, 0.115, side * 0.105, 0],
        [0.97, 0.1, 0.115, side * 0.1, 0],
      ], cloth, body);
      // Trouser creases and cuffs give the suit a tailored, weighted silhouette.
      panel([[side * 0.115, 0.12, 0.085], [side * 0.108, 0.75, 0.112], [side * 0.12, 0.72, 0.112]], lapel, body);
      part(sphere, dark, [side * 0.115, 0.055, 0.045], [0.078, 0.055, 0.145], body);
      box(dark, side * 0.115, 0.018, 0.045, 0.145, 0.025, 0.24, body);
      tailored([
        [0.82, 0.045, 0.05, side * 0.275, 0.006],
        [0.86, 0.05, 0.06, side * 0.273, 0.003],
        [1.06, 0.06, 0.067, side * 0.274, -0.012],
        [1.13, 0.065, 0.07, side * 0.272, -0.015],
        [1.33, 0.073, 0.085, side * 0.255, -0.008],
        [1.44, 0.075, 0.089, side * 0.225, -0.004],
        [1.49, 0.032, 0.06, side * 0.20, -0.01],
      ], cloth, body);
      tailored([[0.80, 0.043, 0.045, side * 0.275], [0.835, 0.044, 0.048, side * 0.275]], shirt, body);
      part(sphere, flesh, [side * 0.278, 0.757, 0.009], [0.043, 0.064, 0.027], body);
      for (let finger = 0; finger < 4; finger++) {
        const length = [0.048, 0.061, 0.058, 0.043][finger];
        part(sphere, flesh, [side * (0.251 + finger * 0.017), 0.706 - length * 0.35, 0.022], [0.010, length * 0.65, 0.013], body);
      }
      const thumb = part(sphere, flesh, [side * 0.236, 0.75, 0.033], [0.014, 0.036, 0.018], body);
      thumb.rotation.z = side * 0.4;
    }
    tailored([
      [0.84, 0.19, 0.12], [0.88, 0.195, 0.124], [1.0, 0.18, 0.127],
      [1.14, 0.167, 0.115], [1.30, 0.195, 0.131], [1.40, 0.225, 0.129],
      [1.46, 0.236, 0.115], [1.49, 0.207, 0.094], [1.52, 0.083, 0.075],
    ], cloth, body);
    panel([[-0.077, 1.51, 0.078], [0.077, 1.51, 0.078], [0.053, 1.27, 0.134], [0, 1.11, 0.125], [-0.053, 1.27, 0.134]], shirt, body);
    for (const side of [-1, 1]) {
      panel([[side * 0.065, 1.52, 0.079], [side * 0.17, 1.425, 0.107], [side * 0.11, 1.39, 0.136], [side * 0.15, 1.35, 0.142], [0, 1.10, 0.132]], lapel, body);
      panel([[side * 0.061, 1.52, 0.088], [side * 0.078, 1.457, 0.117], [side * 0.03, 1.405, 0.148], [side * 0.012, 1.487, 0.108]], shirt, body);
      box(lapel, side * 0.13, 1.01, 0.114, 0.085, 0.018, 0.009, body);
    }
    panel([[-0.019, 1.475, 0.116], [0.019, 1.475, 0.116], [0.013, 1.437, 0.145], [-0.013, 1.437, 0.145]], dark, body);
    panel([[-0.012, 1.438, 0.147], [0.012, 1.438, 0.147], [0.023, 1.19, 0.143], [0, 1.15, 0.144], [-0.023, 1.19, 0.143]], dark, body);
    for (const y of [1.08, 0.97]) part(sphere, dark, [0.015, y, 0.13], [0.009, 0.009, 0.005], body);
    box(lapel, -0.125, 1.34, 0.125, 0.073, 0.008, 0.009, body);
    tailored([[1.48, 0.058, 0.056], [1.61, 0.056, 0.058]], flesh, body);
    // A narrower adult skull, broad angular jaw, recessed temples and cheekbones.
    const head = tailored([
      [1.585, 0.031, 0.034, 0, 0.032],
      [1.602, 0.057, 0.052, 0, 0.025],
      [1.625, 0.075, 0.062, 0, 0.013],
      [1.65, 0.083, 0.070, 0, 0.008],
      [1.68, 0.08, 0.082, 0, 0],
      [1.71, 0.087, 0.085, 0, -0.006],
      [1.738, 0.083, 0.086, 0, -0.01],
      [1.77, 0.084, 0.087, 0, -0.013],
      [1.80, 0.085, 0.087, 0, -0.015],
      [1.832, 0.071, 0.075, 0, -0.018],
      [1.852, 0.043, 0.049, 0, -0.02],
      [1.86, 0.001, 0.001, 0, -0.02],
    ], flesh, body, 64);
    const vertices = head.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const vx = vertices.getX(i), vy = vertices.getY(i), vz = vertices.getZ(i);
      if (vz > 0.025) {
        const cheek = Math.exp(-(((Math.abs(vx)-0.052)/0.022)**2) - ((vy-1.70)/0.022)**2) * 0.011;
        const socket = Math.exp(-(((Math.abs(vx)-0.041)/0.023)**2) - ((vy-1.737)/0.017)**2) * 0.012;
        vertices.setZ(i, vz + cheek - socket);
      }
    }
    head.geometry.computeVertexNormals();
    part(sphere, flesh, [0, 1.715, 0.085], [0.015, 0.039, 0.023], body);
    part(sphere, flesh, [0, 1.688, 0.101], [0.019, 0.012, 0.02], body);
    for (const side of [-1, 1]) {
      part(sphere, flesh, [side * 0.017, 1.685, 0.088], [0.012, 0.009, 0.012], body);
      part(sphere, mouth, [side * 0.013, 1.68, 0.096], [0.006, 0.003, 0.005], body);
      part(sphere, flesh, [side * 0.087, 1.707, -0.006], [0.018, 0.038, 0.021], body);
      part(sphere, mouth, [side * 0.093, 1.709, 0.009], [0.006, 0.02, 0.006], body);
      panel([[side * 0.01, 1.75, 0.085], [side * 0.077, 1.755, 0.065], [side * 0.069, 1.723, 0.077], [side * 0.014, 1.72, 0.095]], dark, body);
      box(dark, side * 0.08, 1.747, 0.015, 0.008, 0.007, 0.11, body);
    }
    box(dark, 0, 1.742, 0.095, 0.025, 0.006, 0.006, body);
    part(sphere, mouth, [0, 1.656, 0.084], [0.032, 0.003, 0.004], body);
    part(sphere, flesh, [0, 1.649, 0.084], [0.027, 0.006, 0.007], body);
    const scalp = new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    part(scalp, hair, [0, 1.795, -0.02], [0.092, 0.074, 0.098], body);
    for (const side of [-1, 1]) {
      part(sphere, hair, [side * 0.079, 1.768, -0.034], [0.013, 0.045, 0.049], body);
    }
  }
  agent(0, -4.5, 0);
  agent(-1.35, -6.5, 0.16);
  agent(1.35, -7, -0.16);

  document.querySelector('article').classList.add('code-vision');
  const nav = document.querySelector('nav');
  const mode = document.createElement('button');
  mode.textContent = '现实视界';
  mode.className = 'vision-toggle';
  nav.prepend(mode);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, time = reduced.matches ? 6 : 0, last = performance.now();
  let reality = false, held = false, reveal = reduced.matches ? 1 : 0;
  const aim = new T.Vector2(), look = new T.Vector2();
  const pause = document.querySelector('#pause');
  function sync() {
    pause.textContent = paused ? '播放' : '暂停';
    pause.setAttribute('aria-pressed', String(paused));
    mode.textContent = reality ? '代码视界' : '现实视界';
    mode.setAttribute('aria-pressed', String(reality));
  }
  mode.onclick = () => { reality = !reality; sync(); };
  pause.onclick = () => { paused = !paused; sync(); };
  document.querySelector('#replay').onclick = () => {
    time = 0; reveal = 0; reality = false; held = false; paused = false; sync();
  };
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    aim.set((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
  });
  canvas.addEventListener('pointerleave', () => aim.set(0, 0));
  window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target.closest('button,a,input,textarea,select')) return;
    event.preventDefault(); held = true;
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') held = false; });
  window.addEventListener('blur', () => { held = false; aim.set(0, 0); });
  document.addEventListener('visibilitychange', () => { last = performance.now(); held = false; });
  reduced.addEventListener('change', () => { if (reduced.matches) { paused = true; time = 6; reveal = 1; sync(); } });
  new ResizeObserver(() => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }).observe(canvas);
  sync();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!paused) time += dt;
    const target = reality || held ? 0 : T.MathUtils.smoothstep(time, 1.1, 5.4);
    reveal = T.MathUtils.damp(reveal, target, reduced.matches ? 100 : 5, dt);
    shared.reveal.value = reveal;
    shared.clock.value = time;
    look.lerp(aim, 1 - Math.exp(-dt * 4));
    camera.position.set(look.x * 0.24, 1.68 - look.y * 0.1, 4.2 - Math.min(time / 18, 1) * 1.7);
    camera.lookAt(look.x * 1.3, 1.65 - look.y * 0.55, -9);
    renderer.render(scene, camera);
  });
}
