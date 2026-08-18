import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestColor, quantize } from '../beads.js'

test('颜色映射、限色和透明格正确',()=>{
  const palette=[{code:'R',rgb:[255,0,0]},{code:'B',rgb:[0,0,255]}]
  assert.equal(nearestColor(240,10,5,palette).code,'R')
  const cells=quantize(new Uint8ClampedArray([255,0,0,255,0,0,255,255,0,0,0,0]),palette,1)
  assert.deepEqual(cells.map(c=>c?.code||null),['R','R',null])
})

test('限色时保留少量但关键的强调色',()=>{
  const palette=[{code:'W',rgb:[255,255,255]},{code:'G',rgb:[128,128,128]},{code:'R',rgb:[255,0,0]}]
  const data=new Uint8ClampedArray([...Array(8).fill([250,250,250,255]),[255,0,0,255]].flat())
  const cells=quantize(data,palette,2,9)
  assert.equal(cells.at(-1).code,'R')
})
