// Run: node --import ./tools/test-stub-resolver.mjs tools/subagent-activation-check.mjs
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildToolDefinition } from '../lib/subagent/index.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-team-manager-activation-'))
const cfg = { toolName: 'run_subagent', provider: 'spawn', leafDenyTools: ['subagent', 'stale_tool'], leafDenyToolsExplicit: false }
const text = value => [{ type: 'text', text: value }]
const completed = { stopReason: 'completed', output: text('child answer') }
const parent = { id: 'parent-session', options: { subagentDepth: 1 }, session: { header: { delegationDepth: 3 } } }
const signal = new AbortController().signal
function fixture({ result = Promise.resolve(completed), disposalError, startupError } = {}) {
  const listeners = new Set(), specs = [], initialized = [], warnings = []
  let disposed = 0
  const createChild = async id => {
    const sections = [], restrictions = []
    const child = { id, session: { header: { parentSession: parent.id } }, ctx: {
      systemPrompt: { getSectionOrder: name => { assert.equal(name, 'DEPLOYMENT_PERSONA_PREFIX'); return 50 }, section: section => sections.push(section) },
      tools: { restrict: filter => restrictions.push(filter) },
    } }
    for (const listener of listeners) await listener({ agent: child, source: 'startup' })
    initialized.push({ id, sections, restrictions })
    return child
  }
  const ctx = {
    tools: { schemas: () => ['subagent', 'run_subagent', 'read'].map(name => ({ name })) },
    on: (event, listener) => { if (event === 'agent/error') return () => {}; assert.equal(event, 'agent/created'); listeners.add(listener); return () => listeners.delete(listener) },
    get: () => undefined,
    logger: { warn: message => warnings.push(message) },
    subagents: { async startActivation(spec) {
      specs.push(spec)
      assert.deepEqual(Object.keys(spec).sort(), ['childId', 'delivery', 'label', 'provider', 'request', 'signal'])
      assert.deepEqual(Object.keys(spec.request).sort(), ['agentOptions', 'maxDepth', 'parent', 'prompt'].filter(key => key !== 'agentOptions' || spec.request.agentOptions))
      assert.equal(spec.signal, signal)
      assert.equal(spec.request.parent, parent)
      if (startupError) throw startupError
      // Current local runtime initializes the child before accepting its inbox message.
      await createChild(spec.childId)
      return { childId: spec.childId, messageId: 'initial-inbox-message', result, async dispose() { disposed++; if (disposalError) throw disposalError } }
    } },
  }
  const tool = buildToolDefinition(ctx, cfg, dir)
  return { tool, specs, initialized, listeners, warnings, createChild, get disposed() { return disposed } }
}
const writeAgent = frontmatter => writeFileSync(join(dir, 'worker.md'), `---\nname: worker\ndisplay_name: Worker\n${frontmatter}\n---\nCustom persona with literal {{variables}}.\n`)
try {
  writeAgent('model: custom/model/variant\nthinking: high\ndeep: 0')
  {
    const f = fixture()
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: parent, signal })
    assert.deepEqual(value, { kind: 'subagent-result', label: 'Worker', output: completed.output })
    assert.deepEqual(f.specs[0].request.agentOptions, { provider: 'custom', model: 'model/variant', reasoningEffort: 'high' })
    assert.equal(f.specs[0].request.maxDepth, 4)
    assert.equal(f.specs[0].delivery, 'caller')
    assert.deepEqual(f.initialized[0].restrictions, [{ deny: ['subagent', 'run_subagent'] }])
    assert.equal(f.initialized[0].sections[0].text, 'Custom persona with literal {{variables}}.')
    assert.equal(f.initialized[0].sections[0].interpolate, false)
    assert.equal(f.disposed, 1)
    assert.equal(f.listeners.size, 0)
    assert.deepEqual(f.tool.parameters.required, ['agent', 'prompt'])
    assert.deepEqual(f.tool.output.render({}, value), completed.output)
  }
  {
    writeAgent('background: true\ndeep: 2')
    let settle
    const result = new Promise(resolve => { settle = resolve })
    const f = fixture({ result })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: parent, signal })
    assert.equal(value.kind, 'subagent-start')
    assert.equal(value.subagentId, f.specs[0].childId)
    assert.equal(f.specs[0].delivery, 'parent')
    assert.equal(f.specs[0].provider, 'spawn')
    assert.equal(f.specs[0].request.agentOptions, undefined, 'runtime inherits current parent provider/model')
    assert.equal(f.specs[0].request.maxDepth, 6)
    assert.equal(f.disposed, 0, 'background activation stays owned by runtime')
    assert.match(value.output[0].text, /after a reload, start a new named subagent/)
    await f.createChild('unrelated-child')
    assert.equal(f.initialized.at(-1).sections.length, 0)
    await f.createChild(value.subagentId)
    assert.equal(f.initialized.at(-1).sections.length, 1, 'same-process resume retains captured persona')
    settle(completed)
  }
  {
    const f = fixture()
    const values = await Promise.all([1, 2].map(index => f.tool.execute({ agent: 'worker', prompt: `task ${index}`, background: true }, { agent: parent, signal })))
    assert.notEqual(values[0].subagentId, values[1].subagentId)
    assert.equal(f.listeners.size, 2)
    assert.ok(f.initialized.every(child => child.sections.length === 1), 'concurrent starts initialize only their reserved child')
  }
  {
    const f = fixture()
    await f.tool.execute({ agent: 'worker', prompt: 'task', background: false }, { agent: parent, signal })
    assert.equal(f.specs[0].delivery, 'caller', 'explicit false overrides background frontmatter')
    assert.equal(f.disposed, 1)
  }
  for (const stopReason of ['aborted', 'error', 'max-tokens', 'refusal']) {
    const f = fixture({ result: Promise.resolve({ stopReason, output: text('partial answer') }) })
    await assert.rejects(f.tool.execute({ agent: 'worker', prompt: 'task', background: false }, { agent: parent, signal }), error => error.message.includes(`stopReason=${stopReason}`) && error.message.includes('partial answer'))
    assert.equal(f.disposed, 1)
    assert.equal(f.listeners.size, 0)
  }
  {
    const failure = Error('execution failed')
    const result = Promise.reject(failure); result.catch(() => {})
    const f = fixture({ result, disposalError: Error('dispose failed') })
    await assert.rejects(f.tool.execute({ agent: 'worker', prompt: 'task', background: false }, { agent: parent, signal }), error => error === failure)
    assert.equal(f.disposed, 1)
    assert.equal(f.listeners.size, 0)
  }
  {
    const f = fixture({ disposalError: Error('dispose failed') })
    assert.equal((await f.tool.execute({ agent: 'worker', prompt: 'task', background: false }, { agent: parent, signal })).kind, 'subagent-result')
    assert.equal(f.warnings.length, 1)
    assert.equal(f.listeners.size, 0)
  }
  {
    const f = fixture({ startupError: Error('start failed') })
    await assert.rejects(f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: parent, signal }), /start failed/)
    assert.equal(f.listeners.size, 0)
    assert.equal(f.disposed, 0)
  }
  {
    const f = fixture()
    await assert.rejects(f.tool.execute({ agent: 'missing', prompt: 'task' }, { agent: parent, signal }), /unknown subagent/)
    await assert.rejects(f.tool.execute({ agent: 'worker', prompt: 'task', background: 'yes' }, { agent: parent, signal }), /background must be boolean/)
    assert.equal(f.specs.length, 0)
  }
  console.log('PASS: activation foreground/background contracts, current route inheritance, persona initialization, leaf tools, depth, same-process continuation, stop reasons, disposal and startup failures')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
