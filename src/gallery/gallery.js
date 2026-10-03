/**
 * 渲染画廊。数据来自 toys/registry.json（由 `pnpm sync` 从各 toy 的 meta.json 汇总生成）。
 * 每个 toy 的文案按语言分块，见 registry 里的 zh / en。
 */
import { pickToy } from './discovery.js'
import { getLang, mountLangToggle, applyLangAttr } from '../shared/i18n.js'

const UI = {
  zh: {
    tagline: '灵光一现，然后把它做出来。',
    invitation: '认真做点\n不正经的。',
    note: '甩一坨软胶，拆一座网页，或让墨迹自由落体。\n这里的想法，都可以上手玩。',
    ticket: '今日试玩票',
    play: '就玩这个',
    shuffle: '换一个试试',
    collection: '点子陈列室',
    collectionNote: '随便逛，随便玩。',
    empty: '新的想法正在酝酿。',
    loading: '正在展开合集…',
    error: '合集暂时加载失败，请刷新页面重试。',
    model: '制作模型',
    maintenance: '后续整理模型',
    unknown: '待补充',
    count: (n) => `${n} 个作品`,
    source: '源码 ↗',
    disabled: '打磨中',
  },
  en: {
    tagline: 'A little curiosity. Something you can play.',
    invitation: 'Serious about\nplaying around.',
    note: 'Fling some slime. Demolish a website. Let ink fall.\nEvery idea here is yours to play with.',
    ticket: 'YOUR PLAY TICKET',
    play: 'Let’s play',
    shuffle: 'Pick another',
    collection: 'The idea shelf',
    collectionNote: 'Look around. Try something.',
    empty: 'New ideas are on the way.',
    loading: 'Opening the collection…',
    error: 'Could not load the collection. Please refresh to try again.',
    model: 'Made with',
    maintenance: 'Later edits',
    unknown: 'To be added',
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

let toys = []
let state = 'loading'
let featured
const shuffle = document.getElementById('shuffle')
shuffle.addEventListener('click', () => {
  featured = pickToy(toys, featured?.slug)
  renderTicket()
})

// 新的排前面。同一天加的按标题排，标题跟语言有关，所以放进 render 里
mountLangToggle(langSlot, render)
render()
try {
  const res = await fetch('toys/registry.json')
  if (!res.ok) throw new Error(`registry.json: ${res.status}`)
  toys = await res.json()
  state = 'ready'
  featured = pickToy(toys)
} catch (error) {
  state = 'error'
  console.error(error)
}
render()

function render() {
  const lang = getLang()
  const t = UI[lang]

  document.title = lang === 'zh' ? 'vibe · idea 合集' : 'vibe · An idea collection'

  tagline.textContent = t.tagline
  source.textContent = t.source
  document.getElementById('play-title').textContent = t.invitation
  document.getElementById('play-note').textContent = t.note
  document.getElementById('collection-title').textContent = t.collection
  document.getElementById('collection-note').textContent = t.collectionNote
  renderTicket()

  const sorted = [...toys].sort(
    (a, b) => b.added.localeCompare(a.added) || a[lang].title.localeCompare(b[lang].title)
  )

  grid.replaceChildren()
  if (state !== 'ready' || sorted.length === 0) {
    const p = document.createElement('p')
    p.className = 'empty'
    p.textContent = state === 'ready' ? t.empty : t[state]
    grid.append(p)
  } else {
    grid.append(...sorted.map((toy) => card(toy, lang)))
  }

  count.textContent = state === 'ready' ? t.count(sorted.length) : ''
}

function card(toy, lang) {
  const copy = toy[lang]

  const a = document.createElement(toy.disabled ? 'article' : 'a')
  a.className = 'card'
  a.style.setProperty('--toy-color', toy.accent)
  if (toy.disabled) {
    a.classList.add('disabled')
    a.setAttribute('aria-disabled', 'true')
  } else {
    a.href = `toys/${toy.slug}/`
  }

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

  const credit = document.createElement('div')
  credit.className = 'model-credit'
  const label = document.createElement('span')
  label.textContent = toy.modelCredit === 'maintenance' ? UI[lang].maintenance : UI[lang].model
  const models = document.createElement('span')
  // ponytail: historical model credits stay unknown until confirmed by the author.
  models.textContent = toy.models?.length ? toy.models.join(' · ') : UI[lang].unknown
  credit.append(label, models)

  body.append(h2, p)
  a.append(body, credit)
  return a
}

function renderTicket() {
  const lang = getLang()
  const t = UI[lang]
  document.getElementById('ticket-label').textContent = t.ticket
  shuffle.textContent = t.shuffle
  shuffle.disabled = toys.filter((toy) => !toy.disabled).length < 2
  const result = document.getElementById('ticket-result')
  const link = document.getElementById('play-link')
  result.replaceChildren()
  link.hidden = !featured
  if (!featured) {
    result.textContent = state === 'ready' ? t.empty : t[state]
    return
  }
  const title = document.createElement('h3')
  title.textContent = featured[lang].title
  const description = document.createElement('p')
  description.textContent = featured[lang].description
  result.append(title, description)
  link.href = `toys/${featured.slug}/`
  link.textContent = t.play
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    result.animate([{ opacity: 0.3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' })
  }
}
