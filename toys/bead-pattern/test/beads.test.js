import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestColor, quantize } from '../beads.js'

test('颜色映射、限色和透明格正确',()=>{
  const palette=[{code:'R',rgb:[255,0,0]},{code:'B',rgb:[0,0,255]}]
  assert.equal(nearestColor(240,10,5,palette).code,'R')
  const cells=quantize(new Uint8ClampedArray([255,0,0,255,0,0,255,255,0,0,0,0]),palette,1)
  assert.deepEqual(cells.map(c=>c?.code||null),['R','R',null])
})
