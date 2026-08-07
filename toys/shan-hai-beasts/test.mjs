import assert from 'node:assert/strict'
import { BEASTS, nextIndex } from './catalog.js'

assert.equal(BEASTS.length, 9)
assert.equal(nextIndex(8), 0)
