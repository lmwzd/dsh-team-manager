/**
 * Render-shape checks: evaluate the real page components and assert the tree
 * they produce (classes, ARIA, what is hidden). This is not a browser — it
 * proves structure and wiring, not pixels.
 *
 * The design under test is a MODULE RACK: one surface divided into bays, each bay
 * showing a skill's name and your note about it, with state carried by a lamp and
 * a switch rather than by prose. The assertions below encode that intent, so a
 * future edit that reintroduces description walls or floating card stacks fails
 * here.
 */
import assert from 'node:assert/strict'

const fakeReact = {
  Component: class { constructor(props) { this.props = props } },
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useRef: (value) => ({ current: value }),
  Fragment: 'fragment',
}
let definition
globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
globalThis.document = {
  documentElement: { lang: 'zh' },
  createElement: () => ({ setAttribute() {}, textContent: '', remove() {} }),
  head: { appendChild() {} },
  getElementById: () => null,
}
await import(`${new URL('../lib/client.js', import.meta.url).href}?ui-render-check`)
const plugin = definition.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') throw new Error('react-dom unavailable')
  throw new Error(`unexpected module ${name}`)
})

/** Flatten an element tree produced by the stub createElement. */
const walk = (node, out = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) walk(child, out); return out }
  out.push(node)
  walk(node.children, out)
  return out
}
const texts = (node) => walk(node).flatMap((el) => (Array.isArray(el.children) ? el.children : [el.children]))
  .filter((child) => typeof child === 'string')
const byClass = (node, name) => walk(node).filter((el) => (el.props?.className ?? '').split(/\s+/).includes(name))

/** A page-local t(), so each bay is translated by its own dictionary. */
const translator = (page) => {
  const DICT = plugin.__test__[page].__test__.DICT
  return (key, values) => String(DICT.zh[key] ?? key)
    .replace(/\{(\w+)\}/g, (m, k) => (values?.[k] !== undefined ? String(values[k]) : m))
}
const noop = () => {}

// ── a skill bay ────────────────────────────────────────────────────────────
const tSkill = translator('skill')
const skill = {
  name: 'frontend-design', description: 'Distinctive visual design for UI.',
  enabled: true, auto: true, modelInvocable: true, files: ['SKILL.md'], bodyBytes: 7515,
  note: '页面改版时用它定调',
}
const bay = plugin.__test__.skill.__test__.SkillRow({
  t: tSkill, skill, onEdit: noop, onDelete: noop, onToggle: noop, onAuto: noop, onNote: async () => {},
})
const bayNodes = walk(bay)

// The bay is the layout unit, and its state is a lamp + a switch, not a badge.
assert.equal(bay.props.className, 'tm_card', 'an enabled skill is a normal card')
assert.equal(byClass(bay, 'tm_row').length, 0, 'no legacy roster row is rendered')
assert.equal(byClass(bay, 'tm_bay').length, 0, 'no legacy rack bay is rendered')

// The whole card is a click target: one focusable button behind the content,
// labelled for screen readers, that opens the editor.
const cardButton = bayNodes.find((el) => el.props?.className === 'tm_card_title_button')
assert.ok(cardButton, 'the card has a full-surface button')
assert.equal(cardButton.props.type, 'button')
assert.equal(cardButton.props['aria-label'], '编辑 frontend-design', 'the card button names what it opens')

// State is carried by buttons, not checkboxes: aria-pressed is the contract,
// and the visible label states the condition it is in.
const toggles = bayNodes.filter((el) => el.props?.className?.startsWith('tm_toggle'))
assert.equal(toggles.length, 2, 'the card has two state toggles')
assert.equal(bayNodes.filter((el) => el.props?.type === 'checkbox').length, 0, 'no checkbox switches remain on the card')
const enableToggle = toggles[0]
assert.equal(enableToggle.props.type, 'button')
assert.equal(enableToggle.props['aria-pressed'], true, 'the enable toggle reports pressed state')
assert.ok((enableToggle.props.className ?? '').includes('tm_on'), 'an on toggle uses the on (green) style')
assert.ok(texts({ children: [enableToggle] }).includes('已启用'), 'the toggle names its current state')

// Name is display text (not a competing button); the note is still editable.
assert.ok(texts(bay).includes('frontend-design'), 'the name is on the card')
const noteField = bayNodes.find((el) => el.props?.className?.startsWith('tm_card_note'))
assert.ok(noteField, 'the note is an editable field, not a read-only paragraph')
assert.equal(noteField.type, 'textarea', 'the note is a textarea')
assert.equal(noteField.props.value, '页面改版时用它定调', 'the note renders the stored value')
assert.equal(noteField.props.placeholder, '加一句备注…', 'an empty note invites one')
assert.equal(typeof noteField.props.onBlur, 'function', 'the note saves on blur')
assert.equal(typeof noteField.props.onChange, 'function', 'the note is editable')
assert.ok(!texts(bay).includes(skill.description), 'the frontmatter description is NOT shown in the bay')

// The foot holds the auto toggle and a delete button at the far right.
const autoToggle = toggles[1]
assert.equal(autoToggle.props['aria-pressed'], true)
assert.equal(autoToggle.props.disabled, false)
assert.equal(byClass(bay, 'tm_card_key').length, 0, 'the duplicated machine-name tag is gone')
const foot = byClass(bay, 'tm_card_foot')
assert.equal(foot.length, 1, 'the card ends in one foot row')
const del = bayNodes.find((el) => el.props?.className === 'tm_card_del')
assert.equal(del.props.type, 'button', 'delete is a button')
assert.equal(del.props['aria-label'], '删除 frontend-design', 'the delete button keeps a label')
// Delete is the last thing in the foot, i.e. bottom-right of the card.
const footKids = (foot[0].children ?? []).filter(Boolean)
assert.equal(footKids[footKids.length - 1], del, 'delete sits at the end of the foot row')

// A disabled skill loses the lamp and dims, without changing shape.
const offBay = plugin.__test__.skill.__test__.SkillRow({
  t: tSkill, skill: { ...skill, enabled: false, auto: false }, onEdit: noop, onDelete: noop, onToggle: noop, onAuto: noop, onNote: async () => {},
})
assert.equal(offBay.props.className, 'tm_card tm_card_off', 'a disabled skill is an off card')
const offNodes = walk(offBay)
const offToggles = offNodes.filter((el) => el.props?.className?.startsWith('tm_toggle'))
assert.ok((offToggles[0].props.className ?? '').includes('tm_off'), 'an off toggle uses the off (red) style')
assert.equal(offToggles[0].props['aria-pressed'], false)
assert.equal(offToggles[1].props.disabled, true, 'auto-invoke is unavailable while the skill is off')
assert.ok((offToggles[1].props.className ?? '').includes('tm_toggle_disabled'), 'the unavailable toggle is dimmed')
assert.ok(!texts(offBay).includes('已停用'), 'no duplicated status badge in the title')

// A skill without a note still has an empty field (not "undefined").
const bareBay = plugin.__test__.skill.__test__.SkillRow({
  t: tSkill, skill: { ...skill, note: '' }, onEdit: noop, onDelete: noop, onToggle: noop, onAuto: noop, onNote: async () => {},
})
const bareNote = walk(bareBay).find((el) => el.props?.className?.startsWith('tm_card_note'))
assert.equal(bareNote.props.value, '', 'a missing note renders as empty, never as text')

// ── a subagent bay ─────────────────────────────────────────────────────────
const tAgent = translator('subagent')
const agent = {
  name: 'peter', displayName: 'Peter · 后端工程师', description: '领域逻辑、确定性模拟、存档。',
  model: 'beichenapi/gpt-6.1-sol', thinking: 'high', deep: 1, maxChildren: 2, bodyBytes: 4096,
}
const aBay = plugin.__test__.subagent.__test__.AgentRow({ t: tAgent, agent, onEdit: noop, onDelete: noop })
const aNodes = walk(aBay)
assert.equal(aBay.props.className, 'tm_card')
assert.ok(walk(aBay).some((el) => el.props?.className === 'tm_card_title_button'), 'an agent card is clickable too')
const routeChip = aNodes.find((el) => el.props?.className === 'tm_chip tm_chip_accent')
assert.ok(routeChip, 'the model route is the bay\'s one accent')
assert.deepEqual(texts(routeChip), ['beichenapi/gpt-6.1-sol'])
assert.ok(texts(aBay).includes('Peter · 后端工程师'), 'the display name rides under the key')
assert.ok(!texts(aBay).includes(agent.description), 'the subagent description is NOT shown in the bay')
assert.ok(texts(aBay).includes('可派生 1 层 · 限 2 个下级'), 'depth and child cap read as one phrase')

// ── copy parity, and the paragraphs are gone on purpose ────────────────────
for (const page of ['skill', 'subagent']) {
  const DICT = plugin.__test__[page].__test__.DICT
  const flatten = (table, prefix = '') => Object.entries(table).flatMap(([key, value]) => (
    value !== null && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  ))
  assert.deepEqual(flatten(DICT.zh).sort(), flatten(DICT.en).sort(), `${page}: zh and en declare the same keys`)
  assert.equal(DICT.zh.subtitle, undefined, `${page}: no subtitle essay remains`)
  assert.equal(DICT.en.subtitle, undefined, `${page}: no subtitle essay remains (en)`)
  assert.ok(DICT.zh.count && DICT.en.count, `${page}: a count label exists`)
}

console.log('PASS: cards use state buttons (green/red), no duplicated key tag, delete bottom-right')
