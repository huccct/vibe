import assert from 'node:assert/strict'
import { createPlayer, updatePlayer, throwGrenade } from './arcade.js'

const player = createPlayer()
const tick = (seconds, options = {}) => {
  for (let t = 0; t < seconds; t += 1 / 120) updatePlayer(player, 1 / 120, options)
}
tick(1)
assert.equal(player.y, 690, 'The idle player stays on the floor.')
tick(1, { keys: { right: true, jump: true } })
assert.ok(player.x > 270 && player.y < 340, 'Walking and held jump provide controllable flight.')
const platform = { x: player.x, y: 470, w: 160, h: 30, angle: 0, anchored: true }
player.vx = 0
tick(2, { blocks: [platform] })
assert.equal(player.y, 455, 'Descending feet land on the first anchored platform top.')
platform.anchored = false
tick(1, { blocks: [platform] })
assert.equal(player.y, 690, 'Destroying support makes the player fall to the floor.')

Object.assign(player, createPlayer())
const hits = []
const front = { x: 300, y: 660, w: 4, h: 80, anchored: true }
const back = { x: 350, y: 660, w: 20, h: 80, anchored: true }
const onBlast = blast => hits.push(blast)
tick(0.6, { aim: { x: 500, y: 666 }, fire: true, blocks: [back, front], onBlast })
assert.ok(hits.length >= 3 && hits.length <= 5, 'Held fire emits repeated shots at a bounded rate.')
assert.ok(hits.every(hit => hit.x === 298 && hit.radius === 42 && hit.power === 420),
  'Swept shots hit the nearest thin block, independent of array order.')
assert.equal(throwGrenade(player, { x: 600, y: 300 }), true)
assert.equal(throwGrenade(player, { x: 600, y: 300 }), false, 'Grenade cooldown prevents unbounded spawning.')
tick(1.5, { onBlast })
assert.equal(hits.filter(hit => hit.radius === 160 && hit.power === 800).length, 1,
  'A grenade follows its fuse and blasts exactly once.')
assert.equal(player.grenades.length, 0)
assert.deepEqual(structuredClone(player), player, 'Every player state can be recorded for rewind.')
console.log('Arcade: floor, flight, platform support, swept fire, grenade fuse and cloneable rewind state pass.')
