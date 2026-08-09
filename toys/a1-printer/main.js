import * as THREE from '../../src/vendor/three.module.min.js'
import { applyLangAttr, getLang, mountLangToggle } from '../../src/shared/i18n.js'
import { LAYERS, MODELS, outlinePoint, printerMotion, visibleLayers } from './print.js'

const UI = {
  zh: {
    pageTitle: '拓竹 A1 打印桌 — vibe', title: '拓竹 A1 打印桌', hint: '拖动画面转动视角',
    model: '样件', models: ['旋涡珊瑚', '折纸灯罩', '花瓣托盘'],
    progress: '打印进度', color: '耗材', pause: '暂停', resume: '继续', restart: '重新打印',
    printing: '打印中', paused: '已暂停', done: '打印完成', canvas: '可旋转的拓竹 A1 三维打印演示',
  },
  en: {
    pageTitle: 'Bambu Lab A1 Print Desk — vibe', title: 'Bambu Lab A1 Print Desk', hint: 'Drag to orbit the printer',
    model: 'sample', models: ['Spiral coral', 'Origami lamp', 'Petal tray'],
    progress: 'print progress', color: 'filament', pause: 'pause', resume: 'resume', restart: 'restart',
    printing: 'printing', paused: 'paused', done: 'print complete', canvas: 'Rotatable 3D printing demo of a Bambu Lab A1',
  },
}

const host = document.getElementById('stage')
const modelSelect = document.getElementById('model')
const progressInput = document.getElementById('progress')
const colorInputs = [0, 1, 2, 3].map((index) => document.getElementById(`color${index}`))
const pauseButton = document.getElementById('pause')
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.domElement.setAttribute('role', 'img')
host.prepend(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
camera.position.set(10.2, 6.7, 11.8)
camera.lookAt(0.8, 2.7, 0)

scene.add(new THREE.HemisphereLight(0xeefcff, 0x293436, 2.2))
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4)
keyLight.position.set(5, 10, 7)
keyLight.castShadow = true
scene.add(keyLight)

const printer = new THREE.Group()
printer.rotation.y = -0.35
scene.add(printer)

const white = material(0xe4e7e5, 0.5, 0.55)
const metal = material(0xa8afad, 0.68, 0.34)
const dark = material(0x15191a, 0.15, 0.72)
const plateMat = material(0x343a39, 0.48, 0.68)
const yellow = material(0xe1b92e, 0.3, 0.45)

// A1: low bed-slinger base and a full two-post gantry behind the plate.
addBox(printer, [5.25, 0.48, 4.7], [0, 0.24, 0], white)
addBox(printer, [4.55, 0.16, 0.34], [0, 0.55, -2.15], dark)
addBox(printer, [4.55, 0.1, 0.18], [0, 0.5, 2.18], metal)
for (const x of [-1.9, -1.45, 1.45, 1.9]) addBox(printer, [0.24, 0.08, 0.22], [x, 0.51, 2.31], dark)
for (const x of [-2.08, 2.08]) {
  addBox(printer, [0.5, 5.2, 0.58], [x, 3.15, -0.7], metal)
  addBox(printer, [0.66, 0.58, 0.78], [x, 0.72, -0.7], dark)
  addBox(printer, [0.7, 0.48, 0.82], [x, 5.72, -0.7], dark)
  addBox(printer, [0.1, 4.65, 0.04], [x, 3.15, -0.39], dark)
  addCylinder(printer, 0.045, 4.65, [x + Math.sign(x) * -0.21, 3.15, -0.36], dark, [0, 0, 0])
}
addBox(printer, [4.25, 0.5, 0.58], [0, 5.72, -0.7], metal)
addBox(printer, [3.75, 0.07, 0.06], [0, 5.72, -0.39], dark)

const bed = new THREE.Group()
printer.add(bed)
addBox(bed, [4.18, 0.11, 4.13], [0.25, 0.61, 0], metal)
addBox(bed, [4.05, 0.16, 4.0], [0.25, 0.64, 0], dark)
addBox(bed, [3.8, 0.055, 3.76], [0.25, 0.75, 0], plateMat)
for (const x of [-1.48, 1.98]) for (const z of [-1.73, 1.73]) {
  addCylinder(bed, 0.055, 0.035, [x, 0.79, z], metal, [0, 0, 0])
}

const gantry = new THREE.Group()
printer.add(gantry)
addBox(gantry, [4.55, 0.4, 0.58], [0, 0, -0.5], metal)
addBox(gantry, [4.12, 0.1, 0.68], [0, -0.22, -0.46], dark)
addBox(gantry, [3.72, 0.08, 0.05], [0, 0.12, -0.18], white)
for (let x = -1.65; x <= 1.66; x += 0.55) {
  addCylinder(gantry, 0.045, 0.025, [x, 0.04, -0.19], dark, [Math.PI / 2, 0, 0])
}
addBox(gantry, [0.55, 0.68, 0.85], [-2.03, -0.16, -0.42], dark)
addBox(gantry, [0.72, 0.82, 0.88], [2.02, -0.08, -0.42], white)
addCylinder(gantry, 0.21, 0.13, [2.39, -0.08, -0.42], dark, [0, 0, Math.PI / 2])
for (let x = 0.7; x <= 1.65; x += 0.19) addBox(gantry, [0.14, 0.12, 0.14], [x, 0.28, -0.56], dark)

const toolhead = new THREE.Group()
gantry.add(toolhead)
addBox(toolhead, [0.56, 0.22, 0.52], [0, 0.06, -0.12], dark)
addCylinder(toolhead, 0.09, 0.24, [0, 0.23, -0.12], metal, [0, 0, 0])
addBox(toolhead, [0.86, 0.98, 0.74], [0, -0.48, -0.14], white)
addBox(toolhead, [0.56, 0.34, 0.78], [0, -0.98, -0.12], dark)
addCylinder(toolhead, 0.23, 0.08, [0, -0.42, 0.27], dark, [Math.PI / 2, 0, 0])
addCylinder(toolhead, 0.13, 0.085, [0, -0.42, 0.32], yellow, [Math.PI / 2, 0, 0])
addCylinder(toolhead, 0.065, 0.09, [0, -0.42, 0.37], dark, [Math.PI / 2, 0, 0])
for (let spoke = 0; spoke < 6; spoke++) {
  const angle = spoke / 6 * Math.PI * 2
  addCylinder(toolhead, 0.025, 0.1, [Math.cos(angle) * 0.17, -0.42 + Math.sin(angle) * 0.17, 0.38], yellow, [Math.PI / 2, 0, 0])
}
for (const x of [-0.27, 0, 0.27]) addBox(toolhead, [0.12, 0.035, 0.025], [x, -0.72, 0.25], dark)
const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 16), material(0xb77b3d, 0.9, 0.22))
nozzle.position.set(0, -1.22, -0.03)
nozzle.rotation.x = Math.PI
toolhead.add(nozzle)

const screen = new THREE.Group()
screen.position.set(2.12, 0.96, 2.48)
screen.rotation.set(-0.42, 0.72, 0)
printer.add(screen)
addBox(screen, [0.28, 0.62, 0.22], [0, -0.42, -0.12], metal)
addBox(screen, [1.2, 0.8, 0.16], [0, 0, 0], white)
addBox(screen, [0.98, 0.6, 0.03], [0, 0, 0.1], material(0x18272a, 0.15, 0.58))
addBox(screen, [0.55, 0.045, 0.02], [0, 0.12, 0.13], material(0x74d9d0, 0.2, 0.5))
addBox(screen, [0.36, 0.045, 0.02], [-0.1, -0.04, 0.13], material(0xe86f45, 0.2, 0.5))
for (const x of [-0.32, -0.1, 0.12, 0.34]) addBox(screen, [0.13, 0.1, 0.02], [x, -0.2, 0.13], metal)

// AMS lite: reels sit at different depths around a freestanding angled rack.
const ams = new THREE.Group()
ams.position.set(4.85, 0, -0.7)
ams.rotation.y = 0.85
printer.add(ams)
addBox(ams, [0.42, 3.55, 0.56], [-0.36, 2.05, 0], white).rotation.z = -0.3
addBox(ams, [0.42, 3.55, 0.56], [0.36, 2.05, 0], white).rotation.z = 0.3
addBox(ams, [1.5, 0.3, 0.52], [0, 2.45, 0], white).rotation.z = -0.08
addBox(ams, [1.25, 0.34, 1.5], [-0.78, 0.3, 0], dark).rotation.y = -0.18
addBox(ams, [1.25, 0.34, 1.5], [0.78, 0.3, 0], dark).rotation.y = 0.18
const spoolColors = [0x65d7ca, 0x8094d9, 0xf0f0e8, 0x3b4142]
const spoolPositions = [
  [-0.72, 1.3, 0.4, -0.12], [0.72, 1.3, -0.4, 0.12],
  [-0.62, 3.15, -0.35, 0.12], [0.62, 3.15, 0.35, -0.12],
]
const feederPositions = [
  [-0.68, 2.34, 0.34], [0.04, 2.2, -0.34],
  [-0.26, 2.82, -0.24], [0.52, 2.7, 0.3],
]
const spoolFilaments = []
const spoolColorMaterials = []
const guideTubes = []
spoolPositions.forEach(([x, y, z, tilt], index) => {
  const reel = new THREE.Group()
  reel.position.set(x, y, z)
  reel.rotation.y = tilt
  ams.add(reel)
  const spoolColor = material(spoolColors[index], 0.08, 0.58)
  const filamentMesh = addCylinder(reel, 0.62, 0.48, [0, 0, 0], spoolColor, [Math.PI / 2, 0, 0])
  addCylinder(reel, 0.76, 0.07, [0, 0, 0.28], white, [Math.PI / 2, 0, 0])
  addCylinder(reel, 0.76, 0.07, [0, 0, -0.28], white, [Math.PI / 2, 0, 0])
  addCylinder(reel, 0.19, 0.62, [0, 0, 0], dark, [Math.PI / 2, 0, 0])
  for (let ring = 0; ring < 3; ring++) {
    const line = new THREE.Mesh(new THREE.TorusGeometry(0.51 + ring * 0.055, 0.018, 6, 36), spoolColor)
    line.position.z = 0.325
    reel.add(line)
  }
  for (let dot = 0; dot < 12; dot++) {
    const angle = dot / 12 * Math.PI * 2
    addCylinder(reel, 0.025, 0.075, [Math.cos(angle) * 0.68, Math.sin(angle) * 0.68, 0.325], dark, [Math.PI / 2, 0, 0])
  }
  addCylinder(reel, 0.15, 0.09, [0, 0, 0.34], metal, [Math.PI / 2, 0, 0])
  addCylinder(reel, 0.065, 0.1, [0, 0, 0.4], dark, [Math.PI / 2, 0, 0])
  const [feedX, feedY, feedZ] = feederPositions[index]
  const feeder = addBox(ams, [0.54, 0.72, 0.6], [feedX, feedY, feedZ], index === 2 ? white : dark)
  feeder.rotation.z = index % 2 ? 0.24 : -0.24
  addCylinder(ams, 0.22, 0.08, [feedX, feedY + 0.4, feedZ], metal, [0, 0, 0])
  addCylinder(ams, 0.11, 0.08, [feedX, feedY - 0.25, feedZ + 0.34], yellow, [Math.PI / 2, 0, 0])
  spoolFilaments.push(filamentMesh)
  spoolColorMaterials.push(spoolColor)
  const tube = new THREE.Mesh(new THREE.BufferGeometry(), material(spoolColors[index], 0.15, 0.38))
  printer.add(tube)
  guideTubes.push(tube)
})

const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({ opacity: 0.2 }))
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.02
floor.receiveShadow = true
scene.add(floor)

let layers = []
let filament = material(spoolColors[0], 0.04, 0.58)
const print = new THREE.Group()
bed.add(print)
buildModel()

let progress = 0
let paused = false
let dragging = false
let lastX = 0
let lastY = 0
let pitch = 0
let lastTime = performance.now()

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true
  lastX = event.clientX
  lastY = event.clientY
  renderer.domElement.setPointerCapture(event.pointerId)
})
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return
  printer.rotation.y += (event.clientX - lastX) * 0.008
  pitch = Math.max(-0.18, Math.min(0.2, pitch + (event.clientY - lastY) * 0.003))
  printer.rotation.x = pitch
  lastX = event.clientX
  lastY = event.clientY
})
renderer.domElement.addEventListener('pointerup', () => (dragging = false))
renderer.domElement.addEventListener('pointercancel', () => (dragging = false))

progressInput.addEventListener('input', () => {
  progress = Number(progressInput.value) / 1000
  paused = true
  paintUI()
})
colorInputs.forEach((input, index) => input.addEventListener('input', () => {
  spoolColorMaterials[index].color.set(input.value)
  guideTubes[index].material.color.set(input.value)
  if (index === 0) filament.color.set(input.value)
}))
modelSelect.addEventListener('change', () => {
  progress = 0
  paused = false
  buildModel()
  paintUI()
})
pauseButton.addEventListener('click', () => {
  paused = !paused
  paintUI()
})
document.getElementById('restart').addEventListener('click', () => {
  progress = 0
  paused = false
  paintUI()
})

applyLangAttr()
mountLangToggle(document.getElementById('lang'), paintUI)
paintUI()
resize()
addEventListener('resize', resize)
renderer.setAnimationLoop(animate)

function animate(time) {
  const dt = Math.min(50, time - lastTime)
  lastTime = time
  if (!paused && progress < 1) progress = Math.min(1, progress + dt / 21000)
  if (progress >= 1) paused = true

  const model = modelSelect.value
  const motion = printerMotion(model, progress, time)
  toolhead.position.x = 0.25 + motion.x
  bed.position.z = motion.bedZ
  gantry.position.y = motion.height
  for (const spool of spoolFilaments) spool.rotation.y -= paused ? 0 : dt * 0.0015
  updateGuideTubes()
  const count = visibleLayers(progress)
  for (let i = 0; i < layers.length; i++) layers[i].visible = i < count
  progressInput.value = String(Math.round(progress * 1000))
  document.getElementById('percent').value = `${Math.round(progress * 100)}%`
  document.getElementById('status').textContent = UI[getLang()][progress >= 1 ? 'done' : paused ? 'paused' : 'printing']
  document.querySelector('.pulse').classList.toggle('stopped', paused)
  renderer.render(scene, camera)
}

function resize() {
  const { clientWidth: width, clientHeight: height } = host
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.position.set(...(camera.aspect < 0.8 ? [15.5, 8.2, 17.8] : [10.2, 6.7, 11.8]))
  camera.lookAt(0.8, 2.7, 0)
  camera.updateProjectionMatrix()
}

function buildModel() {
  for (const layer of layers) layer.geometry.dispose()
  print.clear()
  layers = []
  const model = modelSelect.value
  const { height } = MODELS[model]

  for (let i = 0; i < LAYERS; i++) {
    const p = i / (LAYERS - 1)
    const points = []
    for (let step = 0; step < 64; step++) {
      const point = outlinePoint(model, p, step / 64 * Math.PI * 2)
      points.push(new THREE.Vector3(0.25 + point.x, 0.81 + p * height, point.z))
    }
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.08)
    const layer = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.022, 4, true), filament)
    layer.castShadow = true
    layer.visible = false
    print.add(layer)
    layers.push(layer)
  }
}

let lastTubeEnd = new THREE.Vector2(Infinity, Infinity)

function updateGuideTubes() {
  const end = new THREE.Vector3(toolhead.position.x, gantry.position.y - 0.2, 0.2)
  if (Math.abs(end.x - lastTubeEnd.x) < 0.04 && Math.abs(end.y - lastTubeEnd.y) < 0.04) return
  lastTubeEnd.set(end.x, end.y)
  guideTubes.forEach((tube, index) => {
    const [x, y, z] = feederPositions[index]
    const start = new THREE.Vector3(x, y + 0.22, z).applyEuler(ams.rotation).add(ams.position)
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(start.x - index * 0.12, 6.5 + index * 0.12, -0.25),
      new THREE.Vector3(end.x + index * 0.08, Math.max(end.y + 1, 5.7), 0.12),
      end,
    ])
    tube.geometry.dispose()
    tube.geometry = new THREE.TubeGeometry(curve, 32, 0.025, 6, false)
  })
}

function material(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness })
}

function addBox(parent, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addCylinder(parent, radius, depth, position, mat, rotation) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 28), mat)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

function paintUI() {
  const t = UI[getLang()]
  document.title = t.pageTitle
  document.getElementById('title').textContent = t.title
  document.getElementById('hint').textContent = t.hint
  document.getElementById('modelLabel').textContent = t.model
  ;[...modelSelect.options].forEach((option, index) => (option.textContent = t.models[index]))
  document.getElementById('progressLabel').textContent = t.progress
  document.getElementById('colorLabel').textContent = t.color
  colorInputs.forEach((input, index) => input.setAttribute('aria-label', `${t.color} ${index + 1}`))
  pauseButton.textContent = paused ? t.resume : t.pause
  document.getElementById('restart').textContent = t.restart
  renderer.domElement.setAttribute('aria-label', t.canvas)
}
