function angle(a, b, c) {
  const u = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }
  const v = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) }
  const dot = u.x * v.x + u.y * v.y + u.z * v.z
  const size = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z) || 1
  return Math.acos(Math.max(-1, Math.min(1, dot / size)))
}

export function fingerCount(hand) {
  return [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]
    .filter(([a, b, c]) => angle(hand[a], hand[b], hand[c]) > 2.35).length
}

export function gesture(hands) {
  if (hands.length < 2) return 'none'
  const counts = hands.map(fingerCount)
  if (counts.every((n) => n >= 3)) return 'open'
  if (counts.every((n) => n <= 1)) return 'fist'
  return 'none'
}
