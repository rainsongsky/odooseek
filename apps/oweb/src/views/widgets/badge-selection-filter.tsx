import { useRef, useState } from 'react'
import type { FieldWidgetProps } from './index'

export function BadgeSelectionFilterWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selection = meta?.selection ?? []
  const currentVal = String(value ?? '')

  const filtered = selection.filter(([, label]) =>
    label.toLowerCase().includes(search.toLowerCase()),
  )

  if (readOnly) {
    const pair = selection.find(([k]) => k === currentVal)
    return (
      <span className="inline-block rounded-full bg-elevated px-3 py-1 text-xs font-medium text-text-secondary">
        {pair?.[1] ?? (value ? String(value) : '—')}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter..."
        className="w-full rounded border border-border-default bg-transparent px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none placeholder:text-text-muted"
      />
      <div className="flex flex-wrap gap-1.5">
        {filtered.map(([key, label]) => {
          const isSelected = key === currentVal
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-accent text-on-accent'
                  : 'bg-elevated text-text-secondary hover:bg-hover'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
