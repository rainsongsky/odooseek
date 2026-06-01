import type { GroupCheckSession } from './auth'
import { hasGroup } from './auth'

/** Odoo arch `groups="a,b"` — visible if user has any listed group. */
export function passesXmlGroups(
  groupsAttr: string | undefined,
  session?: GroupCheckSession,
): boolean {
  if (!groupsAttr?.trim()) return true
  return groupsAttr
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .some((xmlId) => hasGroup(xmlId, session))
}
