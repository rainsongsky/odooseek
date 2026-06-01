/** Odoo session `groups` map: xml_id → group database id (or truthy). */
export type SessionGroups = Record<string, number | boolean>

export function parseSessionGroups(groups: unknown): SessionGroups {
  if (!groups || typeof groups !== 'object') return {}
  return groups as SessionGroups
}

/** True when the user has the given security group xml_id. */
export function userHasGroup(
  groups: SessionGroups | undefined,
  groupXmlId: string,
  opts?: { isAdmin?: boolean; isSystem?: boolean },
): boolean {
  if (opts?.isSystem || opts?.isAdmin) return true
  if (!groups || !groupXmlId) return false
  const direct = groups[groupXmlId]
  if (direct !== undefined && direct !== false) return true
  // Odoo sometimes nests under module prefix only in implied checks — accept exact xml_id match
  return Object.keys(groups).some((k) => k === groupXmlId && groups[k] !== false)
}
