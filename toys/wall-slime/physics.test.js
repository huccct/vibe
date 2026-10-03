import assert from 'node:assert/strict';
import { createSlime, grab, release, toss, step, surfacePoint, RADIUS, FLOOR } from './physics.js';

const bounds = { x: 1.1, top: 1.8 };
function cycle(adhesion, dt = 1 / 120) {
  const s = createSlime(); s.adhesion = adhesion; toss(s);
  const phases = new Set(); let peelTime = 0, detachTime = 0;
  for (let t = 0; t < 22; t += dt) {
    step(s, dt, bounds); phases.add(s.phase);
    if (s.phase === 'peeling' && !peelTime) peelTime = t;
    if (s.phase === 'falling' && !detachTime) detachTime = t;
    assert([s.x, s.y, s.z, s.sx, s.sy, s.sz].every(Number.isFinite));
    assert(Math.abs(s.x) <= bounds.x + 1e-9, 'Blob stays reachable on narrow screens');
    assert(s.y >= FLOOR + RADIUS * s.sy - 1e-8, 'Body must stay above floor');
    assert(surfacePoint(s, 0, -1, 0, t)[1] >= FLOOR, 'Surface cannot pass through floor');
    if (s.phase === 'peeling') {
      const top = surfacePoint(s, 0, 1, 0, t);
      assert(Math.abs(top[1] - s.tether.y) < 0.1, 'The top stays stuck while the body slides');
    }
  }
  for (const phase of ['flying', 'stuck', 'peeling', 'falling', 'rest']) assert(phases.has(phase), `Missing ${phase}`);
  assert.equal(s.wallHits, 1); assert.equal(s.throws, 1); assert.equal(s.phase, 'rest');
  return { s, peelTime, detachTime };
}
const slippery = cycle(0), sticky = cycle(1), lowFps = cycle(0.55, 1 / 30);
assert(sticky.peelTime > slippery.peelTime + 1, 'Adhesion visibly changes wall-hold time');
assert(sticky.detachTime > slippery.detachTime + 1, 'Stickier slime peels more slowly');
assert.equal(lowFps.s.phase, 'rest');
const s = sticky.s;
grab(s, 0.5, 1); for (let i = 0; i < 100; i++) step(s, 1 / 120, bounds);
assert.equal(s.phase, 'held'); assert(s.y > 0.6, 'Grabbing lifts a resting blob');
release(s, 1e6, 1e6); assert(Math.hypot(s.vx, s.vy) <= 15.01, 'Fling speed is bounded');
assert.equal(s.phase, 'flying'); assert.equal(s.throws, 2);
assert.throws(() => step(s, NaN), RangeError);
assert.throws(() => step(s, -1), RangeError);
const before = JSON.stringify(s); grab(s, Infinity, 1); assert.equal(JSON.stringify(s), before);
console.log('Passed: flick → splat → stick → stretch → detach → settle; adhesion, 30 FPS, bounds and re-grab.');
