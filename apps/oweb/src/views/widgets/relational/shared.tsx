import type { FieldElement, OdooFieldMeta, ViewField } from '@odooseek/odoo-client'
import { getFieldWidget, NOOP } from '../index'

export function normalizeM2mValue(value: unknown): [number, string][] {
  if (!value) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (Array.isArray(value[0])) return value as [number, string][]
    const pairs: [number, string][] = []
    for (let i = 0; i < value.length - 1; i += 2) {
      if (typeof value[i] === 'number') {
        pairs.push([value[i] as number, String(value[i + 1] ?? '')])
      }
    }
    return pairs
  }
  return []
}

export function encodeM2mValue(tags: [number, string][]): unknown {
  return [[6, 0, tags.map(([id]) => id)]]
}

export function normalizeO2mValue(value: unknown): number[] {
  if (!value) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (typeof value[0] === 'number') return value as number[]
  }
  return []
}

export function renderO2mCellText(value: unknown, meta?: OdooFieldMeta): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    if (meta?.type === 'monetary') return value.toFixed(2)
    return String(value)
  }
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? String(value[1]) : `#${value[0]}`
  }
  return JSON.stringify(value)
}

/** Render a cell using the appropriate widget for rich display. */
export function O2mCellDisplay({
  col,
  value,
  meta,
  record,
  relation,
}: {
  col: ViewField
  value: unknown
  meta?: OdooFieldMeta
  record: Record<string, unknown>
  relation: string
}) {
  const fieldType = meta?.type ?? 'char'
  const Widget = getFieldWidget(col as FieldElement, fieldType)

  if (
    !col.widget &&
    ['char', 'text', 'integer', 'float', 'monetary', 'date', 'datetime', 'html'].includes(fieldType)
  ) {
    const text = renderO2mCellText(value, meta)
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-text-primary">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-border-default"
            style={{ backgroundColor: value }}
          />
          {text}
        </span>
      )
    }
    return <span className="text-sm text-text-primary">{text}</span>
  }

  return (
    <Widget
      field={col as FieldElement}
      value={value}
      onChange={NOOP}
      readOnly
      meta={{
        selection: meta?.selection as [string, string][] | undefined,
        type: meta?.type,
        relation: meta?.relation,
      }}
      record={record}
      model={relation}
      recordId={record.id as number}
    />
  )
}

/** Editable inline cell for o2m rows. */
export function O2mCellEdit({
  col,
  value,
  onChange,
  meta,
  record,
  relation,
}: {
  col: ViewField
  value: unknown
  onChange: (val: unknown) => void
  meta?: OdooFieldMeta
  record: Record<string, unknown>
  relation: string
}) {
  const fieldType = meta?.type ?? 'char'
  const Widget = getFieldWidget(col as FieldElement, fieldType)

  return (
    <Widget
      field={col as FieldElement}
      value={value}
      onChange={onChange}
      readOnly={false}
      meta={{
        selection: meta?.selection as [string, string][] | undefined,
        type: meta?.type,
        relation: meta?.relation,
      }}
      record={record}
      model={relation}
    />
  )
}
