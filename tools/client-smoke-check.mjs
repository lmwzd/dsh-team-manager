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
// The stylesheet is installed once, by the shell, from the shared lib/ui.css.
const created = []
const appended = []
globalThis.document = {
  createElement: (tag) => {
    const node = {
      tag, attrs: {}, textContent: '',
      setAttribute(k, v) { this.attrs[k] = v },
      remove() { const i = appended.indexOf(this); if (i >= 0) appended.splice(i, 1) },
    }
    created.push(node)
    return node
  },
  head: { appendChild(node) { appended.push(node) } },
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

// Exactly one stylesheet, holding the whole design system: both pages share it,
// so a page cannot drift its own private palette.
const styles = created.filter((node) => node.tag === 'style')
assert.equal(styles.length, 1, 'the shell installs exactly one <style>')
assert.equal(styles[0].attrs['data-plugin'], 'dsh-team-manager')
assert.ok(styles[0].textContent.includes('--tm-ink:'), 'theme aliases are installed')
assert.ok(styles[0].textContent.includes('.tm_grid'), 'card grid layout is installed')
assert.ok(styles[0].textContent.includes('.tm_card'), 'card surface is installed')
assert.ok(styles[0].textContent.includes('.tm_toggle'), 'state toggle buttons are installed')
assert.ok(!styles[0].textContent.includes('.skm_') && !styles[0].textContent.includes('.sm_card'), 'legacy private sheets are gone')
assert.ok(!styles[0].textContent.includes('.tm_roster') && !styles[0].textContent.includes('.tm_bay'), 'the old roster and rack sheets are gone')
const savedFetch = globalThis.fetch
try {
  globalThis.fetch = async url => url.endsWith('/status')
    ? { json: async () => ({ stopped: true, reason: 'test missing interface' }) }
    : { ok: false, status: 404, text: async () => '' }
  plugin.__test__.TeamPage({ locale: ctx.locale })
  // The frame mounts two effects (load the module flags, then pick a usable
  // tab); only the first one talks to the backend.
  const cleanups = pageEffects.map(effect => effect()).filter(dispose => typeof dispose === 'function')
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(stateValues.some(value => typeof value === 'string' && value.includes('test missing interface')), 'empty 404 displays backend diagnosis instead of JSON parse error')
  cleanups.forEach(dispose => dispose())
} finally { globalThis.fetch = savedFetch }
/** Flatten a fake-element tree (createElement returns {type, props, children}). */
function walk(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { node.forEach((child) => walk(child, out)); return out }
  out.push(node)
  walk(node.children, out)
  return out
}

// The frame: one tab bar, two tabs, and a panel per page with the inactive one
// hidden — tabs and panels stay mounted so switching keeps each page's state.
const frame = walk(plugin.__test__.TeamPage({ locale: ctx.locale }))
const tabs = frame.filter((el) => el.props?.role === 'tab')
assert.equal(tabs.length, 2, 'Skill and Subagent are the two tabs')
assert.deepEqual(tabs.map((el) => el.props.id), ['team-tab-skill', 'team-tab-subagent'])
assert.deepEqual(tabs.map((el) => el.props['aria-selected']), [true, false], 'the Skill tab starts selected')
const panels = frame.filter((el) => el.props?.role === 'tabpanel')
assert.equal(panels.length, 2, 'each tab owns a panel')
assert.deepEqual(panels.map((el) => el.props.hidden), [false, true], 'only the selected panel is shown')
for (const el of tabs) {
  assert.equal(el.props.className, 'tm_tab', 'tabs use the shared stylesheet')
  assert.equal(el.props.type, 'button', 'tabs are real buttons')
}
const switches = frame.filter((el) => el.props?.role === 'switch')
assert.equal(switches.length, 2, 'each module has one switch')
assert.ok(switches.every((el) => el.props.disabled === true), 'switches stay disabled until the config loads')
assert.equal(frame[0].props.className, 'tm_shell')

console.log('PASS: client loads, one settings page, one stylesheet, tabs and panel wiring, empty 404 diagnosis')
