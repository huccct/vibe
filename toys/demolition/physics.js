const GRAVITY = 1150
const STRIDE = 7

export function destructionPercent(bodies) {
  if (!bodies.length) return 0
  const displaced = bodies.filter(b => Math.hypot(b.x - b.homeX, b.y - b.homeY) > Math.min(b.w, b.h) * 0.45 || Math.abs(b.angle) > 0.2).length
  // Reserve 100% for the last piece, rather than rounding up an almost-finished wall.
  return Math.floor(displaced / bodies.length * 100)
}

export function createWall({ x, y, width, height, columns, rows }) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 ||
      !Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || columns * rows > 720) {
    throw new RangeError('A wall needs positive dimensions and 1–720 blocks.')
  }
  const w = width / columns
  const h = height / rows
  return Array.from({ length: columns * rows }, (_, id) => {
    const col = id % columns
    const row = Math.floor(id / columns)
    const homeX = x + (col + 0.5) * w
    const homeY = y + (row + 0.5) * h
    return { id, row, col, homeX, homeY, x: homeX, y: homeY, w, h,
      angle: 0, vx: 0, vy: 0, va: 0, anchored: true,
      below: row < rows - 1 ? id + columns : -1 }
  })
}

function release(body) {
  const released = Number(body.anchored)
  body.anchored = false
  return released
}

export function impact(bodies, { x, y, radius = 150, power = 600, dx = 0, dy = -0.3 }) {
  if (![x, y, radius, power, dx, dy].every(Number.isFinite) || radius <= 0) return 0
  let released = 0
  for (const b of bodies) {
    const distance = Math.hypot(b.x - x, b.y - y)
    if (distance > radius + Math.min(b.w, b.h) * 0.4) continue
    // A moving tool hits each block once at its outer edge, which still needs a useful impulse.
    const strength = Math.max(0.7, 1 - distance / radius)
    const nx = distance > 1 ? (b.x - x) / distance : Math.sin(b.id * 2.4)
    const ny = distance > 1 ? (b.y - y) / distance : -1
    released += release(b)
    b.vx += (nx * 0.8 + dx) * power * strength
    b.vy += (ny * 0.7 + dy - 0.25) * power * strength
    b.va += (Math.sin(b.id * 12.9 + x) * 5 + nx * 2) * strength * power / 600
  }
  return released
}

export function attract(bodies, { x, y, radius = 300, power = 1500 }, dt) {
  if (![x, y, radius, power, dt].every(Number.isFinite) || radius <= 0 || dt <= 0) return 0
  dt = Math.min(dt, 0.05)
  let released = 0
  for (const b of bodies) {
    const dx = x - b.x
    const dy = y - b.y
    const distance = Math.hypot(dx, dy)
    if (distance > radius) continue
    released += release(b)
    const force = power * (1 - distance / radius) * dt / Math.max(distance, 30)
    b.vx += dx * force
    b.vy += dy * force
    b.va += (b.id % 2 ? 1 : -1) * dt * 2
  }
  return released
}

function bounds(b) {
  b.cos = Math.cos(b.angle)
  b.sin = Math.sin(b.angle)
  b.ex = (Math.abs(b.cos) * b.w + Math.abs(b.sin) * b.h) / 2
  b.ey = (Math.abs(b.sin) * b.w + Math.abs(b.cos) * b.h) / 2
  b.left = b.x - b.ex
  b.right = b.x + b.ex
}

function contact(a, b, dt) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dy) >= a.ey + b.ey) return
  let depth = Infinity
  let nx = 0
  let ny = 0
  const axes = [a.cos, a.sin, -a.sin, a.cos, b.cos, b.sin, -b.sin, b.cos]
  for (let i = 0; i < axes.length; i += 2) {
    const ax = axes[i]
    const ay = axes[i + 1]
    const ra = (a.w * Math.abs(ax * a.cos + ay * a.sin) + a.h * Math.abs(-ax * a.sin + ay * a.cos)) / 2
    const rb = (b.w * Math.abs(ax * b.cos + ay * b.sin) + b.h * Math.abs(-ax * b.sin + ay * b.cos)) / 2
    const projected = dx * ax + dy * ay
    const overlap = ra + rb - Math.abs(projected)
    if (overlap <= 0) return
    if (overlap < depth) {
      depth = overlap
      const direction = projected < 0 ? -1 : 1
      nx = ax * direction
      ny = ay * direction
    }
  }
  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const normalSpeed = rvx * nx + rvy * ny
  if (normalSpeed < -45 && a.anchored !== b.anchored) {
    const hit = a.anchored ? a : b
    const moving = a.anchored ? b : a
    release(hit)
    hit.supported = false
    hit.vy -= Math.min(100, -normalSpeed * 0.18)
    hit.va = moving.va * 0.4 + Math.sin(hit.id * 4.1) * Math.min(3, -normalSpeed / 100)
  }
  let ia = a.anchored ? 0 : 1
  let ib = b.anchored ? 0 : 1
  // ponytail: solve stacks from the floor upward and use resting lower blocks as support.
  // This keeps 240 blocks stable with three iterations; a constraint solver is only needed for load-bearing structures.
  if (ny > 0.5 && b.supported && a.vy >= 0) {
    ib = 0
    a.supported = true
    if (Math.abs(dx) > b.w * 0.3 && (normalSpeed < -20 || Math.abs(rvx) > 25)) a.va -= Math.sign(dx) * dt * 12
  } else if (ny < -0.5 && a.supported && b.vy >= 0) {
    ia = 0
    b.supported = true
    if (Math.abs(dx) > a.w * 0.3 && (normalSpeed < -20 || Math.abs(rvx) > 25)) b.va += Math.sign(dx) * dt * 12
  }
  const inverseMass = ia + ib
  if (!inverseMass) return
  const correction = Math.max(0, depth - 0.025) * 0.92 / inverseMass
  a.x -= nx * correction * ia
  a.y -= ny * correction * ia
  b.x += nx * correction * ib
  b.y += ny * correction * ib

  if (normalSpeed >= 0) return
  const impulse = -normalSpeed * (normalSpeed < -120 ? 1.1 : 1) / inverseMass
  const tangentSpeed = -rvx * ny + rvy * nx
  const friction = Math.max(-impulse * 0.35, Math.min(impulse * 0.35, -tangentSpeed / inverseMass))
  const ix = nx * impulse - ny * friction
  const iy = ny * impulse + nx * friction
  a.vx -= ix * ia
  a.vy -= iy * ia
  b.vx += ix * ib
  b.vy += iy * ib
  // ponytail: SAT resolves translation; damp spin at contact instead of a full rigid-body constraint solver.
  if (normalSpeed > -45) {
    if (ia) a.va *= 0.98
    if (ib) b.va *= 0.98
  }
}

function boundaries(b, width, floor, dt) {
  if (b.anchored) return
  bounds(b)
  if (b.x - b.ex < 0) {
    b.x = b.ex
    if (b.vx < 0) b.vx *= -0.25
    b.va *= 0.8
  } else if (b.x + b.ex > width) {
    b.x = width - b.ex
    if (b.vx > 0) b.vx *= -0.25
    b.va *= 0.8
  }
  if (b.y + b.ey >= floor) {
    b.y = floor - b.ey
    if (b.vy > 0) b.vy = b.vy > 130 ? -b.vy * 0.14 : 0
    if (b.vy === 0) b.supported = true
    b.vx *= Math.exp(-dt * 12)
    b.va *= Math.exp(-dt * 15)
    if (Math.abs(b.vy) < 20) {
      const target = Math.round(b.angle / (Math.PI / 2)) * Math.PI / 2
      b.angle += (target - b.angle) * Math.min(1, dt * 8)
      bounds(b)
      b.y = floor - b.ey
    }
  }
  b.x = Math.max(b.ex, Math.min(width - b.ex, b.x))
}

export function step(bodies, dt, { width = 1000, floor = 650, arcade = false } = {}) {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(width) || !Number.isFinite(floor) || width <= 0) return
  dt = Math.min(dt, 0.05)
  const steps = Math.ceil(dt / (1 / 120))
  const h = dt / steps
  // Unsupported columns crumble upward; the untouched wall remains attached to its original backing.
  for (let i = arcade ? -1 : bodies.length - 1; i >= 0; i--) {
    const b = bodies[i]
    const below = bodies[b.below]
    if (b.anchored && below && !below.anchored) {
      release(b)
      b.vx = below.vx * 0.4
      b.vy = Math.min(0, below.vy) * 0.3
      b.va = below.va * 0.3 + Math.sin(b.id * 4.1) * 0.8
    }
  }
  for (let sub = 0; sub < steps; sub++) {
    for (const b of bodies) {
      b.supported = b.anchored
      if (b.anchored) continue
      b.vy += GRAVITY * h
      b.vx = Math.max(-1800, Math.min(1800, b.vx)) * Math.exp(-h * 0.12)
      b.vy = Math.max(-1800, Math.min(1800, b.vy))
      b.va = Math.max(-14, Math.min(14, b.va)) * Math.exp(-h * 0.7)
      b.x += b.vx * h
      b.y += b.vy * h
      b.angle += b.va * h
    }
    // ponytail: arcade fragments fly independently; only demolition tools need pile collisions.
    for (let iteration = 0; !arcade && iteration < 3; iteration++) {
      for (const b of bodies) boundaries(b, width, floor, h / 3)
      for (const b of bodies) bounds(b)
      const sorted = [...bodies].sort((a, b) => a.left - b.left)
      const pairs = []
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i]
        for (let j = i + 1; j < sorted.length && sorted[j].left < a.right; j++) {
          const b = sorted[j]
          if ((!a.anchored || !b.anchored) && Math.abs(a.y - b.y) < a.ey + b.ey) pairs.push([a, b])
        }
      }
      pairs.sort((a, b) => Math.max(b[0].y, b[1].y) - Math.max(a[0].y, a[1].y))
      for (const [a, b] of pairs) contact(a, b, h / 3)
    }
    for (const b of bodies) boundaries(b, width, floor, 0)
  }
}

export function snapshot(bodies) {
  const state = new Float64Array(bodies.length * STRIDE)
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    state.set([b.x, b.y, b.angle, b.vx, b.vy, b.va, Number(b.anchored)], i * STRIDE)
  }
  return state
}

export function restore(bodies, state) {
  if (state.length !== bodies.length * STRIDE) throw new RangeError('Snapshot does not match this wall.')
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    const offset = i * STRIDE
    b.x = state[offset]
    b.y = state[offset + 1]
    b.angle = state[offset + 2]
    b.vx = state[offset + 3]
    b.vy = state[offset + 4]
    b.va = state[offset + 5]
    b.anchored = Boolean(state[offset + 6])
  }
}

export function reset(bodies) {
  for (const b of bodies) {
    b.x = b.homeX
    b.y = b.homeY
    b.angle = b.vx = b.vy = b.va = 0
    b.anchored = true
  }
}
