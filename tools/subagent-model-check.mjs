// Round-trip check: the model a user saves through the Subagent API must come
// back from the roster AND be carried into the dispatch request as agentOptions.
// All identities here are synthetic — no real subagent or provider is referenced.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildToolDefinition } from '../lib/subagent/index.js'
import { listAgentFiles, saveAgent, parseAgentMarkdown } from '../lib/subagent/agents.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-team-manager-model-'))
const text = value => [{ type: 'text', text: value }]
const NAME = 'worker'
const ROUTE = 'example-provider/example-model'
const meta = model => ({ name: NAME, displayName: 'Worker', description: 'example', ...(model === '' ? {} : { model }) })

try {
  // 1. Save a per-agent model exactly as the UI payload does.
  saveAgent(dir, { meta: { ...meta(ROUTE), thinking: 'max' }, body: 'persona' })

  // 2. The roster the UI renders must echo that route back.
  const listed = listAgentFiles(dir)
  assert.equal(listed.agents.length, 1)
  assert.equal(listed.agents[0].meta.model, ROUTE, 'roster must echo the saved model')
  assert.equal(listed.agents[0].meta.thinking, 'max')

  // 3. The on-disk frontmatter must be a plain readable route.
  const raw = readFileSync(join(dir, `${NAME}.md`), 'utf8')
  assert.match(raw, /^model: example-provider\/example-model$/m)

  // 4. Dispatch must carry the route as agentOptions.
  const specs = []
  const parent = { id: 'parent', options: {}, session: { header: {} } }
  const ctx = {
    tools: { schemas: () => [] },
    get: () => undefined,
    logger: { warn() {} },
    on: () => () => {},
    subagents: {
      async startActivation(spec) {
        specs.push(spec)
        return { childId: spec.childId, result: Promise.resolve({ stopReason: 'completed', output: text('ok') }), async dispose() {} }
      },
    },
  }
  const tool = buildToolDefinition(ctx, { toolName: 'run_subagent', provider: 'spawn', leafDenyTools: [] }, dir)
  await tool.execute({ agent: NAME, prompt: 'x' }, { agent: parent, signal: new AbortController().signal })
  assert.deepEqual(specs[0].request.agentOptions, { provider: 'example-provider', model: 'example-model', reasoningEffort: 'max' })

  // 5. Clearing the field must fall back to inheritance (no agentOptions).
  saveAgent(dir, { meta: meta(''), body: 'persona' })
  const cleared = parseAgentMarkdown(readFileSync(join(dir, `${NAME}.md`), 'utf8'), `${NAME}.md`)
  assert.equal(cleared.ok, true)
  assert.equal(cleared.agent.meta.model, undefined, 'empty model must mean inherit, not a literal empty route')
  specs.length = 0
  await tool.execute({ agent: NAME, prompt: 'x' }, { agent: parent, signal: new AbortController().signal })
  assert.equal(specs[0].request.agentOptions, undefined, 'inherit mode must send no agentOptions')

  console.log('PASS: saved model round-trips to roster, disk frontmatter, and dispatch agentOptions; empty model inherits')

  // 6. A level spelled for another provider must be translated, not dropped.
  saveAgent(dir, { meta: { ...meta('example-provider/light-model'), thinking: 'high' }, body: 'persona' })
  const routes = []
  const lightCtx = {
    tools: { schemas: () => [] },
    logger: { warn() {} },
    on: () => () => {},
    get: () => ({
      // This route declares light/balanced/deep, not high.
      async resolveModelInfo() { return { provider: 'example-provider', id: 'light-model', name: 'x', reasoning: { efforts: [{ id: 'light', name: 'L' }, { id: 'balanced', name: 'B' }, { id: 'deep', name: 'D' }], defaultEffort: 'balanced' } } },
    }),
    subagents: {
      async startActivation(spec) {
        routes.push(spec)
        return { childId: spec.childId, result: Promise.resolve({ stopReason: 'completed', output: text('ok') }), async dispose() {} }
      },
    },
  }
  const lightTool = buildToolDefinition(lightCtx, { toolName: 'run_subagent', provider: 'spawn', leafDenyTools: [] }, dir)
  await lightTool.execute({ agent: NAME, prompt: 'x' }, { agent: parent, signal: new AbortController().signal })
  assert.equal(routes[0].request.agentOptions.reasoningEffort, 'deep', 'high must map onto the declared deep level instead of being dropped')

  // 7. The union validator accepts every provider vocabulary.
  for (const level of ['off', 'light', 'low', 'medium', 'balanced', 'high', 'deep', 'max']) {
    saveAgent(dir, { meta: { ...meta(''), thinking: level }, body: 'persona' })
    assert.equal(parseAgentMarkdown(readFileSync(join(dir, `${NAME}.md`), 'utf8'), `${NAME}.md`).ok, true, `${level} must be accepted`)
  }

  console.log('PASS: cross-provider thinking levels translate onto the declared vocabulary and all spellings validate')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
