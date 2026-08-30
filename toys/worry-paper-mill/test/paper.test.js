import test from 'node:test'
import assert from 'node:assert/strict'
import { paperBits, processingGrade, punchPattern, recordCode } from '../paper.js'

test('同一句烦恼会得到同一份纸张材料与编码', () => {
  assert.deepEqual(paperBits('明天再说', 3), paperBits('明天再说', 3))
  assert.equal(recordCode('明天再说'), recordCode('明天再说'))
  assert.notEqual(recordCode('明天再说'), recordCode('今天再说'))
})

test('打孔纸印稳定且上下左右对称', () => {
  const pattern = punchPattern('明天再说', 11)
  assert.deepEqual(pattern, punchPattern('明天再说', 11))
  assert.notDeepEqual(pattern, punchPattern('今天再说', 11))
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern.length; x++) {
      assert.equal(pattern[y][x], pattern[y][pattern.length - 1 - x])
      assert.equal(pattern[y][x], pattern[pattern.length - 1 - y][x])
    }
  }
})

test('打孔矩阵拒绝无法对称的尺寸', () => {
  assert.throws(() => punchPattern('test', 10), RangeError)
})

test('处理精度按明确边界评级', () => {
  assert.deepEqual([100, 92, 91, 78, 77, 60, 59].map(processingGrade), ['S', 'S', 'A', 'A', 'B', 'B', 'C'])
})
