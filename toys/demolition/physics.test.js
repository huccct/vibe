import assert from 'node:assert/strict'
import { createWall, impact, attract, step, snapshot, restore, reset, destructionPercent } from './physics.js'

const counted = createWall({ x: 0, y: 0, width: 1000, height: 400, columns: 20, rows: 10 })
assert.equal(destructionPercent(counted), 0)
for (const b of counted.slice(0, -1)) b.x += b.w
assert.equal(destructionPercent(counted), 99, '199 of 200 blocks must not round up to completion.')
counted.at(-1).angle = 0.21
assert.equal(destructionPercent(counted), 100, 'The final displaced or rotated block completes the round.')
reset(counted)
assert.equal(destructionPercent(counted), 0, 'Rebuilding starts progress at zero.')
assert.equal(destructionPercent([]), 0)

const wall = createWall({ x: 170, y: 150, width: 660, height: 440, columns: 15, rows: 10 })
const original = snapshot(wall)
step(wall, 1 / 60)
assert.deepEqual(snapshot(wall), original, 'An intact wall must stay still.')
const arcade = createWall({ x: 0, y: 0, width: 1200, height: 600, columns: 40, rows: 18 })
impact([arcade[arcade.length - 1]], { x: 1185, y: 580, radius: 40, power: 400 })
step(arcade, 1 / 60, { width: 1280, floor: 690, arcade: true })
assert.equal(arcade.filter(b => !b.anchored).length, 1, 'Arcade shots leave local holes without collapsing entire columns.')
assert.ok(snapshot(arcade).every(Number.isFinite), 'A full arcade page stays finite.')
assert.ok(impact(wall, { x: 500, y: 560, radius: 190, power: 750 }) > 0)
for (let frame = 0; frame < 360; frame++) {
  if (frame < 25) attract(wall, { x: 600, y: 350 }, 1 / 60)
  step(wall, 1 / 60)
  assert.ok(snapshot(wall).every(Number.isFinite), 'Impacts and attraction must remain finite.')
  for (const b of wall.filter(b => !b.anchored)) {
    const ex = (Math.abs(Math.cos(b.angle)) * b.w + Math.abs(Math.sin(b.angle)) * b.h) / 2
    const ey = (Math.abs(Math.sin(b.angle)) * b.w + Math.abs(Math.cos(b.angle)) * b.h) / 2
    assert.ok(b.y + ey <= 650.00001, 'Blocks must not penetrate the floor.')
    assert.ok(b.x - ex >= -0.00001 && b.x + ex <= 1000.00001, 'Blocks must remain inside side walls.')
  }
}
const scattered = snapshot(wall)
step(wall, 0.05)
restore(wall, scattered)
assert.deepEqual(snapshot(wall), scattered, 'Rewind must exactly restore movement and attachment state.')
reset(wall)
assert.deepEqual(snapshot(wall), original, 'Reset must rebuild the original wall.')

const pair = createWall({ x: 400, y: 600, width: 100, height: 50, columns: 2, rows: 1 })
pair[0].anchored = pair[1].anchored = false
pair[0].vx = 160
pair[1].vx = -160
for (let frame = 0; frame < 120; frame++) step(pair, 1 / 60)
assert.ok(Math.abs(pair[0].x - pair[1].x) >= 49.9, 'Colliding blocks must remain separated.')

const fracture = createWall({ x: 400, y: 400, width: 100, height: 50, columns: 2, rows: 1 })
impact([fracture[0]], { x: 400, y: 425, radius: 104, power: 700, dx: 0.85, dy: 0 })
for (let frame = 0; frame < 30; frame++) step(fracture, 1 / 60)
assert.equal(fracture[1].anchored, false, 'A strong collision must break the untouched neighboring block free.')

// Reproduce the actual one-hit-per-block pendulum sweep, including its weak outer-edge contacts.
const swept = createWall({ x: 150, y: 189, width: 700, height: 438, columns: 16, rows: 10 })
const hits = new Set()
let angle = -0.94
let omega = 0
for (let frame = 0; frame < 480; frame++) {
  const previousX = 555 + Math.sin(angle) * 530
  omega -= (1350 / 530) * Math.sin(angle) / 60
  omega *= Math.exp(-0.19 / 60)
  angle += omega / 60
  const x = 555 + Math.sin(angle) * 530
  const y = -18.16 + Math.cos(angle) * 530
  const speed = Math.abs(omega * 530)
  if (speed > 110) {
    const candidates = swept.filter(b => !hits.has(b.id) && Math.hypot(b.x - x, b.y - y) < 91)
    impact(candidates, { x, y, radius: 104, power: Math.min(900, speed * 0.92), dx: Math.sign(x - previousX) * 0.85, dy: -0.25 })
    for (const b of candidates) hits.add(b.id)
  }
  step(swept, 1 / 60)
}
const displaced = swept.filter(b => Math.hypot(b.x - b.homeX, b.y - b.homeY) > 60).length
assert.ok(displaced >= 50, `The pendulum must visibly demolish the wall, not only release its anchors (${displaced} moved).`)

const stack = createWall({ x: 400, y: 100, width: 50, height: 500, columns: 1, rows: 10 })
for (const b of stack) b.anchored = false
for (let frame = 0; frame < 300; frame++) step(stack, 1 / 60)
for (let i = 1; i < stack.length; i++) {
  assert.ok(stack[i].y - stack[i - 1].y >= 49.9, 'A resting pile must not compress through itself.')
}
assert.throws(() => createWall({ x: 0, y: 0, width: 100, height: 100, columns: 0, rows: 4 }), RangeError)
console.log(`Demolition physics: intact wall, impacts, attraction, boundaries, fracture, stacking and exact rewind pass; ${displaced}/160 blocks visibly displaced by one pendulum sweep.`)
