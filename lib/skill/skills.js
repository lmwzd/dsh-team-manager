/**
 * Skill 文件层 —— 一个 Skill 是 `<skills-dir>/<name>/SKILL.md`：
 *
 *   <skills-dir>/tdd/SKILL.md
 *   ---
 *   name: tdd
 *   description: Test-driven development. Use when …
 *   ---
 *   # Test-Driven Development
 *   …（正文，模型加载技能时读到的全部指令）
 *
 * 目录里还可以有辅助文件（tdd/mocking.md 等），SKILL.md 的正文可引用它们。
 * frontmatter 是机器面（name / description），正文整体作为技能指令。
 *
 * 「停用」不删除文件：把 SKILL.md 重命名为 SKILL.md.disabled，
 * 宿主的技能发现只认 SKILL.md，于是该技能从目录中消失；
 * 「启用」把名字改回来即可。本插件只管理这些文件，不改其他插件的策略。
 *
 * 解析保持宽松（容忍 CRLF、包裹引号、非键值行）；`serialize` 是
 * `parse` 的精确逆，所以经由此模块的一次往返是稳定的。
 *
 * @module dsh-skill-manager/skills
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { lstatSync, mkdtempSync } from 'node:fs'

/** SKILL.md 的文件名（启用状态）。 */
export const SKILL_FILE = 'SKILL.md'

/** SKILL.md 的文件名（停用状态）。 */
export const SKILL_FILE_DISABLED = 'SKILL.md.disabled'

/** 导入接受的扩展名（单文件导入）。 */
export const IMPORT_EXTENSIONS = ['.md', '.markdown', '.txt']

/** The dsh home: `$DSH_HOME` when set, `~/.dsh` otherwise. */
export function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return resolve(fromEnv)
  return join(homedir(), '.dsh')
}

/** The default skills directory (`$DSH_HOME/skills`). */
export function skillsDir() {
  return join(dshHome(), 'skills')
}

/** Expand a leading `~` to the user's home directory. */
export function expandHome(dir) {
  if (dir === '~') return homedir()
  if (dir.startsWith('~/') || dir.startsWith('~\\')) return join(homedir(), dir.slice(2))
  return dir
}

/**
 * Skill 名必须是单个安全路径段：ASCII/CJK 字母、数字、`_`、`-`、`.`
 * —— 永远不是 `.` / `..`，永远不含分隔符，且是 kebab-case 风格。
 * 这既是目录名，也是会话中技能路由的键。
 */
export function isValidName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) return false
  if (name === '.' || name === '..' || name.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return false
  if (/\s/.test(name)) return false
  return /^[a-z0-9_\-\u4e00-\u9fff\u3400-\u4dbf][a-z0-9_\-.\u4e00-\u9fff\u3400-\u4dbf]*$/i.test(name)
}

/** 把任意输入规整成合法的 skill 名（kebab-case，小写）。 */
export function slugify(input) {
  const base = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.(md|markdown|txt)$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^\-.\w\u4e00-\u9fff\u3400-\u4dbf]/g, '')
    .replace(/^[.\-]+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 128)
  return base === '' ? 'imported-skill' : base
}

const FRONTMATTER_FENCE = '---'
const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/
const RESERVED_FRONTMATTER_KEYS = new Set(['name', 'description'])

/** Strip one pair of matching surrounding quotes, if present. */
function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === '"' && last === '"') {
      try { return JSON.parse(value) } catch { return value.slice(1, -1) }
    }
    if (first === "'" && last === "'") return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

/** Emit one frontmatter line value; the parser takes everything after `:`. */
function emitValue(value) {
  return JSON.stringify(String(value))
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
  const extras = []
  for (let i = 1; i < close; i++) {
    const match = KEY_LINE.exec(lines[i])
    if (match === null) {
      extras.push(lines[i])
      continue
    }
    const key = match[1].toLowerCase()
    if (RESERVED_FRONTMATTER_KEYS.has(key)) {
      const scalar = match[2].trim()
      if (/^[|>][-+]?$/.test(scalar)) {
        const block = []
        while (i + 1 < close && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) block.push(lines[++i])
        values[key] = block.map((line) => line.trim()).join(scalar.startsWith('>') ? ' ' : '\n').trim()
      } else values[key] = stripQuotes(scalar)
    } else extras.push(lines[i])
  }
  return { values, extras }
}

/**
 * Parse one SKILL.md text.
 * `name` 必须存在（缺省回退到目录名时由调用方处理），`description` 必须非空。
 *
 * @param {string} text - raw SKILL.md text.
 * @param {string} dirName - the skill directory name (fallback `name`).
 * @param {string} path - file path, for error messages.
 * @returns {{ ok: true, skill: { path, dir, name, description, body } } | {{ ok: false, error: string }}
 */
export function parseSkillMarkdown(text, dirName, path) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const bounds = frontmatterBounds(lines)
  if (bounds === undefined) {
    return { ok: false, error: 'missing frontmatter (file must start with `---`)' }
  }
  const { values, extras } = parseFrontmatterValues(lines, bounds.close)
  const name = (values['name'] ?? '').trim() || dirName
  if (!isValidName(name)) {
    return { ok: false, error: `invalid \`name\` "${name}": kebab-case letters/digits/-/_/., no separators` }
  }
  const description = (values['description'] ?? '').trim()
  if (description === '') {
    return { ok: false, error: 'missing required frontmatter key `description`' }
  }
  const body = lines.slice(bounds.close + 1).join('\n').replace(/^\n+/, '').trimEnd()
  return { ok: true, skill: { path, dir: dirname(path), name, description, body, extraFrontmatter: extras.join('\n') } }
}

/**
 * Serialize one skill back to SKILL.md. `parse` 的逆。
 *
 * @param {{ name: string, description: string, body: string }} skill
 * @returns {string}
 */
export function serializeSkillMarkdown({ name, description, body, extraFrontmatter = '' }) {
  const lines = [FRONTMATTER_FENCE]
  lines.push(`name: ${emitValue(name)}`)
  lines.push(`description: ${emitValue(description)}`)
  if (extraFrontmatter) {
    const extraLines = String(extraFrontmatter).split(/\r?\n/)
    if (extraLines.some((line) => line.trim() === '---' || /^(name|description)\s*:/i.test(line))) {
      throw new Error('extra frontmatter cannot redefine name/description or contain a fence')
    }
    lines.push(...extraLines)
  }
  lines.push(FRONTMATTER_FENCE, '')
  const text = (body ?? '').trim()
  if (text !== '') lines.push(text, '')
  return lines.join('\n')
}

function checkedSkillDir(root, id) {
  if (!isValidName(id)) throw new Error('invalid skill directory name')
  const target = join(resolve(root), id)
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('技能目录不能是符号链接')
  if (existsSync(target) && !isWithin(realpathSync(root), realpathSync(target))) throw new Error('技能目录越界')
  return target
}

function checkedFile(root, target) {
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || !isWithin(realpathSync(root), realpathSync(target)))) {
    throw new Error('技能文件不能是符号链接或指向目录外')
  }
}

/** Read one skill directory's SKILL.md (enabled or disabled). */
function readSkillDir(dir) {
  checkedSkillDir(dirname(dir), basename(dir))
  const enabledPath = join(dir, SKILL_FILE)
  const disabledPath = join(dir, SKILL_FILE_DISABLED)
  checkedFile(dir, enabledPath)
  checkedFile(dir, disabledPath)
  if (existsSync(enabledPath) && existsSync(disabledPath)) return { ok: false, error: '同时存在启用和停用文件，请处理重复文件' }
  let text
  let enabled = true
  let path
  if (existsSync(enabledPath)) {
    path = enabledPath
    text = readFileSync(enabledPath, 'utf8')
  } else if (existsSync(disabledPath)) {
    path = disabledPath
    text = readFileSync(disabledPath, 'utf8')
    enabled = false
  } else {
    return { ok: false, error: `no ${SKILL_FILE} or ${SKILL_FILE_DISABLED} in ${dir}` }
  }
  const parsed = parseSkillMarkdown(text, basename(dir), path)
  if (!parsed.ok) return parsed
  return { ok: true, skill: { ...parsed.skill, id: basename(dir), enabled, file: basename(path) } }
}

/**
 * List skills under `dir` (top-level `<name>/SKILL.md` directories only).
 *
 * @param {string} dir - the skills directory.
 * @returns {{ skills: Array<{ name, description, enabled, dir }>, broken: Array<{ path, error }> }}
 */
export function listSkills(dir) {
  const skills = []
  const broken = []
  if (!existsSync(dir)) return { skills, broken }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const skillDir = join(dir, entry.name)
    let result
    try { result = readSkillDir(skillDir) } catch (error) { result = { ok: false, error: error.message } }
    if (result.ok) {
      const { body, ...summary } = result.skill
      summary.bodyBytes = Buffer.byteLength(body ?? '', 'utf8')
      summary.files = listSkillFiles(skillDir)
      skills.push(summary)
    } else {
      // 目录存在但没有可解析的 SKILL.md —— 报告但不中断扫描。
      if (existsSync(join(skillDir, SKILL_FILE)) || existsSync(join(skillDir, SKILL_FILE_DISABLED))) {
        broken.push({ path: skillDir, error: result.error })
      }
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return { skills, broken }
}

/** List auxiliary files in one skill directory (SKILL.md 之外的参考文件)。 */
export function listSkillFiles(skillDir) {
  try {
    return readdirSync(skillDir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * Load one skill by name (full detail including body).
 *
 * @param {string} dir
 * @param {string} name
 * @returns {{ ok: true, skill } | { ok: false, error }}
 */
export function loadSkill(dir, name) {
  if (!isValidName(name)) return { ok: false, error: `invalid skill name "${name}"` }
  const skillDir = join(dir, name)
  if (!existsSync(skillDir)) return { ok: false, error: `unknown skill "${name}" — no ${name}/ in ${dir}` }
  const result = readSkillDir(skillDir)
  if (!result.ok) return result
  return { ok: true, skill: { ...result.skill, files: listSkillFiles(skillDir) } }
}

/**
 * Write (create or overwrite) one skill directory's SKILL.md.
 * Returns the persisted path.
 *
 * @param {string} dir
 * @param {{ name: string, description: string, body: string }} skill
 * @returns {string} the SKILL.md path.
 */
export function saveSkill(dir, skill) {
  if (!isValidName(skill?.name)) throw new Error(`invalid skill name "${skill?.name}"`)
  if (typeof skill.description !== 'string' || skill.description.trim() === '') {
    throw new Error('description is required')
  }
  const id = skill.id || skill.name
  const skillDir = checkedSkillDir(dir, id)
  const previous = existsSync(skillDir) ? readSkillDir(skillDir) : null
  if (previous && !previous.ok) throw new Error(previous.error)
  if (!skill.id && existsSync(skillDir)) throw new Error('同名目录已存在，请编辑已有技能')
  mkdirSync(skillDir, { recursive: true })
  const target = join(skillDir, previous?.skill.enabled === false ? SKILL_FILE_DISABLED : SKILL_FILE)
  checkedFile(skillDir, target)
  const text = serializeSkillMarkdown({ ...skill, extraFrontmatter: skill.extraFrontmatter ?? previous?.skill.extraFrontmatter ?? '' })
  const temp = `${target}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  try {
    writeFileSync(temp, text, { encoding: 'utf8', flag: 'wx' })
    renameSync(temp, target)
  } finally {
    if (existsSync(temp)) rmSync(temp)
  }
  return target
}

/**
 * Enable/disable one skill: rename SKILL.md <-> SKILL.md.disabled.
 *
 * @param {string} dir
 * @param {string} name
 * @param {boolean} enabled
 * @returns {boolean} whether a rename happened.
 */
export function setSkillEnabled(dir, name, enabled) {
  if (!isValidName(name)) throw new Error(`invalid skill name "${name}"`)
  const skillDir = checkedSkillDir(dir, name)
  const from = enabled ? join(skillDir, SKILL_FILE_DISABLED) : join(skillDir, SKILL_FILE)
  const to = enabled ? join(skillDir, SKILL_FILE) : join(skillDir, SKILL_FILE_DISABLED)
  checkedFile(skillDir, from)
  checkedFile(skillDir, to)
  if (!existsSync(from)) return false
  if (existsSync(to)) throw new Error('目标状态文件已存在，拒绝覆盖')
  renameSync(from, to)
  return true
}

/**
 * Remove one skill directory (recursively).
 *
 * @param {string} dir
 * @param {string} name
 * @returns {boolean} whether a directory was removed.
 */
export function deleteSkill(dir, name) {
  const skillDir = checkedSkillDir(dir, name)
  if (!existsSync(skillDir)) return false
  rmSync(skillDir, { recursive: true, force: true })
  try {
    const names = readAutoState(dir)
    if (names.delete(name)) writeAutoState(dir, names)
  } catch {
    // 状态文件只是偏好，清理失败不影响删除结果。
  }
  try {
    const notes = readNotes(dir)
    if (notes.delete(name)) writeNotes(dir, notes)
  } catch {
    // 同上：备注是显示层信息，清理失败不影响删除结果。
  }
  return true
}

// ---------------------------------------------------------------------------
// 自动调用（auto-invoke）状态
//
// 状态放在 `<skills-dir>/.dsh-team-manager/auto.json`：以 `.` 开头的目录会被
// `listSkills` 跳过，不会被当成一个技能；技能文件本身不写入任何私有字段。
// 启用某技能后，本插件的宿主半边会把「任务匹配时优先加载」的策略注册成
// 一段系统提示，模型据此在会话开始时自动调用 `skill` 工具。
// ---------------------------------------------------------------------------

/** 状态目录名（隐藏目录，不参与技能扫描）。 */
const STATE_DIR = '.dsh-team-manager'

/**
 * 旧版本使用过的状态目录名。改名只影响目录名，不能因此让用户已经打开的
 * 自动调用开关静默失效，所以读取时依次回退；写入始终只写当前目录。
 */
const LEGACY_STATE_DIRS = ['.teammaneger']

/** 自动调用状态文件的绝对路径。 */
export function autoStatePath(dir) {
  return join(dir, STATE_DIR, 'auto.json')
}

/**
 * 读取自动调用集合。文件不存在、损坏或含非法名称时静默跳过：
 * 状态文件永远不能影响技能列表本身的可用性。
 *
 * @param {string} dir
 * @returns {Set<string>} skill directory ids
 */
export function readAutoState(dir) {
  const names = new Set()
  // The current location is authoritative whenever it exists: a corrupt current
  // file means "all off", never "resurrect the pre-rename file", or an upgrade
  // plus a bad write could silently re-enable preferences the user had cleared.
  // Only a missing current file falls back to the pre-rename directory, so the
  // rename by itself does not turn every auto-invoke switch off.
  const current = autoStatePath(dir)
  const candidates = existsSync(current)
    ? [current]
    : [...LEGACY_STATE_DIRS.map((name) => join(dir, name, 'auto.json')), current]
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'))
      const list = parsed?.skills
      if (Array.isArray(list)) {
        for (const name of list) if (isValidName(name)) names.add(name)
        break
      }
    } catch {
      // Missing or unreadable at this location: try the next candidate.
    }
  }
  return names
}

/**
 * 原子写入自动调用集合。排序后落盘，方便人工查看与版本比较。
 *
 * @param {string} dir
 * @param {Iterable<string>} names
 * @returns {string[]} the persisted, sorted names
 */
export function writeAutoState(dir, names) {
  const stateDir = join(dir, STATE_DIR)
  mkdirSync(stateDir, { recursive: true })
  const target = autoStatePath(dir)
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const skills = [...names].filter((name) => isValidName(name)).sort()
  try {
    writeFileSync(temp, `${JSON.stringify({ version: 1, skills }, null, 2)}\n`, 'utf8')
    renameSync(temp, target)
  } finally {
    if (existsSync(temp)) rmSync(temp)
  }
  return skills
}

/**
 * 设置（或取消）一个技能的自动调用。技能必须存在。
 *
 * @param {string} dir
 * @param {string} name - skill directory id
 * @param {boolean} auto
 * @returns {boolean} the new state
 */
export function setSkillAuto(dir, name, auto) {
  if (!isValidName(name)) throw new Error(`invalid skill name "${name}"`)
  const loaded = loadSkill(dir, name)
  if (!loaded.ok) throw new Error(loaded.error)
  if (auto === true && isModelInvocationDisabled(loaded.skill.extraFrontmatter)) {
    throw new Error('skill has disable-model-invocation: true and cannot be auto-invoked')
  }
  const names = readAutoState(dir)
  if (auto === true) names.add(name)
  else names.delete(name)
  writeAutoState(dir, names)
  return auto === true
}

// ---------------------------------------------------------------------------
// 备注（note）
//
// 备注是**你自己的**一句话，用来记住「这个技能是干什么的」，与 SKILL.md 无关：
// 它不会写进技能文件，模型也读不到它。存放位置与自动调用状态一致，都是
// `<skills-dir>/.dsh-team-manager/` 下的独立文件——所以改备注永远不会碰到
// 技能正文，重建、导入、外部编辑技能都不会冲掉备注。
// ---------------------------------------------------------------------------

/** 备注长度上限：一句备注，不是第二个描述。 */
export const NOTE_MAX = 160

/** 备注文件的绝对路径。 */
export function noteStatePath(dir) {
  return join(dir, STATE_DIR, 'notes.json')
}

/**
 * 读取备注表。损坏、越界或非法的条目一律丢弃：备注是显示层信息，任何情况下
 * 都不能影响技能列表本身。
 *
 * @param {string} dir
 * @returns {Map<string, string>} skill id -> note
 */
export function readNotes(dir) {
  const notes = new Map()
  try {
    const parsed = JSON.parse(readFileSync(noteStatePath(dir), 'utf8'))
    const table = parsed?.notes
    if (table === null || typeof table !== 'object' || Array.isArray(table)) return notes
    for (const [name, value] of Object.entries(table)) {
      if (!isValidName(name) || typeof value !== 'string') continue
      const note = oneLine(value, NOTE_MAX)
      if (note !== '') notes.set(name, note)
    }
  } catch {
    // 首次使用时文件不存在；损坏时按「没有备注」处理，绝不抛给调用方。
  }
  return notes
}

/**
 * 原子写入备注表。空备注会被移除，而不是存成空串。
 *
 * @param {string} dir
 * @param {Map<string, string>} notes
 */
export function writeNotes(dir, notes) {
  const stateDir = join(dir, STATE_DIR)
  mkdirSync(stateDir, { recursive: true })
  const target = noteStatePath(dir)
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const table = {}
  for (const name of [...notes.keys()].sort()) {
    const note = oneLine(notes.get(name) ?? '', NOTE_MAX)
    if (isValidName(name) && note !== '') table[name] = note
  }
  try {
    writeFileSync(temp, `${JSON.stringify({ version: 1, notes: table }, null, 2)}
`, 'utf8')
    renameSync(temp, target)
  } finally {
    if (existsSync(temp)) rmSync(temp)
  }
}

/**
 * 设置（或清除）一个技能的备注，返回落盘后的备注（空串表示已清除）。
 * 技能必须存在，避免给拼错的名字留下孤儿备注。
 *
 * @param {string} dir
 * @param {string} name - skill directory id
 * @param {string} note
 * @returns {string}
 */
export function setSkillNote(dir, name, note) {
  if (!isValidName(name)) throw new Error(`invalid skill name "${name}"`)
  const loaded = loadSkill(dir, name)
  if (!loaded.ok) throw new Error(loaded.error)
  const notes = readNotes(dir)
  const value = oneLine(note ?? '', NOTE_MAX)
  if (value === '') notes.delete(name)
  else notes.set(name, value)
  writeNotes(dir, notes)
  return value
}

/** frontmatter 是否声明 `disable-model-invocation: true`。 */
export function isModelInvocationDisabled(extraFrontmatter) {
  return /^\s*disable-model-invocation\s*:\s*true\s*$/im.test(String(extraFrontmatter ?? ''))
}

/** 把描述压成一行，避免系统提示段落被技能描述里的换行破坏。 */
function oneLine(value, max = 600) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * 当前应参与自动调用的技能：存在、已启用、且允许模型调用。
 * `name` 是 frontmatter 里的技能名（`skill` 工具的键），`id` 是目录名。
 *
 * @param {string} dir
 * @returns {Array<{ id: string, name: string, description: string }>}
 */
export function listAutoSkills(dir) {
  const out = []
  for (const id of readAutoState(dir)) {
    try {
      const loaded = loadSkill(dir, id)
      if (!loaded.ok || loaded.skill.enabled === false) continue
      if (isModelInvocationDisabled(loaded.skill.extraFrontmatter)) continue
      out.push({ id, name: loaded.skill.name, description: oneLine(loaded.skill.description) })
    } catch {
      // 单个技能读不出来时跳过它，绝不让系统提示装配失败。
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/**
 * 自动调用策略的系统提示段落；没有自动技能时返回空串（注册空段落是
 * 合法的，模型看不到任何内容）。
 *
 * @param {string} dir
 * @returns {string}
 */
export function renderAutoPolicy(dir) {
  try {
    const skills = listAutoSkills(dir)
    if (skills.length === 0) return ''
    const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    return [
      '<auto_invoke_skills>',
      'The user enabled automatic invocation for the following skills. Before answering or calling any other tool, check whether the current task matches one or more descriptions below. If it does, call the `skill` tool with the exact name immediately — load every matching skill, then follow the loaded instructions. Do not wait for the user to name the skill. Do not load a listed skill when the task clearly does not match it. If a listed skill plausibly applies, load it: missing an applicable skill is worse than loading one unnecessarily.',
      ...skills.map((skill) => `- \`${skill.name}\`: ${escape(skill.description)}`),
      '</auto_invoke_skills>',
    ].join('\n')
  } catch {
    // 系统提示装配不能因为偏好文件或技能目录异常而失败。
    return ''
  }
}

// ---------------------------------------------------------------------------
// Import: 从单文件或 ZIP 压缩包读取一个候选技能草稿。
// ---------------------------------------------------------------------------

/** Whether the text opens with a frontmatter block. */
export function hasFrontmatter(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) return false
  return lines.some((line, i) => i > 0 && line.trim() === FRONTMATTER_FENCE)
}

/**
 * Derive a description for a plain markdown doc without frontmatter:
 * first `#` heading's trailing说明 or first prose paragraph.
 */
function deriveDescription(text) {
  const raw = String(text ?? '')
  const lines = raw.split(/\r?\n/)
  const heading = lines.find((l) => /^#\s+\S/.test(l))
  if (heading !== undefined) {
    const title = heading.replace(/^#\s+/, '').trim()
    if (title !== '') return title.slice(0, 500)
  }
  const para = raw
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#+.*$/gm, '').trim())
    .find((block) => block !== '' && !block.startsWith('|') && !block.startsWith('```'))
  if (para !== undefined) return para.replace(/\s+/g, ' ').slice(0, 500)
  return 'Imported skill (no description found in source file)'
}

/**
 * Read one .md import candidate into a draft { name, description, body }.
 *
 * @param {string} path - absolute path to a .md / .markdown / .txt file.
 * @returns {{ ok: true, source, name, description, body, hasFrontmatter } | {{ ok: false, error }}
 */
export function readMdImportCandidate(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, error: `无法读取 ${path}：${error instanceof Error ? error.message : String(error)}` }
  }
  const fileName = basename(path)
  const dirName = slugify(fileName.replace(/\.(md|markdown|txt)$/i, ''))
  if (hasFrontmatter(text)) {
    const parsed = parseSkillMarkdown(text, dirName, path)
    if (parsed.ok) {
      return {
        ok: true,
        source: path,
        name: parsed.skill.name,
        description: parsed.skill.description,
        body: parsed.skill.body,
        extraFrontmatter: parsed.skill.extraFrontmatter,
        hasFrontmatter: true,
      }
    }
    // frontmatter 存在但解析失败：仍可导入 —— 用户在编辑器里修。
    return {
      ok: true,
      source: path,
      name: dirName,
      description: deriveDescription(text),
      body: text.trim(),
      hasFrontmatter: true,
      warning: `frontmatter 解析失败（${parsed.error}），已按纯文本导入，请在编辑器中修正`,
    }
  }
  return {
    ok: true,
    source: path,
    name: dirName,
    description: deriveDescription(text),
    body: text.trim(),
    hasFrontmatter: false,
  }
}

const ZIP_LIMITS = { entries: 1000, compressed: 32 * 1024 * 1024, expanded: 64 * 1024 * 1024, single: 16 * 1024 * 1024 }

/** ZIP paths use forward slashes only; also reject Windows aliases and ADS. */
function safeZipName(raw) {
  const name = raw.toString('utf8')
  if (!name || name.includes('\ufffd') || /[\\\x00-\x1f:]/.test(name) || name.startsWith('/')) throw new Error('Unsafe ZIP path')
  const parts = name.replace(/\/$/, '').split('/')
  if (parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error(`Unsafe ZIP path: ${name}`)
  return name
}

/** Parse and validate the complete central directory before writing anything. */
function extractZip(zipPath, staging) {
  try {
    if (statSync(zipPath).size > ZIP_LIMITS.compressed) throw new Error('ZIP compressed size exceeds 32 MB')
    const zip = readFileSync(zipPath)
    if (zip.length < 22 || zip.length > ZIP_LIMITS.compressed) throw new Error('Invalid ZIP size')
    let end = -1
    for (let at = zip.length - 22; at >= Math.max(0, zip.length - 65557); at--) {
      if (zip.readUInt32LE(at) === 0x06054b50 && at + 22 + zip.readUInt16LE(at + 20) === zip.length) { end = at; break }
    }
    if (end < 0) throw new Error('ZIP end directory missing')
    const count = zip.readUInt16LE(end + 10)
    const centralSize = zip.readUInt32LE(end + 12)
    const centralStart = zip.readUInt32LE(end + 16)
    if (zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6) || zip.readUInt16LE(end + 8) !== count) throw new Error('Multi-disk ZIP is unsupported')
    if (count > ZIP_LIMITS.entries || centralStart + centralSize !== end) throw new Error('Invalid ZIP directory or entry limit (1000) exceeded')
    const entries = []
    const paths = new Map()
    let at = centralStart
    let expanded = 0
    let compressed = 0
    for (let i = 0; i < count; i++) {
      if (at + 46 > end || zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid ZIP central entry')
      const flags = zip.readUInt16LE(at + 8)
      const method = zip.readUInt16LE(at + 10)
      const packed = zip.readUInt32LE(at + 20)
      const size = zip.readUInt32LE(at + 24)
      const nameLength = zip.readUInt16LE(at + 28)
      const extraLength = zip.readUInt16LE(at + 30)
      const commentLength = zip.readUInt16LE(at + 32)
      const offset = zip.readUInt32LE(at + 42)
      const next = at + 46 + nameLength + extraLength + commentLength
      if (next > end || zip.readUInt16LE(at + 34) || flags & ~0x080e || flags & 1 || ![0, 8].includes(method)) throw new Error('Unsupported or malformed ZIP entry')
      const rawName = zip.subarray(at + 46, at + 46 + nameLength)
      const name = safeZipName(rawName)
      const mode = zip.readUInt32LE(at + 38) >>> 16
      const type = mode & 0xf000
      if (type && type !== 0x8000 && type !== 0x4000) throw new Error('ZIP symlinks and special files are forbidden')
      const directory = name.endsWith('/') || type === 0x4000
      const key = name.replace(/\/$/, '').toLowerCase()
      if (paths.has(key)) throw new Error(`Duplicate ZIP path: ${name}`)
      paths.set(key, directory)
      expanded += size
      compressed += packed
      if (size > ZIP_LIMITS.single || expanded > ZIP_LIMITS.expanded || compressed > ZIP_LIMITS.compressed) throw new Error('ZIP expanded/compressed size limit exceeded (16 MB single, 64 MB total, 32 MB compressed)')
      if (directory && (size || packed)) throw new Error('ZIP directory contains data')
      if (offset + 30 > centralStart || zip.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP local header')
      const localNameLength = zip.readUInt16LE(offset + 26)
      const dataStart = offset + 30 + localNameLength + zip.readUInt16LE(offset + 28)
      if (dataStart + packed > centralStart || !zip.subarray(offset + 30, offset + 30 + localNameLength).equals(rawName) || zip.readUInt16LE(offset + 6) !== flags || zip.readUInt16LE(offset + 8) !== method) throw new Error('ZIP local header mismatch or out-of-bounds data')
      if (!(flags & 8) && (zip.readUInt32LE(offset + 18) !== packed || zip.readUInt32LE(offset + 22) !== size)) throw new Error('ZIP local size mismatch')
      entries.push({ name, directory, method, packed, size, dataStart, offset })
      at = next
    }
    if (at !== end) throw new Error('Invalid ZIP central directory size')
    for (const [name] of paths) {
      const parts = name.split('/')
      for (let i = 1; i < parts.length; i++) if (paths.get(parts.slice(0, i).join('/')) === false) throw new Error('ZIP file/directory conflict')
    }
    const spans = entries.slice().sort((a, b) => a.offset - b.offset)
    for (let i = 1; i < spans.length; i++) if (spans[i].offset < spans[i - 1].dataStart + spans[i - 1].packed) throw new Error('Overlapping ZIP entries')
    for (const entry of entries) {
      const dest = join(staging, entry.name)
      if (entry.directory) { mkdirSync(dest, { recursive: true }); continue }
      const packed = zip.subarray(entry.dataStart, entry.dataStart + entry.packed)
      const data = entry.method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.size) })
      if (data.length !== entry.size) throw new Error('ZIP expanded size mismatch')
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, data, { flag: 'wx' })
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Import a ZIP archive using bounded in-process stored/deflate extraction,
 * then look for `<archive>/<SKILL.md>` or `<archive>/<dir>/SKILL.md`.
 *
 * 简化策略：把 ZIP 解到临时目录，扫描其中的 SKILL.md（含一层子目录），
 * 每个命中即一个候选技能；导入时把整个技能目录（含辅助文件）拷进 skills 目录。
 *
 * @param {string} zipPath - absolute path to a .zip file.
 * @param {string} skillsRoot - the skills directory to import into.
 * @returns {{ ok: true, imported: Array<{ name, dir }>, errors: string[] } | {{ ok: false, error }}
 */
export function importZip(zipPath, skillsRoot) {
  let staging
  try {
    staging = mkdtempSync(join(tmpdir(), 'skill-import-'))
    const extracted = extractZip(zipPath, staging)
    if (!extracted.ok) {
      return { ok: false, error: `解压失败：${extracted.error}` }
    }
    // 扫描 staging 里的 SKILL.md（顶层 + 一层子目录 + 更深也接受，取相对目录）。
    const found = findSkillMds(staging)
    if (found.length === 0) {
      return { ok: false, error: '压缩包内没有找到任何 SKILL.md' }
    }
    const imported = []
    const errors = []
    for (const { skillMdPath, relDir } of found) {
      const name = relDir === '' ? slugify(basename(zipPath).replace(/\.zip$/i, '')) : slugify(relDir)
      const parsed = parseSkillMarkdown(readFileSync(skillMdPath, 'utf8'), name, skillMdPath)
      if (!parsed.ok) {
        errors.push(`${relDir || '(root)'}: ${parsed.error}`)
        continue
      }
      const targetDir = join(skillsRoot, parsed.skill.name)
      if (existsSync(targetDir)) {
        errors.push(`${parsed.skill.name}: 同名技能已存在`)
        continue
      }
      const sourceDir = relDir === '' ? staging : join(staging, relDir)
      copyDirSync(sourceDir, targetDir)
      imported.push({ name: parsed.skill.name, dir: targetDir })
    }
    return { ok: true, imported, errors }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    try { if (staging) rmSync(staging, { recursive: true, force: true }) } catch { /* cleanup is best-effort */ }
  }
}

/** Recursively find SKILL.md files under root, reporting relative parent dirs. */
function findSkillMds(root) {
  const results = []
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        walk(full, relPath)
      } else if (entry.isFile() && entry.name === SKILL_FILE) {
        results.push({ skillMdPath: full, relDir: rel })
      }
    }
  }
  walk(root, '')
  return results
}

/** Preserve auxiliary files and metadata, refusing every nested symlink. */
function copyDirSync(from, to) {
  const validate = (path) => {
    const info = lstatSync(path)
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error(`Unsafe import source: ${path}`)
    if (info.isDirectory()) for (const entry of readdirSync(path)) validate(join(path, entry))
  }
  validate(from)
  mkdirSync(dirname(to), { recursive: true })
  // Exclusive creation avoids merging into an existing directory or symlink.
  mkdirSync(to)
  const copy = (srcDir, dstDir) => {
    for (const entry of readdirSync(srcDir)) {
      const src = join(srcDir, entry)
      const dst = join(dstDir, entry)
      const info = lstatSync(src)
      if (info.isSymbolicLink()) throw new Error(`Unsafe import symlink: ${src}`)
      if (info.isDirectory()) { mkdirSync(dst); copy(src, dst) }
      else if (info.isFile()) writeFileSync(dst, readFileSync(src), { flag: 'wx' })
      else throw new Error(`Unsafe import file: ${src}`)
    }
  }
  try { copy(from, to) } catch (error) {
    rmSync(to, { recursive: true, force: true })
    throw error
  }
}

/**
 * List import candidates under a directory (top level, by extension).
 *
 * @param {string} dir - absolute directory path.
 * @returns {{ ok: true, dir, files: Array<{ name, path, bytes, kind }> } | {{ ok: false, error, files: [] }}
 */
export function listImportCandidates(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    return { ok: false, error: `无法读取目录 ${dir}：${error instanceof Error ? error.message : String(error)}`, files: [] }
  }
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => {
      const path = join(dir, e.name)
      let bytes = 0
      try { bytes = statSync(path).size } catch { /* cosmetic */ }
      const kind = /\.zip$/i.test(e.name) ? 'zip' : 'md'
      return { name: e.name, path, bytes, kind }
    })
    .filter((f) => f.kind === 'zip' || IMPORT_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)))
    .sort((a, b) => a.name.localeCompare(b.name))
  // 只保留目录本身（不递归导入子目录内容 —— 逐个进子目录选即可）。
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => join(dir, e.name))
    .sort((a, b) => a.localeCompare(b))
  return { ok: true, dir, files, dirs }
}

/**
 * Browse one directory for the import panel: candidate files AND readable
 * subdirectories (one level).
 */
export function browseImportDir(dir) {
  const listed = listImportCandidates(dir)
  if (!listed.ok) return { ...listed, dirs: [] }
  const parent = dirname(dir) === dir ? null : dirname(dir)
  return { ok: true, dir: listed.dir, files: listed.files, dirs: listed.dirs, parent }
}

// ---------------------------------------------------------------------------
// Path containment fence (与 subagent-manager 相同的边界检查)
// ---------------------------------------------------------------------------

/** Normalize one path for containment tests. */
function normPath(value) {
  const abs = resolve(value)
  const forward = abs.replace(/\\/g, '/')
  return process.platform === 'win32' ? forward.toLowerCase() : forward
}

/** Whether `target` is `root` itself or lives beneath it. */
export function isWithin(root, target) {
  const r = normPath(root)
  const t = normPath(target)
  return t === r || t.startsWith(`${r}/`)
}

/**
 * Resolve one requested path against the allowed roots. Returns the resolved
 * absolute path, or `undefined` when nothing allowed contains it.
 */
export function resolveWithinRoots(requested, roots) {
  const candidate = expandHome(String(requested ?? '').trim())
  if (candidate === '') return undefined
  const abs = resolve(candidate)
  if (!existsSync(abs)) return undefined
  const canonical = realpathSync(abs)
  return roots.some((root) => existsSync(root) && isWithin(realpathSync(root), canonical)) ? canonical : undefined
}
