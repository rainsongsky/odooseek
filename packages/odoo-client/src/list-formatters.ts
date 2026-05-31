import type { OdooFieldMeta } from './types'

export const FIELD_TYPE_WIDTHS: Record<string, number> = {
  boolean: 50,
  integer: 80,
  float: 90,
  monetary: 110,
  date: 110,
  datetime: 160,
  selection: 120,
  many2one: 160,
  many2many: 140,
  one2many: 140,
  handle: 40,
}
export const DEFAULT_COL_WIDTH = 160

export function renderCell(value: unknown, meta?: OdooFieldMeta, _model?: string, _recordId?: number): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (typeof value === 'string') {
    if (meta?.type === 'html') return value.replace(/<[^>]*>/g, '')
    if (meta?.type === 'binary') return '🖼'
    if (meta?.selection) {
      const pair = meta.selection.find(([k]) => k === value)
      if (pair) return pair[1]
    }
    return value
  }
  if (typeof value === 'number') {
    if (meta?.type === 'monetary')
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (meta?.type === 'float') {
      const s = value.toFixed(2)
      return s.endsWith('.00') ? s.slice(0, -3) : s
    }
    if (meta?.type === 'integer') return value.toLocaleString()
    return String(value)
  }
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? String(value[1]) : `#${value[0]}`
  }
  if (Array.isArray(value) && value.length > 2) {
    const count = Math.floor(value.length / 2)
    return `${count} record${count !== 1 ? 's' : ''}`
  }
  return JSON.stringify(value)
}
