/**
 * Canvas 样板：DPR 缩放、resize、动画循环。
 * 所有 toy 共用，避免每个都重写一遍这几十行。
 */

/**
 * 建一个铺满容器的 canvas，自动处理 devicePixelRatio 和 resize。
 *
 * onResize 在首次布局时就会同步触发一次，那时外部的 `const stage = createStage(...)`
 * 还没赋值，所以 stage 作为第三个参数传进去 —— 回调里用它，别用外部变量。
 *
 * @param {HTMLElement} host 挂载容器
 * @param {(w: number, h: number, stage: object) => void} [onResize] 尺寸变化回调，收到的是 CSS 像素
 */
export function createStage(host, onResize) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  host.appendChild(canvas)

  const stage = { canvas, ctx, width: 0, height: 0 }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const { clientWidth: w, clientHeight: h } = host
    stage.width = w
    stage.height = h
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    // 之后所有绘制都用 CSS 像素坐标，不用管 dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    onResize?.(w, h, stage)
  }

  fit()
  new ResizeObserver(fit).observe(host)

  return stage
}

/**
 * requestAnimationFrame 循环。dt 单位是秒，首帧为 0，切标签页回来时被截断到 0.05
 * 避免物理量爆掉。
 * @param {(dt: number, elapsed: number) => void} frame
 * @returns {() => void} 停止循环
 */
export function loop(frame) {
  let raf = 0
  let last = 0
  let elapsed = 0
  let running = true

  function tick(now) {
    if (!running) return
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    elapsed += dt
    frame(dt, elapsed)
    raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}

/** 追踪指针位置，离开画面时 active 为 false。 */
export function trackPointer(el) {
  const p = { x: 0, y: 0, active: false }

  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect()
    p.x = e.clientX - r.left
    p.y = e.clientY - r.top
    p.active = true
  })
  el.addEventListener('pointerleave', () => {
    p.active = false
  })

  return p
}
