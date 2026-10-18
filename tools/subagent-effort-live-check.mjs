// Verify dispatch-time thinking-level resolution against a provider's declared
// vocabulary: a stored `max` must land on the declared `deep`, not vanish.
// All identities here are synthetic — no real subagent, provider or model is referenced.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildToolDefinition } from '../lib/subagent/index.js'
import { saveAgent } from '../lib/subagent/agents.js'

// One provider's vocabulary: it declares light/balanced/deep and no literal
// "max", which is the shape that used to make a stored `max` disappear.
const DECLARED = ['light', 'balanced', 'deep']
const NAME = 'worker'
const MODEL = 'example-model'
const dir = mkdtempSync(join(tmpdir(), 'dsh-team-manager-effort-'))
const parent = { id: 'parent', options: {}, session: { header: {} } }
const text = value => [{ type: 'text', text: value }]

function fixture({ declared = DECLARED, defaultEffort = 'balanced', thinking }) {
  const specs = []
  saveAgent(dir, { meta: { name: NAME, displayName: 'Worker', description: 'example', model: `example-provider/${MODEL}`, ...(thinking ? { thinking } : {}) }, body: 'p' })
  const ctx = {
    tools: { schemas: () => [] },
    logger: { warn() {} },
    on: () => () => {},
    get: () => ({
      async resolveModelInfo() {
        return { provider: 'example-provider', id: MODEL, name: 'Example Model', reasoning: { efforts: declared.map(id => ({ id, name: id })), ...(defaultEffort === null ? {} : { defaultEffort }) } }
      },
    }),
    subagents: {
      async startActivation(spec) {
        specs.push(spec)
        return { childId: spec.childId, result: Promise.resolve({ stopReason: 'completed', output: text('ok') }), async dispose() {} }
      },
    },
  }
  const tool = buildToolDefinition(ctx, { toolName: 'run_subagent', provider: 'spawn', leafDenyTools: [] }, dir)
  return { tool, specs }
}

try {
  const run = async (options, args = { agent: NAME, prompt: 'x' }) => {
    const f = fixture(options)
    await f.tool.execute(args, { agent: parent, signal: new AbortController().signal })
    return f.specs[0]?.request.agentOptions ?? {}
  }

  // The regression: `max` was previously dropped because the route never declares it.
  assert.equal((await run({ thinking: 'max' })).reasoningEffort, 'deep', 'max must translate to the declared deep level')
  assert.equal((await run({ thinking: 'high' })).reasoningEffort, 'deep', 'high must translate to deep')
  assert.equal((await run({ thinking: 'light' })).reasoningEffort, 'light', 'a natively declared level passes through untouched')
  assert.equal((await run({ thinking: 'balanced' })).reasoningEffort, 'balanced')
  // A route with its own spelling must keep that exact literal.
  assert.equal((await run({ thinking: 'medium', declared: ['off', 'low', 'medium', 'high', 'max'] })).reasoningEffort, 'medium', 'native spelling is never rewritten')
  assert.equal((await run({ thinking: 'high', declared: ['off', 'low', 'medium', 'high', 'max'] })).reasoningEffort, 'high')
  // No thinking in the file means the inherited route decision stands.
  assert.equal((await run({ thinking: undefined })).reasoningEffort, undefined, 'unset thinking must not invent an effort')
  // A model with no reasoning control at all must not receive a bogus level.
  assert.equal((await run({ thinking: 'max', declared: [], defaultEffort: null })).reasoningEffort, undefined, 'non-reasoning model gets no effort')

  console.log('PASS: stored thinking levels resolve onto the provider-declared vocabulary (max->deep), native spellings preserved, non-reasoning models untouched')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
