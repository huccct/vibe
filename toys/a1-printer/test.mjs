import assert from 'node:assert/strict'
import { LAYERS, outlinePoint, printerMotion, visibleLayers } from './print.js'

assert.equal(visibleLayers(-1), 0)
assert.equal(visibleLayers(0.5), LAYERS / 2)
assert.equal(visibleLayers(2), LAYERS)
assert.ok(Math.abs(outlinePoint('bowl', 0, 0).x - 0.3108) < 1e-9)
assert.equal(printerMotion('vase', 1, 0).height, 4.58)
