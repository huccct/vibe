import assert from 'node:assert/strict'
import { response } from './motion.js'
for (let d = 0; d < 8; d++) {
  const start = response(d, .6, 0), release = response(d, .6, 1.2), end = response(d, .6, 3)
  assert.ok(Math.abs(start.x ** 2 + start.z ** 2 - 1) < 1e-10)
  assert.equal(release.fall, 0); assert.equal(end.fall, 1); assert.equal(end.phase, 3); assert.ok(end.finished)
  assert.equal(response(d, .2, 3).fall, 0); assert.equal(response(d, .2, 3).triggered, false)
}
assert.equal(response(0, .6, 0).z, -1)
assert.equal(response(2, .6, 0).x, 1)
assert.throws(() => response(8, .6, 0)); assert.throws(() => response(0, NaN, 0)); assert.throws(() => response(0, .6, -1))
console.log('Passed: eight directions, release/catch timing, weak vibration, invalid inputs.')
