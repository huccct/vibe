const skills = [
  {
    id: 'find-skills',
    number: '01',
    symbol: '⌕',
    color: '#caff3d',
    name: 'find-skills',
    label: 'AI 的应用商店导购',
    line: '不知道该装什么？让 AI 自己去 Skills 市场里找。',
    forWho: '适合刚开始折腾 Skills、不想自己翻排行榜的人。',
    example: '帮我找一个能把长文章整理成小红书图文的 Skill。先比较来源、安装量和安全审计，再问我要不要安装。',
    command: 'npx skills add https://github.com/vercel-labs/skills --skill find-skills',
    url: 'https://skills.sh/vercel-labs/skills/find-skills',
  },
  {
    id: 'frontend-design',
    number: '02',
    symbol: '◇',
    color: '#ff6b4a',
    name: 'frontend-design',
    label: '网页审美纠偏器',
    line: '专治紫色渐变、发光卡片和千篇一律的 AI 官网。',
    forWho: '适合想让 AI 做网页，但受不了“模板味”的人。',
    example: '使用 frontend-design 给我做一个个人作品页。先确定一种鲜明的视觉方向，再写代码；不要默认紫色渐变和通用 SaaS 卡片。',
    command: 'npx skills add https://github.com/anthropics/skills --skill frontend-design',
    url: 'https://skills.sh/anthropics/skills/frontend-design',
  },
  {
    id: 'agent-browser',
    number: '03',
    symbol: '↗',
    color: '#66d9ff',
    name: 'agent-browser',
    label: '让 AI 真正动手上网',
    line: '不只读网页，还能点击、填写、截图和测试。',
    forWho: '适合需要重复操作网页、测试页面或整理公开信息的人。',
    example: '使用 agent-browser 打开这个网页，检查手机尺寸下有没有文字重叠，并截一张图告诉我问题在哪里。不要提交任何表单。',
    command: 'npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser',
    url: 'https://skills.sh/vercel-labs/agent-browser/agent-browser',
    note: '第一次使用时可能还要安装浏览器组件，直接让 AI 按官方提示完成。',
  },
  {
    id: 'grill-me',
    number: '04',
    symbol: '?',
    color: '#f1b84b',
    name: 'grill-me',
    label: '专门给你的想法挑刺',
    line: '它不会上来就夸你，而是一直问到方案真的站得住。',
    forWho: '适合做产品、写方案，或者脑子里只有一个模糊点子的人。',
    example: '使用 grill-me 质疑这个想法：我要做一个帮人挑选 AI 工具的网站。一次只问我一个问题，直到目标用户、差异和验证方法都清楚。',
    command: 'npx skills add https://github.com/mattpocock/skills --skill grill-me',
    url: 'https://skills.sh/mattpocock/skills/grill-me',
  },
  {
    id: 'hyperframes',
    number: '05',
    symbol: '▶',
    color: '#b38cff',
    name: 'hyperframes',
    label: '用网页代码做视频',
    line: 'HTML、CSS 和动画不只能做网页，也能直接渲染成视频。',
    forWho: '适合产品演示、动态海报、数据视频和无真人出镜内容。',
    example: '使用 HyperFrames，把我的产品网页做成一条 20 秒竖屏视频。先给我分镜和视觉方向，确认后再制作。',
    command: 'npx skills add https://github.com/heygen-com/hyperframes --skill hyperframes',
    url: 'https://skills.sh/heygen-com/hyperframes/hyperframes',
    note: '它能把画面做出来，但节奏、故事和审美仍然需要你做判断。',
  },
]

const skillsEl = document.getElementById('skills')
const toast = document.getElementById('toast')

skillsEl.innerHTML = skills.map((skill) => `
  <article class="skill-card" id="${skill.id}" style="--accent:${skill.color}">
    <div class="skill-side">
      <span class="skill-number">${skill.number}</span>
      <span class="skill-symbol">${skill.symbol}</span>
    </div>
    <div class="skill-main">
      <header>
        <div>
          <p>${skill.label}</p>
          <h3>${skill.name}</h3>
        </div>
        <a href="${skill.url}" target="_blank" rel="noreferrer" aria-label="查看 ${skill.name} 的来源">查看来源 ↗</a>
      </header>
      <p class="skill-line">${skill.line}</p>
      <p class="skill-for"><b>适合你，如果：</b>${skill.forWho}</p>
      <div class="skill-actions">
        <button class="action primary" data-copy="${escapeAttr(skill.command)}">复制安装命令</button>
        <button class="action" data-copy="${escapeAttr(skill.example)}">复制使用示例</button>
      </div>
      <details>
        <summary>完全小白怎么装？</summary>
        <div class="beginner-box">
          <p>打开你电脑里的 Codex 或 Claude Code，把下面这段话直接发给它：</p>
          <blockquote>请帮我安装 <b>${skill.name}</b>。官方页面是 ${skill.url}。安装完成后检查它是否可用，并给我一个最简单的使用示例；如果需要额外权限，请先解释。</blockquote>
          <button class="text-copy" data-copy="${escapeAttr(`请帮我安装 ${skill.name}。官方页面是 ${skill.url}。安装完成后检查它是否可用，并给我一个最简单的使用示例；如果需要额外权限，请先解释。`)}">复制这段话</button>
          ${skill.note ? `<p class="skill-note">${skill.note}</p>` : ''}
        </div>
      </details>
    </div>
  </article>
`).join('')

const allPrompt = `请帮我依次安装下面 5 个 Agent Skills，并在全部完成后逐个检查是否可用：

1. npx skills add https://github.com/vercel-labs/skills --skill find-skills
2. npx skills add https://github.com/anthropics/skills --skill frontend-design
3. npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
4. npx skills add https://github.com/mattpocock/skills --skill grill-me
5. npx skills add https://github.com/heygen-com/hyperframes --skill hyperframes

如果需要安装依赖、访问账号或取得额外权限，请先解释用途再操作。最后用一句人话告诉我每个 Skill 应该怎么调用。`

document.getElementById('allPrompt').textContent = allPrompt

document.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy], [data-copy-target]')
  if (copyButton) {
    const targetId = copyButton.dataset.copyTarget
    const text = targetId ? document.getElementById(targetId).textContent : copyButton.dataset.copy
    await copyText(text)
    showToast(copyButton.dataset.copyTarget ? '整套安装说明已复制' : '已复制，可以去粘贴了')
    copyButton.classList.add('copied')
    const old = copyButton.textContent
    copyButton.textContent = '复制好了 ✓'
    setTimeout(() => {
      copyButton.textContent = old
      copyButton.classList.remove('copied')
    }, 1600)
    return
  }

  const goal = event.target.closest('[data-target]')
  if (goal) {
    const card = document.getElementById(goal.dataset.target)
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    card.classList.remove('pulse')
    requestAnimationFrame(() => card.classList.add('pulse'))
  }
})

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

let toastTimer
function showToast(message) {
  toast.textContent = message
  toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800)
}

function escapeAttr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
