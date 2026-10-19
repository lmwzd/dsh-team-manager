/**
 * lib/client.js is generated. Fail the suite when it drifted from its sources
 * (lib/skill/client.js, lib/subagent/client.js, lib/tail.js, lib/ui.css) so a
 * hand edit to the bundle cannot silently diverge from the modules.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./assemble-client.mjs', import.meta.url))
execFileSync(process.execPath, [script, '--check'], { stdio: 'inherit' })
