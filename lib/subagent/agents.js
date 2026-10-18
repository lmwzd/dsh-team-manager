/**
 * Custom-agent definitions as markdown files — one file per subagent.
 *
 * A subagent is `<agents-dir>/<name>.md`: a `---` frontmatter block carrying
 * its identity (name / display name / description / model route / thinking
 * effort / spawn permission / spawn-depth budget / child cap / background
 * default / round cap), followed by a
 * markdown body that is the agent's persona — its 设定说明书 / system prompt.
 *
 *   ---
 *   name: workhorse
 *   display_name: 牛马狗
 *   description: "干活的主力"
 *   model: opencode-go/deepseek-v4-flash
 *   thinking: high
 *   deep: 1
 *   maxChildren: 2
 *   background: false
 *   maxRounds: 60
 *   ---
 *   你是「牛马狗」……
 *
 * Parsing is loose (tolerates CRLF, surrounding quotes, non-key lines); the
 * frontmatter is the machine surface, the body is kept verbatim. `serialize`
 * is the exact inverse used by the settings UI's save path, so a round trip
 * through this module is stable.
 *
 * @module dsh-subagent-manager/agents
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'

/**
 * Valid frontmatter `thinking` values. Providers declare their own effort
 * vocabularies (the bundled free lane uses light/balanced/deep while DeepSeek
 * uses off/low/medium/high/max), so accept the union and resolve the concrete
 * level against the selected model at dispatch time.
 */
export const THINKING_LEVELS = ['off', 'light', 'low', 'medium', 'balanced', 'high', 'deep', 'max']

/**
 * Alias a stored thinking level onto another spelling, used only as a fallback
 * when the selected model does not declare the literal value. Every provider
 * keeps its own literal vocabulary first, so a DeepSeek `medium` stays
 * `medium` and a free-lane `balanced` stays `balanced`.
 *
 * @param {string} value - a stored level.
 * @returns {string|undefined} an alternative spelling, when one is known.
 */
export function thinkingAlias(value) {
  const level = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ({
    low: 'light', light: 'balanced',
    medium: 'balanced', balanced: 'medium',
    high: 'deep', max: 'deep',
    deep: 'high', xhigh: 'deep', minimal: 'light',
  })[level]
}

/** Extensions the import surface accepts — persona specs are plain text. */
export const IMPORT_EXTENSIONS = ['.md', '.markdown', '.txt']

/** The dsh home: `$DSH_HOME` when set, `~/.dsh` otherwise. */
export function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return resolve(fromEnv)
  return join(homedir(), '.dsh')
}

/** The default agents directory (`$DSH_HOME/agents`). */
export function agentsDir() {
  return join(dshHome(), 'agents')
}

/** Expand a leading `~` to the user's home directory. */
export function expandHome(dir) {
  if (dir === '~') return homedir()
  if (dir.startsWith('~/') || dir.startsWith('~\\')) return join(homedir(), dir.slice(2))
  return dir
}

/**
 * The slug used as the file name for one agent. The agent `name` must be a
 * single safe path segment: ASCII/CJK letters, digits, `_`, `-`, `.` — never
 * `.` / `..`, never containing a separator. This is both the on-disk identity
 * and the by-name dispatch key the model uses.
 */
export function isValidName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) return false
  if (name === '.' || name === '..') return false
  return /^[A-Za-z0-9_\-\u4e00-\u9fff\u3400-\u4dbf][A-Za-z0-9_\-.\u4e00-\u9fff\u3400-\u4dbf]*$/.test(name)
}

const FRONTMATTER_FENCE = '---'
const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/

/** Strip one pair of matching surrounding quotes, if present. */
function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)
  }
  return value
}

/**
 * Emit one frontmatter line value for the loose `key: value` format. The
 * parser takes everything after the first `:` as the value, so only
 * empty-ish values and whitespace-edged values need quoting; quoted values
 * travel as JSON strings (parse strips one outer quote pair).
 */
function emitValue(value) {
  const s = String(value)
  if (s === '') return '""'
  if (/^\s|\s$/.test(s)) return JSON.stringify(s)
  return s
}

/** Find the closing fence line index of a frontmatter starting at line 0. */
function frontmatterBounds(lines) {
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) return undefined
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_FENCE) return { close: i }
  }
  return undefined
}

/** Parse a loose `key: value` frontmatter block (lines 1..close-1). */
function parseFrontmatterValues(lines, close) {
  const values = {}
  for (let i = 1; i < close; i++) {
    const match = KEY_LINE.exec(lines[i])
    if (match === null) continue
    values[match[1]] = stripQuotes(match[2].trim())
  }
  return values
}

/**
 * Parse one subagent markdown file. `name` is required; `deep` must be a
 * non-negative integer (default 1); `thinking`/`background`/`maxRounds` are
 * validated fail-loud (an invalid value marks the file broken).
 *
 * @param {string} text - the raw file text.
 * @param {string} path - where it came from, for error messages.
 * @returns {{ ok: true, agent: { path, meta, body } } | {{ ok: false, error: string }}}
 */
export function parseAgentMarkdown(text, path) {
  const lines = text.split(/\r?\n/)
  const bounds = frontmatterBounds(lines)
  if (bounds === undefined) return { ok: false, error: 'missing frontmatter (file must start with `---`)' }
  const values = parseFrontmatterValues(lines, bounds.close)
  const name = values['name']?.trim()
  if (name === undefined || name === '') return { ok: false, error: 'missing required frontmatter key `name`' }
  let deep = 1
  if (values['deep'] !== undefined) {
    const raw = values['deep'].trim()
    if (!/^\d+$/.test(raw)) return { ok: false, error: `invalid \`deep\`: expected a non-negative integer, got "${raw}"` }
    deep = Number(raw)
  }
  // `maxChildren` caps how many direct children this agent may start while it
  // runs; 0 means no cap, and 1 is the default. The host has no such concept
  // (its SubagentStartRequest carries only `maxDepth`), so this is enforced by
  // the dispatch tool itself.
  let maxChildren = 1
  if (values['maxChildren'] !== undefined) {
    const raw = values['maxChildren'].trim()
    if (!/^\d+$/.test(raw)) return { ok: false, error: `invalid \`maxChildren\`: expected a non-negative integer, got "${raw}"` }
    maxChildren = Number(raw)
  }
  const body = lines.slice(bounds.close + 1).join('\n').replace(/^\n+/, '').trimEnd()
  const meta = { name, deep, maxChildren, path }
  const displayName = values['display_name']?.trim()
  if (displayName !== undefined && displayName !== '') meta.displayName = displayName
  const description = values['description']?.trim()
  if (description !== undefined && description !== '') meta.description = description
  const model = values['model']?.trim()
  if (model !== undefined && model !== '') meta.model = model
  const provider = values['provider']?.trim()
  if (provider !== undefined && provider !== '') meta.provider = provider
  const thinking = values['thinking']?.trim()
  if (thinking !== undefined && thinking !== '') {
    if (!THINKING_LEVELS.includes(thinking)) {
      return { ok: false, error: `invalid \`thinking\`: expected one of ${THINKING_LEVELS.join('/')}, got "${thinking}"` }
    }
    meta.thinking = thinking
  }
  const background = values['background']?.trim()
  if (background !== undefined && background !== '') {
    if (background !== 'true' && background !== 'false') {
      return { ok: false, error: `invalid \`background\`: expected true or false, got "${background}"` }
    }
    meta.background = background === 'true'
  }
  const maxRounds = values['maxRounds']?.trim()
  if (maxRounds !== undefined && maxRounds !== '') {
    if (!/^\d+$/.test(maxRounds) || Number(maxRounds) < 1) {
      return { ok: false, error: `invalid \`maxRounds\`: expected a positive integer, got "${maxRounds}"` }
    }
    meta.maxRounds = Number(maxRounds)
  }
  return { ok: true, agent: { path, meta, body } }
}

/**
 * Serialize one subagent back to markdown. The frontmatter carries the same
 * keys parse reads; the body is written verbatim under a blank line.
 *
 * @param {{ meta: object, body: string }} agent
 * @returns {string}
 */
export function serializeAgentMarkdown({ meta, body }) {
  const lines = [FRONTMATTER_FENCE]
  const push = (key, value) => {
    if (value === undefined || value === null || value === '') return
    lines.push(`${key}: ${emitValue(value)}`)
  }
  push('name', meta.name)
  push('display_name', meta.displayName)
  push('description', meta.description)
  push('model', meta.model)
  push('thinking', meta.thinking)
  if (meta.deep !== undefined && meta.deep !== 1) push('deep', String(meta.deep))
  if (meta.maxChildren !== undefined && meta.maxChildren !== 1) push('maxChildren', String(meta.maxChildren))
  if (meta.background !== undefined && meta.background !== false) push('background', String(meta.background))
  if (meta.maxRounds !== undefined) push('maxRounds', String(meta.maxRounds))
  lines.push(FRONTMATTER_FENCE, '')
  const text = (body ?? '').trim()
  if (text !== '') lines.push(text, '')
  return lines.join('\n')
}

/**
 * List subagents under `dir` (top level only), broken files reported aside.
 *
 * @param {string} dir
 * @returns {{ agents: Array, broken: Array<{ path, error }> }}
 */
export function listAgentFiles(dir) {
  const agents = []
  const broken = []
  if (!existsSync(dir)) return { agents, broken }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const path = join(dir, entry.name)
    const result = parseAgentMarkdown(readFileSync(path, 'utf8'), path)
    if (result.ok) agents.push(result.agent)
    else broken.push({ path, error: result.error })
  }
  agents.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
  return { agents, broken }
}

/**
 * Load one subagent by name.
 *
 * @param {string} dir
 * @param {string} name
 * @returns {{ ok: true, agent } | { ok: false, error }}
 */
export function loadAgent(dir, name) {
  if (!isValidName(name)) return { ok: false, error: `invalid subagent name "${name}"` }
  const target = join(dir, `${name}.md`)
  let text
  try {
    text = readFileSync(target, 'utf8')
  } catch {
    return { ok: false, error: `unknown subagent "${name}" — no ${name}.md in ${dir}` }
  }
  return parseAgentMarkdown(text, target)
}

/**
 * Write (create or overwrite) one subagent file, creating the directory when
 * needed. Returns the persisted path.
 *
 * @param {string} dir
 * @param {{ meta: object, body: string }} agent
 * @returns {string} the file path.
 */
export function saveAgent(dir, agent) {
  if (!isValidName(agent.meta?.name)) throw new Error(`invalid subagent name "${agent.meta?.name}"`)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `${agent.meta.name}.md`)
  writeFileSync(target, serializeAgentMarkdown(agent), 'utf8')
  return target
}

/**
 * Remove one subagent file.
 *
 * @param {string} dir
 * @param {string} name
 * @returns {boolean} whether a file was removed.
 */
export function deleteAgent(dir, name) {
  if (!isValidName(name)) throw new Error(`invalid subagent name "${name}"`)
  const target = join(dir, `${name}.md`)
  if (!existsSync(target)) return false
  rmSync(target, { force: true })
  return true
}

// ---------------------------------------------------------------------------
// Import: read an already-written persona spec (plain .md / .txt) and shape it
// into a subagent draft.
//
// Two accepted inputs, decided by sniffing the text:
//   * a file that already carries our frontmatter is parsed through the
//     normal path and re-emitted verbatim (round-trip import);
//   * a plain persona document (no frontmatter) becomes `body`, with the
//     metadata derived from its prose: slug from the file name, display name
//     and description from the leading `#` heading and `>` blockquote — the
//     shape role-spec files use, e.g.
//       # Example Agent · Reviewer
//       > 角色代号：example｜职责：…（CJK role specs may use a fullwidth pipe）
//     (the `｜` fullwidth pipe is included so CJK-formatted specs split
//     cleanly; a miss only costs a tag, the body is always kept whole).
// ---------------------------------------------------------------------------

/** Derive a dispatch-safe slug from a file basename. */
export function slugFromFileName(fileName) {
  const base = String(fileName ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\.(md|markdown|txt)$/i, '')
    .trim()
    .replace(/\s+/g, '-')
  // Keep only the characters isValidName allows; a spec named `3. 需求.md`
  // would otherwise start with a dot (illegal) — leading punctuation is
  // stripped rather than rejected.
  const filtered = base.replace(/[^\w.\-\u4e00-\u9fff\u3400-\u4dbf]/g, '').replace(/^[.\-]+/, '').slice(0, 128)
  return filtered === '' ? 'imported-agent' : filtered
}

/** Whether the text opens with our frontmatter block. */
function hasFrontmatter(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) return false
  return lines.some((line, i) => i > 0 && line.trim() === FRONTMATTER_FENCE)
}

/**
 * Best-effort metadata for a plain persona document:
 * `name` comes from the file name; `displayName` from the first `#` heading
 * (its trailing `·`/`-`/`:` suffix kept — "Example Agent · Reviewer" is exactly the
 * label a picker wants); `description` from a `角色代号/职责/description`
 * line in the leading blockquote, else the first paragraph prose.
 *
 * @param {string} text - raw file content.
 * @param {string} fileName - basename, used for the slug fallback.
 * @returns {{ meta: Partial<AgentMeta>, body: string }}
 */
export function deriveAgentDraft(text, fileName) {
  const raw = String(text ?? '')
  const lines = raw.split(/\r?\n/)
  const meta = { name: slugFromFileName(fileName), deep: 1, maxChildren: 1 }

  const heading = lines.find((l) => /^#\s+\S/.test(l))
  if (heading !== undefined) {
    const title = heading.replace(/^#\s+/, '').trim()
    if (title !== '') meta.displayName = title.slice(0, 64)
  }

  // Leading `>` blockquote lines (skip the heading itself). Kept as separate
  // lines: `角色代号：X｜职责：…` and `适用项目：…` are one line each, and a
  // duties segment must not bleed into the next line's prose.
  const quoteLines = lines
    .slice(0, 12)
    .filter((l) => /^>\s*/.test(l))
    .map((l) => l.replace(/^>\s*/, '').trim())
  const quote = quoteLines.join(' ')
  let duty
  for (const line of quoteLines) {
    duty = line.split(/[｜|]/).find((part) => /职责|duties|responsibilit/i.test(part))
    if (duty !== undefined) break
  }
  if (duty !== undefined) {
    meta.description = duty.replace(/^.*?(职责|duties|responsibilities)\s*[：:]\s*/i, '').trim().slice(0, 500)
  } else if (quote !== '') {
    meta.description = quote.slice(0, 500)
  } else {
    const para = raw
      .split(/\n\s*\n/)
      .map((block) => block.replace(/^#.*$/gm, '').trim())
      .find((block) => block !== '' && !block.startsWith('|') && !block.startsWith('```'))
    if (para !== undefined) meta.description = para.replace(/\s+/g, ' ').slice(0, 200)
  }
  if (meta.description === '') delete meta.description

  return { meta, body: raw.trim() }
}

/**
 * Read one import candidate. Returns the draft the UI pre-fills the editor
 * with — never writes anything.
 *
 * @param {string} path - absolute path to a .md / .markdown / .txt file.
 * @returns {{ ok: true, source: string, name: string, meta: object, body: string, hasFrontmatter: boolean }} | {{ ok: false, error: string }}
 */
export function readImportCandidate(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, error: `无法读取 ${path}：${error instanceof Error ? error.message : String(error)}` }
  }
  const fileName = path.split(/[\\/]/).pop() ?? path
  if (hasFrontmatter(text)) {
    const parsed = parseAgentMarkdown(text, path)
    if (parsed.ok) {
      return {
        ok: true,
        source: path,
        name: parsed.agent.meta.name,
        meta: { ...parsed.agent.meta },
        body: parsed.agent.body,
        hasFrontmatter: true,
      }
    }
    // Frontmatter present but broken: importing should not fail — the user
    // sees the error and the raw text in the editor, and can fix it there.
    return {
      ok: true,
      source: path,
      name: slugFromFileName(fileName),
      meta: { name: slugFromFileName(fileName), deep: 1, maxChildren: 1 },
      body: text.trim(),
      hasFrontmatter: false,
      warning: `frontmatter 解析失败（${parsed.error}），已按纯文本导入`,
    }
  }
  const draft = deriveAgentDraft(text, fileName)
  return { ok: true, source: path, name: draft.meta.name, meta: draft.meta, body: draft.body, hasFrontmatter: false }
}

/**
 * List import candidates under a directory (top level only, by extension).
 *
 * @param {string} dir - absolute directory path.
 * @returns {{ ok: true, dir: string, files: Array<{ name: string, path: string, bytes: number }> } | {{ ok: false, error: string, files: [] }}}
 */
export function listImportCandidates(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    return { ok: false, error: `无法读取目录 ${dir}：${error instanceof Error ? error.message : String(error)}`, files: [] }
  }
  const files = entries
    .filter((e) => e.isFile() && IMPORT_EXTENSIONS.some((ext) => e.name.toLowerCase().endsWith(ext)))
    .map((e) => {
      const path = join(dir, e.name)
      let bytes = 0
      try {
        bytes = readFileSync(path, 'utf8').length
      } catch { /* size is cosmetic */ }
      return { name: e.name, path, bytes }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return { ok: true, dir, files }
}

/**
 * Browse one directory for the import panel: candidate files AND readable
 * subdirectories (one level), so the UI can drill down without a server-side
 * tree walk.
 *
 * @param {string} dir
 * @returns {{ ok: true, dir: string, parent: string | null, files: Array, dirs: string[] } | {{ ok: false, error: string, files: [], dirs: [] }}}
 */
export function browseImportDir(dir) {
  const listed = listImportCandidates(dir)
  if (!listed.ok) return { ...listed, dirs: [] }
  let dirs = []
  try {
    dirs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => {
        if (!e.isDirectory()) return false
        // Skip dependency/metadata noise — nobody keeps personas there.
        if (e.name === 'node_modules' || e.name.startsWith('.')) return false
        try {
          // Only offer directories that are actually readable.
          readdirSync(join(dir, e.name))
          return true
        } catch { return false }
      })
      .map((e) => join(dir, e.name))
      .sort((a, b) => a.localeCompare(b))
  } catch { /* unreadable children are simply not offered */ }
  const parent = dirname(dir) === dir ? null : dirname(dir)
  return { ok: true, dir, files: listed.files, dirs, parent }
}

/**
 * Normalize one path for containment tests: absolute, native separators,
 * drive letter lowercased (Windows compares case-insensitively).
 */
function normPath(value) {
  const abs = resolve(value)
  const forward = abs.replace(/\\/g, '/')
  return /^[a-z]:\//i.test(forward) ? forward.replace(/^([A-Z]:)/, (m) => m.toLowerCase()) : forward
}

/** Whether `target` is `root` itself or lives beneath it. */
export function isWithin(root, target) {
  const r = normPath(root)
  const t = normPath(target)
  return t === r || t.startsWith(`${r}/`)
}

/**
 * Resolve one requested path against the allowed roots (workspace directories,
 * the dsh home, and the plugin's configured import roots). Returns the
 * resolved absolute path, or `undefined` when nothing allowed contains it.
 *
 * @param {string} requested - absolute path or `~`-prefixed path.
 * @param {readonly string[]} roots
 * @returns {string | undefined}
 */
export function resolveWithinRoots(requested, roots) {
  const candidate = expandHome(String(requested ?? '').trim())
  if (candidate === '') return undefined
  const abs = resolve(candidate)
  return roots.some((root) => isWithin(root, abs)) ? abs : undefined
}
