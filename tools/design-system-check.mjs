/**
 * Design-system guard rails for the settings page.
 *
 *   1. Every tm_* class the pages render must exist in lib/ui.css, and every
 *      rule in lib/ui.css must be used — a stale rule is dead weight, a missing
 *      one renders unstyled.
 *   2. Colour comes from theme tokens only: each var() must be a --tm-* alias or
 *      one of the tokens the shell actually publishes (cordis_inspect Theme).
 *   3. Every copy key a page looks up resolves in BOTH languages, through the
 *      same dotted-path walk the runtime uses.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const modules = ['../lib/skill/client.js', '../lib/subagent/client.js', '../lib/tail.js']
const css = read('../lib/ui.css')

const used = new Set()
for (const file of modules) {
  const source = read(file)
  for (const m of source.matchAll(/className: (?:'|")([^'"]+)(?:'|")/g)) {
    for (const name of m[1].split(/\s+/)) if (name.startsWith('tm_')) used.add(name)
  }
  for (const m of source.matchAll(/className: `([^`]+)`/g)) {
    for (const name of m[1].match(/tm_[a-z0-9_]+/g) ?? []) used.add(name)
  }
  for (const m of source.matchAll(/['"](tm_[a-z0-9_]+)['"]/g)) used.add(m[1])
}
const defined = new Set([...css.matchAll(/\.(tm_[a-z0-9_]+)/g)].map((m) => m[1]))

// A stylesheet must be lexically intact before its contents mean anything. An
// unbalanced comment is invisible to every pattern match above (the declarations
// are still literally present in the file) yet silently swallows every rule up to
// the next */ — which presents as "the UI vanished". Check the balance first.
assert.equal(
  (css.match(/\/\*/g) ?? []).length,
  (css.match(/\*\//g) ?? []).length,
  'lib/ui.css has balanced comment delimiters',
)
for (const m of css.matchAll(/\*\//g)) {
  const before = css.slice(0, m.index)
  assert.ok(
    (before.match(/\/\*/g) ?? []).length > (before.match(/\*\//g) ?? []).length,
    `lib/ui.css has a stray */ at line ${before.split('\n').length} (every terminator needs an opener before it)`,
  )
}
assert.ok(css.trimStart().startsWith('/*') || css.trimStart().startsWith(':'), 'lib/ui.css does not begin mid-comment')

assert.deepEqual([...used].filter((n) => !defined.has(n)), [], 'every rendered tm_* class has a rule')
assert.deepEqual([...defined].filter((n) => !used.has(n)), [], 'every tm_* rule is rendered by a page')

// Display layers must pass clicks through to the full-card edit button. Only
// real controls reclaim pointer events; making the entire footer interactive
// would reintroduce dead zones between its buttons.
const hitTestCss = css.replace(/\/\*[\s\S]*?\*\//g, '')
assert.match(hitTestCss, /\.tm_card > :where\(:not\(\.tm_card_title_button\)\)\s*\{[^}]*pointer-events:\s*none\s*;/, 'display layer uses zero-specificity :where so controls can override it')
assert.doesNotMatch(hitTestCss, /\.tm_card > \*:not\(\.tm_card_title_button\)\s*\{[^}]*pointer-events:\s*none/, 'old (0,2,0) rule must not override textarea control (0,1,1)')
assert.match(hitTestCss, /\.tm_card :is\(button, textarea, input, select, a, label\)\s*\{[^}]*pointer-events:\s*auto\s*;/, 'actual controls remain independently clickable')

// The published shell tokens (client inspect: Theme.listTokens), minus the
// aliases lib/ui.css is allowed to reference directly.
const shell = new Set([
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary', '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
])
const referenced = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))]
assert.deepEqual(
  referenced.filter((t) => !t.startsWith('--tm-') && !shell.has(t)),
  [],
  'no colour outside the shell palette',
)

// ── the failure that shipped as "the page has no UI at all" ────────────────
// The shell defines every --dsw-alias-* token on `body`; custom properties only
// inherit downwards, so an alias declared on :root/html above that element
// resolves to the empty value and takes its whole declaration down with it — no
// borders, no surfaces, text only. Two rules keep that from recurring:
//
//   1. the --tm-* layer is declared on body (or a descendant), never on :root;
//   2. every var() in the alias layer carries a literal fallback, so a missing
//      shell token degrades to a legible colour instead of dropping the rule.
//
// Comments are stripped first: prose about the selector is not the selector, and
// matching inside a comment is how a guard silently stops guarding.
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
const aliasMatch = code.match(/([^\n{}]+)\{([^}]*--tm-ink\s*:)/)
assert.ok(aliasMatch, 'the alias layer declares --tm-ink')
const aliasSelector = aliasMatch[1].trim()
assert.ok(
  !/(^|,)\s*(:root|html)\b/.test(aliasSelector),
  `the --tm-* alias layer must not be declared on "${aliasSelector}": it sits above body, where the shell defines --dsw-*, so its references resolve to nothing`,
)
assert.ok(
  /(^|,)\s*body\b/.test(aliasSelector),
  `the --tm-* alias layer is declared on "${aliasSelector}", which must be body (where the shell's tokens live)`,
)
for (const m of code.matchAll(/var\((--dsw-[\w-]+)\s*\)/g)) {
  assert.fail(`var(${m[1]}) has no literal fallback — if the shell renames or omits it, this rule silently disappears`)
}

// Every --tm-* the stylesheet consumes is declared in that layer, and every
// declared alias is consumed, so the palette cannot drift from the CSS using it.
const declared = new Set([...css.matchAll(/^\s*(--tm-[\w-]+):/gm)].map((m) => m[1]))
assert.deepEqual(
  referenced.filter((t) => t.startsWith('--tm-') && !declared.has(t)),
  [],
  'every --tm-* alias is declared',
)
for (const token of declared) {
  assert.ok(referenced.includes(token), `${token} is declared and used`)
}

// ── copy: load the bundle and resolve every lookup the way the page does ────
let definition
globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
// A distinct query keeps this import from reusing another check's cached module
// instance (ESM caches by URL, and a cached bundle never calls load() again).
await import(`${new URL('../lib/client.js', import.meta.url).href}?design-system-check`)
const plugin = definition.factory((name) => {
  if (name === 'react') {
    return {
      Component: class { constructor(props) { this.props = props } },
      createElement: (type, props, ...children) => ({ type, props, children }),
      useState: (value) => [value, () => {}],
      useEffect: () => {},
      useMemo: (factory) => factory(),
      useCallback: (callback) => callback,
      useRef: () => ({ current: null }),
      Fragment: 'fragment',
    }
  }
  throw new Error(`unexpected module ${name}`)
})

/** The runtime's own dotted lookup: nested keys or flat dotted keys both work. */
function lookup(table, key) {
  const direct = table[key]
  if (direct !== undefined) return direct
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), table)
}

const dicts = { skill: plugin.__test__.skill.__test__.DICT, subagent: plugin.__test__.subagent.__test__.DICT }
for (const [page, DICT] of Object.entries(dicts)) {
  const source = read(`../lib/${page}/client.js`)
  const keys = new Set([...source.matchAll(/\bt\('([^'$]+)'\)/g)].map((m) => m[1]))
  for (const key of keys) {
    for (const language of ['zh', 'en']) {
      const value = lookup(DICT[language], key)
      assert.ok(typeof value === 'string' && value !== '', `${page}.${language}: t('${key}') resolves`)
    }
  }
  // Dynamic lookups like t(`import.status.${row.status}`) need the family.
  const flatKeys = (table, prefix = '') => Object.entries(table).flatMap(([key, value]) => (
    value !== null && typeof value === 'object' ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  ))
  for (const m of source.matchAll(/\bt\(`([^`$]+)\$\{/g)) {
    const family = m[1].replace(/\.$/, '')
    for (const language of ['zh', 'en']) {
      assert.ok(
        flatKeys(DICT[language]).some((key) => key.startsWith(`${family}.`)),
        `${page}.${language}: dictionary has entries under "${family}."`,
      )
    }
  }
  // Each language declares the same key set.
  const flat = (table, prefix = '') => Object.entries(table).flatMap(([key, value]) => (
    value !== null && typeof value === 'object' ? flat(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  ))
  assert.deepEqual(flat(DICT.zh).sort(), flat(DICT.en).sort(), `${page}: zh and en declare the same keys`)
}

console.log('PASS: design system (classes, theme-token palette, aliases, bilingual copy)')
