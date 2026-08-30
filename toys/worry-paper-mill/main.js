import { paperBits, processingGrade, punchPattern, recordCode } from './paper.js'

const stage = document.getElementById('stage')
const intake = document.getElementById('intake')
const worry = document.getElementById('worry')
const phaseEl = document.getElementById('phase')
const statusEl = document.getElementById('status')
const hint = document.getElementById('hint')
const lamp = document.getElementById('lamp')
const feedbackEl = document.getElementById('arcade-feedback')
const doneActions = document.getElementById('done-actions')
const steps = [...document.querySelectorAll('.routing li')]
const order = ['shred', 'pulp', 'press', 'release']
const TAU = Math.PI * 2
const W = 432
const H = 270
const zones = {
  shred: { x: 57, y: 83, width: 80, height: 112 },
  pulp: { x: 151, y: 132, width: 108, height: 68 },
  press: { x: 298, y: 99, width: 48, height: 35 },
  release: { x: 298, y: 160, width: 123, height: 50 },
}
const palette = {
  night: '#0e1613', wall: '#18251f', seam: '#26382f', floor: '#121a17',
  archive: '#465a50', archiveDark: '#26352f', paper: '#d8c99b', paperLight: '#eee3bd',
  stamp: '#a33b32', lamp: '#d88a3d', ink: '#202523', steel: '#8b958e', steelDark: '#4e5b54',
  water: '#315d56', wood: '#654737', rail: '#78694c',
}
const gradeLabels = { S: '夜班王牌', A: '手感很稳', B: '勉强合格', C: '机器说算了' }

const canvas = document.createElement('canvas')
const context = canvas.getContext('2d', { alpha: false })
canvas.tabIndex = 0
canvas.setAttribute('role', 'img')
canvas.setAttribute('aria-label', '夜间情绪数据科等待受理')
stage.prepend(canvas)

let view = { scale: 1, x: 0, y: 0 }
let state = 'idle'
let progress = 0
let locked = false
let action = null
let pointerPrevious = null
let stirAngle = -1.2
let stirTravel = 0
let stirCombo = 0
let releaseOrigin = null
let pressHeld = false
let scanPosition = 0
let punchHits = 0
let quality = 100
let grade = 'S'
let shake = 0
let particles = []
let bits = paperBits('empty')
let pattern = punchPattern('empty')
let record = '00000000'
let audio = null
let transitionTimer = null
let feedbackTimer = null
let previousFrame = 0

intake.addEventListener('submit', start)
document.getElementById('again').addEventListener('click', reset)
document.getElementById('download').addEventListener('click', downloadReceipt)
canvas.addEventListener('pointerdown', pointerDown)
canvas.addEventListener('pointermove', pointerMove)
canvas.addEventListener('pointerup', pointerUp)
canvas.addEventListener('pointercancel', pointerUp)
canvas.addEventListener('keydown', keyDown)
canvas.addEventListener('keyup', keyUp)
addEventListener('resize', resize)
resize()
setState('idle')
requestAnimationFrame(animate)

function resize() {
  canvas.width = Math.max(260, Math.ceil(stage.clientWidth / 3))
  canvas.height = Math.max(220, Math.ceil(stage.clientHeight / 3))
  context.imageSmoothingEnabled = false
  const scale = Math.min(canvas.width / W, canvas.height / H)
  view = {
    scale,
    x: Math.floor((canvas.width - W * scale) / 2),
    y: Math.floor((canvas.height - H * scale) / 2),
  }
}

function start(event) {
  event.preventDefault()
  const text = worry.value.trim()
  if (!text) return worry.focus()
  initAudio()
  bits = paperBits(text)
  pattern = punchPattern(text)
  record = recordCode(text)
  punchHits = 0
  stirTravel = 0
  stirCombo = 0
  quality = 100
  grade = 'S'
  feedbackEl.hidden = true
  particles = []
  intake.classList.add('hidden')
  intake.inert = true
  doneActions.hidden = true
  tone(118, .08, .05)
  tone(82, .13, .04, .08)
  setState('shred')
  canvas.focus()
}

function reset() {
  clearTimeout(transitionTimer)
  transitionTimer = null
  locked = false
  action = null
  pressHeld = false
  clearTimeout(feedbackTimer)
  feedbackEl.hidden = true
  particles = []
  worry.value = ''
  intake.classList.remove('hidden')
  intake.inert = false
  doneActions.hidden = true
  setState('idle')
  setTimeout(() => worry.focus(), 60)
}

function setState(next) {
  state = next
  progress = 0
  action = null
  pressHeld = false
  locked = false
  const active = order.indexOf(state)
  steps.forEach((step, index) => {
    step.className = state === 'done' || index < active ? 'passed' : index === active ? 'active' : ''
  })

  const copy = {
    idle: ['等待受理', '请填写一份情绪材料登记单', '填写登记单后盖章受理'],
    shred: ['01 · 时机打孔', `记录 09-${record} · 等扫描线经过红色基准`, '扫描灯线压过红色短线时，点击纸卡 · 键盘：空格'],
    pulp: ['02 · 旋流连击', '绕纸浆槽连续画三圈，点亮整圈指示灯', '按住纸浆槽连续画圈 · 键盘：← →'],
    press: ['03 · 压力锁定', '按住红色压力键，在橙色甜区松手', '压力进入橙色甜区时松手 · 键盘：按住空格'],
    release: ['04 · 回执出库', '抓住成纸，沿卡槽向右拖出', '抓住右侧成纸向右拖 · 键盘：→'],
    done: ['处理完毕', `记录 09-${record} 已转换为纸质回执`, '回执已打印 · 可撕下保存'],
  }[state]
  phaseEl.textContent = copy[0]
  statusEl.textContent = copy[1]
  hint.textContent = copy[2]
  lamp.classList.toggle('on', state !== 'idle')
  canvas.setAttribute('aria-label', `${copy[0]}。${copy[2]}`)
  if (state === 'pulp') worry.value = ''
  if (state === 'done') {
    grade = processingGrade(quality)
    statusEl.textContent = `记录 09-${record} · 处理精度 ${grade}「${gradeLabels[grade]}」`
    doneActions.hidden = false
    tone(392, .22, .04)
    tone(523, .28, .035, .12)
  }
}

function completeStep() {
  if (locked) return
  locked = true
  progress = 1
  action = null
  pressHeld = false
  tone(state === 'press' ? 54 : 112, state === 'press' ? .24 : .08, .05)
  const next = order[order.indexOf(state) + 1] || 'done'
  transitionTimer = setTimeout(() => setState(next), 220)
}

function setFeedback(text, color = palette.lamp, rough = false, badge = 'OK') {
  clearTimeout(feedbackTimer)
  feedbackEl.textContent = badge
  feedbackEl.classList.toggle('error', color === palette.stamp)
  feedbackEl.hidden = false
  feedbackTimer = setTimeout(() => { feedbackEl.hidden = true }, 850)
  shake = rough ? .9 : .35
  statusEl.textContent = text
}

function burst(x, y, color, count = 10) {
  for (let index = 0; index < count; index++) {
    const angle = index / count * TAU
    particles.push({ x, y, dx: Math.cos(angle) * (12 + index % 4 * 4), dy: Math.sin(angle) * (9 + index % 3 * 3), life: 1, color })
  }
}

function attemptPunch() {
  const targets = [.2, .5, .8]
  const target = targets[punchHits]
  const error = Math.abs(scanPosition - target)
  if (error <= .095) {
    punchHits++
    progress = punchHits / targets.length
    quality -= Math.round(error * 28)
    setFeedback(error < .035 ? `精准！打孔 ${punchHits}/3` : `命中 · 打孔 ${punchHits}/3`, palette.lamp, false, error < .035 ? 'PERFECT' : `HIT ${punchHits}/3`)
    burst(96, 91 + target * 60, palette.lamp, 12)
    tone(190 + punchHits * 74, .09, .045)
    if (punchHits === targets.length) completeStep()
    return
  }
  quality -= 5
  setFeedback(scanPosition < target ? '早了一格，等它再靠近' : '晚了一格，下一轮截住它', palette.stamp, true, scanPosition < target ? 'EARLY' : 'LATE')
  tone(68, .11, .04)
}

function advanceStir(amount) {
  stirTravel += amount
  progress = Math.min(1, stirTravel / (TAU * 3))
  const nextCombo = Math.min(3, Math.floor(stirTravel / TAU))
  if (nextCombo > stirCombo) {
    stirCombo = nextCombo
    setFeedback(`旋流连击 × ${stirCombo}`, palette.lamp, false, `COMBO x${stirCombo}`)
    burst(205, 158, stirCombo === 3 ? palette.lamp : palette.paper, 8 + stirCombo * 3)
    tone(160 + stirCombo * 92, .08, .04)
  }
  if (stirCombo === 3) completeStep()
}

function lockPressure() {
  const low = .66
  const high = .82
  pressHeld = false
  if (progress >= low && progress <= high) {
    quality -= Math.round(Math.abs(progress - .74) * 35)
    setFeedback(Math.abs(progress - .74) < .035 ? '完美锁压！' : '压力锁定', palette.lamp, false, Math.abs(progress - .74) < .035 ? 'PERFECT' : 'LOCKED')
    burst(320, 155, palette.lamp, 16)
    completeStep()
    return
  }
  if (progress < low) {
    quality -= 2
    setFeedback('压力还不够，再压一下', palette.paper, false, 'LOW')
    return
  }
  quality -= 8
  progress = .24
  setFeedback('过压！安全阀已泄压', palette.stamp, true, 'OVERLOAD')
  burst(320, 104, palette.stamp, 12)
  tone(52, .18, .05)
}

function scenePoint(event) {
  const bounds = canvas.getBoundingClientRect()
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height
  return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale }
}

function contains(zone, point) {
  return point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height
}

function pointerDown(event) {
  if (locked || state === 'idle' || state === 'done') return
  const point = scenePoint(event)
  if (!contains(zones[state], point)) {
    hint.textContent = {
      shred: '点击左侧露出的登记卡', pulp: '操作中间的蓝绿色纸浆槽',
      press: '按住压机上的红色方键', release: '抓住压机右侧露出的纸',
    }[state]
    return
  }

  if (state === 'shred') {
    attemptPunch()
    return
  }
  action = state
  pointerPrevious = point
  if (state === 'pulp') stirAngle = Math.atan2(point.y - 164, point.x - 205)
  if (state === 'press') {
    pressHeld = true
  }
  if (state === 'release') releaseOrigin = { x: point.x, progress }
  canvas.setPointerCapture(event.pointerId)
}

function pointerMove(event) {
  if (!action || locked) return
  const point = scenePoint(event)

  if (action === 'pulp') {
    const angle = Math.atan2(point.y - 164, point.x - 205)
    let delta = angle - stirAngle
    if (delta > Math.PI) delta -= TAU
    if (delta < -Math.PI) delta += TAU
    advanceStir(Math.abs(delta))
    stirAngle = angle
  }

  if (action === 'release') {
    progress = Math.max(releaseOrigin.progress, Math.min(1, releaseOrigin.progress + (point.x - releaseOrigin.x) / 72))
  }

  pointerPrevious = point
  if (progress >= 1) completeStep()
}

function pointerUp(event) {
  if (state === 'press' && pressHeld && !locked) lockPressure()
  action = null
  pressHeld = false
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
}

function keyDown(event) {
  if (locked || state === 'idle' || state === 'done') return
  const accepted = [' ', 'Enter', 'ArrowLeft', 'ArrowRight']
  if (!accepted.includes(event.key)) return
  event.preventDefault()

  if (state === 'shred' && [' ', 'Enter'].includes(event.key)) attemptPunch()
  if (state === 'pulp') advanceStir(Math.PI / 4)
  if (state === 'press' && event.key === ' ') pressHeld = true
  if (state === 'press' && event.key === 'ArrowRight') progress = Math.min(1, progress + .1)
  if (state === 'press' && event.key === 'Enter') lockPressure()
  if (state === 'release') progress = Math.min(1, progress + .16)
  if (progress >= 1) completeStep()
}

function keyUp(event) {
  if (state === 'press' && event.key === ' ' && pressHeld && !locked) lockPressure()
}

function animate(time) {
  const delta = previousFrame ? Math.min(40, time - previousFrame) : 16
  previousFrame = time
  scanPosition = (time / 1000 * .72) % 2
  if (scanPosition > 1) scanPosition = 2 - scanPosition
  if (state === 'press' && pressHeld && !locked) {
    progress = Math.min(1, progress + delta / 1250)
    if (progress >= 1) lockPressure()
  }
  particles.forEach((particle) => {
    particle.x += particle.dx * delta / 1000
    particle.y += particle.dy * delta / 1000
    particle.dy += 22 * delta / 1000
    particle.life -= delta / 700
  })
  particles = particles.filter((particle) => particle.life > 0)
  shake = Math.max(0, shake - delta / 180)
  draw(time / 1000)
  requestAnimationFrame(animate)
}

function draw(time) {
  context.fillStyle = palette.night
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.save()
  const shakeX = shake ? Math.round(Math.sin(time * 86) * shake * 2) : 0
  const shakeY = shake ? Math.round(Math.cos(time * 71) * shake) : 0
  context.translate(view.x + shakeX, view.y + shakeY)
  context.scale(view.scale, view.scale)
  drawBureau(time)
  context.restore()
}

function drawBureau(time) {
  rect(0, 0, W, 217, palette.wall)
  for (let x = 0; x < W; x += 32) rect(x, 0, 2, 217, palette.seam)
  for (let y = 24; y < 217; y += 32) rect(0, y, W, 1, '#1f3029')
  rect(0, 217, W, 53, palette.floor)
  for (let x = -20; x < W; x += 34) line(x, 270, x + 44, 217, '#233129')

  drawCabinet()
  drawDeskDetails()
  drawRail()
  drawShredder()
  drawPulper(time)
  drawPress()
  drawOutput()
  drawParticles()
}

function drawCabinet() {
  rect(11, 97, 34, 109, palette.archiveDark)
  rect(14, 101, 28, 31, palette.archive)
  rect(14, 136, 28, 31, palette.archive)
  rect(14, 171, 28, 31, palette.archive)
  for (const y of [112, 147, 182]) {
    rect(22, y, 12, 3, palette.steelDark)
    rect(26, y + 6, 4, 2, palette.paper)
  }
}

function drawDeskDetails() {
  rect(46, 205, 367, 10, palette.wood)
  rect(53, 215, 9, 36, '#3d3128')
  rect(392, 215, 9, 36, '#3d3128')
  rect(74, 235, 306, 6, '#3d3128')
  rect(374, 92, 19, 24, '#34473f')
  rect(377, 89, 13, 5, palette.paper)
  rect(392, 99, 8, 4, palette.steel)
  rect(369, 119, 30, 2, '#2c3b34')
}

function drawRail() {
  rect(52, 194, 352, 7, '#272d29')
  for (let x = 58; x < 400; x += 15) rect(x, 196, 8, 3, palette.rail)
  line(135, 186, 151, 186, palette.steelDark, 3)
  line(259, 186, 276, 186, palette.steelDark, 3)
  line(358, 186, 375, 186, palette.steelDark, 3)
}

function drawShredder() {
  rect(53, 145, 86, 49, palette.archiveDark)
  rect(58, 150, 76, 38, palette.archive)
  rect(65, 154, 62, 7, palette.ink)
  for (let x = 68; x < 125; x += 9) rect(x, 157, 5, 3, palette.steel)
  rect(61, 185, 70, 5, '#1e2a25')
  pixelText('01 CARD', 68, 177, palette.paper, 6)

  if (state !== 'shred') return
  const targets = [.2, .5, .8]
  rect(70, 82, 52, 72, palette.paper)
  rect(74, 87, 44, 4, palette.stamp)
  for (let index = 0; index < targets.length; index++) {
    const y = 92 + targets[index] * 54
    const current = index === punchHits
    rect(72, y, current ? 10 : 6, 2, index < punchHits ? palette.ink : current ? palette.stamp : palette.steel)
    if (index < punchHits) rect(91 + index * 7, y - 2, 5, 5, palette.ink)
  }
  const scannerY = 92 + scanPosition * 54
  rect(68, scannerY, 56, 2, palette.lamp)
  rect(66, scannerY - 2, 3, 6, palette.lamp)
  pixelText(`${punchHits}/3`, 102, 137, palette.ink, 5)
  pixelText(record.slice(0, 6), 75, 146, palette.ink, 4)
}

function drawPulper(time) {
  rect(147, 145, 116, 48, palette.archiveDark)
  rect(153, 137, 104, 45, palette.archive)
  rect(159, 145, 92, 27, '#193c36')
  rect(163, 149, 84, 19, palette.water)
  rect(187, 105, 37, 34, palette.archiveDark)
  rect(191, 110, 29, 8, palette.ink)
  for (let x = 194; x < 218; x += 7) rect(x, 112, 3, 3, palette.lamp)
  pixelText('02 PULP', 177, 178, palette.paper, 6)
  for (let index = 0; index < 8; index++) {
    const angle = index / 8 * TAU
    const activeLamp = state === 'pulp' && index === Math.round((stirAngle + Math.PI) / TAU * 8) % 8
    rect(205 + Math.cos(angle) * 48 - 2, 158 + Math.sin(angle) * 27 - 2, 4, 4, activeLamp ? palette.lamp : palette.steelDark)
  }

  const active = state === 'pulp'
  if (active || order.indexOf(state) > 1 || state === 'done') {
    bits.slice(0, 60).forEach((bit, index) => {
      const speed = active ? time * (1.2 + bit.width) + progress * 6 : bit.angle
      const radius = 8 + bit.x * 34
      rect(205 + Math.cos(bit.angle + speed) * radius, 158 + Math.sin(bit.angle + speed) * 7, 2, 1, index % 3 ? palette.paper : palette.stamp)
    })
  }
  const handleAngle = active ? stirAngle : -1.2
  line(205, 157, 205 + Math.cos(handleAngle) * 42, 157 + Math.sin(handleAngle) * 34, palette.steel, 4)
  rect(200 + Math.cos(handleAngle) * 42, 153 + Math.sin(handleAngle) * 34, 10, 7, palette.wood)
  if (active) pixelText(`COMBO x${stirCombo}`, 183, 128, stirCombo ? palette.lamp : palette.steel, 5)
}

function drawPress() {
  rect(276, 183, 88, 10, palette.steelDark)
  rect(281, 101, 9, 82, palette.steelDark)
  rect(350, 101, 9, 82, palette.steelDark)
  rect(276, 95, 88, 12, palette.archiveDark)
  rect(311, 78, 14, 18, palette.steel)
  rect(298, 108, 48, 27, '#34211f')
  rect(304, 111 + (pressHeld ? 4 : 0), 36, 17, palette.stamp)
  pixelText('HOLD', 311, 116 + (pressHeld ? 4 : 0), palette.paperLight, 5)

  rect(293, 86, 58, 7, palette.ink)
  rect(296 + 58 * .66, 88, 58 * (.82 - .66), 3, palette.lamp)
  if (state === 'press') rect(296 + progress * 52, 85, 3, 9, progress > .82 ? palette.stamp : palette.paperLight)

  const pressProgress = state === 'press' ? progress : order.indexOf(state) > 2 || state === 'done' ? 1 : 0
  rect(303, 111 + pressProgress * 46, 35, 8, palette.steel)
  rect(296, 177, 51, 4, palette.lamp)
  if (state === 'press' || state === 'release' || state === 'done') rect(300, 171, 43, 8, palette.paper)
  pixelText('03 PRESS', 296, 188, palette.paper, 6)
}

function drawOutput() {
  rect(363, 151, 57, 42, palette.archiveDark)
  rect(369, 158, 45, 8, palette.ink)
  rect(374, 185, 35, 3, palette.steelDark)
  pixelText('09-R', 381, 174, palette.lamp, 6)

  if (state !== 'release' && state !== 'done') return
  const slide = state === 'done' ? 1 : progress
  const x = 320 + slide * 58
  rect(x, 163, 54, 34, palette.paperLight)
  rect(x + 3, 166, 48, 2, palette.stamp)
  drawMiniPattern(x + 17, 170, 2)
  pixelText(state === 'done' ? `${grade} ${record.slice(-3)}` : record.slice(-4), x + 16, 192, palette.ink, 4)
}

function drawParticles() {
  particles.forEach((particle) => rect(particle.x, particle.y, 2, 2, particle.color))
}

function drawMiniPattern(x, y, cell) {
  pattern.forEach((row, rowIndex) => row.forEach((punched, columnIndex) => {
    if (punched) rect(x + columnIndex * cell, y + rowIndex * cell, cell - 1, cell - 1, palette.ink)
  }))
}

function rect(x, y, width, height, color) {
  context.fillStyle = color
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function line(x1, y1, x2, y2, color, width = 1) {
  context.strokeStyle = color
  context.lineWidth = width
  context.lineCap = 'square'
  context.beginPath()
  context.moveTo(Math.round(x1), Math.round(y1))
  context.lineTo(Math.round(x2), Math.round(y2))
  context.stroke()
}

function pixelText(value, x, y, color, size) {
  context.fillStyle = color
  context.font = `700 ${size}px monospace`
  context.textBaseline = 'top'
  context.fillText(value, Math.round(x), Math.round(y))
}

function downloadReceipt() {
  const receipt = document.createElement('canvas')
  receipt.width = 960
  receipt.height = 1260
  const p = receipt.getContext('2d')
  p.scale(3, 3)
  p.imageSmoothingEnabled = true
  p.fillStyle = palette.paper
  p.fillRect(0, 0, 320, 420)

  // ponytail: one logical layout rendered at 3× keeps the receipt sharp without a second export system.
  p.globalAlpha = .16
  for (let y = 8; y < 412; y += 8) {
    for (let x = 8 + y % 16; x < 312; x += 16) {
      if ((x + y + record.charCodeAt((x + y) % record.length)) % 5) continue
      p.fillStyle = palette.archive
      p.fillRect(x, y, 1, 1)
    }
  }
  bits.forEach((bit, index) => {
    p.fillStyle = [palette.stamp, palette.archive, palette.ink, '#b59a5d'][bit.shade]
    p.fillRect(10 + Math.floor(bit.x * 300 / 2) * 2, 10 + Math.floor(bit.y * 400 / 2) * 2, 1, 1)
  })
  p.globalAlpha = 1

  // Restrained archival frame keeps the receipt formal without competing with its content.
  p.fillStyle = palette.ink
  p.fillRect(18, 18, 284, 1)
  p.fillRect(18, 401, 284, 1)
  p.fillRect(18, 18, 1, 384)
  p.fillRect(301, 18, 1, 384)

  p.fillStyle = palette.ink
  p.fillRect(31, 33, 262, 48)
  p.fillStyle = palette.archive
  p.fillRect(27, 29, 262, 48)
  p.fillStyle = palette.stamp
  p.fillRect(27, 29, 4, 48)

  p.textAlign = 'center'
  p.fillStyle = palette.paperLight
  p.font = '700 15px "Songti SC", serif'
  p.fillText('夜间情绪数据科', 160, 49)
  p.font = '800 9px monospace'
  p.fillText('NIGHT SHIFT RECORD · FORM 09-R', 160, 68)

  const cell = 5
  const patternX = 133
  const patternY = 105
  p.fillStyle = palette.ink
  p.fillRect(patternX - 10, patternY - 10, 75, 75)
  p.fillStyle = palette.stamp
  p.fillRect(patternX - 8, patternY - 8, 71, 71)
  p.fillStyle = palette.paperLight
  p.fillRect(patternX - 5, patternY - 5, 65, 65)
  pattern.forEach((row, rowIndex) => row.forEach((punched, columnIndex) => {
    if (!punched) return
    p.fillStyle = palette.ink
    p.fillRect(patternX + columnIndex * cell, patternY + rowIndex * cell, 4, 4)
  }))

  p.fillStyle = palette.ink
  p.fillRect(28, 196, 264, 1)
  p.fillStyle = palette.paperLight
  p.fillRect(28, 207, 264, 67)
  p.fillStyle = palette.stamp
  p.fillRect(28, 207, 3, 67)
  p.fillStyle = palette.ink
  p.font = '700 13px "Songti SC", serif'
  p.fillText('该事项已转为纸质记录', 160, 231)
  p.font = '500 9px sans-serif'
  p.fillText('不删除，只是不再一直由你保管。', 160, 253)

  p.fillStyle = palette.stamp
  p.fillRect(28, 292, 264, 1)
  p.fillStyle = palette.paperLight
  p.font = '700 11px sans-serif'
  p.fillStyle = palette.stamp
  p.fillText(`处理精度 ${grade} · ${gradeLabels[grade]}`, 160, 314)

  p.fillStyle = palette.ink
  p.font = '800 9px monospace'
  p.fillText(`RECORD 09-${record}`, 160, 347)
  p.fillText(new Date().toLocaleDateString('zh-CN'), 160, 365)
  p.font = '700 8px sans-serif'
  p.fillStyle = palette.archive
  p.fillText('本地生成 · 无副本留存', 160, 388)

  const output = document.createElement('canvas')
  output.width = 1280
  output.height = 1680
  const out = output.getContext('2d')
  out.imageSmoothingEnabled = true
  out.drawImage(receipt, 0, 0, output.width, output.height)

  const link = document.createElement('a')
  link.download = `night-emotion-record-${record}.png`
  link.href = output.toDataURL('image/png')
  link.click()
  tone(76, .12, .04)
}

function initAudio() {
  if (audio) return
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (AudioContext) audio = new AudioContext()
}

function tone(frequency, duration, gain = .04, delay = 0) {
  if (!audio) return
  const start = audio.currentTime + delay
  const oscillator = audio.createOscillator()
  const volume = audio.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(frequency, start)
  volume.gain.setValueAtTime(gain, start)
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration)
  oscillator.connect(volume).connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}
