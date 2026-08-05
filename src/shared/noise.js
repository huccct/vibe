/**
 * 2D 梯度噪声（Perlin 风格）+ fBm。
 * 自己写是因为不想为了几十行引一个包。返回值范围约 [-1, 1]。
 */

/** mulberry32：小而够用的 seeded PRNG。 */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a, b, t) => a + (b - a) * t

/**
 * @param {number} [seed]
 * @returns {(x: number, y: number) => number} 噪声采样函数
 */
export function makeNoise2D(seed = Date.now()) {
  const rand = rng(seed)

  // 512 个单位梯度向量，用 256 长的表 + 位掩码取模
  const gx = new Float32Array(256)
  const gy = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const a = rand() * Math.PI * 2
    gx[i] = Math.cos(a)
    gy[i] = Math.sin(a)
  }

  const perm = new Uint8Array(256)
  for (let i = 0; i < 256; i++) perm[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }

  const hash = (xi, yi) => perm[(perm[xi & 255] + yi) & 255]

  return function noise2D(x, y) {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const u = fade(fx)
    const v = fade(fy)

    // 四个格点的梯度 · 到采样点的位移
    const dot = (xi, yi, dx, dy) => {
      const h = hash(xi, yi)
      return gx[h] * dx + gy[h] * dy
    }

    const n00 = dot(x0, y0, fx, fy)
    const n10 = dot(x0 + 1, y0, fx - 1, fy)
    const n01 = dot(x0, y0 + 1, fx, fy - 1)
    const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1)

    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v)
  }
}

/**
 * 分形叠加：多个倍频的噪声相加，出来的场更有细节层次。
 * @param {(x: number, y: number) => number} noise
 * @param {number} [octaves]
 */
export function fbm(noise, octaves = 4, lacunarity = 2, gain = 0.5) {
  return (x, y) => {
    let sum = 0
    let amp = 1
    let norm = 0
    let freq = 1
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq) * amp
      norm += amp
      amp *= gain
      freq *= lacunarity
    }
    return sum / norm
  }
}
