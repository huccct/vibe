export const RADIUS = 0.68;
export const FLOOR = -2.7;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createSlime() {
  return {
    phase: 'ready', x: 0, y: 0.15, z: 0.27, vx: 0, vy: 0, vz: 0,
    sx: 1.4, sy: 1.16, sz: 0.35, dsx: 0, dsy: 0, dsz: 0,
    age: 0, hit: 0, wobble: 0, adhesion: 0.55, tether: null,
    grip: null, heldFor: 0, throws: 0, wallHits: 0, floorHits: 0,
  };
}

export function grab(s, x, y) {
  if (![x, y].every(Number.isFinite)) return;
  s.phase = 'held'; s.grip = { x, y }; s.heldFor = 0;
  s.tether = null; s.vx *= 0.25; s.vy *= 0.25; s.vz = 0;
}

export function release(s, vx, vy) {
  if (s.phase !== 'held' || ![vx, vy].every(Number.isFinite)) return;
  const speed = Math.hypot(vx, vy), factor = Math.min(1, 15 / Math.max(speed, 1));
  s.vx = vx * factor; s.vy = vy * factor;
  s.vz = -7 - Math.min(speed, 12) * 0.4;
  s.z = Math.max(1.8, s.z); s.phase = 'flying'; s.age = 0;
  s.grip = null; s.tether = null; s.throws++;
}

export function toss(s, x = 0, y = 0.8) {
  // A keyboard/button throw follows the same release + collision path as a flick.
  grab(s, s.x, s.y);
  s.x = clamp(x - 0.45, -1.2, 1.2); s.y = -1.35; s.z = 2.5;
  release(s, (x - s.x) / 0.24, (y - s.y) / 0.24 + 0.8);
}

function spring(s, key, target, dt) {
  const velocity = `d${key}`;
  s[velocity] += ((target - s[key]) * 115 - s[velocity] * 12) * dt;
  s[key] = clamp(s[key] + s[velocity] * dt, 0.12, 2.5);
}

// ponytail: one mass, damped shape springs and one peeling contact capture this
// single toy's sticky cycle. Use a soft-body solver if blobs must collide or tear.
export function step(s, dt, bounds = { x: 4, top: 2.2 }) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.05) throw new RangeError('Invalid time step');
  if (dt > 1 / 120) {
    const n = Math.ceil(dt * 120);
    for (let i = 0; i < n; i++) step(s, dt / n, bounds);
    return;
  }
  s.age += dt; s.hit = Math.max(0, s.hit - dt); s.wobble *= Math.exp(-dt * 2.2);
  let tx = 1, ty = 1, tz = 1;
  if (s.phase === 'ready') { tx = 1.4; ty = 1.16; tz = 0.35; }
  if (s.phase === 'held') {
    s.heldFor += dt;
    s.vx += ((s.grip.x - s.x) * 90 - s.vx * 13) * dt;
    s.vy += ((s.grip.y - 0.16 - s.y) * 90 - s.vy * 13 - 2) * dt;
    s.z += (2.2 - s.z) * Math.min(1, dt * 12);
    tx = 0.93; ty = 1.06; tz = 0.92;
    s.x += s.vx * dt; s.y += s.vy * dt;
  } else if (s.phase === 'flying' || s.phase === 'falling') {
    s.vy -= 7.5 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.vx *= Math.exp(-dt * 0.45);
    ty = 1 + Math.min(0.35, Math.abs(s.vy) * 0.025);
    tx = 1 / Math.sqrt(ty);
    if (s.phase === 'flying' && s.z <= RADIUS * s.sz + 0.04) {
      s.phase = 'stuck'; s.age = 0; s.z = 0.18;
      s.y = clamp(s.y, FLOOR + 1.9, bounds.top - 0.55);
      s.x = clamp(s.x, -bounds.x, bounds.x);
      s.tether = { x: s.x, y: s.y + 0.52, z: 0.075 };
      s.vx *= 0.045; s.vy = 0; s.vz = 0;
      s.sx = 1.82; s.sy = 1.50; s.sz = 0.18;
      s.dsx = -1.5; s.dsy = -1; s.dsz = 0;
      s.hit = 0.26; s.wobble = 1; s.wallHits++;
    }
    if (s.y - RADIUS * s.sy < FLOOR) {
      s.y = FLOOR + RADIUS * s.sy;
      if (Math.abs(s.vy) > 1.2) {
        s.vy = Math.abs(s.vy) * 0.19; s.vx *= 0.45;
        s.sx = 1.48; s.sy = 0.55; s.dsy = 1; s.wobble = 0.5;
        s.floorHits++;
      } else {
        s.phase = 'rest'; s.vx = s.vy = s.vz = 0; s.age = 0;
      }
    }
  } else if (s.phase === 'stuck') {
    tx = 1.38; ty = 1.14; tz = 0.26;
    const wait = 0.65 + s.adhesion * 2.0;
    if (s.age > wait) { s.phase = 'peeling'; s.age = 0; }
  } else if (s.phase === 'peeling') {
    const viscous = 0.6 + s.adhesion * 1.7;
    s.vy -= dt * 0.54 / viscous;
    s.y += s.vy * dt;
    s.x += Math.sin(s.age * 2.6) * dt * 0.055;
    s.z += (0.39 - s.z) * dt * 0.7;
    tx = 1.1; ty = 0.94; tz = 0.53;
    const length = s.tether.y - s.y;
    if (length > 1.7 + s.adhesion * 0.45 || s.y < FLOOR + 1.0) {
      s.phase = 'falling'; s.age = 0; s.tether = null;
      s.vz = 0.9; s.vy = -0.7; s.dsy = 3; s.dsx = -1;
      s.wobble = 0.8;
    }
  } else if (s.phase === 'rest') {
    tx = 1.21; ty = 0.75; tz = 1.10;
    s.y = FLOOR + RADIUS * s.sy;
  }
  spring(s, 'sx', tx, dt); spring(s, 'sy', ty, dt); spring(s, 'sz', tz, dt);
  s.z = clamp(s.z, RADIUS * s.sz + 0.025, 3.0);
  if (s.x < -bounds.x || s.x > bounds.x) {
    s.x = clamp(s.x, -bounds.x, bounds.x); s.vx *= -0.35;
  }
  if (s.y > bounds.top) { s.y = bounds.top; s.vy = Math.min(0, s.vy); }
  if (s.y < FLOOR + RADIUS * s.sy) s.y = FLOOR + RADIUS * s.sy;
}

export function surfacePoint(s, nx, ny, nz, time) {
  const angle = Math.atan2(ny, nx);
  const flat = s.phase === 'ready' || s.phase === 'stuck' || s.phase === 'peeling';
  const lobes = flat ? 0.10 : 0.035;
  const rim = 1 + (Math.sin(angle * 3 + 0.8) * 0.5 + Math.sin(angle * 2 - 0.5) * 0.3 + Math.cos(angle * 7) * 0.2) * lobes;
  const jiggle = Math.sin(angle * 4 - time * 15) * s.wobble * 0.065;
  let x = s.x + nx * RADIUS * s.sx * (rim + jiggle);
  let y = s.y + ny * RADIUS * s.sy * (rim + jiggle);
  let z = s.z + nz * RADIUS * s.sz * (1 + jiggle * 0.5);
  if (s.tether && s.phase === 'peeling') {
    const w = Math.pow(clamp((ny - 0.02) / 0.98, 0, 1), 2.8);
    x += (s.tether.x - s.x) * w;
    y += (s.tether.y - s.y - RADIUS * s.sy) * w;
    z += (s.tether.z - s.z) * w;
  }
  if (s.grip) {
    const dx = s.grip.x - s.x, dy = s.grip.y - s.y;
    const length = Math.hypot(dx, dy);
    if (length > 0.1) {
      const dot = (nx * dx + ny * dy) / length;
      const pull = Math.pow(Math.max(0, dot), 4) * Math.min(1.7, length) * 0.6;
      x += dx / length * pull; y += dy / length * pull;
    }
  }
  return [x, Math.max(FLOOR + 0.008, y), Math.max(0.028, z)];
}
