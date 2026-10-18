import assert from 'node:assert/strict'
const origin = process.argv[2]
if (!origin) throw new Error('Pass current DSH origin')
for (const path of ['/dsh-team-manager/api/status', '/dsh-team-manager/api/modules', '/dsh-team-manager/api/skill/skills', '/dsh-team-manager/api/subagent/agents']) {
  const response = await fetch(new URL(path, origin), { headers: { origin, accept: 'application/json' } })
  const body = await response.text()
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}: ${body}`)
  const value = JSON.parse(body)
  if (path.endsWith('/status')) assert.equal(value.stopped, false, body)
  if (path.endsWith('/modules')) assert.deepEqual(value, { skill: true, subagent: true })
  console.log(`PASS live ${path}: HTTP 200, JSON response`)
}
