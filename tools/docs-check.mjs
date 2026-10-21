/** Check published documentation, diagram assets and portable agent examples. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAgentMarkdown } from '../lib/subagent/agents.js'

const root = fileURLToPath(new URL('../', import.meta.url))
for (const file of ['README.md', 'CHANGELOG.md', 'docs/DEVELOPMENT.md', 'examples/agents/README.md']) {
  const absolute = resolve(root, file)
  const text = readFileSync(absolute, 'utf8')
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split(/\s+"/)[0]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const path = decodeURIComponent(target.split('#')[0])
    assert.ok(existsSync(resolve(dirname(absolute), path)), `${file}: broken local link ${target}`)
  }
  assert.ok(!/C:[\\/]Users[\\/]|D:[\\/]Agent[\\/]Work/.test(text), `${file}: no maintainer home paths`)
}

const stems = ['01-entry-map', '02-skill-actions', '03-subagent-setup', '04-recycle-flow']
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
for (const stem of stems) {
  const png = readFileSync(resolve(root, `docs/images/${stem}.png`))
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${stem}: valid PNG signature`)
  assert.equal(png.readUInt32BE(16), 1440)
  assert.equal(png.readUInt32BE(20), 1000)
  const svg = readFileSync(resolve(root, `docs/images/${stem}.svg`), 'utf8')
  assert.ok(svg.includes('<title id="title">') && svg.includes('非运行界面截图'), `${stem}: accessible, honest illustration label`)
  assert.ok(!/<script|<foreignObject|https?:\/\/(?!www\.w3\.org)/i.test(svg), `${stem}: no script or remote resources`)
  assert.ok(readme.includes(`docs/images/${stem}.png`), `${stem}: image included in the user guide`)
}
const names = ['alice', 'kare', 'limo', 'peter', 'tom']
const directory = resolve(root, 'examples/agents')
assert.deepEqual(readdirSync(directory).sort(), ['README.md', ...names.map(name => `${name}.md`)].sort())
for (const name of names) {
  const path = resolve(directory, `${name}.md`)
  const text = readFileSync(path, 'utf8')
  const parsed = parseAgentMarkdown(text, path)
  assert.equal(parsed.ok, true, parsed.error)
  assert.equal(parsed.agent.meta.name, name)
  assert.equal(parsed.agent.meta.model, undefined, 'examples inherit the user model')
  assert.equal(parsed.agent.meta.thinking, undefined, 'examples inherit the user effort')
  assert.ok(!/BKM|宝可梦|24313|beichenapi|beishenst|beichends/.test(text), `${name}: portable example`)
}
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
for (const entry of ['docs/images', 'docs/DEVELOPMENT.md', 'examples', 'CHANGELOG.md']) {
  assert.ok(manifest.files.includes(entry), `${entry}: distributed with the release`)
}
console.log('PASS: documentation links, four illustrated PNG/SVG guides, five portable agent examples, distribution manifest')
