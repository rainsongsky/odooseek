import type { FieldWidgetProps } from './index'

export function SelectionWidget({
  field: _field,
  value,
  onChange,
  readOnly,
  meta,
}: FieldWidgetProps) {
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
      className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="">--</option>
      {meta.selection.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

export function PriorityWidget({ value, readOnly, onChange, meta }: FieldWidgetProps) {
  const selection = meta?.selection ?? []
  const max = selection.length || 3
  const stars = Number(value) || 0
  if (readOnly) {
    return (
      <span className="inline-flex gap-0.5 text-sm">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < stars ? 'text-amber-500' : 'text-border-default'}>
            ★
          </span>
        ))}
      </span>
    )
  }
  return (
    <div className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          title={selection[i]?.[1] ?? `Level ${i + 1}`}
          className={`text-sm ${i < stars ? 'text-amber-500' : 'text-border-default hover:text-amber-400'}`}
        >
          {i < stars ? '★' : '☆'}
        </button>
      ))}
      {stars > 0 && (
        <button type="button" onClick={() => onChange(0)} className="ml-1 text-xs text-text-muted">
          ✕
        </button>
      )}
    </div>
  )
}

export function StateBadgeWidget({ value, meta }: FieldWidgetProps) {
  const val = String(value ?? '')
  if (!val) return <span className="text-sm text-text-muted">—</span>
  const selection = meta?.selection ?? []
  const pair = selection.find(([k]) => k === val)
  const label = pair?.[1] ?? val
  const colors: Record<string, string> = {
    draft: 'bg-border-default text-text-secondary',
    done: 'bg-emerald-500/10 text-emerald-500',
    cancel: 'bg-red-500/10 text-red-500',
    posted: 'bg-blue-500/10 text-blue-500',
    confirmed: 'bg-blue-500/10 text-blue-500',
    new: 'bg-border-default text-text-secondary',
    assigned: 'bg-amber-500/10 text-amber-500',
    won: 'bg-emerald-500/10 text-emerald-500',
    lost: 'bg-red-500/10 text-red-500',
  }
  const color =
    colors[val.toLowerCase()] ?? 'bg-surface text-text-primary border border-border-default'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
