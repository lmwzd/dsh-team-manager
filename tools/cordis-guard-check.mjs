import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { createCompatibilityGuard } from '../lib/compatibility.js'
const target = process.argv[2]
if (target) {
  const { Context } = await import(pathToFileURL(target).href)
  const ctx = new Context()
  const original = ctx.effect
  const guard = createCompatibilityGuard(ctx)
  let live = 0
  guard.context.effect(() => { live++; return () => live-- }, 'probe')
  assert.equal(live, 1)
  // Cordis returns a fresh bound method on each property read; exercise it.
  const disposeDirect = ctx.effect(() => { live++; return () => live-- }, 'direct probe')
  disposeDirect()
  assert.equal(live, 1, 'original context effect remains callable')
  await guard.stop('probe conflict')
  assert.equal(live, 0)
  console.log('PASS: real Cordis context facade, no recursion, registration cleanup')
}
