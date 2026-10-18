import assert from 'node:assert/strict'

const pageEffects = []
const stateValues = []
const fakeReact = {
  Component: class { constructor(props) { this.props = props } },
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (value) => [value, next => stateValues.push(next)],
  useEffect: effect => pageEffects.push(effect),
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useRef: () => ({ current: null }),
  Fragment: 'fragment',
}
let definition
globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
await import(new URL('../lib/client.js', import.meta.url).href)
assert.ok(definition, 'client bundle registers through __ModuleLoader__')
assert.equal(definition.id, 'dsh-team-manager')
const plugin = definition.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') throw new Error('react-dom unavailable in this smoke test')
  throw new Error(`unexpected module ${name}`)
})
assert.equal(plugin.name, 'dsh-team-manager')
assert.ok(Array.isArray(plugin.inject) && plugin.inject.includes('slots'))
assert.equal(typeof plugin.apply, 'function')
assert.equal(typeof plugin.__test__.TeamPage, 'function')
for (const name of ['skill', 'subagent']) {
  assert.equal(typeof plugin.__test__[name].Page, 'function', `${name} must export its embedded page component`)
}
const { DICT } = plugin.__test__.skill.__test__
for (const [language, table] of Object.entries(DICT)) {
  for (const key of ['auto', 'autoTitle', 'autoUnavailable', 'autoModelDisabled']) {
    assert.equal(typeof table[key], 'string', `${language}.${key} copy exists`)
    assert.ok(table[key].length > 0, `${language}.${key} copy is not empty`)
  }
}
for (const key of ['auto', 'autoTitle', 'autoUnavailable', 'autoModelDisabled']) {
  assert.notEqual(DICT.zh[key], DICT.en[key], `${key} is translated`)
}

// The bundle must expose exactly one settings page: TeamManeger. Child modules
// only contribute dictionaries/styles; a second settings.section would pull
// Skill or Subagent out as a standalone settings entry.
globalThis.document = {
  createElement: () => ({ setAttribute() {}, textContent: '', remove() {} }),
  head: { appendChild() {} },
}
const injected = []
const registrations = []
const ctx = {
  locale: {
    bind: () => (key) => key,
    register: () => () => {},
    getLocale: () => ({ active: 'zh' }),
  },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  slots: {
    inject(slot, callback) {
      injected.push(slot)
      registrations.push(callback())
    },
    register(options) {
      return { options }
    },
  },
}
plugin.apply(ctx)
assert.deepEqual(injected, ['settings.section'], 'only TeamManeger injects settings.section')
assert.equal(registrations.length, 1, 'only one settings page is registered')
assert.equal(registrations[0].options.id, 'dsh-team-manager')
const savedFetch = globalThis.fetch
try {
  globalThis.fetch = async url => url.endsWith('/status')
    ? { json: async () => ({ stopped: true, reason: 'test missing interface' }) }
    : { ok: false, status: 404, text: async () => '' }
  plugin.__test__.TeamPage({ locale: ctx.locale })
  const cleanup = pageEffects.pop()()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(stateValues.some(value => typeof value === 'string' && value.includes('test missing interface')), 'empty 404 displays backend diagnosis instead of JSON parse error')
  cleanup()
} finally { globalThis.fetch = savedFetch }
console.log('PASS: client loads, one settings page, localized auto-invoke copy, empty 404 diagnosis')
