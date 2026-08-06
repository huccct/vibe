import { createStage, loop } from '../../src/shared/stage.js'
import { applyLangAttr, getLang, mountLangToggle } from '../../src/shared/i18n.js'
import { stepBody } from './physics.js'

const UI = {
  zh: {
    pageTitle: '重力书法 — vibe', title: '重力书法', gravity: '重力', wind: '风', clear: '清空',
    idle: '在纸上写一笔，松手看它掉下来', drawing: '墨还在笔下', falling: '这一笔交给重力了',
  },
  en: {
    pageTitle: 'Gravity Calligraphy — vibe', title: 'Gravity Calligraphy', gravity: 'gravity', wind: 'wind', clear: 'clear',
    idle: 'Draw a stroke, then release it to gravity', drawing: 'The ink is still under your hand', falling: 'Gravity has this stroke now',
  },
}

const host = document.getElementById('stage')
const hint = document.getElementById('hint')
const gravityInput = document.getElementById('gravity')
const windInput = document.getElementById('wind')
const bodies = []
let drawing = null
let message = 'idle'

const stage = createStage(host)
stage.canvas.setAttribute('aria-label', 'Gravity calligraphy canvas')

applyLangAttr()
mountLangToggle(document.getElementById('lang'), paintUI)
paintUI()

document.getElementById('clear').addEventListener('click', () => {
  bodies.length = 0
  drawing = null
  say('idle')
})

stage.canvas.addEventListener('pointerdown', (event) => {
  const p = pointer(event)
  drawing = [{ ...p, width: 14, time: performance.now() }]
  stage.canvas.setPointerCapture(event.pointerId)
  say('drawing')
})

stage.canvas.addEventListener('pointermove', (event) => {
  if (!drawing) return
  const p = pointer(event)
  const prev = drawing[drawing.length - 1]
  const distance = Math.hypot(p.x - prev.x, p.y - prev.y)
  if (distance < 2) return
  const elapsed = Math.max(1, performance.now() - prev.time)
  const speed = distance / elapsed
  drawing.push({ ...p, width: Math.max(4, Math.min(20, 20 - speed * 18)), time: performance.now() })
})

const release = () => {
  if (!drawing) return
  if (drawing.length === 1) drawing.push({ ...drawing[0], x: drawing[0].x + 0.1 })

  const x = drawing.reduce((sum, p) => sum + p.x, 0) / drawing.length
  const y = drawing.reduce((sum, p) => sum + p.y, 0) / drawing.length
  bodies.push({
    points: drawing.map((p) => ({ x: p.x - x, y: p.y - y, width: p.width })),
    x, y, vx: 0, vy: 0, angle: 0, va: (Math.random() - 0.5) * 0.35, sleeping: false,
  })
  drawing = null
  say('falling')
}

stage.canvas.addEventListener('pointerup', release)
stage.canvas.addEventListener('pointercancel', release)

loop((dt) => {
  const gravity = Number(gravityInput.value)
  const wind = Number(windInput.value)
  const floor = stage.height - 18

  for (const body of bodies) stepBody(body, dt, gravity, wind, floor)

  const { ctx, width, height } = stage
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(31, 23, 20, 0.92)'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const body of bodies) {
    ctx.save()
    ctx.translate(body.x, body.y)
    ctx.rotate(body.angle)
    drawStroke(ctx, body.points)
    ctx.restore()
  }
  if (drawing) drawStroke(ctx, drawing)
})

function drawStroke(ctx, points) {
  if (points.length < 2) return
  ctx.shadowColor = 'rgba(20, 12, 8, 0.2)'
  ctx.shadowBlur = 1.5
  for (let i = 1; i < points.length; i++) {
    ctx.lineWidth = (points[i - 1].width + points[i].width) / 2
    ctx.beginPath()
    ctx.moveTo(points[i - 1].x, points[i - 1].y)
    ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

function pointer(event) {
  const rect = stage.canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function say(key) {
  message = key
  hint.textContent = UI[getLang()][key]
}

function paintUI() {
  const t = UI[getLang()]
  document.title = t.pageTitle
  document.getElementById('title').textContent = t.title
  document.getElementById('gravityLabel').textContent = t.gravity
  document.getElementById('windLabel').textContent = t.wind
  document.getElementById('clear').textContent = t.clear
  hint.textContent = t[message]
}
