import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register(new URL('./test-resolver.mjs', import.meta.url), pathToFileURL('./'))
