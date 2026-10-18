// Print the auto-invoke policy text the host injects for one skills directory.
// Usage: node tools/show-auto-policy.mjs [skillsDir]
import { renderAutoPolicy } from '../lib/skill/skills.js'

const dir = process.argv[2] ?? new URL('../.tmp-skills', import.meta.url).pathname
console.log(renderAutoPolicy(dir))
