export function hashText(text) {
  let hash = 2166136261
  for (const char of text) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seeded(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function paperBits(text, count = 88) {
  const random = seeded(hashText(text))
  return Array.from({ length: count }, (_, index) => ({
    x: random(),
    y: random(),
    angle: random() * Math.PI,
    width: 0.45 + random() * 0.75,
    shade: index % 4,
  }))
}

export function punchPattern(text, size = 11) {
  if (size < 3 || size % 2 === 0) throw new RangeError('打孔矩阵尺寸必须是大于 1 的奇数')
  const random = seeded(hashText(text))
  const pattern = Array.from({ length: size }, () => Array(size).fill(false))
  const half = Math.ceil(size / 2)

  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const punched = random() > 0.52
      pattern[y][x] = punched
      pattern[y][size - 1 - x] = punched
      pattern[size - 1 - y][x] = punched
      pattern[size - 1 - y][size - 1 - x] = punched
    }
  }

  pattern[half - 1][half - 1] = true
  return pattern
}

export function recordCode(text) {
  return hashText(text).toString(16).padStart(8, '0').toUpperCase()
}

export function processingGrade(score) {
  if (score >= 92) return 'S'
  if (score >= 78) return 'A'
  if (score >= 60) return 'B'
  return 'C'
}
