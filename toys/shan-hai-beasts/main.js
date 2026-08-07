import { applyLangAttr, getLang, mountLangToggle } from '../../src/shared/i18n.js'
import { BEASTS, nextIndex } from './catalog.js'

const beast = document.getElementById('beast')
const name = document.getElementById('name')
const habitat = document.getElementById('habitat')
const lore = document.getElementById('lore')
const next = document.getElementById('next')
let index = Math.floor(Math.random() * BEASTS.length)

applyLangAttr()
mountLangToggle(document.getElementById('lang'), render)
next.addEventListener('click', () => {
  index = nextIndex(index)
  render()
  document.querySelector('.page').animate(
    [{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
    { duration: 360, easing: 'ease-out' },
  )
})
render()

function render() {
  const lang = getLang()
  const [beastName, place, story] = BEASTS[index][lang]
  const col = index % 3
  const row = Math.floor(index / 3)
  beast.style.backgroundPosition = `${col * 50}% ${row * 50}%`
  beast.setAttribute('aria-label', beastName)
  name.textContent = beastName
  habitat.textContent = lang === 'zh' ? `栖于 · ${place}` : `Habitat · ${place}`
  lore.textContent = story
  document.getElementById('folio').textContent = `${String(index + 1).padStart(2, '0')} / ${BEASTS.length}`
  document.getElementById('eyebrow').textContent = lang === 'zh' ? '山海遗卷 · 异兽志' : 'Lost leaves · A bestiary'
  document.getElementById('title').textContent = lang === 'zh' ? '山海异兽图鉴' : 'Mythical Beast Field Guide'
  document.getElementById('hint').textContent = lang === 'zh' ? '翻一页，遇见一只异兽' : 'Turn a page, meet a beast'
  next.textContent = lang === 'zh' ? '翻一页' : 'turn page'
  document.title = lang === 'zh' ? '山海异兽图鉴 — vibe' : 'Mythical Beast Field Guide — vibe'
}
