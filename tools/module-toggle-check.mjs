import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const source = process.argv[2] || new URL('../lib/index.js', import.meta.url).href
const { apply } = await import(source.startsWith('file:') ? source : pathToFileURL(source).href)
const tmp = mkdtempSync(join(tmpdir(), 'dsh-team-manager-toggle-'))
let routes = [], tools = [], effects = [], sections = new Map(), saved = { skillsDir: join(tmp, 'skills'), agentsDir: join(tmp, 'agents') }, writes = 0, failSave = false
const entry = { options: { id: 'dsh-team-manager', name: 'dsh-team-manager' } }
function mount() {
  effects.reverse().forEach(fn => fn()); effects = []
  sections = new Map()
  apply(ctx, saved)
}
const editor = { entries: () => [entry], async edit(target, change) {
  assert.equal(target, entry)
  if (failSave) throw Error('Disk write failed')
  saved = change(saved); writes++; mount()
} }
const systemPrompt = { section(section) { sections.set(section.name, section); return () => sections.delete(section.name) } }
const ctx = {
  get: key => key === 'configEditor' ? editor : key === 'systemPrompt' ? systemPrompt : undefined,
  effect(fn) { const d = fn(); effects.push(d); return d },
  webServer: { register(route) { routes.push(route); return () => { routes = routes.filter(r => r !== route) } } },
  tools: { schemas: () => [], register(tool) { tools.push(tool); return () => { tools = tools.filter(t => t !== tool) } } }, subagents: { startActivation() {} },
}
async function call(method, body, headers = {}) {
  const route = routes.find(r => r.path === '/dsh-team-manager/api/modules')
  let status, payload
  const req = { method, url: route.path, headers: { host: '127.0.0.1:60654', origin: 'http://127.0.0.1:60654', ...headers }, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) } }
  await route.handler(req, { writeHead(s) { status = s }, end(text) { payload = JSON.parse(text) } })
  return { status, payload }
}
try {
  mount()
  assert.deepEqual((await call('GET')).payload, { skill: true, subagent: true })
  assert.equal(tools.length, 1)
  for (const [skill, subagent] of [[true,false],[false,true],[false,false],[true,true]]) {
    assert.equal((await call('POST', { skill, subagent })).status, 200)
    assert.deepEqual((await call('GET')).payload, { skill, subagent })
    assert.equal(tools.length, subagent ? 1 : 0)
    assert.equal(routes.some(r => r.path.endsWith('/skill')), skill)
    assert.equal(routes.some(r => r.path.endsWith('/subagent')), subagent)
    assert.equal(sections.has('dsh-team-manager:auto-skills'), skill, 'auto-invoke policy follows the Skill module switch')
    assert.equal(saved.skillsDir, join(tmp, 'skills'))
    mount() // Simulated restart reads the persisted config, not a settings descriptor.
    assert.deepEqual((await call('GET')).payload, { skill, subagent })
    assert.equal(sections.has('dsh-team-manager:auto-skills'), skill)
  }
  assert.equal(writes, 4)
  for (const body of [null, [], {}, {skill: 'true',subagent:false}, {skill:true,subagent:false,other:1}]) assert.equal((await call('POST',body)).status,400)
  assert.equal((await call('POST',{skill:false,subagent:false},{origin:'https://foreign.test'})).status,403)
  assert.equal((await call('POST',{skill:false,subagent:false,'sec-fetch-site':'cross-site'},{'sec-fetch-site':'cross-site'})).status,403)
  assert.equal((await call('POST',{skill:true,subagent:true,pad:'x'.repeat(5000)})).status,413)
  failSave=true
  assert.equal((await call('POST',{skill:false,subagent:false})).status,503)
  assert.deepEqual((await call('GET')).payload,{skill:true,subagent:true})
  assert.equal(writes,4)
  console.log('PASS: all 4 module combinations, persistence/restart, route/tool disposal, preserved config, malformed inputs, cross-origin rejection, size limit, save failure')
} finally { effects.reverse().forEach(fn => fn()); rmSync(tmp,{recursive:true,force:true}) }
