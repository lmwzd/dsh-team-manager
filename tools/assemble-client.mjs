/**
 * Reassemble lib/client.js from its two hand-authored module halves.
 *
 * `lib/client.js` is the single file the DSH web shell loads through
 * window.__ModuleLoader__; package.json exports only that path. It is not
 * edited by hand: it is the concatenation of
 *
 *   lib/skill/client.js      (Skill page)
 *   lib/subagent/client.js   (Subagent page)
 *   lib/tail.js              (shell: tab frame + module switches)
 *
 * plus `lib/ui.css`, hoisted to one `const UI_CSS` both halves style from — so
 * the stylesheet has exactly one source of truth and one <style> element.
 *
 *   node tools/assemble-client.mjs           # rewrite lib/client.js
 *   node tools/assemble-client.mjs --check   # fail if it is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n')
const path = (rel) => fileURLToPath(new URL(rel, root))

/** Lines between `factory: (require) => {` and the closing `},` / `})`. */
function innerLines(source, file) {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => /^\s*factory: \(require\) => \{$/.test(line))
  if (start < 0) throw new Error(`${file}: no factory line`)
  let end = lines.length - 1
  while (end > start && lines[end].trim() === '') end -= 1
  if (lines[end] !== '})' || lines[end - 1] !== '  },') {
    throw new Error(`${file}: unexpected tail — expected "  }," then "})"`)
  }
  const body = lines.slice(start + 1, end - 1)
  if (body.some((line) => line.includes('const CSS ='))) {
    throw new Error(`${file}: carries its own CSS — styles live only in lib/ui.css`)
  }
  return body
}

const css = read('lib/ui.css').trimEnd()
if (css.includes('`') || css.includes('${')) {
  throw new Error('lib/ui.css must not contain a backtick or ${ (it is inlined into a template literal)')
}

const assembled = [
  '/** TeamManeger: one settings section, two retained-state tabs. */',
  'window.__ModuleLoader__.load({',
  " id: 'dsh-team-manager',",
  ' factory: (require) => {',
  " const React = require('react')",
  ' const { createElement: h, useState } = React',
  '',
  ' // Single stylesheet for both pages and the tab frame (lib/ui.css).',
  ' const UI_CSS = `',
  css,
  '`',
  '',
  ' const skill = ((require) => {',
  ...innerLines(read('lib/skill/client.js'), 'lib/skill/client.js'),
  '  })(require)',
  'const subagent = ((require) => {',
  ...innerLines(read('lib/subagent/client.js'), 'lib/subagent/client.js'),
  '  })(require)',
  ...read('lib/tail.js').replace(/\n$/, '').split('\n'),
  '',
].join('\n')

const current = read('lib/client.js')
if (process.argv.includes('--check')) {
  if (current !== assembled) {
    console.error('FAIL: lib/client.js is out of date — run node tools/assemble-client.mjs')
    process.exitCode = 1
  } else {
    console.log('PASS: lib/client.js matches its module sources')
  }
} else {
  writeFileSync(path('lib/client.js'), assembled)
  console.log(`assembled lib/client.js (${assembled.length} bytes, ${assembled.split('\n').length - 1} lines)`)
}
