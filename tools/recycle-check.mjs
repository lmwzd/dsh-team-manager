import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject } from '../lib/recycle/component.js'
import { encodeSegment, projectKey } from '../lib/recycle/shared.js'

const home = await mkdtemp(join(tmpdir(), 'dsh-team-recycle-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = home
const cwd = join(home, 'project')
const root = join(home, 'sessions')
const indexPath = join(home, 'session-delete', 'trash.json')
const original = id => join(root, projectKey(cwd), encodeSegment(id))
const parked = id => join(home, 'session-delete', 'logs', encodeSegment(id))
const exists = async path => access(path).then(() => true, () => false)
let routes = [], effects = [], connection
const provided = new Map()
const attached = new Set()
const archived = new Set()
const pinned = new Set()
const events = []
const workspace = {
 id: 'workspace-test', path: cwd,
 get sessionIds() { return [...attached] },
 async attachSession(id) { attached.add(id); events.push(['attach', id]) },
 async detachSession(id) { attached.delete(id); events.push(['detach', id]) },
}
const registry = {
 list: () => [workspace],
 get archivedSessionIds() { return [...archived] },
 get pinnedSessionIds() { return [...pinned] },
 async archiveSession(id, options) { archived.add(id); events.push(['archive', id, options]); pinned.delete(id) },
 async unarchiveSession(id) { archived.delete(id) },
 async pinSession(id) { pinned.add(id) },
 async unpinSession(id) { pinned.delete(id) },
}
const services = {
 workspaceRegistry: registry,
 sessionPersistence: { root, async stat() { return { header: { cwd } } } },
 sessionQuery: { async readTitle(id) { return { title: `Title ${id}` } } },
 configEditor: { entries: () => [], async edit() {} },
 webServer: { register(route) { assert.ok(!routes.some(item => item.path === route.path), 'no duplicate route'); routes.push(route); return () => { routes = routes.filter(item => item !== route) } } },
}
const ctx = {
 get(name) { return name === 'connection' ? connection : provided.get(name) ?? services[name] },
 webServer: services.webServer,
 provide(name, value) { assert.ok(!provided.has(name)); provided.set(name, value); return () => provided.delete(name) },
 effect(factory) { const dispose = factory(); assert.equal(typeof dispose, 'function'); effects.push(dispose); return dispose },
 logger: { warn(message) { throw Error(message) }, info() {} },
}
function dispose() { for (const fn of effects.splice(0).reverse()) fn() }
async function mount(enabled) {
 dispose()
 if (enabled) apply(ctx)
}
async function call(path, body = {}, headers = {}, method = 'POST') {
 const route = routes.filter(item => path === item.path || path.startsWith(item.path + '/')).sort((a,b) => b.path.length - a.path.length)[0]
 if (!route) return { status: 404 }
 let status, payload
 const req = { method, url: path, headers: { host: '127.0.0.1:60654', origin: 'http://127.0.0.1:60654', ...headers }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) } }
 await route.handler(req, { writeHead(value) { status = value }, end(value) { payload = JSON.parse(value) } })
 return { status, payload }
}
const trash = (method, body, headers) => call('/session-delete/api/trash/' + method, body, headers)
async function seed(id) {
 attached.add(id)
 await mkdir(original(id), { recursive: true })
 await writeFile(join(original(id), 'events.jsonl'), JSON.stringify({ type: 'session/title', seq: 1, data: { title: `Title ${id}` } }) + '\n')
 await mkdir(join(home, 'attachments', encodeSegment(id)), { recursive: true })
 await mkdir(join(home, 'storages', 'session_projcache', 'sessions'), { recursive: true })
 await writeFile(join(home, 'storages', 'session_projcache', 'sessions', encodeSegment(id) + '.json'), '{}')
}
try {
 assert.deepEqual(inject, [], 'recycle has no main-plugin dependency')
 // Persist a real pre-integration document at the legacy path, including settings,
 // an existing parked log and an already-purged tombstone.
 await mkdir(parked('legacy'), { recursive: true })
 await writeFile(join(parked('legacy'), 'events.jsonl'), JSON.stringify({ type: 'session/title', seq: 2, data: { title: 'Legacy preserved title' } }) + '\n')
 await writeFile(indexPath, JSON.stringify({ version: 1, settings: { retentionDays: 19 }, hiddenSessionIds: ['legacy', 'old-purged'], entries: [{ sessionId: 'legacy', workspaceId: workspace.id, cwd, wasArchived: false, wasPinned: true, logPath: original('legacy'), parkedLogPath: parked('legacy'), deletedAt: Date.now() }] }))
 await mount(false)
 assert.equal((await trash('list')).status, 404)
 assert.equal((await call('/session-delete/api/delete', { sessionId: 'legacy' })).status, 404)
 assert.equal(provided.has('sessionDeleteTrash'), false)
 await mount(true)
 let list = await trash('list')
 assert.equal(list.status, 200)
 assert.equal(list.payload.retentionDays, 19)
 assert.equal(list.payload.entries[0].title, 'Legacy preserved title')
 assert.ok(list.payload.hiddenSessionIds.includes('old-purged'))
 for (const path of ['/session-delete/api/trash/list', '/session-delete/api/delete']) {
  assert.equal((await call(path, {}, { origin: 'https://foreign.test' })).status, 403)
  assert.equal((await call(path, {}, { 'sec-fetch-site': 'cross-site' })).status, 403)
  connection = { admit: () => ({ rejection: 401 }) }
  assert.equal((await call(path)).status, 401)
  connection = { admit() { throw Error('auth offline') } }
  assert.equal((await call(path)).status, 503)
  connection = undefined
 }
 assert.equal((await trash('restore', { sessionId: 'legacy' })).status, 200)
 assert.ok(await exists(original('legacy')))
 assert.ok(pinned.has('legacy'))
 assert.ok(attached.has('legacy'))
 await seed('move-test')
 pinned.add('move-test')
 const moved = await call('/session-delete/api/delete', { sessionId: 'move-test' })
 assert.equal(moved.status, 200)
 assert.equal(moved.payload.trashed, true)
 assert.equal(await exists(original('move-test')), false)
 assert.ok(await exists(parked('move-test')))
 assert.ok(events.some(event => event[0] === 'archive' && event[1] === 'move-test' && event[2].stopActivity === true))
 assert.equal(attached.has('move-test'), false)
 await mount(false)
 assert.equal((await trash('list')).status, 404)
 assert.equal((await call('/session-delete/api/delete', { sessionId: 'move-test' })).status, 404)
 assert.equal(provided.has('sessionDeleteTrash'), false)
 assert.equal(routes.length, 0, 'standalone recycle disposal removes all its routes')
 assert.ok(await exists(parked('move-test')))
 await mount(true)
 list = await trash('list')
 assert.equal(list.payload.retentionDays, 19)
 assert.ok(list.payload.entries.some(entry => entry.sessionId === 'move-test'))
 assert.equal((await trash('restore', { sessionId: 'move-test' })).status, 200)
 assert.ok(await exists(original('move-test')))
 assert.ok(pinned.has('move-test'))
 assert.equal(archived.has('move-test'), false)
 assert.equal((await trash('move', { sessionId: 'move-test' })).status, 200)
 assert.equal((await trash('purge', { sessionId: 'move-test' })).status, 200)
 assert.equal(await exists(parked('move-test')), false)
 assert.equal(await exists(join(home, 'attachments', 'move-test')), false)
 assert.equal(await exists(join(home, 'storages', 'session_projcache', 'sessions', 'move-test.json')), false)
 for (const id of ['empty-a', 'empty-b']) { await seed(id); assert.equal((await trash('move', { sessionId: id })).status, 200) }
 const emptied = await trash('empty')
 assert.equal(emptied.status, 200)
 assert.equal(emptied.payload.purged, 2)
 assert.equal(emptied.payload.failed, 0)
 assert.equal((await trash('list')).payload.entries.length, 0)
 assert.equal((await trash('settings', { retentionDays: 99 })).payload.retentionDays, 30)
 await mount(true)
 assert.equal((await trash('list')).payload.retentionDays, 30)
 const persisted = JSON.parse(await readFile(indexPath, 'utf8'))
 assert.ok(persisted.hiddenSessionIds.includes('old-purged'))
 assert.ok(persisted.hiddenSessionIds.includes('move-test'))
 assert.equal(persisted.hiddenSessionIds.includes('legacy'), false)
 assert.equal(persisted.version, 1)
 assert.equal((await call('/session-delete/api/trash/list', {}, {}, 'GET')).status, 405)
 console.log('PASS: standalone recycle component without main, independent enable/disable and route/service disposal, legacy data/settings/tombstones, move/restore/purge/empty, artifact cleanup, restarts/toggle disposal, origin/auth denial, retention persistence; isolated temporary DSH_HOME')
} finally {
 dispose()
 if (previousHome === undefined) delete process.env.DSH_HOME
 else process.env.DSH_HOME = previousHome
 await rm(home, { recursive: true, force: true })
}
