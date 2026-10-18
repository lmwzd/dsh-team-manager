import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listAutoSkills,
  readAutoState,
  renderAutoPolicy,
  setSkillAuto,
  writeAutoState,
} from '../lib/skill/skills.js'

const tmp = mkdtempSync(join(tmpdir(), 'dsh-team-manager-auto-'))
const dir = join(tmp, 'skills')

function addSkill(id, name, description, options = {}) {
  const skillDir = join(dir, id)
  const file = join(skillDir, options.disabled ? 'SKILL.md.disabled' : 'SKILL.md')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n${options.extra ?? ''}---\n\nBody of ${name}.\n`, 'utf8')
}

const disposers = []
const routes = []
const sections = new Map()

function makeCtx({ withPrompt = true, withInject = true } = {}) {
  const ctx = {
    get(name) {
      if (name === 'systemPrompt' && withPrompt) {
        return {
          section(section) {
            sections.set(section.name, section)
            return () => sections.delete(section.name)
          },
        }
      }
      return undefined
    },
    effect(fn) {
      const dispose = fn()
      disposers.push(dispose)
      return dispose
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => { routes.length = 0 }
      },
    },
    logger: { warn() {} },
  }
  if (withInject) {
    ctx.inject = (dependencies, callback) => {
      assert.deepEqual(dependencies, ['systemPrompt'])
      callback({
        systemPrompt: ctx.get('systemPrompt'),
        effect: ctx.effect,
      })
    }
  }
  return ctx
}

async function loadHost() {
  const url = new URL('../lib/skill/index.js', import.meta.url).href
  return import(`${url}?t=${Date.now()}`)
}

async function request(method, path, body, headers = {}) {
  const route = routes[routes.length - 1]
  assert.ok(route, 'skill API route registered')
  let status
  let payload
  const req = {
    method,
    url: `/dsh-team-manager/api/skill${path}`,
    headers: {
      host: '127.0.0.1:60654',
      origin: 'http://127.0.0.1:60654',
      ...headers,
    },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
  await route.handler(req, {
    writeHead(value) { status = value },
    end(text) { payload = JSON.parse(text) },
  })
  return { status, payload }
}

try {
  addSkill('alpha', 'alpha', 'Use when the user asks about apples.')
  addSkill('beta', 'beta', 'Use when the user asks about bananas.', { extra: 'disable-model-invocation: true\n' })
  addSkill('gamma', 'gamma', 'Use when the user asks about grapes.', { disabled: true })

  // ── file layer ────────────────────────────────────────────────────────────
  assert.equal(setSkillAuto(dir, 'alpha', true), true)
  assert.throws(() => setSkillAuto(dir, 'beta', true), /disable-model-invocation/)
  assert.equal(setSkillAuto(dir, 'gamma', true), true)
  assert.deepEqual([...readAutoState(dir)].sort(), ['alpha', 'gamma'])
  assert.match(renderAutoPolicy(dir), /`alpha`/)
  assert.doesNotMatch(renderAutoPolicy(dir), /`beta`/, 'disable-model-invocation skills stay out of the policy')
  assert.doesNotMatch(renderAutoPolicy(dir), /`gamma`/, 'disabled skills stay out of the policy')
  assert.equal(listAutoSkills(dir).length, 1)
  assert.throws(() => setSkillAuto(dir, 'missing', true), /unknown skill/)
  assert.throws(() => setSkillAuto(dir, '../escape', true), /invalid skill name/)

  writeAutoState(dir, ['alpha', '../bad', 'beta'])
  assert.deepEqual([...readAutoState(dir)].sort(), ['alpha', 'beta'])

  // The pre-rename state directory must keep working, so upgrading the plugin
  // does not silently switch every auto-invoke preference off. The current
  // location wins once it exists.
  const currentState = join(dir, '.dsh-team-manager', 'auto.json')
  rmSync(currentState, { force: true })
  mkdirSync(join(dir, '.teammaneger'), { recursive: true })
  writeFileSync(join(dir, '.teammaneger', 'auto.json'), JSON.stringify({ version: 1, skills: ['alpha'] }), 'utf8')
  assert.deepEqual([...readAutoState(dir)], ['alpha'], 'legacy state directory is read after the rename')
  writeAutoState(dir, ['gamma'])
  assert.deepEqual([...readAutoState(dir)], ['gamma'], 'the current location is authoritative once it exists')

  writeFileSync(join(dir, '.dsh-team-manager', 'auto.json'), '{ not json', 'utf8')
  assert.equal(readAutoState(dir).size, 0, 'corrupt state reads as all-off')
  assert.doesNotThrow(() => renderAutoPolicy(dir))

  // ── host API + prompt policy ─────────────────────────────────────────────
  writeAutoState(dir, ['alpha'])
  const host = await loadHost()
  host.apply(makeCtx(), { skillsDir: dir, importRoots: [] })
  const section = sections.get('dsh-team-manager:auto-skills')
  assert.ok(section, 'auto-invoke prompt section registered')
  assert.match(section.text(), /auto_invoke_skills/)
  assert.match(section.text(), /`alpha`/)
  assert.doesNotMatch(section.text(), /`beta`/)

  const list = await request('GET', '/skills')
  assert.equal(list.status, 200)
  assert.equal(list.payload.skills.find((skill) => skill.id === 'alpha').auto, true)
  assert.equal(list.payload.skills.find((skill) => skill.id === 'beta').auto, false)
  assert.equal(list.payload.skills.find((skill) => skill.id === 'beta').modelInvocable, false)

  assert.equal((await request('POST', '/skills/auto', { name: 'beta', auto: true })).status, 400)
  assert.equal(section.text().includes('`beta`'), false, 'model-disabled skill is not advertised')
  assert.equal((await request('POST', '/skills/auto', { name: 'gamma', auto: false })).status, 200)
  assert.equal((await request('POST', '/skills/auto', { name: 'alpha', auto: 'yes' })).status, 400)
  assert.equal((await request('POST', '/skills/auto', { name: '../escape', auto: true })).status, 400)
  assert.equal((await request('POST', '/skills/auto', { name: 'nope', auto: true })).status, 404)
  assert.equal((await request('GET', '/skills', undefined, { origin: 'https://evil.test' })).status, 403)

  // A fresh mount reads the persisted state (restart behavior).
  sections.clear()
  routes.length = 0
  host.apply(makeCtx(), { skillsDir: dir, importRoots: [] })
  const restarted = await request('GET', '/skills')
  assert.equal(restarted.payload.skills.find((skill) => skill.id === 'alpha').auto, true)
  assert.equal(restarted.payload.skills.find((skill) => skill.id === 'beta').auto, false)

  // Deleting a skill clears its auto state.
  assert.equal((await request('POST', '/skills/delete', { name: 'alpha' })).status, 200)
  assert.equal(existsSync(join(dir, 'alpha')), false)
  assert.equal(readAutoState(dir).has('alpha'), false)
  assert.doesNotMatch(sections.get('dsh-team-manager:auto-skills').text(), /`alpha`/)

  // No systemPrompt service: the API still works, the host does not throw.
  const before = disposers.length
  const beforeSections = sections.size
  host.apply(makeCtx({ withPrompt: false }), { skillsDir: dir, importRoots: [] })
  assert.ok(disposers.length > before)
  assert.equal(sections.size, beforeSections)

  // Contexts without inject() use the direct-read fallback.
  sections.clear()
  host.apply(makeCtx({ withInject: false }), { skillsDir: dir, importRoots: [] })
  assert.ok(sections.has('dsh-team-manager:auto-skills'), 'fallback registration without ctx.inject')

  console.log('PASS: auto state (file/API/restart/delete), model-invocation filter, disabled-skill filter, prompt policy, validation, auth, graceful degradation')
} finally {
  disposers.reverse().forEach((dispose) => { if (typeof dispose === 'function') dispose() })
  rmSync(tmp, { recursive: true, force: true })
}
