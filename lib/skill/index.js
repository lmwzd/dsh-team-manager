/**
 * Host half of dsh-team-manager-skill.
 *
 * 管理 DSH 本机技能（`$DSH_HOME/skills/<name>/SKILL.md`），提供：
 *
 *   1. 一个 HTTP CRUD API（`/dsh-team-manager/api/skill/*`），供本插件的设置页
 *      消费：list / get / save / delete / enable / disable，加上
 *      「浏览目录 → 预览 .md / .zip → 导入」的导入链路，以及一个
 *      「宿主技能目录实际看到了什么」的 /catalog 视图。
 *   2. /catalog 读取宿主 skills 服务。文件写入后由宿主自行发现，
 *      当前会话的目录刷新时机取决于宿主；本插件不修改其他 provider。
 *
 * 文件安全契约：本插件只写 `<skills-dir>/<name>/` 目录，`<name>` 一律
 * 先过 `isValidName`（无分隔符、无 `.`/`..`），所以 API 永远不会碰到
 * skills 目录之外的东西。导入读取走与 subagent-manager 相同的信任栅栏
 * （有 connection 服务时用它，否则结构性 loopback/origin 检查）。
 */

import z from '@deepseek-ai/schemastery'
import {
  browseImportDir,
  deleteSkill,
  dshHome,
  expandHome,
  importZip,
  isModelInvocationDisabled,
  isValidName,
  listSkills,
  loadSkill,
  readAutoState,
  readNotes,
  setSkillNote,
  NOTE_MAX,
  readMdImportCandidate,
  renderAutoPolicy,
  resolveWithinRoots,
  saveSkill,
  setSkillAuto,
  setSkillEnabled,
  skillsDir,
  slugify,
} from './skills.js'

/** Loader/plugin name, used for log prefixes. */
const PLUGIN_NAME = 'dsh-team-manager-skill'

/** HTTP prefix this plugin's routes live under. */
const API_PREFIX = '/dsh-team-manager/api/skill'

/** Loopback hostnames a same-machine caller can legitimately use. */
const LOOPBACK_NAMES = new Set(['127.0.0.1', '[::1]', '::1', 'localhost'])

// ---------------------------------------------------------------------------
// Trust fence (same shape as the kernel's /api admission; self-contained)
// ---------------------------------------------------------------------------

/** Split a Host/Origin/Referer value into {scheme, hostname, port}. */
function authorityOf(value, defaultScheme) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let url
  try {
    url = new URL(value.includes('://') ? value.trim() : `${defaultScheme ?? 'http'}://${value.trim()}`)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const port = url.port === '' ? (url.protocol === 'https:' ? '443' : '80') : url.port
  return { scheme: url.protocol.replace(':', ''), hostname: url.hostname.toLowerCase(), port }
}

/** The desktop app's own relay Referer (dsh-app://app) is same-machine. */
function isDesktopRelayReferer(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'dsh-app:' && url.hostname === 'app' && url.port === ''
  } catch {
    return false
  }
}

/** Structural fence: loopback host, no cross-site fetch, origin/host match. */
function structuralRejection(req) {
  const host = authorityOf(req.headers?.host, 'http')
  if (host === null || !LOOPBACK_NAMES.has(host.hostname)) return 403
  const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
  if (site === 'cross-site') return 403
  for (const header of ['origin', 'referer']) {
    const raw = req.headers?.[header]
    if (typeof raw !== 'string' || raw.trim() === '') continue
    if (header === 'referer' && isDesktopRelayReferer(raw)) continue
    const authority = authorityOf(raw.trim())
    if (authority === null) return 403
    if (authority.scheme !== host.scheme || authority.hostname !== host.hostname || authority.port !== host.port) return 403
  }
  return undefined
}

/**
 * Decide one request's rejection status, preferring the composition's own
 * `connection` service when it exists. Read late, per request.
 *
 * Exported for the headless self-check; the plugin contract is
 * apply/inject/Config.
 */
export function rejectionFor(req, connection) {
  try {
    if (connection !== undefined) {
      if (typeof connection.admit === 'function') {
        const admission = connection.admit(req)
        const status = admission && typeof admission === 'object' ? admission.rejection : undefined
        return status === undefined ? undefined : status
      }
      if (typeof connection.requestRejection === 'function') {
        return connection.requestRejection(req)
      }
    }
  } catch {
    // Never bypass browser authentication when the mounted service fails.
    return 503
  }
  return structuralRejection(req)
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/** Read a bounded JSON body. */
async function readJsonBody(req, maxBytes = 512 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  return JSON.parse(text)
}

/** Write one JSON response. */
function writeJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

// ---------------------------------------------------------------------------
// API field validation (the settings UI's save payload)
// ---------------------------------------------------------------------------

/** Coerce one save body into { name, description, body }, throwing clearly. */
export function validateSave(payload) {
  if (payload === null || typeof payload !== 'object') throw new Error('body must be a JSON object')
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!isValidName(name)) {
    throw new Error('invalid name: 小写字母 / 数字 / - _ . / 中文，不能为空、不含空格或分隔符')
  }
  const description = typeof payload.description === 'string' ? payload.description.trim() : ''
  if (description === '') throw new Error('description is required')
  if (description.length > 4000) throw new Error('description longer than 4000 characters')
  const body = typeof payload.body === 'string' ? payload.body : ''
  if (body.length > 512 * 1024) throw new Error('body longer than 512KB')
  const id = typeof payload.id === 'string' ? payload.id : undefined
  if (id !== undefined && !isValidName(id)) throw new Error('invalid skill directory')
  const extraFrontmatter = typeof payload.extraFrontmatter === 'string' ? payload.extraFrontmatter : undefined
  return { name, description, body, id, extraFrontmatter }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Services this host half needs. `skills` 用来读取宿主技能目录快照与
 * （当它是本插件注册的 provider 时）失效缓存；`connection` 与
 * `workspaceRegistry` 按需 `ctx.get` —— 缺失时优雅降级。
 */
export const inject = ['webServer']

/** Plugin configuration (schemastery = the loader's Config contract). */
export const Config = z.object({
  /** Directory of `<name>/SKILL.md` skill trees; `~` expands to the home. */
  skillsDir: z.string().default('~/.dsh/skills'),
  /**
   * Extra directories the import surface may read. Registered workspace
   * directories and the dsh home are always allowed.
   */
  importRoots: z.array(z.string()).default([]),
})

export function apply(ctx, config) {
  const cfg = {
    skillsDir: config?.skillsDir ?? '~/.dsh/skills',
    importRoots: Array.isArray(config?.importRoots) ? config.importRoots : [],
  }
  const dir = cfg.skillsDir === '~/.dsh/skills' ? skillsDir() : expandHome(cfg.skillsDir)

  // ── skills 服务桥接 ─────────────────────────────────────────────────────
  // 目录写入完成后，这里尽力让宿主的技能目录尽快反映变化：
  //   * ctx.get('skills') 存在时，读取它的 snapshot 作为 /catalog 视图；
  //   * 没有该服务（或调用失败）时静默降级 —— 文件系统仍然是事实源，
  //     下一次会话/下一次技能枚举自然会发现新文件。
  const hostCatalog = async () => {
    try {
      const skills = ctx.get('skills')
      if (skills !== undefined && typeof skills.list === 'function') {
        const list = await skills.list({})
        if (Array.isArray(list)) {
          return list.map((s) => ({
            name: s?.name,
            description: s?.description ?? '',
            source: s?.source ?? '',
            provider: s?.provider ?? '',
            path: s?.path ?? '',
          }))
        }
      }
    } catch {
      // fall through to file-system view
    }
    const { skills } = listSkills(dir)
    return skills.map((s) => ({ name: s.name, description: s.description, source: 'user-dsh', provider: '', path: s.dir }))
  }

  // ── import roots ────────────────────────────────────────────────────────
  const staticImportRoots = [dshHome(), ...(cfg.importRoots ?? []).map((root) => expandHome(root))]
    .filter((root) => typeof root === 'string' && root !== '')
  const pickedImportRoots = new Set()
  const importRoots = () => {
    const roots = []
    try {
      const registry = ctx.get('workspaceRegistry')
      for (const workspace of registry?.list?.() ?? []) {
        if (typeof workspace?.path === 'string' && workspace.path !== '') roots.push(workspace.path)
      }
    } catch { /* registry not mounted — configured roots still stand */ }
    roots.push(...staticImportRoots, ...pickedImportRoots)
    return roots
  }

  // ── HTTP CRUD API ────────────────────────────────────────────────────────
  const api = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    const route = url.pathname.startsWith(`${API_PREFIX}/`) ? url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') : ''
    const method = String(req.method ?? 'GET').toUpperCase()
    const connection = ctx.get('connection')
    const rejection = rejectionFor(req, connection)
    if (rejection !== undefined) {
      return writeJson(res, rejection, { ok: false, error: rejection === 401 ? 'unauthorized' : 'forbidden' })
    }
    const send = (status, payload) => writeJson(res, status, payload)
    try {
      if (method === 'GET' && route === '/skills') {
        const { skills, broken } = listSkills(dir)
        const auto = readAutoState(dir)
        const notes = readNotes(dir)
        return send(200, {
          ok: true,
          dir,
          skills: skills.map((skill) => ({
            ...skill,
            auto: auto.has(skill.id),
            modelInvocable: !isModelInvocationDisabled(skill.extraFrontmatter),
            note: notes.get(skill.id) ?? '',
          })),
          broken,
        })
      }
      if (method === 'GET' && route === '/skills/get') {
        const name = url.searchParams.get('name') ?? ''
        const loaded = loadSkill(dir, name)
        if (!loaded.ok) return send(404, { ok: false, error: loaded.error })
        return send(200, { ok: true, skill: loaded.skill })
      }
      if (method === 'GET' && route === '/catalog') {
        return send(200, { ok: true, catalog: await hostCatalog() })
      }
      if (method === 'POST' && route === '/skills/save') {
        const payload = await readJsonBody(req)
        let saved
        try {
          saved = validateSave(payload)
        } catch (error) {
          return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
        const path = saveSkill(dir, saved)
        return send(200, { ok: true, path, name: saved.name })
      }
      if (method === 'POST' && route === '/skills/delete') {
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        const removed = deleteSkill(dir, name)
        return send(200, { ok: true, removed })
      }
      if (method === 'POST' && route === '/skills/enable') {
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        const enabled = payload?.enabled !== false
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        const changed = setSkillEnabled(dir, name, enabled)
        return send(200, { ok: true, changed, enabled })
      }
      if (method === 'POST' && route === '/skills/auto') {
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        if (typeof payload?.auto !== 'boolean') return send(400, { ok: false, error: 'auto must be a boolean' })
        try {
          const auto = setSkillAuto(dir, name, payload.auto)
          return send(200, { ok: true, name, auto })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const status = message.includes('disable-model-invocation') ? 400 : 404
          return send(status, { ok: false, error: message })
        }
      }
      if (method === 'POST' && route === '/skills/note') {
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        if (typeof payload?.note !== 'string') return send(400, { ok: false, error: 'note must be a string' })
        if (payload.note.length > NOTE_MAX * 4) return send(400, { ok: false, error: 'note is too long' })
        try {
          const note = setSkillNote(dir, name, payload.note)
          return send(200, { ok: true, name, note })
        } catch (error) {
          return send(404, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      // ── import: browse / preview / commit ────────────────────────────────
      if (method === 'POST' && route === '/import/pick-directory') {
        const capability = ctx.get('directoryPicker')?.capability()
        if (capability?.kind !== 'native') {
          return send(503, { ok: false, error: '当前宿主未提供系统目录选择窗口，请手动输入路径后按回车。' })
        }
        const controller = new AbortController()
        const abort = () => controller.abort()
        res.on?.('close', abort)
        try {
          const picked = await capability.pick(controller.signal)
          if (picked === null) return send(200, { ok: true, path: null })
          const browsed = browseImportDir(picked)
          if (!browsed.ok) return send(400, { ok: false, error: browsed.error })
          pickedImportRoots.add(browsed.dir)
          return send(200, { ok: true, path: browsed.dir })
        } finally {
          res.off?.('close', abort)
        }
      }
      if (method === 'GET' && route === '/import/roots') {
        return send(200, { ok: true, roots: importRoots() })
      }
      if (method === 'GET' && route === '/import/browse') {
        const requested = url.searchParams.get('path') ?? ''
        const roots = importRoots()
        if (requested === '') {
          return send(200, { ok: true, roots, dir: null, files: [], dirs: [], parent: null })
        }
        const target = resolveWithinRoots(requested, roots)
        if (target === undefined) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import browse refused (outside roots): ${requested} | roots: ${roots.join(', ')}`)
          return send(403, { ok: false, error: `路径不在允许导入的目录内：${requested}` })
        }
        const browsed = browseImportDir(target)
        if (!browsed.ok) return send(400, { ok: false, error: browsed.error })
        const parent = browsed.parent !== null && resolveWithinRoots(browsed.parent, roots) !== undefined
          ? browsed.parent : null
        return send(200, { ok: true, roots, ...browsed, parent })
      }
      if (method === 'POST' && route === '/import/preview') {
        const payload = await readJsonBody(req)
        const roots = importRoots()
        const target = resolveWithinRoots(String(payload?.path ?? ''), roots)
        if (target === undefined) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import preview refused (outside roots): ${payload?.path} | roots: ${roots.join(', ')}`)
          return send(403, { ok: false, error: `路径不在允许导入的目录内：${payload?.path}` })
        }
        if (/\.zip$/i.test(target)) {
          // ZIP 预览：解到临时目录看一眼有多少 SKILL.md，但不落盘到 skills 目录。
          return send(200, { ok: true, candidate: { kind: 'zip', source: target, name: slugify(target.split(/[\\/]/).pop()?.replace(/\.zip$/i, '')) } })
        }
        const candidate = readMdImportCandidate(target)
        if (!candidate.ok) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import preview failed: ${target}: ${candidate.error}`)
          return send(400, { ok: false, error: candidate.error })
        }
        return send(200, { ok: true, candidate: { kind: 'md', ...candidate } })
      }
      if (method === 'POST' && route === '/import/commit') {
        const payload = await readJsonBody(req)
        const roots = importRoots()
        const target = resolveWithinRoots(String(payload?.path ?? ''), roots)
        if (target === undefined) {
          return send(403, { ok: false, error: `路径不在允许导入的目录内：${payload?.path}` })
        }
        if (/\.zip$/i.test(target)) {
          const result = importZip(target, dir)
          if (!result.ok) return send(400, { ok: false, error: result.error })
          return send(200, {
            ok: true,
            results: [
              ...result.imported.map(({ name, dir: d }) => ({ path: target, name, status: 'imported' })),
              ...result.errors.map((error) => ({ path: target, status: 'failed', error })),
            ],
          })
        }
        const candidate = readMdImportCandidate(target)
        if (!candidate.ok) return send(400, { ok: false, error: candidate.error })
        // 用户可以在提交时覆盖 name。
        const name = typeof payload?.name === 'string' && payload.name.trim() !== '' ? slugify(payload.name) : candidate.name
        const loaded = loadSkill(dir, name)
        if (loaded.ok && payload?.conflict !== 'overwrite') {
          return send(200, { ok: true, results: [{ path: target, name, status: 'skipped', error: '同名技能已存在' }] })
        }
        try {
          saveSkill(dir, { name, id: loaded.ok ? name : undefined, description: candidate.description, body: candidate.body, extraFrontmatter: candidate.extraFrontmatter })
          return send(200, { ok: true, results: [{ path: target, name, status: 'imported' }] })
        } catch (error) {
          return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      if (method === 'POST' && route === '/import/from-text') {
        // 「从文本导入」：用户直接贴一段 markdown，作为新技能正文。
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        const description = typeof payload?.description === 'string' ? payload.description.trim() : ''
        if (description === '') return send(400, { ok: false, error: 'description is required' })
        const body = typeof payload?.body === 'string' ? payload.body : ''
        const loaded = loadSkill(dir, name)
        if (loaded.ok && payload?.conflict !== 'overwrite') {
          return send(200, { ok: true, results: [{ name, status: 'skipped', error: '同名技能已存在' }] })
        }
        try {
          const path = saveSkill(dir, { name, id: loaded.ok ? name : undefined, description, body })
          return send(200, { ok: true, results: [{ name, status: 'imported', path }] })
        } catch (error) {
          return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      return send(404, { ok: false, error: 'unknown skill-manager API route' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.logger?.warn?.(`${PLUGIN_NAME}: api ${route || '/'} failed: ${message}`)
      return send(400, { ok: false, error: message })
    }
  }

  // ── 自动调用策略 ────────────────────────────────────────────────────────
  // 被标记的技能会在每次模型步骤的系统提示里得到一条明确的路由规则：
  // 任务与描述匹配时必须先调用 `skill` 工具。只用公开的
  // systemPrompt.section()；服务晚于本插件挂载时用 ctx.inject 等待它。
  const registerAutoPolicy = (host, owner) => {
    if (host === undefined || typeof host.section !== 'function') return
    const teamPolicy = typeof host.getSectionOrder === 'function'
      ? host.getSectionOrder('TEAM_POLICY')
      : undefined
    owner.effect(() => host.section({
      name: 'dsh-team-manager:auto-skills',
      order: (Number.isFinite(teamPolicy) ? teamPolicy : 600) + 100,
      text: () => renderAutoPolicy(dir),
    }), 'dsh-team-manager-skill: auto-invoke policy')
  }
  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], (child) => registerAutoPolicy(child.systemPrompt, ctx))
  } else {
    // Headless self-check contexts have no inject(); degrade to a direct read.
    registerAutoPolicy(ctx.get('systemPrompt'), ctx)
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: api }), `${PLUGIN_NAME}: ${API_PREFIX} routes`)
}
