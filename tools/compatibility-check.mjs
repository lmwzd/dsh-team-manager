import assert from 'node:assert/strict'
import { compatibilityIssues, createCompatibilityGuard } from '../lib/compatibility.js'
const { apply } = await import('../lib/index.js')
function fixture() {
  const live = new Set(), warnings = [], disabled = []
  const register = () => { const token = {}; live.add(token); return () => live.delete(token) }
  const services = {
    webServer: { register },
    tools: { schemas: () => [], register },
    subagents: { startActivation() {} },
    configEditor: { entries: () => [], edit() {} },
    systemPrompt: { section: register },
    pluginManager: {
      async listPlugins() { return [{ moduleName: 'other', patchId: 'other', entryId: 'other' }, { moduleName: 'dsh-team-manager', patchId: 'dsh-team-manager', entryId: 'include:dsh-team-manager' }] },
      async setPluginEnabled(id, enabled) { disabled.push([id, enabled]); return { application: 'applied' } },
    },
  }
  const ctx = { ...services, get: name => services[name], effect: fn => fn(), logger: { warn: text => warnings.push(text) } }
  return { ctx, services, live, warnings, disabled }
}
{
  const f = fixture()
  assert.deepEqual(compatibilityIssues(f.ctx), [])
  delete f.services.subagents.startActivation
  apply(f.ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.live.size, 1, 'only diagnostic route remains until Loader disables entry')
  assert.deepEqual(f.disabled, [['include:dsh-team-manager', false]], 'only own entry disabled')
  assert.match(f.warnings[0], /subagents.start/)
}
{
  const f = fixture()
  f.services.tools.schemas = () => [{ name: 'run_subagent' }]
  assert.match(compatibilityIssues(f.ctx).join(';'), /already registered/)
  assert.deepEqual(compatibilityIssues(f.ctx, { subagentEnabled: false }), [])
}
{
  const f = fixture(), guard = createCompatibilityGuard(f.ctx)
  guard.context.effect(() => f.services.webServer.register(), 'test registration')
  assert.equal(f.live.size, 1)
  await guard.stop('registration conflict')
  await guard.stop('second failure')
  assert.equal(f.live.size, 0, 'all tracked registrations rolled back')
  assert.equal(f.disabled.length, 1, 'disable is idempotent')
  guard.context.effect(() => f.services.webServer.register(), 'late registration')
  assert.equal(f.live.size, 0, 'late dependent registration cannot resurrect plugin')
}
{
  const f = fixture()
  f.services.webServer.register = () => { throw Error('duplicate route') }
  apply(f.ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.live.size, 0)
  assert.equal(f.disabled.length, 1)
}
console.log('PASS: runtime capability detection, tool conflict, own-entry auto-disable, rollback, idempotence, late registration suppression')
