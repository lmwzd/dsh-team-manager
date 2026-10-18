import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const target = process.argv[2] || fileURLToPath(new URL('../lib/index.js', import.meta.url))
const { apply } = await import(pathToFileURL(target).href)
const dir = mkdtempSync(join(tmpdir(), 'team-real-import-'))
const routes = [], tools = [], sections = [], disposers = []
try {
 apply({
   get: (name) => name === 'systemPrompt' ? { section(section) { sections.push(section); return () => {} } } : undefined,
   effect(fn) { const d = fn(); disposers.push(d); return d },
   webServer: { register(r) { routes.push(r); return () => {} } },
   tools: { schemas: () => [], register(t) { tools.push(t); return () => {} } },
   configEditor: { entries: () => [], edit() {} },
   subagents: { startActivation() {} },
 }, { skillsDir: join(dir, 'skills'), agentsDir: join(dir, 'agents') })
 assert.equal(routes.length, 4)
 assert.equal(tools.length, 1)
 assert.equal(tools[0].parameters.type, 'object')
 assert.deepEqual(tools[0].parameters.required, ['agent', 'prompt'])
 assert.equal(tools[0].output.schema.properties.output.items.type, undefined)
 await assert.rejects(tools[0].execute({ agent: 5 }, {}), /must be strings/)
 assert.equal(sections.length, 1)
 assert.equal(sections[0].name, 'dsh-team-manager:auto-skills')
 assert.equal(sections[0].text(), '', 'no auto skills yet → empty policy')
 console.log('Real installed host import and registration passed (no dependency stubs)')
} finally { disposers.reverse().forEach(d => d?.()); rmSync(dir, { recursive: true, force: true }) }
