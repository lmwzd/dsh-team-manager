// Optional probe of the host's manifest evaluator, not a runtime interface test.
// Pass extracted app-boot and runtime package.json paths as argv[2]/argv[3],
// or set DSH_APP_BOOT and DSH_RUNTIME_MANIFEST. No local installation is assumed.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

async function probe() {
  const appBoot = process.argv[2] ?? process.env.DSH_APP_BOOT
  const runtimeManifest = process.argv[3] ?? process.env.DSH_RUNTIME_MANIFEST
  if (!appBoot || !runtimeManifest || !existsSync(appBoot) || !existsSync(runtimeManifest)) {
    console.log('SKIP host manifest probe: provide readable app-boot and runtime package.json paths via argv or DSH_APP_BOOT / DSH_RUNTIME_MANIFEST')
    return
  }
  const mod = await import(pathToFileURL(resolve(appBoot)).href)
  if (typeof mod.evaluatePluginCompatibility !== 'function') {
    console.log('SKIP host manifest probe: evaluatePluginCompatibility is not exported')
    return
  }
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const runtimeVersion = JSON.parse(readFileSync(runtimeManifest, 'utf8')).version
  const result = mod.evaluatePluginCompatibility(manifest, {}, runtimeVersion)
  assert.equal(result, undefined, `host rejected the plugin manifest: ${JSON.stringify(result)}`)
  console.log('PASS: host manifest evaluator reports no unmet requirements (runtime interfaces still need separate checks)')
}

// Safe to import from test-all: a skipped optional probe never exits its caller.
await probe()
