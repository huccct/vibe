/**
 * Pixel sorting：把每一行（列）里连续的「亮过阈值」的像素段挑出来，按某个键排序。
 * 结果是那种熟悉的融化 / 拉丝故障感。
 *
 * 没有内置素材图，默认图是用噪声现场生成的，保证一打开就有东西可玩。
 */
import { makeNoise2D, fbm } from '../../src/shared/noise.js'

const W = 900
const H = 600

const host = document.getElementById('stage')
const dropHint = document.getElementById('dropHint')

const canvas = document.createElement('canvas')
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')
host.appendChild(canvas)

// 原图留一份，每次调参数都从它重算，不然会在上一次结果上反复排、糊掉
let source = generateSource()

const opts = { threshold: 35, direction: 'row', key: 'lum' }

bindSlider('threshold', (v) => {
  opts.threshold = v
  render()
})
bindSelect('direction', (v) => {
  opts.direction = v
  render()
})
bindSelect('key', (v) => {
  opts.key = v
  render()
})

document.getElementById('file').addEventListener('change', (e) => {
  const file = e.target.files?.[0]
  if (file) loadFile(file)
})

document.getElementById('save').addEventListener('click', () => {
  const a = document.createElement('a')
  a.download = `pixel-sort-${Date.now()}.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
})

setupDrop()
render()

function render() {
  const img = new ImageData(new Uint8ClampedArray(source.data), W, H)
  sort(img, opts)
  ctx.putImageData(img, 0, 0)
}

/** 亮度阈值 0-100 → 0-255 */
function sort(img, { threshold, direction, key }) {
  const cut = (threshold / 100) * 255
  const score = keyFn(key)
  const px = img.data

  const along = direction === 'row' ? W : H
  const across = direction === 'row' ? H : W
  // 行方向步长 1 像素，列方向步长一整行
  const stride = direction === 'row' ? 1 : W

  for (let a = 0; a < across; a++) {
    const base = direction === 'row' ? a * W : a
    let start = -1

    for (let i = 0; i <= along; i++) {
      // i === along 是哨兵，用来收尾最后一段
      const bright = i < along && luminance(px, (base + i * stride) * 4) > cut

      if (bright && start === -1) {
        start = i
      } else if (!bright && start !== -1) {
        sortSpan(px, base, stride, start, i, score)
        start = -1
      }
    }
  }
}

/** 排 [from, to) 这一段。先抽出来排，再写回去。 */
function sortSpan(px, base, stride, from, to, score) {
  const len = to - from
  if (len < 2) return

  const bucket = new Array(len)
  for (let k = 0; k < len; k++) {
    const o = (base + (from + k) * stride) * 4
    bucket[k] = [px[o], px[o + 1], px[o + 2], px[o + 3]]
  }

  bucket.sort((p, q) => score(p) - score(q))

  for (let k = 0; k < len; k++) {
    const o = (base + (from + k) * stride) * 4
    const c = bucket[k]
    px[o] = c[0]
    px[o + 1] = c[1]
    px[o + 2] = c[2]
    px[o + 3] = c[3]
  }
}

// 函数声明而非 const —— 顶层的 render() 早于这里执行，箭头函数会撞 TDZ
function luminance(px, o) {
  return 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]
}

function keyFn(key) {
  if (key === 'r') return (c) => c[0]
  if (key === 'b') return (c) => c[2]
  if (key === 'hue') return (c) => hue(c[0], c[1], c[2])
  return (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** 只要 HSL 里的 H，0-360 */
function hue(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) + 360) % 360
}

/**
 * 用噪声现场生成一张默认素材图。
 *
 * 关键是要有「硬边 + 宽亮度范围」：纯平滑渐变的话，任何阈值下要么整行都过线
 * （排成一条长渐变，糊掉），要么全不过线（没效果）。所以这里把噪声量化成层，
 * 层与层之间亮度跳变，排序才会断成一段一段，出拉丝感。
 */
function generateSource() {
  const base = fbm(makeNoise2D(11), 5)
  const detail = fbm(makeNoise2D(29), 4)
  const grain = makeNoise2D(53)
  const img = ctx.createImageData(W, H)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = base(x / 300, y / 300) * 0.5 + 0.5
      const d = detail(x / 55, y / 55) * 0.5 + 0.5
      // 高频颗粒：让相邻像素也有亮度差，排序才有东西可排
      const g0 = grain(x / 3.5, y / 3.5)

      const h = (n * 300 + d * 70) % 360
      const s = 50 + d * 45
      // 大结构定基调，中频拉开对比，高频给段内梯度
      const l = 10 + n * 40 + d * 38 + g0 * 12

      const [r, g, b] = hslToRgb(h, s, Math.max(2, Math.min(96, l)))

      const o = (y * W + x) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }

  return img
}

function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function loadFile(file) {
  const url = URL.createObjectURL(file)
  const img = new Image()

  img.onload = () => {
    // 等比缩进 W×H 并居中，多出来的地方留黑
    const scale = Math.min(W / img.width, H / img.height)
    const w = img.width * scale
    const h = img.height * scale

    ctx.fillStyle = '#08090c'
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)

    source = ctx.getImageData(0, 0, W, H)
    URL.revokeObjectURL(url)
    render()
  }

  img.onerror = () => {
    URL.revokeObjectURL(url)
    alert('这张图读不了，换一张？')
  }

  img.src = url
}

function setupDrop() {
  const stop = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  host.addEventListener('dragenter', (e) => {
    stop(e)
    host.classList.add('dragging')
  })
  host.addEventListener('dragover', stop)
  host.addEventListener('dragleave', (e) => {
    stop(e)
    if (!host.contains(e.relatedTarget)) host.classList.remove('dragging')
  })
  host.addEventListener('drop', (e) => {
    stop(e)
    host.classList.remove('dragging')
    const file = e.dataTransfer?.files?.[0]
    if (file?.type.startsWith('image/')) loadFile(file)
  })
}

function bindSlider(id, onInput) {
  const input = document.getElementById(id)
  const out = document.getElementById(`${id}Out`)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = String(v)
    onInput(v)
  })
}

function bindSelect(id, onChange) {
  document.getElementById(id).addEventListener('change', (e) => onChange(e.target.value))
}
