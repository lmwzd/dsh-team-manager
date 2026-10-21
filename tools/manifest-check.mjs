import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

// Compatibility is checked against runtime interfaces, never a DSH version.
assert.ok(!Object.hasOwn(manifest.engines ?? {}, 'dsh'), 'engines.dsh must be absent')
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const name of Object.keys(manifest[section] ?? {})) {
    assert.ok(!/^(?:@deepseek-ai\/)?dsh(?:-|$)/.test(name), `${section}.${name} must be absent; do not pin DSH runtime packages`)
  }
}

// Package entry contracts; runtime imports are not dependency version pins.
assert.equal(manifest.type, 'module')
assert.equal(manifest.main, 'lib/index.js')
assert.equal(manifest.exports?.['.']?.default, './lib/index.js')
assert.equal(manifest.exports?.['./client']?.default, './lib/client.js')
assert.equal(manifest.exports?.['./package.json'], './package.json')
assert.equal(manifest.dsh?.manifestVersion, 1)
assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
assert.equal(manifest.dsh?.client?.platform, 'web')
assert.equal(manifest.dsh?.client?.immediately, true)
for (const path of [manifest.main, manifest.exports['./client'].default, manifest.dsh.bundle.patch]) {
  assert.ok(existsSync(new URL(path, root)), `package entry ${path} must exist`)
}
const patch = readFileSync(new URL(manifest.dsh.bundle.patch, root), 'utf8')
assert.ok(patch.includes("name: 'dsh-team-manager'"), 'patch mounts the package itself')
assert.ok(patch.includes("name: 'dsh-team-manager/recycle'"), 'patch registers a separate recycle component')
for (const key of ['./recycle', './recycle/icon', './recycle/locale/*.json']) {
  assert.ok(manifest.exports[key], `recycle component exports ${key}`)
}
for (const language of ['zh', 'en']) {
  const metadata = JSON.parse(readFileSync(new URL(`lib/recycle/locale/${language}.json`, root), 'utf8'))
  assert.ok(metadata.meta.title && metadata.meta.description, `recycle ${language} display copy`)
}
assert.equal(JSON.parse(readFileSync(new URL('lib/recycle/locale/zh.json', root), 'utf8')).meta.title, '会话回收站')
console.log('PASS: package entries exist; no DSH engine requirement or runtime dependency pins')
