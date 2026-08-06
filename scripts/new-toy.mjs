/**
 * pnpm new <slug> — 生成一个能跑的 toy 骨架，然后刷新 registry。
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const slug = process.argv[2]

if (!slug) {
  console.error('用法：pnpm new <slug>   例：pnpm new wave-clock')
  process.exit(1)
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`slug 只能是小写字母数字加连字符，收到：${slug}`)
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'toys', slug)

if (await exists(dir)) {
  console.error(`toys/${slug} 已经存在了`)
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

await mkdir(dir, { recursive: true })
await Promise.all([
  writeFile(join(dir, 'index.html'), html(slug)),
  writeFile(join(dir, 'main.js'), main()),
  writeFile(join(dir, 'meta.json'), meta(slug, today)),
])

console.log(`toys/${slug}/ 建好了。跑 pnpm sync 刷新画廊，然后 pnpm dev 打开看看。`)

function html(slug) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${slug} — vibe</title>
    <link rel="stylesheet" href="../../src/shared/vibe.css" />
  </head>
  <body>
    <div class="toy-shell">
      <div class="toy-bar">
        <a class="back" href="../../">← vibe</a>
        <h1>${slug}</h1>
      </div>
      <div class="toy-stage" id="stage"></div>
    </div>

    <script type="module" src="./main.js"></script>
  </body>
</html>
`
}

function main() {
  return `import { createStage, loop } from '../../src/shared/stage.js'

// 注意：createStage 的第二个参数（onResize）会在 createStage 返回之前同步跑一次，
// 那时下面这个 stage 还没赋值。回调里要用舞台就用它的第三个参数：(w, h, s) => ...
const stage = createStage(document.getElementById('stage'))

loop((dt, t) => {
  const { ctx, width, height } = stage
  ctx.fillStyle = '#08090c'
  ctx.fillRect(0, 0, width, height)

  // 占位：一个转圈的点。把这里换成你的想法。
  const r = Math.min(width, height) * 0.25
  ctx.fillStyle = '#9dff3c'
  ctx.beginPath()
  ctx.arc(width / 2 + Math.cos(t) * r, height / 2 + Math.sin(t) * r, 8, 0, Math.PI * 2)
  ctx.fill()
})
`
}

function meta(slug, today) {
  const name = slug.replace(/-/g, ' ')
  // 语言无关的放顶层，文案按语言分块。两种语言都得填，缺一个 pnpm sync 会报错
  return `${JSON.stringify(
    {
      accent: '#9dff3c',
      added: today,
      zh: {
        title: name,
        description: 'TODO 一句话说清这是什么',
        tags: ['互动'],
      },
      en: {
        title: name,
        description: 'TODO one line on what this is',
        tags: ['interactive'],
      },
    },
    null,
    2
  )}\n`
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}
