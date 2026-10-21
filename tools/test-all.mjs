/**
 * Run every self-check, one at a time.
 *
 * Sequential dynamic imports rather than static ones: a check with a
 * top-level await would otherwise let a sibling run at the same time, and the
 * two client checks both park the bundle on `globalThis.window.__ModuleLoader__`
 * — concurrent evaluation means one of them captures the other's loader.
 */
const checks = [
  'manifest-check',
  'assemble-check',
  'design-system-check',
  'docs-check',
  'compatibility-check',
  'host-compat-check',
  'module-toggle-check',
  'recycle-check',
  'skill-auto-check',
  'skill-note-check',
  'client-smoke-check',
  'ui-render-check',
  'subagent-activation-check',
  'subagent-childcap-check',
  'subagent-model-check',
  'subagent-effort-live-check',
]
for (const name of checks) await import(`./${name}.mjs`)
