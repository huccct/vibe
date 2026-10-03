/**
 * 扫 toys/ 下每个目录的 meta.json，汇总成 toys/registry.json 给画廊用。
 * 纯静态托管没法在浏览器里列目录，所以这一步得在本地跑。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const toysDir = join(root, 'toys')

const LANGS = ['zh', 'en']
const SHARED = ['accent', 'added']
const PER_LANG = ['title', 'description', 'tags']

const entries = await readdir(toysDir, { withFileTypes: true })
const toys = []

for (const entry of entries) {
  if (!entry.isDirectory()) continue

  const metaPath = join(toysDir, entry.name, 'meta.json')
  let meta
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`toys/${entry.name}/meta.json 不存在`)
    throw new Error(`toys/${entry.name}/meta.json 解析失败：${err.message}`)
  }

  if (meta.hidden) continue

  // 语言无关的字段在顶层，文案按语言分块 —— 少一种语言就报错，
  // 否则画廊切过去会是一片 undefined
  const missing = SHARED.filter((k) => meta[k] === undefined)
  for (const lang of LANGS) {
    if (!meta[lang]) {
      missing.push(lang)
      continue
    }
    missing.push(...PER_LANG.filter((k) => meta[lang][k] === undefined).map((k) => `${lang}.${k}`))
  }
  if (missing.length) throw new Error(`toys/${entry.name}/meta.json 缺字段：${missing.join(', ')}`)

  if (meta.models !== undefined && (!Array.isArray(meta.models) || meta.models.some((model) => typeof model !== 'string' || !model.trim()))) {
    throw new Error(`toys/${entry.name}/meta.json models 必须是非空模型名称的数组`)
  }

  toys.push({ slug: entry.name, ...meta })
}

toys.sort((a, b) => a.slug.localeCompare(b.slug))

await writeFile(join(toysDir, 'registry.json'), `${JSON.stringify(toys, null, 2)}\n`)
console.log(`registry.json ← ${toys.length} 个 toy：${toys.map((t) => t.slug).join(', ')}`)

// ponytail: keep the two README indexes in sync with the same metadata as the gallery.
for (const lang of LANGS) {
  const path = join(root, lang === 'zh' ? 'README.zh-CN.md' : 'README.md')
  const document = await readFile(path, 'utf8')
  const header = lang === 'zh' ? '| 案例 | 简介 | 制作模型 |' : '| Idea | Description | Made with |'
  const escape = (text) => text.replaceAll('|', '\\|').replaceAll('\n', ' ')
  const rows = [...toys].sort((a, b) => b.added.localeCompare(a.added) || a[lang].title.localeCompare(b[lang].title)).map((toy) =>
    `| [${escape(toy[lang].title)}](toys/${toy.slug}/) | ${escape(toy[lang].description)} | ${escape(toy.models?.length ? toy.models.join(' · ') + (toy.modelCredit === 'maintenance' ? (lang === 'zh' ? '（后续整理）' : ' (later edits)') : '') : lang === 'zh' ? '待补充' : 'To be added')} |`
  )
  await writeFile(path, document.replace(/<!-- ideas:start -->[\s\S]*?<!-- ideas:end -->/, `<!-- ideas:start -->\n${header}\n| --- | --- | --- |\n${rows.join('\n')}\n<!-- ideas:end -->`))
}
