/** One independent plugin; each manager is bundled locally. */
import z from '@deepseek-ai/schemastery'
import { compatibilityIssues, createCompatibilityGuard } from './compatibility.js'
import { apply as applySkills, rejectionFor } from './skill/index.js'
import { apply as applySubagents } from './subagent/index.js'

export const name = 'dsh-team-manager'
// Cordis waits for startup services; check their contracts once available.
export const inject = ['webServer', 'tools', 'subagents', 'configEditor', 'pluginManager']
export const Config = z.object({
  skillsDir: z.string().default('~/.dsh/skills'),
  agentsDir: z.string().default('~/.dsh/agents'),
  importRoots: z.array(z.string()).default([]),
  provider: z.string().default('spawn'),
  toolName: z.string().default('run_subagent'),
  leafDenyTools: z.array(z.string()).default(['subagent', 'subagent_fork', 'workflow', 'ralph']),
  skillEnabled: z.boolean().default(true),
  subagentEnabled: z.boolean().default(true),
})

export function apply(ctx, config = {}) {
  const guard = createCompatibilityGuard(ctx)
  try {
  // Keep a diagnostic response until Loader finishes disabling the entry.
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/dsh-team-manager/api/status', handler(req, res) {
    if (req.url?.split('?')[0] === '/dsh-team-manager/api/status/disable') return guard.handleDisable(req, res)
    res.writeHead(guard.stopped ? 503 : 200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ stopped: guard.stopped, reason: guard.reason, disableError: guard.disableError }))
  } }), 'TeamManeger diagnostic status')
    const issues = compatibilityIssues(ctx, config)
    if (issues.length) { void guard.stop(issues.join('; ')); return }
    mount(guard.context, config, guard)
  } catch (error) { void guard.stop(error instanceof Error ? error.message : String(error)) }
}

function mount(ctx, config, guard) {
  const modules = { skill: config.skillEnabled !== false, subagent: config.subagentEnabled !== false }
  const recycleAvailable = () => ctx.get('sessionDeleteTrash') !== undefined
  const send = (res, status, data) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  let saving = false
  const api = async (req, res) => {
    const rejection = rejectionFor(req, ctx.get('connection'))
    if (rejection !== undefined) return send(res, rejection, { error: 'Request denied' })
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    if (url.pathname === '/dsh-team-manager/api/modules/compatibility-failure' && req.method === 'POST') {
      // Only a same-machine admitted UI can trip the plugin's circuit breaker.
      send(res, 202, { ok: true })
      void guard.stop('Client component or registration compatibility failure')
      return
    }
    if (url.pathname !== '/dsh-team-manager/api/modules') return send(res, 404, { error: 'Not found' })
    const method = String(req.method ?? 'GET').toUpperCase()
    if (method === 'GET') return send(res, 200, { ...modules, recycle: recycleAvailable() })
    if (method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
    if (saving) return send(res, 409, { error: 'Configuration update in progress' })
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk)
        size += bytes.length
        if (size > 4096) return send(res, 413, { error: 'Payload too large' })
        chunks.push(bytes)
      }
      let body
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(res, 400, { error: 'Invalid JSON' }) }
      if (!body || Array.isArray(body) || typeof body.skill !== 'boolean' || typeof body.subagent !== 'boolean' || (body.recycle !== undefined && typeof body.recycle !== 'boolean') || Object.keys(body).some(key => !['skill', 'subagent', 'recycle'].includes(key))) {
        return send(res, 400, { error: 'Expected boolean skill and subagent fields' })
      }
      const editor = ctx.get('configEditor')
      const entry = editor?.entries().find(item => item.options.id === 'dsh-team-manager' && item.options.name === 'dsh-team-manager')
      if (!entry) return send(res, 503, { error: 'TeamManeger configuration unavailable' })
      saving = true
      // The normal Loader reconciliation disposes old module routes/tools and mounts the new configuration.
      await editor.edit(entry, current => ({ ...current, skillEnabled: body.skill, subagentEnabled: body.subagent }))
      return send(res, 200, { ok: true, skill: body.skill, subagent: body.subagent, recycle: recycleAvailable() })
    } catch (error) {
      return send(res, 503, { error: error instanceof Error ? error.message : String(error) })
    } finally { saving = false }
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/dsh-team-manager/api/modules', handler: api }), 'dsh-team-manager: module configuration')
  if (modules.skill) applySkills(ctx, config)
  if (modules.subagent) applySubagents(ctx, config)
}
