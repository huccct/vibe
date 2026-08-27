import { fingerCount } from './gesture.js'

const stage = document.getElementById('stage')
const canvas = document.getElementById('fx')
const video = document.getElementById('camera')
const boot = document.getElementById('boot')
const status = document.getElementById('status')
const readout = document.getElementById('readout')
const modeLabel = document.getElementById('field')
const gestureLabel = document.getElementById('gesture')
const gl = canvas.getContext('webgl', { antialias: false, alpha: false })

let handTracker, stream, lastVideoTime = -1
let mode = 'idle'
let controls = []
let pulses = []
let lastHands = []
let lastPointer = null
let lastPointerPulse = 0

if (!gl) {
  status.textContent = '此浏览器不支持 WebGL'
  throw new Error('WebGL unavailable')
}

const vertexSource = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const fragmentSource = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_video;
uniform float u_time;
uniform float u_aspect;
uniform float u_videoAspect;
uniform float u_hasVideo;
uniform vec2 u_centers[2];
uniform float u_modes[2];
uniform vec2 u_pulses[8];
uniform float u_ages[8];
uniform float u_powers[8];

void main() {
  vec2 p = v_uv;
  vec2 warp = vec2(0.0);
  float light = 0.0;

  for (int i = 0; i < 8; i++) {
    vec2 delta = p - u_pulses[i];
    delta.x *= u_aspect;
    float d = max(length(delta), 0.001);
    float age = u_ages[i];
    float life = 1.0 - smoothstep(0.0, 1.35, age);
    float front = age * 0.32;
    float ring = sin((d - front) * 82.0) * exp(-abs(d - front) * 28.0);
    warp += normalize(delta) * ring * life * u_powers[i] * 0.014;
    light += abs(ring) * life * u_powers[i] * 0.16;
  }

  for (int i = 0; i < 2; i++) {
    vec2 delta = p - u_centers[i];
    delta.x *= u_aspect;
    float d = max(length(delta), 0.001);
    float active = step(0.001, abs(u_modes[i]));
    float angle = u_modes[i] * exp(-d * 7.5) * active;
    float s = sin(angle);
    float c = cos(angle);
    vec2 turned = mat2(c, -s, s, c) * delta;
    vec2 bend = (turned - delta) * active;
    bend.x /= u_aspect;
    warp += bend;
    light += exp(-d * 18.0) * active * 0.5;
  }

  warp.x /= u_aspect;
  vec2 screenUv = p + warp;
  vec2 cameraUv = screenUv;
  if (u_aspect < u_videoAspect) {
    cameraUv.x = (cameraUv.x - 0.5) * u_aspect / u_videoAspect + 0.5;
  } else {
    cameraUv.y = (cameraUv.y - 0.5) * u_videoAspect / u_aspect + 0.5;
  }
  cameraUv.x = 1.0 - cameraUv.x;

  vec3 color;
  if (u_hasVideo > 0.5) {
    float shift = min(length(warp) * 0.7, 0.012);
    float r = texture2D(u_video, cameraUv + vec2(shift, 0.0)).r;
    float g = texture2D(u_video, cameraUv).g;
    float b = texture2D(u_video, cameraUv - vec2(shift, 0.0)).b;
    color = vec3(r, g, b);
    color = mix(vec3(dot(color, vec3(0.24, 0.68, 0.08))), color, 0.38);
    color = pow(color, vec3(0.9)) * vec3(0.92, 1.02, 0.98);
  } else {
    vec2 q = p - 0.5;
    q.x *= u_aspect;
    float d = length(q);
    float breath = sin(d * 22.0 - u_time * 0.7) * 0.015;
    color = mix(vec3(0.018, 0.022, 0.02), vec3(0.10, 0.15, 0.13), smoothstep(0.72, 0.0, d + breath));
  }

  color += vec3(0.65, 0.86, 0.79) * light;
  float vignette = smoothstep(0.9, 0.28, length(v_uv - 0.5));
  color *= 0.72 + vignette * 0.38;
  gl_FragColor = vec4(color, 1.0);
}`

const program = createProgram(vertexSource, fragmentSource)
const buffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1, 0, 0,
   1, -1, 1, 0,
  -1,  1, 0, 1,
   1,  1, 1, 1,
]), gl.STATIC_DRAW)
gl.useProgram(program)

const stride = 4 * Float32Array.BYTES_PER_ELEMENT
const position = gl.getAttribLocation(program, 'a_position')
const uv = gl.getAttribLocation(program, 'a_uv')
gl.enableVertexAttribArray(position)
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0)
gl.enableVertexAttribArray(uv)
gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)

const uniforms = Object.fromEntries([
  'u_time', 'u_aspect', 'u_videoAspect', 'u_hasVideo', 'u_centers', 'u_modes',
  'u_pulses', 'u_ages', 'u_powers', 'u_video',
].map((name) => [name, gl.getUniformLocation(program, name)]))

const texture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, texture)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 10, 9, 255]))
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
gl.uniform1i(uniforms.u_video, 0)

document.getElementById('start').addEventListener('click', startCamera)
document.getElementById('demo').addEventListener('click', startDemo)
stage.addEventListener('pointermove', movePointer)
stage.addEventListener('pointerdown', pressPointer)
stage.addEventListener('pointerleave', () => { if (mode !== 'camera') controls = [] })
addEventListener('resize', fit)
fit()
requestAnimationFrame(frame)

function createProgram(vertex, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    return shader
  }
  const result = gl.createProgram()
  gl.attachShader(result, compile(gl.VERTEX_SHADER, vertex))
  gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fragment))
  gl.linkProgram(result)
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result))
  return result
}

async function startCamera() {
  const button = document.getElementById('start')
  button.disabled = true
  status.textContent = '正在加载手势模型…'
  let phase = '视觉模型'
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs')
    const vision = module.default || module
    const files = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
    )
    handTracker = await vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
      runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .55, minTrackingConfidence: .55,
    })
    phase = '摄像头'
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    })
    video.srcObject = stream
    await video.play()
    mode = 'camera'
    enter('镜面在线 · 用手划过画面')
  } catch (error) {
    console.error(error)
    button.disabled = false
    status.textContent = `${phase}启动失败 · ${error.name || '请重试'}`
  }
}

function startDemo() {
  mode = 'demo'
  enter('移动产生水波 · 按下形成漩涡')
}

function enter(text) {
  boot.classList.add('done')
  readout.hidden = false
  modeLabel.textContent = mode === 'camera' ? 'CAMERA' : 'MOUSE'
  status.textContent = text
}

function fit() {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const { width, height } = stage.getBoundingClientRect()
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  gl.viewport(0, 0, canvas.width, canvas.height)
}

function movePointer(event) {
  if (mode === 'camera') return
  const rect = stage.getBoundingClientRect()
  const point = { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height }
  controls = [{ ...point, mode: .22 }]
  const now = performance.now()
  if (!lastPointer || Math.hypot(point.x - lastPointer.x, point.y - lastPointer.y) > .018 || now - lastPointerPulse > 90) {
    addPulse(point.x, point.y, .72)
    lastPointerPulse = now
  }
  lastPointer = point
}

function pressPointer(event) {
  if (mode === 'camera') return
  movePointer(event)
  controls[0].mode = .72
  addPulse(controls[0].x, controls[0].y, 2.2)
  setTimeout(() => { if (controls[0]) controls[0].mode = .22 }, 260)
}

function addPulse(x, y, power = 1) {
  pulses.push({ x, y, power, born: performance.now() })
  if (pulses.length > 8) pulses.shift()
}

function detect(now) {
  lastVideoTime = video.currentTime
  const landmarks = handTracker.detectForVideo(video, now).landmarks
  const next = landmarks.map((hand, i) => {
    const palm = [0, 5, 9, 13, 17].reduce((p, index) => ({
      x: p.x + hand[index].x / 5,
      y: p.y + hand[index].y / 5,
    }), { x: 0, y: 0 })
    const point = { x: 1 - palm.x, y: 1 - palm.y }
    const open = fingerCount(hand) >= 3
    const previous = lastHands[i]
    const moved = !previous || Math.hypot(point.x - previous.x, point.y - previous.y) > .025
    if (moved) addPulse(point.x, point.y, open ? .8 : 1.3)
    if (!open && previous?.open) addPulse(point.x, point.y, 2.8)
    return { ...point, open, mode: open ? .12 : .68 }
  })
  lastHands = next
  controls = next
  const openCount = next.filter((hand) => hand.open).length
  gestureLabel.textContent = !next.length ? 'SEARCH' : openCount === next.length ? 'RIPPLE' : 'VORTEX'
  status.textContent = !next.length ? '寻找双手…' : `${next.length} HAND${next.length > 1 ? 'S' : ''} TRACKED`
}

function frame(now) {
  if (mode === 'camera' && video.readyState >= 2) {
    if (video.currentTime !== lastVideoTime) detect(now)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
  }

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  gl.useProgram(program)
  gl.uniform1f(uniforms.u_time, now / 1000)
  gl.uniform1f(uniforms.u_aspect, width / height)
  gl.uniform1f(uniforms.u_videoAspect, video.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9)
  gl.uniform1f(uniforms.u_hasVideo, mode === 'camera' && video.readyState >= 2 ? 1 : 0)

  const centerData = new Float32Array(4)
  const modeData = new Float32Array(2)
  controls.slice(0, 2).forEach((control, i) => {
    centerData[i * 2] = control.x
    centerData[i * 2 + 1] = control.y
    modeData[i] = control.mode
  })
  gl.uniform2fv(uniforms.u_centers, centerData)
  gl.uniform1fv(uniforms.u_modes, modeData)

  pulses = pulses.filter((pulse) => now - pulse.born < 1350)
  const pointData = new Float32Array(16)
  const ageData = new Float32Array(8).fill(9)
  const powerData = new Float32Array(8)
  pulses.forEach((pulse, i) => {
    pointData[i * 2] = pulse.x
    pointData[i * 2 + 1] = pulse.y
    ageData[i] = (now - pulse.born) / 1000
    powerData[i] = pulse.power
  })
  gl.uniform2fv(uniforms.u_pulses, pointData)
  gl.uniform1fv(uniforms.u_ages, ageData)
  gl.uniform1fv(uniforms.u_powers, powerData)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  requestAnimationFrame(frame)
}
