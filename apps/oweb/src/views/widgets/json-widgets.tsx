import type { FieldWidgetProps } from './index'

export function JsonWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  const text = value != null ? JSON.stringify(value, null, 2) : ''

  if (readOnly) {
    if (!text) return <span className="text-sm text-text-muted">—</span>
    return (
      <pre className="max-h-60 overflow-auto rounded bg-elevated p-2 text-xs text-text-primary font-mono">
        {text}
      </pre>
    )
  }

  return (
    <textarea
      value={text}
      onChange={(e) => {
        try {
          onChange(JSON.parse(e.target.value))
        } catch {
          // invalid JSON, let user continue editing
        }
      }}
      rows={Math.max(3, text.split('\n').length)}
      className="w-full rounded border border-border-default bg-transparent px-2 py-1 text-xs text-text-primary font-mono focus:border-accent focus:outline-none"
      spellCheck={false}
    />
  )
}

export function JsonCheckboxesWidget({ value, onChange, readOnly, field }: FieldWidgetProps) {
  const json = (value as Record<string, boolean>) ?? {}
  const opts = (field.options as Record<string, unknown>) ?? {}
  const labels = (opts.labels as Record<string, string>) ?? {}

  const keys = Object.keys(json)

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1">
        {keys
          .filter((k) => json[k])
          .map((k) => (
            <span key={k} className="rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {labels[k] ?? k}
            </span>
          ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {keys.map((key) => (
        <label
          key={key}
          className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
        >
          <input
            type="checkbox"
            checked={!!json[key]}
            onChange={(e) => onChange({ ...json, [key]: e.target.checked })}
            className="accent-accent"
          />
          {labels[key] ?? key}
        </label>
      ))}
    </div>
  )
}
