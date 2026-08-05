/**
 * Chladni 图形：金属板上撒沙，通声波，沙子会聚到「节线」（不振动的位置）。
 *
 * 驻波方程 f(x,y) = sin(mπx)·sin(nπy) − sin(nπx)·sin(mπy)，x,y ∈ [0,1]。
 * |f| 就是该点的振动强度，f = 0 的地方是节线。
 *
 * 沙粒受两个力：
 *   1. 沿 |f| 的负梯度漂移 —— 真实物理里沙子被振动推向节线，这是图案成形的主因。
 *      只靠「振动强的地方步子大」的随机游走是不够的：那样沙粒没有朝节线走的倾向，
 *      低阶模式节线宽、碰巧撞上还行，m/n 一大节线变细就彻底散开。
 *   2. 正比于 |f| 的随机抖动 —— 给点颗粒感，也避免沙粒卡在局部。
 */
import { createStage, loop } from '../../src/shared/stage.js'

const COUNT = 12000

const opts = { m: 3, n: 5, amp: 8 }

// 归一化坐标 [0,1]²，跟画布尺寸解耦，resize 不用重算。
// 必须在 createStage 之前声明 —— 它会同步触发一次 onResize(shake)，而 shake 要写这个数组
const grains = new Float32Array(COUNT * 2)

const host = document.getElementById('stage')
const stage = createStage(host, shake)

bindSlider('m', (v) => (opts.m = v))
bindSlider('n', (v) => (opts.n = v))
bindSlider('amp', (v) => (opts.amp = v))
document.getElementById('shake').addEventListener('click', shake)

shake()

loop(() => {
  const { ctx, width, height } = stage
  const size = Math.min(width, height) * 0.86
  const ox = (width - size) / 2
  const oy = (height - size) / 2

  ctx.fillStyle = '#08090c'
  ctx.fillRect(0, 0, width, height)

  // 板子边框
  ctx.strokeStyle = '#22262f'
  ctx.strokeRect(ox, oy, size, size)

  const { m, n } = opts
  const step = opts.amp / 2200
  // 有限差分求梯度的间距。跟着模式阶数缩小，否则高阶时跨过了节线取不到局部斜率
  const eps = 1 / (300 * Math.max(m, n))
  ctx.fillStyle = '#7cf6ff'

  for (let i = 0; i < COUNT; i++) {
    const xi = i * 2
    const yi = xi + 1
    let x = grains[xi]
    let y = grains[yi]

    const v = Math.abs(chladni(x, y, m, n))

    // |f| 的梯度，负方向就是往节线走
    const gx = Math.abs(chladni(x + eps, y, m, n)) - Math.abs(chladni(x - eps, y, m, n))
    const gy = Math.abs(chladni(x, y + eps, m, n)) - Math.abs(chladni(x, y - eps, m, n))
    const gLen = Math.hypot(gx, gy) || 1

    // 漂移量正比于当前振动强度：离节线越远走得越快，越近越慢，自然收敛
    const drift = v * step * 1.6
    x -= (gx / gLen) * drift
    y -= (gy / gLen) * drift

    // 最小值保证一直在抖，不会彻底冻住
    const jitter = Math.max(v, 0.03) * step * 0.7
    x += (Math.random() * 2 - 1) * jitter
    y += (Math.random() * 2 - 1) * jitter

    // 蹦出板子就从随机位置重新落下
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      x = Math.random()
      y = Math.random()
    }

    grains[xi] = x
    grains[yi] = y

    ctx.fillRect(ox + x * size, oy + y * size, 1.1, 1.1)
  }
})

function chladni(x, y, m, n) {
  return (
    Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y) -
    Math.sin(n * Math.PI * x) * Math.sin(m * Math.PI * y)
  )
}

function shake() {
  for (let i = 0; i < grains.length; i++) grains[i] = Math.random()
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
