import assert from 'node:assert/strict'
import { fingerCount, gesture } from './gesture.js'

function hand(open) {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  for (const [mcp, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    p[mcp] = { x: 0, y: 1 }
    p[pip] = { x: 0, y: 0 }
    p[tip] = open ? { x: 0, y: -1 } : { x: 1, y: 0 }
  }
  return p
}

assert.equal(fingerCount(hand(true)), 4)
assert.equal(fingerCount(hand(false)), 0)
assert.equal(gesture([hand(true), hand(true)]), 'open')
assert.equal(gesture([hand(false), hand(false)]), 'fist')
console.log('gesture checks passed')
