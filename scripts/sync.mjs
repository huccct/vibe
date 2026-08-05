/**
 * 扫 toys/ 下每个目录的 meta.json，汇总成 toys/registry.json 给画廊用。
 * 纯静态托管没法在浏览器里列目录，所以这一步得在本地跑。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const toysDir = join(root, 'toys')

const REQUIRED = ['title', 'description', 'tags', 'accent', 'added']

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

  const missing = REQUIRED.filter((k) => meta[k] === undefined)
  if (missing.length) throw new Error(`toys/${entry.name}/meta.json 缺字段：${missing.join(', ')}`)

  toys.push({ slug: entry.name, ...meta })
}

toys.sort((a, b) => a.slug.localeCompare(b.slug))

await writeFile(join(toysDir, 'registry.json'), `${JSON.stringify(toys, null, 2)}\n`)
console.log(`registry.json ← ${toys.length} 个 toy：${toys.map((t) => t.slug).join(', ')}`)
