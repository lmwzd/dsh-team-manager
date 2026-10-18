const MAP = { '@deepseek-ai/schemastery': new URL('./test-schemastery.mjs', import.meta.url).href }
export async function resolve(specifier, context, nextResolve) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true }
  return nextResolve(specifier, context)
}
