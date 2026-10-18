/**
 * Host half of dsh-team-manager-subagent.
 *
 * Manages custom subagents as one markdown file per agent under the dsh home
 * agents directory (`$DSH_HOME/agents/<name>.md`, the same convention and file
 * format dsh's own agent manager and @aiwayds/dsh-subagent-registry use), and
 * gives the main-conversation model a `run_subagent` tool that dispatches any
 * of them by name through the host's assembled `spawn` subagent provider.
 *
 * Three surfaces:
 *
 *   1. An HTTP CRUD API on `/dsh-team-manager/api/subagent/*` consumed by this
 *      plugin's settings-page UI (list / get / save / delete agents, plus the
 *      provider/model catalog read from `ctx.llm` for the model picker).
 *   2. The `run_subagent` tool: the roster lives in its description; every
 *      save/delete through the API re-registers the tool, so the model-visible
 *      roster stays fresh without a host restart.
 *   3. The frontmatter `model` route (`provider/model`) and `thinking` level
 *      are projected into the child's `agentOptions` exactly like
 *      dsh-subagent-registry does, so what the UI writes is what dispatch uses.
 *
 * File-safety contract: this plugin only writes `<agentsDir>/<name>.md` files
 * whose `<name>` passed `isValidName` (no separators, no `.`/`..`), so its API
 * can never touch anything outside the agents directory. The HTTP surface
 * additionally runs the same trust fence the kernel applies to `/api` (host
 * connection admission when present, structural loopback/origin replica
 * otherwise), because a prefix route longer than `/api` would otherwise answer
 * any loopback caller.
 */

import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import { agentsDir, deleteAgent, expandHome, isValidName, listAgentFiles, loadAgent, saveAgent, THINKING_LEVELS, thinkingAlias, readImportCandidate, resolveWithinRoots, browseImportDir, dshHome } from './agents.js'

/** Loader/plugin name, used for log prefixes. */
const PLUGIN_NAME = 'dsh-team-manager-subagent'

/** HTTP prefix this plugin's routes live under. */
const API_PREFIX = '/dsh-team-manager/api/subagent'

/** Loopback hostnames a same-machine caller can legitimately use. */
const LOOPBACK_NAMES = new Set(['127.0.0.1', '[::1]', '::1', 'localhost'])

/** Model-catalog cache window, so opening the editor is not a fan-out storm. */
const MODELS_CACHE_MS = 30_000

// ---------------------------------------------------------------------------
// Trust fence (same shape as the kernel's /api admission; self-contained)
// ---------------------------------------------------------------------------

/** Split a Host/Origin/Referer value into {scheme, hostname, port}. */
function authorityOf(value, defaultScheme) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let url
  try {
    url = new URL(value.includes('://') ? value.trim() : `${defaultScheme ?? 'http'}://${value.trim()}`)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const port = url.port === '' ? (url.protocol === 'https:' ? '443' : '80') : url.port
  return { scheme: url.protocol.replace(':', ''), hostname: url.hostname.toLowerCase(), port }
}

/** The desktop app's own relay Referer (dsh-app://app) is same-machine. */
function isDesktopRelayReferer(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'dsh-app:' && url.hostname === 'app' && url.port === ''
  } catch {
    return false
  }
}

/** Structural fence: loopback host, no cross-site fetch, origin/host match. */
function structuralRejection(req) {
  const host = authorityOf(req.headers?.host, 'http')
  if (host === null || !LOOPBACK_NAMES.has(host.hostname)) return 403
  const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
  if (site === 'cross-site') return 403
  for (const header of ['origin', 'referer']) {
    const raw = req.headers?.[header]
    if (typeof raw !== 'string' || raw.trim() === '') continue
    if (header === 'referer' && isDesktopRelayReferer(raw)) continue
    const authority = authorityOf(raw.trim())
    if (authority === null) return 403
    if (authority.scheme !== host.scheme || authority.hostname !== host.hostname || authority.port !== host.port) return 403
  }
  return undefined
}

/**
 * Decide one request's rejection status, preferring the composition's own
 * `connection` service (the exact admission the kernel applies to `/api`)
 * when it exists. Read late, per request: the service may be published long
 * after plugins load.
 *
 * Exported for the headless self-check; the plugin contract is
 * apply/inject/Config.
 */
export function rejectionFor(req, connection) {
  try {
    if (connection !== undefined) {
      if (typeof connection.admit === 'function') {
        const admission = connection.admit(req)
        const status = admission && typeof admission === 'object' ? admission.rejection : undefined
        return status === undefined ? undefined : status
      }
      if (typeof connection.requestRejection === 'function') {
        return connection.requestRejection(req)
      }
    }
  } catch {
    // Never bypass browser authentication when the mounted service fails.
    return 503
  }
  return structuralRejection(req)
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/** Read a bounded JSON body. */
async function readJsonBody(req, maxBytes = 512 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  return JSON.parse(text)
}

/** Write one JSON response. */
function writeJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

// ---------------------------------------------------------------------------
// API field validation (the settings UI's save payload)
// ---------------------------------------------------------------------------

/** Coerce one save body into { meta, body }, throwing a clear message on invalid input. */
export function validateSave(payload) {
  if (payload === null || typeof payload !== 'object') throw new Error('body must be a JSON object')
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!isValidName(name)) {
    throw new Error('invalid name: letters, digits, `-`, `_`, `.` (not first) or CJK; max 128 chars; no `/` or `\\`')
  }
  const str = (key, max) => {
    const value = payload[key]
    if (value === undefined || value === null) return undefined
    const s = String(value).trim()
    if (s === '') return undefined
    if (s.length > max) throw new Error(`invalid ${key}: longer than ${max} characters`)
    if (/[\r\n]/.test(s)) throw new Error(`invalid ${key}: must be a single line`)
    return s
  }
  const meta = { name }
  meta.displayName = str('displayName', 64)
  meta.description = str('description', 2000)
  meta.model = str('model', 300)
  const thinking = str('thinking', 12)
  if (thinking !== undefined) {
    if (!THINKING_LEVELS.includes(thinking)) throw new Error(`invalid thinking: expected one of ${THINKING_LEVELS.join('/')}`)
    meta.thinking = thinking
  }
  let deep = 1
  if (payload.deep !== undefined && payload.deep !== null && payload.deep !== '') {
    const n = Number(payload.deep)
    if (!Number.isInteger(n) || n < 0) throw new Error('invalid deep: expected a non-negative integer')
    deep = n
  }
  meta.deep = deep
  if (payload.background === true || payload.background === false) meta.background = payload.background
  if (payload.maxRounds !== undefined && payload.maxRounds !== null && payload.maxRounds !== '') {
    const n = Number(payload.maxRounds)
    if (!Number.isInteger(n) || n < 1) throw new Error('invalid maxRounds: expected a positive integer')
    meta.maxRounds = n
  }
  const body = typeof payload.body === 'string' ? payload.body : ''
  return { meta, body }
}

// ---------------------------------------------------------------------------
// The by-name dispatch tool
// ---------------------------------------------------------------------------

/** Join text blocks from a canonical block array. */
function textOf(output) {
  return (output ?? [])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
}

/** Global registered names accepted by the public tools.restrict() API. */
function resolveHostToolNames(ctx) {
  try {
    const schemas = ctx.tools?.schemas?.()
    if (Array.isArray(schemas)) return new Set(schemas.map((tool) => tool.name))
    return undefined
  } catch {
    return undefined
  }
}

/**
 * The deny list installed on a `deep: 0` (leaf) agent's child. An explicit
 * `leafDenyTools` from the plugin config is owned by the caller and passes
 * verbatim (this plugin's own tool name is always appended); the built-in
 * default is intersected with the host's registered names — the stock
 * spawn-tool list enumerates a moving distribution, and a stale name aborts
 * the whole spawn where `tools.restrict()` is fail-fast (same hardening
 * dsh-subagent-registry applies; see its leafDenyList).
 */
export function leafDenyList(cfg, hostKnown) {
  const defaults = [...cfg.leafDenyTools, cfg.toolName]
  if (cfg.leafDenyToolsExplicit) return defaults
  return hostKnown !== undefined ? defaults.filter((name) => hostKnown.has(name)) : defaults
}

/**
 * Build the `ctx.tools.register`-ready definition for one roster snapshot.
 * `defineTool` is the host's own authoring seam (same as dsh-subagent-registry
 * ships compiled away); the roster is captured at registration time and the
 * whole definition is rebuilt on every save/delete so the model-visible list
 * stays fresh.
 */
export function buildToolDefinition(ctx, cfg, dir) {
  // Read once per (re)registration: the global tool set is stable by the time
  // a session can call this tool, and leaf deny lists intersect the default
  // against it (see leafDenyList).
  const hostKnownTools = resolveHostToolNames(ctx)
  const { agents, broken } = listAgentFiles(dir)
  const rosterLines = agents.map((agent) => {
    const label = agent.meta.displayName !== undefined ? `${agent.meta.name} (${agent.meta.displayName})` : agent.meta.name
    const desc = (agent.meta.description ?? '').replace(/\s+/g, ' ').slice(0, 200)
    return `- ${label}: ${desc}`
  })
  if (broken.length > 0) {
    rosterLines.push(`- (unparsable agent files excluded: ${broken.map((b) => b.path).join(', ')})`)
  }
  const nameList = agents.map((agent) => agent.meta.name).join(', ')
  const description =
    `Run one of the user's custom subagents by name. Each is defined in ${dir}/<name>.md ` +
    `(managed through the Subagent Manager page in Settings) and runs as its own subagent ` +
    `with its own persona/system prompt and — when configured — a fixed model route and ` +
    `thinking level. Pass the exact agent name and a complete, self-contained prompt (the ` +
    `subagent does not see this conversation, so include everything it needs). ` +
    `Set background=true to start it as a durable background conversation and receive its ` +
    `subagent id immediately; follow up later with send_message / ask_agent, and a runtime ` +
    `notice reports how the run settled. Omit background (or pass false) to wait for the ` +
    `result in-line.\n` +
    `Available subagents:\n${rosterLines.length > 0 ? rosterLines.join('\n') : '- (none defined yet — the user can add them in Settings → Subagent Manager)'}`

  return {
    name: cfg.toolName,
    description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['agent', 'prompt'],
      properties: {
      agent: {
        type: 'string',
        description: `The name of the custom subagent to run. One of: ${nameList === '' ? '(none yet)' : nameList}`,
      },
      prompt: {
        type: 'string',
        description: 'The complete, self-contained task for the selected subagent.',
      },
      background: {
        type: 'boolean',
        description:
          'Start the subagent as a durable background conversation and return its id immediately instead of waiting for the result. Defaults to the agent file\'s frontmatter `background`.',
      },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'output'],
        properties: {
          kind: { type: 'string' },
          output: { type: 'array', items: {} },
          subagentId: { type: 'string' },
          label: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: textOf(value?.output) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (!args || typeof args.agent !== 'string' || !args.agent.trim() || typeof args.prompt !== 'string') throw new TypeError('agent and prompt must be strings')
      if (args.background !== undefined && typeof args.background !== 'boolean') throw new TypeError('background must be boolean')
      const parent = exec.agent
      if (parent === undefined) throw new Error(`${cfg.toolName} requires a calling agent`)
      const loaded = loadAgent(dir, String(args.agent ?? ''))
      if (!loaded.ok) {
        const hint = nameList === '' ? 'no subagents defined in this directory' : `available: ${nameList}`
        throw new Error(`unknown subagent "${args.agent}" — ${loaded.error} (${hint})`)
      }
      const { meta, body } = loaded.agent
      const label = meta.displayName ?? meta.name

      // Model route (`provider/model`) and thinking effort go into the child's
      // agentOptions verbatim — the same carrier dsh-subagent-registry uses.
      const agentOptions = {}
      const modelRoute = (meta.model ?? '').trim()
      if (modelRoute !== '') {
        const slash = modelRoute.indexOf('/')
        if (slash < 0) agentOptions.provider = modelRoute
        else {
          agentOptions.provider = modelRoute.slice(0, slash).trim()
          agentOptions.model = modelRoute.slice(slash + 1).trim()
        }
      }
      if (meta.thinking !== undefined) {
        const llm = ctx.get?.('llm')
        const inherited = parent.session?.requestHeader?.()?.config ?? {}
        const provider = agentOptions.provider ?? inherited.provider
        const model = agentOptions.model ?? inherited.model
        if (provider && model && typeof llm?.resolveModelInfo === 'function') {
          const info = await llm.resolveModelInfo(provider, model, exec.signal)
          const efforts = (info.reasoning?.efforts ?? []).map(item => item.id)
          if (efforts.includes(meta.thinking)) agentOptions.reasoningEffort = meta.thinking
          else {
            // Providers name the same ladder differently (light/balanced/deep
            // vs low/medium/high); translate before giving up on the setting.
            const alias = thinkingAlias(meta.thinking)
            if (alias !== undefined && efforts.includes(alias)) {
              agentOptions.reasoningEffort = alias
              ctx.logger?.warn?.(`TeamManeger: ${label} thinking=${meta.thinking} not declared by ${provider}/${model}; using equivalent "${alias}"`)
            } else if (info.reasoning?.defaultEffort) {
              agentOptions.reasoningEffort = info.reasoning.defaultEffort
              ctx.logger?.warn?.(`TeamManeger: ${label} thinking=${meta.thinking} unavailable on ${provider}/${model} (supports: ${efforts.join('/') || 'none'}); using model default "${info.reasoning.defaultEffort}"`)
            } else {
              ctx.logger?.warn?.(`TeamManeger: ${label} thinking=${meta.thinking} unavailable on ${provider}/${model} (supports: ${efforts.join('/') || 'none'}); model has no reasoning control`)
            }
          }
        } else agentOptions.reasoningEffort = meta.thinking
      }

      // `deep` semantics, same contract as dsh-subagent-registry:
      // 0 = leaf (runs but cannot spawn: every spawn tool is denied);
      // >=1 = relative spawn-depth budget on top of the child's absolute depth.
      const deep = meta.deep ?? 1
      const runtimeDepth = parent.options?.subagentDepth ?? 0
      const persistedDepth = parent.session?.header?.delegationDepth ?? 0
      for (const value of [runtimeDepth, persistedDepth]) {
        if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError('Invalid delegation depth')
      }
      const childDepth = Math.max(runtimeDepth, persistedDepth) + 1
      if (!Number.isSafeInteger(childDepth + deep)) throw new RangeError('Delegation depth exceeds safe-integer range')
      const request = {
        prompt: [{ type: 'text', text: String(args.prompt ?? '') }],
        parent,
        // Enforce the requested absolute cap at creation; leaf tools also
        // remain restricted during this plugin lifetime.
        maxDepth: childDepth + deep,
        ...(Object.keys(agentOptions).length > 0 ? { agentOptions } : {}),
      }

      const wantsBackground = args.background === undefined ? meta.background === true : args.background === true
      // The current start contract delegates composition to presets and no
      // longer accepts persona/toolFilter. Reserve the identity and initialize
      // only that child through the awaited event, before its loop may run.
      // Keep background listeners for same-process cold resume. Cordis owns
      // them on plugin unload; foreground/start-failure paths remove them now.
      const childId = randomUUID()
      const denied = deep === 0 ? leafDenyList(cfg, resolveHostToolNames(ctx) ?? hostKnownTools) : []
      if (typeof ctx.on !== 'function') throw new Error('Named subagents require the agent/created initialization event')
      let startupFailure = ''
      const removeError = ctx.on('agent/error', ({ agent, error }) => {
        if (agent.id === childId) startupFailure = error instanceof Error ? error.message : String(error)
      })
      const removeCreated = ctx.on('agent/created', ({ agent }) => {
        if (agent.id !== childId) return
        if (agent.session.header.parentSession !== parent.id) throw new Error('Named subagent parent identity mismatch')
        agent.ctx.systemPrompt.section({
          name: 'dsh-team-manager:persona',
          order: agent.ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
          text: body,
          interpolate: false,
        })
        if (denied.length > 0) agent.ctx.tools.restrict({ deny: denied })
      })
      const removeComposition = () => { removeCreated(); removeError() }
      let run
      try {
        run = await ctx.subagents.startActivation({
          provider: cfg.provider,
          childId,
          label,
          request,
          signal: exec.signal,
          delivery: wantsBackground ? 'parent' : 'caller',
        })
      } catch (error) {
        removeComposition()
        throw error
      }
      if (wantsBackground) {
        return {
          kind: 'subagent-start',
          subagentId: String(childId),
          label,
          output: [{
            type: 'text',
            text:
              `Started background subagent "${label}" (durable subagent id ${String(childId)}). ` +
              `It is working in its own conversation; follow up with send_message / ask_agent by ` +
              `name "${label}" or id ${String(childId)}. A runtime notice will report how the run settles. ` +
              `Its custom persona and tool restrictions are retained until TeamManeger or DSH reloads; ` +
              `after a reload, start a new named subagent instead of resuming this one.`,
          }],
        }
      }

      // Background settlement is delivered by the runtime; caller delivery
      // gives foreground execution ownership of the result and disposal.
      // Always dispose exactly once, whatever happens to the result; a
      // disposal failure after a good result is a leak note, never a mask.
      let result
      let failureDetail = ''
      try {
        result = await run.result
        if (result.stopReason === 'error') {
          const session = ctx.get('sessions')?.get(run.childId)
          const events = session?.snapshotEvents() ?? []
          const ended = events.findLast(event => event.type === 'turn/end' && event.data.reason?.kind === 'error')
          failureDetail = ended?.data.reason.error?.message ?? ''
        }
      } catch (error) {
        try { await run.dispose() } catch { /* the run failure is the honest answer */ }
        finally { removeComposition() }
        throw error
      }
      try {
        await run.dispose()
      } catch (error) {
        ctx.logger?.warn?.(`${PLUGIN_NAME}: run disposal failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        removeComposition()
      }
      if (result.stopReason !== 'completed') {
        const text = textOf(result.output)
        const headline = `subagent "${label}" ended with stopReason=${String(result.stopReason)}${result.diagnostic || startupFailure || failureDetail ? ': ' + (result.diagnostic || startupFailure || failureDetail) : ''}`
        throw new Error(text === '' ? headline : `${headline}\nPartial output before the run ended:\n${text}`)
      }
      return { kind: 'subagent-result', label, output: result.output }
    },
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Services this host half needs. `llm` and `connection` are read late per
 * request (`ctx.get`) — the model catalog and the admission fence degrade
 * gracefully without them — so they are not hard-declared here.
 */
export const inject = ['tools', 'subagents', 'webServer']

/** Plugin configuration (schemastery = the loader's Config contract). */
export const Config = z.object({
  /** Directory of `<name>.md` agent files; `~` expands to the home. */
  agentsDir: z.string().default('~/.dsh/agents'),
  /** The assembled subagent provider used for dispatch. */
  provider: z.string().default('spawn'),
  /** Name of the by-name dispatch tool. */
  toolName: z.string().default('run_subagent'),
  /** Tool names denied to `deep: 0` (leaf) agents' children. */
  leafDenyTools: z.array(z.string()).default(['subagent', 'subagent_fork', 'workflow', 'ralph']),
  /**
   * Extra directories the import surface may read. Registered workspace
   * directories and the dsh home are always allowed; this list extends the
   * allow-list for specs kept elsewhere (absolute or `~`-prefixed paths).
   */
  importRoots: z.array(z.string()).default([]),
})

export function apply(ctx, config) {
  const cfg = {
    agentsDir: config?.agentsDir ?? '~/.dsh/agents',
    provider: config?.provider ?? 'spawn',
    toolName: config?.toolName ?? 'run_subagent',
    leafDenyTools: config?.leafDenyTools?.length > 0 ? config.leafDenyTools : ['subagent', 'subagent_fork', 'workflow', 'ralph'],
    leafDenyToolsExplicit: config?.leafDenyTools?.length > 0,
    importRoots: Array.isArray(config?.importRoots) ? config.importRoots : [],
  }
  // Same home-resolution as dsh-subagent-registry: the default literal means
  // "under the dsh home", so $DSH_HOME is honored; a custom path is verbatim.
  const dir = cfg.agentsDir === '~/.dsh/agents' ? agentsDir() : expandHome(cfg.agentsDir)

  // ── tool, re-registered whenever the roster changes ─────────────────────
  // Same pattern as dsh-subagent-registry: ctx.effect owns the disposer, so
  // plugin disposal unregisters the tool; a roster change first disposes the
  // previous registration effect, then mounts a fresh one. The provider is
  // re-resolved at execute time by ctx.subagents, so a later-applying
  // provider plugin is not a race.
  let disposeToolRegistration
  const registerTool = () => {
    disposeToolRegistration?.()
    disposeToolRegistration = ctx.effect(
      () => ctx.tools.register(buildToolDefinition(ctx, cfg, dir)),
      `${PLUGIN_NAME}: ${cfg.toolName}`,
    )
  }
  registerTool()

  // ── model catalog (for the UI's picker), cached briefly ─────────────────
  let modelsCache = { at: 0, data: undefined }
  const modelCatalog = async () => {
    if (modelsCache.data !== undefined && Date.now() - modelsCache.at < MODELS_CACHE_MS) return modelsCache.data
    const llm = ctx.get?.('llm')
    if (llm === undefined || typeof llm.listProviders !== 'function') return []
    let providers = []
    try {
      const raw = llm.listProviders()
      if (Array.isArray(raw)) providers = raw.filter((e) => typeof e?.id === 'string')
    } catch {
      return []
    }
    const groups = await Promise.all(providers.map(async ({ id }) => {
      const group = {
        provider: id,
        displayName: typeof providers.find((p) => p.id === id)?.displayName === 'string' && providers.find((p) => p.id === id).displayName !== ''
          ? providers.find((p) => p.id === id).displayName
          : id,
        models: [],
        error: undefined,
      }
      try {
        const models = typeof llm.listModels === 'function' ? await llm.listModels(id) : []
        // Each model declares its own effort vocabulary; publish it so the
        // editor offers the levels the selected model actually understands.
        group.models = await Promise.all((models ?? [])
          .filter((m) => typeof m?.id === 'string')
          .map(async (m) => {
            const model = { id: m.id, name: typeof m?.name === 'string' && m.name !== '' ? m.name : m.id }
            if (typeof llm.resolveModelInfo === 'function') {
              try {
                const info = await llm.resolveModelInfo(id, m.id)
                const efforts = (info?.reasoning?.efforts ?? []).map(effort => effort.id)
                if (efforts.length > 0) model.efforts = efforts
                if (info?.reasoning?.defaultEffort !== undefined) model.defaultEffort = info.reasoning.defaultEffort
              } catch { /* capability lookup is advisory for the picker */ }
            }
            return model
          }))
      } catch (error) {
        group.error = error instanceof Error ? error.message : String(error)
      }
      return group
    }))
    modelsCache = { at: Date.now(), data: groups }
    return groups
  }

  // ── HTTP CRUD API ───────────────────────────────────────────────────────
  // Import roots: registered workspaces + dsh home + config. The workspace
  // list is read live (workspaces appear while the app runs); the configured
  // extra roots are static. If the service is missing, the config roots +
  // dsh home still work.
  const staticImportRoots = [
    agentsDir(),
    dshHome(),
    ...(cfg.importRoots ?? []).map((root) => expandHome(root)),
  ].filter((root) => typeof root === 'string' && root !== '')
  // Explicit OS selections extend the read scope for this plugin lifetime only.
  const pickedImportRoots = new Set()
  const importRoots = () => {
    const roots = []
    try {
      const registry = ctx.get('workspaceRegistry')
      for (const workspace of registry?.list?.() ?? []) {
        if (typeof workspace?.path === 'string' && workspace.path !== '') roots.push(workspace.path)
      }
    } catch { /* registry not mounted — configured roots still stand */ }
    roots.push(...staticImportRoots, ...pickedImportRoots)
    return roots
  }

  const api = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    const route = url.pathname.startsWith(`${API_PREFIX}/`) ? url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') : ''
    const method = String(req.method ?? 'GET').toUpperCase()
    const connection = ctx.get('connection')
    const rejection = rejectionFor(req, connection)
    if (rejection !== undefined) {
      return writeJson(res, rejection, { ok: false, error: rejection === 401 ? 'unauthorized' : 'forbidden' })
    }
    const send = (status, payload) => writeJson(res, status, payload)
    try {
      if (method === 'GET' && route === '/agents') {
        const { agents, broken } = listAgentFiles(dir)
        return send(200, {
          ok: true,
          dir,
          agents: agents.map(({ meta, body }) => ({ ...meta, bodyBytes: Buffer.byteLength(body ?? '', 'utf8') })),
          broken,
        })
      }
      if (method === 'GET' && route === '/agents/get') {
        const name = url.searchParams.get('name') ?? ''
        const loaded = loadAgent(dir, name)
        if (!loaded.ok) return send(404, { ok: false, error: loaded.error })
        return send(200, { ok: true, meta: loaded.agent.meta, body: loaded.agent.body })
      }
      if (method === 'GET' && route === '/models') {
        return send(200, { ok: true, providers: await modelCatalog() })
      }
      // ── import: read an already-written persona spec ────────────────────
      // Reads stay within configured roots or directories explicitly chosen
      // through the host OS picker during this plugin lifetime.
      if (method === 'POST' && route === '/import/pick-directory') {
        const capability = ctx.get('directoryPicker')?.capability()
        if (capability?.kind !== 'native') {
          return send(503, { ok: false, error: '当前宿主未提供系统目录选择窗口，请手动输入路径后按回车。' })
        }
        const controller = new AbortController()
        const abort = () => controller.abort()
        res.on?.('close', abort)
        try {
          const picked = await capability.pick(controller.signal)
          if (picked === null) return send(200, { ok: true, path: null })
          const browsed = browseImportDir(picked)
          if (!browsed.ok) return send(400, { ok: false, error: browsed.error })
          pickedImportRoots.add(browsed.dir)
          return send(200, { ok: true, path: browsed.dir })
        } finally {
          res.off?.('close', abort)
        }
      }
      if (method === 'GET' && route === '/import/roots') {
        return send(200, { ok: true, roots: importRoots() })
      }
      if (method === 'GET' && route === '/import/browse') {
        const requested = url.searchParams.get('path') ?? ''
        const roots = importRoots()
        // No auto-landing and no preset list: the user always picks where to
        // look — through the host's OS chooser or a typed path.
        if (requested === '') {
          return send(200, { ok: true, roots, dir: null, files: [], dirs: [], parent: null })
        }
        const target = resolveWithinRoots(requested, roots)
        if (target === undefined) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import browse refused (outside roots): ${requested} | roots: ${roots.join(', ')}`)
          return send(403, { ok: false, error: `路径不在允许导入的目录内：${requested}` })
        }
        const browsed = browseImportDir(target)
        if (!browsed.ok) return send(400, { ok: false, error: browsed.error })
        // Up-navigation stays inside the fence: a parent outside every
        // allowed root is not offered. Subdirectories are offered only while
        // they are inside a root too (browse got here via a contained path,
        // so children of it are contained unless they escape via symlinks —
        // resolveWithinRoots re-checks on the next hop anyway).
        const parent = browsed.parent !== null && resolveWithinRoots(browsed.parent, roots) !== undefined
          ? browsed.parent : null
        return send(200, { ok: true, roots, ...browsed, parent })
      }
      if (method === 'POST' && route === '/import/preview') {
        const payload = await readJsonBody(req)
        const roots = importRoots()
        const target = resolveWithinRoots(String(payload?.path ?? ''), roots)
        if (target === undefined) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import preview refused (outside roots): ${payload?.path} | roots: ${roots.join(', ')}`)
          return send(403, { ok: false, error: `路径不在允许导入的目录内：${payload?.path}` })
        }
        const candidate = readImportCandidate(target)
        if (!candidate.ok) {
          ctx.logger?.warn?.(`${PLUGIN_NAME}: import preview failed: ${target}: ${candidate.error}`)
          return send(400, { ok: false, error: candidate.error })
        }
        return send(200, { ok: true, candidate })
      }
      if (method === 'POST' && route === '/import/batch') {
        const payload = await readJsonBody(req)
        const paths = Array.isArray(payload?.paths) ? payload.paths.slice(0, 100) : []
        if (paths.length === 0) return send(400, { ok: false, error: 'paths 为空' })
        const roots = importRoots()
        const results = []
        for (const requested of paths) {
          const target = resolveWithinRoots(String(requested ?? ''), roots)
          if (target === undefined) {
            results.push({ path: String(requested), status: 'rejected', error: '不在允许导入的目录内' })
            continue
          }
          const candidate = readImportCandidate(target)
          if (!candidate.ok) {
            results.push({ path: target, status: 'failed', error: candidate.error })
            continue
          }
          // A name that already exists is never silently overwritten: the
          // user deletes or edits deliberately; a batch import only fills in
          // what is missing.
          if (loadAgent(dir, candidate.name).ok) {
            results.push({ path: target, name: candidate.name, status: 'skipped', error: '同名 Subagent 已存在' })
            continue
          }
          // Shared overrides from the request (e.g. "import them all pinned
          // to this model") — identity fields always come from the file.
          const overrides = payload?.meta ?? {}
          const meta = { ...candidate.meta, deep: candidate.meta?.deep ?? 1 }
          for (const key of ['displayName', 'description', 'model', 'thinking', 'background', 'maxRounds']) {
            const value = overrides[key]
            if (value !== undefined && value !== null && value !== '') meta[key] = value
          }
          if (overrides.deep !== undefined && overrides.deep !== null && overrides.deep !== '') meta.deep = Number(overrides.deep)
          meta.name = candidate.name
          try {
            saveAgent(dir, { meta, body: candidate.body })
            results.push({ path: target, name: candidate.name, status: 'imported' })
          } catch (error) {
            results.push({ path: target, status: 'failed', error: error instanceof Error ? error.message : String(error) })
          }
        }
        registerTool()
        return send(200, { ok: true, results })
      }
      if (method === 'POST' && route === '/agents/save') {
        const payload = await readJsonBody(req)
        let saved
        try {
          saved = validateSave(payload)
        } catch (error) {
          return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
        const path = saveAgent(dir, saved)
        // Re-read through the parse path, then refresh the tool: the roster
        // reflects exactly what is on disk, including a file that broke parse.
        registerTool()
        const reloaded = loadAgent(dir, saved.meta.name)
        return send(200, { ok: true, path, meta: reloaded.ok ? reloaded.agent.meta : saved.meta })
      }
      if (method === 'POST' && route === '/agents/delete') {
        const payload = await readJsonBody(req)
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        if (!isValidName(name)) return send(400, { ok: false, error: 'invalid name' })
        const removed = deleteAgent(dir, name)
        registerTool()
        return send(200, { ok: true, removed })
      }
      return send(404, { ok: false, error: 'unknown subagent-manager API route' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.logger?.warn?.(`${PLUGIN_NAME}: api ${route || '/'} failed: ${message}`)
      return send(400, { ok: false, error: message })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: api }), `${PLUGIN_NAME}: ${API_PREFIX} routes`)
}
