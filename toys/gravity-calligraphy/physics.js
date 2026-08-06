export function bottomOf(body) {
  const sin = Math.sin(body.angle)
  const cos = Math.cos(body.angle)
  let bottom = -Infinity
  for (const p of body.points) bottom = Math.max(bottom, p.x * sin + p.y * cos + p.width / 2)
  return bottom
}

export function stepBody(body, dt, gravity, wind, floor) {
  if (body.sleeping && Math.abs(wind) < 1) return

  body.vx += wind * dt
  body.vy += gravity * dt
  body.x += body.vx * dt
  body.y += body.vy * dt
  body.angle += body.va * dt

  const overlap = body.y + bottomOf(body) - floor
  if (overlap <= 0) return

  body.y -= overlap
  body.vy *= -0.22
  body.vx *= 0.8
  body.va *= 0.72
  body.sleeping = Math.abs(body.vy) < 12 && Math.abs(body.vx) < 4 && Math.abs(body.va) < 0.03
}
