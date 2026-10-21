import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
/** Runtime contracts, deliberately independent of DSH version numbers. */
export function compatibilityIssues(ctx, config = {}) {
  const issues = []
  const need = (object, methods, label) => {
    for (const method of methods) if (typeof object?.[method] !== 'function') issues.push(`${label}.${method}() unavailable`)
  }
  need(ctx, ['get', 'effect'], 'context')
  const get = name => ctx.get?.(name) ?? ctx[name]
  need(get('webServer'), ['register'], 'webServer')
  need(get('configEditor'), ['entries', 'edit'], 'configEditor')
  if (config.skillEnabled !== false) need(get('systemPrompt'), ['section'], 'systemPrompt')
  if (config.subagentEnabled !== false) {
    need(get('tools'), ['register', 'schemas'], 'tools')
    need(get('subagents'), ['startActivation'], 'subagents')
    if (typeof get('tools')?.schemas === 'function') {
      const schemas = get('tools').schemas()
      if (!Array.isArray(schemas)) issues.push('tools.schemas() returned an incompatible value')
      else if (schemas.some(tool => tool.name === (config.toolName || 'run_subagent'))) issues.push(`tool name already registered: ${config.toolName || 'run_subagent'}`)
    }
  }
  return issues
}

export function createCompatibilityGuard(ctx) {
  const disposers = []
  let stopped = false
  let pending
  let reason = ''
  let disableError = ''
  const token = randomUUID()
  const disable = async () => {
    const manager = ctx.root?.get?.('pluginManager') ?? ctx.get?.('pluginManager')
    if (typeof manager?.listPlugins !== 'function' || typeof manager?.setPluginEnabled !== 'function') throw new Error('pluginManager disable API unavailable')
    const entries = await manager.listPlugins()
    const entry = entries.find(item => item.moduleName === 'dsh-team-manager' && item.patchId === 'dsh-team-manager')
    if (!entry) throw new Error('TeamManeger own entry unavailable')
    const result = await manager.setPluginEnabled(entry.entryId, false)
    if (!['applied', 'restart-required'].includes(result.application)) throw new Error(JSON.stringify(result))
  }
  const cleanup = () => {
    for (const dispose of disposers.splice(0).reverse()) {
      try { dispose?.() } catch (error) { ctx.logger?.warn?.(`TeamManeger cleanup: ${String(error)}`) }
    }
  }
  const stop = message => {
    if (stopped) return pending
    reason = message
    try { writeFileSync(join(tmpdir(), 'dsh-team-manager-last-conflict.json'), JSON.stringify({ time: new Date().toISOString(), reason })) } catch {}
    stopped = true
    cleanup()
    ctx.logger?.warn?.(`TeamManeger automatically stopped: ${reason}`)
    pending = Promise.resolve().then(async () => {
      const web = ctx.get?.('webServer') ?? ctx.webServer
      if (typeof web?.getOrigin === 'function') {
        // A new HTTP request leaves the HMR AsyncLocalStorage transaction.
        const response = await fetch(new URL('/dsh-team-manager/api/status/disable', web.getOrigin()), { method: 'POST', headers: { 'x-dsh-team-manager-stop': token }, signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw new Error(`Disable request HTTP ${response.status}`)
      } else await disable()
    }).catch(error => { disableError = String(error); ctx.logger?.warn?.(`TeamManeger persistent disable failed: ${String(error)}`) })
    return pending
  }
  // Never inherit from or assign through Cordis' Context proxy: its setter may
  // redirect a write to the original context and replace effect recursively.
  const originalEffect = ctx.effect.bind(ctx)
  const tracked = {
    get: ctx.get.bind(ctx),
    ...(typeof ctx.inject === 'function' ? { inject: ctx.inject.bind(ctx) } : {}),
    ...(typeof ctx.on === 'function' ? { on: ctx.on.bind(ctx) } : {}),
    ...(typeof ctx.provide === 'function' ? { provide: ctx.provide.bind(ctx) } : {}),
    logger: ctx.logger,
  }
  for (const name of ['webServer', 'tools', 'subagents', 'configEditor']) tracked[name] = ctx.get?.(name) ?? ctx[name]
  tracked.effect = (factory, label) => originalEffect(() => {
    if (stopped) return () => {}
    const dispose = factory()
    if (typeof dispose !== 'function') throw new TypeError(`Incompatible registration disposer: ${label}`)
    let active = true
    const once = () => { if (active) { active = false; return dispose() } }
    disposers.push(once)
    return once
  }, label)
  ctx.effect(() => cleanup, 'TeamManeger compatibility cleanup')
  return { context: tracked, stop, async handleDisable(req, res) {
    if (!stopped || req.method !== 'POST' || req.headers['x-dsh-team-manager-stop'] !== token) { res.writeHead(403); res.end(); return }
    // Respond before self-disposal removes the route; retain errors for status.
    res.writeHead(202); res.end()
    await disable().catch(error => { disableError = String(error); ctx.logger?.warn?.(disableError) })
  }, get stopped() { return stopped }, get reason() { return reason }, get disableError() { return disableError } }
}
