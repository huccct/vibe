/**
 * 语言状态。画廊和各 toy 页面共用。
 *
 * 选择存 localStorage，跨页面跟着走。第一次进来看浏览器语言，
 * 不是中文就给英文 —— 别人从 GitHub 点进来看到中文会一脸问号。
 */

const KEY = 'vibe:lang'
export const LANGS = ['zh', 'en']

/** @returns {'zh' | 'en'} */
export function getLang() {
  const saved = localStorage.getItem(KEY)
  if (LANGS.includes(saved)) return saved
  return navigator.language?.startsWith('zh') ? 'zh' : 'en'
}

/** @param {'zh' | 'en'} lang */
export function setLang(lang) {
  if (!LANGS.includes(lang)) throw new Error(`未知语言：${lang}`)
  localStorage.setItem(KEY, lang)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}

/**
 * 装一个语言切换按钮。点了就切、存下来、调 onChange 重渲染。
 * @param {HTMLElement} host 按钮挂在哪
 * @param {(lang: 'zh' | 'en') => void} onChange
 */
export function mountLangToggle(host, onChange) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'lang-toggle'

  const paint = () => {
    const lang = getLang()
    // 按钮上显示的是「切过去」的那个语言，不是当前语言
    const next = lang === 'zh' ? 'en' : 'zh'
    btn.textContent = next === 'zh' ? '中文' : 'EN'
    btn.setAttribute('aria-label', next === 'zh' ? '切换到中文' : 'Switch to English')
  }

  btn.addEventListener('click', () => {
    setLang(getLang() === 'zh' ? 'en' : 'zh')
    paint()
    onChange(getLang())
  })

  paint()
  host.append(btn)
  return btn
}

/** 页面一进来就把 <html lang> 摆正，别让屏幕阅读器读错语言。 */
export function applyLangAttr() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en'
}
