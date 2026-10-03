// Run with node scripts/check-gallery.mjs. Exercise sync in a disposable repository.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = await mkdtemp(join(tmpdir(), 'vibe-check-'))
try {
  await mkdir(join(root, 'scripts'))
  await mkdir(join(root, 'toys', 'sample'), { recursive: true })
  await copyFile(new URL('./sync.mjs', import.meta.url), join(root, 'scripts/sync.mjs'))
  for (const name of ['README.md', 'README.zh-CN.md']) {
    await writeFile(join(root, name), '<!-- ideas:start -->\n<!-- ideas:end -->\n')
  }
  const copy = { title: 'Sample', description: 'A | B', tags: [] }
  const meta = { accent: '#ffffff', added: '2026-10-03', zh: copy, en: copy }
  const save = () => writeFile(join(root, 'toys/sample/meta.json'), JSON.stringify(meta))
  const sync = () => spawnSync(process.execPath, [join(root, 'scripts/sync.mjs')], { encoding: 'utf8' })
  await save()
  assert.equal(sync().status, 0)
  assert.match(await readFile(join(root, 'README.zh-CN.md'), 'utf8'), /待补充/)
  meta.models = ['Test model A', 'Test model B']
  await save()
  assert.equal(sync().status, 0)
  const registry = JSON.parse(await readFile(join(root, 'toys/registry.json'), 'utf8'))
  assert.deepEqual(registry[0].models, meta.models)
  const readme = await readFile(join(root, 'README.md'), 'utf8')
  assert.ok(readme.includes('A \\| B'))
  assert.ok(readme.includes('Test model A · Test model B'))
  assert.equal(sync().status, 0)
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), readme)
  meta.modelCredit = 'maintenance'
  await save()
  assert.equal(sync().status, 0)
  assert.match(await readFile(join(root, 'README.md'), 'utf8'), /later edits/)
  meta.hidden = true
  await save()
  assert.equal(sync().status, 0)
  assert.deepEqual(JSON.parse(await readFile(join(root, 'toys/registry.json'), 'utf8')), [])
  assert.ok(!(await readFile(join(root, 'README.md'), 'utf8')).includes('toys/sample/'))
  meta.hidden = false
  meta.models = [' ']
  await save()
  assert.notEqual(sync().status, 0)
  console.log('Gallery sync checks passed: unknown / multiple / invalid credits, Markdown escaping, idempotence.')
} finally {
  await rm(root, { recursive: true, force: true })
}

const { pickToy } = await import('../src/gallery/discovery.js')
const choices = [{ slug: 'one' }, { slug: 'two' }, { slug: 'closed', disabled: true }, { slug: 'hidden', hidden: true }]
assert.equal(pickToy([]), undefined)
assert.equal(pickToy(choices.slice(2)), undefined)
assert.equal(pickToy([{ slug: 'one' }], 'one').slug, 'one')
assert.equal(pickToy(choices, 'one').slug, 'two')
assert.equal(pickToy(choices, 'two').slug, 'one')
console.log('Discovery checks passed: no repeats, unavailable toys excluded, empty and single collections.')
