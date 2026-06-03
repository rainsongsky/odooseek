import type { FieldWidgetProps } from './index'

export function Many2ManyTaxTagsWidget({ value, readOnly, meta }: FieldWidgetProps) {
  const tags: Array<[number, string]> = Array.isArray(value)
    ? value
        .filter((v) => Array.isArray(v))
        .map((v) => [(v as [number, string])[0], String((v as [number, string])[1] ?? '')])
    : []

  const tagColors: Record<string, string> = {
    '0': 'bg-danger/10 text-danger',
    '1': 'bg-warning/10 text-warning',
    '2': 'bg-info/10 text-info',
    '3': 'bg-success/10 text-success',
  }

  if (tags.length === 0) return <span className="text-sm text-text-muted">—</span>

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(([id, name], i) => (
        <span
          key={id}
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tagColors[String(i % 4)] ?? 'bg-elevated text-text-secondary'}`}
        >
          {name || `#${id}`}
        </span>
      ))}
    </div>
  )
}

export function UpgradeBooleanWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  const checked = Boolean(value)

  if (readOnly) {
    return <span className="text-sm text-text-primary">{checked ? 'Yes' : 'No'}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-border-default'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      {!checked && (
        <span className="text-xs text-warning">Enterprise feature — requires upgrade</span>
      )}
    </div>
  )
}

export function ActivityExceptionWidget({ value, record }: FieldWidgetProps) {
  const id = Number(value)
  if (!id || !record) return null

  const summary = record.activity_exception_decoration as string | undefined
  const icon = record.activity_exception_icon as string | undefined

  if (!summary) return null

  return (
    <span className="inline-flex items-center gap-1 text-xs text-danger" title={summary}>
      {icon ? <i className={`fa ${icon}`} /> : '⚠'}
      <span className="truncate max-w-[120px]">{summary}</span>
    </span>
  )
}
