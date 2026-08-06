/**
 * 渲染画廊。数据来自 toys/registry.json（由 `pnpm sync` 从各 toy 的 meta.json 汇总生成）。
 * 每个 toy 的文案按语言分块，见 registry 里的 zh / en。
 */
import { getLang, mountLangToggle, applyLangAttr } from '../shared/i18n.js'

const UI = {
  zh: {
    tagline: '一堆好玩的东西。零依赖，点开就能玩。',
    empty: ['还没有东西。跑 ', ' 加一个。'],
    count: (n) => `${n} 个玩意儿`,
    source: '源码 ↗',
    disabled: '打磨中',
  },
  en: {
    tagline: 'A pile of fun little things. No deps, just open and play.',
    empty: ['Nothing here yet. Run ', ' to add one.'],
    count: (n) => `${n} ${n === 1 ? 'toy' : 'toys'}`,
    source: 'source ↗',
    disabled: 'Work in progress',
  },
}

const grid = document.getElementById('grid')
const count = document.getElementById('count')
const tagline = document.getElementById('tagline')
const source = document.getElementById('source')
const langSlot = document.getElementById('lang')

applyLangAttr()

const res = await fetch('toys/registry.json')
if (!res.ok) throw new Error(`registry.json 读不到：${res.status}`)
const toys = await res.json()

// 新的排前面。同一天加的按标题排，标题跟语言有关，所以放进 render 里
mountLangToggle(langSlot, render)
render()

function render() {
  const lang = getLang()
  const t = UI[lang]

  tagline.textContent = t.tagline
  source.textContent = t.source

  const sorted = [...toys].sort(
    (a, b) => b.added.localeCompare(a.added) || a[lang].title.localeCompare(b[lang].title)
  )

  grid.replaceChildren()
  if (sorted.length === 0) {
    const p = document.createElement('p')
    p.className = 'empty'
    const code = document.createElement('code')
    code.textContent = 'pnpm new my-toy'
    p.append(t.empty[0], code, t.empty[1])
    grid.append(p)
  } else {
    grid.append(...sorted.map((toy) => card(toy, lang)))
  }

  count.textContent = t.count(sorted.length)
}

function card(toy, lang) {
  const copy = toy[lang]

  const a = document.createElement(toy.disabled ? 'article' : 'a')
  a.className = 'card'
  if (toy.disabled) {
    a.classList.add('disabled')
    a.setAttribute('aria-disabled', 'true')
  } else {
    a.href = `toys/${toy.slug}/`
  }
  a.style.setProperty('--card-accent', toy.accent)

  const thumb = document.createElement('div')
  thumb.className = 'card-thumb'

  const body = document.createElement('div')
  body.className = 'card-body'

  const h2 = document.createElement('h2')
  h2.textContent = copy.title
  if (toy.disabled) {
    const badge = document.createElement('span')
    badge.className = 'status'
    badge.textContent = UI[lang].disabled
    h2.append(badge)
  }

  const p = document.createElement('p')
  p.textContent = copy.description

  const tags = document.createElement('div')
  tags.className = 'tags'
  tags.append(
    ...copy.tags.map((label) => {
      const s = document.createElement('span')
      s.textContent = label
      return s
    })
  )

  body.append(h2, p, tags)
  a.append(thumb, body)
  return a
}
