// Run: node --import ./tools/test-stub-resolver.mjs tools/subagent-childcap-check.mjs
//
// Covers the per-subagent direct-child cap (`maxChildren`): frontmatter parsing,
// serialization round-trip, parent identity resolution, and the dispatch-time
// enforcement that refuses an over-cap call.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildToolDefinition, childCapOf, rosterNameOf } from '../lib/subagent/index.js'
import { parseAgentMarkdown, serializeAgentMarkdown } from '../lib/subagent/agents.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-team-manager-childcap-'))
const cfg = { toolName: 'run_subagent', provider: 'spawn', leafDenyTools: ['subagent'], leafDenyToolsExplicit: false }
const text = value => [{ type: 'text', text: value }]
const completed = { stopReason: 'completed', output: text('child answer') }
const signal = new AbortController().signal

const writeAgent = (name, frontmatter) =>
  writeFileSync(join(dir, `${name}.md`), `---\nname: ${name}\ndisplay_name: ${name}\n${frontmatter}\n---\npersona for ${name}\n`)
const writeChild = () => writeAgent('worker', 'description: does work')

/** A parent Agent whose roster identity is known only through the names map. */
const mapParent = id => ({ id, options: {}, session: { header: { delegationDepth: 0 } } })

function fixture({ children = 0, listError, names } = {}) {
  const specs = [], listeners = new Set()
  let countCalls = 0
  const service = {
    async listChildren() {
      countCalls++
      if (listError !== undefined) throw listError
      return Array.from({ length: children }, (_, i) => ({ id: `child-${i}`, mode: 'one-shot' }))
    },
  }
  const createChild = async (id, parentId) => {
    const child = { id, session: { header: { parentSession: parentId } }, ctx: {
      systemPrompt: { getSectionOrder: () => 50, section: () => {} },
      tools: { restrict: () => {} },
    } }
    for (const listener of listeners) await listener({ agent: child, source: 'startup' })
    return child
  }
  const ctx = {
    tools: { schemas: () => [{ name: 'subagent' }, { name: 'run_subagent' }] },
    on: (event, listener) => { if (event === 'agent/error') return () => {}; listeners.add(listener); return () => listeners.delete(listener) },
    get: name => (name === 'subagents' ? service : undefined),
    logger: { warn: () => {} },
    subagents: {
      async startActivation(spec) {
        specs.push(spec)
        await createChild(spec.childId, spec.request.parent.id)
        return { childId: spec.childId, messageId: 'm', result: Promise.resolve(completed), async dispose() {} }
      },
    },
  }
  const tool = buildToolDefinition(ctx, cfg, dir, names === undefined ? undefined : { names })
  return { tool, specs, service, get countCalls() { return countCalls } }
}

/** A parent that carries the installed persona section (the reload-visible link). */
const personaParent = (id, rosterName) => ({
  id,
  options: {},
  session: { header: { delegationDepth: 0 } },
  ctx: {
    systemPrompt: {
      sections: () => [{ name: 'dsh-team-manager:persona', text: `你是「${rosterName}」\nname: ${rosterName}\n职责：干活` }],
    },
  },
})

try {
  // ── frontmatter ───────────────────────────────────────────────────────────
  {
    const base = '---\nname: a\n---\nbody\n'
    const plain = parseAgentMarkdown(base, 'a.md')
    assert.equal(plain.ok, true)
    assert.equal(plain.agent.meta.maxChildren, 1, 'absent maxChildren defaults to 1')

    const zero = parseAgentMarkdown('---\nname: a\nmaxChildren: 0\n---\nbody\n', 'a.md')
    assert.equal(zero.ok, true)
    assert.equal(zero.agent.meta.maxChildren, 0, '0 means unlimited and must survive parsing')

    const three = parseAgentMarkdown('---\nname: a\nmaxChildren: 3\n---\nbody\n', 'a.md')
    assert.equal(three.agent.meta.maxChildren, 3)

    for (const bad of ['-1', 'abc', '1.5']) {
      const parsed = parseAgentMarkdown(`---\nname: a\nmaxChildren: ${bad}\n---\nbody\n`, 'a.md')
      assert.equal(parsed.ok, false, `maxChildren: ${bad} must be rejected`)
      assert.match(parsed.error, /maxChildren/)
    }
  }

  // ── serialization ─────────────────────────────────────────────────────────
  {
    const round = meta => parseAgentMarkdown(serializeAgentMarkdown({ meta, body: 'b' }), 'a.md').agent.meta
    assert.equal(serializeAgentMarkdown({ meta: { name: 'a', maxChildren: 1 }, body: 'b' }).includes('maxChildren'), false, 'the default 1 is not written')
    assert.equal(round({ name: 'a' }).maxChildren, 1)
    assert.equal(round({ name: 'a', maxChildren: 0 }).maxChildren, 0, 'unlimited survives a round trip')
    assert.equal(round({ name: 'a', maxChildren: 3 }).maxChildren, 3)
    assert.equal(round({ name: 'a', maxChildren: 3 }).deep, 1, 'the sibling deep key is unaffected')
  }

  // ── identity resolution ───────────────────────────────────────────────────
  {
    assert.equal(rosterNameOf(personaParent('p', 'lead')), 'lead')
    assert.equal(rosterNameOf({ id: 'p', ctx: { systemPrompt: { sections: () => [] } } }), undefined, 'no persona section means not a named agent')
    assert.equal(rosterNameOf({ id: 'p' }), undefined, 'a plain session is not a named agent')
    const fenced = {
      id: 'p',
      ctx: { systemPrompt: { sections: () => [{ name: 'dsh-team-manager:persona', text: '```\nname: wrong\n```\nname: right\n' }] } },
    }
    assert.equal(rosterNameOf(fenced), 'right', 'a fenced code block must not be mistaken for the identity line')
  }

  writeChild()
  writeAgent('lead', 'description: leads\nmaxChildren: 2')
  writeAgent('solo', 'description: one child\nmaxChildren: 0')
  writeAgent('default1', 'description: default cap')

  // ── enforcement ───────────────────────────────────────────────────────────
  {
    // At the cap: refused, and the host is never asked to start anything.
    const names = new Map([['lead-session', 'lead']])
    const f = fixture({ children: 2, names })
    await assert.rejects(
      () => f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('lead-session'), signal }),
      (error) => {
        assert.match(error.message, /at most 2 direct subagents/)
        assert.match(error.message, /already on record/)
        assert.match(error.message, /maxChildren/)
        return true
      },
    )
    assert.equal(f.specs.length, 0, 'an over-cap dispatch must not reach the host')
  }
  {
    // Under the cap: dispatch proceeds normally.
    const names = new Map([['lead-session', 'lead']])
    const f = fixture({ children: 1, names })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('lead-session'), signal })
    assert.equal(value.kind, 'subagent-result')
    assert.equal(f.specs.length, 1)
  }
  {
    // 0 = unlimited: no count is even read.
    const names = new Map([['solo-session', 'solo']])
    const f = fixture({ children: 99, names })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('solo-session'), signal })
    assert.equal(value.kind, 'subagent-result')
    assert.equal(f.countCalls, 0, 'an unlimited agent must not pay for a child count')
  }
  {
    // Identity survives a plugin reload through the persona text alone.
    const f = fixture({ children: 2 })
    await assert.rejects(
      () => f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: personaParent('reloaded', 'lead'), signal }),
      /at most 2 direct subagents/,
    )
    assert.equal(f.specs.length, 0)
  }
  {
    // A declared default of 1 is enforced too.
    const f = fixture({ children: 1, names: new Map([['d1', 'default1']]) })
    await assert.rejects(
      () => f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('d1'), signal }),
      /at most 1 direct subagent and its 1 direct child is already on record/,
    )
  }
  {
    // Unknown parent (the user's own session): never blocked.
    const f = fixture({ children: 99 })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('plain-user-session'), signal })
    assert.equal(value.kind, 'subagent-result')
    assert.equal(f.countCalls, 0)
  }
  {
    // A catalog that cannot be read must fail open, not block the dispatch.
    const names = new Map([['lead-session', 'lead']])
    const f = fixture({ listError: new Error('catalog unavailable'), names })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('lead-session'), signal })
    assert.equal(value.kind, 'subagent-result')
    assert.equal(f.countCalls, 2, 'the cancelled read is retried once before giving up')
  }
  {
    // A parent whose roster file was deleted is uncapped rather than stuck.
    const f = fixture({ children: 5, names: new Map([['gone', 'deleted-agent']]) })
    const value = await f.tool.execute({ agent: 'worker', prompt: 'task' }, { agent: mapParent('gone'), signal })
    assert.equal(value.kind, 'subagent-result')
  }
  {
    // Direct unit check of the resolver contract.
    const f = fixture({ children: 0, names: new Map([['lead-session', 'lead']]) })
    const cap = await childCapOf(mapParent('lead-session'), { dir, names: new Map([['lead-session', 'lead']]), countChildren: () => 0 })
    assert.deepEqual(cap, { name: 'lead', cap: 2, used: 0 })
    assert.equal(await childCapOf({ id: 'x' }, { dir, countChildren: () => 0 }), undefined)
    void f
  }

  console.log('PASS: per-subagent direct-child cap (parse/serialize/default 1/0=unlimited, identity via names map and persona scan, enforcement refusal, fail-open on unreadable or missing roster)')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
