import { createStage, loop } from '../../src/shared/stage.js'
import { createWall, step, impact, attract, snapshot, restore, reset, destructionPercent } from './physics.js'
import { createPlayer, updatePlayer, throwGrenade, drawPlayer, drawProjectiles } from './arcade.js'

const $ = id => document.getElementById(id)
const host = $('stage')
const W = 1280, H = 720, FLOOR = 690, TAU = Math.PI * 2
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

let source = makeSample()
let sourceIsWebsite = false
let completed = false
let wall, bodies, ball, monster = null, hole = null
let tool = 'gun', mode = 'ready', time = 0, accumulator = 0, shake = 0
let history = [], recordEvery = 1, ticks = 0, rewindTime = 0, rewindDuration = 0, rewindIndex = 0
let particles = [], ripples = [], down = null, sampleIndex = 0, loadId = 0
let loadResumeMode = null
let sound = false, audio = null, lastSound = 0, power = 1, draggingFiles = 0
let view = { scale: 1, x: 0, y: 0 }
let player, firing = false, websiteController = null
const keys = { left: false, right: false, jump: false }
let aim = { x: 500, y: 320 }
const stage = createStage(host, () => { if (bodies) render(0, time) })
const { canvas, ctx } = stage
canvas.tabIndex = 0
canvas.setAttribute('role', 'img')
canvas.setAttribute('aria-label', '网页拆迁关卡。A D 移动，空格跳跃，J 射击，右键手雷，R 倒放。')
canvas.setAttribute('aria-describedby', 'toolHint')

const tools = {
  gun: { name: '冲锋枪', action: '开火', hint: 'A / D 移动 · 空格跳跃，长按飞行 · 按住鼠标或 J 射击 · 右键手雷' },
  grenade: { name: '手雷', action: '扔手雷', hint: '点击目标扔出手雷，稍等片刻，炸开一整片网页。' },
  ball: { name: '摆锤', action: '来一锤', hint: '拖住铁球，拉开后松手。也可以直接点击墙面。' },
  hole: { name: '黑洞', action: '打开黑洞', hint: '按住墙面制造黑洞，拖动它，让碎块跟着打转。' },
  monster: { name: '小怪兽', action: '放出怪兽', hint: '点击想拆的位置。小怪兽会跑过去，狠狠跺一脚。' },
}

function status(text) { $('status').textContent = text }
function projectileBlast(hit) { blast(hit.x, hit.y, hit.radius, hit.power, hit.dx, hit.dy) }
function clearKeys() { keys.left = keys.right = keys.jump = false; firing = false }
function enterGame() { $('welcome').hidden = true; clearKeys(); canvas.focus({ preventScroll: true }) }
function showWelcome() { $('complete').close(); $('welcome').hidden = false; clearKeys(); $('websiteUrl').focus() }
function showCompletion() {
  completed = true; clearKeys(); down = null; ball.dragging = false; shake = 0
  if (hole) hole.held = false
  $('completeSummary').textContent = `${bodies.length} 块全部拆下。要不要让时间倒流，再爽一次？`
  status('拆迁完成！可以倒放复原、换个网站，或者继续玩碎片。')
  $('complete').showModal()
}
function newBall() { return { x: 500, y: -30, length: 530, angle: -0.83, omega: 0, active: false, dragging: false, hits: new Set() } }
function ballPoint() { return { x: ball.x + Math.sin(ball.angle) * ball.length, y: ball.y + Math.cos(ball.angle) * ball.length } }

function buildWall() {
  completed = false; $('complete').close()
  const scale = Math.min((W - 40) / source.width, 610 / source.height)
  const width = sourceIsWebsite ? W - 40 : Math.max(24, source.width * scale)
  const height = Math.max(24, Math.min(610, source.height * width / source.width))
  const columns = Math.max(1, Math.round(width / 30))
  const rows = Math.max(1, Math.min(Math.round(height / 30), Math.floor(720 / columns)))
  wall = { x: (W - width) / 2, y: FLOOR - 18 - height, width, height, columns, rows,
    sourceHeight: Math.min(source.height, source.width * height / width) }
  bodies = createWall(wall)
  player = createPlayer({ width: W, height: H, floor: FLOOR }); firing = false
  ball = newBall(); monster = hole = null
  mode = 'ready'; time = accumulator = shake = ticks = 0
  loadResumeMode = null
  recordEvery = 1; particles = []; ripples = []; down = null
  history = [capture()]
  $('blockCount').textContent = String(bodies.length)
  $('rewind').disabled = true
  $('rewind').textContent = '倒放复原'
  $('attack').disabled = false
  $('damage').textContent = '0%'
  host.dataset.mode = mode
}

function capture() {
  return { time, blocks: snapshot(bodies), ball: { ...ball, hits: undefined },
    monster: monster && { ...monster }, hole: hole && { ...hole }, player: structuredClone(player) }
}

function record() {
  if (++ticks % recordEvery) return
  history.push(capture())
  // ponytail: thin long sessions to bound memory; keep the first frame so rewind always reaches the intact wall.
  if (history.length >= 1200) {
    history = history.filter((_, i) => i % 2 === 0)
    recordEvery *= 2
  }
}

function begin() {
  if (mode === 'rewind' || mode === 'loading' || $('complete').open) return false
  mode = 'running'; host.dataset.mode = mode
  $('rewind').disabled = false
  return true
}

function blast(x, y, radius, strength, dx = 0, dy = -0.35, candidates = bodies) {
  const released = impact(candidates, { x, y, radius, power: strength * power, dx, dy })
  if (candidates.some(b => Math.hypot(b.x - x, b.y - y) < radius)) {
    shake = reducedMotion ? 0 : Math.min(8, shake + 3)
    ripples.push({ x, y, age: 0, radius })
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * TAU, velocity = 80 + Math.random() * 180
      particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 80, age: 0 })
    }
    thump(strength)
  }
  return released
}

function attack(x = W / 2, y = wall.y + wall.height * 0.68) {
  if (!begin()) return
  aim = { x, y }
  if (tool === 'gun') {
    updatePlayer(player, 1 / 60, { keys, aim, width: W, floor: FLOOR, blocks: bodies, fire: true, onBlast: projectileBlast })
    status('按住鼠标持续射击。A / D 移动，空格飞起来。')
  } else if (tool === 'grenade') {
    throwGrenade(player, aim); status('手雷出手。三、二、一…')
  } else if (tool === 'ball') {
    ball = { ...newBall(), x: x + 55, y: y - 505, length: 530, angle: -0.94, active: true }
    monster = hole = null
    status('开拆。碎了也没关系，时间可以倒流。')
  } else if (tool === 'hole') {
    hole = { x, y, age: 0, life: 3.2, held: false }; monster = null; ball.active = false
    status('黑洞已打开，拖住它可以换个位置。')
  } else {
    monster = { x: -90, target: Math.max(100, Math.min(W - 100, x)), age: 0, stomp: 0 }
    hole = null; ball.active = false
    status('小怪兽出勤中。请给它一点发挥空间。')
  }
}

function startRewind() {
  if (mode !== 'running') return
  $('complete').close()
  history.push(capture())
  rewindDuration = Math.max(1.3, Math.min(4.5, time / 2.5))
  rewindTime = 0; rewindIndex = history.length - 2
  particles = []; ripples = []; down = null; firing = false; clearKeys()
  mode = 'rewind'; host.dataset.mode = mode
  $('rewind').disabled = true; $('attack').disabled = true
  $('rewind').textContent = '时间倒流中…'
  status('沿着刚才的轨迹，一块一块回到原位。')
}

function rewind(dt) {
  rewindTime += dt
  const targetTime = Math.max(0, time * (1 - rewindTime / rewindDuration))
  while (rewindIndex > 0 && history[rewindIndex].time > targetTime) rewindIndex--
  const a = history[rewindIndex], b = history[rewindIndex + 1] || a
  const t = Math.max(0, Math.min(1, (targetTime - a.time) / (b.time - a.time || 1)))
  restore(bodies, a.blocks)
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i], offset = i * 7
    body.x += (b.blocks[offset] - body.x) * t
    body.y += (b.blocks[offset + 1] - body.y) * t
    body.angle += (b.blocks[offset + 2] - body.angle) * t
  }
  ball = { ...a.ball, hits: new Set() }
  for (const key of ['x', 'y', 'angle', 'length']) ball[key] += (b.ball[key] - ball[key]) * t
  monster = a.monster && { ...a.monster }; hole = a.hole && { ...a.hole }
  player = structuredClone(a.player)
  if (rewindTime >= rewindDuration) {
    completed = false
    reset(bodies); ball = newBall(); monster = hole = null; player = createPlayer({ width: W, height: H, floor: FLOOR })
    mode = 'ready'; time = accumulator = ticks = 0; recordEvery = 1
    history = [capture()]; host.dataset.mode = mode
    $('rewind').textContent = '倒放复原'; $('attack').disabled = false
    status('完好如初。换一种拆法？')
  }
}

function simulate(dt) {
  time += dt
  updatePlayer(player, dt, { keys, aim, width: W, floor: FLOOR, blocks: bodies, fire: firing && tool === 'gun', onBlast: projectileBlast })
  if (ball.active && !ball.dragging) {
    const before = ballPoint()
    ball.omega -= (1350 / ball.length) * Math.sin(ball.angle) * dt
    ball.omega *= Math.exp(-dt * 0.19)
    ball.angle += ball.omega * dt
    const p = ballPoint(), vx = (p.x - before.x) / dt, speed = Math.abs(ball.omega * ball.length)
    if (speed > 110) {
      const candidates = bodies.filter(b => !ball.hits.has(b.id) && Math.hypot(b.x - p.x, b.y - p.y) < 91)
      if (candidates.length) {
        blast(p.x, p.y, 104, Math.min(900, speed * 0.92), Math.sign(vx) * 0.85, -0.25, candidates)
        candidates.forEach(b => ball.hits.add(b.id))
      }
    }
    if (speed < 3 && Math.abs(ball.angle) < 0.02) ball.active = false
  }
  if (hole) {
    hole.age += dt
    if (!hole.held) hole.life -= dt
    attract(bodies, { x: hole.x, y: hole.y, radius: 360, power: 3400 * power }, dt)
    for (const b of bodies) {
      if (b.anchored) continue
      const dx = hole.x - b.x, dy = hole.y - b.y, distance = Math.hypot(dx, dy)
      if (distance < 340) {
        const force = (1 - distance / 340) * 950 * power * dt / Math.max(30, distance)
        b.vx -= dy * force; b.vy += dx * force - 700 * dt
      }
    }
    if (hole.life <= 0 && !hole.held) hole = null
  }
  if (monster) {
    monster.age += dt
    if (monster.x < monster.target) monster.x = Math.min(monster.target, monster.x + dt * 570)
    else {
      monster.stomp += dt
      if (monster.stomp >= 0.32 && monster.stomp - dt < 0.32) {
        blast(monster.x, FLOOR - 50, 245, 1080, 0.1, -0.95)
        status('拆得很认真。按「倒放复原」让它撤回这一脚。')
      }
      if (monster.stomp > 1.5) monster.x += dt * 440
      if (monster.x > W + 100) monster = null
    }
  }
  step(bodies, dt, { width: W, floor: FLOOR, arcade: true })
  record()
}

function render(dt, elapsed) {
  const portrait = stage.width < 600 && stage.height > stage.width
  view.scale = portrait ? Math.min(stage.height / H, 0.7) : Math.min(stage.width / W, stage.height / H)
  view.x = portrait ? Math.max(stage.width - W * view.scale, Math.min(0, stage.width / 2 - player.x * view.scale)) : (stage.width - W * view.scale) / 2
  view.y = (stage.height - H * view.scale) / 2
  ctx.clearRect(0, 0, stage.width, stage.height)
  ctx.fillStyle = '#17162a'; ctx.fillRect(0, 0, stage.width, stage.height)
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale)
  if (shake > 0.1) ctx.translate(Math.sin(elapsed * 73) * shake, Math.cos(elapsed * 89) * shake * 0.45)
  shake *= Math.exp(-dt * 12)
  drawRoom()
  for (const b of bodies) drawBlock(b)
  drawProjectiles(ctx, player)
  for (const r of ripples) {
    r.age += dt
    ctx.strokeStyle = `rgba(250,251,243,${Math.max(0, 0.65 - r.age * 2)})`
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, r.radius * r.age * 4, 0, TAU); ctx.stroke()
  }
  ripples = ripples.filter(r => r.age < 0.32)
  ctx.fillStyle = '#959b8d'
  for (const p of particles) {
    p.age += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt
    ctx.globalAlpha = Math.max(0, 1 - p.age * 1.6); ctx.fillRect(p.x, p.y, 3, 3)
  }
  ctx.globalAlpha = 1; particles = particles.filter(p => p.age < 0.6)
  if (hole) drawHole()
  if (monster) drawMonster()
  if (tool === 'ball' || ball.active || ball.dragging) drawBall()
  drawPlayer(ctx, player, aim)
  if (mode === 'rewind') {
    ctx.fillStyle = '#ffb958'; ctx.font = '600 15px monospace'; ctx.textAlign = 'center'
    ctx.fillText('时间正在倒流', W / 2, 68)
  }
  ctx.restore()
  const percent = destructionPercent(bodies)
  $('damage').textContent = `${completed && mode !== 'rewind' ? 100 : percent}%`
  if (!completed && percent === 100 && mode === 'running' && $('welcome').hidden) showCompletion()
}

function drawRoom() {
  ctx.fillStyle = '#17162a'; ctx.fillRect(0, 0, W, H)
  // Original pixel skyline, drawn from fixed geometry; no remote art assets.
  const bands = ['#25213d', '#3a2849', '#674051', '#ad655b', '#da9271']
  bands.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(0, 270 + i * 62, W, 80) })
  ctx.fillStyle = '#f1b482'; ctx.fillRect(725, 378, 92, 92)
  for (let layer = 0; layer < 3; layer++) {
    const base = 580 + layer * 45, unit = 56 + layer * 19
    for (let x = -10, i = 0; x < W; x += unit, i++) {
      const height = 50 + ((i * 73 + layer * 43) % 170)
      ctx.fillStyle = ['#51334d', '#29283e', '#111623'][layer]
      ctx.fillRect(x, base - height, unit - 8, H - base + height)
      ctx.fillRect(x + 8, base - height - 12, unit - 25, 12)
      ctx.fillStyle = layer === 2 ? '#345667' : '#a77575'
      for (let row = 0; row < height / 17 - 1; row++) {
        for (let col = 0; col < (unit - 14) / 14; col++) {
          if ((row * 7 + col * 3 + i) % 4) ctx.fillRect(x + 8 + col * 14, base - height + 9 + row * 17, 6, 3)
        }
      }
    }
  }
  ctx.fillStyle = '#0b101a'; ctx.fillRect(0, FLOOR, W, H - FLOOR)
  ctx.fillStyle = '#e28752'; ctx.fillRect(0, FLOOR, W, 2)
}

function drawBlock(b) {
  const width = b.anchored ? b.w + 0.4 : b.w - 1, height = b.anchored ? b.h + 0.4 : b.h - 1
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle)
  ctx.drawImage(source, b.col * source.width / wall.columns, b.row * wall.sourceHeight / wall.rows,
    source.width / wall.columns, wall.sourceHeight / wall.rows, -width / 2, -height / 2, width, height)
  if (!b.anchored) {
    ctx.strokeStyle = '#ffb26770'; ctx.lineWidth = 1; ctx.strokeRect(-width / 2, -height / 2, width, height)
  }
  ctx.restore()
}

function drawBall() {
  const p = ballPoint()
  ctx.strokeStyle = '#4e534a'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(p.x, p.y); ctx.stroke()
  ctx.setLineDash([5, 6]); ctx.strokeStyle = '#bec2b8'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([])
  ctx.save(); ctx.translate(p.x, p.y)
  const metal = ctx.createRadialGradient(-18, -20, 2, 3, 8, 55)
  metal.addColorStop(0, '#747d6f'); metal.addColorStop(0.55, '#3e473a'); metal.addColorStop(1, '#242c21')
  ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill()
  ctx.strokeStyle = '#242c21'; ctx.lineWidth = 2; ctx.stroke()
  ctx.strokeStyle = '#9aa390'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-2, -3, 38, 3.7, 4.9); ctx.stroke()
  ctx.fillStyle = '#efd44b'; ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('拆', 0, 5)
  if (mode === 'ready') {
    ctx.fillStyle = '#535c4b'; ctx.font = '13px sans-serif'; ctx.fillText('拖我，松手', 0, 78)
  }
  ctx.restore()
}

function drawHole() {
  const opening = Math.min(1, hole.age * 4, hole.held ? 1 : hole.life * 3)
  ctx.save(); ctx.translate(hole.x, hole.y); ctx.scale(opening, opening)
  ctx.strokeStyle = '#8170ce'; ctx.lineWidth = 4
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(0, 0, 68 + i * 15, 25 + i * 6, hole.age * 1.5 + i * 0.8, 0, TAU); ctx.stroke()
  }
  ctx.fillStyle = '#292437'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill()
  ctx.strokeStyle = '#b8a4ef'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore()
}

function drawMonster() {
  const walking = monster.x < monster.target || monster.stomp > 1.5
  const hop = walking ? Math.abs(Math.sin(monster.age * 13)) * 14 : Math.sin(Math.min(1, monster.stomp / 0.32) * Math.PI) * 65
  ctx.save(); ctx.translate(monster.x, FLOOR - hop)
  ctx.rotate(walking ? Math.sin(monster.age * 13) * 0.065 : 0)
  ctx.fillStyle = '#516843'; ctx.fillRect(-41, -20, 30, 20); ctx.fillRect(14, -20, 30, 20)
  ctx.fillStyle = '#91ad72'; ctx.beginPath(); ctx.roundRect(-52, -112, 104, 96, [36, 36, 18, 18]); ctx.fill()
  ctx.fillStyle = '#91ad72'; ctx.beginPath(); ctx.moveTo(-39, -99); ctx.lineTo(-31, -143); ctx.lineTo(-9, -109); ctx.fill()
  ctx.beginPath(); ctx.moveTo(16, -111); ctx.lineTo(43, -137); ctx.lineTo(42, -91); ctx.fill()
  ctx.fillStyle = '#f6f6ea'; ctx.beginPath(); ctx.ellipse(-19, -84, 13, 16, 0, 0, TAU); ctx.ellipse(20, -84, 13, 16, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = '#252c22'; ctx.beginPath(); ctx.arc(-15, -81, 5, 0, TAU); ctx.arc(24, -81, 5, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.roundRect(-17, -55, 38, 18, 9); ctx.fill()
  ctx.fillStyle = '#f6f6ea'; ctx.fillRect(-8, -55, 8, 8); ctx.fillRect(7, -55, 8, 8)
  ctx.restore()
}

function makeSample(variant = 0) {
  const image = document.createElement('canvas'); image.width = 1280; image.height = 800
  const c = image.getContext('2d')
  c.fillStyle = '#f8f7ef'; c.fillRect(0, 0, 1280, 800)
  c.fillStyle = '#e9e9df'; c.fillRect(0, 0, 1280, 52)
  for (let i = 0; i < 3; i++) { c.fillStyle = ['#e78269', '#dfbd56', '#92a477'][i]; c.beginPath(); c.arc(27 + i * 23, 26, 6, 0, TAU); c.fill() }
  c.fillStyle = '#747968'; c.font = '16px sans-serif'; c.fillText('a-perfectly-breakable-website.local', 420, 32)
  c.fillStyle = '#222a23'; c.font = '800 27px sans-serif'; c.fillText('off-duty®', 55, 113)
  c.font = '18px sans-serif'; c.fillText('好好生活', 860, 110); c.fillText('偶尔搞砸', 1008, 110)
  c.strokeStyle = '#252720'; c.lineWidth = 2; c.beginPath(); c.moveTo(55, 143); c.lineTo(1225, 143); c.stroke()
  c.fillStyle = variant % 2 ? '#cbdab0' : '#ef8159'; c.fillRect(55, 180, 1170, 500)
  c.fillStyle = '#202c25'; c.font = '900 116px sans-serif'
  const words = variant % 2 ? ['TOO MANY', 'OPEN TABS.'] : ['MAKE A', 'LITTLE MESS.']
  c.fillText(words[0], 89, 326); c.fillText(words[1], 89, 453)
  c.font = '26px sans-serif'; c.fillText(variant % 2 ? '有些页面，关掉不如砸掉。' : '今天，允许一切不那么井井有条。', 96, 531)
  c.fillStyle = '#f8f7ef'; c.fillRect(96, 576, 245, 60)
  c.fillStyle = '#252720'; c.font = '700 22px sans-serif'; c.fillText('从这一页开始  →', 118, 615)
  c.strokeStyle = '#202c25'; c.lineWidth = 11
  c.save(); c.translate(1090, 572); c.rotate(-0.2)
  c.strokeRect(-61, -62, 112, 112); c.strokeRect(-93, -94, 112, 112)
  for (const [x, y] of [[-93, -94], [19, -94], [-93, 18], [19, 18]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 32, y + 32); c.stroke() }
  c.restore()
  c.fillStyle = '#545e4f'; c.font = '19px sans-serif'
  c.fillText('一个专门用来拆掉的示例网页', 55, 741)
  c.textAlign = 'right'; c.fillText('NO DEADLINES TODAY.', 1225, 741)
  return image
}

function point(event) {
  const rect = canvas.getBoundingClientRect()
  return { x: (event.clientX - rect.left - view.x) / view.scale, y: (event.clientY - rect.top - view.y) / view.scale }
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || mode === 'rewind' || mode === 'loading') return
  const p = point(event); down = p
  aim = p
  canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId)
  if (tool === 'gun') { attack(p.x, p.y); firing = true }
  else if (tool === 'ball' && Math.hypot(p.x - ballPoint().x, p.y - ballPoint().y) < 85) {
    ball.dragging = true; ball.active = false; ball.omega = 0
    monster = hole = null
    status('拉开一点，再松手。')
  } else if (tool === 'hole') {
    if (!begin()) return
    hole = { ...p, age: 0, life: 1.6, held: true }; monster = null; ball.active = false
  }
})
canvas.addEventListener('pointermove', event => {
  const p = point(event); aim = p
  if (!down) return
  if (ball.dragging) ball.angle = Math.max(-1.4, Math.min(1.4, Math.atan2(p.x - ball.x, p.y - ball.y)))
  if (hole?.held) { hole.x = p.x; hole.y = p.y }
})
function releasePointer(event) {
  firing = false
  if (!down) return
  if (event.type === 'pointercancel') {
    ball.dragging = false; if (hole) hole.held = false; down = null; return
  }
  if (ball.dragging) {
    begin(); ball.dragging = false; ball.active = true; ball.hits.clear()
    status('这一锤，交给重力。')
  } else if (hole?.held) { hole.held = false }
  else if (tool !== 'gun') { const p = point(event); if (Math.hypot(p.x - down.x, p.y - down.y) < 24) attack(p.x, p.y) }
  down = null
}
canvas.addEventListener('pointerup', releasePointer)
canvas.addEventListener('pointercancel', releasePointer)
canvas.addEventListener('lostpointercapture', () => { if (hole) hole.held = false; ball.dragging = false; down = null; firing = false })
canvas.addEventListener('contextmenu', event => {
  event.preventDefault(); if (!begin()) return
  aim = point(event); throwGrenade(player, aim)
})
window.addEventListener('keydown', event => {
  if ($('complete').open) return
  if (event.target.matches('input, textarea, button, a, select') || !$('welcome').hidden) {
    if (event.key === 'Escape') enterGame()
    return
  }
  const key = event.key.toLowerCase()
  if (['a', 'd', 'w', 'j', 'arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) {
    event.preventDefault(); if (!begin()) return
    if (key === 'a' || key === 'arrowleft') keys.left = true
    if (key === 'd' || key === 'arrowright') keys.right = true
    if ([' ', 'w', 'arrowup'].includes(key)) keys.jump = true
    if (key === 'j') firing = true
  }
  if (key === 'r') startRewind()
  if (key === 'escape') showWelcome()
})
window.addEventListener('keyup', event => {
  const key = event.key.toLowerCase()
  if (key === 'a' || key === 'arrowleft') keys.left = false
  if (key === 'd' || key === 'arrowright') keys.right = false
  if ([' ', 'w', 'arrowup'].includes(key)) keys.jump = false
  if (key === 'j') firing = false
})
window.addEventListener('blur', clearKeys)
document.addEventListener('visibilitychange', clearKeys)

for (const button of document.querySelectorAll('[data-tool]')) button.addEventListener('click', () => {
  if (mode === 'rewind' || mode === 'loading') return
  tool = button.dataset.tool; firing = false
  document.querySelectorAll('[data-tool]').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
  $('toolHint').textContent = tools[tool].hint; $('attack').textContent = tools[tool].action
  if (hole) hole.held = false
  if ($('welcome').hidden) canvas.focus({ preventScroll: true })
})
$('attack').addEventListener('click', () => attack())
$('rewind').addEventListener('click', startRewind)
$('completeRewind').addEventListener('click', startRewind)
$('completeNext').addEventListener('click', showWelcome)
$('completeContinue').addEventListener('click', () => $('complete').close())
$('complete').addEventListener('close', () => {
  if ($('welcome').hidden && mode !== 'loading') canvas.focus({ preventScroll: true })
})
$('reset').addEventListener('click', () => { if (mode === 'loading') return; buildWall(); status('重新砌好了。随时开拆。') })
$('sample').addEventListener('click', () => {
  cancelWebsite()
  $('urlStatus').textContent = ''
  loadId++; source = makeSample(++sampleIndex); sourceIsWebsite = false; buildWall(); $('filename').textContent = '示例网页.png'
  $('upload').disabled = false; status('换了一张示例网页。放心砸。')
})
$('playSample').addEventListener('click', () => { $('sample').click(); enterGame() })
$('newWebsite').addEventListener('click', showWelcome)
$('closeWelcome').addEventListener('click', enterGame)
$('urlForm').addEventListener('submit', event => { event.preventDefault(); loadWebsite($('websiteUrl').value) })
for (const button of document.querySelectorAll('[data-website]')) button.addEventListener('click', () => {
  $('websiteUrl').value = button.dataset.website; loadWebsite(button.dataset.website)
})
for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); if (!begin()) return
    button.setPointerCapture(event.pointerId)
    if (control === 'fire') { if (tool === 'gun') firing = true; else attack(aim.x, aim.y) }
    else keys[control] = true
  })
  const release = () => { if (control === 'fire') firing = false; else keys[control] = false }
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release)
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); event.stopPropagation(); if (control === 'fire') attack(); else if (begin()) keys[control] = true } })
  button.addEventListener('keyup', release)
}
$('power').addEventListener('input', event => { power = Number(event.target.value) / 100; $('powerValue').textContent = `${Math.round(power * 100)}%` })
$('upload').addEventListener('click', () => $('file').click())
$('file').addEventListener('change', event => { if (event.target.files[0]) loadFile(event.target.files[0]); event.target.value = '' })
$('save').addEventListener('click', () => {
  canvas.toBlob(blob => {
    if (!blob) { status('保存失败，请再试一次。'); return }
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = '网页拆迁办-现场.png'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    status('现场已保存。')
  }, 'image/png')
})

function cancelWebsite() {
  websiteController?.abort(); websiteController = null
  $('loadWebsite').disabled = false; $('loadWebsite').textContent = '开始拆迁 →'
}

async function loadWebsite(value) {
  const raw = value.trim()
  let url
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (!raw || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
  } catch { $('urlStatus').textContent = '请输入公开网址，例如 wikipedia.org。'; return }
  cancelWebsite()
  const controller = new AbortController(); websiteController = controller
  const id = ++loadId, previousMode = mode === 'loading' ? loadResumeMode : mode
  loadResumeMode = previousMode; mode = 'loading'; clearKeys()
  $('loadWebsite').disabled = true; $('loadWebsite').textContent = '正在加载…'
  $('attack').disabled = $('rewind').disabled = true
  $('urlStatus').textContent = '正在生成网页截图，通常需要 5–30 秒。也可以先玩示例。'
  status(`正在载入 ${url.hostname}…`)
  try {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname)
    const endpoint = local ? `/api/demolition/capture?url=${encodeURIComponent(url.href)}`
      : `https://image.thum.io/get/noanimate/width/1280/crop/800/${url.href}`
    const response = await fetch(endpoint, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]) })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error || '网址加载失败，请上传截图或稍后重试。')
    }
    const blob = await response.blob()
    if (id !== loadId) return
    websiteController = null
    $('urlStatus').textContent = ''
    await loadFile(new File([blob], url.hostname, { type: blob.type }), true)
  } catch (error) {
    if (id !== loadId || controller.signal.aborted) return
    mode = previousMode; host.dataset.mode = mode
    $('upload').disabled = false
    $('attack').disabled = mode === 'rewind'; $('rewind').disabled = mode !== 'running'
    const message = error instanceof TypeError ? '网络连接中断，请重试或上传截图。' : error.message
    $('urlStatus').textContent = message; status(message)
  } finally {
    if (websiteController === controller || id === loadId) cancelWebsite()
  }
}

async function loadFile(file, website = false) {
  if (!/^image\/(png|jpeg|webp|avif|gif|bmp)$/.test(file.type)) {
    status('请选择 PNG、JPG、WebP、AVIF、GIF 或 BMP 图片。'); return
  }
  if (file.size > 25 * 1024 * 1024) { status('图片超过 25 MB，请缩小后再拖进来。'); return }
  cancelWebsite()
  $('urlStatus').textContent = ''
  const id = ++loadId, previousMode = mode === 'loading' ? loadResumeMode : mode
  loadResumeMode = previousMode
  mode = 'loading'; $('upload').disabled = true; $('attack').disabled = true; $('rewind').disabled = true
  status('正在把图片砌成积木墙…')
  const url = URL.createObjectURL(file), image = new Image()
  try {
    image.src = url; await image.decode()
    if (id !== loadId) return
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 80000000) throw new Error('size')
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight))
    const next = document.createElement('canvas')
    next.width = Math.max(1, Math.round(image.naturalWidth * scale)); next.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = next.getContext('2d'); context.fillStyle = '#f8f8f1'; context.fillRect(0, 0, next.width, next.height)
    context.drawImage(image, 0, 0, next.width, next.height)
    source = next; sourceIsWebsite = website; buildWall(); $('filename').textContent = file.name
    enterGame(); status('页面已就位。按住鼠标开火，空格飞起来。')
  } catch {
    if (id !== loadId) return
    mode = previousMode; host.dataset.mode = mode
    $('attack').disabled = mode === 'rewind'; $('rewind').disabled = mode !== 'running'
    status('这张图片读不了或尺寸过大，请换一张。原来的墙还在。')
  } finally { URL.revokeObjectURL(url); if (id === loadId) $('upload').disabled = false }
}

window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() })
window.addEventListener('drop', event => {
  if (!event.dataTransfer.types.includes('Files')) return
  event.preventDefault(); draggingFiles = 0; $('dropHint').hidden = true
  const file = event.dataTransfer.files[0]; if (file) loadFile(file)
})
host.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('Files')) { draggingFiles++; $('dropHint').hidden = false } })
host.addEventListener('dragleave', () => { if (--draggingFiles <= 0) { draggingFiles = 0; $('dropHint').hidden = true } })
window.addEventListener('paste', event => {
  const file = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile()
  if (file) { event.preventDefault(); loadFile(file) }
})

$('sound').addEventListener('click', async () => {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)()
    await audio.resume(); sound = !sound
    $('sound').setAttribute('aria-pressed', String(sound)); $('sound').textContent = sound ? '声音：开' : '声音：关'
  } catch { status('这个浏览器暂时无法播放声音，仍然可以正常玩。') }
})
function thump(strength) {
  if (!sound || !audio || audio.currentTime - lastSound < 0.09) return
  lastSound = audio.currentTime
  const oscillator = audio.createOscillator(), gain = audio.createGain()
  oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(110, lastSound)
  oscillator.frequency.exponentialRampToValueAtTime(38, lastSound + 0.13)
  gain.gain.setValueAtTime(Math.min(0.16, strength / 7000), lastSound)
  gain.gain.exponentialRampToValueAtTime(0.001, lastSound + 0.16)
  oscillator.connect(gain); gain.connect(audio.destination)
  oscillator.start(); oscillator.stop(lastSound + 0.17)
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
}

buildWall()
$('toolHint').textContent = tools[tool].hint
$('attack').textContent = tools[tool].action
loop((dt, elapsed) => {
  const paused = $('complete').open || !$('welcome').hidden
  if (mode === 'running' && !paused) {
    accumulator += dt
    while (accumulator >= 1 / 60) { simulate(1 / 60); accumulator -= 1 / 60 }
  } else if (mode === 'rewind' && !paused) rewind(dt)
  render(paused ? 0 : dt, elapsed)
})
