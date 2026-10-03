const GRAVITY = 1080
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

export function createPlayer({ width = 1000, height = 720, floor = height - 30 } = {}) {
  return { x: Math.min(70, width / 2), y: floor, vx: 0, vy: 0, grounded: true,
    angle: -0.35, phase: 0, flying: false, cooldown: 0, grenadeCooldown: 0, muzzle: 0,
    bullets: [], grenades: [], bursts: [] }
}

function direction(player, aim) {
  return aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)
    ? Math.atan2(aim.y - (player.y - 24), aim.x - player.x) : player.angle
}

// Swept collision prevents a fast shot from passing through a narrow block.
function firstHit(x, y, nx, ny, blocks, padding = 0) {
  let nearest = null
  for (const block of blocks) {
    if (!block.anchored) continue
    const cos = Math.cos(block.angle || 0), sin = Math.sin(block.angle || 0)
    const ox = (x - block.x) * cos + (y - block.y) * sin
    const oy = -(x - block.x) * sin + (y - block.y) * cos
    const dx = (nx - x) * cos + (ny - y) * sin
    const dy = -(nx - x) * sin + (ny - y) * cos
    let enter = 0, leave = 1, normalX = 0, normalY = 0, miss = false
    for (const [origin, delta, extent, ax, ay] of [
      [ox, dx, block.w / 2 + padding, 1, 0],
      [oy, dy, block.h / 2 + padding, 0, 1],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (Math.abs(origin) > extent) miss = true
        continue
      }
      const a = (-extent - origin) / delta, b = (extent - origin) / delta
      const near = Math.min(a, b), far = Math.max(a, b)
      if (near >= enter) {
        enter = near
        normalX = ax * -Math.sign(delta)
        normalY = ay * -Math.sign(delta)
      }
      leave = Math.min(leave, far)
      if (enter > leave) miss = true
    }
    if (!miss && enter <= 1 && leave >= 0 && (!nearest || enter < nearest.t)) {
      nearest = { t: enter, x: x + (nx - x) * enter, y: y + (ny - y) * enter,
        nx: normalX * cos - normalY * sin, ny: normalX * sin + normalY * cos }
    }
  }
  return nearest
}

function blast(player, projectile, grenade, onBlast) {
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1
  onBlast?.({ x: projectile.x, y: projectile.y, radius: grenade ? 160 : 42,
    power: grenade ? 800 : 420, dx: grenade ? 0 : projectile.vx / speed * 0.7,
    dy: grenade ? -0.4 : projectile.vy / speed * 0.7 })
  player.bursts.push({ x: projectile.x, y: projectile.y, life: grenade ? 0.5 : 0.22,
    duration: grenade ? 0.5 : 0.22, radius: grenade ? 150 : 25 })
  if (player.bursts.length > 32) player.bursts.shift()
}

export function throwGrenade(player, aim) {
  if (player.grenadeCooldown > 0 || player.grenades.length >= 8) return false
  const angle = direction(player, aim), dx = Math.cos(angle), dy = Math.sin(angle)
  player.grenades.push({ x: player.x + dx * 18, y: player.y - 24 + dy * 18,
    vx: dx * 460 + player.vx * 0.3, vy: dy * 460 - 190, life: 1.35, spin: 0 })
  player.grenadeCooldown = 0.35
  return true
}

export function updatePlayer(player, dt, { keys = {}, aim, width = 1000, floor = 690,
  blocks = [], fire = false, onBlast } = {}) {
  if (!Number.isFinite(dt) || dt <= 0) return player
  dt = Math.min(dt, 0.05)
  player.cooldown = Math.max(0, player.cooldown - dt)
  player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt)
  player.muzzle = Math.max(0, player.muzzle - dt)
  const movement = Number(Boolean(keys.right)) - Number(Boolean(keys.left))
  player.vx += (movement * 265 - player.vx) * Math.min(1, dt * 16)
  player.x = clamp(player.x + player.vx * dt, 12, width - 12)
  const previousY = player.y
  if (keys.jump && player.grounded) player.vy = -390
  player.vy = clamp(player.vy + (keys.jump ? -740 : GRAVITY) * dt, -390, 720)
  player.y += player.vy * dt
  player.grounded = false
  player.flying = Boolean(keys.jump)
  // ponytail: only anchored tops are platforms; loose rubble stays in the block physics.
  let landing = floor
  if (player.vy >= 0) {
    for (const block of blocks) {
      const top = block.y - block.h / 2
      if (block.anchored && player.x + 7 > block.x - block.w / 2 &&
          player.x - 7 < block.x + block.w / 2 && previousY <= top + 0.5 && player.y >= top) {
        landing = Math.min(landing, top)
      }
    }
    if (player.y >= landing) {
      player.y = landing
      player.vy = 0
      player.grounded = true
    }
  }
  if (player.y < 42) { player.y = 42; player.vy = Math.max(0, player.vy) }
  player.phase += Math.abs(player.vx) * dt * 0.075
  player.angle = direction(player, aim)
  if (fire && player.cooldown <= 0) {
    const dx = Math.cos(player.angle), dy = Math.sin(player.angle)
    player.bullets.push({ x: player.x + dx * 25, y: player.y - 24 + dy * 25,
      vx: dx * 1050, vy: dy * 1050, life: 1.5 })
    player.cooldown = 0.125
    player.muzzle = 0.07
  }

  for (const bullet of player.bullets) {
    const nx = bullet.x + bullet.vx * dt, ny = bullet.y + bullet.vy * dt
    const hit = firstHit(bullet.x, bullet.y, nx, ny, blocks)
    bullet.x = hit ? hit.x : nx
    bullet.y = hit ? hit.y : ny
    bullet.life -= dt
    if (hit) { blast(player, bullet, false, onBlast); bullet.life = 0 }
  }
  player.bullets = player.bullets.filter(b => b.life > 0 && b.x > -30 && b.x < width + 30 && b.y > -30 && b.y < floor + 30)
  for (const grenade of player.grenades) {
    grenade.vy += GRAVITY * dt
    const nx = grenade.x + grenade.vx * dt, ny = grenade.y + grenade.vy * dt
    const hit = firstHit(grenade.x, grenade.y, nx, ny, blocks, 4)
    grenade.x = hit ? hit.x + hit.nx * 0.5 : nx
    grenade.y = hit ? hit.y + hit.ny * 0.5 : ny
    if (hit) {
      const dot = grenade.vx * hit.nx + grenade.vy * hit.ny
      grenade.vx = (grenade.vx - 1.5 * dot * hit.nx) * 0.8
      grenade.vy = (grenade.vy - 1.5 * dot * hit.ny) * 0.8
    }
    if (grenade.y > floor - 4) {
      grenade.y = floor - 4
      grenade.vy = -Math.abs(grenade.vy) * 0.4
      grenade.vx *= 0.8
    }
    if (grenade.x < 4 || grenade.x > width - 4) {
      grenade.x = clamp(grenade.x, 4, width - 4)
      grenade.vx *= -0.5
    }
    grenade.spin += dt * grenade.vx * 0.06
    grenade.life -= dt
    if (grenade.life <= 0) blast(player, grenade, true, onBlast)
  }
  player.grenades = player.grenades.filter(g => g.life > 0)
  for (const burst of player.bursts) burst.life -= dt
  player.bursts = player.bursts.filter(b => b.life > 0)
  return player
}

export function drawPlayer(ctx, player, aim) {
  const angle = direction(player, aim), facing = Math.cos(angle) >= 0 ? 1 : -1
  const stride = player.grounded ? Math.sin(player.phase) * Math.min(10, Math.abs(player.vx) / 25) : 5
  ctx.save()
  ctx.translate(player.x, player.y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (player.flying) {
    ctx.fillStyle = '#ffd75b'
    ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(0, 9 + Math.sin(player.phase * 3) * 4); ctx.lineTo(5, -3); ctx.fill()
  }
  ctx.strokeStyle = '#62320e'
  ctx.lineWidth = 6
  for (const color of ['#62320e', '#f68b32']) {
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -26); ctx.lineTo(0, -14)
    ctx.lineTo(-7 - stride, -1); ctx.moveTo(0, -14); ctx.lineTo(7 + stride, -1)
    ctx.moveTo(0, -24); ctx.lineTo(Math.cos(angle) * 12, -24 + Math.sin(angle) * 12)
    ctx.stroke()
    ctx.lineWidth = 4
  }
  ctx.fillStyle = '#f68b32'; ctx.strokeStyle = '#62320e'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, -34, 6.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#2c2b2a'; ctx.fillRect(facing > 0 ? 2 : -4, -36, 2, 2)
  ctx.translate(0, -24)
  ctx.rotate(angle)
  ctx.fillStyle = '#202e32'; ctx.fillRect(8, -5, 19, 8); ctx.fillRect(9, 2, 5, 7)
  ctx.fillStyle = '#77d3de'; ctx.fillRect(10, -4, 15, 4)
  ctx.fillStyle = '#ecefe4'; ctx.fillRect(24, -3, 4, 3)
  if (player.muzzle > 0) {
    ctx.fillStyle = '#ffba38'; ctx.fillRect(29, -5, 9, 8)
    ctx.fillStyle = '#fff4a5'; ctx.fillRect(28, -2, 14, 3)
  }
  ctx.restore()
}

export function drawProjectiles(ctx, player) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#ffb145'; ctx.lineWidth = 3
  for (const bullet of player.bullets) {
    ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012)
    ctx.lineTo(bullet.x, bullet.y); ctx.stroke()
  }
  for (const grenade of player.grenades) {
    ctx.save(); ctx.translate(grenade.x, grenade.y); ctx.rotate(grenade.spin)
    ctx.fillStyle = '#202e32'; ctx.fillRect(-5, -5, 10, 10)
    ctx.fillStyle = grenade.life < 0.4 && Math.sin(grenade.life * 70) > 0 ? '#fff1a2' : '#f68b32'
    ctx.fillRect(-3, -3, 6, 6); ctx.fillStyle = '#c1d6d7'; ctx.fillRect(-2, -8, 4, 3)
    ctx.restore()
  }
  for (const burst of player.bursts) {
    const progress = 1 - burst.life / burst.duration, radius = burst.radius * progress
    ctx.globalAlpha = (1 - progress) * 0.8
    ctx.strokeStyle = '#ff9d35'; ctx.lineWidth = 5 * (1 - progress) + 1
    ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#ffbb43'
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9
      ctx.fillRect(burst.x + Math.cos(angle) * radius * 0.8 - 2,
        burst.y + Math.sin(angle) * radius * 0.8 - 2, 4, 4)
    }
  }
  ctx.restore()
}
