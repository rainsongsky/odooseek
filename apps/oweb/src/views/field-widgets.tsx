import type { FieldElement } from '../lib/odoo-types'

export interface FieldWidgetProps {
  field: FieldElement
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean
  meta?: { selection?: [string, string][] }
}

function CharWidget({ field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={field.placeholder}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function TextWidget({ field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <textarea
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={field.placeholder}
      rows={3}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function IntegerWidget({ field: _field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="number"
      value={value != null ? Number(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      readOnly={readOnly}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function FloatWidget({ field: _field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="number"
      step="0.01"
      value={value != null ? Number(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      readOnly={readOnly}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function BooleanWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="checkbox"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
      disabled={readOnly}
      className="h-4 w-4 cursor-pointer rounded accent-accent"
    />
  )
}

function DateWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  if (readOnly) {
    return <span className="text-sm text-text-primary">{value ? String(value).slice(0, 10) : ''}</span>
  }
  return (
    <input
      type="date"
      value={value ? String(value).slice(0, 10) : ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    />
  )
}

function DatetimeWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  if (readOnly) {
    return <span className="text-sm text-text-primary">{value ? String(value).slice(0, 19) : ''}</span>
  }
  const dt = value ? String(value).slice(0, 19) : ''
  // Convert "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
  const local = dt ? dt.replace(' ', 'T').slice(0, 16) : ''
  return (
    <input
      type="datetime-local"
      value={local}
      onChange={(e) => onChange(e.target.value.replace('T', ' ') + ':00')}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    />
  )
}

function SelectionWidget({ field: _field, value, onChange, readOnly, meta }: FieldWidgetProps & { meta?: { selection?: [string, string][] } }) {
  if (readOnly) {
    return <span className="text-sm text-text-primary">{value != null ? String(value) : ''}</span>
  }
  if (!meta?.selection?.length) {
    return <span className="text-sm text-text-primary">{value != null ? String(value) : ''}</span>
  }
  return (
    <select
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="">--</option>
      {meta.selection.map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
  )
}

function Many2OneWidget({ value }: FieldWidgetProps) {
  if (Array.isArray(value) && value.length === 2) {
    return (
      <span className="text-sm text-text-primary">{value[1] ? `${value[1]}` : `#${value[0]}`}</span>
    )
  }
  return <span className="text-sm text-text-muted">—</span>
}

function Many2ManyWidget({ value }: FieldWidgetProps) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((id, i) => (
          <span key={i} className="rounded bg-surface px-2 py-0.5 text-xs text-text-primary">
            #{Array.isArray(id) && id[1] ? id[1] : id}
          </span>
        ))}
      </div>
    )
  }
  return <span className="text-sm text-text-muted">—</span>
}

export const TYPE_WIDGETS: Record<string, React.ComponentType<FieldWidgetProps>> = {
  char: CharWidget,
  text: TextWidget,
  integer: IntegerWidget,
  float: FloatWidget,
  monetary: FloatWidget,
  boolean: BooleanWidget,
  date: DateWidget,
  datetime: DatetimeWidget,
  selection: SelectionWidget,
  many2one: Many2OneWidget,
  many2many: Many2ManyWidget,
  one2many: Many2ManyWidget,
  binary: Many2OneWidget,
  html: TextWidget,
  reference: Many2OneWidget,
}

export function getFieldWidget(
  field: FieldElement,
  type: string,
): React.ComponentType<FieldWidgetProps> {
  return TYPE_WIDGETS[type] ?? CharWidget
}
