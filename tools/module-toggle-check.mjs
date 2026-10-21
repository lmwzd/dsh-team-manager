import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { apply as applyRecycle, inject as recycleInject } from '../lib/recycle/component.js'
const source = process.argv[2] || new URL('../lib/index.js', import.meta.url).href
const { apply } = await import(source.startsWith('file:') ? source : pathToFileURL(source).href)
const tmp = mkdtempSync(join(tmpdir(), 'dsh-team-manager-toggle-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = tmp
const provided = new Map()
const persistence = { root: join(tmp, 'sessions') }
const registry = { list: () => [], archiveSession: async () => {}, unarchiveSession: async () => {}, pinSession: async () => {}, unpinSession: async () => {}, archivedSessionIds: [], pinnedSessionIds: [] }
let routes = [], tools = [], sections = new Map(), saved = { skillsDir: join(tmp, 'skills'), agentsDir: join(tmp, 'agents') }, writes = 0, failSave = false
const mainEffects = [], recycleEffects = []
const entry = { options: { id: 'dsh-team-manager', name: 'dsh-team-manager' } }
function dispose(effects) { for (const fn of effects.splice(0).reverse()) fn() }
function mount() {
  dispose(mainEffects)
  sections = new Map()
  apply(ctx, saved)
}
function mountRecycle(enabled) {
  dispose(recycleEffects)
  if (enabled) applyRecycle(recycleCtx)
}
const editor = { entries: () => [entry], async edit(target, change) {
  assert.equal(target, entry)
  if (failSave) throw Error('Disk write failed')
  saved = change(saved)
  assert.equal(Object.hasOwn(saved, 'recycleEnabled'), false, 'main updates never persist recycleEnabled')
  writes++; mount()
} }
const systemPrompt = { section(section) { sections.set(section.name, section); return () => sections.delete(section.name) } }
function context(effects) { return {
  get: key => provided.get(key) ?? (key === 'configEditor' ? editor : key === 'systemPrompt' ? systemPrompt : key === 'sessionPersistence' ? persistence : key === 'workspaceRegistry' ? registry : undefined),
  provide(key, value) { assert.ok(!provided.has(key)); provided.set(key, value); return () => provided.delete(key) },
  effect(fn) { const d = fn(); effects.push(d); return d },
  webServer: { register(route) { assert.ok(!routes.some(r => r.path === route.path), 'no duplicate routes'); routes.push(route); return () => { routes = routes.filter(r => r !== route) } } },
  tools: { schemas: () => [], register(tool) { tools.push(tool); return () => { tools = tools.filter(t => t !== tool) } } }, subagents: { startActivation() {} },
} }
const ctx = context(mainEffects)
const recycleCtx = context(recycleEffects)
async function call(method, body, headers = {}) {
  const route = routes.find(r => r.path === '/dsh-team-manager/api/modules')
  if (!route) return { status: 404 }
  let status, payload
  const req = { method, url: route.path, headers: { host: '127.0.0.1:60654', origin: 'http://127.0.0.1:60654', ...headers }, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) } }
  await route.handler(req, { writeHead(s) { status = s }, end(text) { payload = JSON.parse(text) } })
  return { status, payload }
}
function assertRecycle(enabled) {
  assert.equal(routes.some(r => r.path === '/session-delete/api'), enabled)
  assert.equal(routes.some(r => r.path === '/session-delete/api/trash'), enabled)
  assert.equal(provided.has('sessionDeleteTrash'), enabled)
}
try {
  assert.deepEqual(recycleInject, [], 'recycle component has no main-plugin dependency')
  mount()
  assert.deepEqual((await call('GET')).payload, { skill: true, subagent: true, recycle: false })
  assert.equal(tools.length, 1)
  for (const recycle of [false, true]) {
    const mainRoute = routes.find(r => r.path === '/dsh-team-manager/api/modules')
    mountRecycle(recycle)
    assert.equal(routes.find(r => r.path === '/dsh-team-manager/api/modules'), mainRoute, 'recycle lifecycle does not remount main')
    assert.equal((await call('GET')).payload.recycle, recycle, 'GET reads live recycle service without a main restart')
    const recycleService = provided.get('sessionDeleteTrash')
    const recycleRoutes = routes.filter(r => r.path.startsWith('/session-delete/'))
    for (const [skill, subagent] of [[true,false],[false,true],[false,false],[true,true]]) {
      assert.equal((await call('POST', { skill, subagent, recycle: !recycle })).status, 200)
      assert.deepEqual((await call('GET')).payload, { skill, subagent, recycle }, 'backward-compatible recycle field cannot toggle the component')
      assertRecycle(recycle)
      assert.equal(provided.get('sessionDeleteTrash'), recycleService, 'main reconciliation preserves recycle service')
      assert.deepEqual(routes.filter(r => r.path.startsWith('/session-delete/')), recycleRoutes, 'main reconciliation preserves recycle routes')
      assert.equal(tools.length, subagent ? 1 : 0)
      assert.equal(routes.some(r => r.path.endsWith('/skill')), skill)
      assert.equal(routes.some(r => r.path.endsWith('/subagent')), subagent)
      assert.equal(sections.has('dsh-team-manager:auto-skills'), skill, 'auto-invoke policy follows the Skill module switch')
      assert.equal(saved.skillsDir, join(tmp, 'skills'))
      assert.equal(saved.agentsDir, join(tmp, 'agents'))
      mount() // Simulated main restart reads only the persisted Skill/Subagent config.
      assert.deepEqual((await call('GET')).payload, { skill, subagent, recycle })
      assert.equal(sections.has('dsh-team-manager:auto-skills'), skill)
      assertRecycle(recycle)
    }
  }
  assert.equal(writes, 8)
  assert.equal((await call('POST', { skill:true, subagent:true })).status, 200)
  assert.equal((await call('GET')).payload.recycle, true, 'two-field POST leaves independent recycle enabled')
  assert.equal(writes, 9)
  for (const body of [null, [], {}, {skill: 'true',subagent:false}, {skill:true,subagent:false,other:1}, {skill:true,subagent:true,recycle:'true'}, {skill:true,subagent:true,recycle:null}]) assert.equal((await call('POST',body)).status,400)
  assert.equal((await call('POST',{skill:false,subagent:false},{origin:'https://foreign.test'})).status,403)
  assert.equal((await call('POST',{skill:false,subagent:false},{'sec-fetch-site':'cross-site'})).status,403)
  assert.equal((await call('POST',{skill:true,subagent:true,pad:'x'.repeat(5000)})).status,413)
  failSave=true
  assert.equal((await call('POST',{skill:false,subagent:false})).status,503)
  assert.deepEqual((await call('GET')).payload,{skill:true,subagent:true,recycle:true})
  assert.equal(writes,9)

  const recycleService = provided.get('sessionDeleteTrash')
  dispose(mainEffects)
  assert.equal((await call('GET')).status, 404)
  assert.equal(tools.length, 0)
  assert.equal(sections.size, 0)
  assertRecycle(true)
  assert.equal(provided.get('sessionDeleteTrash'), recycleService, 'turning main off leaves recycle mounted')
  mount()
  const mainRoute = routes.find(r => r.path === '/dsh-team-manager/api/modules')
  mountRecycle(false)
  assertRecycle(false)
  assert.equal(routes.find(r => r.path === '/dsh-team-manager/api/modules'), mainRoute)
  assert.deepEqual((await call('GET')).payload,{skill:true,subagent:true,recycle:false})
  assert.equal(tools.length, 1, 'turning recycle off leaves main tools mounted')
  assert.equal(sections.has('dsh-team-manager:auto-skills'), true)
  mountRecycle(true)
  assert.equal((await call('GET')).payload.recycle, true)
  assertRecycle(true)
  console.log('PASS: all 8 independent module combinations, main/recycle lifecycle isolation, dynamic recycle GET, ignored backward-compatible recycle POST, no recycleEnabled persistence, restart/route/tool/service disposal, malformed inputs, cross-origin rejection, size limit, save failure')
} finally {
  dispose(mainEffects)
  dispose(recycleEffects)
  // Let the startup sweeper settle before deleting its isolated home.
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  rmSync(tmp,{recursive:true,force:true})
}
