/** Independently switchable component shipped inside the TeamManeger bundle. */
import { applyRecycle } from './mount.js'

export const name = 'dsh-team-manager-recycle'
export const inject = []

export function apply(ctx) {
  applyRecycle(ctx)
}
