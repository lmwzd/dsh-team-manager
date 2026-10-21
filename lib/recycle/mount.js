/** TeamManeger lifecycle and admission adapter for the bundled MIT recycle bin. */
import { apply as applyDelete } from './index.js'
import { apply as applyTrash } from './trash.js'
import { rejectionFor } from '../skill/index.js'

export function applyRecycle(ctx) {
  // Wait for the storage services together: a delete route must never become
  // active before its restorable trash service, or it could permanently purge.
  const boot = scoped => {
    const base = scoped.webServer ?? scoped.get('webServer')
    const webServer = { register(route) {
      return base.register({ ...route, handler(req, res) {
        const rejection = rejectionFor(req, scoped.get('connection'))
        if (rejection !== undefined) {
          res.writeHead(rejection, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Request denied' }))
          return
        }
        return route.handler(req, res)
      } })
    } }
    const adapted = {
      get: scoped.get.bind(scoped),
      effect: scoped.effect.bind(scoped),
      provide: scoped.provide.bind(scoped),
      webServer,
      logger: scoped.logger,
    }
    applyTrash(adapted)
    applyDelete(adapted)
  }
  if (typeof ctx.inject === 'function') ctx.inject(['webServer', 'sessionPersistence', 'workspaceRegistry'], boot)
  else boot(ctx)
}
