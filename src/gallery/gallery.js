/**
 * 渲染画廊。数据来自 toys/registry.json（由 `pnpm sync` 从各 toy 的 meta.json 汇总生成）。
 */

const grid = document.getElementById('grid')
const count = document.getElementById('count')

const res = await fetch('toys/registry.json')
if (!res.ok) throw new Error(`registry.json 读不到：${res.status}`)
const toys = await res.json()

// 新的排前面
toys.sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title))

if (toys.length === 0) {
  grid.innerHTML = '<p class="empty">还没有东西。跑 <code>pnpm new my-toy</code> 加一个。</p>'
} else {
  grid.append(...toys.map(card))
}

count.textContent = `${toys.length} 个玩意儿`

function card(toy) {
  const a = document.createElement('a')
  a.className = 'card'
  a.href = `toys/${toy.slug}/`
  a.style.setProperty('--card-accent', toy.accent)

  const thumb = document.createElement('div')
  thumb.className = 'card-thumb'

  const body = document.createElement('div')
  body.className = 'card-body'

  const h2 = document.createElement('h2')
  h2.textContent = toy.title

  const p = document.createElement('p')
  p.textContent = toy.description

  const tags = document.createElement('div')
  tags.className = 'tags'
  tags.append(
    ...toy.tags.map((t) => {
      const s = document.createElement('span')
      s.textContent = t
      return s
    })
  )

  body.append(h2, p, tags)
  a.append(thumb, body)
  return a
}
