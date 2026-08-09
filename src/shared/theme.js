(() => {
  const root = document.documentElement
  const key = 'vibe:theme'
  const opposite = (theme) => theme === 'dark' ? 'light' : 'dark'
  const saved = localStorage.getItem(key)
  root.dataset.theme = ['light', 'dark'].includes(saved)
    ? saved
    : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

  const mount = () => {
    const host = document.querySelector('.gallery-lang, .toy-bar')
    if (!host) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'theme-toggle'

    const paint = () => {
      const toLight = root.dataset.theme === 'dark'
      button.textContent = toLight ? '☀︎' : '☾'
      button.title = button.ariaLabel = toLight
        ? '切换明亮色 / Switch to light'
        : '切换暗色 / Switch to dark'
    }

    button.addEventListener('click', () => {
      root.dataset.theme = opposite(root.dataset.theme)
      localStorage.setItem(key, root.dataset.theme)
      paint()
    })

    paint()
    host.append(button)
  }

  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount()
  console.assert(opposite(opposite('dark')) === 'dark')
})()
