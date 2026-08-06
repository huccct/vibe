import test from 'node:test'
import assert from 'node:assert/strict'
import { stepBody } from '../physics.js'

test('墨迹下落但不会穿过纸底', () => {
  const body = {
    points: [{ x: 0, y: 10, width: 10 }],
    x: 50, y: 20, vx: 0, vy: 0, angle: 0, va: 0, sleeping: false,
  }

  for (let i = 0; i < 240; i++) stepBody(body, 1 / 60, 900, 0, 100)

  assert.ok(body.y <= 85)
  assert.ok(body.y > 80)
})
