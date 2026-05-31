/** Odoo indexed color palette — shared by kanban, calendar, etc. Index 0 is unused. */
export const ODOO_INDEXED_COLORS = [
  '',
  '#a9a9a9',
  '#2ecc71',
  '#3498db',
  '#e67e22',
  '#9b59b6',
  '#1abc9c',
  '#f39c12',
  '#e74c3c',
  '#7f8c8d',
  '#0d6efd',
  '#d63384',
] as const

const CSS_COLOR_RE = /^(#|rgb|hsl)/i
const CSS_NAME_RE = /^[a-z]+$/i

/** Resolve an Odoo color field value to a CSS color string. */
export function getOdooIndexedColor(value: unknown): string | undefined {
  if (value === null || value === undefined || value === false) return undefined

  if (typeof value === 'string') {
    if (CSS_COLOR_RE.test(value) || CSS_NAME_RE.test(value)) return value
    const n = Number.parseInt(value, 10)
    if (Number.isNaN(n) || n === 0) return undefined
    return ODOO_INDEXED_COLORS[Math.min(Math.abs(n), ODOO_INDEXED_COLORS.length - 1)]
  }

  if (typeof value === 'number') {
    if (value === 0) return undefined
    return ODOO_INDEXED_COLORS[Math.min(Math.abs(value), ODOO_INDEXED_COLORS.length - 1)]
  }

  return undefined
}
