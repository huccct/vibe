/**
 * 粒子跟着 noise 场走，拖尾积累成流线。
 * 场是 fBm 噪声映射到角度，再加一个随时间的慢漂移让图案不停演化。
 */
import { createStage, loop, trackPointer } from '../../src/shared/stage.js'
import { makeNoise2D, fbm } from '../../src/shared/noise.js'

const host = document.getElementById('stage')
const stage = createStage(host, (w, h, s) => clear(s))
const pointer = trackPointer(host)

const PUSH_RADIUS = 90

let field
let particles = []
let hue = 0

const opts = { n: 1600, scale: 4, fade: 2 }

bindSlider('n', (v) => {
  opts.n = v
  resize(v)
})
bindSlider('scale', (v) => (opts.scale = v))
bindSlider('fade', (v) => (opts.fade = v))
document.getElementById('reseed').addEventListener('click', reseed)

reseed()
resize(opts.n)

loop((dt, t) => {
  // 半透明黑覆盖旧帧 → 拖尾。fade 越大衰减越快，线越短
  stage.ctx.fillStyle = `rgba(8, 9, 12, ${opts.fade / 100})`
  stage.ctx.fillRect(0, 0, stage.width, stage.height)

  hue = (hue + dt * 6) % 360

  for (const p of particles) step(p, dt, t)
})

function step(p, dt, t) {
  const s = opts.scale / 1000
  // 第三维用 t 慢慢推，场就活了
  const angle = field(p.x * s, p.y * s + t * 0.06) * Math.PI * 3
  let vx = Math.cos(angle)
  let vy = Math.sin(angle)

  if (pointer.active) {
    const dx = p.x - pointer.x
    const dy = p.y - pointer.y
    const d2 = dx * dx + dy * dy
    if (d2 < PUSH_RADIUS * PUSH_RADIUS) {
      // 越近推力越强，1/d 衰减
      const d = Math.sqrt(d2) || 1
      const push = (1 - d / PUSH_RADIUS) * 4
      vx += (dx / d) * push
      vy += (dy / d) * push
    }
  }

  const px = p.x
  const py = p.y
  p.x += vx * p.speed * dt * 60
  p.y += vy * p.speed * dt * 60
  p.life -= dt

  if (p.life <= 0 || p.x < 0 || p.x > stage.width || p.y < 0 || p.y > stage.height) {
    respawn(p)
    return
  }

  stage.ctx.strokeStyle = `hsl(${(hue + p.tint) % 360} 90% 62% / 0.5)`
  stage.ctx.lineWidth = p.weight
  stage.ctx.beginPath()
  stage.ctx.moveTo(px, py)
  stage.ctx.lineTo(p.x, p.y)
  stage.ctx.stroke()
}

function respawn(p) {
  p.x = Math.random() * stage.width
  p.y = Math.random() * stage.height
  p.speed = 0.4 + Math.random() * 1.4
  p.weight = 0.4 + Math.random() * 1.1
  p.tint = Math.random() * 70
  p.life = 3 + Math.random() * 7
  return p
}

function resize(n) {
  if (n < particles.length) {
    particles.length = n
  } else {
    while (particles.length < n) particles.push(respawn({}))
  }
}

function reseed() {
  field = fbm(makeNoise2D(Math.floor(Math.random() * 1e9)), 4)
  hue = Math.random() * 360
  clear()
  for (const p of particles) respawn(p)
}

function clear(s = stage) {
  s.ctx.fillStyle = '#08090c'
  s.ctx.fillRect(0, 0, s.width, s.height)
}

/** 把 range 和它的 output 接起来，值变了回调。 */
function bindSlider(id, onInput) {
  const input = document.getElementById(id)
  const out = document.getElementById(`${id}Out`)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = String(v)
    onInput(v)
  })
}
