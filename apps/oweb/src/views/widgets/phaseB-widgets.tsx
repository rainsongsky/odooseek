import type { FieldWidgetProps } from './index'

export function DynamicSelectionWidget({
  value,
  onChange,
  readOnly,
  meta,
  field,
  record,
}: FieldWidgetProps) {
  const selection = meta?.selection ?? []
  const currentVal = String(value ?? '')

  // Filter based on parent field's value if options.dynamic_field is set
  const opts = (field.options as Record<string, unknown>) ?? {}
  const parentField = opts.dynamic_field as string | undefined
  const parentValue = parentField ? String(record?.[parentField] ?? '') : ''

  const filtered = parentField
    ? selection.filter(([k]) => {
        // For dynamic selection, options may include a prefix matching the parent value
        if (!parentValue) return true
        return String(k).startsWith(`${parentValue}_`) || !String(k).includes('_')
      })
    : selection

  if (readOnly) {
    const pair = filtered.find(([k]) => k === currentVal)
    return <span className="text-sm text-text-primary">{pair?.[1] ?? (currentVal || '—')}</span>
  }

  return (
    <select
      value={currentVal}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="">--</option>
      {filtered.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

export function ProjectTaskStateWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const selection = meta?.selection ?? []
  const currentVal = String(value ?? '')

  const stateConfig: Record<string, { color: string; label: string }> = {
    '01_in_progress': { color: 'text-info', label: 'In Progress' },
    '02_changes_requested': { color: 'text-warning', label: 'Changes Requested' },
    '03_approved': { color: 'text-success', label: 'Approved' },
    '04_waiting_normal': { color: 'text-muted', label: 'Waiting' },
    '1_done': { color: 'text-success', label: 'Done' },
    '1_canceled': { color: 'text-danger', label: 'Canceled' },
  }

  const conf = stateConfig[currentVal] ?? {}
  const pair = selection.find(([k]) => k === currentVal)

  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-sm ${conf.color ?? 'text-text-primary'}`}
      >
        {conf.color ? '●' : ''} {pair?.[1] ?? (currentVal || '—')}
      </span>
    )
  }

  return (
    <select
      value={currentVal}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="">--</option>
      {selection.map(([k, v]) => {
        const c = stateConfig[k]
        return (
          <option key={k} value={k}>
            {c?.color ? '● ' : ''}
            {v}
          </option>
        )
      })}
    </select>
  )
}
